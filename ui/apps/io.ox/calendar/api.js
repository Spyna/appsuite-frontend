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
 *
 */

define('io.ox/calendar/api', [
    'io.ox/core/http',
    'io.ox/core/event',
    'settings!io.ox/core',
    'io.ox/core/notifications',
    'io.ox/core/folder/api',
    'io.ox/core/api/factory',
    'io.ox/core/capabilities'
], function (http, Events, coreSettings, notifications, folderAPI, factory, capabilities) {

    'use strict';

    var api = {

        // fluent caches
        caches: {
            freebusy: {},
            all: {},
            get: {},
            // object to store appointments, that have attachments uploading atm
            upload: {}
        },

        getInvitesSince: 0,

        reduce: factory.reduce,

        get: function (o, useCache) {

            o = o || {};
            useCache = useCache === undefined ? true : !!useCache;
            var params = {
                action: 'get',
                id: o.id,
                folder: o.folder || o.folder_id,
                timezone: 'UTC'
            };

            if (o.recurrence_position !== null) {
                params.recurrence_position = o.recurrence_position;
            }

            var key = (o.folder || o.folder_id) + '.' + o.id + '.' + (o.recurrence_position || 0);

            if (api.caches.get[key] === undefined || !useCache) {
                return http.GET({
                    module: 'calendar',
                    params: params
                })
                .done(function (data) {
                    api.caches.get[key] = data;
                }).fail(function (error) {
                    api.trigger('error error:' + error.code, error);
                    return error;
                });
            }
            return $.Deferred().resolve(api.caches.get[key]);
        },

        getAll: function (o, useCache) {

            o = $.extend({
                start: _.now(),
                end: moment().add(28, 'days').valueOf(),
                order: 'asc'
            }, o || {});
            useCache = useCache === undefined ? true : !!useCache;
            var folderId = o.folder !== undefined ? o.folder : o.folder_id,
                key = folderId + '.' + o.start + '.' + o.end + '.' + o.order,
                params = {
                    action: 'all',
                    // id, folder_id, last_modified, private_flag, color_label, recurrence_id, recurrence_position, start_date,
                    // title, end_date, location, full_time, shown_as, users, organizer, organizerId, created_by,
                    // participants, recurrence_type, days, day_in_month, month, interval, until, occurrences
                    columns: '1,20,5,101,102,206,207,201,200,202,400,401,402,221,224,227,2,209,212,213,214,215,222,216,220',
                    start: o.start,
                    end: o.end,
                    showPrivate: true,
                    recurrence_master: false,
                    sort: '201',
                    order: o.order,
                    timezone: 'UTC'
                };

            if (o.folder !== undefined) {
                params.folder = o.folder;
            }
            if (api.caches.all[key] === undefined || !useCache) {
                return http.GET({
                    module: 'calendar',
                    params: params
                })
                .done(function (data) {
                    api.caches.all[key] = JSON.stringify(data);
                }).fail(function (error) {
                    api.trigger('error error:' + error.code, error);
                    return error;
                });
            }
            return $.Deferred().resolve(JSON.parse(api.caches.all[key]));
        },

        getList: function (ids) {
            return http.fixList(ids,
                http.PUT({
                    module: 'calendar',
                    params: {
                        action: 'list',
                        timezone: 'UTC'
                    },
                    data: http.simplify(ids)
                })
            );
        },

        getUpdates: function (o) {
            o = $.extend({
                start: _.now(),
                end: moment().add(28, 'days').valueOf(),
                timestamp:  moment().subtract(2, 'days').valueOf(),
                ignore: 'deleted',
                recurrence_master: false
            }, o || {});

            var key = (o.folder || o.folder_id) + '.' + o.start + '.' + o.end,
                params = {
                    action: 'updates',
                    // id, folder_id, private_flag, color_label, recurrence_id, recurrence_position, start_date,
                    // title, end_date, location, full_time, shown_as, users, organizer, organizerId, created_by, recurrence_type
                    columns: '1,20,101,102,206,207,201,200,202,400,401,402,221,224,227,2,209,212,213,214,215,222,216,220',
                    start: o.start,
                    end: o.end,
                    showPrivate: true,
                    recurrence_master: o.recurrence_master,
                    timestamp: o.timestamp,
                    ignore: o.ignore,
                    sort: '201',
                    order: 'asc',
                    timezone: 'UTC'
                };

            if (o.folder !== 'all') {
                params.folder = o.folder || coreSettings.get('folder/calendar');
            }

            // do not know if cache is a good idea
            if (api.caches.all[key] === undefined) {
                return http.GET({
                    module: 'calendar',
                    params: params
                })
                .done(function (data) {
                    api.caches.all[key] = JSON.stringify(data);
                });
            }
            return $.Deferred().resolve(JSON.parse(api.caches.all[key]));
        },

        search: function (query) {
            return http.PUT({
                module: 'calendar',
                params: {
                    action: 'search',
                    sort: '201',
                    // top-down makes more sense
                    order: 'desc',
                    timezone: 'UTC'
                },
                data: {
                    pattern: query
                }
            });
        },

        needsRefresh: function (folder) {
            // has entries in 'all' cache for specific folder
            return api.caches.all[folder] !== undefined;
        },

        /**
         * update appointment
         * @param  {object} o (id, folder and changed attributes/values)
         * @fires  api#update (data)
         * @fires  api#update: + cid
         * @return { deferred} returns current appointment object
         */
        update: function (o) {
            var folder_id = o.folder_id || o.folder,
                key = folder_id + '.' + o.id + '.' + (o.recurrence_position || 0),
                attachmentHandlingNeeded = o.tempAttachmentIndicator;

            delete o.cid;
            delete o.tempAttachmentIndicator;

            if (_.isEmpty(o)) return $.when();

            return http.PUT({
                module: 'calendar',
                params: {
                    action: 'update',
                    id: o.id,
                    folder: folder_id,
                    timestamp: o.last_modified || o.timestamp || _.then(),
                    timezone: 'UTC'
                },
                data: o,
                appendColumns: false
            })
            .then(function (obj) {
                // check for conflicts
                if (!_.isUndefined(obj.conflicts)) {
                    return $.Deferred().reject(obj);
                }

                checkForNotification(o);

                var getObj = {
                    id: obj.id || o.id,
                    folder: folder_id
                };

                if (o.recurrence_position && o.recurrence_position !== null && obj.id === o.id) {
                    getObj.recurrence_position = o.recurrence_position;
                }

                // clear caches
                api.caches.all = {};
                delete api.caches.get[key];
                // if master, delete all appointments from cache
                if (o.recurrence_type > 0 && !o.recurrence_position) {
                    var deleteKey = folder_id + '.' + o.id;
                    for (var i in api.caches.get) {
                        if (i.indexOf(deleteKey) === 0) delete api.caches.get[i];
                    }
                }

                return api.get(getObj)
                    .then(function (data) {
                        if (attachmentHandlingNeeded) {
                            //to make the detailview show the busy animation
                            api.addToUploadList(_.ecid(data));
                        }
                        api.trigger('update', data);
                        api.trigger('update:' + _.ecid(o), data);
                        return data;
                    });
            }, function (error) {
                api.caches.all = {};
                api.trigger('delete', o);
                return error;
            });
        },

        /**
         * used to cleanup Cache and trigger refresh after attachmentHandling
         * @param  {object} o (appointment object)
         * @fires  api#update (data)
         * @return { deferred }
         */
        attachmentCallback: function (o) {
            var doCallback = api.uploadInProgress(_.ecid(o)),
                folder_id = o.folder_id || o.folder,
                key = folder_id + '.' + o.id + '.' + (o.recurrence_position || 0);

            // clear caches
            if (doCallback) {
                // clear caches
                api.caches.all = {};
                delete api.caches.get[key];
                // if master, delete all appointments from cache
                if (o.recurrence_type > 0 && !o.recurrence_position) {
                    var deleteKey = folder_id + '.' + o.id;
                    for (var i in api.caches.get) {
                        if (i.indexOf(deleteKey) === 0) delete api.caches.get[i];
                    }
                }
            }

            return api.get(o, !doCallback)
                .then(function (data) {
                    api.trigger('update', data);
                    api.trigger('update:' + _.ecid(o), data);
                    //to make the detailview remove the busy animation
                    api.removeFromUploadList(_.ecid(data));
                    return data;
                });
        },

        /**
         * create appointment
         * @param  {object} o
         * @fires  api#create (data)
         * @fires  api#update: + cid
         * @return { deferred} returns appointment
         */
        create: function (o) {
            var attachmentHandlingNeeded = o.tempAttachmentIndicator;
            delete o.cid;
            delete o.tempAttachmentIndicator;
            return http.PUT({
                module: 'calendar',
                params: {
                    action: 'new',
                    timezone: 'UTC'
                },
                data: o,
                appendColumns: false
            })
            .then(function (obj) {
                // update foldermodel so total attribute is correct (export option uses this)
                folderAPI.reload(o);
                if (!_.isUndefined(obj.conflicts)) {
                    return $.Deferred().reject(obj);
                }

                checkForNotification(o);

                var getObj = {
                    id: obj.id,
                    folder: o.folder_id
                };
                api.caches.all = {};

                if (o.recurrence_position && o.recurrence_position !== null) {
                    getObj.recurrence_position = o.recurrence_position;
                }

                return api.get(getObj)
                    .then(function (data) {
                        if (attachmentHandlingNeeded) {
                            //to make the detailview show the busy animation
                            api.addToUploadList(_.ecid(data));
                        }
                        api.trigger('create', data);
                        api.trigger('update:' + _.ecid(data), data);
                        return data;
                    });
            });
        },

        // appointment on the server
        remove: function (o) {
            var keys = [],
                folders = [];

            o = _.isArray(o) ? o : [o];

            // pause http layer
            http.pause();

            api.trigger('beforedelete', o);

            _(o).each(function (obj) {
                keys.push((obj.folder_id || obj.folder) + '.' + obj.id + '.' + (obj.recurrence_position || 0));
                return http.PUT({
                    module: 'calendar',
                    params: {
                        action: 'delete',
                        timestamp: _.then()
                    },
                    data: obj,
                    appendColumns: false
                })
                .done(function () {
                    // gather folders to refresh
                    folders.push(String(obj.folder_id || obj.folder));
                    api.caches.all = {};
                    _(keys).each(function (key) {
                        delete api.caches.get[key];
                    });
                    api.trigger('delete', obj);
                    api.trigger('delete:' + _.ecid(obj), obj);
                    //remove Reminders in Notification Area
                    checkForNotification(obj, true);
                }).fail(function () {
                    api.caches.all = {};
                    api.trigger('delete');
                });
            });

            return http.resume().then(function () {
                folderAPI.reload(folders);
                api.trigger('refresh.all');
            });
        },

        /**
         * move appointments to a folder
         * @param  {array} list
         * @param  {string} targetFolderId
         * @return { deferred }
         */
        move: function (list, targetFolderId) {
            return copymove(list, 'update', targetFolderId);
        },

        /**
         * copy appointments to a folder
         * @param  {array} list
         * @param  {string} targetFolderId
         * @return { deferred }
         */
        copy: function (list, targetFolderId) {
            return copymove(list, 'copy', targetFolderId);
        },
        /**
         * check if you have appointments confirmed that conflict with the given appointment and returns them
         * @param  {object} appointment
         * @return {deferred}
         */
        checkConflicts: function (appointment) {

            // no conflicts for free appointments
            if (appointment.shown_as === 4) {
                return $.Deferred().resolve([]);
            }
            var data = appointment,
                //conflicts with appointments in the past are of no interest
                start = Math.max(_.now(), appointment.start_date);

            return http.GET({
                module: 'calendar',
                params: {
                    action: 'all',
                    // id, created_by, folder_id, private_flag, title, start_date, end_date, recurrence_position, users, location, shown_as
                    columns: '1,2,20,101,200,201,202,207,221,400,402',
                    start: start,
                    end: appointment.end_date,
                    showPrivate: true,
                    recurrence_master: false,
                    sort: '201',
                    order: 'asc',
                    timezone: 'UTC'
                }
            })
            .then(function (items) {

                var conflicts = [],
                    //maximum number of conflicts to return (to reduce calculations and prevent cases with really high numbers of appointments)
                    max = 50;

                for (var i = 0; i < items.length && conflicts.length < max; i++) {
                    if (items[i].id !== data.id) {
                        //no conflict with itself
                        if (items[i].shown_as !== 4) {
                            //4 = free
                            var found = false;
                            for (var a = 0; a < items[i].users.length && !found; a++) {
                                if (items[i].users[a].id === ox.user_id && (items[i].users[a].confirmation === 1 || items[i].users[a].confirmation === 3)) {
                                    //confirmed or tentative
                                    conflicts.push(items[i]);
                                }
                            }
                        }
                    }
                }

                return conflicts;
            });
        },

        /**
         * change confirmation status
         * @param  {object} o (properties: id, folder, data, occurrence)
         * @fires  api#mark:invite:confirmed (o)
         * @fires  api#update (data)
         * @fires  api#update: + cid
         * @return { deferred }
         */
        confirm: function (o) {

            var folder_id = o.folder_id || o.folder,
                key = folder_id + '.' + o.id + '.' + (o.occurrence || 0),
                alarm = -1,
                params = {
                    action: 'confirm',
                    folder: folder_id,
                    id: o.id,
                    timestamp: _.then(),
                    timezone: 'UTC'
                };

            // contains alarm?
            if ('alarm' in o.data) {
                alarm = o.data.alarm;
                delete o.data.alarm;
            }

            // occurrence
            if (o.occurrence) {
                params.occurrence = o.occurrence;
            }

            return http.PUT({
                module: 'calendar',
                params: params,
                data: o.data,
                appendColumns: false
            })
            .then(function (resp, timestamp) {
                if (alarm === -1) return;
                return api.update({
                    folder: o.folder,
                    id: o.id,
                    // ie gets conflict error so manual timestamp is needed here
                    timestamp: timestamp,
                    alarm: alarm
                });
            })
            .then(function () {
                api.caches.get = {};
                api.caches.all = {};
                // redraw detailview to be responsive and remove invites
                api.trigger('mark:invite:confirmed', o);
                delete api.caches.get[key];
                return api.get(o).then(function (data) {
                    // fix confirmation data
                    // this is necessary when changing the confirmation for a single appointment
                    // within a series as it becomes an exception.
                    // the series does not update, however (see bug 40137)
                    // careful here when confirming in a shared calendar the user confirms on behalf of the calendar owner (o.data.id !== ox.user_id) see (Bug 55075)
                    var user = _(data.users).findWhere({ id: o.data.id || ox.user_id });
                    if (user) _.extend(user, _(o.data).pick('confirmation', 'confirmmessage'));
                    // events
                    api.trigger('update', data);
                    api.trigger('update:' + _.ecid(data), data);
                    return data;
                });
            });
        },

        /**
         * removes recurrence information
         * @param  {object} obj (appointment object)
         * @return { object} reduced copy of appointment object
         */
        removeRecurrenceInformation: function (obj) {
            var recAttr = ['change_exceptions', 'delete_exceptions', 'days', 'day_in_month', 'month', 'interval', 'until', 'occurrences'],
                ret = _.clone(obj);
            for (var i = 0; i < recAttr.length; i++) {
                if (ret[recAttr[i]]) {
                    delete ret[recAttr[i]];
                }
            }
            ret.recurrence_type = 0;
            return ret;
        },

        /**
         * get invites
         * @fires  api#new-invites (invites)
         * @return { deferred} returns sorted array of appointments
         */
        getInvites: function () {

            var now = _.now(),
                start = moment(now).subtract(2, 'hours').valueOf(),
                end = moment(now).add(2, 'years').valueOf();

            return this.getUpdates({
                folder: 'all',
                start: start,
                end: end,
                timestamp: api.getInvitesSince || moment().subtract(5, 'years').valueOf(),
                recurrence_master: true
            })
            .then(function (list) {
                // sort by start_date & look for unconfirmed appointments
                // exclude appointments that already ended
                var invites = _.chain(list)
                    .filter(function (item) {

                        var isOver = item.end_date < now,
                            isRecurring = !!item.recurrence_type;

                        if (!isRecurring && isOver) {
                            return false;
                        }

                        return _(item.users).any(function (user) {
                            return user.id === ox.user_id && user.confirmation === 0;
                        });
                    })
                    .sortBy('start_date')
                    .value();
                // even if empty array is given it needs to be triggered to remove
                // notifications that does not exist anymore (already handled in ox6 etc)
                api.trigger('new-invites', invites);
                return invites;
            });
        },

        /**
         * get participants appointments
         * @param  {array} list  (participants)
         * @param  {object} options
         * @param  {boolean} useCache [optional]
         * @return { deferred} returns a nested array with participants and their appointments
         */
        freebusy: function (list, options, useCache) {
            list = [].concat(list);
            useCache = useCache === undefined ? true : !!useCache;

            if (list.length === 0) {
                return $.Deferred().resolve([]);
            }

            options = _.extend({
                start: _.now(),
                end: moment().add(1, 'day').valueOf()
            }, options);

            var result = [], requests = [];

            _(list).each(function (obj) {
                // freebusy only supports internal users and resources
                if (obj.type === 1 || obj.type === 3) {
                    var key = [obj.type, obj.id, options.start, options.end].join('-');
                    // in cache?
                    if (key in api.caches.freebusy && useCache) {
                        result.push(api.caches.freebusy[key]);
                    } else {
                        result.push(key);
                        requests.push({
                            module: 'calendar',
                            action: 'freebusy',
                            id: obj.id,
                            type: obj.type,
                            start: options.start,
                            end: options.end,
                            timezone: 'UTC',
                            sort: 201,
                            order: 'asc'
                        });
                    }
                } else {
                    result.push({ data: [] });
                }
            });

            if (requests.length === 0) {
                return $.Deferred().resolve(result);
            }

            return http.PUT({
                module: 'multiple',
                data: requests,
                appendColumns: false,
                'continue': true
            })
            .then(function (response) {
                return _(result).map(function (obj) {
                    if (_.isString(obj)) {
                        // use fresh server data
                        return (api.caches.freebusy[obj] = response.shift());
                    }
                    // use cached data
                    return obj;
                });
            });
        },

        /**
         * ask if this appointment has attachments uploading at the moment (busy animation in detail View)
         * @param  {string} key (task id)
         * @return { boolean }
         */
        uploadInProgress: function (key) {
            // return true boolean
            return this.caches.upload[key] || false;
        },

        /**
         * add appointment to the list
         * @param {string} key (task id)
         * @return { undefined }
         */
        addToUploadList: function (key) {
            this.caches.upload[key] = true;
        },

        /**
         * remove appointment from the list
         * @param  {string} key (task id)
         * @fires  api#update: + key
         * @return { undefined }
         */
        removeFromUploadList: function (key) {
            delete this.caches.upload[key];
            //trigger refresh
            api.trigger('update:' + key);
        },

        /**
         * bind to global refresh; clears caches and trigger refresh.all
         * @fires  api#refresh.all
         * @return { promise }
         */
        refresh: function () {
            // check capabilities
            if (capabilities.has('calendar')) {
                api.getInvites().done(function () {
                    // clear caches
                    api.caches.all = {};
                    api.caches.get = {};
                    // clear freebusy cache too
                    if (capabilities.has('freebusy')) {
                        api.caches.freebusy = {};
                    }
                    // trigger local refresh
                    api.trigger('refresh.all');
                });
            }
        }

    };

    Events.extend(api);

    var copymove = function (list, action, targetFolderId) {
        var folders = [String(targetFolderId)];
        // allow single object and arrays
        list = _.isArray(list) ? list : [list];
        // pause http layer
        http.pause();
        // process all updates
        _(list).map(function (o) {
            folders.push(String(o.folder_id || o.folder));
            return http.PUT({
                module: 'calendar',
                params: {
                    action: action || 'update',
                    id: o.id,
                    folder: o.folder_id || o.folder,
                    // mandatory for 'update'
                    timestamp: o.last_modified || o.timestamp || _.then()
                },
                data: { folder_id: targetFolderId },
                appendColumns: false
            });
        });
        // resume & trigger refresh
        return http.resume()
            .then(function (result) {

                folderAPI.reload(folders);
                var def = $.Deferred();

                _(result).each(function (item) {
                    if (item.error) def.reject(item.error);
                });

                if (def.state() === 'rejected') return def;

                return def.resolve();
            })
            .done(function () {
                // clear cache and trigger local refresh
                api.caches.all = {};
                api.caches.get = {};
                _(list).each(function (obj) {
                    api.trigger('move:' + _.ecid(obj), targetFolderId);
                });
                api.trigger('refresh.all');
            });
    };

    var checkForNotification = function (obj, removeAction) {
        if (removeAction) {
            api.trigger('delete:appointment', obj);
        } else if (obj.alarm !== '-1' && obj.end_date > _.now()) {
            //new appointments
            require(['io.ox/core/api/reminder'], function (reminderAPI) {
                reminderAPI.getReminders();
            });
        } else if (obj.alarm || obj.end_date || obj.start_date) {
            //if one of this has changed during update action
            require(['io.ox/core/api/reminder'], function (reminderAPI) {
                reminderAPI.getReminders();
            });
        }
    };

    // removes entries from the freebusy cache that belong to the current user
    var cleanupFreeBusyCache = function () {
        api.caches.freebusy = _(api.caches.freebusy).pick(function (value, key) {
            //keys start with '1-', '3-' etc depending on type, so the id is at index 2
            return key.indexOf(ox.user_id) !== 2;
        });
    };

    // clear freebusy cache for current user
    if (capabilities.has('freebusy')) {
        api.on('create update delete', cleanupFreeBusyCache);
    }

    api.on('create update', function (e, obj) {
        // has participants?
        if (obj && _.isArray(obj.participants) && obj.participants.length > 0) {
            // check for external participants
            var hasExternalParticipants = _(obj.participants).some(function (participant) {
                return participant.type === 5;
            });
            if (hasExternalParticipants) {
                require(['io.ox/contacts/api'], function (contactsApi) {
                    contactsApi.trigger('maybeNewContact');
                });
            }
        }
    });

    folderAPI.on({
        'before:remove before:move': function (data) {
            if (data.module === 'calendar') {
                //remove cache for "All my appointments"
                var cleanedAllCache = _.omit(api.caches.all, function (value, key) {
                    return key.split('.')[0] === '0';
                });
                api.caches.all = cleanedAllCache;
            }

        }
    });

    ox.on('refresh^', function () {
        api.refresh();
    });

    return api;
});
