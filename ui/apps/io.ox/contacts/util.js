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

define('io.ox/contacts/util', [
    'io.ox/core/util',
    'io.ox/core/extensions',
    'settings!io.ox/contacts',
    'gettext!io.ox/contacts'
], function (util, ext, settings, gt) {

    'use strict';

    require(['settings!io.ox/contacts']).then(function (settings) {
        if (!settings.get('showDepartment')) return;

        $('html').addClass('showDepartment');
        ext.point('io.ox/core/person').extend({
            index: 'last',
            id: 'department',
            draw: function (baton) {
                if (baton.data.folder_id === 6 &&
                    !!baton.data.department
                ) {
                    this.append(
                        $('<span class="department">').text(gt.format(' (%1$s) ', baton.data.department))
                    );
                }
            }
        });
    });

    /**
     * Creates a result for get*Format functions which consists of a single
     * value.
     * @param {number} index The 1-based index of the value.
     * @param {String} value The value to return.
     * @type { format: string, params: [string] }
     * @result The result object for a get*Format function.
     */
    function single(index, value) {
        var params = new Array(index);
        params[index - 1] = value;
        return { format: '%' + index + '$s', params: params };
    }

    // vanity fix
    function getTitle(field) {
        return (/^(<span class="title">)?(dr\.?|prof\.?)/i).test(field) ? field : '';
    }

    //helper function for birthdays without year
    //calculates the difference between gregorian and julian calendar
    function calculateDayDifference(time) {
        var myDay = moment.utc(time).local(true),
            century, tempA, tempB;
        if (myDay.month() < 2) {
            century = Math.floor((myDay.year() - 1) / 100);
        } else {
            century = Math.floor(myDay.year() / 100);
        }
        tempA = Math.floor(century / 4);
        tempB = century % 4;

        // multiply result with milliseconds of a day - 86400000
        return Math.abs((3 * tempA + tempB - 2) * 864e5);

    }

    function getFullNameFormatHelper(obj, isMail, htmlOutput) {
        var copy = obj;
        if (htmlOutput === true) {
            copy = {};
            _(['title', 'first_name', 'last_name', 'display_name', 'cn']).each(function (id) {
                if (!$.trim(obj[id])) return;
                var tagName = id === 'last_name' ? 'strong' : 'span';
                copy[id] = '<' + tagName + ' class="' + id + '">' + _.escape(obj[id]) + '</' + tagName + '>';
            });
        }
        return isMail ? that.getMailFullNameFormat(obj) : that.getFullNameFormat(copy);
    }

    var that = {

        // variant of getFullName without title, all lowercase
        getSortName: function (obj) {
            // use a copy without title
            obj = _.pick(obj, 'first_name', 'last_name', 'display_name', 'cn');
            return this.getFullName(obj).toLowerCase();
        },

        /**
         * Computes the format of a displayed full name.
         * @param obj {Object} A contact object.
         * @type {
         *     format: string,
         *     params: [first_name, last_name, title, display_name, cn]
         * }
         * @returns An object with a format
         * string and an array of replacements which can be used e.g. as
         * parameters to gettext.format to obtain the full name.
         */
        getFullNameFormat: function (obj) {

            var first_name = $.trim(obj.first_name),
                last_name = $.trim(obj.last_name),
                display_name = $.trim(obj.display_name || obj.cn),
                title = $.trim(obj.title);

            // combine title, last_name, and first_name
            if (first_name && last_name) {

                var preference = settings.get('fullNameFormat', 'auto'),
                    params = [first_name, last_name],
                    format;

                title = getTitle(title);
                if (title) params.push(title);

                if (preference === 'firstname lastname') {
                    format = title ? '%3$s %1$s %2$s' : '%1$s %2$s';
                } else if (preference === 'lastname, firstname') {
                    format = title ? '%3$s %2$s, %1$s' : '%2$s, %1$s';
                } else {
                    // auto/fallback
                    format = title ?
                        //#. Name with title
                        //#. %1$s is the first name
                        //#. %2$s is the last name
                        //#. %3$s is the title
                        gt('%3$s %2$s, %1$s') :
                        //#. Name without title
                        //#. %1$s is the first name
                        //#. %2$s is the last name
                        gt('%2$s, %1$s');
                }

                return { format: format, params: params };
            }

            // we need last_name and first_name ahead of display_name,
            // for example, to keep furigana support

            // fallback #1: just last_name
            if (last_name) return single(2, last_name);

            // fallback #2: just first_name
            if (first_name) return single(1, first_name);

            // fallback #3: use existing display name?
            if (display_name) return single(4, util.unescapeDisplayName(display_name));

            return { format: '', params: [] };
        },

        getFullName: function (obj, htmlOutput) {
            var fmt = getFullNameFormatHelper(obj, false, htmlOutput);
            return gt.format(fmt.format, fmt.params);
        },

        getDisplayName: function (obj) {
            // use existing display name?
            if (obj.display_name) {
                return util.unescapeDisplayName(obj.display_name);
            }
            // combine last_name, and first_name
            if (obj.last_name && obj.first_name) {
                return obj.last_name + ', ' + obj.first_name;
            }
            // fallback
            return obj.last_name || obj.first_name || '';
        },

        /**
         * compute the format of a full name in mail context
         *
         * In mail context (and may be others), the full name is formated a
         * little different than in address book.
         *
         * @param obj {Object} a contact object with at least the attributes
         *      related to the name set
         *
         * @returns An object with a format
         * string and an array of replacements which can be used e.g. as
         * parameters to gettext.format to obtain the full name.
         */
        getMailFullNameFormat: function (obj) {
            var first_name = $.trim(obj.first_name),
                last_name = $.trim(obj.last_name),
                display_name = $.trim(obj.display_name);

            // combine first name and last name
            if (last_name && first_name) {
                return {
                    format:
                        //#. Name in mail addresses
                        //#. %1$s is the first name
                        //#. %2$s is the last name
                        gt.pgettext('mail address', '%1$s %2$s'),
                    params: [first_name, last_name]
                };
            }

            // we need last_name and first_name ahead of display_name,
            // for example, to keep furigana support.
            // and this should be same order as getFullNameFormat()

            // fallback #1: just last_name
            if (last_name) return single(2, last_name);

            // fallback #2: just first_name
            if (first_name) return single(1, first_name);

            // fallback #3: use existing display name?
            if (display_name) {
                return single(4, util.unescapeDisplayName(display_name));
            }

            return { format: '', params: [] };
        },

        getMailFullName: function (obj, htmlOutput) {
            var fmt = getFullNameFormatHelper(obj, true, htmlOutput);
            return gt.format(fmt.format, fmt.params);
        },

        /**
         * Returns the mail as a format object similar to getFullnameFormat.
         * @param obj {Object} A contact object.
         * @type {
         *     format: string,
         *     params: [email1, email2, email3]
         * }
         * @returns An object with a format
         * string and an array of replacements which can be used e.g. as
         * parameters to gettext.format to obtain the full name.
         */
        getMailFormat: function (obj) {
            if (obj.email1) return single(1, obj.email1);
            if (obj.email2) return single(2, obj.email2);
            if (obj.email3) return single(3, obj.email3);
            return { format: '', params: [] };
        },

        getMail: function (obj) {
            // get the first mail address
            return obj ? (obj.email1 || obj.email2 || obj.email3 || obj.mail || '').trim().toLowerCase() : '';
        },

        getJob: function (obj) {
            // combine position and company
            var list = _([obj.company, obj.position]).compact();
            return list.length ? list.join(', ') : (obj.email1 || obj.email2 || obj.email3 || '');
        },

        nameSort: function (a, b) {
            var nameA, nameB;
            if (a.display_name === undefined) {
                nameA = a.mail;
            } else {
                nameA = a.display_name.toLowerCase();
            }

            if (b.display_name === undefined) {
                nameB = b.mail;
            } else {
                nameB = b.display_name.toLowerCase();
            }

            if (nameA < nameB) {
                return -1;
            }
            if (nameA > nameB) {
                return 1;
            }
            return 0;
        },

        calcMailField: function (contact, selectedMail) {
            var field, mail;
            mail = [contact.email1, contact.email2, contact.email3];
            _.each(mail, function (val, key) {
                if (selectedMail === val) {
                    field = key + 1;
                }
            });
            return field;
        },

        //used to change birthdays without year(we save them as year 1) from gregorian to julian calendar (year 1 is julian, current calendar is gregorian)
        gregorianToJulian: function (timestamp) {
            return moment.utc(timestamp - calculateDayDifference(timestamp)).valueOf();
        },

        //used to change birthdays without year(we save them as year 1) from julian to gregorian calendar (year 1 is julian, current calendar is gregorian)
        julianToGregorian: function (timestamp) {
            return moment.utc(timestamp + calculateDayDifference(timestamp)).valueOf();
        },

        // little helper to get birthdays
        // @birthday is either a timestamp or a momentjs instance
        getBirthday: function (birthday) {
            // ensure instance of moment
            birthday = moment.utc(birthday);
            // Year 1 and year 1604 are  special for birthdays without year
            // therefore, return full date if year is not 1
            if (birthday.year() > 1 && birthday.year() !== 1604) return birthday.format('l');
            // get localized format without the year otherwise
            // i.e. remove dashes and slashes but keep dots
            return birthday.format(
                moment.localeData().longDateFormat('l').replace(/[/-]*Y+[/-]*/, '')
            );
        },

        // @arg is either a string (image1_url) or an object with image1_url
        getImage: function (arg, options) {

            if (_.isObject(arg)) arg = arg.image1_url;
            if (!arg) return '';

            options = _.extend({ width: 40, height: 40, scaleType: 'cover' }, options);

            // use double size for retina displays
            if (_.device('retina')) {
                options.width *= 2;
                options.height *= 2;
            }

            var url = arg.replace(/^https?:\/\/[^/]+/i, '');
            url = util.replacePrefix(url);

            return util.getShardingRoot(url + '&' + $.param(options));
        },

        getInitials: (function () {

            var regFirst = /^.*?([a-z0-9\xC0-\xFF])/i,
                regLast = /\s.*?([a-z0-9\xC0-\xFF])\S*$/i;

            function first(str) {
                var match = regFirst.exec(str);
                return ((match && match[1]) || '');
            }

            function last(str) {
                var match = regLast.exec(str);
                return ((match && match[1]) || '');
            }

            function get(obj) {

                var first_name = $.trim(obj.first_name),
                    last_name = $.trim(obj.last_name),
                    display_name = $.trim(obj.display_name);

                // yep, both first()
                if (first_name && last_name) return first(first_name) + first(last_name);
                if (display_name) return first(display_name) + last(display_name);

                // again, first() only
                if (last_name) return first(last_name);
                if (first_name) return first(first_name);

                // try mail address
                var email = $.trim(obj.email1 || obj.email2 || obj.email3);
                if (email) return first(email);

                return '';
            }

            return function (obj) {
                return get(obj).toUpperCase();
            };
        }()),

        getInitialsColor: (function () {

            var colors = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'],
                modulo = colors.length;

            return function (initials) {
                if (!initials) return 'gray';
                return colors[initials[0].charCodeAt() % modulo];
            };
        }())
    };

    return that;
});
