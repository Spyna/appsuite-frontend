/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2012 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/calendar/week/view',
    ['io.ox/calendar/util',
     'io.ox/core/date',
     'gettext!io.ox/calendar',
     'io.ox/core/api/folder',
     'io.ox/backbone/views',
     'less!io.ox/calendar/week/style.css',
     'apps/io.ox/core/tk/jquery-ui.min.js',
     'apps/io.ox/core/tk/jquery.mobile.touch.min.js'], function (util, date, gt, folder, views) {

    'use strict';

    var myself = null;

    var View = Backbone.View.extend({

        className:      'week',

        columns:        7,      // default value for day columns
        fragmentation:  2,      // fragmentation of a hour
        gridSize:       2,      // grid fragmentation of a hour
        cellHeight:     24,     // height of one single fragment in px
        fulltimeHeight: 19,     // height of full-time appointments in px
        fulltimeMax:    5,      // threshold for visible full-time appointments in header
        appWidth:       98,     // max width of an appointment in %
        overlap:        0.35,   // visual overlap of appointments [0.0 - 1.0]
        slots:          24,     // amount of shown time-slots
        workStart:      8,      // full hour for start position of working time marker
        workEnd:        18,     // full hour for end position of working time marker

        curTimeUTC:     0,      // current timestamp
        clickTimer:     null,   // timer to separate single and double click
        clicks:         0,      // click counter
        lasso:          false,  // lasso object
        lassoMode:      true,   // is lasso active
        folder:         {},     // current folder

        pane:           $('<div>').addClass('scrollpane'),              // main scroll pane
        fulltimePane:   $('<div>').addClass('fulltime'),                // full-time appointments pane
        fulltimeCon:    $('<div>').addClass('fulltime-container'),      // full-time container
        timeline:       $('<div>').addClass('timeline'),                // timeline
        footer:         $('<div>').addClass('footer'),                  // footer
        kwInfo:         $('<span>').addClass('info'),                   // current KW
        showAll:        $('<input/>').attr('type', 'checkbox'),         // show all folders check-box
        showAllCon:     $('<div>').addClass('showall'),                 // container

        // define view events
        events: {
            'mousedown .week-container>.day' : 'onLasso',
            'mousemove .week-container>.day' : 'onLasso',
            'mouseup' : 'onLasso',
            'swipeleft .timeslot' : 'onControlView',
            'swiperight .timeslot' : 'onControlView',
            'click .appointment': 'onClickAppointment',
            'mouseenter .appointment': 'onEnterAppointment',
            'mouseleave .appointment': 'onLeaveAppointment',
            'dblclick .week-container>.day' : 'onCreateAppointment',
            'dblclick .fulltime>.day': 'onCreateAppointment',
            'tap .toolbar .control.next': 'onControlView',
            'tap .toolbar .control.prev': 'onControlView',
            'tap .toolbar .link.today': 'onControlView',
            'change .toolbar .showall input[type="checkbox"]' : 'onControlView'
        },

        // handler for onmouseenter event for hover effect
        onEnterAppointment: function (e) {
            if (this.lassoMode) {
                $('[data-cid="' + $(e.currentTarget).data('cid') + '"]').addClass('hover');
            }
        },

        // handler for onmouseleave event for hover effect
        onLeaveAppointment: function (e) {
            if (this.lassoMode) {
                $('[data-cid="' + $(e.currentTarget).data('cid') + '"]').removeClass('hover');
            }
        },

        onControlView: function (e) {
            var cT = $(e.currentTarget),
                t = $(e.target);
            if (cT.hasClass('next') || (t.hasClass('timeslot') && e.type === 'swipeleft')) {
                this.curTimeUTC += (this.columns === 1 ? date.DAY : date.WEEK);
            }
            if (cT.hasClass('prev') || (t.hasClass('timeslot') && e.type === 'swiperight')) {
                this.curTimeUTC -= (this.columns === 1 ? date.DAY : date.WEEK);
            }
            if (cT.hasClass('today')) {
                this.curTimeUTC = this.columns === 1 ? util.getTodayStart() : util.getWeekStart();
            }
            this.trigger('onRefreshView', this.curTimeUTC);
        },

        // handler for single- and double-click events on appointments
        onClickAppointment: function (e) {
            if ($(e.currentTarget).hasClass('appointment') && this.lasso === false) {
                var cid = $(e.currentTarget).data('cid'),
                    obj = _.cid(cid + ''),
                    self = this;
                self.trigger('showAppointment', e, obj);

                if (self.clickTimer === null && self.clicks === 0) {
                    self.clickTimer = setTimeout(function () {
                        clearTimeout(self.clickTimer);
                        self.clicks = 0;
                        self.clickTimer = null;

                        self.$el.find('.appointment')
                            .removeClass('current opac')
                            .not($('[data-cid="' + cid + '"]'))
                            .addClass('opac');
                        $('[data-cid="' + cid + '"]').addClass('current');
                    }, 300);
                }
                self.clicks++;

                if (self.clickTimer !== null && self.clicks === 2) {
                    clearTimeout(self.clickTimer);
                    self.clicks = 0;
                    self.clickTimer = null;
                    self.trigger('openEditAppointment', e, obj);
                }
            }
        },

        onEditAppointment: function (e) {
            var cid = $(e.currentTarget).data('cid'),
                obj = _.cid(cid + '');
            this.trigger('openEditAppointment', e, obj);
        },

        // handler for double-click events on grid
        onCreateAppointment: function (e) {
            if (!folder.can('create', this.folder)) {
                return;
            }
            if ($(e.target).hasClass('timeslot')) {
                // calculate timestamp for current position
                var pos = this.getTimeFromPos(e.target.offsetTop + e.offsetY),
                    startTS = this.getTimeFromDateTag($(e.currentTarget).attr('date')) + pos;
                this.trigger('openCreateAppointment', e, {start_date: startTS, end_date: startTS + date.HOUR});
            }
            if ($(e.target).hasClass('day')) {
                // calculate timestamp for current position
                var startTS = this.getTimeFromDateTag($(e.currentTarget).attr('date'));
                this.trigger('openCreateAppointment', e, {start_date: startTS, end_date: startTS + date.DAY, full_time: true});
            }
        },

        onUpdateAppointment: function (obj) {
            _.each(obj, function (el, i) {
                if (el === null) {
                    delete obj[i];
                }
            });
            this.trigger('updateAppointment', obj);
        },

        onLasso: function (e) {
            if (!this.lassoMode || !folder.can('create', this.folder)) {
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

                var curTar = $(e.currentTarget),
                    curDay = parseInt(curTar.attr('date'), 10),
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
                                    minHeight: this.cellHeight,
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
                            curTar
                                .append(tmpLasso);
                        } else {
                            // change only last helper height
                            lData.last.css({
                                height: right ? this.roundToGrid(mouseY, 's') : 'auto',
                                minHeight: this.cellHeight,
                                top: right ? 0 : this.roundToGrid(mouseY, 'n'),
                                bottom: right ? 'auto' : 0
                            });

                        }
                    } else {
                        var newHeight = Math.abs(lassoStart - this.roundToGrid(mouseY, down ? 's' : 'n'));
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
                            height: this.cellHeight,
                            minHeight: this.cellHeight,
                            top: this.roundToGrid(mouseY, 'n')
                        });
                    this.lasso.data({
                        start: mouseY,
                        stop: 0,
                        startDay: curDay,
                        lastDay: curDay,
                        helper: {}
                    });
                    curTar
                        .append(this.lasso);
                } else {
                    this.trigger('mouseup');
                }

                break;

            case 'mouseup':
                if (_.isObject(this.lasso) && e.which === 1) {
                    var lData = this.lasso.data(),
                        start = this.getTimeFromDateTag(Math.min(lData.startDay, lData.lastDay)),
                        end = this.getTimeFromDateTag(Math.max(lData.startDay, lData.lastDay));

                    if (lData.startDay === lData.lastDay) {
                        start += this.getTimeFromPos(Math.min(lData.start, lData.stop));
                        end += this.getTimeFromPos(Math.max(lData.start, lData.stop));
                    } else {
                        start += this.getTimeFromPos(lData.startDay > lData.lastDay ? lData.stop : lData.start);
                        end += this.getTimeFromPos(lData.startDay > lData.lastDay ? lData.start : lData.stop);
                    }

                    // delete div and reset object
                    $.each(lData.helper, function (i, el) {
                        el.remove();
                    });
                    lData = null;
                    this.lasso.remove();
                    this.trigger('openCreateAppointment', e, {
                        start_date: start,
                        end_date: end
                    });
                }
                this.lasso = false;
                break;

            default:
                break;
            }
            return;
        },

        // init values from prespective
        initialize: function (options) {
            this.columns = options.columns;
            this.curTimeUTC = options.startTimeUTC;
            this.collection.on('reset', this.renderAppointments, this);
        },

        render: function () {
            // create scaffold

            // create timelabels
            var times = [];
            for (var i = 1; i < this.slots; i++) {
                times.push(
                    $('<div>')
                        .addClass('time')
                        .append($('<div>').addClass('number').text(gt.noI18n((i < 10 ? '0' + i : i) + '.00')))
                        .height(this.cellHeight * this.fragmentation)
                );
            }
            times = $('<div>').addClass('lable').append(times);

//            var Blubview = views.point('io.ox/calendar/week/section').createView({
//                tagName: 'div',
//                className: 'lable',
//                render: function () {
//                    var self = this;
//                    this.point.each(function (extension) {
//                        extension.invoke('draw', this.el, self.baton);
//                    });
//                    return this;
//                }
//            });
//
//            new Blubview();

            // create panes
            this.fulltimeCon.empty().append(
                $('<div>').addClass('fulltime-lable'),
                this.fulltimePane.empty()
            );

            // create days container
            var container = $('<div>').addClass('week-container');

            // create and animate timeline
            container.append(this.timeline);
            this.renderTimeline(this.timeline);
            setInterval(this.renderTimeline, 60000, this.timeline);

            // create days
            for (var d = 0; d < this.columns; d++) {

                var day = $('<div>')
                    .addClass('day')
                    .width(100 / this.columns + '%')
                    .attr('date', d);

                // add days to fulltime panel
                this.fulltimePane
                    .append(day.clone());

                // create timeslots
                for (var i = 1; i <= this.slots * this.fragmentation; i++) {
                    day.append(
                        $('<div>')
                            .addClass('timeslot ' + (i > (this.workStart * this.fragmentation) && i <= (this.workEnd * this.fragmentation) ? 'in' : 'out'))
                            .height(this.cellHeight)
                    );
                }
                container.append(day);
            }

            this.pane.empty().append(times, container);

            // create toolbar
            this.$el.empty().append(
                $('<div>')
                    .addClass('toolbar')
                    .append(
                        this.kwInfo,
                        this.showAllCon
                            .empty()
                            .append(
                                $('<label>')
                                    .addClass('checkbox')
                                    .text(gt('show all'))
                                    .prepend(
                                        this.showAll
                                            .prop('checked', true)
                                    )
                            ),
                        $('<div>')
                            .addClass('pagination')
                            .append(
                                $('<ul>')
                                    .append(
                                        $('<li>')
                                            .append(
                                                $('<a href="#">').addClass('control prev').append($('<i>').addClass('icon-chevron-left'))
                                            ),
                                        $('<li>').append(
                                            $('<a>').addClass('link today').text(gt('Today'))
                                        ),
                                        $('<li>')
                                            .append(
                                                    $('<a href="#">').addClass('control next').append($('<i>').addClass('icon-chevron-right'))
                                            )
                                    )
                            )
                    ),
                $('<div>')
                    .addClass('week-view-container')
                    .append(
                        this.fulltimeCon,
                        this.pane,
                        $('<div>')
                            .addClass('footer-container')
                            .append(
                                $('<div>').addClass('footer-lable'),
                                this.footer
                            )
                    )
            );

            return this;
        },

        setScrollPos: function () {
            var slotHeight = this.cellHeight * this.fragmentation,
                workHeight = slotHeight * (this.workEnd - this.workStart),
                newPos = (this.pane.height() - workHeight) / 2;
            // adjust scoll position
            this.pane.scrollTop((slotHeight * this.workStart) - newPos);
        },

        renderTimeline: function (tl) {
            var d = new date.Local();
            tl.css({ top: ((d.getHours() / 24 + d.getMinutes() / 1440) * 100) + '%'});
        },

        renderAppointments: function () {
            // clear all first
            this.$el.find('.appointment').remove();
            $('.day.today').removeClass('today');

            var self = this,
                draw = {},
                fulltimeColPos = [0],
                days = [],
                hasToday = false,
                tmpDate = new date.Local(this.curTimeUTC);

            // refresh footer, timeline and today-label
            for (var d = 0; d < this.columns; d++) {
                days.push(
                        $('<div>')
                        .addClass('weekday')
                        .text(gt.noI18n(tmpDate.format(date.DAYOFWEEK_DATE)))
                        .width(100 / this.columns + '%')
                );
                // mark today
                if (util.isToday(tmpDate.getTime())) {
                    this.pane.find('.day[date="' + d + '"]').addClass('today');
                    hasToday = true;
                }
                tmpDate.add(date.DAY);
            }
            this.footer.empty().append(days);
            this.kwInfo.text(
                gt.noI18n(
                    new date.Local(this.curTimeUTC)
                        .formatInterval(new date.Local(this.curTimeUTC + ((this.columns - 1) * date.DAY)), date.DATE)
                )
            );

            if (hasToday) {
                this.timeline.show();
            } else {
                this.timeline.hide();
            }

            // loop over all appointments to split and create divs
            this.collection.each(function (model) {
                if (model.get('start_date') < 0) {
                    console.error('FIXME: start_date should not be negative');
                    throw 'FIXME: start_date should not be negative';
                }

                if (model.get('full_time')) {
                    var app = this.renderAppointment(model.attributes),
                        fulltimePos = (model.get('start_date') - this.curTimeUTC) / date.DAY,
                        fulltimeWidth = (model.get('end_date') - model.get('start_date')) / date.DAY + Math.min(0, fulltimePos);
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
                        top: row * (this.fulltimeHeight + 1) + 1
                    });
                    this.fulltimePane.append(app);
                } else {
                    var startDate = new date.Local(model.get('start_date')),
                        endDate = new date.Local(model.get('end_date')),
                        start = new date.Local(startDate.getYear(), startDate.getMonth(), startDate.getDate()).getTime(),
                        end = new date.Local(endDate.getYear(), endDate.getMonth(), endDate.getDate()).getTime(),
                        maxCount = 0,
                        style = '';

                    // draw across multiple days
                    while (true && maxCount <= this.columns) {
                        var app = this.renderAppointment(model.attributes),
                            sel = '[date="' + Math.floor((startDate.getTime() - date.Local.utc(this.curTimeUTC)) / date.DAY) + '"]';
                        maxCount++;

                        // if
                        if (start !== end) {
                            endDate = new date.Local(startDate.getTime());
                            endDate.setHours(23, 59, 59, 999);
                            style += 'rmsouth';
                        } else {
                            endDate = new date.Local(model.get('end_date'));
                        }

                        // kill overlap appointments with length null
                        if (startDate.getTime() === endDate.getTime() && maxCount > 1) {
                            break;
                        }

                        app.addClass(style).pos = {
                                id: model.id,
                                start: startDate.getTime(),
                                end: endDate.getTime()
                            };
                        if (!draw[sel]) {
                            draw[sel] = [];
                        }
                        draw[sel].push(app);

                        style = '';
                        // inc date
                        if (start !== end) {
                            startDate.setDate(startDate.getDate() + 1);
                            startDate.setHours(0, 0, 0, 0);
                            start = new date.Local(startDate.getYear(), startDate.getMonth(), startDate.getDate()).getTime();
                            style = 'rmnorth ';
                        } else {
                            break;
                        }
                    }

                }

            }, this);

            // calculate full-time appointment container height
            var ftHeight = (fulltimeColPos.length <= this.fulltimeMax ? fulltimeColPos.length : (this.fulltimeMax + 0.5)) * (this.fulltimeHeight + 1) + 1;
            this.fulltimePane.css({ height: fulltimeColPos.length * (this.fulltimeHeight + 1) + 'px'});
            this.fulltimeCon.add().css({ height: ftHeight + 'px' });
            this.pane.css({ top: ftHeight + 'px' });

            // loop over all single days
            $.each(draw, function (day, apps) {
                // init position Array
                var positions = [0];
                // loop over all apps per day to calculate position
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
                        pos = self.calcPos(app),
                        idx = Math.min(app.pos.max, positions.length),
                        width = Math.min((self.appWidth / idx) * (1 + (self.overlap * (idx - 1))), self.appWidth),
                        left = idx > 1 ? ((self.appWidth - width) / (idx - 1)) * app.pos.index : 0,
                        border = (left > 0 || (left === 0 && width < self.appWidth));

                    app.css({
                        top: pos.top,
                        left: left + '%',
                        height: pos.height - (border ? 0 : 1),
                        width: width + '%',
                        minHeight: self.cellHeight + 'px',
                        maxWidth: self.appWidth + '%',
                        zIndex: j
                    })
                    .addClass(border ? 'border' : '');
                }
                self.$('.week-container ' + day).append(apps);
            });

            // init drag and resize widget on appointments
            var colWidth = $('.day:first').outerWidth(),
                paneOffset = self.pane.children().first().width(),
                paneHeight = self.height();

            $('.week-container .day>.appointment.modify')
                .resizable({
                    handles: "n, s",
                    grid: [0, self.gridHeight()],
                    minHeight: self.gridHeight(),
                    containment: "parent",
                    start: function (e, ui) {
                        self.lassoMode = false;
                        var d = $(this).data('resizable');
                        // init custom resize object
                        d.my = {};
                        // set current day
                        $.extend(d.my, {
                            curHelper: $(this),
                            all: $('[data-cid="' + ui.helper.data('cid') + '"]'),
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
                                d.my.curHelper.height(function (i, h) {
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
                                d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]');
                                d.my.curHelper = d.my.all.filter(':visible').last();
                                d.my.curHelper.css({
                                    minHeight: 0,
                                    maxHeight: paneHeight
                                });
                            } else if (day > d.my.day) {
                                // move right
                                if (day > d.my.lastPos) {
                                    // set new helper
                                    $('.week-container .day[date="' + day + '"]')
                                        .append(d.my.curHelper = el.clone());
                                    d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]');
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
                                d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]');
                                d.my.curHelper = d.my.all.filter(':visible').first();
                            } else if (day < d.my.day) {
                                // move left
                                if (day < d.my.firstPos) {
                                    // add new helper
                                    $('.week-container .day[date="' + day + '"]')
                                        .append(d.my.curHelper = el.clone().addClass('opac'));
                                    d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]');

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
                                d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]');
                            }
                        }
                        // update day
                        d.my.day = day;
                    },
                    stop: function (e, ui) {
                        var el = $(this),
                            d = el.data('resizable'),
                            app = self.collection.get(el.data('cid')).attributes,
                            // TODO: FIX update call to UTC
                            tmpTS = date.Local.utc(self.getTimeFromDateTag(d.my.day));
                        d.my.all.removeClass('opac');
                        switch (d.my.handle) {
                        case 'n':
                            _.extend(app, {
                                start_date: tmpTS + self.getTimeFromPos(d.my.top),
                                ignore_conflicts: true
                            });
                            break;
                        case 's':
                            _.extend(app, {
                                end_date: tmpTS + self.getTimeFromPos(d.my.bottom),
                                ignore_conflicts: true
                            });
                            break;
                        default:
                            break;
                        }
                        el.busy();
                        self.onUpdateAppointment(app);
                        self.lassoMode = true;
                    }
                })
                .draggable({
                    grid: [colWidth, self.gridHeight()],
                    scroll: true,
                    start: function (e, ui) {
                        self.lassoMode = false;
                        self.onEnterAppointment(e);
                        // write all appointment divs to draggable object
                        var d = $(this).data('draggable');
                        d.my = {};
                        d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]')
                            .addClass('opac')
                            .css({
                                left : 0,
                                width: '100%',
                                maxWidth: '100%',
                                zIndex: 999
                            });
                        d.my.firstPos = parseInt(d.my.all.first().closest('.day').attr('date'), 10);
                        d.my.lastPos = parseInt(d.my.all.last().closest('.day').attr('date'), 10);
                        d.my.initPos = parseInt($(this).closest('.day').attr('date'), 10);
                        d.my.firstTop = d.my.all.first().position().top;
                        d.my.lastHeight = d.my.all.last().outerHeight();
                        d.my.lastTop = ui.position.top;
                    },
                    drag: function (e, ui) {
                        var d = $(this).data('draggable'),
                            left = ui.position.left -= ui.originalPosition.left,
                            move = Math.floor(left / colWidth),
                            day = d.my.initPos + move,
                            top = ui.position.top;

                        // correct position
                        if (d.my.firstPos === d.my.lastPos) {
                            d.my.mode = 4;
                        } else if (day === d.my.firstPos + move) {
                            d.my.mode = 3;
                        } else if (day === d.my.lastPos + move) {
                            d.my.mode = 2;
                        } else {
                            d.my.mode = 1;
                        }

                        // sync left position
                        d.my.all
                            .css('left', left);

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
                                    $('.week-container .day[date="' + (--d.my.firstPos) + '"]')
                                        .append($(this).clone());
                                    d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]');
                                }
                                if (((d.my.firstTop < 0 && firstTop >= 0) || (d.my.firstTop < paneHeight && firstTop >= paneHeight)) && diff > 0) {
                                    d.my.firstPos++;
                                    d.my.all.first().remove();
                                    d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]');
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
                                    $('.week-container .day[date="' + (++d.my.lastPos) + '"]')
                                        .append($(this).clone());
                                    d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]');
                                }
                                if (((d.my.lastHeight > 0 && lastHeight <= 0) || (d.my.lastHeight > paneHeight && lastHeight <= paneHeight)) && diff < 0) {
                                    d.my.lastPos--;
                                    d.my.all.last().remove();
                                    d.my.all = $('[data-cid="' + ui.helper.data('cid') + '"]');
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
                    },
                    stop: function (e, ui) {
                        self.lassoMode = true;
                        var d = $(this).data('draggable'),
                            move = Math.round((ui.position.left - ui.originalPosition.left) / colWidth),
                            app = self.collection.get($(this).data('cid')).attributes,
                            startTS = app.start_date + self.getTimeFromPos(d.my.lastTop - ui.originalPosition.top) + (move * date.DAY);
                        d.my.all.busy();
                        _.extend(app, {
                            start_date: startTS,
                            end_date: startTS + (app.end_date - app.start_date),
                            ignore_conflicts: true
                        });
                        self.onUpdateAppointment(app);
                    }
                });

            // remove unused resizable panes
            $('.day>.appointment.rmnorth .ui-resizable-n, .day>.appointment.rmsouth .ui-resizable-s')
                .remove();

            // init drag and resize widget on full-time appointments
            $('.fulltime>.appointment.modify')
                .draggable({
                    grid: [colWidth, 0],
                    axis: 'x',
                    scroll: true,
                    snap: '.day',
                    zIndex: 2,
                    start: function (e, ui) {
                        self.lassoMode = false;
                    },
                    stop: function (e, ui) {
                        self.lassoMode = true;
                        $(this).busy();
                        var newPos = Math.round($(this).position().left / (self.fulltimePane.width() / self.columns)),
                            startTS = self.curTimeUTC + (newPos * date.DAY),
                            cid = $(this).data('cid'),
                            app = self.collection.get(cid).attributes;
                        _.extend(app, {
                            start_date: startTS,
                            end_date: startTS + (app.end_date - app.start_date),
                            ignore_conflicts: true
                        });
                        self.onUpdateAppointment(app);
                    }
                })
                .resizable({
                    grid: [colWidth, 0],
                    minWidth: colWidth,
                    handles: "w, e",
                    containment: "parent",
                    start: function (e, ui) {
                        self.lassoMode = false;
                        $(this).addClass('opac').css('zIndex', $(this).css('zIndex') + 2000);
                    },
                    stop: function (e, ui) {
                        self.lassoMode = true;
                        var el = $(this),
                            cid = el.data('cid'),
                            app = self.collection.get(cid).attributes,
                            newDayCount = Math.round(el.outerWidth() / (self.fulltimePane.width() / self.columns));
                        el.removeClass('opac').css('zIndex', $(this).css('zIndex') - 2000);

                        if (el.position().left !== ui.originalPosition.left) {
                            _.extend(app, {
                                start_date: app.end_date - (newDayCount * date.DAY),
                                ignore_conflicts: true
                            });
                        } else if (el.width() !== ui.originalSize.width) {
                            _.extend(app, {
                                end_date: app.start_date + (newDayCount * date.DAY),
                                ignore_conflicts: true
                            });
                        }
                        el.busy();
                        self.onUpdateAppointment(app);
                    }
                });
        },

        // render an single appointment
        renderAppointment: function (a) {
            myself = myself || ox.user_id;

            // check confirmations
            var state = (_(a.participants).find(function (o) {
                    return o.id === myself;
                }) || { type: 0 }).type;

            return $('<div>')
                .addClass(
                    'appointment ' +
                    util.getShownAsClass(a) +
                    (a.private_flag ? ' private' : '') +
                    (state === 0 ? ' unconfirmed' : '') +
                    (folder.can('write', this.folder, a) ? ' modify' : '')
                )
                .attr('data-cid', _.cid(a))
                .append(
                    $('<div>')
                        .addClass('appointment-content')
                        .css('lineHeight', (a.full_time ? this.fulltimeHeight : this.cellHeight) + 'px')
                        .append($('<div>').addClass('title').text(gt.noI18n(a.title)))
                        .append($('<div>').addClass('location').text(gt.noI18n(a.location || '')))
                );
        },

        // round an integer to the next grid size
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

        // calculate css position paramter (top and left) of an appointment
        calcPos: function (ap) {
            var start = new date.Local(ap.pos.start),
                end = new date.Local(ap.pos.end),
                self = this,
                calc = function (d) {
                    return Math.floor((d.getHours() / 24 + d.getMinutes() / 1440) * self.height());
                },
                s = calc(start);
            return {
                top: s,
                height: Math.max(calc(end) - s, self.gridHeight())
            };
        },

        // get timestamp from date marker
        getTimeFromDateTag: function (tag)  {
            return this.curTimeUTC + (tag * date.DAY);
        },

        // calc daily timestamp from mouse position
        getTimeFromPos: function (pos) {
            return this.roundToGrid(pos) / this.height() * date.DAY;
        },

        // calculate complete height of the grid
        height: function () {
            return this.cellHeight * this.slots * this.fragmentation;
        },

        // calculate height of a single grid fragment
        gridHeight: function () {
            return this.cellHeight * this.fragmentation / this.gridSize;
        },

        getShowAllStatus: function () {
            return this.showAll.prop('checked');
        },

        setShowAllVisibility: function (display) {
            this.showAllCon[display ? 'show': 'hide']();
        },

        getFolder: function () {
            return this.folder;
        },

        setFolder: function (folder) {
            this.folder =  folder;
        }

    });

    return View;
});
