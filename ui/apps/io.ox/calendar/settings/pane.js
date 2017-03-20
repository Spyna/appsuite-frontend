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

define('io.ox/calendar/settings/pane', [
    'io.ox/core/extensions',
    'gettext!io.ox/calendar',
    'io.ox/backbone/mini-views',
    'settings!io.ox/calendar',
    'io.ox/core/notifications'
], function (ext, gt, mini, settings, notifications) {

    'use strict';

    var POINT = 'io.ox/calendar/settings/detail',

        optionsInterval = function () {
            return _.map([5, 10, 15, 20, 30, 60], function (i) {
                i = String(i);
                return { label: gt.noI18n(i), value: i };
            });
        },

        optionsTime = function () {
            var array = [],
                m = moment().startOf('day');
            for (var i = 0; i < 24; i++) {
                array.push({
                    label: m.format('LT'),
                    value: String(i)
                });
                m.add(1, 'hour');
            }
            return array;
        },

        optionsReminder =  function () {
            var minInt = [15, 30, 45, 60, 120, 240, 360, 480, 720, 1440, 2880, 4320, 5760, 7200, 8640, 10080, 20160, 30240, 40320],
                list = [
                    { label: gt('No reminder'), value: '-1' },
                    { label: gt.format(gt.ngettext('%d minute', '%d minutes', 0), 0), value: '0' }
                ];
            _(minInt).each(function (m) {
                var dur = moment.duration(m, 'minutes');
                list.push({
                    label: dur.humanize(),
                    value: String(dur.asMinutes())
                });
            });
            return list;
        },
        reloadMe = [];

    ext.point(POINT).extend({
        index: 100,
        id: 'calendarsettings',
        draw: function () {
            var self = this,
                pane = $('<div class="io-ox-calendar-settings">');
            self.append($('<div>').addClass('section').append(pane));
            ext.point(POINT + '/pane').invoke('draw', pane);
        }
    });

    ext.point(POINT + '/pane').extend({
        index: 100,
        id: 'header',
        draw: function () {
            this.append(
                $('<h1>').text(gt.pgettext('app', 'Calendar'))
            );
        }
    });

    settings.on('change', function (setting) {
        var showNotice = _(reloadMe).some(function (attr) {
            return attr === setting;
        });
        settings.saveAndYell(undefined, showNotice ? { force: true } : {}).then(
            function success() {

                if (showNotice) {
                    notifications.yell(
                        'success',
                        gt('The setting has been saved and will become active when you enter the application the next time.')
                    );
                }
            }
        );
    });

    ext.point(POINT + '/pane').extend({
        index: 200,
        id: 'common',
        draw: function () {
            this.append(
                $('<fieldset>').append(
                    $('<div>').addClass('form-group').append(
                        $('<div>').addClass('row').append(
                            $('<label>').attr('for', 'interval').addClass('control-label col-sm-4').text(gt('Time scale in minutes')),
                            $('<div>').addClass('col-sm-4').append(
                                new mini.SelectView({ list: optionsInterval(), name: 'interval', model: settings, id: 'interval', className: 'form-control' }).render().$el
                            )
                        )
                    ),
                    $('<div>').addClass('form-group').append(
                        $('<div>').addClass('row').append(
                            $('<label>').attr('for', 'startTime').addClass('control-label col-sm-4').text(gt('Start of working time')),
                            $('<div>').addClass('col-sm-4').append(
                                new mini.SelectView({ list: optionsTime(), name: 'startTime', model: settings, id: 'startTime', className: 'form-control' }).render().$el
                            )
                        )
                    ),
                    $('<div>').addClass('form-group').append(
                        $('<div>').addClass('row').append(
                            $('<label>').attr('for', 'endTime').addClass('control-label col-sm-4').text(gt('End of working time')),
                            $('<div>').addClass('col-sm-4').append(
                                new mini.SelectView({ list: optionsTime(), name: 'endTime', model: settings, id: 'endTime', className: 'form-control' }).render().$el
                            )
                        )
                    ),
                    $('<div>').addClass('form-group expertmode').append(
                        $('<div>').addClass('checkbox').append(
                            $('<label>').addClass('control-label').text(gt('Show declined appointments')).prepend(
                                new mini.CheckboxView({ name: 'showDeclinedAppointments', model: settings }).render().$el
                            )
                        )
                    )
                )
            );
        }
    });

    ext.point(POINT + '/pane').extend({
        index: 300,
        id: 'appointment',
        draw: function () {
            this.append(
                $('<fieldset>').append(
                    $('<legend>').addClass('sectiontitle expertmode').append(
                        $('<h2>').text(gt('New appointment'))
                    ),
                    $('<div>').addClass('form-group expertmode').append(
                        $('<div>').addClass('row').append(
                            $('<label>').attr('for', 'defaultReminder').addClass('control-label col-sm-4').text(gt('Default reminder')),
                            $('<div>').addClass('col-sm-4').append(
                                new mini.SelectView({ list: optionsReminder(), name: 'defaultReminder', model: settings, id: 'defaultReminder', className: 'form-control' }).render().$el
                            )
                        )
                    ),
                    $('<div>').addClass('form-group expertmode').append(
                        $('<div>').addClass('checkbox').append(
                            $('<label>').addClass('control-label').text(gt('Mark all day appointments as free')).prepend(
                                new mini.CheckboxView({ name: 'markFulltimeAppointmentsAsFree', model: settings }).render().$el
                            )
                        )
                    )
                )
            );
        }
    });

    ext.point(POINT + '/pane').extend({
        index: 400,
        id: 'notifications',
        draw: function () {
            this.append(
                $('<fieldset>').append(
                    $('<legend>').addClass('sectiontitle expertmode').append(
                        $('<h2>').text(gt('Email notifications'))
                    ),
                    $('<div>').addClass('form-group expertmode').append(
                        $('<div>').addClass('checkbox').append(
                            $('<label>').addClass('control-label').text(gt('Receive notification for appointment changes')).prepend(
                                new mini.CheckboxView({ name: 'notifyNewModifiedDeleted', model: settings }).render().$el
                            )
                        ),
                        $('<div>').addClass('checkbox').append(
                            $('<label>').addClass('control-label').text(gt('Receive notification as appointment creator when participants accept or decline')).prepend(
                                new mini.CheckboxView({ name: 'notifyAcceptedDeclinedAsCreator', model: settings }).render().$el
                            )
                        ),
                        $('<div>').addClass('checkbox').append(
                            $('<label>').addClass('control-label').text(gt('Receive notification as appointment participant when other participants accept or decline')).prepend(
                                new mini.CheckboxView({ name: 'notifyAcceptedDeclinedAsParticipant', model: settings }).render().$el
                            )
                        ),
                        $('<div>').addClass('checkbox').append(
                            $('<label>').addClass('control-label').text(gt('Automatically delete the invitation email after the appointment has been accepted or declined')).prepend(
                                new mini.CheckboxView({ name: 'deleteInvitationMailAfterAction', model: settings }).render().$el
                            )
                        )
                    )
                )
            );
        }
    });

    ext.point(POINT + '/pane').extend({
        index: 500,
        id: 'workweek',
        draw: (function () {
            var m = moment(),
                days = _(new Array(7)).map(function (num, index) {
                    var weekday = m.weekday(index);
                    return {
                        value: weekday.day(),
                        label: weekday.format('dddd'),
                    };
                }),
                counts = _(new Array(7)).map(function (num, index) {
                    return {
                        value: index + 1,
                        label: index + 1,
                    };
                }),
                NumberSelectView = mini.SelectView.extend({
                    onChange: function () {
                        this.model.set(this.name, parseInt(this.$el.val(), 10) || 0);
                    }
                });
            return function () {
                this.append(
                    $('<fieldset>').append(
                        $('<legend>').addClass('sectiontitle expertmode').append(
                            $('<h2>').text(gt('Calendar workweek view'))
                        ),
                        $('<div>').addClass('form-group expertmode').append(
                            $('<div>').addClass('row').append(
                                $('<label>').attr('for', 'num-days-workweek').addClass('control-label col-sm-4').text(gt('Number of days in work week')),
                                $('<div>').addClass('col-sm-4').append(
                                    new NumberSelectView({ list: counts, name: 'numDaysWorkweek', model: settings, id: 'num-days-workweek', className: 'form-control' }).render().$el
                                )
                            )
                        ),
                        $('<div>').addClass('form-group expertmode').append(
                            $('<div>').addClass('row').append(
                                $('<label>').attr('for', 'workweek-start').addClass('control-label col-sm-4').text(gt('Work week starts on')),
                                $('<div>').addClass('col-sm-4').append(
                                    new NumberSelectView({ list: days, name: 'workweekStart', model: settings, id: 'workweek-start', className: 'form-control' }).render().$el
                                )
                            )
                        )
                    )
                );
            };
        }())
    });

});
