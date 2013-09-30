/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2011
 * Mail: info@open-xchange.com
 *
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define('io.ox/mail/autoforward/settings/register',
        ['io.ox/core/extensions', 'io.ox/core/notifications',
         'io.ox/core/api/user', 'gettext!io.ox/mail'], function (ext, notifications, userAPI, gt) {

    'use strict';

    var filterModel;

    ext.point('io.ox/settings/pane').extend({
        id: 'io.ox/autoforward',
        title: gt('Auto Forward'),
        ref: 'io.ox/autoforward',
        loadSettingPane: false,
        index: 425,
        lazySaveSettings: true
    });

    ext.point('io.ox/autoforward/settings/detail').extend({
        index: 100,
        draw: function () {
            var $node = this,
                $container = $('<div>');

            $node.append($container);

            require(['io.ox/mail/autoforward/settings/filter'], function (filters) {

                userAPI.get().done(function (user) {
                    var multiValues = {};
                    filters.editAutoForward($container, multiValues, user.email1).done(function (filter) {
                        filterModel = filter;
                    }).fail(function (error) {
                        var msg;
                        if (error.code === 'MAIL_FILTER-0015') {
                            msg = gt('Unable to load mail filter settings.');
                        }
                        $container.append(
                            $.fail(msg || gt("Couldn't load your auto forward."), function () {
                                filters.editAutoForward($node).done(function () {
                                    $container.find('[data-action="discard"]').hide();
                                });
                            })
                        );
                    });
                });
            });
        },

        save: function () {
            filterModel.save();
        }
    });
});
