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

define('io.ox/core/tk/reminder-util', [
    'gettext!io.ox/core',
    'io.ox/calendar/util',
    'less!io.ox/core/tk/reminder-util'
], function (gt, util) {

    'use strict';

    function buildActions(node, values) {
        if (_.device('medium')) {
            //native style for tablet
            node.append(
                    $('<div>').text(gt('Remind me again')),
                    $('<select tabindex="1" class="dateselect" data-action="selector">').append(function () {
                        var ret = '<option value="0">' + gt('Pick a time here') + '</option>';
                        for (var i = 0; i < values.length; i++) {
                            ret += '<option value="' + values[i][0] + '">' + values[i][1] + '</option>';
                        }
                        return ret;
                    }),
                    $('<button type="button" tabindex="1" class="btn btn-primary btn-sm remindOkBtn" data-action="ok">').text(gt('OK')).attr('aria-label', gt('Close this reminder'))
                );
        } else {
            // special link dropdown
            var toggle, menu,
                // super special function to have overflow scroll and dropdowns as popups see Bug 40962 and https://github.com/twbs/bootstrap/issues/7160
                dropDownFixPosition = function (button, dropdown) {
                var dropDownTop = button.offset().top + button.outerHeight();
                dropdown.css('top', dropDownTop + 'px');
                dropdown.css('left', button.offset().left + 'px');
            };

            node.append(
                $('<div>').addClass('dropdown').css({ 'float': 'left' }).append(
                    toggle = $('<a role="menuitem" tabindex="1" data-action="remind-again">')
                    .attr({
                        'data-toggle': 'dropdown',
                        'aria-haspopup': 'true'
                    })
                    .text(gt('Remind me again')).addClass('refocus')
                    .append(
                        $('<i class="fa fa-chevron-down">').css({ paddingLeft: '5px', textDecoration: 'none' })
                    ),
                    menu = $('<ul role="menu">').addClass('dropdown-menu dropdown-left').css({ minWidth: 'auto', position: 'fixed' }).append(function () {
                        var ret = [];
                        for (var i = 0; i < values.length; i++) {
                            ret.push('<li role="presentation"><a  tabindex="1" role="menuitem" aria-label="' + gt('Remind me again ') + values[i][1] + '" href="#" data-action="reminder" data-value="' + values[i][0] + '">' + values[i][1] + '</a></li>');
                        }
                        return ret;
                    })
                ),
                $('<button type="button" tabindex="1" class="btn btn-primary btn-sm remindOkBtn" data-action="ok">').text(gt('OK'))
                    .attr('aria-label', gt('Close this reminder'))
            ).find('after').css('clear', 'both');
            toggle.dropdown();

            $(toggle).click(function () {
                dropDownFixPosition(toggle, menu);
                // close on scroll
                $('#io-ox-notifications').one('scroll', function () {
                    toggle.dropdown('toggle');
                });
            });
        }
    }

    var draw = function (node, model, options, taskMode) {
        var info,
            //aria label
            label,
            descriptionId = _.uniqueId('notification-description-'),
            actions = $('<div class="reminder-actions">');

        //find out remindertype
        if (taskMode) {
            //task
            info = [
                $('<span class="sr-only" aria-hiden="true">').text(gt('Press [enter] to open')).attr('id', descriptionId),
                $('<span class="span-to-div title">').text(_.noI18n(model.get('title'))),
                $('<span class="span-to-div info-wrapper">').append($('<span class="end_date">').text(_.noI18n(model.get('end_time'))),
                $('<span class="status pull-right">').text(model.get('status')).addClass(model.get('badge')))
            ];
            var endText = '',
                statusText = '';
            if (_.noI18n(model.get('end_time'))) {
                endText = gt('end date ') + _.noI18n(model.get('end_time'));
            }
            if (_.noI18n(model.get('status'))) {
                statusText = gt('status ') + _.noI18n(model.get('status'));
            }
            //#. %1$s task title
            //#. %2$s task end date
            //#. %3$s task status
            //#, c-format
            label = gt('%1$s %2$s %3$s.', _.noI18n(model.get('title')), endText, statusText);
        } else {
            //appointment
            info = [
                $('<span class="sr-only" aria-hiden="true">').text(gt('Press [enter] to open')).attr('id', descriptionId),
                $('<span class="span-to-div time">').text(util.getTimeInterval(model.attributes)),
                $('<span class="span-to-div date">').text(util.getDateInterval(model.attributes)),
                $('<span class="span-to-div title">').text(model.get('title')),
                $('<span class="span-to-div location">').text(model.get('location'))
            ];
            //#. %1$s Appointment title
            //#. %2$s Appointment date
            //#. %3$s Appointment time
            //#. %4$s Appointment location
            //#, c-format
            label = gt('%1$s %2$s %3$s %4$s.',
                    _.noI18n(model.get('title')), _.noI18n(util.getDateIntervalA11y(model.attributes)), _.noI18n(util.getTimeIntervalA11y(model.attributes)), _.noI18n(model.get('location')) || '');
        }

        node.attr({
            'data-cid': model.get('cid'),
            'model-cid': model.cid,
            'aria-label': label,
            'aria-describedby': descriptionId,
            role: 'listitem',
            'tabindex': 1
        }).addClass('reminder-item clearfix');
        buildActions(actions, options);

        node.append(info, actions);
    };

    return { draw: draw };
});
