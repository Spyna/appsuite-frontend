/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2011 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 */
define('io.ox/calendar/model',
    ['io.ox/calendar/api',
     'io.ox/backbone/modelFactory',
     'io.ox/core/extensions',
     'gettext!io.ox/calendar',
     'io.ox/backbone/validation',
     'io.ox/participants/model',
     'io.ox/core/date',
     'io.ox/core/api/folder',
     'settings!io.ox/calendar'
    ], function (api, ModelFactory, ext, gt, Validators, pModel, date, folderAPI, settings) {

    'use strict';

    var RECURRENCE_FIELDS = 'recurrence_type interval days day_in_month month until occurrences'.split(' ');

    var factory = new ModelFactory({
        ref: 'io.ox/calendar/model',
        api: api,
        destroy: function (model) {
            var options = {
                id: model.id,
                folder: model.get('folder_id') || model.get('folder')
            };
            if (model.attributes.recurrence_position) {
                _.extend(options, {recurrence_position: model.get('recurrence_position')});
            }
            return api.remove(options);
        },
        model: {
            defaults: {
                recurrence_type: 0,
                notification: true,
                shown_as: 1
            },
            init: function () {
                var self = this,
                    defStart = new date.Local().setMinutes(0, 0, 0).add(date.HOUR);

                // set default time
                self.attributes = _.extend({
                    start_date: defStart.getTime(),
                    end_date: defStart.getTime() + date.HOUR
                }, self.attributes);

                self.on('create:fail update:fail', function (response) {
                    if (response.conflicts) {
                        self.trigger('conflicts', response.conflicts);
                    }
                });
            },
            getParticipants: function () {
                if (this._participants) {
                    return this._participants;
                }
                var self = this,
                    resetListUpdate = false,
                    changeParticipantsUpdate = false,
                    participants = this._participants = new pModel.Participants(this.get('participants'));

                participants.invoke('fetch');

                function resetList() {
                    if (changeParticipantsUpdate) {
                        return;
                    }
                    resetListUpdate = true;
                    self.set('participants', participants.toJSON(), {validate: true});
                    resetListUpdate = false;
                }

                participants.on('add remove reset', resetList);

                this.on('change:participants', function () {
                    if (resetListUpdate) {
                        return;
                    }
                    changeParticipantsUpdate = true;
                    participants.reset(self.get('participants'));
                    participants.invoke('fetch');
                    changeParticipantsUpdate = false;
                });

                return participants;
            }
        },
        getUpdatedAttributes: function (model) {
            var attributesToSave = model.changedSinceLoading();
            attributesToSave.id = model.id;

            if (model.get('recurrence_type') > 0) {
                attributesToSave.start_date = model.get('start_date');
                attributesToSave.end_date = model.get('end_date');
            }

            if (!attributesToSave.folder) {
                attributesToSave.folder = model.get('folder') || model.get('folder_id');
            }

            var anyRecurrenceFieldChanged = _(RECURRENCE_FIELDS).any(function (attribute) {
                return !_.isUndefined(attributesToSave[attribute]);
            });

            if (anyRecurrenceFieldChanged) {
                _(RECURRENCE_FIELDS).each(function (attribute) {
                    var value = model.get(attribute);
                    if (!_.isUndefined(value)) {
                        attributesToSave[attribute] = value;
                    }
                });
            }
            return attributesToSave;
        }
    });

    ext.point('io.ox/calendar/model/validation').extend({
        id: 'start-date-before-end-date',
        validate: function (attributes) {
            if (attributes.start_date && attributes.end_date && attributes.end_date < attributes.start_date) {
                this.add('start_date', gt('The start date must be before the end date.'));
                this.add('end_date', gt('The start date must be before the end date.'));
            }
        }
    });

    Validators.validationFor('io.ox/calendar/model', {
        title: { format: 'string', mandatory: true},
        start_date : { format: 'date', mandatory: true},
        end_date: { format: 'date', mandatory: true}
    });

    // Recurrence

    // First, some constants
    // A series is of a certain recurrence type
    // daily, weekly, monhtly, yearly, no_recurrence
    var RECURRENCE_TYPES = {
        NO_RECURRENCE: 0,
        DAILY: 1,
        WEEKLY: 2,
        MONTHLY: 3,
        YEARLY: 4
    };

    // Sometimes we need to reference a certain day, so
    // here are the weekdays, bitmap-style

    var DAYS = {
        SUNDAY: 1,
        MONDAY: 2,
        TUESDAY: 4,
        WEDNESDAY: 8,
        THURSDAY: 16,
        FRIDAY: 32,
        SATURDAY: 64
    };

    DAYS.i18n = {
        SUNDAY: gt('Sunday'),
        MONDAY: gt('Monday'),
        TUESDAY: gt('Tuesday'),
        WEDNESDAY: gt('Wednesday'),
        THURSDAY: gt('Thursday'),
        FRIDAY: gt('Friday'),
        SATURDAY: gt('Saturday')
    };

    // Usage: DAYS.pack('monday', 'wednesday', 'friday') -> some bitmask
    DAYS.pack = function () {
        var result = 0;
        _(arguments).each(function (day) {
            var dayConst = DAYS[day.toUpperCase()];

            if (_.isUndefined(dayConst)) {
                throw 'Invalid day: ' + day;
            }
            result = result | dayConst;
        });
        return result;
    };

    // Usage: DAYS.unpack(bitmask) -> {'MONDAY': 1, 'WEDNESDAY': 1, 'FRIDAY': 1}
    DAYS.unpack = function (bitmask) {
        var days = {};
        _(DAYS.values).each(function (day) {
            var dayConst = DAYS[day];
            if (bitmask & dayConst) {
                days[day] = 1;
            } else {
                days[day] = 0;
            }
        });

        return days;
    };

    DAYS.values = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

    return {
        setDefaultParticipants: function (model, options) {
            return folderAPI.get({folder: model.get('folder_id')}).done(function (folder) {
                var userID = ox.user_id;
                if (folderAPI.is('private', folder)) {
                    if (options.create) {
                        // it's a private folder for the current user, add him by default
                        // as participant
                        model.getParticipants().addUniquely({id: userID, type: 1});

                        // use a new, custom and unused property in his model to specify that he can't be removed
                        model.getParticipants().get(userID).set('ui_removable', false, { validate: true });
                    } else {
                        if (model.get('organizerId') === userID) {
                            model.getParticipants().get(userID).set('ui_removable', false, { validate: true });
                        }
                    }
                } else if (folderAPI.is('public', folder)) {
                    if (options.create) {
                        // if public folder, current user will be added
                        model.getParticipants().addUniquely({id: userID, type: 1});
                    }
                } else if (folderAPI.is('shared', folder)) {
                    // in a shared folder the owner (created_by) will be added by default
                    model.getParticipants().addUniquely({id: folder.created_by, type: 1});
                }

            });
        },
        applyAutoLengthMagic: function (model) {
            // End date automatically shifts with start date
            var length = model.get('end_date') - model.get('start_date'),
                updatingStart = false,
                updatingEnd = false;

            model.on('change:start_date', function () {
                if (length < 0 || updatingStart) {
                    return;
                }
                updatingEnd = true;
                if (model.get('start_date') && _.isNumber(length)) {
                    model.set('end_date', model.get('start_date') + length, { validate: true });
                }
                updatingEnd = false;
            });

            model.on('change:end_date', function () {
                if (updatingEnd) {
                    return;
                }
                var tmpLength = model.get('end_date') - model.get('start_date');
                if (tmpLength < 0) {
                    updatingStart = true;
                    if (model.get('end_date') && _.isNumber(length)) {
                        model.set('start_date', model.get('end_date') - length, { validate: true });
                    }
                    updatingStart = false;
                } else {
                    length = tmpLength;
                }
            });
        },
        fullTimeChangeBindings: function (model) {
            // save initial values;
            var _start = model.get('full_time') ? date.Local.utc(model.get('start_date')) : model.get('start_date'),
                _end = model.get('full_time') ? date.Local.utc(model.get('end_date')) : model.get('end_date'),
                mark = settings.get('markFulltimeAppointmentsAsFree', false);

            model.on('change:full_time', function (m, fulltime) {
                var oldStart = _start,
                    oldEnd = _end;

                if (fulltime === true) {
                    /// save to cache
                    _start = model.get('start_date');
                    _end = model.get('end_date');

                    // handle time
                    var startDate = new date.Local(_start),
                        endDate = new date.Local(_end - 1);

                    // parse to fulltime dates
                    startDate.setHours(0, 0, 0, 0);
                    endDate.setHours(0, 0, 0, 0).setDate(endDate.getDate() + 1);

                    // convert to UTC and save
                    m.set('start_date', startDate.local, { validate: true });
                    m.set('end_date', endDate.local, { validate: true });

                    // handle shown as
                    if (mark) {
                        m.set('shown_as', 4, { validate: true });
                    }
                } else {
                    // save to cache
                    _start = date.Local.utc(model.get('start_date'));
                    _end = date.Local.utc(model.get('end_date'));

                    // handle time
                    var startDate = new date.Local(_start),
                        endDate = new date.Local(_end + 1);

                    oldStart = new date.Local(oldStart);
                    oldEnd = new date.Local(oldEnd);

                    startDate.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
                    endDate.setHours(oldEnd.getHours(), oldEnd.getMinutes(), 0, 0);

                    // fix short appointments
                    if (oldEnd - oldStart > date.DAY) {
                        endDate.setDate(endDate.getDate() - 1);
                    }

                    // save
                    m.set('start_date', startDate.getTime(), { validate: true });
                    m.set('end_date', endDate.getTime(), { validate: true });

                    // handle shown as
                    if (mark) {
                        m.set('shown_as', 1, { validate: true });
                    }
                }
            });
        },
        factory: factory,
        Appointment: factory.model,
        Appointments: factory.collection,
        RECURRENCE_TYPES: RECURRENCE_TYPES,
        DAYS: DAYS
    };
});
