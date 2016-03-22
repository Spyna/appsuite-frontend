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
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */

define('io.ox/core/tk/mobiscroll',
    ['apps/3rd.party/mobiscroll/mobiscroll.js',
     'gettext!io.ox/core',
     'io.ox/core/date',
     'css!3rd.party/mobiscroll/css/mobiscroll.core.css',
     'css!3rd.party/mobiscroll/css/mobiscroll.ios7.css'
    ], function (mobi, gt, date) {

    'use strict';

    var settings = {};

    //put some defaults in to reduce code duplications
    if ($.mobiscroll) {
        var settings = {
            cancelText: gt('Cancel'),
            clearText: gt('Clear'),
            dateOrder: date.getFormat(date.DATE).replace(/\W/g, '').toLowerCase(),
            dateFormat: date.getFormat(date.DATE).replace(/\by\b/, 'yy').toLowerCase(),
            dayText: gt('Days'),
            display: 'bottom',
            endYear: new Date().getFullYear() + 100,
            hourText: gt('Hours'),
            minuteText: gt('Minutes'),
            monthNamesShort: date.locale.monthsShort,
            monthText: gt('Months'),
            preset: 'date',
            separator: ' ',
            setText: gt('Ok'),
            showLabel: true,
            theme: 'ios7',
            timeFormat: date.getFormat(date.TIME).replace(/m/g, 'i').replace(/a/g, 'A'),
            yearText: gt('Years')
        };
        settings.timeWheels = settings.timeFormat.replace(/\W/g, '');
        $.mobiscroll.setDefaults(settings);
    }

    return settings;
});
