/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2011 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/calendar/list/view-grid-template',
    ['io.ox/calendar/util',
     'io.ox/core/extensions',
     'io.ox/core/api/folder',
     'gettext!io.ox/calendar',
     'less!io.ox/calendar/list/style.less'
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
                var title, location, time, date, shown_as, conflicts, isPrivate, contentContainer;
                this.addClass('calendar').append(
                    time = $('<div class="time">'),
                    contentContainer = $('<div class="contentContainer">').append(
                        date = $('<div class="date">'),
                        isPrivate = $('<i class="icon-lock private-flag">').hide(),
                        title = $('<div class="title">'),
                        $('<div class="location-row">').append(
                            location = $('<span class="location">')
                        )
                    )
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
                    timeSplits = util.getStartAndEndTime(data);

                if (data.folder_id) {//conflicts with appointments, where you aren't a participant don't have a folder_id.
                    var folder = folderAPI.get({ folder: data.folder_id });
                    folder.done(function (folder) {
                        var conf = util.getConfirmationStatus(data, folderAPI.is('shared', folder) ? folder.created_by : ox.user_id);
                        self.addClass(util.getConfirmationClass(conf) + (data.hard_conflict ? ' hardconflict' : ''));
                    });
                }

                fields.title
                    .text(a11yLabel = data.title ? gt.noI18n(data.title || '\u00A0') : gt('Private'));

                if (data.location) {
                    a11yLabel += ', ' + data.location;
                }
                fields.location.text(gt.noI18n(data.location || '\u00A0'));

                fields.time.empty().append(
                    $('<div class="fragment">').text(gt.noI18n(timeSplits[0])),
                    $('<div class="fragment">').text(gt.noI18n(timeSplits[1]))
                ).addClass('custom_shown_as ' + util.getShownAsClass(data));

                fields.date.empty().text(util.getDateInterval(data));

                if ((util.getDurationInDays(data) > 0) && !data.full_time) {
                    fields.date.show();
                }

                tmpStr = gt.noI18n(util.getTimeInterval(data));

                a11yLabel += ', ' + tmpStr;

                tmpStr = gt.noI18n(util.getDateInterval(data));
                a11yLabel += ', ' + tmpStr;

                if (data.private_flag === true) {
                    fields.isPrivate.show();
                } else {
                    fields.isPrivate.hide();
                }
                this.attr({ 'aria-label': a11yLabel });
            }
        },

        // template for labels
        label: {
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
