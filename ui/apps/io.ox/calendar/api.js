/**
 *
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2011
 * Mail: info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 *
 */

define("io.ox/calendar/api",
    ["io.ox/core/http",
     "io.ox/core/event",
     "io.ox/core/config",
     "io.ox/core/api/user"], function (http, Events, config, userAPI) {

    "use strict";

    // really stupid caching for speed
    var all_cache = {},
        get_cache = {},
        participant_cache = {};

    var DAY = 60000 * 60 * 24;

    var api = {

        get: function (o) {

            o = o || {};

            var params = {
                action: "get",
                id: o.id,
                folder: o.folder || o.folder_id
            };

            if (o.recurrence_position !== null) {
                params.recurrence_position = o.recurrence_position;
            }

            var key = (o.folder || o.folder_id) + "." + o.id + "." + (o.recurrence_position || 0);

            if (get_cache[key] === undefined) {
                return http.GET({
                        module: "calendar",
                        params: params
                    })
                    .done(function (data) {
                        get_cache[key] = data;
                    });
            } else {
                return $.Deferred().resolve(get_cache[key]);
            }
        },

        getAll: function (o) {

            o = $.extend({
                start: _.now(),
                end: _.now() + 28 * 1 * DAY
            }, o || {});

            // round start & end date
            o.start = (o.start / DAY >> 0) * DAY;
            o.end = (o.end / DAY >> 0) * DAY;

            var key = o.folder + "." + o.start + "." + o.end,
                params = {
                    action: "all",
                    // id, folder_id, private_flag, recurrence_position, start_date,
                    // title, end_date, location, full_time, shown_as, users, organizer, organizerId, created_by,
                    // participants
                    columns: "1,20,101,207,201,200,202,400,401,402,221,224,227,2,220",
                    start: o.start,
                    end: o.end,
                    showPrivate: true,
                    recurrence_master: false,
                    sort: "201",
                    order: "asc"
                };


            if (o.folder !== undefined) {
                params.folder = o.folder;
            }

            if (all_cache[key] === undefined) {
                return http.GET({
                        module: "calendar",
                        params: params
                    })
                    .done(function (data) {
                        all_cache[key] = data;
                    });
            } else {
                return $.Deferred().resolve(all_cache[key]);
            }
        },

        getList: function (ids) {
            return http.fixList(ids,
                http.PUT({
                    module: "calendar",
                    params: {
                        action: "list"
                    },
                    data: http.simplify(ids)
                })
            );
        },

        search: function (query) {
            return http.PUT({
                    module: "calendar",
                    params: {
                        action: "search",
                        sort: "201",
                        order: "desc" // top-down makes more sense
                    },
                    data: {
                        pattern: query
                    }
                });
        },

        needsRefresh: function (folder) {
            // has entries in 'all' cache for specific folder
            return all_cache[folder] !== undefined;
        },

        update: function (o) {
            var key = o.folder_id + "." + o.id + "." + (o.recurrence_position || 0);
            if (_.isEmpty(o)) {
                return $.when();
            } else {
                return http.PUT({
                    module: 'calendar',
                    params: {
                        action: 'update',
                        id: o.id,
                        folder: o.folder_id,
                        timestamp: _.now()
                    },
                    data: o
                })
                .pipe(function (obj) {
                    var getObj = {};
                    if (!_.isUndefined(obj.conflicts)) {
                        var df = new $.Deferred();
                        _(obj.conflicts).each(function (item) {
                            item.folder_id = o.folder_id;
                        });
                        df.reject(obj);
                        return df;
                    }

                    getObj.id = o.id;
                    getObj.folder = o.folder_id;
                    if (o.recurrence_position !== null) {
                        getObj.recurrence_position = o.recurrence_position;
                    }

                    all_cache = {};
                    delete get_cache[key];
                    return api.get(getObj)
                        .pipe(function (data) {
                            api.trigger('refresh.all');
                            api.trigger('update', data);
                            return data;
                        });
                });
            }

        },
        create: function (o) {
            return http.PUT({
                module: 'calendar',
                params: {
                    action: 'new'
                },
                data: o
            })
            .pipe(function (obj) {
                var getObj = {};
                if (!_.isUndefined(obj.conflicts)) {
                    var df = new $.Deferred();
                    _(obj.conflicts).each(function (item) {
                        item.folder_id = o.folder_id;
                    });
                    df.reject(obj);
                    return df;
                }
                getObj.id = obj.id;
                getObj.folder = o.folder_id;
                if (o.recurrence_position !== null) {
                    getObj.recurrence_position = o.recurrence_position;
                }
                all_cache = {};
                return api.get(getObj)
                        .pipe(function (data) {
                            api.trigger('refresh.all');
                            api.trigger('created', getObj);
                            return data;
                        });
            });
        },

        // delete is a reserved word :( - but this will delete the
        // appointment on the server
        remove: function (o) {
            var key = o.data.folder_id + "." + o.data.id + "." + (o.data.recurrence_position || 0);
            return http.PUT({
                module: 'calendar',
                params: {
                    action: 'delete',
                    timestamp: _.now()
                },
                data: o.data
            })
            .done(function (resp) {
                all_cache = {};
                delete get_cache[key];
                api.trigger('refresh.all');
            });
        },

        confirm: function (o) {
            return http.PUT({
                module: 'calendar',
                params: {
                    action: 'confirm',
                    folder: o.folder,
                    id: o.id
                },
                data: o.data
            })
            .done(function (resp) {
                get_cache = {};
                api.trigger('refresh.all');
            });
        },

        getUpdates: function (o) {

            o = $.extend({
                start: _.now(),
                end: _.now() + 28 * 1 * DAY,
                timestamp:  _.now() - (2 * DAY),
                ignore: 'deleted',
                recurrence_master: false
            }, o || {});

            // round start & end date
            o.start = (o.start / DAY >> 0) * DAY;
            o.end = (o.end / DAY >> 0) * DAY;

            var key = o.folder + "." + o.start + "." + o.end,
                params = {
                    action: "updates",
                    // id, folder_id, private_flag, recurrence_position, start_date,
                    // title, end_date, location, full_time, shown_as, users, organizer, organizerId, created_by, recurrence_type
                    columns: "1,20,101,207,201,200,202,400,401,402,221,224,227,2,209",
                    start: o.start,
                    end: o.end,
                    showPrivate: true,
                    recurrence_master: o.recurrence_master,
                    timestamp: o.timestamp,
                    ignore: o.ignore,
                    sort: "201",
                    order: "asc"
                };

            if (o.folder !== undefined) {
                params.folder = o.folder;
            }

            if (!params.folder) {
                params.folder = config.get('folder.calendar');
            }

            // do not know if cache is a good idea
            if (all_cache[key] === undefined) {
                return http.GET({
                        module: "calendar",
                        params: params
                    })
                    .done(function (data) {
                        all_cache[key] = data;
                    });
            } else {
                return $.Deferred().resolve(all_cache[key]);
            }
        }
    };

    Events.extend(api);

    api.getInvites = function () {

        var start = _.now();

        return userAPI.get().pipe(function (user) {
            api.getUpdates({
                start: start,
                end: start + 28 * 5 * DAY, //next four month?!?
                timestamp: 0,
                recurrence_master: true
            })
            .pipe(function (list) {
                // sort by start_date & look for unconfirmed appointments
                var invites = _.chain(list)
                    .filter(function (item) {
                        return _(item.users).any(function (item_user) {
                            return (item_user.id === user.id && (item_user.confirmation === 0));
                        });
                    })
                    .sortBy('start_date')
                    .value();
                if (invites.length > 0) {
                    api.trigger('new-invites', invites);
                }
                return invites;
            });
        });
    };

    // global refresh
    api.refresh = function () {
        api.getInvites().done(function () {
            // clear caches
            all_cache = {};
            // trigger local refresh
            api.trigger("refresh.all");
        });
    };

    ox.on('refresh^', function () {
        api.refresh();
    });

    return api;
});
