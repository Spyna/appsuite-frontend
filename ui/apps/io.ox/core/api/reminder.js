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
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */
define('io.ox/core/api/reminder', [
    'io.ox/core/http',
    'io.ox/tasks/api',
    'io.ox/calendar/api',
    'io.ox/core/date',
    'io.ox/core/event'
], function (http, taskAPI, calendarAPI, date, Events) {

    'use strict';

    //object to store reminders that are not to display yet
    var reminderStorage = {},
        nextReminder,//next reminder to be triggered
        reminderTimer,// timer that triggers the next reminder
        updateReminders = function (reminders) {//adds new reminders and removes invalid ones
            var validIds = [],
                needsForceCheck = false;
            _(reminders).each(function (reminder) {
                if (!reminderStorage[reminder.id]) {//new
                    reminderStorage[reminder.id] = reminder;
                } else if (reminderStorage[reminder.id].alarm !== reminder.alarm) {//alarm was updated
                    if (reminderStorage[reminder.id].displayed) {
                        api.trigger('remove:reminder', [{ id: reminder.target_id, folder_id: reminder.folder }]);
                        needsForceCheck = true;
                    }
                    reminderStorage[reminder.id] = reminder;
                }
                validIds.push(reminder.id);
            });
            var ids = [];
            //remove reminders that are no longer there
            _(reminderStorage).each(function (item) {
                if (!(_.contains(validIds, item.id))) {
                    ids.push(item.id);
                }
            });
            api.removeFromStorage(ids, needsForceCheck);
        },
        checkReminders = function () {//function to check reminders and add a timer to trigger the next one
            var changed = false;
            _(reminderStorage).each(function (reminder) {
                if (!reminder.displayed) {
                    if (!nextReminder) {
                        nextReminder = reminder;
                        changed = true;
                    } else if (reminder.alarm < nextReminder.alarm) {
                        nextReminder = reminder;
                        changed = true;
                    }
                }
            });

            if (changed) {
                clearTimeout(reminderTimer);
                var timeout = nextReminder.alarm - _.now();
                if (timeout < 0) { //setTimeout can only handle small negative values, to prevent errors we set it to 0
                    timeout = 0;
                }
                reminderTimer = setTimeout(function () {
                    if (nextReminder.module === 4) {
                        api.trigger('add:tasks:reminder', [nextReminder]);
                    } else if (nextReminder.module === 1) {
                        api.trigger('add:calendar:reminder', [nextReminder]);
                    }
                    reminderStorage[nextReminder.id].displayed = true;
                    nextReminder = null;
                    checkReminders();
                }, timeout);
            }
        };

    var api = {
        /**
        * delete reminder
        * @param  {ids} reminderIds
        * @param  {forceCheck} checkReminders is called even if next reminder was not deleted
        */
        removeFromStorage: function (ids, forceCheck) {//removesReminders
            var removedNext = false;
            _(ids).each(function (id) {
                if (nextReminder && nextReminder.id === id) {
                    removedNext = true;
                    clearTimeout(reminderTimer);
                    nextReminder = null;
                }
                if (reminderStorage[id].displayed) {
                    api.trigger('remove:reminder', [{ id: reminderStorage[id].target_id, folder_id: reminderStorage[id].folder }]);//remove displayed reminders
                }
                delete reminderStorage[id];
            });
            if (removedNext || forceCheck) {
                checkReminders();
            }
        },

        /**
         * delete reminder
         * @param  {string} reminderId
         * @return { deferred }
         */
        deleteReminder: function (reminderId) {
            return http.PUT({
                module: 'reminder',
                params: { action: 'delete' },
                data: { id: reminderId }
            }).then(function () {
                delete reminderStorage[reminderId];
            });
        },

        /**
         * remind again
         * @param  {number} remindDate (unix datetime)
         * @param  {string} reminderId
         * @return { deferred }
         */
        remindMeAgain: function (remindDate, reminderId) {
            return http.PUT({
                module: 'reminder',
                params: {
                    action: 'remindAgain',
                    id: reminderId,
                    timezone: 'UTC'
                },
                data: { alarm: remindDate }
            }).then(function () {
                delete reminderStorage[reminderId];//remove old reminder
                api.getReminders();//get the new data
            }, function () {
                reminderStorage[reminderId].displayed = false;//something went wrong, show the reminder again
                checkReminders();
            });
        },

        /**
         * get reminders
         * @param  {number} range (end of scope)
         * @param  {number} module
         * @fires  api#add:tasks:reminder (reminderTaskId, reminderId)
         * @fires  api#add:calendar:reminder (reminderCalId)
         * @return { deferred }
         */
        getReminders: function (range) {
            return http.GET({
                module: 'reminder',
                params: {
                    action: 'range',
                    timezone: 'UTC',
                    end: range || (_.now() + date.HOUR)//if no range given, get the reminders an our ahead(to be independent of global refresh)
                }
            }).pipe(function (list) {
                updateReminders(list);
                checkReminders();
                return list;
            });
        }
    };

    Events.extend(api);

    /**
     * bind to global refresh; clears caches and trigger refresh.all
     * @fires  api#refresh.all
     * @return { promise }
     */
    api.refresh = function () {
        api.getReminders().done(function () {
            // trigger local refresh
            api.trigger('refresh.all');
        });
    };

    var findReminders = function (e, objs) {
        //make sure we have an array
        objs = objs ? [].concat(objs) : [];
        var remindersToRemove = [];
        _(objs).each(function (obj) {
            if (!obj.data || obj.data.confirmation === 2) {//remove if no data is given (user was removed from a task) or if declined
                _(reminderStorage).each(function (reminder) {
                    if (obj.id === reminder.target_id) {
                        remindersToRemove.push(reminder.id);
                    }
                });
            }
        });
        if (remindersToRemove.length > 0) {
            api.removeFromStorage(remindersToRemove);
        }
    };

    //remove reminders for declined appointments or tasks. Makes no sense to show a reminder then
    calendarAPI.on('mark:invite:confirmed', findReminders);
    taskAPI.on('mark:task:confirmed', findReminders);

    ox.on('refresh^', function () {
        api.refresh();
    });

    return api;

});
