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
 * @author Mario Scheliga <mario.scheliga@open-xchange.com>
 */

define('io.ox/calendar/actions/acceptdeny', [
    'io.ox/calendar/api',
    'io.ox/backbone/mini-views/alarms',
    'io.ox/backbone/views/modal',
    'io.ox/core/folder/api',
    'io.ox/calendar/util',
    'io.ox/core/notifications',
    'settings!io.ox/calendar',
    'gettext!io.ox/calendar',
    'less!io.ox/calendar/style'
], function (calApi, AlarmsView, ModalDialog, folderAPI, util, notifications, settings, gt) {

    'use strict';

    return function (o, options) {
        options = options || {};
        function cont(series) {

            var def = $.Deferred(),
                message,
                appointmentData,
                //use different api if provided (tasks use this)
                api = options.api || calApi,
                folder,
                alarmsView,
                reminderSelect = $(),
                inputid = _.uniqueId('dialog'),
                apiData = { folder: o.folder || o.folder_id, id: o.id },
                checkConflicts;

            if (!options.taskmode && !series && o.recurrenceId) {
                apiData.recurrenceId = o.recurrenceId;
            }

            $.when(api.get(apiData), options.noFolderCheck ? $.when() : folderAPI.get(apiData.folder)).always(function (data, folderData) {
                // work on a copy for appointments (so we don't accidentally change the pool data)
                appointmentData = options.taskmode ? data : data.toJSON();
                // check if the response is of type [data, timestamp]
                if (_.isArray(data) && data.length === 2 && _.isNumber(data[1])) {
                    appointmentData = data[0];
                }

                folder = folderData;
                // check for which id the user wants to confirm (secretary function)
                var confirmId = !o.noFolderCheck && folderAPI.is('shared', folder) ? folder.created_by : ox.user_id;

                message = util.getConfirmationMessage(o, confirmId);

                var alarmsModel,
                    previousConfirmation = options.taskmode ? _(appointmentData.users).findWhere({ id: ox.user_id }) : _(appointmentData.attendees).findWhere({ entity: confirmId });

                if (!options.taskmode) {
                    if (!previousConfirmation || previousConfirmation.partStat === 'NEEDS-ACTION') {
                        appointmentData.alarms = util.getDefaultAlarms(appointmentData);
                    }
                    // backbone model is fine. No need to require chronos model
                    alarmsModel = new Backbone.Model(appointmentData);
                    alarmsView = new AlarmsView.linkView({ model: alarmsModel });
                    reminderSelect = $('<fieldset>').append(
                        $('<legend class="confirm-dialog-legend">').text(gt('Reminder')),
                        alarmsView.render().$el
                    );
                }

                return new ModalDialog({
                    async: true,
                    help: 'ox.appsuite.user.sect.calendar.manage.changestatus.html',
                    focus: _.device('smartphone') ? '' : '[data-property="comment"]',
                    title: gt('Change confirmation status')
                })
                    .build(function () {
                        if (!series && o.recurrenceId) {
                            appointmentData = api.removeRecurrenceInformation(appointmentData);
                        }

                        var recurrenceString = util.getRecurrenceString(appointmentData),
                            description = $('<b>').text(appointmentData.title),
                            descriptionId = _.uniqueId('confirmation-dialog-description-');

                        if (!options.taskmode) {
                            var strings = util.getDateTimeIntervalMarkup(appointmentData, { output: 'strings', zone: moment().tz() });
                            description = [
                                $('<b>').text(appointmentData.summary),
                                $.txt(', '),
                                $.txt(strings.dateStr),
                                $.txt(recurrenceString !== '' ? ' \u2013 ' + recurrenceString : ''),
                                $.txt(' '),
                                $.txt(strings.timeStr)
                            ];
                        }

                        this.$el.attr('aria-describedby', descriptionId);
                        this.$body.append(
                            confirmId !== ox.user_id ? $('<div class="alert alert-info">').text(gt('You are currently acting on behalf of the calendar owner.')) : '',
                            $('<p>').text(
                                gt('You are about to change your confirmation status. Please leave a comment for other participants.')
                            ),
                            $('<p>').attr('id', descriptionId).append(
                                description
                            ),
                            $('<div class="form-group">').css({ 'margin-top': '20px' }).append(
                                //#. is in the same window as "You are about to change your confirmation status. Please leave a comment for other participants". So "comment" should be translated the same in both cases to not confuse users
                                $('<label class="control-label">').attr('for', inputid).text(gt('Comment')).append(
                                    $('<span class="sr-only">').text((data.summary || data.title) + ' ' + gt('Please comment your confirmation status.'))
                                ),
                                $('<input type="text" class="form-control" data-property="comment">').attr('id', inputid).val(message),
                                reminderSelect
                            )
                        );
                    })
                    .addAlternativeButton({ action: 'cancel', label: gt('Cancel') })
                    .addButton({ action: 'declined', label: gt('Decline'), className: 'btn-danger' })
                    .addButton({ action: 'tentative', label: gt('Tentative'), className: 'btn-warning' })
                    .addButton({ action: 'accepted', label: gt('Accept'), className: 'btn-success' })
                    .on('action', function (action) {
                        if (action === 'cancel') return;
                        var dialog = this,
                            message = $.trim(this.$body.find('[data-property="comment"]').val()),
                            requestData;

                        function performConfirm(checkConflicts) {
                            api.confirm(requestData, _.extend({ checkConflicts: checkConflicts }, util.getCurrentRangeOptions()))
                                .done(function (data) {

                                    if (data && data.conflicts) {
                                        ox.load(['io.ox/calendar/conflicts/conflictList']).done(function (conflictView) {
                                            conflictView.dialog(data.conflicts)
                                                .on('cancel', function () {
                                                    dialog.idle();
                                                })
                                                .on('ignore', function () {
                                                    performConfirm(false);
                                                });
                                        });
                                        return;
                                    }
                                    dialog.close();
                                    if (options.callback) options.callback();
                                })
                                .fail(function (e) {
                                    dialog.idle();
                                    notifications.yell(e);
                                });
                        }

                        if (options.taskmode) {
                            requestData = {
                                id: appointmentData.id,
                                folder_id: appointmentData.folder_id,
                                data: {
                                    confirmmessage: message,
                                    id: ox.user_id,
                                    confirmation: _(['', 'accepted', 'declined', 'tentative']).indexOf(action)
                                }
                            };
                            checkConflicts = false;
                        } else {
                            requestData = {
                                attendee: previousConfirmation,
                                id: appointmentData.id,
                                folder: appointmentData.folder
                            };
                            if (alarmsModel) requestData.alarms = alarmsModel.get('alarms');
                            requestData.attendee.partStat = action.toUpperCase();
                            if (message) {
                                requestData.attendee.comment = message;
                            } else if (requestData.attendee.comment) {
                                // if there was a previous comment we send null to remove it
                                requestData.attendee.comment = null;
                            }
                            if (!series && o.recurrenceId) requestData.recurrenceId = o.recurrenceId;
                            // don't check if confirmation status did not change
                            // no conflicts possible if you decline the appointment
                            // no conflicts possible for free appointments
                            checkConflicts = action !== 'declined' && appointmentData.transp === 'OPAQUE' && (!previousConfirmation || requestData.attendee.partStat !== previousConfirmation.partStat);
                        }

                        performConfirm(checkConflicts);
                    })
                    .open();
            });
            return def;
        }

        // series?
        if (!options.taskmode && o.recurrenceId && o.id === o.seriesId) {
            return new ModalDialog({ title: gt('Do you want to confirm the whole series or just one appointment within the series?') })
                .build(function () {
                    // no need for a dialog body
                    this.$body.hide();
                    this.$header.css('border-bottom', 'none');
                })
                .addCancelButton()
                .addButton({ className: 'btn-default', label: gt('Appointment'), action: 'appointment' })
                .addButton({ action: 'series',
                    //#. Use singular in this context
                    label: gt('Series') })
                .on('series', function () { _.defer(cont, true); })
                .on('appointment', function () { _.defer(cont, false); })
                .open();
        }
        return cont();
    };
});
