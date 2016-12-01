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
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define('io.ox/tasks/settings/pane', [
    'settings!io.ox/tasks',
    'io.ox/core/extensions',
    'gettext!io.ox/tasks',
    'io.ox/backbone/mini-views'
], function (settings, ext, gt, mini) {

    'use strict';

    var POINT = 'io.ox/tasks/settings/detail';

    settings.on('change', function () {
        settings.saveAndYell();
    });

    ext.point(POINT).extend({
        index: 100,
        id: 'taskssettings',
        draw: function () {

            var self = this,
                pane = $('<div class="io-ox-tasks-settings">'),
                holder = $('<div>').css('max-width', '800px');
            self.append(pane.append(holder));
            ext.point(POINT + '/pane').invoke('draw', holder);
        }

    });

    ext.point(POINT + '/pane').extend({
        index: 100,
        id: 'header',
        draw: function () {
            this.append(
                $('<h1>').text(gt.pgettext('app', 'Tasks'))
            );
        }
    });

    ext.point(POINT + '/pane').extend({
        index: 200,
        id: 'notifications',
        draw: function () {

            this.append(
                $('<fieldset>').append(
                    $('<legend>').addClass('sectiontitle').append(
                        $('<h2>').text(gt('Email notifications'))
                    ),
                    $('<div>').addClass('form-group expertmode').append(
                        $('<div>').addClass('checkbox').append(
                            $('<label>').addClass('control-label').text(gt('Receive notifications when a task in which you participate is created, modified or deleted')).prepend(
                                new mini.CheckboxView({ name: 'notifyNewModifiedDeleted', model: settings }).render().$el
                            )
                        )
                    ),
                    $('<div>').addClass('form-group expertmode').append(
                        $('<div>').addClass('checkbox').append(
                            $('<label>').addClass('control-label').text(gt('Receive notifications when a participant accepted or declined a task created by you')).prepend(
                                new mini.CheckboxView({ name: 'notifyAcceptedDeclinedAsCreator', model: settings }).render().$el
                            )
                        )
                    ),
                    $('<div>').addClass('form-group expertmode').append(
                        $('<div>').addClass('checkbox').append(
                            $('<label>').addClass('control-label').text(gt('Receive notifications when a participant accepted or declined a task in which you participate')).prepend(
                                new mini.CheckboxView({ name: 'notifyAcceptedDeclinedAsParticipant', model: settings }).render().$el
                            )
                        )
                    )
                )
            );
        }
    });

});
