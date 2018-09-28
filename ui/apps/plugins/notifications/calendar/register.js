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
    'io.ox/core/yell',
    'io.ox/core/extensions',
    'io.ox/core/notifications/subview',
    'gettext!plugins/notifications',
    'io.ox/calendar/util',
    'settings!io.ox/core',
    'settings!io.ox/calendar',
    'io.ox/core/tk/sounds-util',
    'io.ox/core/notifications'
], function (calAPI, yell, ext, Subview, gt, util, settings, settingsCalendar, soundUtil, notifications) {

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

    function getLayout(model) {
        if (_.device('smartphone')) return 'week:day';

        var isWeekend = /(0|6)/.test(util.getMoment(model.get('startDate')).day()),
            layout = settingsCalendar.get('viewView') || 'week:week';
        if (layout === 'week:workweek' && isWeekend) layout = 'week:week';
        if (/(year|list)/.test(layout)) layout = 'week:week';
        return layout;
    }

    ext.point('io.ox/core/notifications/invites/item').extend({
        draw: function (baton) {
            var model = baton.model,
                node = this,
                onClickChangeStatus = function (e) {
                    // stopPropagation could be prevented by another markup structure
                    e.stopPropagation();
                    require(['io.ox/calendar/actions/acceptdeny']).done(function (acceptdeny) {
                        acceptdeny(model.attributes, { noFolderCheck: true });
                    });
                },
                onClickAccept = function (e) {
                    e.stopPropagation();
                    var o = calAPI.reduce(model.attributes),
                        appointmentData = model.attributes;
                    require(['settings!io.ox/calendar', 'io.ox/calendar/util'], function (calendarSettings, util) {
                        o.data = {
                            // default reminder
                            alarms: util.getDefaultAlarms(appointmentData),
                            attendee: _(appointmentData.attendees).findWhere({ entity: ox.user_id }),
                            id: appointmentData.id,
                            folder: appointmentData.folder
                        };
                        o.data.attendee.partStat = 'ACCEPTED';

                        var expand = util.getCurrentRangeOptions();
                        calAPI.confirm(o.data, _.extend({ checkConflicts: true }, expand)).done(function (result) {
                            if (result && result.conflicts) {
                                ox.load(['io.ox/calendar/conflicts/conflictList']).done(function (conflictView) {
                                    conflictView.dialog(result.conflicts)
                                        .on('ignore', function () {
                                            calAPI.confirm(o.data, _.extend({ checkConflicts: false }, expand));
                                        });
                                });
                                return;
                            }
                        })
                        .fail(function (error) {
                            yell(error);
                        });
                    });
                };

            var cid = _.cid(model.attributes),
                strings = util.getDateTimeIntervalMarkup(model.attributes, { output: 'strings', zone: moment().tz() }),
                recurrenceString = util.getRecurrenceString(model.attributes);
            node.attr({
                'data-cid': cid,
                'focus-id': 'calendar-invite-' + cid,
                //#. %1$s Appointment title
                //#, c-format
                'aria-label': gt('Invitation for %1$s.', model.get('title'))
            }).append(
                $('<a class="notification-info" role="button">').append(
                    $('<span class="span-to-div time">').text(strings.timeStr).attr('aria-label', util.getTimeIntervalA11y(model.attributes, moment().tz())),
                    $('<span class="span-to-div date">').text(strings.dateStr).attr('aria-label', util.getDateIntervalA11y(model.attributes, moment().tz())),
                    recurrenceString === '' ? [] : $('<span class="span-to-div recurrence">').text(recurrenceString),
                    $('<span class="span-to-div title">').text(model.get('summary')),
                    $('<span class="span-to-div location">').text(model.get('location')),
                    $('<span class="span-to-div organizer">').text(model.get('organizer').cn),
                    $('<button type="button" class="btn btn-link open-in-calendar">').text(gt('Open in calendar')).on('click', function (e) {
                        if (e.type !== 'click' && e.which !== 13) return;

                        var options = {
                            folder: model.get('folder'),
                            id: model.get('id'),
                            perspective: getLayout(model)
                        };

                        if (_.device('smartphone')) notifications.dropdown.close();

                        ox.launch('io.ox/calendar/main', options).done(function () {
                            if (this.folders) this.folders.add(options.folder);
                            // no need for a redraw, just select the folder
                            if (this.folderView) this.folderView.tree.$el.find('[data-id="' + options.folder + '"] .color-label').addClass('selected');
                            var currentPage = this.pages ? this.pages.getCurrentPage() : false;
                            // resume calendar app
                            if (this.folders && this.folderView && currentPage && currentPage.perspective && currentPage.perspective.showAppointment) {
                                // workaround: set layout
                                ox.ui.Perspective.show(this, options.perspective, { disableAnimations: true }).then(function () {
                                    var e = $.Event('click', { target: currentPage.perspective.main });
                                    currentPage.perspective.setNewStart = true;
                                    currentPage.perspective.showAppointment(e, options, { arrow: false });
                                });
                            } else {
                                // perspective is not initialized yet on newly launched calendar app
                                this.once('aftershow:done', function (perspective) {
                                    this.folders.add(options.folder);
                                    // no need for a redraw, just select the folder
                                    this.folderView.tree.$el.find('[data-id="' + options.folder + '"] .color-label').addClass('selected');
                                    // workaround: use defer to handle tricky page controller loading smartphone
                                    _.defer(function () {
                                        var e = $.Event('click', { target: perspective.main });
                                        perspective.setNewStart = true;
                                        perspective.showAppointment(e, options, { arrow: false });
                                    });
                                });
                            }
                        });
                    }),
                    $('<span class="sr-only">').text(gt('Press to open Details'))
                ),
                $('<div class="actions">').append(
                    $('<button type="button" class="refocus btn btn-default" data-action="accept_decline">')
                        .attr({
                            'focus-id': 'calendar-invite-' + cid + '-accept-decline',
                            // button aria labels need context
                            'aria-label': gt('Accept/Decline') + ' ' + model.get('summary')
                        })
                        .css('margin-right', '14px')
                        .text(gt('Accept / Decline'))
                        .on('click', onClickChangeStatus),
                    $('<button type="button" class="refocus btn btn-success" data-action="accept">')
                        .attr({
                            // button aria labels need context
                            'aria-label': gt('Accept invitation') + ' ' + model.get('summary'),
                            'focus-id': 'calendar-invite-' + cid + '-accept'
                        })
                        .on('click', onClickAccept)
                        .append($('<i class="fa fa-check" aria-hidden="true">'))
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
                    var min = node.find('[data-action="selector"]').val();
                    // 0 means 'don't remind me again was selected.
                    if (min !== '0') {
                        calAPI.remindMeAgain(_(baton.requestedModel.attributes).extend({ time: min * 60000 })).done(function () {
                            calAPI.getAlarms();
                        });
                    } else {
                        calAPI.acknowledgeAlarm(baton.requestedModel.attributes);
                    }
                    baton.view.collection.remove(baton.requestedModel.attributes);
                });
            });
        }
    });

    ext.point('io.ox/core/notifications/calendar-reminder/footer').extend({
        draw: function (baton) {
            if (baton.view.collection.length > 1) {
                //#. notification pane: action  to remove/acknowledge all reminders (they don't show up anymore)
                this.append($('<button class="btn btn-link">').text(gt('Remove all reminders')).on('click', function () {
                    calAPI.acknowledgeAlarm(baton.view.collection.toJSON());
                    baton.view.collection.reset();
                }));
            }
        }
    });

    ext.point('io.ox/core/notifications/register').extend({
        id: 'appointmentReminder',
        index: 100,
        register: function () {
            var options = {
                    id: 'io.ox/calendarreminder',
                    api: calAPI,
                    useListRequest: true,
                    useApiCid: true,
                    apiEvents: {
                        // triggered when something went wrong when getting event data in the list request -> event was probably deleted. In any case, clear the alarm
                        remove: 'failureToFetchEvent acknowledgedAlarm'
                    },
                    //#. Reminders (notifications) about appointments
                    title: gt('Appointment reminders'),
                    extensionPoints: {
                        item: 'io.ox/core/notifications/calendar-reminder/item',
                        footer: 'io.ox/core/notifications/calendar-reminder/footer'
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
                        var title = model.get('summary'),
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
                nextAlarmTimer,
                nextAlarm,
                alarmsToShow = [],
                subview = new Subview(options),
                audioQueue = [],
                playing = false,
                playAlarm = function (alarm) {
                    if (alarm) {
                        audioQueue.push(alarm);
                    }
                    if (!playing && audioQueue.length) {
                        playing = true;
                        var alarmToPlay = audioQueue.shift();
                        calAPI.get(alarmToPlay).done(function (eventModel) {
                            yell('info', eventModel ? eventModel.get('summary') : gt('Appointment reminder'));
                            soundUtil.playSound();
                            calAPI.acknowledgeAlarm(alarmToPlay);
                            setTimeout(function () {
                                playing = false;
                                playAlarm();
                            }, 5000);
                        }).fail(function () {
                            playing = false;
                            playAlarm();
                        });
                    }
                };

            calAPI.on('resetChronosAlarms', function (alarms) {
                var alarmsToAdd = [],
                    now = new moment().utc().format(util.ZULU_FORMAT),
                    getIds = function () {
                        var ids = [];
                        subview.collection.forEach(function (model) {
                            ids.push(util.cid({ folder: model.get('folder'), id: model.get('eventId'), recurrenceId: model.get('recurrenceId') }));
                        });
                        return ids;
                    },
                    timerFunction = function () {
                        var ids = getIds();
                        if (nextAlarm.action === 'AUDIO') {
                            playAlarm(nextAlarm);
                        } else if (_(ids).indexOf(util.cid({ folder: nextAlarm.folder, id: nextAlarm.eventId, recurrenceId: nextAlarm.recurrenceId })) > -1) {
                            // acknowledge duplicates (only one alarm per event)
                            calAPI.acknowledgeAlarm(nextAlarm);
                        } else {
                            subview.addNotifications(nextAlarm);
                            ids = getIds();
                        }

                        nextAlarm = undefined;
                        now = new moment().utc().format(util.ZULU_FORMAT);
                        var temp = [];
                        _(alarmsToShow).each(function (alarm) {
                            if (alarm.time <= now) {
                                if (alarm.action === 'AUDIO') {
                                    playAlarm(alarm);
                                } else if (_(ids).indexOf(util.cid({ folder: alarm.folder, id: alarm.eventId, recurrenceId: alarm.recurrenceId })) > -1) {
                                    // acknowledge duplicates (only one alarm per event)
                                    calAPI.acknowledgeAlarm(alarm);
                                } else {
                                    subview.addNotifications(alarm);
                                    ids = getIds();
                                }
                            } else if (!nextAlarm || nextAlarm.time > alarm.time) {
                                if (nextAlarm) {
                                    temp.push(nextAlarm);
                                }
                                nextAlarm = alarm;
                            } else {
                                temp.push(alarm);
                            }
                        });
                        alarmsToShow = temp;
                        if (nextAlarm) {
                            nextAlarmTimer = setTimeout(timerFunction, new moment(nextAlarm.time).utc().valueOf() - new moment(now).utc().valueOf());
                        }
                    };

                nextAlarm = undefined;
                if (nextAlarmTimer) {
                    clearTimeout(nextAlarmTimer);
                    nextAlarmTimer = undefined;
                }
                _(alarms).each(function (alarm) {
                    if (alarm.time > now) {
                        if (!nextAlarm || nextAlarm.time > alarm.time) {
                            if (nextAlarm) {
                                alarmsToShow.push(nextAlarm);
                            }

                            nextAlarm = alarm;
                        } else {
                            alarmsToShow.push(alarm);
                        }
                    } else if (alarm.action === 'AUDIO') {
                        playAlarm(alarm);
                    } else {
                        alarmsToAdd.push(alarm);
                    }
                });

                if (nextAlarm) {
                    nextAlarmTimer = setTimeout(timerFunction, new moment(nextAlarm.time).valueOf() - new moment(now).valueOf());
                }
                var ids = getIds();
                alarmsToAdd = _(alarmsToAdd).uniq(function (alarm) {
                    return util.cid({ folder: alarm.folder, id: alarm.eventId, recurrenceId: alarm.recurrenceId });
                });
                alarmsToAdd = alarmsToAdd.filter(function (alarm) {
                    if (_(ids).indexOf(util.cid({ folder: alarm.folder, id: alarm.eventId, recurrenceId: alarm.recurrenceId })) > -1 && !subview.collection.get(alarm.id)) {
                        // acknowledge duplicates (only one alarm per event)
                        calAPI.acknowledgeAlarm(alarm);
                        return false;
                    }
                    return true;
                });
                subview.resetNotifications(alarmsToAdd);
            });
            //react to changes in settings
            settings.on('change:autoOpenNotification', function (e, value) {
                autoOpen = value;
                subview.model.set('autoOpen', value);
            });

            calAPI.getAlarms();
        }
    });

    ext.point('io.ox/core/notifications/register').extend({
        id: 'appointmentInvitations',
        index: 300,
        register: function () {
            var options = {
                    id: 'io.ox/calendarinvitations',
                    api: calAPI,
                    smartRemove: true,
                    useApiCid: true,
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
                    detailviewOptions: { noFolderCheck: true },
                    autoOpen: autoOpen,
                    genericDesktopNotification: {
                        //#. Title of generic desktop notification about new invitations to appointments
                        title: gt('New appointment invitation'),
                        //#. Body text of generic desktop notification about new invitations to appointments
                        body: gt('You have new appointment invitations'),
                        icon: ''
                    },
                    specificDesktopNotification: function (model) {
                        var title = model.get('summary'),
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

            ox.on('socket:calendar:updates', function (data) {
                _(data.needsAction).each(function (obj) {
                    obj.folder = obj.folderId;
                });
                if (data.needsAction) subview.addNotifications(data.needsAction);
            });

            //react to changes in settings
            settings.on('change:autoOpenNotification', function (e, value) {
                subview.model.set('autoOpen', value);
            });

            calAPI.getInvites();
        }
    });

    return true;
});
