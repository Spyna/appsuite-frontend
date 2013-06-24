/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2013 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/tasks/print',
    ['io.ox/core/print',
     'io.ox/calendar/print',
     'io.ox/tasks/api',
     'io.ox/tasks/util',
     'io.ox/calendar/util',
     'io.ox/core/date',
     'gettext!io.ox/tasks'], function (print, calendarPrint, api, util, calendarUtil, date, gt) {

    'use strict';

    function getDate(data, prop) {
        var t = data[prop];
        return _.isNumber(t) ? new date.Local(date.Local.utc(t)).format(date.DATETIME) : '';
    }

    var states = { 1: gt('Not started'), 2: gt('In progress'), 3: gt('Done'), 4: gt('Waiting'), 5: gt('Deferred') },
        priorities = { 1: gt('Low'), 2: gt('Medium'), 3: gt('High')};

    function getState(data) {
        if (data.status === 2) {
            return '<b>' + states[data.status] + '</b>, ' + gt('Progress') + ': ' + (data.percent_completed || 0) + '%';
        } else {
            return '<b>' + states[data.status] + '</b>';
        }
    }
    
    function getPriority(data) {
        if (data.priority) {
            return priorities[data.priority];
        } else {//use medium priority as default
            return priorities[1];
        }
    }

    function process(data) {
        return calendarPrint.load(data).pipe(function (unified) {
            return _.extend(unified, {
                original: data,
                subject: data.title,
                start: getDate(data, 'start_date'),
                due: getDate(data, 'end_date'),
                recurrence: calendarUtil.getRecurrenceString(data),
                state: getState(data),
                content: $.trim(data.note),
                target_duration: data.target_duration,
                actual_duration: data.actual_duration,
                target_costs: data.target_costs,
                actual_costs: data.actual_costs,
                priority: getPriority(data),
                currency: data.currency,
                trip_meter: data.trip_meter,
                billing_information: data.billing_information,
                companies: data.companies,
                date_completed: getDate(data, 'date_completed'),
                alarm: getDate(data, 'alarm')
            });
        });
    }

    return {

        open: function (selection, win) {

            print.smart({

                get: function (obj) {
                    return api.get(obj);
                },

                i18n: {
                    due: gt('Due'),
                    start: gt('Start'),
                    accepted: gt('Accepted'),
                    declined: gt('Declined'),
                    tentative: gt('Tentatively accepted'),
                    unconfirmed: gt('Unconfirmed'),
                    target_duration: gt('Estimated duration in minutes'),
                    actual_duration: gt('Actual duration in minutes'),
                    target_costs: gt('Estimated costs'),
                    actual_costs: gt('Actual costs'),
                    trip_meter: gt('Distance'),
                    billing_information: gt('Billing information'),
                    companies: gt('Companies'),
                    date_completed: gt('Date completed'),
                    alarm: gt('Remind date'),
                    priority: gt('Priority'),
                    recurrence: gt('This task recurs')
                },

                process: process,
                selection: selection,
                selector: '.task',
                window: win
            });
        }
    };
});
