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
 * @author Richard Petersen <richard.petersen@open-xchange.com>
 */

define('io.ox/chronos/settings/timezones/pane', [
    'io.ox/backbone/views/extensible',
    'settings!io.ox/chronos',
    'gettext!io.ox/calendar',
    'io.ox/core/extensions',
    'io.ox/chronos/settings/timezones/favorite-view',
    'less!io.ox/chronos/settings/timezones/style.less'
], function (ExtensibleView, settings, gt, ext, FavoriteView) {

    'use strict';

    ext.point('io.ox/settings/pane/main/io.ox/chronos').extend({
        id: 'io.ox/timezones',
        title: gt('Favorite timezones'),
        ref: 'io.ox/chronos/timezones',
        loadSettingPane: false,
        index: 100
    });

    ext.point('io.ox/chronos/timezones/settings/detail').extend({
        index: 100,
        id: 'view',
        draw: function () {
            this.append(
                new ExtensibleView({ point: 'io.ox/chronos/timezones/settings/detail/view', model: settings })
                .render().$el
            );
        }
    });

    ext.point('io.ox/chronos/timezones/settings/detail/view').extend(
        {
            id: 'header',
            index: 100,
            render: function () {
                this.$el.addClass('io-ox-chronos-settings').append(
                    $('<h1>').text(gt.pgettext('app', 'Favorite timezones'))
                );
            }
        },
        {
            id: 'favorite-timezone',
            index: 200,
            render: function () {
                this.$el.append(
                    new FavoriteView({ model: settings }).render().$el
                );
            }
        }
    );
});
