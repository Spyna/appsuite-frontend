/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2017 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Richard Petersen <richard.petersen@open-xchange.com>
 */

define('io.ox/calendar/month/print', [
    'io.ox/calendar/chronos-api',
    'io.ox/calendar/chronos-util',
    'io.ox/calendar/util',
    'io.ox/core/print'
], function (api, chronosUtil, util, print) {

    'use strict';

    function getMoment(event, attribute) {
        return moment.tz(event[attribute].value, event[attribute].tzid || moment.defaultZone.name);
    }

    function getFilter(start, end) {
        return function (event) {
            var eventStart = getMoment(event, 'startDate'),
                eventEnd = getMoment(event, 'endDate');

            // check if appointment is on that day
            if (eventStart > start && eventStart < end) return true;
            if (eventEnd > start && eventEnd < end) return true;
            return false;
        };
    }

    function sortBy(event) {
        return chronosUtil.isAllday(event) ? -1 : getMoment(event, 'startDate').valueOf();
    }

    function map(event) {
        return {
            time: chronosUtil.isAllday(event) ? undefined : getMoment(event, 'startDate').format('LT'),
            title: event.summary
        };
    }

    return {

        open: function (selection, win) {

            print.smart({
                selection: [selection.folder],

                get: function () {
                    return api.getAll({
                        start: selection.start,
                        end: selection.end,
                        folder: selection.folder
                    }).then(function (events) {
                        var weekStart = moment(selection.start),
                            end = moment(selection.end),
                            weeks = [];

                        // loop over weeks
                        for (;end.diff(weekStart) > -1; weekStart.add(1, 'week')) {
                            var start = weekStart.clone(),
                                weekEnd = weekStart.clone().add(1, 'week'),
                                days = [];

                            // loop over days
                            for (;weekEnd.diff(start) > 0; start.add(1, 'day')) {
                                var dayStart = start.valueOf(),
                                    dayEnd = start.clone().add(1, 'day').valueOf();
                                days.push({
                                    date: start.date(),
                                    events: _(events)
                                        .chain()
                                        .filter(getFilter(dayStart, dayEnd))
                                        .sortBy(sortBy)
                                        .map(map)
                                        .value()
                                });
                            }

                            weeks.push({
                                days: days
                            });
                        }

                        return weeks;
                    });
                },

                meta: {
                    labels: _(_.range(7)).map(function (num) {
                        return moment().weekday(num).format('dddd');
                    })
                },

                selector: '.calendar-month-view',

                window: win
            });
        }
    };

});
