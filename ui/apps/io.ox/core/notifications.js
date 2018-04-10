/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2016 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Mario Scheliga <mario.scheliga@open-xchange.com>
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */

define('io.ox/core/notifications', [
    'io.ox/core/extensions',
    'io.ox/backbone/mini-views/dropdown',
    'io.ox/core/yell',
    'io.ox/core/desktopNotifications',
    'io.ox/core/capabilities',
    'settings!io.ox/core',
    'gettext!io.ox/core',
    'io.ox/core/a11y'
], function (ext, Dropdown, yell, desktopNotifications, capabilities, settings, gt, a11y) {

    'use strict';

    var NotificationsModel = Backbone.Model.extend({
        defaults: {
            subviews: {},
            sidepopup: null,
            markedForRedraw: {}
        }
    });

    var NotificationsView = Backbone.View.extend({
        tagName: 'a',
        className: 'dropdown-toggle',
        initialize: function () {

            this.$el.attr('role', 'menu');
            this.$el.attr({
                'data-toggle': 'dropdown',
                href: '#'
            }).append($('<span class="badge" aria-hidden="true">').append(
                $('<span class="number">')
            ));
            this.listNode = $('<ul href="#" id="io-ox-notifications-display" class="dropdown-menu dropdown-menu-right">')
                .on('focus', '*', this.focusHover.bind(this))
                .on('keydown', this.onKeydown.bind(this))
                .on('click blur focusout', this.keepOpen);

            this.dropdown = new Dropdown({
                tagName: 'li',
                id: 'io-ox-notifications-icon',
                className: 'launcher dropdown notifications-icon',
                $ul: this.listNode,
                $toggle: this.$el,
                keep: true,
                smart: false,
                dontProcessOnMobile: true
            });

            this.sidepopupNode = $('<div id="io-ox-notifications-sidepopup">').on('click', this.keepOpen);

            this.delayedRender = _.debounce(this.render, 100);

            // we stop event bubbling in the sidepopup to keep the dropdown open.
            // we must add a new listener to make halos work again since the global handler is not triggered
            // Halo is not available for Guests without contacts.
            if (capabilities.has('guest') && !capabilities.has('contacts')) return;

            this.sidepopupNode.on('click', '.halo-link', function (e) {
                e.preventDefault();
                ext.point('io.ox/core/person:action').invoke('action', this, $(this).data(), e);
            });
            this.sidepopupNode.on('click', '.halo-resource-link', function (e) {
                e.preventDefault();
                ext.point('io.ox/core/resource:action').invoke('action', this, $(this).data(), e);
            });
        },

        keepOpen: function (e) {
            e.preventDefault();
            e.stopPropagation();
        },

        registerSubview: function (subview) {
            var subviews = this.model.get('subviews'),
                self = this;
            // prevent overwriting of existing subviews
            if (!subviews[subview.model.get('id')]) {
                subviews[subview.model.get('id')] = subview;

                // always draw at least one time (to keep the order )
                this.model.get('markedForRedraw')[subview.model.get('id')] = true;

                subview.collection.on('add reset remove', function (collection) {
                    if (!collection.subviewId) {
                        // sometimes the first parameter is a model and not a collection (add event)
                        collection = collection.collection;
                    }
                    self.model.get('markedForRedraw')[collection.subviewId] = true;
                    self.delayedRender();
                });

                subview.on('responsive-remove', function () {
                    var count = _(subviews).reduce(function (sum, view) { return sum + view.collection.length; }, 0),
                        cappedCount = Math.min(count, 99),
                        prevCount = parseInt(self.$el.find('.number').text(), 10);

                    // no change? nothing to do
                    if (cappedCount === prevCount) return;
                    // invoke render when count is set to 0 to clean up the view
                    if (count === 0) return self.render();

                    //#. %1$d number of notifications in notification area
                    //#, c-format
                    self.$el.attr('title', gt.format(gt.ngettext('%1$d notification.', '%1$d notifications.', count), count)).find('.number').text(cappedCount + (count > 100 ? '+' : ''));
                });

                subview.on('autoopen', _.bind(function () {
                    self.render();
                    self.dropdown.open();
                }, self));
                self.delayedRender();
            }
            return subview;
        },

        render: function () {
            var self = this,
                subviews = this.model.get('subviews'),
                count = _(subviews).reduce(function (sum, view) { return sum + view.collection.length; }, 0),
                cappedCount = Math.min(count, 99),
                markedForRedraw = this.model.get('markedForRedraw');

            //#. %1$d number of notifications in notification area
            //#, c-format
            this.$el.attr('title', gt.format(gt.ngettext('%1$d notification.', '%1$d notifications.', count), count)).find('.number').text(cappedCount + (count > 100 ? '+' : ''));
            this.model.set('markedForRedraw', {});

            self.listNode.find('.no-news-message,.notification-area-header,.desktop-notification-info').remove();
            _(markedForRedraw).each(function (value, id) {
                if (value) {
                    subviews[id].render(self.listNode);
                }
            });

            if (this.listNode.children('.notifications').length === 0) {
                this.listNode.prepend($('<h1 class="section-title no-news-message">').text(gt('No notifications')));
            } else {
                //draw headline
                this.listNode.prepend(
                    $('<div class=notification-area-header>').append(
                        $('<h1 class="notification-area-title">').text(gt('Notifications')),
                        $('<button type="button" class="btn btn-link clear-area-button fa fa-times">').attr('aria-label', gt('Close notification area'))
                            .on('click', _(self.dropdown.close).bind(self.dropdown)),
                        //#. Hides all current notifications (invitations, reminder etc.) for half an hour.
                        $('<button type="button" class="btn btn-link hide-area-button">').text(gt('Notify me again later')).on('click', _(self.hideAll).bind(self))
                    )
                );
            }
            // add show desktopNotifications info
            this.drawNotificationInfo();
            // only show when count is bigger than 0
            this.$el.toggle(count !== 0);
            return this;
        },

        drawNotificationInfo: function () {

            // only show if there was no decision yet
            if (desktopNotifications.getPermissionStatus() === 'default' && settings.get('showDesktopNotifications', true) !== false && !this.handledNotificationInfo) {
                var self = this,
                    textNode = $('<div>').text(gt('Would you like to enable desktop notifications?')),
                    laterButton = $('<button type="button" class="later-button btn btn-warning">').text(gt('Later')).on('click', function (e) {
                        e.stopPropagation();
                        cleanup();
                    }),
                    //#. declines the use of desktop notifications
                    disableButton = $('<button type="button" class="disable-button btn btn-danger">').text(gt('Never')).on('click', function (e) {
                        settings.set('showDesktopNotifications', false).save();
                        e.stopPropagation();
                        cleanup();
                    }),
                    //#. Opens popup to decide if desktop notifications should be shown
                    enableButton = $('<button type="button" class="enable-button btn btn-success">').text(gt('Decide now')).on('click', function (e) {
                        e.stopPropagation();
                        desktopNotifications.requestPermission(function (result) {
                            if (result === 'granted') {
                                settings.set('showDesktopNotifications', true).save();
                            } else if (result === 'denied') {
                                settings.set('showDesktopNotifications', false).save();
                            }
                        });
                        cleanup();
                    }),
                    cleanup = function () {
                        textNode.text(gt('You can manage desktop notifications at any time, by visiting your settings'))
                            .on('click', function () {
                                var options = { id: 'io.ox/core' };
                                ox.launch('io.ox/settings/main', options).done(function () {
                                    this.setSettingsPane(options);
                                });
                            });
                        containerNode.addClass('clickable');
                        laterButton.remove();
                        enableButton.remove();
                        disableButton.remove();
                        self.dropdown.$el.one('hidden.bs.dropdown', function () {
                            containerNode.remove();
                        });
                    },
                    containerNode = $('<div class="desktop-notification-info clearfix">').append(textNode, $('<div class="button-wrapper">').append(enableButton, disableButton, laterButton));

                this.listNode.prepend(containerNode);
            }
        },

        //opens a Sidepopup using the given renderer using the provided data
        //a renderer can be an object with a draw function or an object that contains a View constructor
        //data may be an object or a deferred object returning valid data (for example our api.get() functions)
        openSidepopup: function (cid, renderer, data, options) {
            var self = this,
                cont = function () {
                    // open dialog first to be visually responsive
                    require(['io.ox/core/tk/dialogs'], function (dialogs) {
                        self.sidepopupNode.attr('data-cid', cid).appendTo(_.device('smartphone') ? 'body' : '#io-ox-windowmanager-pane');
                        // open SidePopup without arrow
                        var popup = new dialogs.SidePopup({ arrow: false, side: 'left' })
                            .setTarget(self.sidepopupNode.empty())
                            .show({ target: self.sidepopupNode.empty() }, function (popup) {
                                var node = popup.closest('.io-ox-sidepopup');
                                if (!_.device('smartphone')) {
                                    node.css({
                                        right: '400px'
                                    });
                                }
                                node.addClass('io-ox-notifications-sidepopup first');
                                var cont = function (data) {
                                    // work with real model view or just draw method with baton
                                    if (renderer.View) {
                                        var view = new renderer.View({ data: data }, options);
                                        popup.idle().append(view.render().expand().$el.addClass('no-padding'));
                                    } else {
                                        popup.idle().append(renderer.draw({ data: data }, options).addClass('no-padding'));
                                    }
                                    return data;
                                };
                                // check if data is deferred
                                if (data.then) {
                                    // fetch proper item now
                                    popup.busy();
                                    data.then(cont);
                                } else {
                                    cont(data);
                                }
                            });
                        self.model.set('sidepopup', popup);
                        popup.on('close', $.proxy(self.onCloseSidepopup, self));
                    });
                };
            // if there is a sidepopup that is about to close we wait for this to avoid sideeffects
            if (self.model.get('sidepopup') && self.sidepopupIsClosing) {
                self.model.get('sidepopup').one('close', cont);
            } else {
                cont();
            }
        },

        onKeydown: function (e) {
            var items = [],
                closest = null;
            switch (e.which) {
                // left or up arrow
                case 37:
                case 38:
                    items = this.listNode.find('.item');
                    closest = $(e.target).closest('.item', this.listNode);
                    var prevIndex = items.length - 1;
                    if (closest.length) {
                        // add length once to avoid negative modulo operation, javascript has some issues with these
                        prevIndex = (_(items).indexOf(closest[0]) - 1 + items.length) % items.length;
                    }

                    items[prevIndex].focus();
                    break;
                // right or down arrow
                case 39:
                case 40:
                    items = this.listNode.find('.item');
                    closest = $(e.target).closest('.item', this.listNode);
                    var nextIndex = 0;
                    if (closest.length) {
                        nextIndex = (_(items).indexOf(closest[0]) + 1) % items.length;
                    }
                    items[nextIndex].focus();
                    break;
                // tab
                case 9:
                    // build a tabTrap so the menu behaves like a dropdown
                    items = a11y.getTabbable(this.listNode);
                    if (e.shiftKey && items[0] === e.target) {
                        e.preventDefault();
                        items[items.length - 1].focus();
                    }
                    if (!e.shiftKey && items.length && items[items.length - 1] === e.target) {
                        e.preventDefault();
                        items[0].focus();
                    }
                    break;
                // no default
            }
            items = null;
        },

        // focus on an element inside an item should highlight the item as if the mouse hovers over it
        focusHover: function (e) {
            this.listNode.find('.item').removeClass('has-focus');
            $(e.target).closest('.item', this.listNode).addClass('has-focus');
        },

        onCloseSidepopup: function () {
            this.sidepopupIsClosing = false;
            if (this.listNode.find('.item:visible')) {
                // focus first for now
                this.listNode.find('.item').first().focus();
            }

            var self = this,
                popup = this.model.get('sidepopup');
            if (popup) {
                popup.off('close');
                self.sidepopupNode.attr('data-cid', null).detach();
            }
            this.model.set('sidepopup', null);
        },

        hideAll: function () {
            _(this.model.get('subviews')).each(function (view) {
                view.hideAll(settings.get('notificationsHidingTimer', 1800000));
            });
        },

        closeSidepopup: function () {
            if (this.model.get('sidepopup')) {
                // popups close with a delay of 100ms, causes strange behavior if we open a new one during that time
                this.sidepopupIsClosing = true;
                this.model.get('sidepopup').close();
            }
        },

        //delay only affects requests, not the drawing of the badge
        attach: function (addLauncher, delay) {
            var self = this;

            this.drawNotificationInfo();

            // load and invoke plugins with delay
            setTimeout(function () {
                ox.manifests.loadPluginsFor('io.ox/core/notifications').done(function () {
                    ext.point('io.ox/core/notifications/register').invoke('register', self, self);
                });

                // don't overlap ads
                self.listNode.css({
                    top: self.listNode.css('top') + $('#io-ox-appcontrol')[0].offsetTop,
                    left: self.listNode.css('left') + window.outerWidth - $('#io-ox-appcontrol').outerWidth()
                });
            }, delay || 5000);

            this.render();

            return this.dropdown.render().$el;
        },

        yell: yell
    });

    var view = new NotificationsView({ model: new NotificationsModel() });

    return view;
});
