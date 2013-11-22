/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2012 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */

define('io.ox/tasks/model',
    ['io.ox/tasks/api',
     'io.ox/backbone/modelFactory',
     'io.ox/backbone/validation',
     'io.ox/core/extensions',
     'io.ox/participants/model',
     'io.ox/core/date',
     'gettext!io.ox/tasks'
    ], function (api, ModelFactory, Validations, ext, pModel, date, gt) {

    'use strict';

    var defaults = {
            status: 1,
            priority: 2,
            percent_completed: 0,
            folder_id: api.getDefaultFolder(),
            recurrence_type: 0,
            private_flag: false,
            notification: true//set always (OX6 does this too)
        },
        factory = new ModelFactory({
            ref: 'io.ox/tasks/model',
            api: api,
            model: {
                defaults: defaults,
                getParticipants: function () {
                    if (this._participants) {
                        return this._participants;
                    }
                    var self = this;
                    var resetListUpdate = false;
                    var changeParticipantsUpdate = false;
                    var participants = this._participants = new pModel.Participants(this.get('participants'));
                    participants.invoke('fetch');

                    function resetList() {
                        if (changeParticipantsUpdate) {
                            return;
                        }
                        resetListUpdate = true;
                        self.set('participants', participants.toJSON());
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
            }
        });

    Validations.validationFor('io.ox/tasks/model', {
        start_date: {format: 'date'},
        end_date: {format: 'date'},
        alarm: {format: 'date'},
        title: {format: 'string'},
        note: {format: 'string'},
        companies: {format: 'string'},
        billing_information: {format: 'string'},
        trip_meter: {format: 'string'},
        currency: {format: 'string'},
        status: {format: 'number'},
        priority: {format: 'number'},
        percent_completed: {format: 'number'},
        number_of_attachments: {format: 'number'},
        actual_costs: {format: 'number'},
        target_costs: {format: 'number'},
        actual_duration: {format: 'number'},
        target_duration: {format: 'number'},
        private_flag: { format: 'boolean'}
    });

    ext.point('io.ox/tasks/model/validation').extend({
        id: 'start-date-before-end-date',
        validate: function (attributes) {
            if (attributes.start_date && attributes.end_date && attributes.end_date <= attributes.start_date) {
                //this.add('start_date', gt('The start date must be before the end date.')); // see Bug 27742
                this.add('end_date', gt('The start date must be before the end date.'));
            }
        }
    });

    var MAX = 9999999999.99;

    ext.point('io.ox/tasks/model/validation').extend({
        id: 'Actual-costs-out-of-limits',
        validate: function (attributes) {
            if (attributes.actual_costs && (attributes.actual_costs < -MAX || attributes.actual_costs > MAX)) {
                this.add('actual_costs', gt('Costs must be between -%1$d and %1$d.', MAX, MAX));
            }
        }
    });
    ext.point('io.ox/tasks/model/validation').extend({
        id: 'target-costs-out-of-limits',
        validate: function (attributes) {
            if (attributes.target_costs && (attributes.target_costs < -MAX || attributes.target_costs > MAX)) {
                this.add('target_costs', gt('Costs must be between -%1$d and %1$d.', MAX, MAX));
            }
        }
    });

    ext.point('io.ox/tasks/model/validation').extend({
        id: 'progress-not-between-0-and-100',
        validate: function (attributes) {
            if (attributes.percent_completed && (attributes.percent_completed < 0 || attributes.percent_completed > 100)) {
                this.add('percent_completed', gt('Progress must be a valid number between 0 and 100'));
            }
        }
    });

    ext.point('io.ox/tasks/model/validation').extend({
        id: 'recurrence-needs-start-date',
        validate: function (attributes) {
            if (attributes.recurrence_type && (attributes.start_date === undefined || attributes.start_date === null)) {//0 is a valid number so check precisely
                this.add('start_date', gt('Recurring tasks need a valid start date.'));
            }
        }
    });

    ext.point('io.ox/tasks/model/validation').extend({
        id: 'recurrence-needs-end-date',
        validate: function (attributes) {
            if (attributes.recurrence_type && (attributes.end_date === undefined || attributes.end_date === null)) {//0 is a valid number so check precisely
                this.add('end_date', gt('Recurring tasks need a valid end date.'));
            }
        }
    });

    return {
        defaults: defaults,
        factory: factory,
        task: factory.model,
        tasks: factory.collection
    };
});
