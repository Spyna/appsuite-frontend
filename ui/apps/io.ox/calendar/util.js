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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define("io.ox/calendar/util",
    ["io.ox/core/date", "gettext!io.ox/calendar/calendar"], function (date, gettext) {

    "use strict";

    // week day names
    var n_dayShort = date.locale.daysStandalone,
        n_day = date.locale.days,
        // month names
        n_month = date.locale.months,
        // day names
        n_count = [gettext("last"), "", gettext("first"), gettext("second"),
                   gettext("third"), gettext("fourth"), gettext("last")
                   ],
        // shown as
        n_shownAs = [gettext("Reserved"), gettext("Temporary"),
                     gettext("Absent"), gettext("Free")
                     ],
        shownAsClass = "reserved temporary absent free".split(' '),
        shownAsLabel = "label-info label-warning label-important label-success".split(' '),
        // confirmation status (none, accepted, declined, tentative)
        n_confirm = ['', '<i class="icon-ok">', '<i class="icon-remove">', '<i class="icon-question-sign">'],
        confirmClass = ["", "accepted", "declined", "tentative"],
        // constants
        MINUTE = 60000,
        HOUR = 60 * MINUTE,
        DAY = 24 * HOUR,
        WEEK = 7 * DAY,
        // day bitmask
        SUNDAY = 1,
        MONDAY = 2,
        THUESDAY = 4,
        WEDNESDAY = 8,
        THURSDAY = 16,
        FRIDAY = 32,
        SATURDAY = 64,
        // week starts with (0=Sunday, 1=Monday, ..., 6=Saturday)
        firstWeekDay = 1; /* date.locale.weekStart; */

    var zones;
    $.when.apply($, _.map(
        ['America/Los_Angeles', 'America/New_York', 'America/Sao_Paulo',
         'Europe/London', 'Europe/Berlin', 'Europe/Moscow', 'Asia/Kolkata',
         'Asia/Shanghai', 'Australia/Sydney'], date.getTimeZone))
        .done(function () {
            zones = Array.prototype.slice.call(arguments);
        });


    var that = {

        MINUTE: MINUTE,

        HOUR: HOUR,

        DAY: DAY,

        WEEK: WEEK,

        getFirstWeekDay: function () {
            return firstWeekDay;
        },

        getDayNames: function () {
            return n_dayShort.slice(firstWeekDay).concat(n_dayShort.slice(0, firstWeekDay));
        },

        getDaysInMonth: function (year, month) {
            // trick: month + 1 & day = zero -> last day in month
            return new date.Local(year, month + 1, 0).getDate();
        },

        isToday: function (timestamp) {
            return Math.floor(timestamp / DAY) ===
                Math.floor(new date.Local().getTime() / DAY);
        },

        floor: function (timestamp, step) {
            // set defaults
            timestamp = timestamp || 0;
            step = step || HOUR;
            // number?
            if (typeof step === "number") {
                return Math.floor(timestamp / step) * step;
            } else {
                if (step === "week") {
                    // get current date
                    var d = new date.Local(timestamp),
                        // get work day TODO: consider custom week start
                        day = d.getDay(),
                        // subtract
                        t = d.getTime() - day * DAY;
                    // round down to day and return
                    return this.floor(t, DAY);
                }
            }
        },

// OLD STUFF - looks nice
        getTime: function (timestamp) {
            var d = new date.Local(timestamp);
            return _.pad(d.getHours(), 2) + ":" + _.pad(d.getMinutes(), 2);
        },

        getDate: function (timestamp) {
            var d = timestamp !== undefined ? new date.Local(timestamp) : new date.Local();
            return n_dayShort[d.getDay()] + ", " + _.pad(d.getDate(), 2) + "." + _.pad(d.getMonth() + 1, 2) + "." + d.getYear();
        },

// NEW STUFF - not yet done
//
//        getTime: function (timestamp) {
//            return (new date.Local(date.Local.utc(timestamp)))
//                .format(date.locale.time);
//        },
//
//        getDate: function (timestamp) {
//            var d = timestamp !== undefined ?
//                new date.Local(date.Local.utc(timestamp)) : new date.Local();
//            return d.format(date.locale.date);
//        },

        getSmartDate: function (timestamp) {

            var d = timestamp !== undefined ? new date.Local(timestamp) : new date.Local(),
                now = new date.Local(),
                weekStart = this.floor(now.getTime(), "week"),
                diff = 0,
                diffWeek = 0;

            // normalize
            d.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);

            // get difference
            diff = d - now;
            diffWeek = d - weekStart;

            // past?
            if (diff < 0) {
                if (diff >= -1 * DAY) {
                    return "Yesterday";
                } else if (diffWeek > -7 * DAY) {
                    return "Last Week";
                }
            } else {
                // future
                if (diff < DAY) {
                    return "Today";
                } else if (diff < 2 * DAY) {
                    return "Tomorrow";
                } else if (diffWeek < 7 * DAY) {
                    return n_day[d.getDay()]; // this week
                } else if (diffWeek >= 7 * DAY && diffWeek < 14 * DAY) {
                    return "Next week";
                }
            }

            // any other month
            return n_month[d.getMonth()] + " " + d.getYear();
        },

        getDateInterval: function (data) {
            var length = (data.end_date - data.start_date) / DAY >> 0;
            if (data.full_time && length > 1) {
                // \u2013= &ndash;
                return this.getDate(data.start_date) + " \u2013 " + this.getDate(data.end_date - 1);
            } else {
                return this.getDate(data.start_date);
            }
        },

        onSameDay: function (t1, t2) {
            // don't change this to date.Local; thisis just a simple comparison
            return new Date(t1).setUTCHours(0, 0, 0, 0) === new Date(t2).setUTCHours(0, 0, 0, 0);
        },

        getTimeInterval: function (data, D) {
            var length, start, end, suffix;
            D = D || date.Local;
            if (data.full_time) {
                length = (data.end_date - data.start_date) / DAY >> 0;
                return length <= 1 ? gettext('Whole day') : gettext.format(
                    //#. %d is the number of days
                    gettext.ngettext('%d day', '%d days', length), length);
            } else {
                start = new date.Local(data.start_date);
                end = new date.Local(data.end_date);
                suffix = this.onSameDay(data.start_date, data.end_date) ? '' : ' ' + this.getDate(data.end_date);
                return that.getTime(start) + " \u2013 " + that.getTime(end) + suffix;
            }
        },

        addTimezoneLabel: function (parent, data) {

            var current = date.Local.getTTInfoLocal(data.start_date);

            parent.append(
                $.txt(that.getTimeInterval(data) + ' '),
                $('<span>').addClass('label').text(current.abbr).popover({
                    title: that.getTimeInterval(data) + ' ' + current.abbr,
                    content: getContent,
                    animation: false,
                    trigger: 'click',
                    placement: function (tip, element) {
                        var off = $(element).offset(),
                            width = $('body').width() / 2;
                        return off.left > width ? 'left' : 'right';
                    }
                })
            );

            function getContent() {
                // hard coded for demo purposes
                var div = $('<div>');
                _(zones).each(function (zone) {
                    // must use outer DIV with "clear: both" here for proper layout in firefox
                    div.append($('<div>').addClass('clear').append(
                        $('<span>').text(zone.displayName.replace(/^.*?\//, '')),
                        $('<b>').append($('<span>')
                            .addClass('label label-info')
                            .text(zone.getTTInfoLocal(data.start_date).abbr)),
                        $('<i>').text(that.getTimeInterval(data, zone))
                    ));
                });
                return '<div class="timezones">' + div.html() + '</div>';
            }

            return parent;
        },

        getShownAsClass: function (data) {
            return shownAsClass[(data.shown_as || 1) - 1];
        },

        getShownAsLabel: function (data) {
            return shownAsLabel[(data.shown_as || 1) - 1];
        },

        getShownAs: function (data) {
            return n_shownAs[(data.shown_as || 1) - 1];
        },

        getConfirmationSymbol: function (status) {
            return n_confirm[status || 0];
        },

        getConfirmationClass: function (status) {
            return confirmClass[status || 0];
        },

        isRecurring: function (data) {
            return !!data.recurrence_type;
        },

        getRecurrenceString: function (data) {
            function getCountString(i) {
                return n_count[i + 1];
            }

            function getDayString(i) {
                var tmp = [];
                switch (i) {
                case 62:
                    tmp.push(gettext("Work Day"));
                    break;
                case 65:
                    tmp.push(gettext("Weekend Day"));
                    break;
                case 127:
                    tmp.push(gettext("Day"));
                    break;
                default:
                    if ((i % MONDAY) / SUNDAY >= 1) {
                        tmp.push(gettext("Sunday"));
                    }
                    if ((i % THUESDAY) / MONDAY >= 1) {
                        tmp.push(gettext("Monday"));
                    }
                    if ((i % WEDNESDAY) / THUESDAY >= 1) {
                        tmp.push(gettext("Tuesday"));
                    }
                    if ((i % THURSDAY) / WEDNESDAY >= 1) {
                        tmp.push(gettext("Wednesday"));
                    }
                    if ((i % FRIDAY) / THURSDAY >= 1) {
                        tmp.push(gettext("Thursday"));
                    }
                    if ((i % SATURDAY) / FRIDAY >= 1) {
                        tmp.push(gettext("Friday"));
                    }
                    if (i / SATURDAY >= 1) {
                        tmp.push(gettext("Saturday"));
                    }
                }
                return tmp.join(", ");
            }

            function getMonthString(i) {
                return n_month[i];
            }

            var str = "", f = _.printf,
                interval = data.interval,
                days = data.days || null,
                month = data.month,
                day_in_month = data.day_in_month;

            switch (data.recurrence_type) {
            case 1:
                str = f(gettext("Each %s Day"), interval);
                break;
            case 2:
                str = interval === 1 ?
                    f(gettext("Weekly on %s"), getDayString(days)) :
                    f(gettext("Each %s weeks on %s"), interval, getDayString(days));
                break;
            case 3:
                if (days === null) {
                    str = interval === 1 ?
                        f(gettext("On %s. day every month"), day_in_month) :
                        f(gettext("On %s. day every %s. month"), day_in_month, interval);
                } else {
                    str = interval === 1 ?
                        f(gettext("On %s %s every month"), getCountString(day_in_month), getDayString(days)) :
                        f(gettext("On %s %s each %s. months"), getCountString(day_in_month), getDayString(days), interval);
                }
                break;
            case 4:
                if (days === null) {
                    str = f(gettext("Each %s. %s"), day_in_month, getMonthString(month));
                } else {
                    str = f(gettext("On %s %s in %s"), getCountString(day_in_month), getDayString(days), getMonthString(month));
                }
                break;
            }

            return str;
        },

        getNote: function (data) {
            return $.trim(data.note || "")
                .replace(/\n{3,}/g, "\n\n")
                .replace(/</g, "&lt;")
                .replace(/(https?\:\/\/\S+)/g, '<a href="$1" target="_blank">$1</a>');
        },

        getConfirmations: function (data) {
            var hash = {};
            // internal users
            _(data.users).each(function (obj) {
                hash[String(obj.id)] = {
                    status: obj.confirmation || 0,
                    comment: obj.confirmmessage || ""
                };
            });
            // external users
            _(data.confirmations).each(function (obj) {
                hash[obj.mail] = {
                    status: obj.status || 0,
                    comment: obj.confirmmessage || ""
                };
            });
            return hash;
        },

        // returns a set of rows, each containing 7 days
        // helps at drawing a mini calendar or a month view
        getMonthScaffold: function (year, month, forerun, overrun) {

            forerun = forerun || 0;
            overrun = overrun || 0;

            var firstDayOfMonth = Date.UTC(year, month, 1),
                // apply week day shift
                shift = (7 + (new date.Local(firstDayOfMonth)).getDay() - that.getFirstWeekDay()) % 7,
                day = firstDayOfMonth - DAY * shift,
                // loop
                rows = [], row, obj, d;

            function getMax() {
                // get number of days in month
                return that.getDaysInMonth(year, month) + shift;
            }

            function loop(max) {
                for (var i = 0; i < max || (i % 7 !== 0); i += 1, day += DAY) {
                    if (i % 7 === 0) {
                        row = [];
                        rows.push(row);
                    }
                    d = new date.Local(day);
                    row.push(obj = {
                        year: d.getYear(),
                        month: d.getMonth(),
                        date: d.getDate(),
                        day: d.getDay(),
                        timestamp: day,
                        isToday: that.isToday(day),
                        col: i % 7,
                        row: rows.length - 1
                    });
                    // is weekend?
                    obj.isWeekend = obj.day === 0 || obj.day === 6;
                    // is out of current month?
                    obj.isOut = obj.year !== year || obj.month !== month;
                }
            }

            // forerun?
            if (forerun > 0) {
                day -= forerun * WEEK;
                loop(forerun * 7);
            }

            loop(getMax());

            // overrun?
            if (overrun > 0) {
                loop(overrun * 7);
            }

            return rows;
        },

        getWeekStart: function (timestamp) {

            timestamp = ((timestamp || _.now()) / DAY >> 0) * DAY;

            var d = new date.Local(timestamp),
                // apply week day shift
                shift = (7 + d.getDay() - this.getFirstWeekDay()) % 7;

            return d.getTime() - DAY * shift;
        },

        getWeekScaffold: function (timestamp) {

            var day = this.getWeekStart(timestamp),
                i = 0, d, obj, days = [];

            for (; i < 7; i += 1, day += DAY) {
                d = new date.Local(day);
                days.push(obj = {
                    year: d.getYear(),
                    month: d.getMonth(),
                    date: d.getDate(),
                    day: d.getDay(),
                    timestamp: day,
                    isToday: that.isToday(day),
                    col: i % 7
                });
                // is weekend?
                obj.isWeekend = obj.day === 0 || obj.day === 6;
                obj.isFirst = d.getDate() === 1;
            }

            return days;
        }
    };

    return that;
});
