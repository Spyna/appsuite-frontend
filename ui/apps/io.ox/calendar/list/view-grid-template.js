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
 */

define('io.ox/calendar/list/view-grid-template', [
    'io.ox/calendar/util',
    'io.ox/core/extensions',
    'io.ox/core/folder/api',
    'gettext!io.ox/calendar',
    'less!io.ox/calendar/list/style'
], function (util, ext, folderAPI, gt) {

    'use strict';

    var that = {

        // main grid template
        main: {
            // overwrites the calculated height for
            // table cells
            getHeight: function () {
                return 70;
            },
            build: function () {
                var title, location, time, date, shown_as, conflicts, isPrivate;
                this.addClass('calendar').append(
                    time = $('<div class="time">').attr('aria-hidden', true),
                    $('<div class="contentContainer">').append(
                        date = $('<div class="date">'),
                        isPrivate = $('<i class="fa fa-lock private-flag" aria-hidden="true">').hide(),
                        title = $('<div class="title">'),
                        $('<div class="location-row">').append(
                            location = $('<span class="location">')
                        )
                    ).attr('aria-hidden', true)
                );

                return {
                    title: title,
                    location: location,
                    time: time,
                    date: date,
                    shown_as: shown_as,
                    conflicts: conflicts,
                    isPrivate: isPrivate
                };
            },
            set: function (data, fields) {

                var self = this,
                    a11yLabel = '',
                    tmpStr = '',
                    startDate,
                    endDate,
                    timeSplits = util.getStartAndEndTime(data);

                // clear classes of time to prevent adding multiple classes on reuse
                fields.time.removeClass().addClass('time');

                if (data.folder_id) {
                    //conflicts with appointments, where you aren't a participant don't have a folder_id.
                    var folder = folderAPI.get(data.folder_id);
                    folder.done(function (folder) {
                        var conf = util.getConfirmationStatus(data, folderAPI.is('shared', folder) ? folder.created_by : ox.user_id);

                        self.addClass(util.getConfirmationClass(conf) + (data.hard_conflict ? ' hardconflict' : ''));
                        fields.time.addClass(util.getAppointmentColorClass(folder, data))
                            .attr({
                                'data-folder': util.canAppointmentChangeColor(folder, data) ? folder.id : ''
                            });
                    });
                }

                fields.title
                    .text(a11yLabel = data.title ? gt.noI18n(data.title || '\u00A0') : gt('Private'));

                if (data.location) {
                    //#. %1$s is an appointment location (e.g. a room, a telco line, a company, a city)
                    //#. This fragment appears within a long string for screen readers
                    a11yLabel += ', ' + gt.format(gt.pgettext('a11y', 'location %1$s'), data.location);
                }
                fields.location.text(gt.noI18n(data.location || '\u00A0'));

                fields.time.empty()
                    .addClass('custom_shown_as ' + util.getShownAsClass(data))
                    .append(
                        $('<div class="fragment">').text(gt.noI18n(timeSplits[0])),
                        $('<div class="fragment">').text(gt.noI18n(timeSplits[1]))
                    );

                a11yLabel += ', ' + util.getShownAs(data);

                fields.date.empty()
                    .text(util.getDateInterval(data))
                    .toggle(!data.full_time && (util.getDurationInDays(data) > 0));

                if (data.full_time) {
                    startDate = moment.utc(data.start_date).local(true);
                    endDate = moment.utc(data.end_date).local(true).subtract(1, 'days');
                } else {
                    startDate = moment(data.start_date);
                    endDate = moment(data.end_date);
                }

                if (startDate.isSame(endDate, 'day')) {
                    tmpStr = gt.noI18n(util.getEvenSmarterDate(data));
                } else {
                    tmpStr = gt.noI18n(util.getDateIntervalA11y(data));
                }

                a11yLabel += ', ' + tmpStr;

                tmpStr = gt.noI18n(util.getTimeIntervalA11y(data));

                a11yLabel += ', ' + tmpStr;

                fields.isPrivate.toggle(!!data.private_flag);

                this.attr('aria-label', _.escape(a11yLabel) + '.');
            }
        },

        // template for labels
        label: {
            getHeight: function () {
                return 42;
            },
            build: function () {
                this.addClass('calendar-label');
            },
            set: function (data) {
                var d = util.getEvenSmarterDate(data, true);
                this.text(gt.noI18n(d));
            }
        },

        // detect new labels
        requiresLabel: function (i, data, current) {
            if (!data) {
                return false;
            }
            var d = util.getEvenSmarterDate(data);
            return (i === 0 || d !== current) ? d : false;
        }
    };

    return that;
});
