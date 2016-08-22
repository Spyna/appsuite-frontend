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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('plugins/notifications/calendar/register', [
    'io.ox/calendar/api',
    'io.ox/core/api/reminder',
    'io.ox/core/extensions',
    'io.ox/core/notifications/subview',
    'gettext!plugins/notifications',
    'io.ox/calendar/util',
    'settings!io.ox/core'
], function (calAPI, reminderAPI, ext, Subview, gt, util, settings) {

    'use strict';

    var autoOpen = settings.get('autoOpenNotification', true);
    //change old settings values to new ones
    if (autoOpen === 'always' || autoOpen === 'noEmail') {
        autoOpen = true;
        settings.set('autoOpenNotification', true);
        settings.save();
    } else if (autoOpen === 'Never') {
        autoOpen = false;
        settings.set('autoOpenNotification', false);
        settings.save();
    }

    ext.point('io.ox/core/notifications/invites/item').extend({
        draw: function (baton) {
            var model = baton.model,
                node = this,
                view = baton.view,
                onClickChangeStatus = function (e) {
                    // stopPropagation could be prevented by another markup structure
                    e.stopPropagation();
                    require(['io.ox/calendar/actions/acceptdeny']).done(function (acceptdeny) {
                        acceptdeny(model.attributes);
                    });
                },
                onClickAccept = function (e) {
                    e.stopPropagation();
                    var o = calAPI.reduce(model.attributes),
                        appointmentData = model.attributes;
                    require(['io.ox/core/folder/api', 'settings!io.ox/calendar'], function (folderAPI, settings) {
                        folderAPI.get(o.folder).done(function (folder) {
                            o.data = {
                                // default reminder
                                alarm: parseInt(settings.get('defaultReminder', 15), 10),
                                confirmmessage: '',
                                confirmation: 1
                            };
                            // add current user id in shared or public folder
                            if (folderAPI.is('shared', folder)) {
                                o.data.id = folder.created_by;
                            }
                            calAPI.checkConflicts(appointmentData).done(function (conflicts) {
                                if (conflicts.length === 0) {
                                    view.responsiveRemove(model);
                                    calAPI.confirm(o).done(function () {
                                        // remove model from hidden collection or new invitations when the appointment changes will not be displayed
                                        view.hiddenCollection.remove(model);
                                    }).fail(function () {
                                        view.unHide(model);
                                    });
                                } else {
                                    ox.load(['io.ox/calendar/conflicts/conflictList', 'io.ox/core/tk/dialogs']).done(function (conflictView, dialogs) {
                                        var dialog = new dialogs.ModalDialog()
                                            .header(conflictView.drawHeader());

                                        dialog.append(conflictView.drawList(conflicts, dialog).addClass('additional-info'));
                                        dialog.addDangerButton('ignore', gt('Ignore conflicts'), 'ignore');

                                        dialog.addButton('cancel', gt('Cancel'), 'cancel')
                                            .show()
                                            .done(function (action) {
                                                if (action === 'cancel') {
                                                    return;
                                                }
                                                if (action === 'ignore') {
                                                    view.responsiveRemove(model);
                                                    calAPI.confirm(o).done(function () {
                                                        // remove model from hidden collection or new invitations when the appointment changes will not be displayed
                                                        view.hiddenCollection.remove(model);
                                                    }).fail(function () {
                                                        view.unHide(model);
                                                    });
                                                }
                                            });
                                    });
                                }
                            });
                        });
                    });
                };

            var cid = _.cid(model.attributes),
                strings = util.getDateTimeIntervalMarkup(model.attributes, { output: 'strings' });
            node.attr({
                'data-cid': cid,
                'focus-id': 'calendar-invite-' + cid,
                //#. %1$s Appointment title
                //#, c-format
                'aria-label': gt('Invitation for %1$s.',
                        _.noI18n(model.get('title')))
            }).append(
                $('<a class="notification-info" role="button">').append(
                    $('<span class="span-to-div time">').text(_.noI18n(strings.timeStr)).attr('aria-label', util.getTimeIntervalA11y(model.attributes)),
                    $('<span class="span-to-div date">').text(_.noI18n(strings.dateStr)).attr('aria-label', util.getDateIntervalA11y(model.attributes)),
                    $('<span class="span-to-div title">').text(_.noI18n(model.get('title'))),
                    $('<span class="span-to-div location">').text(_.noI18n(model.get('location'))),
                    $('<span class="span-to-div organizer">').text(_.noI18n(model.get('organizer'))),
                    $('<span class="sr-only">').text(gt('Press to open Details'))
                ),
                $('<div class="actions">').append(
                    $('<button type="button" class="refocus btn btn-default" data-action="accept_decline">')
                        .attr({
                            'focus-id': 'calendar-invite-' + cid + '-accept-decline',
                            // button aria labels need context
                            'aria-label': gt('Accept/Decline') + ' ' + model.get('title')
                        })
                        .css('margin-right', '14px')
                        .text(gt('Accept / Decline'))
                        .on('click', onClickChangeStatus),
                    $('<button type="button" class="refocus btn btn-success" data-action="accept">')
                        .attr({
                            // button aria labels need context
                            'aria-label': gt('Accept invitation') + ' ' + model.get('title'),
                            'focus-id': 'calendar-invite-' + cid + '-accept'
                        })
                        .on('click', onClickAccept)
                        .append('<i class="fa fa-check">')
                )
            );
        }
    });

    ext.point('io.ox/core/notifications/calendar-reminder/item').extend({
        draw: function (baton) {
            //build selectoptions
            var minutes = [5, 10, 15, 45],
                options = [],
                node = this;
            for (var i = 0; i < minutes.length; i++) {
                options.push([minutes[i], gt.format(gt.npgettext('in', 'in %d minute', 'in %d minutes', minutes[i]), minutes[i])]);
            }

            node.attr('data-cid', String(_.cid(baton.requestedModel.attributes)));
            require(['io.ox/core/tk/reminder-util'], function (reminderUtil) {
                reminderUtil.draw(node, baton.model, options);
                node.on('click', '[data-action="ok"]', function (e) {
                    e.stopPropagation();
                    reminderAPI.deleteReminder(baton.requestedModel.attributes);
                    baton.view.collection.remove(baton.requestedModel.attributes);
                });
                node.find('[data-action="reminder"]').on('click change', function (e) {
                    //if we do this on smartphones the dropdown does not close correctly
                    if (!_.device('smartphone')) {
                        e.stopPropagation();
                    }

                    var min = $(e.target).data('value') || $(e.target).val();
                    //0 means 'pick a time here' was selected. Do nothing.
                    if (min !== '0') {
                        baton.view.hide(baton.requestedModel, min * 60000);
                    }
                });
            });
        }
    });

    ext.point('io.ox/core/notifications/register').extend({
        id: 'appointmentReminder',
        index: 100,
        register: function () {
            var options = {
                    id: 'io.ox/calendarreminder',
                    api: reminderAPI,
                    apiEvents: {
                        reset: 'set:calendar:reminder'
                    },
                    //#. Reminders (notifications) about appointments
                    title: gt('Appointment reminders'),
                    extensionPoints: {
                        item: 'io.ox/core/notifications/calendar-reminder/item'
                    },
                    detailview: 'io.ox/calendar/view-detail',
                    autoOpen: autoOpen,
                    genericDesktopNotification: {
                        //#. Title of generic desktop notification about new reminders for appointments
                        title: gt('New appointment reminders'),
                        //#. Body text of generic desktop notification about new reminders for appointments
                        body: gt('You have new appointment reminders'),
                        icon: ''
                    },
                    specificDesktopNotification: function (model) {
                        var title = model.get('title'),
                            date = ', ' + util.getDateInterval(model.attributes),
                            time = ', ' + util.getTimeInterval(model.attributes);

                        return {
                            //#. Title of the desktop notification about new reminder for a specific appointment
                            title: gt('New appointment reminder'),
                            body: title + date + time,
                            icon: ''
                        };
                    },
                    //#. Reminders (notifications) about appointments
                    hideAllLabel: gt('Hide all appointment reminders.')
                },
                subview = new Subview(options);

            //react to changes in settings
            settings.on('change:autoOpenNotification', function (e, value) {
                subview.model.set('autoOpen', value);
            });

            reminderAPI.getReminders();
        }
    });

    ext.point('io.ox/core/notifications/register').extend({
        id: 'appointmentInvitations',
        index: 300,
        register: function () {
            var options = {
                    id: 'io.ox/calendarinvitations',
                    api: calAPI,
                    apiEvents: {
                        reset: 'new-invites',
                        remove: 'delete:appointment mark:invite:confirmed'
                    },
                    useListRequest: true,
                    //#. Invitations (notifications) about appointments
                    title: gt('Appointment invitations'),
                    extensionPoints: {
                        item: 'io.ox/core/notifications/invites/item'
                    },
                    detailview: 'io.ox/calendar/view-detail',
                    autoOpen: autoOpen,
                    genericDesktopNotification: {
                        //#. Title of generic desktop notification about new invitations to appointments
                        title: gt('New appointment invitation'),
                        //#. Body text of generic desktop notification about new invitations to appointments
                        body: gt('You have new appointment invitations'),
                        icon: ''
                    },
                    specificDesktopNotification: function (model) {
                        var title = model.get('title'),
                            date = ', ' + util.getDateInterval(model.attributes),
                            time = ', ' + util.getTimeInterval(model.attributes);

                        return {
                            //#. Title of the desktop notification about new invitation to a specific appointment
                            title: gt('New appointment invitation'),
                            body: title + date + time,
                            icon: ''
                        };
                    },
                    //#. Invitations (notifications) about appointments
                    hideAllLabel: gt('Hide all appointment invitations.')
                },
                subview = new Subview(options);

            //react to changes in settings
            settings.on('change:autoOpenNotification', function (e, value) {
                subview.model.set('autoOpen', value);
            });

            calAPI.getInvites();
        }
    });

    return true;
});
