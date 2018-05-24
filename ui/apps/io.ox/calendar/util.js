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

define('io.ox/calendar/util', [
    'io.ox/core/api/user',
    'io.ox/contacts/api',
    'io.ox/core/api/group',
    'io.ox/core/folder/api',
    'io.ox/core/util',
    'io.ox/core/tk/dialogs',
    'settings!io.ox/calendar',
    'settings!io.ox/core',
    'gettext!io.ox/calendar'
], function (userAPI, contactAPI, groupAPI, folderAPI, util, dialogs, settings, coreSettings, gt) {

    'use strict';

    // day names
    var n_count = [gt('fifth / last'), '', gt('first'), gt('second'), gt('third'), gt('fourth'), gt('fifth / last')],
        // confirmation status (none, accepted, declined, tentative)
        chronosStates = 'NEEDS-ACTION ACCEPTED DECLINED TENTATIVE'.split(' '),
        confirmTitles = [
            gt('unconfirmed'),
            gt('accepted'),
            gt('declined'),
            gt('tentative')
        ],
        n_confirm = ['', '<i class="fa fa-check" aria-hidden="true">', '<i class="fa fa-times" aria-hidden="true">', '<i class="fa fa-question-circle" aria-hidden="true">'],
        superessiveWeekdays = [
            //#. superessive of the weekday
            //#. will only be used in a form like “Happens every week on $weekday”
            gt.pgettext('superessive', 'Sunday'),
            //#. superessive of the weekday
            //#. will only be used in a form like “Happens every week on $weekday”
            gt.pgettext('superessive', 'Monday'),
            //#. superessive of the weekday
            //#. will only be used in a form like “Happens every week on $weekday”
            gt.pgettext('superessive', 'Tuesday'),
            //#. superessive of the weekday
            //#. will only be used in a form like “Happens every week on $weekday”
            gt.pgettext('superessive', 'Wednesday'),
            //#. superessive of the weekday
            //#. will only be used in a form like “Happens every week on $weekday”
            gt.pgettext('superessive', 'Thursday'),
            //#. superessive of the weekday
            //#. will only be used in a form like “Happens every week on $weekday”
            gt.pgettext('superessive', 'Friday'),
            //#. superessive of the weekday
            //#. will only be used in a form like “Happens every week on $weekday”
            gt.pgettext('superessive', 'Saturday')
        ],
        attendeeLookupArray = ['', 'INDIVIDUAL', 'GROUP', 'RESOURCE', 'RESOURCE', 'INDIVIDUAL'];

    var that = {

        // column translations
        columns: {
            title: gt('Subject'),
            location: gt('Location'),
            note: gt('Description')
        },

        // day bitmask
        days: {
            SUNDAY: 1,
            MONDAY: 2,
            TUESDAY: 4,
            WEDNESDAY: 8,
            THURSDAY: 16,
            FRIDAY: 32,
            SATURDAY: 64
        },

        colors: [
            // light
            { label: gt('light red'), value: '#FFE2E2' },
            { label: gt('light orange'), value: '#FDE2B9' },
            { label: gt('light yellow'), value: '#FFEEB0' },
            { label: gt('light olive'), value: '#E6EFBD' },
            { label: gt('light green'), value: '#CAF1D0' },
            { label: gt('light cyan'), value: '#CCF4FF' },
            { label: gt('light azure'), value: '#CFE6FF' },
            { label: gt('light blue'), value: '#D4E0FD' },
            { label: gt('light indigo'), value: '#D1D6FE' },
            { label: gt('light purple'), value: '#E2D0FF' },
            { label: gt('light magenta'), value: '#F7CBF8' },
            { label: gt('light pink'), value: '#F7C7E0' },
            { label: gt('light gray'), value: '#EBEBEB' },
            // medium
            { label: gt('red'), value: '#F5AAAA' },
            { label: gt('orange'), value: '#FFB341' },
            { label: gt('yellow'), value: '#FFCF1A' },
            { label: gt('olive'), value: '#C5D481' },
            { label: gt('green'), value: '#AFDDA0' },
            { label: gt('cyan'), value: '#A2D9E7' },
            { label: gt('azure'), value: '#9BC8F7' },
            { label: gt('blue'), value: '#B1C3EE' },
            { label: gt('indigo'), value: '#949EEC' },
            { label: gt('purple'), value: '#B89AE9' },
            { label: gt('magenta'), value: '#D383D5' },
            { label: gt('pink'), value: '#E18BB8' },
            { label: gt('gray'), value: '#C5C5C5' },
            // dark
            { label: gt('dark red'), value: '#C84646' },
            { label: gt('dark orange'), value: '#B95900' },
            { label: gt('dark yellow'), value: '#935700' },
            { label: gt('dark olive'), value: '#66761F' },
            { label: gt('dark green'), value: '#376B27' },
            { label: gt('dark cyan'), value: '#396D7B' },
            { label: gt('dark azure'), value: '#27609C' },
            { label: gt('dark blue'), value: '#445F9F' },
            { label: gt('dark indigo'), value: '#5E6AC1' },
            { label: gt('dark purple'), value: '#734EAF' },
            { label: gt('dark magenta'), value: '#9A369C' },
            { label: gt('dark pink'), value: '#A4326D' },
            { label: gt('dark gray'), value: '#6B6B6B' }
        ],

        PRIVATE_EVENT_COLOR: '#616161',

        ZULU_FORMAT: 'YYYYMMDD[T]HHmmss[Z]',

        getFirstWeekDay: function () {
            // week starts with (0=Sunday, 1=Monday, ..., 6=Saturday)
            return moment.localeData().firstDayOfWeek();
        },

        getDaysInMonth: function (year, month) {
            // trick: month + 1 & day = zero -> last day in month
            return moment([year, month + 1]).daysInMonth();
        },

        isToday: function (timestamp) {
            return moment().isSame(timestamp, 'day');
        },

        getTime: function (moment) {
            return moment.format('LT');
        },

        getDate: function (timestamp) {
            return moment(timestamp ? timestamp : undefined).format('ddd, l');
        },

        getSmartDate: function (model) {
            return model.getMoment('startDate').calendar();
        },

        getEvenSmarterDate: function (model) {
            var m = model.getMoment('startDate'),
                startOfDay = moment().startOf('day');
            // past?
            if (m.isBefore(startOfDay)) {
                if (m.isAfter(startOfDay.subtract(1, 'day'))) {
                    return gt('Yesterday') + ', ' + m.format('l');
                }
                return m.format('ddd, l');
            }
            // future
            if (m.isBefore(startOfDay.add(1, 'days'))) {
                return gt('Today') + ', ' + m.format('l');
            }
            if (m.isBefore(startOfDay.add(1, 'day'))) {
                return gt('Tomorrow') + ', ' + m.format('l');
            }
            return m.format('ddd, l');
        },

        // function that returns markup for date and time + timzonelabel
        getDateTimeIntervalMarkup: function (data, options) {
            if (data && data.startDate && data.endDate) {

                options = _.extend({ timeZoneLabel: { placement:  _.device('touch') ? 'bottom' : 'top' }, a11y: false, output: 'markup' }, options);

                if (options.container && options.container.parents('#io-ox-core').length < 1) {
                    // view is not in core (happens with deep links)
                    // add timezonepopover to body
                    options.timeZoneLabel.container = 'body';
                }
                var startDate,
                    endDate,
                    dateStr,
                    timeStr,
                    timeZoneStr = that.getMoment(data.startDate).zoneAbbr(),
                    fmtstr = options.a11y ? 'dddd, l' : 'ddd, l';

                if (that.isAllday(data)) {
                    startDate = moment.utc(data.startDate.value).local(true);
                    endDate = moment.utc(data.endDate.value).local(true).subtract(1, 'days');
                } else {
                    startDate = that.getMoment(data.startDate);
                    endDate = that.getMoment(data.endDate);
                    if (options.zone) {
                        startDate.tz(options.zone);
                        endDate.tz(options.zone);
                        timeZoneStr = startDate.zoneAbbr();
                    }
                }
                if (startDate.isSame(endDate, 'day')) {
                    dateStr = startDate.format(fmtstr);
                    timeStr = this.getTimeInterval(data, options.zone);
                } else if (that.isAllday(data)) {
                    dateStr = this.getDateInterval(data);
                    timeStr = this.getTimeInterval(data, options.zone);
                } else {
                    // not same day and not fulltime. use interval with date and time, separate date and is confusing
                    dateStr = startDate.formatInterval(endDate, fmtstr + ' LT');
                }

                // standard markup or object with strings
                if (options.output === 'strings') {
                    return { dateStr: dateStr, timeStr: timeStr || '', timeZoneStr: timeZoneStr };
                }
                return $('<div class="date-time">').append(
                    // date
                    $('<span class="date">').text(dateStr),
                    // mdash
                    $.txt(' \u00A0 '),
                    // time
                    $('<span class="time">').append(
                        timeStr ? $.txt(timeStr) : '',
                        // Yep there are appointments without timezone. May not be all day appointmens either
                        data.startDate.tzid && !options.noTimezoneLabel ? this.addTimezonePopover($('<span class="label label-default pointer" tabindex="0">').text(timeZoneStr), data, options.timeZoneLabel) : ''
                    )
                );
            }
            return '';
        },

        getDateInterval: function (data, zone, a11y) {
            if (data && data.startDate && data.endDate) {
                var startDate, endDate,
                    fmtstr = a11y ? 'dddd, l' : 'ddd, l';

                a11y = a11y || false;

                if (that.isAllday(data)) {
                    startDate = moment.utc(data.startDate.value).local(true);
                    endDate = moment.utc(data.endDate.value).local(true).subtract(1, 'days');
                } else {
                    startDate = that.getMoment(data.startDate);
                    endDate = that.getMoment(data.endDate);
                    if (zone) {
                        startDate.tz(zone);
                        endDate.tz(zone);
                    }
                }
                if (startDate.isSame(endDate, 'day')) {
                    return startDate.format(fmtstr);
                }
                if (a11y && that.isAllday(data)) {
                    //#. date intervals for screenreaders
                    //#. please keep the 'to' do not use dashes here because this text will be spoken by the screenreaders
                    //#. %1$s is the start date
                    //#. %2$s is the end date
                    //#, c-format
                    return gt('%1$s to %2$s', startDate.format(fmtstr), endDate.format(fmtstr));
                }
                return startDate.formatInterval(endDate, fmtstr);
            }
            return '';
        },

        getDateIntervalA11y: function (data, zone) {
            return this.getDateInterval(data, zone, true);
        },

        getTimeInterval: function (data, zone, a11y) {
            if (!data || !data.startDate || !data.endDate) return '';
            if (that.isAllday(data)) {
                return this.getFullTimeInterval(data, true);
            }
            var start = that.getMoment(data.startDate),
                end = that.getMoment(data.endDate);
            if (zone) {
                start.tz(zone);
                end.tz(zone);
            }
            if (a11y) {
                //#. date intervals for screenreaders
                //#. please keep the 'to' do not use dashes here because this text will be spoken by the screenreaders
                //#. %1$s is the start date
                //#. %2$s is the end date
                //#, c-format
                return gt('%1$s to %2$s', start.format('LT'), end.format('LT'));
            }
            return start.formatInterval(end, 'time');
        },

        getTimeIntervalA11y: function (data, zone) {
            return this.getTimeInterval(data, zone, true);
        },

        getFullTimeInterval: function (data, smart) {
            var length = this.getDurationInDays(data);
            return length <= 1 && smart ? gt('Whole day') : gt.format(
                //#. General duration (nominative case): X days
                //#. %d is the number of days
                //#, c-format
                gt.ngettext('%d day', '%d days', length), length);
        },

        getReminderOptions: function () {

            var options = {},
                reminderListValues = [
                    // value is ical duration format
                    { value: 'PT0M', format: 'minutes' },
                    { value: 'PT5M', format: 'minutes' },
                    { value: 'PT10M', format: 'minutes' },
                    { value: 'PT15M', format: 'minutes' },
                    { value: 'PT30M', format: 'minutes' },
                    { value: 'PT45M', format: 'minutes' },

                    { value: 'PT1H', format: 'hours' },
                    { value: 'PT2H', format: 'hours' },
                    { value: 'PT4H', format: 'hours' },
                    { value: 'PT6H', format: 'hours' },
                    { value: 'PT8H', format: 'hours' },
                    { value: 'PT12H', format: 'hours' },

                    { value: 'P1D', format: 'days' },
                    { value: 'P2D', format: 'days' },
                    { value: 'P3D', format: 'days' },
                    { value: 'P4D', format: 'days' },
                    { value: 'P5D', format: 'days' },
                    { value: 'P6D', format: 'days' },

                    { value: 'P1W', format: 'weeks' },
                    { value: 'P2W', format: 'weeks' },
                    { value: 'P3W', format: 'weeks' },
                    { value: 'P4W', format: 'weeks' }
                ];

            _(reminderListValues).each(function (item) {
                var i = item.value.match(/\d+/)[0];
                switch (item.format) {
                    case 'minutes':
                        options[item.value] = gt.format(gt.ngettext('%1$d minute', '%1$d minutes', i), i);
                        break;
                    case 'hours':
                        options[item.value] = gt.format(gt.ngettext('%1$d hour', '%1$d hours', i), i);
                        break;
                    case 'days':
                        options[item.value] = gt.format(gt.ngettext('%1$d day', '%1$d days', i), i);
                        break;
                    case 'weeks':
                        options[item.value] = gt.format(gt.ngettext('%1$d week', '%1$d weeks', i), i);
                        break;
                    // no default
                }
            });

            return options;
        },

        onSameDay: function (t1, t2) {
            return moment(t1).isSame(t2, 'day');
        },

        getDurationInDays: function (data) {
            return that.getMoment(data.endDate).diff(that.getMoment(data.startDate), 'days');
        },

        getStartAndEndTime: function (data) {
            var ret = [];
            if (!data || !data.startDate || !data.endDate) return ret;
            if (that.isAllday(data)) {
                ret.push(this.getFullTimeInterval(data, false));
            } else {
                ret.push(moment.tz(data.startDate.value, data.startDate.tzid).format('LT'), moment.tz(data.endDate.value, data.endDate.tzid).format('LT'));
            }
            return ret;
        },

        addTimezoneLabel: function (parent, data, options) {

            var current = moment(data.startDate);
            if (data.startDate.value) {
                current = that.getMoment(data[options.attrName || 'startDate']);
            }
            parent.append(
                $.txt(this.getTimeInterval(data)),
                this.addTimezonePopover($('<span class="label label-default pointer" tabindex="0">').text(current.zoneAbbr()), data, options)
            );

            return parent;
        },

        addTimezonePopover: function (parent, data, opt) {

            opt = _.extend({
                placement: 'left',
                trigger: 'hover focus'
            }, opt);

            function getContent() {
                // hard coded for demo purposes
                var div = $('<ul class="list-unstyled">'),
                    list = settings.get('favoriteTimezones');

                if (!list || list.length === 0) {
                    list = [
                        'America/Los_Angeles',
                        'America/New_York',
                        'Europe/London',
                        'Europe/Berlin',
                        'Australia/Sydney'
                    ];
                }

                _(list).chain().uniq().first(10).each(function (zone) {
                    // get short name (with a few exceptions; see bug 41440)
                    var name = /(North|East|South|West|Central)/.test(zone) ? zone : zone.replace(/^.*?\//, '');
                    // must use outer DIV with "clear: both" here for proper layout in firefox
                    div.append(
                        $('<li>').append(
                            $('<span>').text(name.replace(/_/g, ' ')),
                            $('<span class="time">').text(that.getTimeInterval(data, zone))
                        )
                    );
                });

                return div;
            }

            function getTitle() {
                return that.getTimeInterval(data, moment().tz()) + ' ' + moment().zoneAbbr();
            }

            parent.popover({
                container: opt.container || '#io-ox-core',
                viewport: {
                    selector: '#io-ox-core',
                    padding: 10
                },
                content: getContent,
                html: true,
                placement: function (tip) {
                    // add missing outer class
                    $(tip).addClass('timezones');
                    // get placement
                    return opt.placement;
                },
                title: getTitle,
                trigger: opt.trigger
            }).on('blur dispose', function () {
                $(this).popover('hide');
                // set correct state or toggle doesn't work on next click
                $(this).data('bs.popover').inState.click = false;
            });

            if (opt.closeOnScroll) {
                // add listener on popup shown. Otherwise we will not get the correct scrollparent at this point (if the popover container is not yet added to the dom)
                parent.on('shown.bs.popover', function () {
                    parent.scrollParent().one('scroll', function () {
                        parent.popover('hide');
                        // set correct state or toggle doesn't work on next click
                        parent.data('bs.popover').inState.click = false;
                    });
                });
            }

            return parent;
        },

        getShownAsClass: function (data) {
            if (that.hasFlag(data, 'transparent')) return 'free';
            return 'reserved';
        },

        getShownAsLabel: function (data) {
            if (that.hasFlag(data, 'transparent')) return 'free';
            return 'label-info';
        },

        getShownAs: function (data) {
            //#. State of an appointment (reserved or free)
            if (that.hasFlag(data, 'transparent')) return gt('Free');
            return gt('Reserved');
        },

        getConfirmationSymbol: function (status) {
            return n_confirm[(_(status).isNumber() ? status : chronosStates.indexOf(status)) || 0];
        },

        getConfirmationClass: function (status) {
            return (_(status).isNumber() ? chronosStates[status] : status || 'NEEDS-ACTION').toLowerCase();
        },

        getConfirmationLabel: function (status) {
            return confirmTitles[(_(status).isNumber() ? status : chronosStates.indexOf(status)) || 0];
        },

        getRecurrenceDescription: function (data) {
            function getCountString(i) {
                return n_count[i + 1];
            }

            function getDayString(days, options) {
                options = _.extend({ superessive: false }, options);
                var firstDayOfWeek = moment.localeData().firstDayOfWeek(),
                    tmp = _(_.range(7)).chain().map(function (index) {
                        var mask = 1 << ((index + firstDayOfWeek) % 7);
                        if ((days & mask) !== 0) {
                            return options.superessive ?
                                superessiveWeekdays[(index + firstDayOfWeek) % 7] :
                                moment().weekday(index).format('dddd');
                        }
                    }).compact().value();

                var and =
                    //#. recurrence string
                    //#. used to concatenate two weekdays, like Monday and Tuesday
                    //#. make sure that the leading and trailing spaces are also in the translation
                    gt(' and '),
                    delimiter =
                    //#. This delimiter is used to concatenate a list of string
                    //#. Example: Monday, Tuesday, Wednesday
                    //#. make sure, that the trailing space is also in the translation
                    gt(', ');

                return tmp.length === 2 ? tmp.join(and) : tmp.join(delimiter);
            }

            function getMonthString(i) {
                // month names
                return moment.months()[i];
            }

            var str = '',
                interval = data.interval,
                days = data.days || null,
                month = data.month,
                day_in_month = data.day_in_month;

            switch (data.recurrence_type) {

                // DAILY
                case 1:
                    //#. recurrence string
                    //#. %1$d: numeric
                    str = gt.npgettext('daily', 'Every day.', 'Every %1$d days.', interval, interval);
                    break;

                // WEEKLY
                case 2:
                    // special case: weekly but all days checked
                    if (days === 127) {
                        //#. recurrence string
                        //#. %1$d: numeric
                        str = gt.npgettext('weekly', 'Every day.', 'Every %1$d weeks on all days.', interval, interval);
                    } else if (days === 62) { // special case: weekly on workdays
                        //#. recurrence string
                        //#. %1$d: numeric
                        str = gt.npgettext('weekly', 'On workdays.', 'Every %1$d weeks on workdays.', interval, interval);
                    } else if (days === 65) {
                        //#. recurrence string
                        //#. %1$d: numeric
                        str = gt.npgettext('weekly', 'Every weekend.', 'Every %1$d weeks on weekends.', interval, interval);
                    } else {
                        //#. recurrence string
                        //#. %1$d: numeric
                        //#. %2$s: day string, e.g. "Friday" or "Monday, Tuesday, Wednesday"
                        //#. day string will be in "superessive" form if %1$d >= 2; nominative if %1$d == 1
                        str = gt.npgettext('weekly', 'Every %2$s.', 'Every %1$d weeks on %2$s.', interval, interval, getDayString(days, { superessive: interval > 1 }));
                    }

                    break;

                // MONTHLY
                case 3:
                    if (days === null) {
                        //#. recurrence string
                        //#. %1$d: numeric, interval
                        //#. %2$d: numeric, day in month
                        //#. Example: Every 5 months on day 18
                        str = gt.npgettext('monthly', 'Every month on day %2$d.', 'Every %1$d months on day %2$d.', interval, interval, day_in_month);
                    } else {
                        //#. recurrence string
                        //#. %1$d: numeric, interval
                        //#. %2$s: count string, e.g. first, second, or last
                        //#. %3$s: day string, e.g. Monday
                        //#. Example Every 3 months on the second Tuesday
                        str = gt.npgettext('monthly', 'Every month on the %2$s %3$s.', 'Every %1$d months on the %2$s %3$s.', interval, interval, getCountString(day_in_month), getDayString(days));
                    }

                    break;

                // YEARLY
                case 4:
                    if (days === null) {
                        //#. recurrence string
                        //#. %1$s: Month nane, e.g. January
                        //#. %2$d: Date, numeric, e.g. 29
                        //#. Example: Every year in December on day 3
                        str = gt('Every year in %1$s on day %2$d.', getMonthString(month), day_in_month);
                    } else {
                        //#. recurrence string
                        //#. %1$s: count string, e.g. first, second, or last
                        //#. %2$s: day string, e.g. Monday
                        //#. %3$s: month nane, e.g. January
                        //#. Example: Every year on the first Tuesday in December
                        str = gt('Every year on the %1$s %2$s in %3$d.', getCountString(day_in_month), getDayString(days), getMonthString(month));
                    }

                    break;
                // no default
            }

            return str;
        },

        getRecurrenceEnd: function (data) {
            var str;
            if (data.until) {
                str = gt('The series ends on %1$s.', moment(data.until).format('l'));
            } else if (data.occurrences) {
                var n = data.occurrences;
                str = gt.format(gt.ngettext('The series ends after one occurrence.', 'The series ends after %1$d occurences.', n), n);
            } else {
                str = gt('The series never ends.');
            }

            return str;
        },

        getRecurrenceString: function (data) {
            if (data.rrule) data = new (require('io.ox/calendar/model').Model)(data);
            if (data instanceof Backbone.Model && data.getRruleMapModel) data = data.getRruleMapModel();
            if (data instanceof Backbone.Model) data = data.toJSON();
            var str = that.getRecurrenceDescription(data);
            if (data.recurrence_type > 0 && (data.until || data.occurrences)) str += ' ' + that.getRecurrenceEnd(data);
            return str;
        },
        // basically the same as in recurrence-view
        // used to fix reccurence information when Ïging
        updateRecurrenceDate: function (event, oldDate) {
            if (!event || !oldDate) return;

            var rruleMapModel = event.getRruleMapModel(),
                type = rruleMapModel.get('recurrence_type');
            if (type === 0) return;

            var date = event.getMoment('startDate');

            // if weekly, shift bits
            if (type === 2) {
                var shift = date.diff(oldDate, 'days') % 7,
                    days = rruleMapModel.get('days');
                if (shift < 0) shift += 7;
                for (var i = 0; i < shift; i++) {
                    days = days << 1;
                    if (days > 127) days -= 127;
                }
                rruleMapModel.set('days', days);
            }

            // if monthly or yeary, adjust date/day of week
            if (type === 3 || type === 4) {
                if (rruleMapModel.has('days')) {
                    // repeat by weekday
                    rruleMapModel.set({
                        day_in_month: ((date.date() - 1) / 7 >> 0) + 1,
                        days: 1 << date.day()
                    });
                } else {
                    // repeat by date
                    rruleMapModel.set('day_in_month', date.date());
                }
            }

            // if yearly, adjust month
            if (type === 4) {
                rruleMapModel.set('month', date.month());
            }

            // change until
            if (rruleMapModel.get('until') && moment(rruleMapModel.get('until')).isBefore(date)) {
                rruleMapModel.set('until', date.add(1, ['d', 'w', 'M', 'y'][rruleMapModel.get('recurrence_type') - 1]).valueOf());
            }
            rruleMapModel.serialize();
            return event;
        },

        getAttendeeName: function (data) {
            return data ? data.cn || data.mail || data.uri : '';
        },

        getNote: function (data, prop) {
            // calendar: description, tasks: note
            prop = prop || 'description';
            var text = $.trim(data[prop] || (data.get ? data.get(prop) : ''))
                .replace(/\n{3,}/g, '\n\n')
                .replace(/</g, '&lt;');
            //use br to keep linebreaks when pasting (see 38714)
            return util.urlify(text).replace(/\n/g, '<br>');
        },

        getConfirmations: function (data) {
            var hash = {};
            if (data) {
                // internal users
                _(data.users).each(function (obj) {
                    hash[String(obj.id)] = {
                        status: obj.confirmation || 0
                    };
                    // only add confirm message if there is one
                    if (obj.confirmmessage) {
                        hash[String(obj.id)].comment = obj.confirmmessage;
                    }
                });
                // external users
                _(data.confirmations).each(function (obj) {
                    hash[obj.mail] = {
                        status: obj.status || 0
                    };
                    // only add confirm message if there is one
                    if (obj.message || obj.confirmmessage) {
                        hash[String(obj.id)].comment = obj.message || obj.confirmmessage;
                    }
                });
            }
            return hash;
        },

        getConfirmationStatus: function (model, defaultStatus) {
            if (!(model instanceof Backbone.Model)) model = new (require('io.ox/calendar/model').Model)(model);
            if (model.hasFlag('accepted')) return 'ACCEPTED';
            if (model.hasFlag('tentative')) return 'TENTATIVE';
            if (model.hasFlag('declined')) return 'DECLINED';
            if (model.hasFlag('needs_action')) return 'NEEDS-ACTION';
            if (model.hasFlag('event_accepted')) return 'ACCEPTED';
            if (model.hasFlag('event_tentative')) return 'TENTATIVE';
            if (model.hasFlag('event_declined')) return 'DECLINED';
            return defaultStatus || 'NEEDS-ACTION';
        },

        getConfirmationMessage: function (obj, id) {
            var user = _(obj.attendees).findWhere({
                entity: id || ox.user_id
            });
            if (!user) return;
            return user.comment;
        },

        getConfirmationSummary: function (conf) {
            var ret = { count: 0 };
            // init
            _.each(chronosStates, function (cls, i) {
                ret[i] = {
                    icon: n_confirm[i] || '<i class="fa fa-exclamation-circle" aria-hidden="true">',
                    count: 0,
                    css: cls.toLowerCase(),
                    title: confirmTitles[i] || ''
                };
            });

            _.each(conf, function (c) {
                // tasks
                if (_.isNumber(c.status)) {
                    ret[c.status].count++;
                    ret.count++;
                // don't count groups or resources, ignore unknown states (the spec allows custom partstats)
                } else if (ret[chronosStates.indexOf((c.partStat || 'NEEDS-ACTION').toUpperCase())] && c.cuType === 'INDIVIDUAL') {
                    ret[chronosStates.indexOf((c.partStat || 'NEEDS-ACTION').toUpperCase())].count++;
                    ret.count++;
                }
            });
            return ret;
        },

        getWeekScaffold: function (timestamp) {
            var day = moment(timestamp).startOf('week'),
                obj,
                ret = { days: [] };
            for (var i = 0; i < 7; i++) {
                ret.days.push(obj = {
                    year: day.year(),
                    month: day.month(),
                    date: day.date(),
                    day: day.day(),
                    timestamp: +day,
                    isToday: moment().isSame(day, 'day'),
                    col: i % 7
                });
                // is weekend?
                obj.isWeekend = obj.day === 0 || obj.day === 6;
                obj.isFirst = obj.date === 1;
                if (obj.isFirst) {
                    ret.hasFirst = true;
                }
                day.add(1, 'days');

                obj.isLast = day.date() === 1;
                if (obj.isLast) {
                    ret.hasLast = true;
                }
            }
            return ret;
        },

        resolveParticipants: function (data) {
            // clone array
            var attendees = data.attendees.slice(),
                IDs = {
                    user: [],
                    group: [],
                    ext: []
                };

            var organizerIsExternalParticipant = !data.organizer.entity && _.isString(data.organizer.email) && _.find(attendees, function (p) {
                return p.mail === data.organizer.email;
            });

            if (!organizerIsExternalParticipant) {
                attendees.unshift(data.organizer);
            }

            _.each(attendees, function (attendee) {
                switch (attendee.cuType) {
                    case 'INDIVIDUAL':
                        // internal user
                        if (attendee.entity) {
                            // user API expects array of integer [1337]
                            IDs.user.push(attendee.entity);
                        } else {
                            // external attendee
                            IDs.ext.push({
                                display_name: attendee.cn,
                                mail: attendee.email,
                                mail_field: 0
                            });
                        }
                        break;
                    // group
                    case 'GROUP':
                        // group expects array of object [{ id: 1337 }], yay (see bug 47207)
                        IDs.group.push({ id: attendee.entity });
                        break;
                    // resource or rescource group
                    case 'RESOURCE':
                        // ignore resources
                        break;
                    // no default
                }
            });

            return groupAPI.getList(IDs.group)
                // resolve groups
                .then(function (groups) {
                    _.each(groups, function (single) {
                        IDs.user = _.union(single.members, IDs.user);
                    });
                    return userAPI.getList(IDs.user);
                })
                // add mail to user objects
                .then(function (users) {
                    // add user type 1 to all internal users
                    _.each(users, function (obj) {
                        _.extend(obj, { type: 1 });
                    });
                    // search for external users in contacts
                    var defs = _(IDs.ext).map(function (ext) {
                        return contactAPI.search(ext.mail);
                    });
                    return $.when.apply($, defs).then(function () {
                        _(arguments).each(function (result, i) {
                            if (_.isArray(result) && result.length) {
                                IDs.ext[i] = result[0];
                            }
                        });
                        // combine results with groups and map
                        return _([].concat(IDs.ext, users))
                            .chain()
                            .uniq()
                            .map(function (user) {
                                return $.extend(user, { mail: user.email1, mail_field: 1 });
                            })
                            .value();
                    });
                });
        },

        getUserIdByInternalId: function (internal) {
            return contactAPI.get({ id: internal, folder: 6 }).then(function (data) {
                return data.user_id;
            });
        },

        getAppointmentColor: function (folder, eventModel) {
            var folderColor = that.getFolderColor(folder),
                eventColor = eventModel.get('color'),
                defaultStatus = folderAPI.is('public', folder) || folderAPI.is('private', folder) ? 'ACCEPTED' : 'NEEDS-ACTION',
                conf = that.getConfirmationStatus(eventModel, defaultStatus);

            if (_.isNumber(eventColor)) eventColor = that.colors[eventColor - 1].value;

            // shared appointments which are needs-action or declined don't receive color classes
            if (/^(needs-action|declined)$/.test(that.getConfirmationClass(conf))) return '';

            // private appointments are colored with gray instead of folder color
            if (that.isPrivate(eventModel)) folderColor = that.PRIVATE_EVENT_COLOR;

            // if (folderAPI.is('public', folder) && ox.user_id !== appointment.created_by) {
            //     // public appointments which are not from you are always colored in the calendar color
            //     return 'color-label-' + folderColor;
            // }

            // set color of appointment. if color is 0, then use color of folder
            return !eventColor ? folderColor : eventColor;
        },

        lightenDarkenColor: _.memoize(function (col, amt) {
            if (_.isString(col)) col = this.colorToHex(col);
            col = that.hexToHSL(col);
            col[2] = Math.floor(col[2] * amt);
            col[2] = Math.max(Math.min(100, col[2]), 0);
            return 'hsl(' + col[0] + ',' + col[1] + '%,' + col[2] + '%)';
        }),

        colorToHex: _.memoize(function (color) {
            var data = that.colorToRGB(color);
            return (data[0] << 16) + (data[1] << 8) + data[2];
        }),

        colorToHSL: _.memoize(function (color) {
            var hex = that.colorToHex(color);
            return that.hexToHSL(hex);
        }),

        colorToRGB: _.memoize(function () {

            var canvas = document.createElement('canvas'), context = canvas.getContext('2d');
            canvas.width = 1;
            canvas.height = 1;

            return function (color) {
                context.fillStyle = 'white';
                context.fillRect(0, 0, 1, 1);
                context.fillStyle = color;
                context.fillRect(0, 0, 1, 1);
                return context.getImageData(0, 0, 1, 1).data;
            };
        }()),

        hexToHSL: _.memoize(function (color) {
            var r = (color >> 16) / 255,
                g = ((color >> 8) & 0x00FF) / 255,
                b = (color & 0x0000FF) / 255,
                max = Math.max(r, g, b), min = Math.min(r, g, b),
                h, s, l = (max + min) / 2;

            if (max === min) {
                h = s = 0; // achromatic
            } else {
                var d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                    default: h = 0; break;
                }
                h /= 6;
            }

            return [Math.floor(h * 360), Math.floor(s * 100), Math.floor(l * 100)];
        }),

        getRelativeLuminance: (function () {

            function val(x) {
                x /= 255;
                return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
            }

            return function (rgb) {
                return 0.2126 * val(rgb[0]) + 0.7152 * val(rgb[1]) + 0.0722 * val(rgb[2]);
            };
        }()),

        // returns color ensuring a color contrast higher than 1:4.5
        // based on algorithm as defined by https://www.w3.org/TR/WCAG20-TECHS/G18.html#G18-tests
        getForegroundColor: _.memoize(function (color) {

            function colorContrast(foreground) {
                var l2 = that.getRelativeLuminance(that.colorToRGB(foreground));
                return (l1 + 0.05) / (l2 + 0.05);
            }

            var l1 = that.getRelativeLuminance(that.colorToRGB(color)),
                hsl = that.colorToHSL(color),
                hue = hsl[0],
                sat = hsl[1] > 0 ? 30 : 0,
                lum = 50,
                foreground;

            if (l1 < 0.18333) return 'white';

            // start with 50% luminance; then go down until color contrast exceeds 5 (little higher than 4.5)
            // whoever finds a simple way to calculate this programmatically
            // (and which is still correct in all cases) gets a beer or two
            do {
                foreground = 'hsl(' + hue + ', ' + sat + '%, ' + lum + '%)';
                lum -= 5;
            } while (lum >= 0 && colorContrast(foreground) < 5);

            return foreground;
        }),

        canAppointmentChangeColor: function (folder, eventModel) {
            var eventColor = eventModel.get('color'),
                privateFlag = that.isPrivate(eventModel),
                defaultStatus = folderAPI.is('public', folder) || folderAPI.is('private', folder) ? 'ACCEPTED' : 'NEEDS-ACTION',
                conf = that.getConfirmationStatus(eventModel, defaultStatus);

            // shared appointments which are needs-action or declined don't receive color classes
            if (/^(needs-action|declined)$/.test(that.getConfirmationClass(conf))) return false;

            return !eventColor && !privateFlag;
        },

        getFolderColor: function (folder) {
            var defaultColor = settings.get('defaultFolderColor', '#CFE6FF'),
                extendedProperties = folder['com.openexchange.calendar.extendedProperties'] || {},
                color = extendedProperties.color ? (extendedProperties.color.value || defaultColor) : defaultColor;
            // fallback if color is an index (might still occur due to defaultFolderColor)
            if (_.isNumber(color)) color = that.colors[color - 1].value;
            return color;
        },

        getDeepLink: function (data) {
            return [
                ox.abs,
                ox.root,
                '/#app=io.ox/calendar&id=',
                data.folder_id || data.folder,
                '.',
                data.recurrence_id || data.id,
                '.',
                data.recurrence_position || 0,
                '&folder=',
                data.folder_id || data.folder
            ].join('');
        },

        getRecurrenceEditDialog: function () {
            return new dialogs.ModalDialog()
                    .text(gt('Do you want to edit the whole series or just this appointment within the series?'))
                    .addPrimaryButton('series', gt('Series'), 'series')
                    .addButton('appointment', gt('Appointment'), 'appointment')
                    .addButton('cancel', gt('Cancel'), 'cancel');
        },

        showRecurrenceDialog: function (model) {
            if (!(model instanceof Backbone.Model)) model = new (require('io.ox/calendar/model').Model)(model);
            if (model.get('recurrenceId') && model.get('id') === model.get('seriesId')) {
                var dialog = new dialogs.ModalDialog();
                if (model.hasFlag('first_occurrence')) {
                    dialog.text(gt('Do you want to edit the whole series or just this appointment within the series?'));
                    dialog.addPrimaryButton('series', gt('Series'), 'series');
                } else if (model.hasFlag('last_occurrence')) {
                    return $.when('appointment');
                } else {
                    dialog.text(gt('Do you want to edit this and all future appointments or just this appointment within the series?'));
                    dialog.addPrimaryButton('thisandfuture', gt('All future appointments'), 'thisandfuture');
                }

                return dialog.addButton('appointment', gt('This appointment'), 'appointment')
                    .addButton('cancel', gt('Cancel'), 'cancel')
                    .show();
            }
            return $.when('appointment');
        },

        isPrivate: function (data, strict) {
            return that.hasFlag(data, 'private') || (!strict && that.hasFlag(data, 'confidential'));
        },

        returnIconsByType: function (obj) {
            var icons = {
                type: [],
                property: []
            };

            if (that.hasFlag(obj, 'tentative')) icons.type.push($('<span class="tentative-flag">').append($('<i class="fa fa-question-circle" aria-hidden="true">'), $('<span class="sr-only">').text(gt('Tentative'))));
            if (that.hasFlag(obj, 'private')) icons.type.push($('<span class="private-flag">').append($('<i class="fa fa-user-circle" aria-hidden="true">'), $('<span class="sr-only">').text(gt('Private'))));
            if (that.hasFlag(obj, 'confidential')) icons.type.push($('<span class="confidential-flag">').append($('<i class="fa fa-lock" aria-hidden="true">'), $('<span class="sr-only">').text(gt('Confidential'))));
            if (this.hasFlag(obj, 'series') || this.hasFlag(obj, 'overridden')) icons.property.push($('<span class="recurrence-flag">').append($('<i class="fa fa-repeat" aria-hidden="true">'), $('<span class="sr-only">').text(gt('Recurrence'))));
            if (this.hasFlag(obj, 'scheduled')) icons.property.push($('<span class="participants-flag">').append($('<i class="fa fa-user-o" aria-hidden="true">'), $('<span class="sr-only">').text(gt('Participants'))));
            if (this.hasFlag(obj, 'attachments')) icons.property.push($('<span class="attachments-flag">').append($('<i class="fa fa-paperclip" aria-hidden="true">'), $('<span class="sr-only">').text(gt('Attachments'))));
            return icons;
        },

        getCurrentRangeOptions: function () {
            var app = ox.ui.apps.get('io.ox/calendar');
            if (!app) return {};
            var window = app.getWindow();
            if (!window) return {};
            var perspective = window.getPerspective();
            if (!perspective) return;

            var rangeStart, rangeEnd;
            switch (perspective.name) {
                case 'week':
                    var view = perspective.view;
                    rangeStart = moment(view.startDate).utc();
                    rangeEnd = moment(view.startDate).utc().add(view.columns, 'days');
                    break;
                case 'month':
                    rangeStart = moment(perspective.firstMonth).startOf('week').utc();
                    rangeEnd = moment(perspective.lastMonth).endOf('month').endOf('week').utc();
                    break;
                case 'list':
                    rangeStart = moment().startOf('day').utc();
                    rangeEnd = moment().startOf('day').add((app.listView.collection.offset || 0) + 1, 'month').utc();
                    break;
                default:
            }

            if (!rangeStart || !rangeEnd) return {};
            return {
                expand: true,
                rangeStart: rangeStart.format(that.ZULU_FORMAT),
                rangeEnd: rangeEnd.format(that.ZULU_FORMAT)
            };
        },

        rangeFilter: function (start, end) {
            return function (obj) {
                var tsStart = that.getMoment(obj.startDate),
                    tsEnd = that.getMoment(obj.endDate);
                if (tsEnd < start) return false;
                if (tsStart > end) return false;
                return true;
            };
        },

        cid: function (o) {
            if (_.isObject(o)) {
                if (o.attributes) o = o.attributes;
                var cid = o.folder + '.' + o.id;
                if (o.recurrenceId) cid += '.' + o.recurrenceId;
                return cid;
            } else if (_.isString(o)) {
                var s = o.split('.'),
                    r = { folder: s[0], id: s[1] };
                if (s.length === 3) r.recurrenceId = s[2];
                return r;
            }
        },

        // creates an attendee object from a user object or model and contact model or object
        // distribution lists create an array of attendees representing the menmbers of the distribution list
        // used to create default participants and used by addparticipantsview
        // options can contain attendee object fields that should be prefilled (usually partStat: 'ACCEPTED')
        createAttendee: function (user, options) {

            if (!user) return;
            // make it work for models and objects
            user = user instanceof Backbone.Model ? user.attributes : user;

            // distribution lists are split into members
            if (user.mark_as_distributionlist) {
                return _(user.distribution_list).map(this.createAttendee);
            }
            options = options || {};
            var attendee = {
                cuType: attendeeLookupArray[user.type] || 'INDIVIDUAL',
                cn: user.display_name,
                partStat: 'NEEDS-ACTION'
            };

            if (attendee.cuType !== 'RESOURCE') {
                if ((user.user_id !== undefined || user.contact_id) && user.type !== 5) attendee.entity = user.user_id || user.id;
                attendee.email = user.field && user[user.field] ? user[user.field] : (user.email1 || user.mail);
                if (!attendee.cn) attendee.cn = attendee.email;
                attendee.uri = 'mailto:' + attendee.email;
            } else {
                attendee.partStat = 'ACCEPTED';
                if (user.description) attendee.comment = user.description;
                attendee.entity = user.id;
                attendee.resource = user;
            }

            if (attendee.cuType === 'GROUP') {
                attendee.entity = user.id;
                // not really needed. Added just for convenience. Helps if group should be resolved
                attendee.members = user.members;
            }
            // not really needed. Added just for convenience. Helps if distibution list should be created
            if (attendee.cuType === 'INDIVIDUAL') {
                attendee.contactInformation = { folder: user.folder_id, contact_id: user.contact_id || user.id };
                attendee.contact = {
                    display_name: user.display_name,
                    first_name: user.first_name,
                    last_name: user.last_name
                };
            }
            // override with predefined values if given
            return _.extend(attendee, options);
        },

        // all day appointments have no timezone and the start and end dates are in date format not date-time
        // checking the start date is sufficient as the end date must be of the same type, according to the spec
        isAllday: function (app) {
            if (!app) return false;
            app = app instanceof Backbone.Model ? app.attributes : app;
            var time = app.startDate;
            // there is no time value for all day appointments
            return this.isLocal(app) && (time.value.indexOf('T') === -1);
        },

        // appointments may be in local time. This means they do not move when the timezone changes. Do not confuse this with UTC time
        isLocal: function (app) {
            if (!app) return false;
            var time = app instanceof Backbone.Model ? app.get('startDate') : app.startDate;
            return time && time.value && !time.tzid;
        },

        getMoment: function (date) {
            if (_.isObject(date)) return moment.tz(date.value, date.tzid || moment().tz());
            return moment(date);
        },

        // get the right default alarm for an event
        // note: the defautl alarm for the birthday calendar is not considered here. There is no use case since you cannot edit those events atm.
        getDefaultAlarms: function (event) {
            // no event or not fulltime (isAllday returns false for no event)
            if (!this.isAllday(event)) {
                return settings.get('chronos/defaultAlarmDateTime', []);
            }
            return settings.get('chronos/defaultAlarmDate', []);
        },

        // checks if the user is allowed to edit an event
        // can be used in synced or deferred mode(deferred is default) by setting options.synced
        // If synced mode is used make sure to give the folder data in the options.folderData attribute
        allowedToEdit: function (event, options) {
            options = options || {};
            var result = function (val) { return options.synced ? val : $.when(val); };

            // no event
            if (!event) return result(false);

            // support objects and models
            var data = event.attributes || event,
                folder = data.folder;
            // no id or folder
            if (!data.id || !data.folder) return result(false);

            // organizer is allowed to edit
            if (this.hasFlag(data, 'organizer')) return result(true);

            // if user is neither organizer nor attendee editing is not allowed
            if (!this.hasFlag(data, 'attendee')) return result(false);

            // if both settings are the same, we don't need a folder check, all attendees are allowed to edit or not, no matter which folder the event is in
            if (settings.get('chronos/restrictAllowedAttendeeChanges', true) === settings.get('chronos/restrictAllowedAttendeeChangesPublic', true)) return result(!settings.get('chronos/restrictAllowedAttendeeChanges', true));

            // synced mode needs folderData at this point. Stop if not given
            if (options.synced && !options.folderData) return result(false);
            if (options.synced) {
                // public folder
                if (folderAPI.is('public', options.folderData)) return !settings.get('chronos/restrictAllowedAttendeeChangesPublic', true);
                // no public folder
                return !settings.get('chronos/restrictAllowedAttendeeChanges', true);
            }

            // check if this is a public or non public folder
            return folderAPI.get(folder).then(function (folderData) {
                // public folder
                if (folderAPI.is('public', folderData)) return !settings.get('chronos/restrictAllowedAttendeeChangesPublic', true);
                // no public folder
                return !settings.get('chronos/restrictAllowedAttendeeChanges', true);
            });
        },

        hasFlag: function (data, flag) {
            if (data instanceof Backbone.Model) return data.hasFlag(flag);
            if (!data.flags || !data.flags.length) return false;
            return data.flags.indexOf(flag) >= 0;
        }
    };

    return that;
});
