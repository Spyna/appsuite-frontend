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
    'io.ox/core/notifications/badgeview',
    'io.ox/core/yell',
    'io.ox/core/desktopNotifications',
    'settings!io.ox/core',
    'gettext!io.ox/core'
], function (ext, badgeview, yell, desktopNotifications, settings, gt) {

    'use strict';

    var NotificationsModel = Backbone.Model.extend({
        defaults: {
            subviews: {},
            status: 'closed', //possible states 'closed', 'open', 'sidepopup'
            sidepopup: null,
            markedForRedraw: {}
        }
    });
    var NotificationsView = Backbone.View.extend({
        tagName: 'div',
        id: 'io-ox-notifications-display',
        events: {
            'click .clear-area-button': 'hide',
            'click .hide-area-button': 'hideAll',
            'keydown :tabbable': 'onKeydown',
            'focus :tabbable': 'focusHover'
        },
        initialize: function () {
            var self = this;
            self.bannerHeight = 0;
            self.handledNotificationInfo = false;
            this.badgeview = new badgeview.view({ model: new badgeview.model() });
            this.badgeview.$el.on('keydown', function (e) {
                // open space key and down arrow, just like a dropdown
                // if already open, focus first item
                if (e.which === 32 || e.which === 40) {
                    if (self.isOpen()) {
                        // try to focus first item
                        var firstItem = self.nodes.main.find(':tabbable').first();
                        if (firstItem.length > 0) firstItem.focus();
                    }
                    self.show();
                }
            });
            //close when clicked outside, since we don't have the overlay anymore
            //does not work with some dropdowns though (they prevent event bubbling), but the notification popup is in the background then
            $(document.body).on('click', function (e) {
                // don't check if notification area is closed
                if (self.getStatus() !== 'closed') {
                    var isInside = $(e.target)
                        .closest('#io-ox-notifications, #io-ox-notifications-sidepopup, #io-ox-notifications-icon, .io-ox-dialog-underlay, .io-ox-dialog-popup, .modal-footer, .custom-dropdown').length > 0;

                    if (!isInside) {
                        self.hide({ refocus: document.body === document.activeElement });
                    }
                }
            });
        },
        registerSubview: function (subview) {
            var subviews = this.model.get('subviews'),
                self = this;
            //prevent overwriting of existing subviews
            if (!subviews[subview.model.get('id')]) {
                subviews[subview.model.get('id')] = subview;

                //always draw at least one time (to keep the order )
                self.model.get('markedForRedraw')[subview.model.get('id')] = true;

                subview.collection.on('add reset remove', function (collection) {
                    if (!collection.subviewId) {
                        //sometimes the first parameter is a model and not a collection (add event)
                        collection = collection.collection;
                    }
                    self.model.get('markedForRedraw')[collection.subviewId] = true;
                    self.delayedUpdate();
                });

                subview.on('autoopen', _.bind(self.show, self));
                subview.on('responsive-remove', _.bind(function () {
                    if (self.$el.children('.notifications').length === 0) {
                        self.render();
                    }
                }, self));

                this.badgeview.registerView(subview);
            }
            return subview;
        },
        render: function () {
            var self = this,
                subviews = this.model.get('subviews'),
                markedForRedraw = this.model.get('markedForRedraw');

            this.model.set('markedForRedraw', {});

            self.$el.find('.no-news-message,.notification-area-header,.desktop-notification-info').remove();
            _(markedForRedraw).each(function (value, id) {
                if (value) {
                    subviews[id].render(self.$el);
                }
            });

            if (self.$el.children('.notifications').length === 0) {
                self.$el.prepend($('<h1 class="section-title no-news-message">').text(gt('No notifications')));
            } else {
                //draw headline
                self.$el.prepend(
                    $('<div class=notification-area-header>').append(
                        $('<h1 class="notification-area-title">').text(gt('Notifications')),
                        $('<button type="button" class="btn btn-link clear-area-button fa fa-times">').attr('aria-label', gt('Close notification area')),
                        $('<button type="button" class="btn btn-link hide-area-button">').text(gt('Notify me again later'))
                    )
                );
            }
            // add show desktopNotifications info
            self.drawNotificationInfo();

            return self;
        },
        drawNotificationInfo: function () {

            // only show if there was no decision yet
            if (desktopNotifications.getPermissionStatus() === 'default' && settings.get('showDesktopNotifications', true) !== false && !this.handledNotificationInfo) {
                var self = this,
                    textNode = $('<div>').text(gt('Would you like to enable desktop notifications?')),
                    laterButton = $('<button class="later-button btn btn-warning">').text(gt('Later')).on('click', function (e) {
                        e.stopPropagation();
                        cleanup();
                    }),
                    //#. declines the use of desktop notifications
                    disableButton = $('<button class="disable-button btn btn-danger">').text(gt('Never')).on('click', function (e) {
                        settings.set('showDesktopNotifications', false).save();
                        e.stopPropagation();
                        cleanup();
                    }),
                    //#. Opens popup to decide if desktop notifications should be shown
                    enableButton = $('<button class="enable-button btn btn-success">').text(gt('Decide now')).on('click', function (e) {
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
                        self.hideNotificationInfo = true;
                    },
                    containerNode = $('<div class="desktop-notification-info clearfix">').append(textNode, $('<div class="button-wrapper">').append(enableButton, disableButton, laterButton));

                if (self.hideNotificationInfo) {
                    cleanup();
                }

                this.$el.prepend(containerNode);
            }
        },

        //opens a Sidepopup using the given renderer using the provided data
        //a renderer can be an object with a draw function or an object that contains a View constructor
        //data may be an object or a deferred object returning valid data (for example our api.get() functions)
        openSidepopup: function (cid, renderer, data) {
            var self = this,
                cont = function () {
                    // open dialog first to be visually responsive
                    require(['io.ox/core/tk/dialogs'], function (dialogs) {
                        self.nodes.sidepopup.attr('data-cid', cid).appendTo('#io-ox-windowmanager-pane');
                        // open SidePopup without arrow
                        var popup = new dialogs.SidePopup({ arrow: false, side: 'left' })
                            .setTarget(self.nodes.sidepopup.empty())
                            .show({ target: self.nodes.sidepopup.empty() }, function (popup) {
                                var node = popup.closest('.io-ox-sidepopup');
                                if (!_.device('smartphone')) {
                                    node.css({
                                        right: '400px'
                                    });
                                }
                                node.addClass('io-ox-notifications-sidepopup first');
                                var cont = function (data) {
                                    //work with real model view or just draw method with baton
                                    if (renderer.View) {
                                        var view = new renderer.View({ data: data });
                                        popup.idle().append(view.render().expand().$el.addClass('no-padding'));
                                    } else {
                                        popup.idle().append(renderer.draw({ data: data }).addClass('no-padding'));
                                    }

                                    if (_.device('smartphone')) {
                                        self.nodes.main.removeClass('active');
                                    }
                                    return data;
                                };
                                //check if data is deferred
                                if (data.then) {
                                    // fetch proper item now
                                    popup.busy();
                                    data.then(cont);
                                } else {
                                    cont(data);
                                }
                            });
                        self.model.set('status', 'sidepopup');
                        self.model.set('sidepopup', popup);
                        popup.on('close', $.proxy(self.onCloseSidepopup, self));
                    });
                };
            //if there is a sidepopup that is about to close we wait for this to avoid sideeffects
            if (self.model.get('sidepopup') && self.sidepopupIsClosing) {
                self.model.get('sidepopup').one('close', cont);
            } else {
                cont();
            }
        },

        onKeydown: function (e) {
            var items = [];
            switch (e.which) {
                // left or up arrow
                case 37:
                case 38:
                    items = this.nodes.main.find(':tabbable');
                    // add length once to avoid negative modulo operation, javascript has some issues with these
                    var prevIndex = (_(items).indexOf(e.target) - 1 + items.length) % items.length;
                    items[prevIndex].focus();
                    break;
                // right or down arrow
                case 39:
                case 40:items = this.nodes.main.find(':tabbable');
                    var nextIndex = (_(items).indexOf(e.target) + 1) % items.length;
                    items[nextIndex].focus();
                    break;
                // tab
                case 9:
                    // build a tabTrap so the menu behaves like a dropdown
                    items = this.nodes.main.find(':tabbable');
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
            this.nodes.main.find('.item').removeClass('has-focus');
            $(e.target).closest('.item', this.nodes.main).addClass('has-focus');
        },

        onCloseSidepopup: function () {
            this.sidepopupIsClosing = false;
            // if the notification area is closed already we don't set the status back to open etc
            if (this.model.get('status') !== 'closed') {
                this.model.set('status', 'open');
                if (_.device('smartphone')) {
                    this.nodes.main.addClass('active');
                }
                //focus first for now
                this.nodes.main.find('.item').first().focus();
            }

            var self = this,
                popup = this.model.get('sidepopup');
            if (popup) {
                popup.off('close');
                self.nodes.sidepopup.attr('data-cid', null).detach();
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
                //popups close with a delay of 100ms, causes strange behavior if we open a new one during that time
                this.sidepopupIsClosing = true;
                this.model.get('sidepopup').close();
            }
        },

        getSidepopup: function () {
            return this.model.get('sidepopup');
        },

        getStatus: function () {
            return this.model.get('status');
        },

        isOpen: function () {
            return this.model.get('status') !== 'closed';
        },

        toggle: function () {
            if (this.isOpen()) this.hide(); else this.show();
        },

        show: function () {
            // if it's open already we're done
            if (this.isOpen()) return;

            // adjust top if there is a banner
            if (!this.bannerHeight) {
                var bannerHeight = $('#io-ox-banner:visible').css('height'),
                    nodeHeight = parseInt(this.nodes.main.css('top').replace('px', ''), 10);

                if (bannerHeight !== undefined) {
                    bannerHeight = parseInt(bannerHeight.replace('px', ''), 10);
                    this.bannerHeight = bannerHeight;

                    var newHeight = nodeHeight + bannerHeight;
                    this.nodes.main.css('top', newHeight + 'px');
                }
            }

            if (_.device('smartphone')) {
                $('[data-app-name="io.ox/portal"]:visible').addClass('notifications-open');
            }

            this.nodes.main.addClass('active');
            this.badgeview.onToggle(true);

            $(document).on('keydown.notification', $.proxy(function (e) {
                // if esc is pressed inside a dropdown menu we close the dropdown menu not the notificion are. Same goes for the sidepopup
                if (e.which === 27 && !(this.model.get('sidepopup')) && !$(e.target).closest('.dropdown-menu', this.nodes.main).length) {
                    this.hide();
                }
            }, this));

            // try to focus first item; focus badge otherwise
            var firstItem = this.nodes.main.find(':tabbable').first();
            if (firstItem.length > 0) firstItem.focus(); else this.badgeview.$el.focus();

            this.model.set('status', 'open');
            this.trigger('show');
        },

        hide: function (opt) {
            opt = _.extend({ refocus: true }, opt || {});
            $(document).off('keydown.notification');
            var badgeview = this.badgeview;
            // if it's closed already we're done
            if (!this.isOpen()) return;

            badgeview.setNotifier(false);

            this.closeSidepopup();
            this.nodes.main.removeClass('active');
            badgeview.onToggle(false);

            if (_.device('smartphone')) {
                $('[data-app-name="io.ox/portal"]').removeClass('notifications-open');
            }
            // disable refocus f.e. when triggerd by click on searchbox
            if (opt.refocus) badgeview.$el.focus();

            if (this.hideNotificationInfo) {
                this.$el.find('.desktop-notification-info').remove();
                this.hideNotificationInfo = false;
                this.handledNotificationInfo = true;
            }
            this.model.set('status', 'closed');
            this.trigger('hide');
        },

        nodes: {
            main: $('<div>').attr({
                tabindex: -1,
                id: 'io-ox-notifications'
            }),
            sidepopup: $('<div>').attr({
                id: 'io-ox-notifications-sidepopup'
            })
        },

        //delay only affects requests, not the drawing of the badge
        attach: function (addLauncher, delay) {

            //view
            var self = this,
                badgeview = this.badgeview;

            $('#io-ox-core').prepend(
                self.nodes.main.append(this.el)
            );

            //close if count set to 0
            badgeview.on('auto-close', function () {
                //if there is an open popup, wait till this is closed
                if (self.getStatus() === 'sidepopup') {
                    self.model.get('sidepopup').one('close', _.bind(self.hide, self));
                } else {
                    self.hide();
                }
            });

            //add initial no notifications message
            self.$el.prepend($('<h1 class="section-title no-news-message">').text(gt('No notifications')));
            self.drawNotificationInfo();

            // load and invoke plugins with delay
            setTimeout(function () {
                ox.manifests.loadPluginsFor('io.ox/core/notifications').done(function () {
                    ext.point('io.ox/core/notifications/register').invoke('register', self, self);
                });
            }, delay || 5000);

            return addLauncher(
                'right',
                badgeview.render().$el,
                $.proxy(this.toggle, this)
            ).attr('id', 'io-ox-notifications-icon');
        },
        delayedUpdate: function () {
            //delays updating by 100ms (prevents updating the view multiple times in a row)
            var self = this;
            if (!this.updateTimer) {
                this.updateTimer = setTimeout(function () {
                    self.update();
                    self.updateTimer = undefined;
                }, 100);
            }
        },
        updateNotification: function () {
            this.badgeview.setNotifier(true);
            this.delayedUpdate();
        },
        update: function () {

            this.render();
        },

        yell: yell
    });

    var view = new NotificationsView({ model: new NotificationsModel() });

    // auto-close if other apps are started or app is changed see bug #32768
    // users might open mails from notification area, open a contact halo, clicking edit
    ox.on('app:start app:resume', function () {
        if (view.badgeview) {
            //don't trigger to early
            view.hide();
        }
    });

    return view;
});
