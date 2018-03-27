/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2017 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Richard Petersen <richard.petersen@open-xchange.com>
 *
 */

define('io.ox/calendar/api', [
    'io.ox/core/http',
    'io.ox/core/api/collection-pool',
    'io.ox/core/api/collection-loader',
    'io.ox/core/folder/api',
    'io.ox/calendar/util',
    'io.ox/calendar/model',
    'io.ox/core/capabilities'
], function (http, Pool, CollectionLoader, folderApi, util, models, capabilities) {

    'use strict';

    var isRecurrenceMaster = function (data) {
            // do not add model to pool if it is a master model of a recurring event
            if (data.rrule && !data.recurrenceId) return true;
            return false;
        },
        // updates pool based on writing operations response (create update delete etc)
        processResponse = function (response) {
            if (!response) return;

            // post request responses are arrays with data and timestamp
            response = response.data || response;

            _(response.created).each(function (event) {
                if (!isRecurrenceMaster(event)) api.pool.propagateAdd(event);
                api.trigger('create', event);
                api.trigger('create:' + util.cid(event), event);
            });

            _(response.deleted).each(function (event) {
                // cannot find event when it is recurrence master
                var events = api.pool.getModel(util.cid(event));
                if (events) events = [events];
                else events = api.pool.findRecurrenceModels(event);
                events.forEach(function (evt) {
                    evt.collection.remove(evt);
                    api.trigger('delete', evt.attributes);
                    api.trigger('delete:' + util.cid(evt), evt.attributes);
                });
            });

            _(response.updated).each(function (event) {
                if (isRecurrenceMaster(event)) {
                    var events = api.pool.findRecurrenceModels(event),
                        updates = _(event).pick('attendees', 'alarms', 'flags', 'timestamp');
                    events.forEach(function (evt) {
                        evt.set(updates);
                        api.trigger('update', evt.attributes);
                        api.trigger('update:' + util.cid(evt), evt.attributes);
                    });
                    // make sure that appointents inside deleteExceptionDates do not exist
                    var exceptions = [].concat(event.deleteExceptionDates).concat(event.changeExceptionDates);
                    exceptions = _(exceptions).compact();
                    exceptions.forEach(function (recurrenceId) {
                        var model = api.pool.getModel(util.cid({ id: event.id, folder: event.folder, recurrenceId: recurrenceId }));
                        if (model) {
                            model.collection.remove(model);
                            api.trigger('delete', model.attributes);
                            api.trigger('delete:' + util.cid(model), model.attributes);
                        }
                    });

                } else {
                    // first we must remove the unused attributes (don't use clear method as that kills the id and we cannot override the model again with add)
                    // otherwise attributes that no longer exists are still present after merging (happens if an event has no attachments anymore for example)
                    var model = api.pool.getModel(util.cid(event)),
                        removeAttributes;

                    if (model) {
                        removeAttributes = _.difference(_(model.attributes).keys(), _(event).keys(), ['index', 'cid']);
                        removeAttributes.forEach(function (attr) {
                            event[attr] = undefined;
                        });
                    }

                    api.pool.propagateUpdate(event);
                }
                api.trigger('update', event);
                api.trigger('update:' + util.cid(event), event);
            });


            var errors = (response.failed || []).concat(response.error);
            _(errors).each(function (error) {
                require(['io.ox/core/notifications'], function (notifications) {
                    notifications.yell(error);
                });
            });

            return response;
        },

        defaultFields = ['color', 'createdBy', 'endDate', 'flags', 'folder', 'id', 'location', 'recurrenceId', 'seriesId', 'startDate', 'summary', 'timestamp', 'transp'].join(','),

        extendedFields = [defaultFields, 'deleteExceptionDates', 'changeExceptionDates'].join(','),

        api = {
            // used externally by itip updates in mail invites
            updatePoolData: processResponse,

            // convenience function
            cid: util.cid,

            defaultFields: defaultFields,

            extendedFields: extendedFields,

            request: (function () {
                function getParams(opt, start, end) {
                    opt = _.clone(opt);
                    opt.params = _.extend({}, opt.params, {
                        rangeStart: start.format(util.ZULU_FORMAT),
                        rangeEnd: end.format(util.ZULU_FORMAT)
                    });
                    return opt;
                }
                return function request(opt, method) {
                    method = method || 'GET';
                    return http[method](opt).then(function (result) {
                        if (_.isArray(result)) {
                            result.forEach(function (r) {
                                if (r.error) {
                                    ox.trigger('http:error:' + r.code, r);
                                }
                            });
                        }
                        return result;
                    }, function (err) {
                        if (err.code !== 'CAL-5072') throw err;

                        var start = moment(opt.params.rangeStart),
                            end = moment(opt.params.rangeEnd),
                            middle = moment(start).add(end.diff(start, 'ms') / 2, 'ms');

                        return request(getParams(opt, start, middle), method).then(function (data1) {
                            return request(getParams(opt, middle, end), method).then(function (data2) {
                                return _(data1)
                                    .chain()
                                    .union(data2)
                                    .uniq(function (event) { return util.cid(event); })
                                    .compact()
                                    .value();
                            });
                        });
                    });
                };
            }()),

            get: function (obj, useCache) {

                obj = obj instanceof Backbone.Model ? obj.attributes : obj;

                if (useCache !== false) {
                    var model = api.pool.getModel(util.cid(obj));
                    if (model && (model.has('attendees') || model.has('calendarUser'))) return $.when(model);
                }
                // if an alarm object was used to get the associated event we need to use the eventId not the alarm Id
                if (obj.eventId) {
                    obj.id = obj.eventId;
                }

                return http.GET({
                    module: 'chronos',
                    params: {
                        action: 'get',
                        id: obj.id,
                        recurrenceId: obj.recurrenceId,
                        folder: obj.folder,
                        extendedEntities: true
                    }
                }).then(function (data) {
                    if (isRecurrenceMaster(data)) return api.pool.get('detail').add(data);
                    api.pool.propagateAdd(data);
                    return api.pool.getModel(data);
                });
            },

            resolve: function (id, useCache) {
                if (useCache !== false) {
                    var collections = api.pool.getCollections(), model;
                    _(collections).find(function (data) {
                        var collection = data.collection;
                        model = collection.find(function (m) {
                            return m.get('id') === id && !m.has('recurrenceId');
                        });
                        return !!model;
                    });
                    if (model) return $.when(model);
                }
                return http.GET({
                    module: 'chronos',
                    params: {
                        action: 'resolve',
                        id: id,
                        fields: api.defaultFields
                    }
                }).then(function (data) {
                    if (isRecurrenceMaster(data)) return api.pool.get('detail').add(data);
                    api.pool.propagateAdd(data);
                    return api.pool.getModel(data);
                });
            },

            getList: (function () {
                function requestList(list) {
                    return http.PUT({
                        module: 'chronos',
                        params: {
                            action: 'list',
                            extendedEntities: true
                        },
                        data: list
                    })['catch'](function (err) {
                        if (err.code !== 'CAL-5072') throw err;
                        // split list in half if error code suggested a too large list
                        var list1 = _(list).first(Math.ceil(list.length / 2)),
                            list2 = _(list).last(Math.floor(list.length / 2));
                        return requestList(list1).then(function (data1) {
                            return requestList(list2).then(function (data2) {
                                return [].concat(data1).concat(data2);
                            });
                        });
                    });
                }
                return function (list, useCache) {

                    list = _(list).map(function (obj) {
                        // if an alarm object was used to get the associated event we need to use the eventId not the alarm Id
                        if (obj.eventId) {
                            return { id: obj.eventId, folder: obj.folder, recurrenceId: obj.recurrenceId };
                        }
                        return obj;
                    });

                    var def, reqList = list;
                    if (useCache !== false) {
                        reqList = list.filter(function (obj) {
                            return !api.pool.getModel(util.cid(obj));
                        });
                    }

                    if (reqList.length > 0) def = requestList(reqList);
                    else def = $.when();

                    return def.then(function (data) {
                        if (data) {
                            data.forEach(function (obj) {
                                if (isRecurrenceMaster(obj)) return;
                                api.pool.propagateAdd(obj);
                            });
                        }

                        return list.map(function (obj, index) {
                            // if we have full data use the full data, in list data recurrence ids might be missing
                            // you can request exceptions without recurrence id because they have own ids, but in the reponse they still have a recurrence id, which is needed for the correct cid
                            if (data && data[index]) {
                                obj = data[index];
                            }

                            if (isRecurrenceMaster(obj)) return api.pool.get('detail').add(data);
                            var cid = util.cid(obj);
                            return api.pool.getModel(cid);
                        });
                    });
                };
            }()),

            create: function (obj, options) {
                options = options || {};

                obj = obj instanceof Backbone.Model ? obj.attributes : obj;

                var params = {
                        action: 'new',
                        folder: obj.folder,
                        // convert to true boolean
                        checkConflicts: !!options.checkConflicts,
                        sendInternalNotifications: !!options.sendInternalNotifications,
                        fields: api.extendedFields
                    },
                    def;

                if (options.expand && obj.rrule) {
                    params.expand = true;
                    params.rangeStart = options.rangeStart;
                    params.rangeEnd = options.rangeEnd;
                }
                if (options.attachments && options.attachments.length) {
                    var formData = new FormData();

                    formData.append('json_0', JSON.stringify(obj));
                    for (var i = 0; i < options.attachments.length; i++) {
                        // the attachment data is given via the options parameter
                        formData.append('file_' + options.attachments[i].cid, options.attachments[i].file);
                    }
                    def = http.UPLOAD({
                        module: 'chronos',
                        params: params,
                        data: formData,
                        fixPost: true
                    });
                } else {
                    def = http.PUT({
                        module: 'chronos',
                        params: params,
                        data: obj
                    });
                }
                return def.then(processResponse)
                .then(function (data) {
                    // post request responses are arrays with data and timestamp
                    data = data.data || data;
                    api.getAlarms();
                    // return conflicts or new model
                    if (data.conflicts) {
                        return data;
                    }

                    if (data.created.length > 0 && isRecurrenceMaster(data.created[0])) return api.pool.get('detail').add(data);
                    if (data.created.length > 0) return api.pool.getModel(data.created[0]);
                });
            },

            update: function (obj, options) {
                options = options || {};

                obj = obj instanceof Backbone.Model ? obj.attributes : obj;

                var def,
                    params = {
                        action: 'update',
                        folder: obj.folder,
                        id: obj.id,
                        timestamp: obj.timestamp,
                        // convert to true boolean
                        checkConflicts: !!options.checkConflicts,
                        sendInternalNotifications: !!options.sendInternalNotifications,
                        recurrenceRange: options.recurrenceRange,
                        fields: api.extendedFields
                    };

                if (obj.recurrenceId) params.recurrenceId = obj.recurrenceId;

                if (options.expand) {
                    params.expand = true;
                    params.rangeStart = options.rangeStart;
                    params.rangeEnd = options.rangeEnd;
                }

                if (options.attachments && options.attachments.length) {
                    var formData = new FormData();

                    formData.append('json_0', JSON.stringify(obj));
                    for (var i = 0; i < options.attachments.length; i++) {
                        // the attachment data is given via the options parameter
                        formData.append('file_' + options.attachments[i].cid, options.attachments[i].file);
                    }
                    def = http.UPLOAD({
                        module: 'chronos',
                        params: params,
                        data: formData,
                        fixPost: true
                    });
                } else {
                    def = http.PUT({
                        module: 'chronos',
                        params: params,
                        data: obj
                    });
                }
                return def.then(processResponse)
                    .then(function (data) {
                        // post request responses are arrays with data and timestamp
                        data = data.data || data;

                        api.getAlarms();
                        // return conflicts or new model
                        if (data.conflicts) {
                            return data;
                        }

                        var updated = data.updated ? data.updated[0] : undefined;
                        if (!updated) return api.pool.getModel(util.cid(obj));
                        if (isRecurrenceMaster(updated)) return api.pool.get('detail').add(data);
                        return api.pool.getModel(updated);
                    });
            },

            remove: function (list, options) {
                api.trigger('beforedelete', list);
                list = _.isArray(list) ? list : [list];

                var params = {
                    action: 'delete',
                    timestamp: _.now(),
                    fields: api.extendedFields
                };

                if (options.expand) {
                    params.expand = true;
                    params.rangeStart = options.rangeStart;
                    params.rangeEnd = options.rangeEnd;
                }

                return http.PUT({
                    module: 'chronos',
                    params: params,
                    data: _(list).map(function (obj) {
                        obj = obj instanceof Backbone.Model ? obj.attributes : obj;
                        var params = {
                            id: obj.id,
                            folder: obj.folder
                        };
                        if (obj.recurrenceId) params.recurrenceId = obj.recurrenceId;
                        if (obj.recurrenceRange) params.recurrenceRange = obj.recurrenceRange;
                        return params;
                    })
                })
                .then(function (data) {
                    data.forEach(processResponse);
                    return data;
                })
                .then(function (data) {
                    api.getAlarms();
                    return data;
                });
            },

            confirm: function (obj, options) {
                options = options || {};
                // no empty string comments (clutters database)
                // if comment schould be deleted, send null. Just like in settings
                if (obj.attendee.comment === '') delete obj.attendee.comment;

                var params = {
                        action: 'updateAttendee',
                        id: obj.id,
                        folder: obj.folder,
                        checkConflicts: options.checkConflicts,
                        timestamp: _.now()
                    },
                    data = {
                        attendee: obj.attendee
                    };

                if (obj.recurrenceId) {
                    params.recurrenceId = obj.recurrenceId;
                }
                if (obj.alarms) {
                    data.alarms = obj.alarms;
                }
                if (options.expand) {
                    params.expand = true;
                    params.rangeStart = options.rangeStart;
                    params.rangeEnd = options.rangeEnd;
                }

                return http.PUT({
                    module: 'chronos',
                    params: params,
                    data: data
                })
                .then(processResponse)
                .then(function (response) {
                    if (!response.conflicts && response.updated && response.updated.length > 0) {
                        // updates notification area for example
                        // don't use api.pool.getModel as this returns undefined if the recurrence master was updated
                        api.trigger('mark:invite:confirmed', response.updated[0]);
                    }
                    return response;
                });
            },

            // returns freebusy data
            freebusy: function (list, options) {
                if (list.length === 0) {
                    return $.Deferred().resolve([]);
                }

                options = _.extend({
                    from: moment().startOf('day').utc().format(util.ZULU_FORMAT_DAY_ONLY),
                    until: moment().startOf('day').utc().add(1, 'day').format(util.ZULU_FORMAT_DAY_ONLY)
                }, options);

                var order = _(list).pluck('entity');

                return http.PUT({
                    module: 'chronos',
                    params: {
                        action: 'freeBusy',
                        from: options.from,
                        until: options.until
                    },
                    data: { attendees: list }
                }).then(function (items) {
                    // response order might not be the same as in the request. Fix that.
                    items.sort(function (a, b) {
                        return order.indexOf(a.attendee.entity) - order.indexOf(b.attendee.entity);
                    });
                    return items;
                });
            },

            reduce: function (obj) {
                obj = obj instanceof Backbone.Model ? obj : _(obj);
                return obj.pick('id', 'folder', 'recurrenceId');
            },

            move: function (list, targetFolderId) {
                list = [].concat(list);
                var models = _(list).map(function (obj) {
                    var cid = util.cid(obj),
                        collection = api.pool.getCollectionsByModel(obj)[0],
                        model = collection.get(cid);
                    collection.remove(model);
                    return model;
                });

                http.pause();
                _(models).map(function (model) {
                    return http.PUT({
                        module: 'chronos',
                        params: {
                            action: 'move',
                            id: model.get('id'),
                            folder: model.get('folder'),
                            targetFolder: targetFolderId,
                            recurrenceId: model.get('recurrenceId'),
                            timestamp: model.get('lastModified')
                        }
                    });
                });
                return http.resume().then(function (data) {
                    var def = $.Deferred(),
                        error = _(data).find(function (res) {
                            return !!res.error;
                        });
                    if (error) {
                        def.reject(error.error);
                        // reset models
                        _(models).each(function (model) {
                            api.pool.propagateAdd(model.toJSON());
                        });
                    } else {
                        def.resolve(data);
                    }
                    return def;
                }).then(processResponse).done(function (list) {
                    _(list).each(function (obj) {
                        api.trigger('move:' + util.cid(obj), targetFolderId);
                    });
                    api.trigger('refresh.all');
                });
            },

            getInvites: function () {
                return api.request({
                    module: 'chronos',
                    params: {
                        action: 'needsAction',
                        folder: folderApi.getDefaultFolder('calendar'),
                        rangeStart: moment().subtract(2, 'hours').utc().format(util.ZULU_FORMAT),
                        rangeEnd: moment().add(1, 'years').utc().format(util.ZULU_FORMAT)
                    }
                }, 'GET').then(function (data) {
                    // even if empty array is given it needs to be triggered to remove
                    // notifications that does not exist anymore (already handled in ox6 etc)
                    // no filtering needed because of new needsAction request
                    api.trigger('new-invites', data);
                    return data;
                });
            },

            getAlarms: function () {
                return http.GET({
                    module: 'chronos/alarm',
                    params: {
                        action: 'pending',
                        rangeEnd: moment.utc().add(10, 'hours').format(util.ZULU_FORMAT),
                        actions: 'DISPLAY,AUDIO'
                    }
                })
                .then(function (data) {
                    // add alarmId as id (makes it easier to use in backbone collections)
                    data = _(data).map(function (obj) {
                        obj.id = obj.alarmId;
                        return obj;
                    });

                    api.trigger('resetChronosAlarms', data);
                });
            },

            acknowledgeAlarm: function (obj) {
                if (!obj) return $.Deferred().reject();
                if (_(obj).isArray()) {
                    http.pause();
                    _(obj).each(function (alarm) {
                        api.acknowledgeAlarm(alarm);
                    });
                    return http.resume();
                }
                return http.PUT({
                    module: 'chronos/alarm',
                    params: {
                        action: 'ack',
                        folder: obj.folder,
                        id: obj.eventId,
                        alarmId: obj.alarmId
                    }
                })
                .then(processResponse);
            },

            remindMeAgain: function (obj) {
                if (!obj) return $.Deferred().reject();

                return http.PUT({
                    module: 'chronos/alarm',
                    params: {
                        action: 'snooze',
                        folder: obj.folder,
                        id: obj.eventId,
                        alarmId: obj.alarmId,
                        snoozeTime: obj.time || 300000
                    }
                })
                .then(processResponse);
            },

            refresh: function () {
                // check capabilities
                if (capabilities.has('calendar')) {
                    api.getInvites();
                    api.getAlarms();
                    api.trigger('refresh.all');
                }
            },

            removeRecurrenceInformation: function (model) {
                var data = model instanceof Backbone.Model ? model.toJSON() : _(model).clone();
                delete data.rrule;
                delete data.recurrenceId;
                delete data.seriesId;
                if (model instanceof Backbone.Model) return new models.Model(data);
                return data;
            },

            getCollection: function (obj) {
                // TODO expand start/end to start/end of week if range is less than a week
                var cid = _(obj).map(function (val, key) {
                        val = _.isString(val) ? val : JSON.stringify(val);
                        return key + '=' + val;
                    }).join('&'),
                    collection = api.pool.get(cid);
                collection.setOptions(obj);
                return collection;
            }
        };

    ox.on('refresh^', function () {
        api.refresh();
    });

    api.pool = Pool.create('chronos', {
        Collection: models.Collection
    });

    function urlToHash(url) {
        var hash = {},
            s = url.split('&');
        s.forEach(function (str) {
            var t = str.split('=');
            hash[t[0]] = t[1];
        });
        return hash;
    }

    api.pool.get = _.wrap(api.pool.get, function (get, cid) {
        var hasCollection = !!this.getCollections()[cid],
            hash = urlToHash(cid);
        if (hasCollection || cid === 'detail' || !hash.folders || hash.folders.length === 0) return get.call(this, cid);
        // find models which should be in this collection
        var list = this.grep('start=' + hash.start, 'end=' + hash.end),
            collection = get.call(this, cid),
            models = _(list)
                .chain()
                .pluck('models')
                .flatten()
                .uniq(function (model) {
                    return model.cid;
                })
                .filter(function (model) {
                    return hash.folders.indexOf(model.get('folder')) >= 0;
                })
                .invoke('toJSON')
                .value();

        collection.add(models, { silent: true });
        if (collection.length > 0) collection.expired = true;

        return collection;
    });

    _.extend(api.pool, {

        map: function (data) {
            data.cid = util.cid(data);
            return data;
        },

        getByFolder: function (folder) {
            var regex = new RegExp('(folders=[^&]*' + folder + '|folder=' + folder + '&)');
            return _(this.getCollections())
                .chain()
                .filter(function (entry, id) {
                    return regex.test(id);
                })
                .pluck('collection')
                .value();
        },

        getCollectionsByCID: function (cid) {
            var folder = util.cid(cid).folder,
                collections = this.getByFolder(folder).filter(function (collection) {
                    return !!collection.get(cid);
                });
            if (collections.length === 0) return [this.get('detail')];
            return collections;
        },

        getCollectionsByModel: function (data) {
            var model = data instanceof Backbone.Model ? data : new models.Model(data),
                collections = this.getByFolder(model.get('folder')).filter(function (collection) {
                    var params = urlToHash(collection.cid),
                        start = params.start,
                        end = params.end;
                    if (params.view === 'list') {
                        start = moment().startOf('day').valueOf();
                        end = moment().startOf('day').add((collection.offset || 0) + 1, 'month').valueOf();
                    }
                    if (model.getTimestamp('endDate') <= start) return false;
                    if (model.getTimestamp('startDate') >= end) return false;
                    return true;
                });
            if (collections.length === 0) return [this.get('detail')];
            return collections;
        },

        propagateAdd: function (data) {
            data.cid = util.cid(data);
            var collections = api.pool.getCollectionsByModel(data);
            collections.forEach(function (collection) {
                api.pool.add(collection.cid, data);
            });
        },

        propagateUpdate: function (data) {
            var cid = _.cid(data),
                model = this.getModel(cid);
            if (!model || (_.isEqual(data.startDate, model.get('startDate'))
                && _.isEqual(data.endDate, model.get('endDate')))) return this.propagateAdd(data);
            var oldCollections = this.getCollectionsByModel(model),
                newCollections = this.getCollectionsByModel(data);
            // collections which formerly contained that model but won't contain it in the future
            _.difference(oldCollections, newCollections).forEach(function (collection) {
                collection.remove(cid);
            });
            newCollections.forEach(function (collection) {
                api.pool.add(collection.cid, data);
            });
        },

        getModel: function (data) {
            var cid = data;
            if (!_.isString(data)) cid = util.cid(data);
            var collections = api.pool.getCollectionsByCID(cid);
            if (collections.length === 0) return;
            var model = collections[0].get(cid);
            if (!model && _.isObject(data)) model = collections[0].add(data);
            return model;
        },

        findRecurrenceModels: function (event) {
            event = event instanceof Backbone.Model ? event.attributes : event;
            var collections = api.pool.getByFolder(event.folder),
                exceptions = _([].concat(event.changeExceptionDates).concat(event.deleteExceptionDates)).compact(),
                filterRecurrences = function (model) {
                    if (model.get('seriesId') !== event.id) return false;
                    if (exceptions.indexOf(model.get('recurrenceId')) >= 0) return false;
                    return true;
                },
                models = collections.map(function (collection) {
                    return collection.filter(filterRecurrences);
                });
            return _(models)
                .chain()
                .flatten()
                .uniq(function (model) {
                    return model.cid;
                })
                .value();
        }

    });

    api.collectionLoader = {
        PRIMARY_SEARCH_PAGE_SIZE: 100,
        SECONDARY_SEARCH_PAGE_SIZE: 200,
        getDefaultCollection: function () {
            return new models.Collection();
        },
        load: function (params) {
            params = params || {};
            var collection = this.collection = api.getCollection(params);
            collection.originalStart = collection.originalStart || moment().startOf('day');
            collection.range = collection.range || 1;
            collection.setOptions({
                start: collection.originalStart.valueOf() + 1,
                end: collection.originalStart.clone().add(collection.range, 'months').valueOf(),
                folders: params.folders || []
            });
            collection.sync({ sync: params.sync }).then(function (data) {
                // trigger reset when data comes from cache
                if (!data || data.length === 0) collection.trigger('reset');
            });
            return collection;
        },
        reload: function (params) {
            var collection = this.collection = api.getCollection(params);
            collection.expired = true;
            collection.setOptions({
                start: collection.originalStart.valueOf() + 1,
                end: collection.originalStart.clone().add(collection.range, 'months').valueOf(),
                folders: params.folders || []
            });
            collection.sync();
            return collection;
        },
        paginate: function () {
            var collection = this.collection;
            if (!collection) return;
            collection.range++;
            collection.expired = true;
            collection.setOptions({
                start: collection.originalStart.clone().add(collection.range - 1, 'months').valueOf() + 1,
                end: collection.originalStart.clone().add(collection.range, 'months').valueOf(),
                folders: collection.folders || []
            });
            collection.sync({ paginate: true });
            return collection;
        }
    };

    _.extend(api, Backbone.Events);

    return api;
});
