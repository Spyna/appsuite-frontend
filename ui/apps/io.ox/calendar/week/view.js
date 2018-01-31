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

define('io.ox/calendar/week/view', [
    'io.ox/core/extensions',
    'io.ox/calendar/util',
    'io.ox/core/folder/api',
    'gettext!io.ox/calendar',
    'settings!io.ox/calendar',
    'settings!io.ox/core',
    'io.ox/backbone/mini-views/dropdown',
    'io.ox/core/print',
    'static/3rd.party/jquery-ui.min.js',
    'io.ox/calendar/week/extensions'
], function (ext, util, folderAPI, gt, settings, coreSettings, Dropdown, print) {

    'use strict';

    // helper

    function getTimezoneLabels() {

        var list = _.intersection(
            settings.get('favoriteTimezones', []),
            settings.get('renderTimezones', [])
        );

        // avoid double appearance of default timezone
        return _(list).without(coreSettings.get('timezone'));
    }

    var View = Backbone.View.extend({

        className:      'week',

        columns:        7,      // default value for day columns
        gridSize:       2,      // grid fragmentation of a hour
        cellHeight:     24,     // height of one single fragment in px
        minCellHeight:  24,     // min height of one single fragment in px
        paneHeight:     0,      // the height of the pane. is stored if the pane is not visible
        fulltimeHeight: 20,     // height of full-time appointments in px
        fulltimeMax:    5,      // threshold for visible full-time appointments in scrollpane header
        appWidth:       98,     // max width of an appointment in %
        overlap:        0.35,   // visual overlap of appointments [0.0 - 1.0]
        slots:          24,     // amount of shown time-slots
        workStart:      8,      // full hour for start position of working time marker
        workEnd:        18,     // full hour for end position of working time marker
        mode:           0,      // view mode {1: day, 2: workweek, 3: week }
        showDeclined:   false,  // show declined appointments
        limit:          1000,   // limit for number of appointments. If there are more appointments resize drag and opacity functions are disabled for performace resons

        startDate:      null,   // start of day/week as local date (use as reference point)
        apiRefTime:     null,   // current reference time for api calls
        clickTimer:     null,   // timer to separate single and double click
        clicks:         0,      // click counter
        lasso:          false,  // lasso object
        folderData:     {},     // current folder object
        restoreCache:   null,   // object, which contains data for save and restore functions
        extPoint:       null,   // appointment extension
        dayLabelRef:    null,   // used to manage redraw on daychange
        startLabelRef:  null,   // used to manage redraw on weekchange

        // startup options
        options:        {
            todayClass: 'today',
            showFulltime: true,
            keyboard: true,
            allowLasso: true
        },

        events: (function () {
            // define view events
            var events = {
                'click .control.next,.control.prev': 'onControlView',
                'click .appointment': 'onClickAppointment',
                'click .weekday': 'onCreateAppointment'
            };

            if (_.device('touch')) {
                _.extend(events, {
                    'taphold .week-container>.day,.fulltime>.day': 'onCreateAppointment',
                    'swipeleft': 'onControlView',
                    'swiperight': 'onControlView'
                });
            } else {
                _.extend(events, {
                    'dblclick .week-container>.day,.fulltime>.day': 'onCreateAppointment'
                });
                if (_.device('desktop')) {
                    _.extend(events, {
                        'mouseenter .appointment': 'onHover',
                        'mouseleave .appointment': 'onHover',
                        'mousedown .week-container>.day': 'onLasso',
                        'mousemove .week-container>.day': 'onLasso',
                        'mouseup': 'onLasso'
                    });
                }
            }
            return events;
        }()),

        // init values from perspective
        initialize: function (opt) {
            var self = this;

            // init options
            this.options = _.extend({}, this.options, opt);

            // initialize main objects
            _.extend(this, {
                pane:         $('<div class="scrollpane f6-target" tabindex="-1">').on('scroll', this.updateHiddenIndicators.bind(this)),
                fulltimePane: $('<div class="fulltime">'),
                fulltimeCon:  $('<div class="fulltime-container">'),
                fulltimeNote: $('<div class="node">'),
                timeline:     $('<div class="timeline">'),
                dayLabel:     $('<div class="footer">'),
                kwInfo:       _.device('smartphone') ? $('<div class="info">') : $('<a href="#" class="info">').on('click', $.preventDefault),
                weekCon:      $('<div class="week-container">'),
                moreAppointmentsIndicators: $('<div class="more-appointments-container">')
            });

            this.kwInfo.attr({
                'aria-label': gt('Use cursor keys to change the date. Press ctrl-key at the same time to change year or shift-key to change month. Close date-picker by pressing ESC key.')
            });

            this.app = opt.app;
            this.perspective = opt.perspective;
            this.mode = opt.mode || 'day';
            this.extPoint = opt.appExtPoint;
            this.refDate = opt.refDate || moment();

            switch (this.mode) {
                case 'day':
                    this.$el.addClass('dayview');
                    this.columns = 1;
                    break;
                case 'workweek':
                    this.$el.addClass('workweekview');
                    this.columns = settings.get('numDaysWorkweek');
                    break;
                default:
                case 'week':
                    this.$el.addClass('weekview');
                    this.columns = 7;
                    break;
            }

            this.setStartDate(this.refDate);
            this.initSettings();

            //append datepicker
            if (!_.device('smartphone')) {
                require(['io.ox/backbone/views/datepicker'], function (Picker) {
                    new Picker({ date: self.startDate })
                        .attachTo(self.kwInfo)
                        .on('select', function (date) {
                            self.setStartDate(date, false);
                            self.trigger('onRefresh');
                        })
                        .on('before:open', function () {
                            this.setDate(self.startDate);
                        });
                });
            }

            if (this.mode === 'workweek') {
                this.listenTo(settings, 'change:numDaysWorkweek change:workweekStart', function () {
                    function reset() {
                        var scrollTop = self.pane.scrollTop();
                        // clean up
                        self.pane.empty();
                        self.fulltimePane.empty();
                        self.fulltimeCon.empty();
                        self.fulltimeNote.empty();
                        self.timeline.empty();
                        self.weekCon.empty();
                        self.moreAppointmentsIndicators.empty();
                        // render again
                        self.columns = settings.get('numDaysWorkweek');
                        self.setStartDate();
                        self.render();
                        self.renderAppointments();
                        self.perspective.refresh();
                        // reset pane
                        self.pane.scrollTop(scrollTop);
                        self.pane.on('scroll', self.updateHiddenIndicators.bind(self));
                        if (_.device('!smartphone')) {
                            self.kwInfo.on('click', $.preventDefault);
                            require(['io.ox/backbone/views/datepicker'], function (Picker) {
                                new Picker({ date: self.startDate })
                                    .attachTo(self.kwInfo)
                                    .on('select', function (date) {
                                        self.setStartDate(date);
                                        self.trigger('onRefresh');
                                    });
                            });
                        }
                    }

                    if ($('.time:visible', self.pane).length === 0) self.app.getWindow().one('show', reset);
                    else reset();
                });
            }
        },

        /**
         * reset appointment collection
         * avoids processing concurrent requests in wrong order
         * @param  { number } startDate starttime from inital request
         * @param  { array }  data      all appointments returend by API
         */
        reset: function (startDate, models) {
            if (startDate === this.apiRefTime.valueOf()) {
                var ws = this.startDate.valueOf(),
                    we = moment(this.startDate).add(this.columns, 'days').valueOf();
                models = _(models).filter(util.rangeFilter(ws, we));
                // reset collection; transform raw dato to proper models
                this.collection.reset(models);
                if (this.collection.length > this.limit) {
                    var self = this;
                    console.warn('Too many appointments. There are ' + this.collection.length + ' appointments. The limit is ' + this.limit + '. Resize, drag and opacity are disabled due to performance reasons.');
                    require(['io.ox/core/yell'], function (yell) {
                        //#. %1$n is the maximum number of appointments
                        yell('warning', gt('There are more than %n appointments in the current calendar. Some features are disabled due to performance reasons.', self.limit));
                    });
                }
                this.renderAppointments();
            }
        },

        setCollection: function (collection) {
            if (this.collection === collection) return;

            if (this.collection) this.stopListening(this.collection);
            this.collection = collection;

            this.renderAppointments();

            this
                .listenTo(this.collection, 'change', this.redrawAppointment, this)
                .listenTo(this.collection, 'add remove reset', _.debounce(this.renderAppointments), this);
        },

        /**
         * set week reference start date
         * @param { string|number|LocalDate } opt
         *        number: Timestamp of a date in the reference week. Now if empty
         *        string: { 'next', 'prev' } set next or previous week
         *        moment: moment date object in the reference week
         * @param { boolean } utc     true if full-time appointment
         */
        setStartDate: function (opt, utc) {
            utc = utc || false;
            if (opt) {
                // number | LocalDate
                if (typeof opt === 'number' || moment.isMoment(opt)) {
                    if (utc) {
                        opt = moment.utc(opt).local(true).valueOf();
                    }
                    this.startDate = moment(opt);
                    this.refDate = moment(this.startDate);
                }
                //string
                if (typeof opt === 'string') {
                    this.startDate[opt === 'prev' ? 'subtract' : 'add'](1, this.columns === 1 ? 'day' : 'week');
                    this.refDate[opt === 'prev' ? 'subtract' : 'add'](1, this.columns === 1 ? 'day' : 'week');
                }
            } else {
                // today button
                this.startDate = moment();
                this.refDate = moment(this.startDate);
            }

            // normalize startDate to beginning of the week or day
            switch (this.mode) {
                case 'day':
                    this.startDate.startOf('day');
                    break;
                case 'workweek':
                    // settings independent, set startDate to Monday of the current week
                    this.startDate.startOf('week').day(settings.get('workweekStart'));
                    break;
                default:
                case 'week':
                    this.startDate.startOf('week');
                    break;
            }
            // set api reference date to the beginning of the month
            var month = this.startDate.month();
            if (month % 2 === 1) {
                month--;
            }
            this.apiRefTime = moment(this.startDate).month(month).date(1);
            if (this.app) this.app.refDate = this.refDate;
        },

        /**
         * apply new reference date and refresh view
         */
        applyRefDate: function () {
            this.setStartDate(this.refDate.valueOf());
            this.trigger('onRefresh');
        },

        /**
         * setup setting params
         */
        initSettings: function () {
            // init settings
            var self = this;
            this.gridSize = 60 / settings.get('interval', 30);
            this.workStart = settings.get('startTime', this.workStart) * 1;
            this.workEnd = settings.get('endTime', this.workEnd) * 1;
            settings.on('change', function (key) {
                switch (key) {
                    case 'favoriteTimezones':
                    case 'renderTimezones':
                        self.app.getWindow().one('show', function () {
                            self.adjustCellHeight(true);
                        });
                        break;
                    case 'interval':
                        var calculateTimescale = function () {
                            // save scroll ratio
                            var scrollRatio = (self.pane.scrollTop() + self.pane.height() / 2) / self.height();
                            // reset height of .time fields, since the initial height comes from css
                            $('.time', self.pane).css('height', '');
                            self.adjustCellHeight(false);
                            self.renderAppointments();
                            // restore scroll position from ratio
                            self.pane.scrollTop(scrollRatio * self.height() - self.pane.height() / 2);
                        };

                        self.gridSize = 60 / settings.get('interval', 30);
                        self.renderTimeslots();
                        self.applyTimeScale();

                        // if this function is called while the calendar app is not visible we get wrong height measurements
                        // so wait until the next show event, to calculate correctly
                        if ($('.time:visible', self.pane).length === 0) {
                            self.app.getWindow().one('show', calculateTimescale);
                        } else {
                            calculateTimescale();
                        }
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
         * @param  { MouseEvent } e Hover event (mouseenter, mouseleave)
         */
        onHover: function (e) {
            if (!this.lasso) {
                var cid = util.cid(String($(e.currentTarget).data('cid'))),
                    el = $('[data-cid^="' + cid.folder + '.' + cid.id + '"]', this.$el),
                    bg = el.data('background-color');
                switch (e.type) {
                    case 'mouseenter':
                        if (e.relatedTarget && e.relatedTarget.tagName !== 'TD') {
                            el.addClass('hover');
                            if (bg) el.css('background-color', util.lightenDarkenColor(bg, 0.9));
                        }
                        break;
                    case 'mouseleave':
                        el.removeClass('hover');
                        if (bg) el.css('background-color', bg);
                        break;
                    default:
                        break;
                }
            }
        },

        /**
         * handler for clickevents in toolbar
         * @param  { MouseEvent } e Clickevent
         */
        onControlView: function (e) {
            e.preventDefault();
            var cT = $(e.currentTarget);
            if (cT.hasClass('next') || (e.type === 'swipeleft' && !this.lasso)) {
                this.setStartDate('next');
            }
            if (cT.hasClass('prev') || (e.type === 'swiperight' && !this.lasso)) {
                this.setStartDate('prev');
            }
            this.trigger('onRefresh');
            return false;
        },

        /**
         * Get visible edges in time format
         */
        getTimeOfVisibleEdges: function () {
            return {
                min: this.getTimeFromPos(this.pane.scrollTop()),
                max: this.getTimeFromPos(this.pane.scrollTop() + this.pane.height())
            };
        },

        /**
         * handler to update indicators for hidden appointments
         *
         * this handler is throttled to only run once every 100ms
         *
         */
        updateHiddenIndicators: (function () {
            function indicatorButton(column, width) {
                return $('<span>')
                        .addClass('more-appointments fa')
                        .css({
                            left: (column * width) + '%',
                            width: width + '%'
                        });
            }

            return _.throttle(function () {
                var min = this.pane.scrollTop(),
                    max = this.pane.scrollTop() + this.pane.height(),
                    threshold = 3,
                    columnWidth = 100 / this.columns;

                this.moreAppointmentsIndicators.empty();
                for (var d = 0; d < this.columns; d++) {
                    var appointments = this.weekCon.find('.day:nth-child(' + (d + 1) + ') > .appointment');
                    var earlier = appointments.filter(function (index, el) {
                        el = $(el);
                        return el.position().top + el.height() - threshold < min;
                    }).length;
                    var later = appointments.filter(function (index, el) {
                        el = $(el);
                        return el.position().top + threshold > max;
                    }).length;
                    if (earlier > 0) {
                        this.moreAppointmentsIndicators.append(
                            indicatorButton(d, columnWidth)
                                .addClass('earlier fa-caret-up')
                        );
                    }
                    if (later > 0) {
                        this.moreAppointmentsIndicators.append(
                            indicatorButton(d, columnWidth)
                                .addClass('later fa-caret-down')
                        );
                    }
                }
            }, 100);
        }()),

        /**
         * handler for key events in view
         * @param  { KeyEvent } e Keyboard event
         */
        fnKey: function (e) {
            if (!this.options.keyboard) {
                return false;
            }
            switch (e.which) {
                case 27:
                    // ESC
                    this.cleanUpLasso();
                    $('.week-container .day>.appointment.modify', this.$el)
                    .draggable({ 'revert': true })
                    .trigger('mouseup');
                    break;
                case 37:
                    // left
                    this.setStartDate('prev');
                    this.trigger('onRefresh');
                    break;
                case 39:
                    // right
                    this.setStartDate('next');
                    this.trigger('onRefresh');
                    break;
                case 13:
                    // enter
                    this.onClickAppointment(e);
                    break;
                case 32:
                    // space
                    e.preventDefault();
                    this.onClickAppointment(e);
                    break;
                default:
                    break;
            }
        },

        /**
         * handler for single- and double-click events on appointments
         * @param  { MouseEvent } e Mouse event
         */
        onClickAppointment: function (e) {
            var cT = $(e[(e.type === 'keydown') ? 'target' : 'currentTarget']);
            if (cT.hasClass('appointment') && !this.lasso && !cT.hasClass('disabled')) {
                var self = this,
                    obj = util.cid(String(cT.data('cid')));
                if (!cT.hasClass('current') || _.device('smartphone')) {
                    // ignore the "current" check on smartphones
                    $('.appointment', self.$el)
                        .removeClass('current opac')
                        .not($('[data-cid^="' + obj.folder + '.' + obj.id + '"]', self.$el))
                        .addClass((this.collection.length > this.limit || _.device('smartphone')) ? '' : 'opac'); // do not add opac class on phones or if collection is too large
                    $('[data-cid^="' + obj.folder + '.' + obj.id + '"]', self.$el).addClass('current');
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
         * @param  { MouseEvent } e double click event
         */
        onCreateAppointment: function (e) {

            e.preventDefault();

            if (!folderAPI.can('create', this.folder())) return;

            var start = this.getTimeFromDateTag($(e.currentTarget).attr('date'));

            if ($(e.target).hasClass('timeslot')) {
                // calculate timestamp for current position
                start.add(this.getTimeFromPos(e.target.offsetTop), 'milliseconds');
                this.trigger('openCreateAppointment', e, {
                    startDate: { value: start.format('YYYYMMDD[T]HHmmss'), tzid:  start.tz() },
                    endDate: { value: start.add(1, 'hour').format('YYYYMMDD[T]HHmmss'), tzid:  start.tz() }
                });
            }
            if ($(e.target).hasClass('day') || $(e.target).hasClass('weekday')) {
                // calculate timestamp for current position
                this.trigger('openCreateAppointment', e, {
                    startDate: { value: start.utc(true).format('YYYYMMDD') },
                    endDate: { value: start.add(1, 'day').format('YYYYMMDD') }
                });
            }
        },

        /**
         * handler for appointment updates
         * @param  { Object } event event model
         */
        onUpdateAppointment: function (event) {
            if (event.get('startDate') && event.get('endDate') && event.getTimestamp('startDate') <= event.getTimestamp('endDate')) {
                this.trigger('updateAppointment', event);
            }
        },

        /**
         * handler for lasso function in grid
         * @param  { MouseEvent } e mouseevents on day container
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
                        this.mousedownAt = e.pageY + this.pane.scrollTop();
                    }
                    break;

                case 'mousemove':
                    e.preventDefault();
                    var cT = $(e.currentTarget),
                        curDay = parseInt(cT.attr('date'), 10),
                        mouseY = e.pageY - (this.pane.offset().top - this.pane.scrollTop()),
                        thresholdExceeded = Math.abs(this.mousedownAt - (e.pageY + this.pane.scrollTop())) > 4;

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
                        if (!thresholdExceeded) return;
                        this.lasso = $('<div>')
                            .addClass('appointment lasso')
                            .css({
                                height: this.cellHeight,
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
                            start.add(this.getTimeFromPos(Math.min(l.start, l.stop)), 'milliseconds');
                            end.add(this.getTimeFromPos(Math.max(l.start, l.stop)), 'milliseconds');
                        } else {
                            start.add(this.getTimeFromPos(l.startDay > l.lastDay ? l.stop : l.start), 'milliseconds');
                            end.add(this.getTimeFromPos(l.startDay > l.lastDay ? l.start : l.stop), 'milliseconds');
                        }

                        this.cleanUpLasso();

                        this.trigger('openCreateAppointment', e, {
                            startDate: { value: start.format('YYYYMMDD[T]HHmmss'), tzid: start.tz() },
                            endDate: { value: end.format('YYYYMMDD[T]HHmmss'), tzid: end.tz() }
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
            // more robost variant (see bug 47277)
            var lasso = this.lasso instanceof $ ? this.lasso : $(),
                data = lasso.data() || {};
            $.each(data.helper || [], function (i, el) {
                el.remove();
            });
            lasso.remove();
            this.lasso = false;
        },

        renderTimeLabel: function (timezone, className) {
            var timeLabel = $('<div class="week-container-label" aria-hidden="true">').addClass(className),
                self = this;

            timeLabel.append(
                _(_.range(this.slots)).map(function (i) {
                    var number = moment().startOf('day').hours(i).tz(timezone).format('LT');

                    return $('<div class="time">')
                        .addClass((i >= self.workStart && i < self.workEnd) ? 'in' : '')
                        .addClass((i + 1 === self.workStart || i + 1 === self.workEnd) ? 'working-time-border' : '')
                        .append($('<div class="number">').text(number.replace(/^(\d\d?):00 ([AP]M)$/, '$1 $2')));
                })
            );

            return timeLabel;
        },

        renderTimeLabelBar: function () {
            var self = this;

            if (_.device('!large')) return;

            function drawOption() {
                // this = timezone name (string)
                var timezone = moment.tz(this);
                return [
                    $('<span class="offset">').text(timezone.format('Z')),
                    $('<span class="timezone-abbr">').text(timezone.zoneAbbr()),
                    _.escape(this)
                ];
            }

            function drawDropdown() {
                var list = _.intersection(
                        settings.get('favoriteTimezones', []),
                        settings.get('renderTimezones', [])
                    ),
                    favorites = _(settings.get('favoriteTimezones', [])).chain().map(function (fav) {
                        return [fav, list.indexOf(fav) >= 0];
                    }).object().value(),
                    TimezoneModel = Backbone.Model.extend({
                        defaults: {
                            'default': true
                        },
                        initialize: function (obj) {
                            var self = this;

                            _(obj).each(function (value, key) {
                                self[key] = value;
                            });
                        }
                    }),
                    model = new TimezoneModel(favorites),
                    dropdown = new Dropdown({
                        className: 'dropdown timezone-label-dropdown',
                        model: model,
                        label: moment().tz(coreSettings.get('timezone')).zoneAbbr(),
                        tagName: 'div'
                    })
                        .header(gt('Standard timezone'))
                        .option('default', true, drawOption.bind(coreSettings.get('timezone')));

                if (settings.get('favoriteTimezones', []).length > 0) {
                    dropdown.header(gt('Favorites'));
                }
                $('li[role="presentation"]', dropdown.$ul).first().addClass('disabled');
                $('a', dropdown.$ul).first().removeAttr('data-value').removeData('value');

                _(settings.get('favoriteTimezones', [])).each(function (fav) {
                    if (fav !== coreSettings.get('timezone')) {
                        dropdown.option(fav, true, drawOption.bind(fav));
                    }
                });
                // add keep open for all timezone options, *not* the link to settings (Bug 53471)
                $('a', dropdown.$ul).attr('data-keep-open', 'true');

                dropdown.divider();
                dropdown.link('settings', gt('Manage favorites'), function () {
                    var options = { id: 'io.ox/timezones' };
                    ox.launch('io.ox/settings/main', options).done(function () {
                        this.setSettingsPane(options);
                    });
                });

                $('.dropdown', self.timeLabelBar).remove();
                self.timeLabelBar.append(dropdown.render().$el);
                $('.dropdown-label', dropdown.$el).append($('<i class="fa fa-caret-down" aria-hidden="true">'));

                model.on('change', function (model) {
                    var list = [];

                    _(model.attributes).each(function (value, key) {
                        if (value && key !== 'default') {
                            list.push(key);
                        }
                    });

                    settings.set('renderTimezones', list);
                    settings.save();
                });
            }

            function drawTimezoneLabels() {

                var list = getTimezoneLabels();

                $('.timezone', self.timeLabelBar).remove();

                self.timeLabelBar.prepend(
                    _(list).map(function (tz) {
                        return $('<div class="timezone">').text(moment().tz(tz).zoneAbbr());
                    })
                );

                if (list.length > 0) {
                    self.timeLabelBar.css('width', ((list.length + 1) * 80) + 'px');
                    self.fulltimeCon.css('margin-left', ((list.length + 1) * 80) + 'px');
                    self.dayLabel.css('left', ((list.length + 1) * 80) + 'px');
                    self.moreAppointmentsIndicators.css('left', ((list.length + 1) * 80) + 'px');
                } else {
                    self.timeLabelBar.css('width', '');
                    self.fulltimeCon.css('margin-left', '');
                    self.dayLabel.css('left', '');
                }
            }

            var update = _.throttle(function () {
                drawTimezoneLabels();
            }, 100, { trailing: false });

            var updateAndDrawDropdown = _.throttle(function () {
                drawDropdown();
                drawTimezoneLabels();
            }, 100, { trailing: false });

            settings.on('change:renderTimezones', update);
            settings.on('change:favoriteTimezones', updateAndDrawDropdown);

            this.timeLabelBar = $('<div class="time-label-bar">');
            drawDropdown();
            drawTimezoneLabels();
        },

        /**
         * render the week view
         * @return { Backbone.View } this view
         */
        render: function () {

            // create timelabels
            var primaryTimeLabel = this.renderTimeLabel(coreSettings.get('timezone')),
                self = this;

            this.renderTimeLabelBar();

            /**
             * change the timeline css top value to the current time position
             * @param  { Object } tl Timeline as jQuery object
             */
            var renderTimeline = function () {
                var d = moment();
                self.timeline.css({ top: ((d.hours() / 24 + d.minutes() / 1440) * 100) + '%' });
            };
            // create and animate timeline
            renderTimeline();
            setInterval(renderTimeline, 60000);

            // mattes: guess we don't need this any more in week and work week view
            if (!_.device('touch') && this.columns === 1) {
                this.fulltimePane.empty().append(this.fulltimeNote.text(gt('Doubleclick in this row for whole day appointment'))
                    .addClass('day')
                    .css('width', '100%')
                    .attr({
                        unselectable: 'on',
                        // only used in dayview, so date is always  0
                        date: 0
                    }));
            }

            this.fulltimePane.css({ height: (this.options.showFulltime ? 21 : 1) + 'px' });

            // visual indicators for hidden appointmeints
            this.moreAppointmentsIndicators.css({
                top: (this.options.showFulltime ? 21 : 1) + 'px'
            });

            // create days
            for (var d = 0; d < this.columns; d++) {

                var day = $('<div>')
                    .addClass('day')
                    .width(100 / this.columns + '%')
                    .attr('date', d);

                // add days to fulltime panel
                this.fulltimePane
                    .append(day.clone());

                this.weekCon.append(day);
            }

            this.renderTimeslots();

            var nextStr = this.columns === 1 ? gt('Next Day') : gt('Next Week'),
                prevStr = this.columns === 1 ? gt('Previous Day') : gt('Previous Week');

            // create toolbar, view space and dayLabel
            this.$el.empty().append(
                $('<div class="toolbar">').append(
                    $('<div class="controls-container">').append(
                        $('<a href="#" role="button" class="control prev">').attr({
                            title: prevStr, // TODO: Aria title vs. aria-label
                            'aria-label': prevStr
                        })
                        .append($('<i class="fa fa-chevron-left" aria-hidden="true">')),
                        $('<a href="#" role="button" class="control next">').attr({
                            title: nextStr, // TODO: Aria title vs. aria-label
                            'aria-label': nextStr
                        })
                        .append($('<i class="fa fa-chevron-right" aria-hidden="true">'))
                    ),
                    this.kwInfo
                ),
                $('<div class="footer-container">').append(
                    this.dayLabel
                ),
                $('<div class="week-view-container">').append(
                    this.timeLabelBar,
                    this.fulltimeCon.empty().append(this.fulltimePane),
                    this.pane.empty().append(
                        primaryTimeLabel,
                        self.weekCon
                    ),
                    this.moreAppointmentsIndicators
                ).addClass('time-scale-' + this.gridSize)
            );

            var renderSecondaryTimeLabels = _.throttle(function () {
                var list = getTimezoneLabels();

                $('.secondary-timezone', self.pane).remove();
                $('.week-container-label', self.pane).before(
                    _(list).map(function (tz) {
                        return self.renderTimeLabel(tz).addClass('secondary-timezone');
                    })
                );

                self.adjustCellHeight(true);

                if (list.length > 0) {
                    self.weekCon.css('margin-left', ((list.length + 1) * 80) + 'px');
                    self.pane.addClass('secondary');
                } else {
                    self.weekCon.css('margin-left', '');
                    self.pane.removeClass('secondary');
                }
            }, 100, { trailing: false });

            if (_.device('large')) {
                renderSecondaryTimeLabels();
                settings.on('change:favoriteTimezones', renderSecondaryTimeLabels);
                settings.on('change:renderTimezones', renderSecondaryTimeLabels);
            }

            return this;
        },

        applyTimeScale: function () {
            var weekViewContainer = $('.week-view-container', this.$el);
            // remove all classes like time-scale-*
            weekViewContainer.removeClass(function (index, css) {
                return (css.match(/(^|\s)time-scale-\S+/g) || []).join(' ');
            });
            weekViewContainer.addClass('time-scale-' + this.gridSize);
        },

        renderTimeslots: function () {
            var self = this;
            this.weekCon.children('.day').each(function () {
                var day = $(this);

                day.empty();

                // create timeslots and add days to week container
                for (var i = 1; i <= self.slots * self.gridSize; i++) {
                    day.append(
                        $('<div>')
                        .addClass('timeslot')
                        .addClass((i <= (self.workStart * self.gridSize) || i > (self.workEnd * self.gridSize)) ? 'out' : '')
                        .addClass((i === (self.workStart * self.gridSize) || i === (self.workEnd * self.gridSize)) ? 'working-time-border' : '')
                    );
                }
            });
        },

        rerenderWorktime: function () {
            this.weekCon.find('.day').each(function () {
                $(this).find('.timeslot').each(function (i, el) {
                    i++;
                    $(el).addClass('timeslot');
                });
            });
            return this;
        },

        /**
         * move the calendar window scrolling position, so that the working hours are centered
         */
        setScrollPos: function () {
            this.adjustCellHeight();
            var slotHeight = this.cellHeight * this.gridSize,
                // see bug 40297
                timelineTop = parseFloat(this.timeline[0].style.top) * slotHeight * 0.24;

            // adjust scoll position to center current time
            this.pane.scrollTop(timelineTop - this.pane.height() / 2);
            return this;
        },

        /**
         * adjust cell height to fit into scrollpane
         * @return { View } thie view
         */
        adjustCellHeight: function (redraw) {

            var cells = Math.min(Math.max(4, (this.workEnd - this.workStart + 1)), 18);
            this.paneHeight = this.pane.height() || this.paneHeight;
            this.cellHeight = Math.floor(
                Math.max(this.paneHeight / (cells * this.gridSize), this.minCellHeight)
            );

            // only update if height differs from CSS default
            if (this.cellHeight !== this.minCellHeight) {
                var timeslots = $('.timeslot', this.pane),
                    timeLabel = $('.time', this.pane);
                timeslots.height(this.cellHeight - 1);
                // compute the label height according to the actual height of the timeslot
                // this can be different to 1 when dealing with scaled screen resolutions (see Bug 50195)
                var timeslotHeight = timeslots.get(0).getBoundingClientRect().height,
                    borderWidth = parseFloat(timeLabel.css('border-bottom-width'), 10);
                timeLabel.height(timeslotHeight * this.gridSize - borderWidth);
                // get actual cellHeight from timeslot. This can be different to the computed size due to scaling inside the browser (see Bug 50976)
                // it is important to use getBoundingClientRect as this contains the decimal places of the actual height ($.fn.height does not)
                this.cellHeight = timeslots.get(0).getBoundingClientRect().height;
                // if the cell height changes we also need to redraw all appointments
                if (redraw) this.renderAppointments();
            }
            return this;
        },

        /**
         * render dayLabel with current date information
         * show and hide timeline
         */
        renderDayLabel: function () {
            var days = [],
                today = moment().startOf('day'),
                tmpDate = moment(this.startDate);
            // something new?
            if (this.startDate.valueOf() === this.startLabelRef && today.valueOf() === this.dayLabelRef && this.columnsRef === this.columns) {
                if (this.options.todayClass && this.columns > 1) {
                    var weekViewContainer = $('.week-view-container', this.$el);
                    weekViewContainer.find('.' + this.options.todayClass, this.$el).removeClass(this.options.todayClass);
                    weekViewContainer.find('.day[date="' + today.diff(this.startDate, 'day') + '"]', this.$el).addClass(this.options.todayClass);
                }
                return;
            }

            if (this.options.todayClass) {
                $('.week-view-container .day.' + this.options.todayClass, this.$el).removeClass(this.options.todayClass);
            }

            this.dayLabelRef = today.valueOf();
            this.startLabelRef = this.startDate.valueOf();
            this.columnsRef = this.columns;

            // refresh dayLabel, timeline and today-label
            this.timeline.hide();
            for (var d = 0; d < this.columns; d++) {
                var day = $('<a href="#" class="weekday" role="button">')
                    .attr({
                        date: d,
                        title: gt('Create all-day appointment')
                    })
                    .text(tmpDate.format('ddd D'))
                    .width(100 / this.columns + '%');
                // mark today
                if (util.isToday(tmpDate)) {

                    var todayContainer = $('.week-container .day[date="' + d + '"]', this.pane);

                    if (this.columns > 1) {
                        todayContainer.addClass(this.options.todayClass);
                    }

                    day
                        .prepend($('<span class="sr-only">').text(gt('Today')))
                        .addClass(this.options.todayClass);

                    todayContainer.append(this.timeline);
                    this.timeline.show();
                }
                days.push(day);
                tmpDate.add(1, 'day');
            }

            this.dayLabel.empty().append(days);

            this.kwInfo.empty().append(
                $('<span>').text(
                    this.columns > 1
                        ? this.startDate.formatInterval(moment(this.startDate).add(this.columns - 1, 'days'))
                        : this.startDate.format('ddd, l')
                ),
                $.txt(' '),
                $('<span class="cw">').text(
                    //#. %1$d = Calendar week
                    gt('CW %1$d', moment(this.startDate).format('w'))
                ),
                $('<i class="fa fa-caret-down fa-fw" aria-hidden="true">')
            );

            if (_.device('smartphone')) {
                // pass some dates around
                this.navbarDates = {
                    cw: gt('CW %1$d', this.startDate.format('w')),
                    date: this.columns > 1
                        ? this.startDate.formatInterval(moment(this.startDate).add(this.columns - 1, 'days'))
                        : this.startDate.format('l')
                };
                // bubbling event to get it in page controller
                this.trigger('change:navbar:date', this.navbarDates);
            }
        },

        /**
         * clear all appointments from current week and render all appointments from collection
         */
        renderAppointments: function () {

            this.showDeclined = settings.get('showDeclinedAppointments', false);

            var self = this,
                draw = {},
                appointmentStartDate,
                fulltimeColPos = [0],
                fulltimeCount = 0;

            // clear all first
            $('.appointment', this.$el).remove();

            this.renderDayLabel();

            // loop over all appointments to split and create divs
            this.collection.each(function (model) {

                appointmentStartDate = model.getMoment('startDate');

                // is declined?
                if (util.getConfirmationStatus(model.attributes, ox.user_id) !== 2 || this.showDeclined) {
                    // is fulltime?
                    if (util.isAllday(model) && this.options.showFulltime) {
                        // make sure we have full days when calculating the difference or we might get wrong results
                        appointmentStartDate.startOf('day');

                        fulltimeCount++;
                        var node = this.renderAppointment(model), row,
                            fulltimePos = appointmentStartDate.diff(this.startDate, 'days'),
                            // calculate difference in utc, otherwhise we get wrong results if the appointment starts before a daylight saving change and ends after
                            fulltimeWidth = Math.max(model.getMoment('endDate').diff(appointmentStartDate, 'days') + Math.min(0, fulltimePos), 1);

                        // loop over all column positions
                        for (row = 0; row < fulltimeColPos.length; row++) {
                            if (fulltimeColPos[row] <= model.getTimestamp('startDate')) {
                                fulltimeColPos[row] = model.getTimestamp('endDate');
                                break;
                            }
                        }

                        if (row === fulltimeColPos.length) {
                            fulltimeColPos.push(moment.utc(model.get('endDate').value).valueOf());
                        }
                        node.css({
                            height: this.fulltimeHeight,
                            lineHeight: this.fulltimeHeight + 'px',
                            width: (100 / this.columns) * fulltimeWidth + '%',
                            left: (100 / this.columns) * Math.max(0, fulltimePos) + '%',
                            top: row * (this.fulltimeHeight + 1)
                        });
                        this.fulltimePane.append(node);
                    } else {
                        // fix fulltime appointments to local time when this.showFulltime === false
                        /*if (!model.get('startDate').tzid) {
                            model.set({ startDate: moment.utc(model.get('startDate')).local(true).valueOf() }, { silent: true });
                            model.set({ endDate: moment.utc(model.get('endDate')).local(true).valueOf() }, { silent: true });
                        }*/

                        var startLocal = moment(Math.max(appointmentStartDate.valueOf(), this.startDate.valueOf())),
                            endLocal = model.getMoment('endDate').local(),
                            start = moment(startLocal).startOf('day').valueOf(),
                            end = moment(endLocal).startOf('day').valueOf(),
                            maxCount = 0,
                            style = '';

                        // draw across multiple days
                        while (maxCount <= this.columns) {
                            var app = this.renderAppointment(model),
                                sel = '[date="' + startLocal.diff(this.startDate, 'day') + '"]';
                            maxCount++;

                            if (start !== end) {
                                endLocal = moment(startLocal).endOf('day');
                                if (model.get('endDate').valueOf() - endLocal.valueOf() > 1) {
                                    style += 'rmsouth';
                                }
                            } else {
                                endLocal = model.getMoment('endDate').local();
                            }

                            // kill overlap appointments with length null
                            if (startLocal.valueOf() === endLocal.valueOf() && maxCount > 1) {
                                break;
                            }

                            app.addClass(style).pos = {
                                id: model.id,
                                start: startLocal.valueOf(),
                                end: endLocal.valueOf()
                            };
                            if (!draw[sel]) {
                                draw[sel] = [];
                            }
                            draw[sel].push(app);
                            style = '';
                            // inc date
                            if (start !== end) {
                                start = startLocal.add(1, 'day').startOf('day').valueOf();
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
                this.fulltimePane.css({ height: fulltimeColPos.length * (this.fulltimeHeight + 1) + 'px' });
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
            if (this.timeLabelBar) this.timeLabelBar.css({ top: (ftHeight - 22) + 'px' });

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
                        collisions = 0, p;
                    // loop over all column positions
                    for (p = 0; p < positions.length; p++) {
                        // workaround for appointments with length 0
                        if (app.pos.start === app.pos.end) {
                            app.pos.end++;
                        }
                        if (positions[p] <= app.pos.start) {
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
                    var node = apps[j],
                        pos = self.calcPos(node.pos),
                        idx = Math.min(node.pos.max, positions.length),
                        width = Math.min((self.appWidth / idx) * (1 + (self.overlap * (idx - 1))), self.appWidth),
                        left = idx > 1 ? ((self.appWidth - width) / (idx - 1)) * node.pos.index : 0,
                        border = (left > 0 || (left === 0 && width < self.appWidth)),
                        height = Math.max(pos.height, self.minCellHeight - 1) - (border ? 1 : 0);

                    node.css({
                        top: pos.top,
                        left: left + '%',
                        height: height + 'px',
                        lineHeight: self.minCellHeight + 'px',
                        width: width + '%',
                        minHeight: (self.minCellHeight - (border ? 2 : 1)) + 'px',
                        maxWidth: self.appWidth + '%'
                        // zIndex: j
                    })
                    .addClass(border ? 'border' : '')
                    .addClass(height < 2 * (self.minCellHeight - (border ? 2 : 1)) ? 'no-wrap' : '');
                }
                self.$('.week-container ' + day, self.$el).append(apps);
            });

            $('.week-container .day', this.$el).droppable();

            ext.point('io.ox/calendar/week/view').invoke('draw', this, {
                folder: this.folder()
            });

            this.updateHiddenIndicators();

            // global event for tracking purposes
            ox.trigger('calendar:items:render', this);
        },

        /**
         * render an single appointment
         * @param  { Backbone.Model }   a Appointment Model
         * @return { Object }           a jQuery object of the appointment
         */
        renderAppointment: function (a) {
            var el = $('<div class="appointment">')
                .attr({
                    'data-cid': a.cid,
                    'data-extension-point': this.extPoint,
                    'data-composite-id': a.cid
                });

            ext.point(this.extPoint)
                .invoke('draw', el, ext.Baton(_.extend({}, this.options, { model: a, folder: this.folder() })));
            return el;
        },

        /**
         * redraw a rendered appointment
         * @param  { Backbone.Model } a Appointment Model
         */
        redrawAppointment: function (a) {
            var positionFieldChanged = _(['startDate', 'endDate', 'allDay'])
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
         * @param  { number } pos position as integer
         * @param  { String } typ specifies the used rounding algorithm {n=floor, s=ceil, else round }
         * @return { number }     rounded value
         */
        roundToGrid: function (pos, typ) {
            var h = this.cellHeight;
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
         * @param  { Object } ap meta object of the appointment
         * @return { Object }    object containin top and height values
         */
        calcPos: function (ap) {
            var start = moment(ap.start),
                end = moment(ap.end),
                self = this,
                calc = function (d) {
                    return (d.hours() / 24 + d.minutes() / 1440) * self.height();
                },
                s = calc(start),
                e = calc(end);
            return {
                top: s,
                height: Math.max(Math.floor(e - s), self.minCellHeight) - 1
            };
        },

        /**
         * get moment object from date marker
         * @param  { number } tag value of the day [0 - 6] for week view
         * @return { moment } moment object
         */
        getTimeFromDateTag: function (tag) {
            return moment(this.startDate).add(tag, 'days');
        },

        /**
         * calc daily timestamp from mouse position
         * @param  { number } pos       mouse x position
         * @param  { String } roundType specifies the used rounding algorithm {n=floor, s=ceil, else round }
         * @return { number }           closest grid position
         */
        getTimeFromPos: function (pos, roundType) {
            // multiplay with day milliseconds
            return this.roundToGrid(pos, roundType || '') / this.height() * 864e5;
        },

        /**
         * calculate complete height of the grid
         * @return { number } height of the grid
         */
        height: function () {
            return this.cellHeight * this.slots * this.gridSize;
        },

        /**
         * get or set current folder data
         * @param  { Object } data folder data
         * @return { Object } if (data === undefined) current folder data
         *                    else object containing start and end timestamp of the current week
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
         * @return { Object } object with startdate, enddate and folderID
         */
        getRequestParam: function () {
            // return update data
            return {
                start: this.startDate.valueOf(),
                end: moment(this.startDate).add(this.columns, 'days').valueOf(),
                folder: this.folderData.id,
                view: 'week'
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
            var folder = this.folder();
            print.request('io.ox/calendar/week/print', {
                start: moment(this.startDate).valueOf(),
                end: moment(this.startDate).add(this.columns, 'days').valueOf(),
                folder: folder.id || folder.folder,
                title: folder.title
            });
        }
    });

    return View;
});
