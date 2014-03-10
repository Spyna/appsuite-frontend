/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * 2012 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/calendar/week/view',
    ['io.ox/calendar/util',
     'io.ox/core/date',
     'io.ox/core/extensions',
     'gettext!io.ox/calendar',
     'io.ox/core/api/folder',
     'settings!io.ox/calendar',
     'apps/io.ox/core/tk/jquery-ui.min.js'
    ], function (util, date, ext, gt, folderAPI, settings) {

    'use strict';

    var View = Backbone.View.extend({

        className:      'week',

        columns:        7,      // default value for day columns
        fragmentation:  2,      // fragmentation of a hour
        gridSize:       2,      // grid fragmentation of a hour
        cellHeight:     24,     // height of one single fragment in px
        minCellHeight:  24,     // min height of one single fragment in px
        fulltimeHeight: 20,     // height of full-time appointments in px
        fulltimeMax:    5,      // threshold for visible full-time appointments in scrollpane header
        appWidth:       98,     // max width of an appointment in %
        overlap:        0.35,   // visual overlap of appointments [0.0 - 1.0]
        slots:          24,     // amount of shown time-slots
        workStart:      8,      // full hour for start position of working time marker
        workEnd:        18,     // full hour for end position of working time marker
        mode:           0,      // view mode {1: day, 2: workweek, 3: week}
        workWeekStart:  1,      // workweek start (0=Sunday, 1=Monday, ..., 6=Saturday)
        showDeclined:   false,  // show declined appointments

        startDate:      null,   // start of day/week as local date (use as reference point)
        apiRefTime:     null,   // current reference time for api calls
        clickTimer:     null,   // timer to separate single and double click
        clicks:         0,      // click counter
        lasso:          false,  // lasso object
        folderData:     {},     // current folder object
        restoreCache:   null,   // object, which contains data for save and restore functions
        extPoint:       null,   // appointment extension
        dayLabelRef:    null,	// used to manage redraw on daychange
        startLabelRef:  null,	// used to manage redraw on weekchange

        // startup options
        options:        {
            todayClass: 'today',
            showFulltime: true,
            keyboard: true,
            allowLasso: true
        },

        // init values from prespective
        initialize: function (opt) {
            var self = this;

            // init options
            _.extend(this.options, opt);

            // define view events
            var events = {
                'click .control.next,.control.prev,.control.today': 'onControlView',
                'click .appointment': 'onClickAppointment',
                'click .weekday': 'onCreateAppointment'
            };

            if (_.device('touch')) {
                _.extend(events, {
                    'taphold .week-container>.day,.fulltime>.day': 'onCreateAppointment',
                    'swipeleft .timeslot' : 'onControlView',
                    'swiperight .timeslot' : 'onControlView'
                });
            } else {
                _.extend(events, {
                    'dblclick .week-container>.day,.fulltime>.day': 'onCreateAppointment'
                });
                if (_.device('desktop')) {
                    _.extend(events, {
                        'mouseenter .appointment': 'onHover',
                        'mouseleave .appointment': 'onHover',
                        'mousedown .week-container>.day' : 'onLasso',
                        'mousemove .week-container>.day' : 'onLasso',
                        'mouseup' : 'onLasso'
                    });
                }
            }

            this.delegateEvents(events);

            // initialize main objects
            this.pane           = $('<div>').addClass('scrollpane f6-target').attr({ tabindex: 1 });
            this.fulltimePane   = $('<div>').addClass('fulltime');
            this.fulltimeCon    = $('<div>').addClass('fulltime-container');
            this.fulltimeNote   = $('<div>').addClass('note');
            this.timeline       = $('<div>').addClass('timeline');
            this.dayLabel       = $('<div>').addClass('footer');
            this.kwInfo         = _.device('small') ? $('<div>').addClass('info') : $('<a href="#" tabindex="1">').addClass('info');
            this.weekCon        = $('<div>').addClass('week-container');

            this.kwInfo.attr({
                'aria-label': gt('Use cursor keys to change the date. Press ctrl-key at the same time to change year or shift-key to change month. Close date-picker by pressing ESC key.')
            });

            this.mode = opt.mode || 'day';
            this.extPoint = opt.appExtPoint;
            this.refDate = opt.refDate || new date.Local();

            switch (this.mode) {
            case 'day':
                this.$el.addClass('dayview');
                this.columns = 1;
                break;
            case 'workweek':
                this.$el.addClass('workweekview');
                this.columns = 5;
                break;
            default:
            case 'week':
                this.$el.addClass('weekview');
                this.columns = 7;
                break;
            }

            this.collection
                .on('change', this.redrawAppointment, this);

            this.setStartDate(this.refDate);
            this.initSettings();

            //append datepicker
            if (!_.device('small')) {
                //just localize the picker, use en as default with current languages
                $.fn.datepicker.dates.en = {
                    days: date.locale.days,
                    daysShort: date.locale.daysShort,
                    daysMin: date.locale.daysStandalone,
                    months: date.locale.months,
                    monthsShort: date.locale.monthsShort,
                    today: gt('Today')
                };

                this.kwInfo
                    .on('changeDate', function (e) {
                        self.setStartDate(e.date.getTime());
                        self.trigger('onRefresh');
                    })
                    .on('show', function () {
                        $(this).datepicker('update', new Date(self.startDate.getTime()));
                    })
                    .datepicker({
                        format: date.getFormat(date.DATE).replace(/\by\b/, 'yyyy').toLowerCase(),
                        parentEl: this.$el,
                        weekStart: date.locale.weekStart,
                        autoclose: true,
                        calendarWeeks: true,
                        todayHighlight: true,
                        todayBtn: true
                    });
            }
        },

        /**
         * reset appointment collection
         * avoids processing concurrent requests in wrong order
         * @param  {number} startDate starttime from initail request
         * @param  {array}  data      all appointments returend by API
         */
        reset: function (startDate, data) {
            if (startDate === this.apiRefTime.getTime()) {
                var ws = this.startDate.getTime(),
                    we = ws + (this.columns * date.DAY);
                // reset collection; transform raw dato to proper models
                data = _(data)
                    .filter(function (obj) {
                        var os = obj.start_date,
                            oe = obj.end_date;
                        if (obj.full_time) {
                            os = date.Local.utc(os);
                            oe = date.Local.utc(oe);
                        }
                        return (os >= ws && os < we) || (oe > ws && oe < we) || (os <= ws && oe >= we);
                    })
                    .map(function (obj) {
                        var model = new Backbone.Model(obj);
                        model.id = _.cid(obj);
                        return model;
                    });
                this.collection.reset(data);
                this.renderAppointments();
            }
        },

        /**
         * set week reference start date
         * @param {string|number|LocalDate} opt
         *        number: Timestamp of a date in the reference week. Now if empty
         *        string: {'next', 'prev'} set next or previous week
         *        LoacalDate: date object in the reference week
         * @param {boolean} utc     true if full-time appointment
         */
        setStartDate: function (opt, utc) {
            utc = utc || false;
            if (opt) {
                // number | LocalDate
                if (typeof opt === 'number' || opt instanceof date.Local) {
                    if (utc) {
                        opt = date.Local.utc(opt);
                    }
                    this.startDate = new date.Local(opt);
                    this.refDate.setTime(this.startDate.getTime());
                }
                //string
                if (typeof opt === 'string') {
                    var diff = (this.columns === 1 ? date.DAY : date.WEEK) * (opt === 'prev' ? -1 : 1);
                    this.startDate.add(diff);
                    this.refDate.add(diff);
                }
            } else {
                // today button
                this.startDate = new date.Local();
                this.refDate.setTime(this.startDate.getTime());
            }

            // normalize startDate to beginning of the week or day
            switch (this.mode) {
            case 'day':
                this.startDate.setHours(0, 0, 0, 0);
                break;
            case 'workweek':
                // settings independent, set startDate to Monday of the current week
                var weekStart = date.Local.utc((this.startDate.getDays() - this.startDate.getDay() + this.workWeekStart) * date.DAY);
                this.startDate = new date.Local(weekStart);
                break;
            default:
            case 'week':
                this.startDate.setStartOfWeek();
                break;
            }
            // set api reference date to the beginning of the month
            var month = this.startDate.getMonth();
            if (month % 2 === 1) {
                month--;
            }
            this.apiRefTime = new date.Local(this.startDate.getYear(), month, 1);
        },

        /**
         * apply new reference date and refresh view
         */
        applyRefDate: function () {
            this.setStartDate(this.refDate.getTime());
            this.trigger('onRefresh');
        },

        /**
         * setup setting params
         */
        initSettings: function () {
            // init settings
            var self = this;
            this.gridSize = 60 / settings.get('interval', this.gridSize);
            this.workStart = settings.get('startTime', this.workStart);
            this.workEnd = settings.get('endTime', this.workEnd);
            settings.on('change', function (e, key) {
                switch (key) {
                case 'interval':
                    self.gridSize = 60 / settings.get('interval', self.gridSize);
                    break;
                case 'startTime':
                case 'endTime':
                    self.workStart = settings.get('startTime', self.workStart);
                    self.workEnd = settings.get('endTime', self.workEnd);
                    self.rerenderWorktime();
                    break;
                default:
                    break;
                }
            });
        },

        /**
         * handler for hover effect
         * @param  {MouseEvent} e Hover event (mouseenter, mouseleave)
         */
        onHover: function (e) {
            if (!this.lasso && (e.relatedTarget && $(e.relatedTarget).hasClass('timeslot'))) {
                var cid = _.cid(String($(e.currentTarget).data('cid'))),
                    el = $('[data-cid^="' + cid.folder_id + '.' + cid.id + '"]', this.$el);
                switch (e.type) {
                case 'mouseenter':
                    el.addClass('hover');
                    break;
                case 'mouseleave':
                    el.removeClass('hover');
                    break;
                default:
                    break;
                }
            }
        },

        /**
         * handler for clickevents in toolbar
         * @param  {MouseEvent} e Clickevent
         */
        onControlView: function (e) {
            e.preventDefault();
            var cT = $(e.currentTarget),
                t = $(e.target);
            if (cT.hasClass('next') || (t.hasClass('timeslot') && e.type === 'swipeleft' && !this.lasso)) {
                this.setStartDate('next');
            }
            if (cT.hasClass('prev') || (t.hasClass('timeslot') && e.type === 'swiperight' && !this.lasso)) {
                this.setStartDate('prev');
            }
            if (cT.hasClass('today')) {
                this.setStartDate();
            }
            this.trigger('onRefresh');
            return false;
        },

        /**
         * handler for key events in view
         * @param  {KeyEvent} e Keyboard event
         */
        fnKey: function (e) {
            if (!this.options.keyboard) {
                return false;
            }
            switch (e.which) {
            case 27: // ESC
                this.cleanUpLasso();
                break;
            case 37: // left
                this.setStartDate('prev');
                this.trigger('onRefresh');
                break;
            case 39: // right
                this.setStartDate('next');
                this.trigger('onRefresh');
                break;
            case 13: // enter
                this.onClickAppointment(e);
                break;
            default:
                break;
            }
        },

        /**
         * handler for single- and double-click events on appointments
         * @param  {Event} e Mouse event
         */
        onClickAppointment: function (e) {
            var cT = $(e[(e.type === 'keydown') ? 'target' : 'currentTarget']);
            if (cT.hasClass('appointment') && !this.lasso && !cT.hasClass('disabled')) {
                var self = this,
                    obj = _.cid(String(cT.data('cid')));
                if (!cT.hasClass('current')) {
                    $('.appointment', self.$el)
                        .removeClass('current opac')
                        .not($('[data-cid^="' + obj.folder_id + '.' + obj.id + '"]', self.$el))
                        .addClass('opac');
                    $('[data-cid^="' + obj.folder_id + '.' + obj.id + '"]', self.$el).addClass('current');
                    self.trigger('showAppointment', e, obj);
                } else {
                    $('.appointment', self.$el).removeClass('opac');
                }

                if (self.clickTimer === null && self.clicks === 0) {
                    self.clickTimer = setTimeout(function () {
                        clearTimeout(self.clickTimer);
                        self.clicks = 0;
                        self.clickTimer = null;
                    }, 300);
                }
                self.clicks++;

                if (self.clickTimer !== null && self.clicks === 2 && cT.hasClass('modify') && e.type === 'click') {
                    clearTimeout(self.clickTimer);
                    self.clicks = 0;
                    self.clickTimer = null;
                    self.trigger('openEditAppointment', e, obj);
                }
            }
        },

        /**
         * handler for double-click events on grid to create new appointments
         * @param  {MouseEvent} e double click event
         */
        onCreateAppointment: function (e) {

            e.preventDefault();

            if (!folderAPI.can('create', this.folder())) return;

            if ($(e.target).hasClass('timeslot')) {
                // calculate timestamp for current position
                var pos = this.getTimeFromPos(e.target.offsetTop),
                    start = this.getTimeFromDateTag($(e.currentTarget).attr('date')).add(pos);
                this.trigger('openCreateAppointment', e, {
                    start_date: start.getTime(),
                    end_date: start.add(date.HOUR).getTime()
                });
            }
            if ($(e.target).hasClass('day') || $(e.target).hasClass('weekday')) {
                // calculate timestamp for current position
                var startTS = date.Local.localTime(this.getTimeFromDateTag($(e.currentTarget).attr('date')).getTime());
                this.trigger('openCreateAppointment', e, {start_date: startTS, end_date: startTS + date.DAY, full_time: true});
            }
        },

        /**
         * handler for appointment updates
         * @param  {Object} obj appointment object
         */
        onUpdateAppointment: function (obj) {
            if (obj.start_date && obj.end_date && obj.start_date < obj.end_date) {
                this.trigger('updateAppointment', obj);
            }
        },

        /**
         * handler for lasso function in grid
         * @param  {MouseEvent} e mouseevents on day container
         */
        onLasso: function (e) {
            if (this.options.allowLasso === false || !folderAPI.can('create', this.folder())) {
                return;
            }

            // switch mouse events
            switch (e.type) {
            case 'mousedown':
                if (this.lasso === false && $(e.target).hasClass('timeslot')) {
                    this.lasso = true;
                }
                break;

            case 'mousemove':
                e.preventDefault();
                var cT = $(e.currentTarget),
                    curDay = parseInt(cT.attr('date'), 10),
                    mouseY = e.pageY - (this.pane.offset().top - this.pane.scrollTop());

                // normal move
                if (_.isObject(this.lasso) && e.which === 1) {
                    var lData = this.lasso.data(),
                        down = mouseY > lData.start,
                        right = curDay > lData.startDay,
                        dayChange = curDay !== lData.lastDay,
                        dayDiff = Math.abs(curDay - lData.startDay),
                        lassoStart = this.roundToGrid(lData.start, (down && dayDiff === 0) || right ? 'n' : 's');

                    if (dayDiff > 0) {
                        if (dayChange) {
                            // move mouse to another day area

                            // update start lasso
                            this.lasso.css({
                                height: right ? 'auto' : lassoStart,
                                top: right ? lassoStart : 0,
                                bottom: right ? 0 : 'auto'
                            });

                            // create temp. helper lasso
                            var tmpLasso = $('<div>')
                                .addClass('appointment lasso')
                                .css({
                                    height: right ? this.roundToGrid(mouseY, 's') : 'auto',
                                    minHeight: this.minCellHeight,
                                    top: right ? 0 : this.roundToGrid(mouseY, 'n'),
                                    bottom: right ? 'auto' : 0
                                });

                            // remove or resize helper
                            $.each(lData.helper, function (i, el) {
                                if (i >= dayDiff) {
                                    el.remove();
                                    delete lData.helper[i];
                                } else {
                                    el.css({
                                        height: 'auto',
                                        top: 0,
                                        bottom: 0
                                    });
                                }
                            });
                            lData.helper[dayDiff] = tmpLasso;
                            lData.last = tmpLasso;

                            // add last helper to pane
                            cT.append(tmpLasso);
                        } else {
                            // change only last helper height
                            lData.last.css({
                                height: right ? this.roundToGrid(mouseY, 's') : 'auto',
                                minHeight: this.minCellHeight,
                                top: right ? 0 : this.roundToGrid(mouseY, 'n'),
                                bottom: right ? 'auto' : 0
                            });

                        }
                    } else {
                        var newHeight = 0;
                        if (Math.abs(lData.start - mouseY) > 5) {
                            newHeight = Math.abs(lassoStart - this.roundToGrid(mouseY, down ? 's' : 'n'));
                        } else {
                            mouseY = lData.start;
                        }
                        if (dayChange) {
                            lData.last.remove();
                            delete lData.last;
                        }
                        this.lasso.css({
                            height: newHeight,
                            top: lassoStart - (down ? 0 : newHeight)
                        });
                        lData.start = lassoStart;
                    }
                    lData.stop = this.roundToGrid(mouseY, (down && dayDiff === 0) || right ? 's' : 'n');
                    lData.lastDay = curDay;
                }

                // first move
                if (this.lasso === true && $(e.target).hasClass('timeslot')) {
                    this.lasso = $('<div>')
                        .addClass('appointment lasso')
                        .css({
                            height: this.gridHeight(),
                            minHeight: 0,
                            top: this.roundToGrid(mouseY, 'n')
                        })
                        .data({
                            start: this.roundToGrid(mouseY, 'n'),
                            stop: this.roundToGrid(mouseY, 's'),
                            startDay: curDay,
                            lastDay: curDay,
                            helper: {}
                        })
                        .appendTo(cT);
                } else {
                    this.trigger('mouseup');
                }
                break;

            case 'mouseup':
                e.preventDefault();
                if (_.isObject(this.lasso) && e.which === 1) {
                    var l = this.lasso.data();

                    // no action on 0px move
                    if (l.start === l.stop && l.lastDay === l.startDay) {
                        this.cleanUpLasso();
                        break;
                    }

                    var start = this.getTimeFromDateTag(Math.min(l.startDay, l.lastDay)),
                        end = this.getTimeFromDateTag(Math.max(l.startDay, l.lastDay));

                    if (l.startDay === l.lastDay) {
                        start.add(this.getTimeFromPos(Math.min(l.start, l.stop)));
                        end.add(this.getTimeFromPos(Math.max(l.start, l.stop)));
                    } else {
                        start.add(this.getTimeFromPos(l.startDay > l.lastDay ? l.stop : l.start));
                        end.add(this.getTimeFromPos(l.startDay > l.lastDay ? l.start : l.stop));
                    }

                    this.cleanUpLasso();

                    this.trigger('openCreateAppointment', e, {
                        start_date: start.getTime(),
                        end_date: end.getTime(),
                        lasso: true
                    });
                    e.stopImmediatePropagation();
                }
                this.lasso = false;
                break;

            default:
                this.lasso = false;
                break;
            }
            return;
        },

        /**
         * cleanUp all lasso data
         */
        cleanUpLasso: function () {
            if (_.isObject(this.lasso)) {
                var l = this.lasso.data();
                // delete div and reset object
                $.each(l.helper, function (i, el) {
                    el.remove();
                });
                l = null;
                this.lasso.remove();
                this.lasso = false;
            }
        },

        /**
         * render the week view
         * @return {Backbone.View} this view
         */
        render: function () {

            // create timelabels
            var timeLabel = [],
                self = this;

            for (var i = 1; i < this.slots; i++) {
                var number = new date.Local(0, 0, 0, i, 0, 0, 0).format(date.TIME);
                timeLabel.push(
                    $('<div>')
                        .addClass('time')
                        .append($('<div>').addClass('number').text(gt.noI18n(number.replace(/^(\d\d?):00 ([AP]M)$/, '$1 $2'))))
                );
            }
            timeLabel = $('<div>').addClass('week-container-label').append(timeLabel);

            /**
             * change the timeline css top value to the current time position
             * @param  {Object} tl Timeline as jQuery object
             */
            var renderTimeline = function () {
                var d = new date.Local();
                self.timeline.css({ top: ((d.getHours() / 24 + d.getMinutes() / 1440) * 100) + '%'});
            };
            // create and animate timeline
            renderTimeline();
            setInterval(renderTimeline, 60000);

            // mattes: guess we don't need this any more in week and work week view
            if (!Modernizr.touch && this.columns === 1) {
                this.fulltimePane.empty().append(this.fulltimeNote.text(gt('Doubleclick in this row for whole day appointment')).attr('unselectable', 'on'));
            }

            this.fulltimePane.css({ height: (this.options.showFulltime ? 21 : 1) + 'px'});

            // create days
            this.weekCon.append(this.timeline);
            for (var d = 0; d < this.columns; d++) {

                var day = $('<div>')
                    .addClass('day')
                    .width(100 / this.columns + '%')
                    .attr('date', d);

                // add days to fulltime panel
                this.fulltimePane
                    .append(day.clone());

                // create timeslots and add days to week container
                for (var i = 1; i <= this.slots * this.fragmentation; i++) {
                    day.append(
                        $('<div>')
                            .addClass('timeslot ' + (i > (this.workStart * this.fragmentation) && i <= (this.workEnd * this.fragmentation) ? 'in' : 'out'))
                    );
                }
                this.weekCon.append(day);
            }

            var nextStr = this.columns === 1 ? gt('Next Day') : gt('Next Week'),
                prevStr = this.columns === 1 ? gt('Previous Day') : gt('Previous Week');

            // create toolbar, view space and dayLabel
            this.$el.empty().append(
                $('<div class="toolbar">').append(
                    this.kwInfo,
                    $('<div>').append(
                        $('<ul class="pagination">').append(
                            $('<li>').append(
                                $('<a>').attr({
                                        href: '#',
                                        tabindex: 1,
                                        role: 'button',
                                        title: prevStr,
                                        'aria-label': prevStr
                                    })
                                    .addClass('control prev')
                                    .append($('<i>').addClass('icon-chevron-left'))
                            ),
                            $('<li>').append(
                                $('<a href="#" tabindex="1" role="button">')
                                    .addClass('control today')
                                    .text(gt('Today'))
                            ),
                            $('<li>').append(
                                $('<a>').attr({
                                        href: '#',
                                        tabindex: 1,
                                        role: 'button',
                                        title: nextStr,
                                        'aria-label': nextStr
                                    })
                                    .addClass('control next')
                                    .append($('<i>').addClass('icon-chevron-right'))
                            )
                        )
                    )
                ),
                $('<div class="footer-container">').append(
                    this.dayLabel
                ),
                $('<div class="week-view-container">').append(
                    this.fulltimeCon.empty().append(this.fulltimePane),
                    this.pane.empty().append(timeLabel, self.weekCon)
                )
            );

            return this;
        },

        rerenderWorktime: function () {
            var self = this;
            this.weekCon.find('.day').each(function () {
                $(this).find('.timeslot').removeClass('in out').each(function (i, el) {
                    i++;
                    $(el).addClass('timeslot ' + (i > (self.workStart * self.fragmentation) && i <= (self.workEnd * self.fragmentation) ? 'in' : 'out'));
                });
            });
            return this;
        },

        /**
         * move the calendar window scrolling position, so that the working hours are centered
         */
        setScrollPos: function () {
            this.adjustCellHeight();
            var slotHeight = this.cellHeight * this.fragmentation,
                workHeight = slotHeight * (this.workEnd - this.workStart);

            // adjust scoll position
            this.pane.scrollTop((slotHeight * this.workStart) - (this.pane.height() - workHeight) / 2);
            return this;
        },

        /**
         * adjust cell height to fit into scrollpane
         * @return {View} thie view
         */
        adjustCellHeight: function () {
            this.cellHeight = Math.floor(
                Math.max(this.pane.height() / ((this.workEnd - this.workStart + 1) * this.fragmentation),
                this.minCellHeight)
            );
            // only update if height differs from CSS default
            if (this.cellHeight !== this.minCellHeight) {
                $('.timeslot', this.pane).height(this.cellHeight - 1);
                $('.time', this.pane).height(this.cellHeight * this.fragmentation);
            }
            return this;
        },

        /**
         * render dayLabel with current date information
         * show and hide timeline
         */
        renderDayLabel: function () {

            var days = [],
                today = new date.Local().setHours(0, 0, 0, 0),
                tmpDate = new date.Local(this.startDate.getTime());

            // something new?
            if (this.startDate.getTime() === this.startLabelRef && today.getTime() === this.dayLabelRef) return;

            if (this.options.todayClass) {
                $('.week-view-container').find('.day.' + this.options.todayClass, this.$el).removeClass(this.options.todayClass);
            }

            this.dayLabelRef = today.getTime();
            this.startLabelRef = this.startDate.getTime();

            // refresh dayLabel, timeline and today-label
            this.timeline.hide();
            for (var d = 0; d < this.columns; d++) {
                var formatDate = tmpDate.format(date.DAYOFWEEK_DATE),
                    day = $('<a>')
                    .addClass('weekday')
                    .attr({
                        date: d,
                        title: gt('Click for whole day appointment'),
                        role: 'button',
                        tabindex: 1,
                        href: '#',
                        'aria-label': formatDate + ', ' + gt('Click for whole day appointment')
                    })
                    .text(gt.noI18n(formatDate))
                    .width(100 / this.columns + '%');
                // mark today
                if (new date.Local().getDays() === tmpDate.getDays()) {
                    if (this.columns > 1) {
                        $('.week-view-container').find('.day[date="' + d + '"]', this.pane).addClass(this.options.todayClass);
                    }
                    day.addClass(this.options.todayClass);
                    this.timeline.show();
                }
                days.push(day);
                tmpDate.add(date.DAY);
            }

            this.dayLabel.empty().append(days);

            this.kwInfo.empty().append(
                $.txt(
                    gt.noI18n(this.columns > 1 ?
                        this.startDate.formatInterval(new date.Local(this.startDate.getTime() + ((this.columns - 1) * date.DAY)), date.DATE) :
                        this.startDate.format(date.DAYOFWEEK_DATE)
                    )
                ),
                $.txt(' '),
                $('<span class="cw">').text(
                    //#. %1$d = Calendar week
                    gt('CW %1$d', this.startDate.format('w'))
                )
            );
        },

        /**
         * clear all appointments from current week and render all appointments form collection
         */
        renderAppointments: function () {
            this.showDeclined = settings.get('showDeclinedAppointments', false);

            var self = this,
                draw = {},
                fulltimeColPos = [0],
                fulltimeCount = 0;

            // clear all first
            $('.appointment', this.$el).remove();

            this.renderDayLabel();

            // loop over all appointments to split and create divs
            this.collection.each(function (model) {

                // is declined?
                if (util.getConfirmationStatus(model.attributes, ox.user_id) !== 2 || this.showDeclined) {
                    // is fulltime?
                    if (model.get('full_time') && this.options.showFulltime) {
                        fulltimeCount++;
                        var app = this.renderAppointment(model),
                            fulltimePos = (model.get('start_date') - this.startDate.getDays() * date.DAY) / date.DAY,
                            fulltimeWidth = Math.max(((model.get('end_date') - model.get('start_date')) / date.DAY + Math.min(0, fulltimePos)), 1);
                        // loop over all column positions
                        for (var row = 0; row < fulltimeColPos.length; row++) {
                            if  (fulltimeColPos[row] <= model.get('start_date')) {
                                fulltimeColPos[row] = model.get('end_date');
                                break;
                            }
                        }

                        if (row === fulltimeColPos.length) {
                            fulltimeColPos.push(model.get('end_date'));
                        }
                        app.css({
                            height: this.fulltimeHeight,
                            width: (100 / this.columns) * fulltimeWidth + '%',
                            left: (100 / this.columns) * Math.max(0, fulltimePos) + '%',
                            top: row * (this.fulltimeHeight + 1)
                        });
                        this.fulltimePane.append(app);
                    } else {
                        // fix fulltime appointments to local time when this.showFulltime === false
                        if (model.get('full_time')) {
                            model.set({start_date: date.Local.utc(model.get('start_date'))}, {silent: true});
                            model.set({end_date: date.Local.utc(model.get('end_date'))}, {silent: true});
                        }

                        var startLocal = new date.Local(Math.max(model.get('start_date'), this.startDate.getTime())),
                            endLocal = new date.Local(model.get('end_date')),
                            start = new date.Local(startLocal.getYear(), startLocal.getMonth(), startLocal.getDate()).getTime(),
                            end = new date.Local(endLocal.getYear(), endLocal.getMonth(), endLocal.getDate()).getTime(),
                            maxCount = 0,
                            style = '';

                        // draw across multiple days
                        while (maxCount <= this.columns) {
                            var app = this.renderAppointment(model),
                                sel = '[date="' + (startLocal.getDays() - this.startDate.getDays()) + '"]';
                            maxCount++;

                            if (start !== end) {
                                endLocal = new date.Local(startLocal.getTime());
                                endLocal.setHours(23, 59, 59, 999);
                                if (model.get('end_date') - endLocal.getTime() > 1) {
                                    style += 'rmsouth';
                                }
                            } else {
                                endLocal = new date.Local(model.get('end_date'));
                            }

                            // kill overlap appointments with length null
                            if (startLocal.getTime() === endLocal.getTime() && maxCount > 1) {
                                break;
                            }

                            app.addClass(style).pos = {
                                    id: model.id,
                                    start: startLocal.getTime(),
                                    end: endLocal.getTime()
                                };
                            if (!draw[sel]) {
                                draw[sel] = [];
                            }
                            draw[sel].push(app);
                            style = '';
                            // inc date
                            if (start !== end) {
                                startLocal.setDate(startLocal.getDate() + 1);
                                startLocal.setHours(0, 0, 0, 0);
                                start = new date.Local(startLocal.getYear(), startLocal.getMonth(), startLocal.getDate()).getTime();
                                style = 'rmnorth ';
                            } else {
                                break;
                            }
                        }
                    }
                }
            }, this);

            // calculate full-time appointment container height
            var ftHeight = 1;
            if (this.options.showFulltime) {
                ftHeight = (fulltimeColPos.length <= this.fulltimeMax ? fulltimeColPos.length : (this.fulltimeMax + 0.5)) * (this.fulltimeHeight + 1);
                this.fulltimePane.css({ height: fulltimeColPos.length * (this.fulltimeHeight + 1) + 'px'});
                this.fulltimeCon.resizable({
                    handles: 's',
                    minHeight: this.fulltimeHeight,
                    maxHeight: fulltimeColPos.length * (this.fulltimeHeight + 1),
                    resize: function () {
                        self.pane.css({ top: self.fulltimeCon.outerHeight() });
                    }
                });
            }
            this.fulltimeCon.css({ height: ftHeight + 'px' });
            this.pane.css({ top: ftHeight + 'px' });

            this.fulltimeNote[fulltimeCount === 0 ? 'show' : 'hide']();

            // fix for hidden scrollbars on small DIVs (esp. Firefox Win)
            var fullConWitdth = this.fulltimeCon[0].clientWidth + this.fulltimeCon[0].offsetLeft;
            if (fullConWitdth !== this.pane[0].clientWidth) {
                this.fulltimePane.css({ marginRight: fullConWitdth - this.pane[0].clientWidth + 'px' });
            } else {
                this.fulltimePane.css({ marginRight: 0 });
            }

            // loop over all single days
            $.each(draw, function (day, apps) {

                // sort appointments by start time
                apps = _.sortBy(apps, function (app) {
                    return app.pos.start;
                });

                // init position Array
                var positions = [0];
                // loop over all appointments per day to calculate position
                for (var i = 0; i < apps.length; i++) {
                    var app = apps[i],
                        collisions = 0;
                    // loop over all column positions
                    for (var p = 0; p < positions.length; p++) {
                        // workaround for appointments with length 0
                        if (app.pos.start === app.pos.end) {
                            app.pos.end++;
                        }
                        if  (positions[p] <= app.pos.start) {
                            positions[p] = app.pos.end;
                            app.pos.index = p;
                            break;
                        }
                    }

                    if (p === positions.length) {
                        app.pos.index = positions.length;
                        positions.push(app.pos.end);
                    }

                    // cals amount of collisions
                    for (var k = 0; k < apps.length; k++) {
                        if (i === k) continue;
                        var as = app.pos.start,
                            ae = app.pos.end,
                            ms = apps[k].pos.start,
                            me = apps[k].pos.end;
                        if ((as >= ms && as < me) || (as <= ms && ae >= me) || (ae > ms && ae <= me)) {
                            collisions++;
                        }
                    }
                    app.pos.max = ++collisions;
                }

                // loop over all appointments to draw them
                for (var j = 0; j < apps.length; j++) {
                    var app = apps[j],
                        pos = self.calcPos(app.pos),
                        idx = Math.min(app.pos.max, positions.length),
                        width = Math.min((self.appWidth / idx) * (1 + (self.overlap * (idx - 1))), self.appWidth),
                        left = idx > 1 ? ((self.appWidth - width) / (idx - 1)) * app.pos.index : 0,
                        border = (left > 0 || (left === 0 && width < self.appWidth)),
                        height = Math.max(pos.height, self.minCellHeight - 1);

                    app.css({
                        top: pos.top,
                        left: left + '%',
                        height: height + 'px',
                        lineHeight: Math.min(height, self.cellHeight) + 'px',
                        width: width + '%',
                        minHeight: (self.minCellHeight - 1) + 'px',
                        maxWidth: self.appWidth + '%'
                        // zIndex: j
                    })
                    .addClass(border ? 'border' : '');
                }
                self.$('.week-container ' + day, self.$el).append(apps);
            });

            // disable d'n'd on small devices
            if (_.device('touch')) return;

            // init drag and resize widget on appointments
            var colWidth = $('.day:first', this.$el).outerWidth(),
                paneOffset = self.pane.children().first().width() + this.$el.offset().left,
                paneHeight = self.height();

            // add resizable and draggable plugin to all appointments with modify class
            $('.week-container .day>.appointment.modify', this.$el)
                .resizable({
                    handles: 'n, s',
                    grid: [0, self.gridHeight()],
                    minHeight: self.gridHeight(),
                    containment: 'parent',
                    start: function (e, ui) {
                        var d = $(this).data('resizable');
                        // init custom resize object
                        d.my = {};
                        // set current day
                        $.extend(d.my, {
                            curHelper: $(this),
                            all: $('[data-cid="' + ui.helper.data('cid') + '"]', self.$el),
                            day: Math.floor((e.pageX - paneOffset) / colWidth),
                            handle: ''
                        });
                        d.my.firstPos = parseInt(d.my.all.first().closest('.day').attr('date'), 10);
                        d.my.lastPos = parseInt(d.my.all.last().closest('.day').attr('date'), 10);
                        d.my.lastHeight = d.my.all.last().height();
                        d.my.startPos = d.my.day;
                    },
                    resize:  function (e, ui) {
                        var el = $(this),
                            d = el.data('resizable'),
                            day = Math.floor((e.pageX - paneOffset) / colWidth),
                            mouseY = e.pageY - (self.pane.offset().top - self.pane.scrollTop());
                        // detect direction
                        if (ui.position.top !== ui.originalPosition.top) {
                            d.my.handle = 'n';
                        } else if (ui.size.height !== ui.originalSize.height) {
                            d.my.handle = 's';
                        }

                        // add new style
                        d.my.all
                            .addClass('opac')
                            .css({
                                left : 0,
                                width: '100%',
                                maxWidth: '100%',
                                zIndex: 999
                            });

                        // resize actions
                        if (day >= d.my.firstPos && d.my.handle === 's') {
                            // right side
                            mouseY = self.roundToGrid(mouseY, 's');
                            // default move
                            if (day !== d.my.startPos) {
                                ui.position.top = ui.originalPosition.top;
                                ui.size.height = paneHeight - ui.position.top;
                            } else {
                                d.my.bottom = ui.size.height + ui.position.top;
                            }
                            if (d.my.day === day && day !== d.my.startPos) {
                                d.my.curHelper.height(function () {
                                    return mouseY - $(this).position().top;
                                });
                                d.my.bottom = mouseY;
                            } else if (day < d.my.day) {
                                // move left
                                if (day >= d.my.lastPos) {
                                    d.my.all.filter(':visible').last().remove();
                                } else {
                                    d.my.all.filter(':visible').last().hide();
                                }
                                d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]', self.$el);
                                d.my.curHelper = d.my.all.filter(':visible').last();
                                d.my.curHelper.css({
                                    minHeight: 0,
                                    maxHeight: paneHeight
                                });
                            } else if (day > d.my.day) {
                                // move right
                                if (day > d.my.lastPos) {
                                    // set new helper
                                    $('.week-container .day[date="' + day + '"]', self.$el)
                                        .append(d.my.curHelper = el.clone());
                                    d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]', self.$el);
                                } else {
                                    d.my.curHelper = d.my.all.filter(':hidden').first();
                                }
                                if (day > d.my.firstPos) {
                                    d.my.all.filter(':visible').slice(0, -1).css({
                                        height: 'auto',
                                        bottom: 0
                                    });
                                    d.my.curHelper.show().css({
                                        top: 0,
                                        height: mouseY,
                                        minHeight: 0
                                    });
                                }
                            }
                        } else if (day <= d.my.lastPos && d.my.handle === 'n') {
                            // left side
                            mouseY = self.roundToGrid(mouseY, 'n');
                            if (day !== d.my.startPos) {
                                ui.size.height = paneHeight;
                                ui.position.top = 0;
                            } else {
                                d.my.top = ui.position.top;
                            }
                            if (d.my.day === day && day !== d.my.startPos) {
                                // default move
                                d.my.curHelper.css({
                                    top: mouseY,
                                    height: (day === d.my.lastPos ? d.my.lastHeight : paneHeight) - mouseY
                                });
                                d.my.top = mouseY;
                            } else if (day > d.my.day) {
                                // move right
                                if (day < d.my.startPos) {
                                    d.my.all.filter(':visible').first().remove();
                                } else {
                                    // if original element - do not remove
                                    d.my.all.filter(':visible').first().hide();
                                }
                                // update dataset
                                d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]', self.$el);
                                d.my.curHelper = d.my.all.filter(':visible').first();
                            } else if (day < d.my.day) {
                                // move left
                                if (day < d.my.firstPos) {
                                    // add new helper
                                    $('.week-container .day[date="' + day + '"]', self.$el)
                                        .append(d.my.curHelper = el.clone().addClass('opac'));
                                    d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]', self.$el);

                                } else {
                                    d.my.curHelper = d.my.all.filter(':hidden').last();
                                }
                                if (day < d.my.lastPos) {
                                    d.my.all.filter(':visible').slice(0, -1).css({
                                        top: 0,
                                        height: paneHeight
                                    }).end().last().height(function (i, h) {
                                        return $(this).position().top + h;
                                    }).css({top: 0});
                                    d.my.curHelper.show().css({
                                        top: mouseY,
                                        height: paneHeight - mouseY
                                    });
                                }
                                // update dataset
                                d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]', self.$el);
                            }
                        }
                        // update day
                        d.my.day = day;
                    },
                    stop: function () {
                        var el = $(this),
                            d = el.data('resizable'),
                            app = self.collection.get(el.data('cid')).attributes,
                            tmpTS = self.getTimeFromDateTag(d.my.day);
                        d.my.all.removeClass('opac');
                        // save for update calculations
                        app.old_start_date = app.start_date;
                        app.old_end_date = app.end_date;
                        switch (d.my.handle) {
                        case 'n':
                            app.start_date = tmpTS.add(self.getTimeFromPos(d.my.top)).getTime();
                            break;
                        case 's':
                            app.end_date = tmpTS.add(self.getTimeFromPos(d.my.bottom)).getTime();
                            break;
                        default:
                            break;
                        }
                        // disable widget
                        el.resizable('disable').busy();
                        self.onUpdateAppointment(app);
                    }
                })
                .draggable({
                    grid: [colWidth, self.gridHeight()],
                    distance: 10,
                    scroll: true,
                    revertDuration: 0,
                    revert: function (drop) {
                        //if false then no socket object drop occurred.

                        if (drop === false) {
                            //revert the appointment by returning true
                            $(this).show();
                            return true;
                        } else {
                            //return false so that the appointment does not revert
                            return false;
                        }
                    },
                    start: function (e, ui) {
                        // write all appointment divs to draggable object
                        var d = $(this).data('draggable');
                        d.my = {
                            all: $('[data-cid="' + ui.helper.data('cid') + '"]', self.$el)
                                .addClass('opac')
                                .css({
                                    left : 0,
                                    width: '100%',
                                    maxWidth: '100%',
                                    zIndex: 999
                                })
                            };
                        _.extend(d.my, {
                            firstPos: parseInt(d.my.all.first().closest('.day').attr('date'), 10),
                            lastPos: parseInt(d.my.all.last().closest('.day').attr('date'), 10),
                            initPos: parseInt($(this).closest('.day').attr('date'), 10),
                            firstTop: d.my.all.first().position().top,
                            lastHeight: d.my.all.last().outerHeight(),
                            lastTop: ui.position.top,
                            height: $(this).height()
                        });
                    },
                    drag: function (e, ui) {
                        var d = $(this).data('draggable'),
                            left = ui.position.left -= ui.originalPosition.left, // normalize to colWith
                            move = Math.floor(left / colWidth),
                            day = d.my.initPos + move,
                            top = ui.position.top;

                        // correct position
                        if (d.my.firstPos === d.my.lastPos) { // start and end on same day
                            d.my.mode = 4;
                        } else if (day === d.my.firstPos + move) { // drag first element
                            d.my.mode = 3;
                        } else if (day === d.my.lastPos + move) { // drag last element
                            d.my.mode = 2;
                        } else { // drag in all other cases
                            d.my.mode = 1;
                        }

                        // abort moving
                        if (day < 0 || day >= self.columns) {
                            left = ui.position.left = d.my.lastLeft;
                        } else {
                            // hide apppintment parts outside of the pane
                            if (d.my.mode < 4) {
                                d.my.all.show();
                                if (d.my.firstPos + move < 0) {
                                    d.my.all.slice(0, Math.abs(d.my.firstPos + move)).hide();
                                } else if (d.my.lastPos + move >= self.columns) {
                                    d.my.all.slice((d.my.lastPos + move - self.columns + 1) * -1).hide();
                                }
                            }
                        }

                        if (d.my.mode === 4 && (top < 0 || (top + d.my.height) > paneHeight)) {
                            top = ui.position.top = d.my.lastTop;
                        }

                        // apply new position
                        d.my.all.css('left', left);

                        // elements do not move
                        if (ui.position.top < 0 || d.my.mode <= 2) {
                            ui.position.top = 0;
                        }

                        // last element
                        if (d.my.mode === 2) {
                            d.options.axis = 'x';
                        }

                        // handling on multi-drag
                        if (d.my.mode < 4) {
                            if (d.my.lastTop !== top) {
                                var diff = top - d.my.lastTop,
                                    firstTop = d.my.firstTop + diff,
                                    lastHeight = d.my.lastHeight + diff;

                                // calc first position
                                if (((d.my.firstTop >= 0 && firstTop < 0) || (d.my.firstTop >= paneHeight && firstTop < paneHeight)) && diff < 0) {
                                    $('.week-container .day[date="' + (--d.my.firstPos) + '"]', self.$el)
                                        .append($(this).clone());
                                    d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]', self.$el);
                                }
                                if (((d.my.firstTop < 0 && firstTop >= 0) || (d.my.firstTop < paneHeight && firstTop >= paneHeight)) && diff > 0) {
                                    d.my.firstPos++;
                                    d.my.all.first().remove();
                                    d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]', self.$el);
                                }
                                if (firstTop < 0) {
                                    firstTop += paneHeight;
                                } else if (firstTop >= paneHeight) {
                                    firstTop -= paneHeight;
                                }
                                // update first element
                                d.my.all.first().css({
                                    top: firstTop,
                                    height: paneHeight - firstTop
                                });

                                // calc last position
                                if (((d.my.lastHeight <= 0 && lastHeight > 0) || (d.my.lastHeight <= paneHeight && lastHeight > paneHeight)) && diff > 0) {
                                    $('.week-container .day[date="' + (++d.my.lastPos) + '"]', self.$el)
                                        .append($(this).clone());
                                    d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]', self.$el);
                                }
                                if (((d.my.lastHeight > 0 && lastHeight <= 0) || (d.my.lastHeight > paneHeight && lastHeight <= paneHeight)) && diff < 0) {
                                    d.my.lastPos--;
                                    d.my.all.last().remove();
                                    d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]', self.$el);
                                }
                                if (lastHeight <= 0) {
                                    lastHeight += paneHeight;
                                } else if (lastHeight > paneHeight) {
                                    lastHeight -= paneHeight;
                                }
                                d.my.all.last().css({
                                    top: 0,
                                    height: lastHeight
                                });

                                d.my.firstTop += diff;
                                d.my.lastHeight += diff;
                            }
                        }
                        d.my.lastTop = top;
                        d.my.lastLeft = left;
                    },
                    stop: function (e, ui) {
                        var d = $(this).data('draggable'),
                            off = $('.week-container', this.$el).offset(),
                            move = Math.round(ui.position.left / colWidth),
                            app = self.collection.get($(this).data('cid')).attributes,
                            startTS = new date.Local(app.start_date)
                                .add(self.getTimeFromPos(d.my.lastTop - ui.originalPosition.top))
                                .add(move * date.DAY)
                                .getTime();

                        if (e.pageX < window.innerWidth && e.pageX > off.left && e.pageY < window.innerHeight) {
                            // save for update calculations
                            app.old_start_date = app.start_date;
                            app.old_end_date = app.end_date;
                            app.drag_move = move;
                            _.extend(app, {
                                start_date: startTS,
                                end_date: startTS + (app.end_date - app.start_date)
                            });
                            d.my.all.busy();
                            // disable widget
                            $(this).draggable('disable');
                            self.onUpdateAppointment(app);
                        } else {
                            self.trigger('onRefresh');
                        }
                        d.my = null;
                    }
                });

            $('.week-container .day', this.$el).droppable();

            // remove unused resizable panes
            $('.day>.appointment.rmnorth .ui-resizable-n, .day>.appointment.rmsouth .ui-resizable-s', this.$el)
                .remove();

            // init drag and resize widget on full-time appointments
            $('.fulltime>.appointment.modify', this.$el)
                .draggable({
                    grid: [colWidth, 0],
                    axis: 'x',
                    scroll: true,
                    snap: '.day',
                    zIndex: 2,
                    stop: function (e) {
                        if (e.pageX < window.innerWidth && e.pageY < window.innerHeight) {
                            $(this).draggable('disable').busy();
                            var newPos = Math.round($(this).position().left / (self.fulltimePane.width() / self.columns)),
                                startTS = self.startDate.getDays() * date.DAY + newPos * date.DAY,
                                cid = $(this).data('cid'),
                                app = self.collection.get(cid).attributes;
                            // save for update calculations
                            app.old_start_date = app.start_date;
                            app.old_end_date = app.end_date;
                            _.extend(app, {
                                start_date: startTS,
                                end_date: startTS + (app.end_date - app.start_date)
                            });
                            self.onUpdateAppointment(app);
                        } else {
                            self.trigger('onRefresh');
                        }
                    }
                })
                .resizable({
                    grid: [colWidth, 0],
                    minWidth: colWidth,
                    handles: 'w, e',
                    containment: 'parent',
                    start: function () {
                        $(this).addClass('opac').css('zIndex', $(this).css('zIndex') + 2000);
                    },
                    stop: function (e, ui) {
                        var el = $(this),
                            cid = el.data('cid'),
                            app = self.collection.get(cid).attributes,
                            newDayCount = Math.round(el.outerWidth() / (self.fulltimePane.width() / self.columns));
                        // save for update calculations
                        app.old_start_date = app.start_date;
                        app.old_end_date = app.end_date;
                        el.removeClass('opac').css('zIndex', $(this).css('zIndex') - 2000);

                        if (el.position().left !== ui.originalPosition.left) {
                            _.extend(app, {
                                start_date: app.end_date - (newDayCount * date.DAY)
                            });
                        } else if (el.width() !== ui.originalSize.width) {
                            _.extend(app, {
                                end_date: app.start_date + (newDayCount * date.DAY)
                            });
                        }
                        el.resizable('disable').busy();
                        self.onUpdateAppointment(app);
                    }
                });
        },

        /**
         * render an single appointment
         * @param  {Backbone.Model} a Appointment Model
         * @return {Object}   a jQuery object of the appointment
         */
        renderAppointment: function (a) {
            var el = $('<div>')
                .addClass('appointment')
                .attr({
                    'data-cid': a.id,
                    'data-extension-point': this.extPoint,
                    'data-composite-id': a.id
                });

            ext.point(this.extPoint)
                .invoke('draw', el, ext.Baton(_.extend({}, this.options, {model: a, folder: this.folder()})));
            return el;
        },

        /**
         * redraw a rendered appointment
         * @param  {Backbone.Model} a Appointment Model
         */
        redrawAppointment: function (a) {
            var positionFieldChanged = _(['start_date', 'end_date', 'full_time'])
                .any(function (attr) { return !_.isUndefined(a.changed[attr]); });
            if (positionFieldChanged) {
                this.renderAppointments();
            } else {
                var el = $('[data-cid="' + a.id + '"]', this.$el);
                el.replaceWith(this.renderAppointment(a)
                    .attr('style', el.attr('style')));
            }
        },

        /**
         * round an integer to the next grid size
         * @param  {number} pos position as integer
         * @param  {String} typ specifies the used rounding algorithm {n=floor, s=ceil, else round}
         * @return {number}     rounded value
         */
        roundToGrid: function (pos, typ) {
            var h = this.gridHeight();
            switch (typ) {
            case 'n':
                typ = 'floor';
                break;
            case 's':
                typ = 'ceil';
                break;
            default:
                typ = 'round';
                break;
            }
            return Math[typ](pos / h) * h;
        },

        /**
         * calculate css position paramter (top and left) of an appointment
         * @param  {Object} ap meta object of the appointment
         * @return {Object}    object containin top and height values
         */
        calcPos: function (ap) {
            var start = new date.Local(ap.start),
                end = new date.Local(ap.end),
                self = this,
                calc = function (d) {
                    return (d.getHours() / 24 + d.getMinutes() / 1440) * self.height();
                },
                s = calc(start),
                e = calc(end);
            return {
                top: s,
                height: Math.max(Math.round(e - s), self.minCellHeight) - 1
            };
        },

        /**
         * get timestamp from date marker
         * @param  {number} tag value of the day [0 - 6] for week view
         * @return {number}     timestamp
         */
        getTimeFromDateTag: function (tag)  {
            return new date.Local(this.startDate.getTime()).addUTC(tag * date.DAY);
        },

        /**
         * calc daily timestamp from mouse position
         * @param  {number} pos       mouse x position
         * @param  {String} roundType specifies the used rounding algorithm {n=floor, s=ceil, else round}
         * @return {number}           closest grid position
         */
        getTimeFromPos: function (pos, roundType) {
            return this.roundToGrid(pos, roundType || '') / this.height() * date.DAY;
        },

        /**
         * calculate complete height of the grid
         * @return {number} height of the grid
         */
        height: function () {
            return this.cellHeight * this.slots * this.fragmentation;
        },

        /**
         * calculate height of a single grid fragment
         * @return {number} height of a single grid fragment
         */
        gridHeight: function () {
            return this.cellHeight * this.fragmentation / this.gridSize;
        },

        /**
         * get property of showAll checkbox
         * @return {Boolean}     value of the showAllPrivateAppointments setting (only when opt param === undefined)
         */
        showAll: function () {
            return settings.get('showAllPrivateAppointments', false);
        },

        /**
         * get or set current folder data
         * @param  {Object} data folder data
         * @return {Object}      if (data === undefined) current folder data
         *                       else object containing start and end timestamp of the current week
         */
        folder: function (data) {
            if (data) {
                // set view data
                this.folderData = data;
            }
            return this.folderData;
        },

        /**
         * collect request parameter to realize monthly chunks
         * @return {object} object with startdate, enddate and folderID
         */
        getRequestParam: function () {
            // return update data
            return {
                start: this.apiRefTime.getTime(),
                end: new date.Local(this.apiRefTime).add(10 * date.WEEK).getTime(),
                folder: (this.folderData.type > 1 || this.showAll() === false) ? this.folderData.id : 0
            };
        },

        /**
         * save current scrollposition for the view instance
         */
        save: function () {
            // save scrollposition
            this.restoreCache = this.pane.scrollTop();
        },

        /**
         * restore scrollposition for the view instance
         */
        restore: function () {
            // restore scrollposition
            if (this.restoreCache) {
                this.pane.scrollTop(this.restoreCache);
            }
        },

        print: function () {
            var start = this.startDate.local,
                end = start + (date.DAY * this.columns),
                self = this,
                folder = this.folder(this.folder()),
                templates = {
                    'day': {name: 'cp_dayview_table_appsuite.tmpl'},
                    'workweek': {name: 'cp_weekview_table_appsuite.tmpl'},
                    'week': {name: 'cp_weekview_table_appsuite.tmpl'}
                };
            var tmpl = templates[self.mode],
                data = null;
            if (folder.id || folder.folder) {
                data = {folder_id: folder.id || folder.folder};
            }
            ox.load(['io.ox/core/print']).done(function (print) {
                print.open('printCalendar', data, {
                    template: tmpl.name,
                    start: start,
                    end: end,
                    work_day_start_time: self.workStart * date.HOUR,
                    work_day_end_time: self.workEnd * date.HOUR
                }).print();
            });
        }
    });

    ext.point('io.ox/calendar/week/view/appointment').extend({
        id: 'default',
        index: 100,
        draw: function (baton) {
            var self = this,
                a = baton.model,
                folder = baton.folder,
                conf = 1,
                confString = _.noI18n('%1$s'),
                classes = '';
            if (a.get('private_flag') && ox.user_id !== a.get('created_by') && !folderAPI.is('private', folder)) {
                classes = 'private disabled';
            } else {
                conf = util.getConfirmationStatus(a.attributes, folderAPI.is('shared', folder) ? folder.created_by : ox.user_id);
                classes = (a.get('private_flag') ? 'private ' : '') + util.getShownAsClass(a.attributes) +
                    ' ' + util.getConfirmationClass(conf) +
                    (folderAPI.can('write', baton.folder, a.attributes) ? ' modify' : '');
                if (conf === 3) {
                    confString =
                        //#. add confirmation status behind appointment title
                        //#. %1$s = apppintment title
                        //#, c-format
                        gt('%1$s\u00A0(Tentative)');
                }
            }

            this
                .attr({ tabindex: 1 })
                .addClass(classes)
                .append(
                    $('<div>')
                    .addClass('appointment-content')
                    .append(
                        $('<span class="private-flag"><i class="icon-lock"></i></span>')[a.get('private_flag') ? 'show' : 'hide'](),
                        $('<div>').addClass('title').text(gt.format(confString, gt.noI18n(a.get('title') || '\u00A0'))),
                        $('<div>').addClass('location').text(gt.noI18n(a.get('location') || '\u00A0'))
                    )
                )
                .attr({
                    'data-extension': 'default'
                });

            util.isBossyAppointmentHandling({ app: a.attributes, folderData: folder }).then(function (isBossy) {
                if (!isBossy) {
                    self.removeClass('modify');
                }
            });
        }
    });

    return View;
});
