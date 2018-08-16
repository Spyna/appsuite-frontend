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
 * @author Richard Petersen <richard.petersen@open-xchange.com>
 */

define('io.ox/calendar/perspective', [
    'io.ox/core/extensions',
    'io.ox/calendar/api',
    'io.ox/calendar/model',
    'io.ox/calendar/util',
    'io.ox/calendar/view-detail',
    'io.ox/core/tk/dialogs',
    'io.ox/core/yell',
    'gettext!io.ox/calendar'
], function (ext, api, calendarModel, util, detailView, dialogs, yell, gt) {

    'use strict';

    return Backbone.View.extend({

        clickTimer:     null, // timer to separate single and double click
        clicks:         0, // click counter

        events: function () {
            var events = {
                'click .appointment': 'onClickAppointment'
            };
            if (_.device('touch')) {
                _.extend(events, {
                    'swipeleft': 'onPrevious',
                    'swiperight': 'onNext'
                });
            }
            return events;
        },

        // needs to be implemented by the according view
        render: $.noop,

        setCollection: function (collection) {
            if (this.collection === collection) return;

            if (this.collection) this.stopListening(this.collection);
            this.collection = collection;

            this.onResetAppointments();

            this
                .listenTo(this.collection, 'add', this.onAddAppointment)
                .listenTo(this.collection, 'change', this.onChangeAppointment)
                .listenTo(this.collection, 'remove', this.onRemoveAppointment)
                .listenTo(this.collection, 'reset', this.onResetAppointments);
        },

        onAddAppointment: $.noop,
        onChangeAppointment: $.noop,
        onRemoveAppointment: $.noop,
        onResetAppointments: $.noop,

        getName: $.noop,

        showAppointment: function (e, obj) {
            // open appointment details
            var self = this, dialog = this.getDialog();

            function failHandler(e) {
                // CAL-4040: Appointment not found
                if (e && e.code === 'CAL-4040') {
                    yell(e);
                } else {
                    yell('error', gt('An error occurred. Please try again.'));
                }
                dialog.close();
                this.$('.appointment').removeClass('opac current');
                self.trigger('show:appointment:fail');
            }

            this.trigger('before:show:appointment');
            self.detailCID = api.cid(obj);
            dialog.show(e, function (popup) {
                popup
                .busy()
                .attr({
                    'role': 'complementary',
                    'aria-label': gt('Appointment Details')
                });

                api.get(obj).then(function (model) {
                    if (model.cid !== self.detailCID) return;
                    popup.idle().append(detailView.draw(new ext.Baton({ model: model })));
                    self.trigger('show:appointment:success');
                    // TODO apply date to view in case of deep links
                }, failHandler);
            });
        },

        closeAppointment: function () {
            this.$('.appointment').removeClass('opac current');
        },

        getDialog: function () {
            if (!this.dialog) {
                // define default sidepopup dialog
                this.dialog = new dialogs.SidePopup({ tabTrap: true, preserveOnAppchange: true })
                .on('close', this.closeAppointment.bind(this));
            }
            return this.dialog;
        },

        onClickAppointment: function (e) {
            var target = $(e[(e.type === 'keydown') ? 'target' : 'currentTarget']);
            // TODO review that
            //if (target.attr('data-cid') !== this.clicktarget) return;
            if (target.hasClass('appointment') && !this.model.get('lasso') && !target.hasClass('disabled')) {
                var self = this,
                    obj = util.cid(String(target.data('cid')));
                if (!target.hasClass('current') || _.device('smartphone')) {
                    // ignore the "current" check on smartphones
                    this.$('.appointment')
                        .removeClass('current opac')
                        .not(this.$('[data-master-id="' + obj.folder + '.' + obj.id + '"]'))
                        .addClass((this.collection.length > this.limit || _.device('smartphone')) ? '' : 'opac'); // do not add opac class on phones or if collection is too large
                    this.$('[data-master-id="' + obj.folder + '.' + obj.id + '"]').addClass('current');
                    this.showAppointment(e, obj);

                } else {
                    this.$('.appointment').removeClass('opac');
                }

                if (this.clickTimer === null && this.clicks === 0) {
                    this.clickTimer = setTimeout(function () {
                        clearTimeout(self.clickTimer);
                        self.clicks = 0;
                        self.clickTimer = null;
                    }, 300);
                }
                this.clicks++;

                if (this.clickTimer !== null && this.clicks === 2 && target.hasClass('modify') && e.type === 'click') {
                    clearTimeout(this.clickTimer);
                    this.clicks = 0;
                    this.clickTimer = null;
                    api.get(obj).done(function (model) {
                        // TODO this somehow needs to be refactored
                        self.trigger('openEditAppointment', e, model.attributes);
                    });
                }
            }
        },

        createAppointment: function (data) {
            ext.point('io.ox/calendar/detail/actions/create')
            .invoke('action', this, { app: this.app }, data);
        },

        updateAppointment: function (model, updates) {
            var prevStartDate = model.getMoment('startDate'),
                prevEndDate = model.getMoment('endDate'),
                prevFolder = model.get('folder');

            var hasChanges = _(updates).reduce(function (memo, value, key) {
                return memo || !_.isEqual(model.get(key), value);
            }, false);
            if (!hasChanges) return;

            model.set(updates);
            var nodes = this.$('[data-master-id="' + api.cid({ id: model.get('id'), folder: model.get('folder') }) + '"]').busy();

            function reset() {
                model.set({
                    startDate: model.previous('startDate'),
                    endDate: model.previous('endDate'),
                    folder: prevFolder
                });
                nodes.idle();
            }

            function apiUpdate(model, options) {
                var obj = _(model.toJSON()).pick('id', 'folder', 'recurrenceId', 'seriesId', 'startDate', 'endDate', 'timestamp');

                api.update(obj, options).then(function success(data) {
                    if (!data || !data.conflicts) return nodes.idle();

                    ox.load(['io.ox/calendar/conflicts/conflictList']).done(function (conflictView) {
                        conflictView.dialog(data.conflicts)
                            .on('cancel', reset)
                            .on('ignore', function () {
                                apiUpdate(model, _.extend(options || {}, { checkConflicts: false }));
                            });
                    });
                }, function fail(error) {
                    reset();
                    yell(error);
                });
            }

            util.showRecurrenceDialog(model)
                .done(function (action) {
                    switch (action) {
                        case 'series':
                            api.get({ id: model.get('seriesId'), folder: model.get('folder') }, false).done(function (masterModel) {
                                // calculate new dates if old dates are available
                                var oldStartDate = masterModel.getMoment('startDate'),
                                    startDate = masterModel.getMoment('startDate').add(model.getMoment('startDate').diff(prevStartDate, 'ms'), 'ms'),
                                    endDate = masterModel.getMoment('endDate').add(model.getMoment('endDate').diff(prevEndDate, 'ms'), 'ms'),
                                    format = util.isAllday(model) ? 'YYYYMMDD' : 'YYYYMMDD[T]HHmmss';
                                masterModel.set({
                                    startDate: { value: startDate.format(format), tzid: masterModel.get('startDate').tzid },
                                    endDate: { value: endDate.format(format), tzid: masterModel.get('endDate').tzid }
                                });
                                util.updateRecurrenceDate(masterModel, oldStartDate);
                                apiUpdate(masterModel, _.extend(util.getCurrentRangeOptions(), {
                                    checkConflicts: true,
                                    recurrenceRange: action === 'thisandfuture' ? 'THISANDFUTURE' : undefined
                                }));
                            });
                            break;
                        case 'thisandfuture':
                            // get recurrence master object
                            api.get({ id: model.get('seriesId'), folder: model.get('folder') }, false).done(function (masterModel) {
                                // calculate new dates if old dates are available use temporary new model to store data before the series split
                                var updateModel = new calendarModel.Model(util.createUpdateData(masterModel, model)),
                                    oldStartDate = masterModel.getMoment('startDate');

                                updateModel.set({
                                    startDate: model.get('startDate'),
                                    endDate: model.get('endDate')
                                });
                                util.updateRecurrenceDate(model, oldStartDate);
                                apiUpdate(updateModel, _.extend(util.getCurrentRangeOptions(), {
                                    checkConflicts: true,
                                    recurrenceRange: 'THISANDFUTURE'
                                }));
                            });
                            break;
                        case 'appointment':
                            apiUpdate(model, _.extend(util.getCurrentRangeOptions(), { checkConflicts: true }));
                            break;
                        default:
                            reset();
                            return;
                    }
                });
        }

    });

});
