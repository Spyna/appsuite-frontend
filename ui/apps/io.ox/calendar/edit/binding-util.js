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
 * @author Mario Scheliga <mario.scheliga@open-xchange.com>
 */

define('io.ox/calendar/edit/binding-util',
      ['io.ox/core/date'], function (dateAPI) {
    'use strict';

    var BinderUtils = {
        convertDate: function (direction, value, attribute, model) {
            if (direction === 'ModelToView') {
                console.log('ModelToView');
                console.log(model);
                console.log(value);
                if (!value) {
                    console.log('no value');
                    return null;
                }
                if (!_.isNumber(value)) {
                    console.log('no number');
                    return value; //do nothing
                }
                var formated = new dateAPI.Local(parseInt(value, 10)).format(dateAPI.locale.date);
                return formated;
            } else {
                var mydate = new dateAPI.Local(parseInt(model.get(attribute), 10));
                var parsedDate = dateAPI.Local.parse(value, dateAPI.locale.date);

                if (_.isNull(parsedDate)) {
                    console.log('unparseable date');
                    return value;
                }

                // just reject the change, if it's not parsable
                if (parsedDate.getTime() === 0) {
                    return model.get(attribute);
                }

                mydate.setDate(parsedDate.getDate());
                mydate.setMonth(parsedDate.getMonth());
                mydate.setYear(parsedDate.getYear());

                return mydate.getTime();
            }
        },
        convertTime: function (direction, value, attribute, model) {
            if (direction === 'ModelToView') {
                if (!value) {
                    return null;
                }
                console.log('show time:');
                console.log(value);
                return new dateAPI.Local(parseInt(value, 10)).format(dateAPI.locale.time);
            } else {
                var mydate = new dateAPI.Local(parseInt(model.get(attribute), 10));
                var parsedDate = dateAPI.Local.parse(value, dateAPI.locale.time);


                if (_.isNull(parsedDate)) {
                    console.log('unparseable time');
                    return mydate.getTime();
                }


                if (parsedDate.getTime() === 0) {
                    return model.get(attribute);
                }

                mydate.setHours(parsedDate.getHours());
                mydate.setMinutes(parsedDate.getMinutes());
                mydate.setSeconds(parsedDate.getSeconds());

                return mydate.getTime();
            }
        },
        numToString: function (direction, value, attribute, model) {
            console.log('numToString');
            console.log(value + '(' + (typeof value) + ')');
            if (direction === 'ModelToView') {
                console.log('modeltoview?');
                return value + '';
            } else {
                console.log('HERE');
                return parseInt(value, 10);
            }
        }

    };

    return BinderUtils;

});
