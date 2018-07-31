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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define('io.ox/calendar/detail/main', [
    'io.ox/calendar/api',
    'io.ox/calendar/util',
    'io.ox/core/extensions',
    'io.ox/calendar/view-detail',
    'gettext!io.ox/calendar',
    'io.ox/core/notifications'
], function (api, util, ext, detailView, gt, notifications) {

    'use strict';

    var NAME = 'io.ox/calendar/detail';

    ox.ui.App.mediator(NAME, {
        'show-appointment': function (app) {
            app.showAppointment = function (appointment) {

                api.get(appointment).then(
                    function success(model) {
                        app.setTitle(model.get('summary'));
                        app.getWindowNode().addClass('detail-view-app').append($('<div class="f6-target detail-view-container" tabindex="0" role="complementary">').attr({
                            'aria-label': gt('Appointment Details')
                        }).append(detailView.draw(new ext.Baton({ model: model }))));

                        api.once('delete:' + util.cid(model.attributes), function () {
                            app.quit();
                        });
                    },
                    function fail() {
                        notifications.yell('error', gt('An error occurred. Please try again.'));
                    }
                );
            };
        },

        'metrics': function (app) {
            require(['io.ox/metrics/main'], function (metrics) {
                if (!metrics.isEnabled()) return;
                var body = app.getWindow().nodes.body;
                // toolbar actions
                body.on('mousedown', '.io-ox-action-link:not(.dropdown, [data-toggle="dropdown"])', function (e) {
                    metrics.trackEvent({
                        app: 'calendar',
                        target: 'detail/toolbar',
                        type: 'click',
                        action: $(e.currentTarget).attr('data-action')
                    });
                });
                // toolbar options dropdown
                body.on('mousedown', '.io-ox-inline-links .dropdown a:not([data-toggle])', function (e) {
                    var action = $(e.target).closest('.dropdown').find('> a');
                    metrics.trackEvent({
                        app: 'calendar',
                        target: 'detail/toolbar',
                        type: 'click',
                        action: action.attr('data-action'),
                        detail: $(e.target).val()
                    });
                });

            });
        }
    });

    // multi instance pattern
    function createInstance() {
        // application object
        var app = ox.ui.createApp({
            closable: true,
            name: NAME,
            title: '',
            floating: !_.device('smartphone')
        });

        // launcher
        return app.setLauncher(function (options) {
            var win = ox.ui.createWindow({
                chromeless: true,
                name: NAME,
                toolbar: false,
                closable: true,
                floating: !_.device('smartphone')
            });
            app.setWindow(win);
            app.mediate();
            win.show();

            var cid = options.cid, obj;
            if (cid !== undefined) {
                // called from calendar app
                obj = util.cid(cid);
                app.setState({ folder: obj.folder, id: obj.id, recurrenceId: obj.recurrenceId || null });
                app.showAppointment(obj);
                return;
            }

            // deep-link
            if (options.folder && options.id) app.setState({ folder: options.folder, id: options.id });

            obj = app.getState();

            if (obj.folder && obj.id) app.showAppointment(obj);
        });
    }

    return {
        getApp: createInstance
    };
});
