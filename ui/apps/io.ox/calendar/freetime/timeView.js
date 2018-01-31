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

define('io.ox/calendar/freetime/timeView', [
    'io.ox/backbone/disposable',
    'io.ox/core/extensions',
    'gettext!io.ox/calendar',
    'io.ox/calendar/api',
    'io.ox/backbone/mini-views/dropdown',
    'settings!io.ox/calendar',
    'io.ox/calendar/util',
    'io.ox/backbone/views/datepicker'
], function (DisposableView, ext, gt, api, Dropdown, settings, util, DatePicker) {

    'use strict';

    var pointHeader = ext.point('io.ox/calendar/freetime/time-view-header'),
        pointBody = ext.point('io.ox/calendar/freetime/time-view-body'),
        availabilityClasses = {
            'OPAQUE': 'reserved',
            'TRANSPARENT': 'free'
        },
        zIndexbase = {
            free: 0,
            reserved: 1000
        };

    // header
    pointHeader.extend({
        id: 'toolbar',
        index: 100,
        draw: function (baton) {
            var info  = $('<a href="#" class="info">').on('click', $.preventDefault).attr({
                    'aria-label': gt('Use cursor keys to change the date. Press ctrl-key at the same time to change year or shift-key to change month. Close date-picker by pressing ESC key.')
                }),
                fillInfo = function () {
                    info.empty().append(
                        $('<span>').text(
                            baton.model.get('currentWeek').formatInterval(moment(baton.model.get('currentWeek')).add(6, 'days'))
                        ),
                        $.txt(' '),
                        $('<span class="cw">').text(
                            //#. %1$d = Calendar week
                            gt('CW %1$d', moment(baton.model.get('currentWeek')).isoWeek())
                        ),
                        $('<i class="fa fa-caret-down fa-fw" aria-hidden="true">')
                    );
                };

            fillInfo();
            baton.model.on('change:currentWeek', fillInfo);

            // append datepicker
            new DatePicker({ parent: this.closest('.modal,#io-ox-core') })
                .attachTo(info)
                .on('select', function (date) {
                    baton.view.setDate(date.valueOf());
                })
                .on('before:open', function () {
                    this.setDate(baton.model.get('currentWeek'));
                });

            this.append(
                $('<span class="controls-container">').append(
                    $('<a href="#" role="button" class="control prev">').attr({
                        title: gt('Previous Day'),
                        'aria-label': gt('Previous Day')
                    })
                    .append($('<i class="fa fa-chevron-left" aria-hidden="true">')),
                    $('<a href="#" role="button" class="control next">').attr({
                        title: gt('Next Day'),
                        'aria-label': gt('Next Day')
                    })
                    .append($('<i class="fa fa-chevron-right" aria-hidden="true">'))
                ),
                info
            );
        }
    });

    pointHeader.extend({
        id: 'options',
        index: 200,
        draw: function (baton) {
            var dropdown = new Dropdown({ keep: true, caret: true, model: baton.model, label: gt('Options'), tagName: 'span' })
                .header(gt('Zoom'))
                .option('zoom', '100', '100%', { radio: true })
                .option('zoom', '200', '200%', { radio: true })
                .option('zoom', '400', '400%', { radio: true })
                .option('zoom', '1000', '1000%', { radio: true })
                .divider()
                .header(gt('Rows'))
                .option('compact', true, gt('Compact'))
                .option('showFineGrid', true, gt('Show fine grid'))
                .divider()
                .header(gt('Appointment types'))
                .option('showFree', true, gt('Free'))
                .option('showReserved', true, gt('Reserved'))
                .divider()
                .option('onlyWorkingHours', true, gt('Hide non-working time'));

            baton.view.headerNodeRow1.append(
                // pull right class needed for correct dropdown placement
                dropdown.render().$el.addClass('options pull-right').attr('data-dropdown', 'options')
            );
        }
    });

    // timeline
    pointHeader.extend({
        id: 'timeline',
        index: 300,
        draw: function (baton) {
            var day = moment(baton.model.get('currentWeek')).startOf('day'),
                today = moment().startOf('day'),
                node;
            baton.view.headerNodeRow2.append(node = $('<div class="freetime-timeline">'));
            for (var counter = 0; counter < 7; counter++) {
                var time = moment().startOf('hour'),
                    worktimeStart = parseInt(settings.get('startTime', 8), 10),
                    worktimeEnd = parseInt(settings.get('endTime', 18), 10),
                    start = baton.model.get('onlyWorkingHours') ? baton.model.get('startHour') : 0,
                    end = baton.model.get('onlyWorkingHours') ? baton.model.get('endHour') : 23,
                    sections = [],
                    dayLabel = $('<div class="day-label-wrapper">').append($('<div class="day-label">').addClass(day.day() === 0 || day.day() === 6 ? 'weekend' : '').text(day.format('ddd, ll'))),
                    dayNode;

                node.append($('<div class=timeline-day>').addClass(today.valueOf() === day.valueOf() ? 'today' : '').append(
                    $('<div class="daylabel-container">').addClass(counter === 0 ? 'first' : '').append(
                        dayLabel,
                        dayLabel.clone().addClass('level-2'),
                        dayLabel.clone().addClass('level-1'),
                        dayLabel.clone().addClass('level-2')
                    ),
                    dayNode = $('<div class="day-hours">')));

                for (var i = start; i <= end; i++) {
                    time.hours(i);
                    var timeformat = time.format('LT').replace('AM', 'a').replace('PM', 'p');
                    sections.push($('<span class="freetime-hour">').text(timeformat).val(counter * (end - start + 1) + (baton.model.get('onlyWorkingHours') ? i - baton.model.get('startHour') : i))
                        .addClass(i === start ? 'day-start' : '')
                        .addClass(i === start && counter === 0 ? 'first' : '')
                        .addClass(i === worktimeEnd || i === worktimeStart ? 'working-hour-start-end' : ''));
                }
                dayNode.append(sections);
                day.add(1, 'days');
            }
            baton.model.on('change:currentWeek', function () {
                var labels = node.find('.timeline-day'),
                    day = moment(baton.model.get('currentWeek')).startOf('day'),
                    today = moment().startOf('day');

                for (var i = 0; i <= labels.length; i++) {
                    $(labels[i]).toggleClass('today', day.valueOf() === today.valueOf()).find('.day-label').text(day.format('ddd, ll'));
                    day.add(1, 'days');
                }
            });
        }
    });

    // timetable
    pointBody.extend({
        id: 'timetable',
        index: 100,
        draw: function (baton) {
            var node, table, width,
                worktimeStart = parseInt(settings.get('startTime', 8), 10),
                worktimeEnd = parseInt(settings.get('endTime', 18), 10),
                start = baton.model.get('onlyWorkingHours') ? baton.model.get('startHour') : 0,
                end = baton.model.get('onlyWorkingHours') ? baton.model.get('endHour') : 23,
                time = moment(baton.model.get('currentWeek')).startOf('day'),
                today = moment().startOf('day');

            today.hours(start);

            this.append(table = $('<div class="freetime-table" draggable="false">').append(node = $('<div class="freetime-time-table">')));

            for (var counter = 0; counter < 7; counter++) {
                var cells = [];

                for (var i = start; i <= end; i++) {
                    time.hours(i);
                    cells.push($('<span class="freetime-table-cell">').val(counter * (end - start + 1) + (baton.model.get('onlyWorkingHours') ? i - baton.model.get('startHour') : i))
                               .addClass(i === worktimeEnd || i === worktimeStart ? 'working-hour-start-end' : '')
                               .addClass(i === start ? 'day-start' : '')
                               .addClass(time.valueOf() === today.valueOf() ? 'today' : '')
                               .addClass(i === start && counter === 0 ? 'first' : '')
                               .addClass(i <= baton.model.get('startHour') || i >= baton.model.get('endHour') ? 'non-working-hour' : ''));
                }
                node.append(cells);
                time.add(1, 'days');
            }
            width = node.children().length * 60 * (parseInt(baton.model.get('zoom'), 10) / 100);
            table.css('width', width + 'px');
            if (baton.view.keepScrollpos === 'today') {
                if (baton.view.headerNodeRow2.find('.today').length) {
                    var hours = (baton.model.get('onlyWorkingHours') ? baton.model.get('startHour') : 0);
                    baton.view.keepScrollpos = moment().hours(hours).startOf('hour').valueOf();
                } else {
                    delete baton.view.keepScrollpos;
                }
            }
            if (baton.view.keepScrollpos) {
                var scrollpos = baton.view.timeToPosition(baton.view.keepScrollpos) / 100 * width;
                table.parent().scrollLeft(scrollpos);
                if (baton.view.center) {
                    table.parent().scrollLeft(scrollpos - this.width() / 2);
                    if (!baton.view.popupClosed) delete baton.view.center;
                }
                if (!baton.view.popupClosed) delete baton.view.keepScrollpos;
            }
            // participantsview and timeview must be the same height or they scroll out off sync (happens when timeview has scrollbars)
            // use margin so resize event does not change things
            baton.view.parentView.participantsSubview.bodyNode.css('margin-bottom', baton.view.bodyNode[0].offsetHeight - baton.view.bodyNode[0].clientHeight + 'px');
        }
    });

    // lasso
    pointBody.extend({
        id: 'lasso',
        index: 200,
        draw: function (baton) {
            var table = this.find('.freetime-table');
            if (!baton.view.lassoNode) {
                baton.view.lassoNode = $('<div class="freetime-lasso" draggable="false">').hide();
            }
            table.append(baton.view.lassoNode);
            // update lasso status
            baton.view.updateLasso();
        }
    });

    // appointments
    pointBody.extend({
        id: 'appointments',
        index: 300,
        draw: function (baton) {
            var table = $('<div class="appointments">').appendTo(this.find('.freetime-table')),
                tooltipContainer = baton.view.headerNodeRow1.parent().parent().parent();

            _(baton.model.get('attendees').models).each(function (attendee) {
                var attendeeTable = $('<div class="appointment-table">').attr('data-value', attendee.get('entity')).appendTo(table);

                _(baton.model.get('appointments')[attendee.get('entity')]).each(function (appointment, index) {
                    var start = moment.tz(appointment.startDate.value, appointment.startDate.tzid).valueOf(),
                        end = moment.tz(appointment.endDate.value, appointment.endDate.tzid).valueOf();

                    var left = baton.view.timeToPosition(start),
                        right = 100 - baton.view.timeToPosition(end),
                        appointmentNode = $('<div class="appointment" draggable="false">')
                            .addClass(availabilityClasses[appointment.transp])
                            .css({ left: left + '%', right: right + '%' });

                    // appointment has a width of 0 it doesn't need to be drawn (happens if appointment is in non-working-times and the option to display them is deactivated)
                    if (100 - left - right === 0) {
                        return;
                    }
                    appointmentNode.css('z-index', 1 + zIndexbase[availabilityClasses[appointment.transp]] + index + (util.isAllday(appointment) ? 0 : 2000));

                    if (appointment.summary) {
                        appointmentNode.addClass(100 - right - left < baton.view.grid * 4 ? 'under-one-hour' : '').append(
                            $('<div class="title">').text(appointment.summary).append(
                                $('<span class="appointment-time">').text(util.getTimeInterval(appointment))
                            )
                        )
                        .attr({
                            title: appointment.summary + (appointment.location ? ' ' + appointment.location : ''),
                            'aria-label': appointment.summary,
                            'data-toggle': 'tooltip'
                        }).tooltip({ container: tooltipContainer });
                    }
                    if (appointment.location && appointment.location !== '') {
                        appointmentNode.addClass('has-location').append($('<div class="location">').text(appointment.location));
                    }

                    if (baton.view.parentView.options.isApp && (appointment.folder || settings.get('freeBusyStrict', true) === false)) {
                        appointmentNode.addClass('has-detailview').on('click', function (e) {
                            //don't open if this was a lasso drag
                            if (baton.view.lassoEnd === baton.view.lassoStart) {
                                require(['io.ox/core/tk/dialogs', 'io.ox/calendar/view-detail'], function (dialogs, detailView) {
                                    new dialogs.SidePopup({ tabTrap: true }).show(e, function (popup) {
                                        if (appointment.folder_id === undefined) {
                                            popup.append(detailView.draw(appointment));
                                            return;
                                        }
                                        popup.busy();
                                        var dialog = this;
                                        api.get(appointment).then(
                                            function (data) {
                                                popup.idle().append(detailView.draw(data));
                                            },
                                            function (error) {
                                                dialog.close();
                                                require(['io.ox/core/yell'], function (yell) {
                                                    yell(error);
                                                });
                                            }
                                        );
                                    });
                                });
                            }
                        });
                    }
                    attendeeTable.append(appointmentNode);
                });
            });
            // timeviewbody and header must be the same width or they scroll out off sync (happens when timeviewbody has scrollbars)
            // use margin so resize event does not change things
            baton.view.headerNodeRow2.css('margin-right', baton.view.bodyNode[0].offsetWidth - baton.view.bodyNode[0].clientWidth - 1 + 'px');
        }
    });

    // current time indicator
    pointBody.extend({
        id: 'currentime',
        index: 400,
        draw: function (baton) {
            var table = this.find('.freetime-table'),
                setTime = function () {
                    var pos = baton.view.timeToPosition(_.now());
                    // hide if pos is 0 or 100 -> current time is in week before or after the displayed week
                    baton.view.currentTimeNode.css('left', pos + '%').toggle(pos !== 0 && pos !== 100);
                };

            if (!baton.view.currentTimeNode) {
                baton.view.currentTimeNode = $('<div class="current-time" draggable="false">');
                var timer = setInterval(setTime, 30000);
                baton.view.on('dispose', function () {
                    clearInterval(timer);
                });
            }

            setTime();
            table.append(baton.view.currentTimeNode);
        }
    });

    //
    // timeview. Subview of freetimeview to show the current day and the participants appointments
    //

    return DisposableView.extend({

        className: 'freetime-time-view',

        initialize: function (options) {
            var self = this;

            this.pointHeader = pointHeader;
            this.pointBody = pointBody;
            this.headerNodeRow1 = $('<div class="freetime-time-view-header row1">')
                .on('click', '.control.next,.control.prev,.control.today', self.onControlView.bind(this));
            this.headerNodeRow2 = $('<div class="freetime-time-view-header row2">')
                .on('click', '.freetime-hour', self.onSelectHour.bind(this));
            this.bodyNode = $('<div class="freetime-time-view-body">')
                .on('mousedown', '.freetime-table', self.onMouseDown.bind(this))
                .on('mouseup', '.freetime-table', self.onMouseUp.bind(this))
                .on('mousemove', '.freetime-table', self.onMouseMove.bind(this))
                .on('dblclick', '.freetime-table-cell', self.onSelectHour.bind(this))
                .on('scroll', self.onScroll.bind(this));

            // add some listeners
            this.model.get('attendees').on('add reset', self.getAppointments.bind(this));
            // no need to fire a server request when removing a participant
            this.model.get('attendees').on('remove', self.removeParticipant.bind(this));
            this.model.on('change:onlyWorkingHours', self.onChangeWorkingHours.bind(this));
            this.model.on('change:currentWeek', self.getAppointmentsInstant.bind(this));
            this.model.on('change:appointments', self.renderBody.bind(this));
            this.model.on('change:zoom', self.updateZoom.bind(this));
            this.model.on('change:showFree change:showTemporary change:showReserved change:showAbsent', self.updateVisibility.bind(this));

            this.parentView = options.parentView;

            if (this.parentView.options.popup) {
                this.popupClosed = true;
                this.parentView.options.popup.on('open', function () {
                    self.popupClosed = false;
                    self.renderBody();
                });
            }

            // calculate 15min grid for lasso
            this.grid = 100 / ((this.model.get('onlyWorkingHours') ? (this.model.get('endHour') - this.model.get('startHour') + 1) : 24) * 28);

            // preselect lasso
            if (options.parentModel && options.parentModel.get('startDate') !== undefined && options.parentModel.get('endDate') !== undefined) {
                var start = moment.tz(options.parentModel.get('startDate').value, options.parentModel.get('startDate').tzid).valueOf(),
                    end = moment.tz(options.parentModel.get('endDate').value, options.parentModel.get('endDate').tzid).valueOf();
                this.lassoStart = this.timeToPosition(start);
                this.lassoEnd = this.timeToPosition(end);
                this.keepScrollpos = start;
                this.center = true;
            }

            // must use start of week. Otherwise we get the wrong iso week in countries where the first day of the week is a sunday
            if (!options.parentModel && moment().startOf('week').isoWeek() === this.model.get('currentWeek').isoWeek()) {
                // special scrollposition on start
                this.keepScrollpos = 'today';
            }
            this.updateVisibility();
        },

        updateZoom: function () {
            var table = this.bodyNode.find('.freetime-table');
            if (table.length) {
                var nodes = table.find('.freetime-time-table').children().length,
                    oldWidth = table.width(),
                    oldScrollPos = table.parent().scrollLeft(),
                    newWidth = nodes * 60 * (parseInt(this.model.get('zoom'), 10) / 100);

                table.css('width', newWidth + 'px').parent().scrollLeft((oldScrollPos / oldWidth) * newWidth);
            }
        },
        updateVisibility: function () {
            this.bodyNode.toggleClass('showFree', this.model.get('showFree'))
                .toggleClass('showTemporary', this.model.get('showTemporary'))
                .toggleClass('showReserved', this.model.get('showReserved'))
                .toggleClass('showAbsent', this.model.get('showAbsent'));
        },
        onScroll: function () {
            this.headerNodeRow2.scrollLeft(this.bodyNode.scrollLeft());
        },

        onChangeWorkingHours: function () {
            this.grid = 100 / ((this.model.get('onlyWorkingHours') ? (this.model.get('endHour') - this.model.get('startHour') + 1) : 24) * 28);
            // correct lasso positions
            // use time based lasso positions to calculate because they is unaffected by display changes
            if (this.lassoNode && this.lassoStart) {
                this.lassoStart = this.timeToPosition(this.lassoStartTime);
                this.lassoEnd = this.timeToPosition(this.lassoEndTime);
                this.updateLasso();
            }

            var table = this.bodyNode.find('.freetime-table');
            if (table.length) {
                var oldWidth = table.width(),
                    oldScrollPos = table.parent().scrollLeft();
                this.keepScrollpos = this.positionToTime(oldScrollPos / oldWidth * 100, true);
            }

            this.renderHeader(true);
            this.getAppointmentsInstant();
        },

        renderHeader: function (onlyTimeline) {
            var baton = new ext.Baton({ view: this, model: this.model });
            this.headerNodeRow2.empty();
            if (onlyTimeline) {
                _(this.pointHeader.list()).findWhere({ id: 'timeline' }).invoke('draw', this.headerNodeRow1, baton);
            } else {
                this.headerNodeRow1.empty();
                this.pointHeader.invoke('draw', this.headerNodeRow1, baton);
            }
        },

        renderBody: function () {
            if (this.model.get('attendees').length !== _(this.model.get('appointments')).keys().length) {
                this.getAppointmentsInstant();
            } else {
                var baton = new ext.Baton({ view: this, model: this.model });
                this.bodyNode.empty();
                this.pointBody.invoke('draw', this.bodyNode, baton);
            }
        },

        // use debounce because participants can change rapidly if groups or distributionlists are resolved
        getAppointments: _.debounce(function () { this.getAppointmentsInstant(true); }, 10),

        getAppointmentsInstant: function (addOnly) {
            // save scrollposition or it is lost when the busy animation is shown
            var oldWidth = this.bodyNode.find('.freetime-table').width(),
                oldScrollPos = this.bodyNode.scrollLeft();
            if (!this.keepScrollpos && oldWidth) {
                this.keepScrollpos = this.positionToTime(oldScrollPos / oldWidth * 100);
            }
            // render busy animation
            this.bodyNode.busy(true);
            // get fresh appointments
            var self = this,
                from,
                until,
                attendees = attendees = this.model.get('attendees').toJSON(),
                appointments = {};

            if (attendees.length === 0) return $.when();

            // no need to get appointments for every participant all the time
            if (addOnly === true) {
                var keys = _(self.model.get('appointments')).keys();
                attendees = _(attendees).filter(function (attendee) {
                    return _(keys).indexOf(String(attendee.entity)) === -1;
                });
            }

            if (this.model.get('onlyWorkingHours')) {
                from = moment(this.model.get('currentWeek')).add(this.model.get('startHour'), 'hours');
                until = moment(from).add(6, 'days').add(this.model.get('endHour') - this.model.get('startHour'), 'hours');
            } else {
                from = moment(this.model.get('currentWeek')).startOf('day');
                until = moment(from).add(1, 'weeks');
            }
            return api.freebusy(attendees, { from: from.format(util.ZULU_FORMAT_DAY_ONLY), until: until.format(util.ZULU_FORMAT_DAY_ONLY) }).done(function (items) {
                if (items.length === 0) {
                    // remove busy animation again
                    self.bodyNode.idle();
                    require(['io.ox/core/yell'], function (yell) {
                        yell('error', gt('Could not get appointment information'));
                    });
                    return;
                }
                if (addOnly === true) {
                    appointments = self.model.get('appointments');
                }

                for (var i = 0; i < attendees.length; i++) {
                    // only events for now
                    appointments[attendees[i].entity] = _.compact(_(items[i].freeBusyTime).pluck('event'));
                }
                // remove busy animation again
                self.bodyNode.idle();
                // set appointments silent, force trigger to redraw correctly. (normal setting does not trigger correctly when just switching times)
                self.model.set('appointments', appointments, { silent: true }).trigger('change:appointments');
            });
        },

        removeParticipant: function (model) {
            var node = this.bodyNode.find('.appointment-table[data-value="' + model.get('entity') + '"]'),
                appointments = this.model.get('appointments');
            if (node.length) {
                node.remove();
                // timeviewbody and header must be the same width or they scroll out off sync (happens when timeviewbody has scrollbars)
                // use margin so resize event does not change things
                this.headerNodeRow2.css('margin-right', this.bodyNode[0].offsetWidth - this.bodyNode[0].clientWidth - 1 + 'px');
                // trigger scroll for lazyload
                this.parentView.participantsSubview.bodyNode.trigger('scroll');
            }
            delete appointments[model.get('id')];
            // silent or we would trigger a redraw
            this.model.set('appointments', appointments, { silent: true });
        },

        onSelectHour: function (e) {
            var index = parseInt($(e.target).val(), 10),
                width = 100 / (7 * (this.model.get('onlyWorkingHours') ? this.model.get('endHour') - this.model.get('startHour') + 1 : 24));
            this.lassoStart = index * width;
            this.lassoEnd = (index + 1) * width;
            this.updateLasso(true);
            if (e.altKey && this.lassoEnd && this.lassoStart && this.lassoStart !== this.lassoEnd) {
                this.parentView.save();
            }
        },

        // utility function to get the position in percent for a given time
        timeToPosition: function (timestamp) {
            var start = moment(this.model.get('currentWeek')).startOf('day'),
                end = moment(start).add(1, 'days'),
                day = 0,
                // if we have a daylight saving time change within the week we need to compensate the loss/addition of an hour
                dstOffset = this.model.get('onlyWorkingHours') ? 24 - end.diff(start, 'hours') : 0,
                width = 100 / (7 * (this.model.get('endHour') - this.model.get('startHour') + 1)),
                prevStart,
                percent = 100 / 7,
                notOnScale = false;

            if (this.model.get('onlyWorkingHours')) {
                start = moment(this.model.get('currentWeek')).add(this.model.get('startHour'), 'hours');
                end = moment(start).add(this.model.get('endHour') - this.model.get('startHour') + 1, 'hours');
            } else {
                start = moment(this.model.get('currentWeek')).startOf('day');
                end = moment(start).add(1, 'days');
            }

            for (; day < 7; day++) {
                if (timestamp < start.valueOf()) {
                    notOnScale = true;
                    break;
                }
                if (timestamp < end.valueOf()) {
                    break;
                }
                // exception for last day
                if (day === 6 && timestamp > end.valueOf()) {
                    notOnScale = true;
                    day++;
                    break;
                }

                prevStart = start.clone();
                start.add(1, 'days');
                if (this.model.get('onlyWorkingHours') && dstOffset === 0) {
                    dstOffset = 24 - start.diff(prevStart, 'hours');
                }
                end.add(1, 'days');
            }

            return day * percent + (notOnScale ? 0 : ((timestamp - start.valueOf()) / (end.valueOf() - start.valueOf()) * percent) + dstOffset * width);
        },

        // utility function, position is given in %
        // inverse is used to keep scrollposition, needs to calculate before change
        positionToTime: function (position, inverse) {
            var dayWidth = 100 / 7,
                fullDays = Math.floor(position / dayWidth),
                partialDay = position - dayWidth * fullDays,
                dayInMilliseconds = ((inverse ? !this.model.get('onlyWorkingHours') : this.model.get('onlyWorkingHours')) ? this.model.get('endHour') - this.model.get('startHour') + 1 : 24) * 3600000,
                millisecondsFromDayStart = Math.round(partialDay / dayWidth * dayInMilliseconds),
                start = moment(this.model.get('currentWeek')).add(fullDays, 'days');
            if (inverse ? !this.model.get('onlyWorkingHours') : this.model.get('onlyWorkingHours')) {
                start.add(this.model.get('startHour'), 'hours');
            }
            return start.valueOf() + millisecondsFromDayStart;
        },

        setToGrid: function (coord) {
            var grid = this.model.get('showFineGrid') && (this.model.get('zoom') === '1000' || this.model.get('zoom') === 1000) ? this.grid / 3 : this.grid;
            return grid * (Math.round(coord / grid));
        },

        updateLasso: function (Timeupdate) {
            if (this.lassoNode) {
                if (this.lassoStart !== undefined) {
                    var width, start;
                    if (this.lassoStart === this.lassoEnd || this.lassoEnd === undefined) {
                        if (this.lassoEnd === undefined || this.lassoStart < this.lassoEnd) {
                            start = this.lassoStart;
                        } else {
                            start = this.lassoEnd;
                        }
                        width = 2;
                        this.lassoNode.css({ left: start + '%', width: width + 'px' });
                    } else {
                        if (this.lassoStart < this.lassoEnd) {
                            start = this.lassoStart;
                            width = this.lassoEnd - start;
                        } else {
                            start = this.lassoEnd;
                            width = this.lassoStart - start;
                        }
                        this.lassoNode.css({ left: start + '%', width: width + '%' });
                    }
                    // carefull when saving the time. You might loose data (for example, time is 3am but only working hours are shown. time would change to 7am because lassoPosition points to this)
                    if (Timeupdate) {
                        this.lassoStartTime = this.positionToTime(this.lassoStart);
                        this.lassoEndTime = this.positionToTime(this.lassoEnd);
                    }
                    this.lassoNode.show();
                } else {
                    this.lassoNode.hide();
                }
            }
        },

        onMouseMove: function (e) {
            if (!this.lasso) {
                return;
            }
            // safari doesn't know the buttons attribute
            if (_.device('safari')) {
                if (e.which === 0) {
                    this.onMouseUp(e);
                    return;
                }
            } else if (!e.buttons) {
                this.onMouseUp(e);
                return;
            }

            //currentTarget is always .freetime-table
            var currentTarget = $(e.currentTarget);
            // don't use e.OffsetX because it uses the offset relative to child elements too (in this case appointments)
            this.lassoEnd = this.setToGrid(((e.pageX - currentTarget.offset().left) / currentTarget.outerWidth()) * 100);
            this.updateLasso(true);
        },

        onMouseDown: function (e) {
            this.lasso = true;
            //currentTarget is always .freetime-table
            var currentTarget = $(e.currentTarget);
            // don't use e.OffsetX because it uses the offset relative to child elements too (in this case appointments)
            this.lassoStart = this.setToGrid(((e.pageX - currentTarget.offset().left) / currentTarget.outerWidth()) * 100);
            this.lassoEnd = undefined;
            this.updateLasso(true);
        },

        onMouseUp: function (e) {
            if (this.lasso) {
                //currentTarget is always .freetime-table
                var currentTarget = $(e.currentTarget);
                // don't use e.OffsetX because it uses the offset relative to child elements too (in this case appointments)
                this.lassoEnd = this.setToGrid(((e.pageX - currentTarget.offset().left) / currentTarget.outerWidth()) * 100);
                // if lassoStart and lassoEnd are the same we remove the lasso on mouseUp
                if (this.lassoEnd === this.lassoStart) {
                    this.lassoEnd = this.lassoStart = undefined;
                }
                this.updateLasso(true);

                this.lasso = false;

                if (e.altKey && this.lassoEnd && this.lassoStart && this.lassoStart !== this.lassoEnd) {
                    this.parentView.save();
                }
            }
        },

        createAppointment: function () {
            if (this.lassoStart !== this.lassoEnd && this.lassoStart !== undefined && this.lassoEnd !== undefined) {
                // make sure times are set
                if (!this.lassoStartTime || !this.lassoEndTime) {
                    this.updateLasso(true);
                }
                var startTime = Math.min(this.lassoStartTime, this.lassoEndTime),
                    endTime = Math.max(this.lassoStartTime, this.lassoEndTime),
                    attendees = this.model.get('attendees').toJSON();

                //round to full minutes
                startTime = moment(startTime).startOf('minute');
                endTime = moment(endTime).startOf('minute');

                return {
                    startDate: { value: startTime.format('YYYYMMDD[T]HHmmss'), tzid: startTime.tz() },
                    endDate: { value: endTime.format('YYYYMMDD[T]HHmmss'), tzid: endTime.tz() },
                    allDay: false,
                    attendees: attendees
                };
            }
        },

        setDate: function (option) {
            var week  = moment(this.model.get('currentWeek'));
            if (_.isString(option)) {
                switch (option) {
                    case 'prev':
                        week.subtract(1, 'weeks');
                        break;
                    case 'next':
                        week.add(1, 'weeks');
                        break;
                    case 'today':
                        week = moment().startOf('week');
                        break;
                    // no default
                }
            } else if (_.isNumber(option)) {
                // scroll to date
                var hours = (this.model.get('onlyWorkingHours') ? this.model.get('startHour') : 0);
                this.keepScrollpos = moment(option).hours(hours).valueOf();
                week = moment(option).startOf('week');
            }
            week.startOf('day');
            this.model.set('currentWeek', week);
        },

        /**
         * handler for clickevents in toolbar
         * @param  { MouseEvent } e Clickevent
         */
        onControlView: function (e) {
            e.preventDefault();
            var currentTarget = $(e.currentTarget);

            if (currentTarget.hasClass('next')) {
                this.setDate('next');
            }
            if (currentTarget.hasClass('prev')) {
                this.setDate('prev');
            }
            if (currentTarget.hasClass('today')) {
                this.setDate('today');
            }
            this.trigger('onRefresh');
        }
    });
});
