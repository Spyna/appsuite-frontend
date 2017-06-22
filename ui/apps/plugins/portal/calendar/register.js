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
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 * @author Tobias Prinz <tobias.prinz@open-xchange.com>
 */

define('plugins/portal/calendar/register', [
    'io.ox/core/extensions',
    'io.ox/calendar/api',
    'io.ox/calendar/util',
    'gettext!plugins/portal',
    'settings!io.ox/calendar'
], function (ext, api, util, gt, settings) {

    'use strict';

    ext.point('io.ox/portal/widget/calendar').extend({

        title: gt('Appointments'),

        initialize: function (baton) {
            api.on('update create delete', function () {
                //refresh portal
                require(['io.ox/portal/main'], function (portal) {
                    var portalApp = portal.getApp(),
                        portalModel = portalApp.getWidgetCollection()._byId[baton.model.id];
                    if (portalModel) {
                        portalApp.refreshWidget(portalModel, 0);
                    }
                });

            });
        },

        load: function (baton) {
            return api.getAll().then(function (ids) {
                var numOfItems = _.device('smartphone') ? 5 : 10;
                return api.getList(ids.slice(0, numOfItems)).done(function (data) {
                    baton.data = data;
                });
            });
        },

        summary: function (baton) {
            if (this.find('.summary').length) return;

            this.addClass('with-summary show-summary');

            var sum = $('<div>').addClass('summary');

            if (baton.data.length === 0) {
                sum.text(gt('You don\'t have any appointments in the near future.'));
            } else {
                var obj = _(baton.data).first();

                sum.append(
                    $('<span class="normal accent">').text(util.getSmartDate(obj, true)), $.txt('\u00A0'),
                    $('<span class="bold">').text(obj.title || ''), $.txt('\u00A0'),
                    $('<span class="gray">').text(obj.location || '')
                );

                this.on('tap', 'h2', function (e) {
                    $(e.delegateTarget).toggleClass('show-summary');
                });
            }

            this.append(sum);
        },

        preview: function (baton) {
            var appointments = baton.data,
                $content = $('<ul class="content list-unstyled">');

            if (appointments.length === 0) {
                $content.append(
                    $('<li class="line">')
                    .text(gt('You don\'t have any appointments in the near future.'))
                );
            } else {
                _(appointments).each(function (nextApp) {
                    var declined = util.getConfirmationStatus(nextApp) === 2;
                    if (settings.get('showDeclinedAppointments', false) || !declined) {
                        var timespan = util.getSmartDate(nextApp, true);

                        $content.append(
                            $('<li class="item" tabindex="0">')
                            .css('text-decoration', declined ? 'line-through' : 'none')
                            .data('item', nextApp)
                            .append(
                                $('<span class="normal accent">').text(timespan), $.txt('\u00A0'),
                                $('<span class="bold">').text(nextApp.title || ''), $.txt('\u00A0'),
                                $('<span class="gray">').text(nextApp.location || '')
                            )
                        );
                    }
                });
            }

            this.append($content);
        },

        draw: function (baton) {
            var popup = this.busy();
            require(['io.ox/calendar/view-detail'], function (view) {
                var obj = api.reduce(baton.item);
                api.get(obj).done(function (data) {
                    popup.idle().append(view.draw(data, { deeplink: true }));
                });
            });
        },

        post: function (ext) {
            var self = this;
            api.on('refresh.all', function () {
                ext.load().done(_.bind(ext.draw, self));
            });
        }
    });

    ext.point('io.ox/portal/widget/calendar/settings').extend({
        title: gt('Appointments'),
        type: 'calendar',
        editable: false,
        unique: true
    });

});
