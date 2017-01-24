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
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */

define('io.ox/core/notifications/badgeview', [
    'gettext!io.ox/core',
    'io.ox/core/yell'
], function (gt, yell) {

    'use strict';

    var BadgeModel = Backbone.Model.extend({
        defaults: {
            count: 0, //overall count, should be used as read only, add notificationViews to update
            registeredViews: {} //stores the notificationViews that should be included in the calculation of the count
        }
    });

    var BadgeView = Backbone.View.extend({
        tagName: 'a',
        className: 'notifications-icon',
        initialize: function () {
            this.model.set('a11y', '');
            this.model.on('change:count', _.bind(this.onChangeCount, this));
            this.nodes = {};
        },
        onChangeCount: function () {
            if (!this.nodes.badge) {
                return;
            }
            var count = this.model.get('count'),
                //#. %1$d number of notifications in notification area
                //#, c-format
                a11y = gt.format(gt.ngettext('%1$d notification.', '%1$d notifications.', count), count);
            if (count === 0) {
                this.$el.addClass('no-notifications');
            } else {
                this.$el.removeClass('no-notifications');
            }
            //don't create a loop here
            this.model.set('a11y', a11y, { silent: true });
            this.nodes.badge.toggleClass('empty', count === 0);
            this.nodes.icon.attr('title', a11y);
            this.$el.attr('aria-label', a11y);
            this.nodes.number.text(_.noI18n(count >= 100 ? '99+' : count));
            // don't alert if there is no notification or the number did not change
            if (count !== 0 && this.model.previous('count') !== count) {
                yell('screenreader', a11y);
            }
        },
        onToggle: function (open) {
            this.$el.attr({
                'aria-expanded': !!open,
            });
        },
        render: function () {

            this.$el.attr({
                href: '#',
                role: 'button',
                'aria-expanded': false,
                'aria-controls': 'io-ox-notifications-display'
            })
            .append(
                this.nodes.icon = $('<i class="fa fa-bell launcher-icon" aria-hidden="true">'),
                this.nodes.badge = $('<span class="badge" aria-hidden="true">').append(
                    this.nodes.number = $('<span class="number">')
                )
            );

            this.onChangeCount();
            return this;
        },
        setNotifier: function (b) {
            if (this.nodes.badge) {
                this.nodes.badge.toggleClass('active', !!b);
            }
        },
        registerView: function (view) {
            var views = this.model.get('registeredViews'),
                self = this;
            //prevent overwriting of existing views
            if (!views[view.model.get('id')]) {
                views[view.model.get('id')] = view;
                view.collection.on('add reset remove', _.bind(self.delayedUpdate, self));
                view.on('responsive-remove', _.bind(self.delayedUpdate, self));
            }
            return view;
        },
        delayedUpdate: function () {
            //delays updating by 100ms (prevents updating the badge multiple times in a row)
            var self = this;
            if (!this.updateTimer) {
                this.updateTimer = setTimeout(function () {
                    self.updateCount();
                    self.updateTimer = undefined;
                }, 100);
            }
        },
        updateCount: function () {
            var newCount = 0,
                oldCount = this.model.get('count');

            _(this.model.get('registeredViews')).each(function (view) {
                newCount = newCount + view.collection.size();
            });
            if (oldCount !== newCount) {
                this.model.set('count', newCount);
                //autoclose if count is set to 0, notificationsview handles this
                if (newCount === 0) {
                    this.trigger('auto-close');
                }
            }
        }
    });

    return {
        model: BadgeModel,
        view: BadgeView
    };
});
