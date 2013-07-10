/**
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
 */

define('io.ox/mail/api',
    ['io.ox/core/http',
     'io.ox/core/cache',
     'io.ox/core/config',
     'io.ox/core/api/factory',
     'io.ox/core/api/folder',
     'io.ox/core/api/account',
     'io.ox/core/notifications',
     'io.ox/mail/util',
     'settings!io.ox/mail',
     'gettext!io.ox/mail'], function (http, cache, config, apiFactory, folderAPI, accountAPI, notifications, util, settings, gt) {

    // SHOULD NOT USE notifications inside API!

    'use strict';

    var DONE = $.when(),
        DELAY = 1000 * 60, // 60 seconds (kind of protection against unwanted selection; e.g. Bug #26575)
        DELIM = '//';

    var tracker = (function () {

        // simple temporary thread cache
        var threads = {},

            // stores CIDs to find items in threads
            // key is item CID, value is top-level item CID
            threadHash = {},

            // track mails that are manually marked as unseen
            explicitUnseen = {},
            unseen = {},
            colorLabel = {};

        var extend = function (a, b) {
            return _.extend(a, { flags: b.flags, color_label: b.color_label });
        };

        var calculateUnread = function (memo, obj) {
            return memo + ((obj.flags & 32) !== 32 ? 1 : 0);
        };

        var getCID = function (param) {
            return _.isString(param) ? param : _.cid(param);
        };

        var self = {

            addThread: function (obj) {
                var cid = getCID(obj);
                threads[cid] = obj.thread;
                _(obj.thread).each(function (o) {
                    threadHash[_.cid(o)] = cid;
                });
            },

            hasThread: function (obj) {
                var cid = getCID(obj);
                return cid in threads;
            },

            getThread: function (obj, copy) {
                var cid = getCID(obj),
                    thread = threads[cid] || [];
                return copy ? _.deepCopy(thread) : thread;
            },

            getThreadCID: function (obj) {
                var cid = getCID(obj);
                return threadHash[cid];
            },

            getThreadSize: function (obj) {
                var cid = getCID(obj);
                return cid in threads ? threads[cid].length : 0;
            },

            getUnreadCount: function (obj) {
                var cid = getCID(obj), root = threads[cid];
                return root === undefined ? 0 : _(root.thread).inject(calculateUnread, 0);
            },

            update: function (list, callback) {

                var hash = {};

                // hash affected cids
                // return top thread obj (threadview) or mail obj (singleview)
                list = _(list).chain()
                    .map(function (obj) {
                        var cid = _.cid(obj), top = threadHash[cid];
                        hash[cid] = true;
                        return top in threads ? _(threads[top]).first() : obj;
                    })
                    .compact().value();

                function process(obj) {
                    var cid = _.cid(obj);
                    if (cid in hash) {
                        callback(obj);
                    }
                }

                return api.updateAllCache(list, function (obj) {
                    // handles threadView: on || off
                    if (obj.thread)
                        _(obj.thread).each(process);
                    else
                        process(obj);
                });
            },

            reset: (function () {

                function reset(obj) {
                    var cid = _.cid(obj);
                    unseen[cid] = (obj.flags & 32) !== 32;
                    colorLabel[cid] = parseInt(obj.color_label, 10) || 0;
                }

                return function (list) {
                    _(list).each(function (obj) {
                        reset(obj);
                        _(obj.thread).each(reset);
                    });
                };

            }()),

            setUnseen: function (obj) {
                var cid = getCID(obj);
                explicitUnseen[cid] = _.now();
                unseen[cid] = true;
            },

            setSeen: function (obj) {
                var cid = getCID(obj);
                delete explicitUnseen[cid];
                unseen[cid] = false;
            },

            /**
             * @param {object|string} obj (id, folder_id) or string (cid)
             * @returns {void}
             */
            remove: function (obj) {
                var cid = getCID(obj),
                    root = this.getThreadCID(cid),
                    thread;
                if (root) {
                    threads[root] = _(threads[root]).filter(function (item) {
                        return cid !== getCID(item);
                    });
                }
            },

            // use this to check if mails in a thread are unseen
            isPartiallyUnseen: function (obj) {
                var cid = getCID(obj), top = threads[threadHash[cid]];
                if (top) {
                    return _(top).reduce(function (memo, obj) {
                        return memo || unseen[_.cid(obj)] === true;
                    }, false);
                } else {
                    return false;
                }
            },

            isUnseen: function (obj) {
                var cid = getCID(obj);
                return !!unseen[cid];
            },

            getColorLabel: function (obj) {
                var cid = getCID(obj);
                return (cid in colorLabel ? colorLabel[cid] : obj.color_label) || 0; // fallback to 0 to avoid undefined
            },

            setColorLabel: function (obj) {
                var cid = getCID(obj);
                colorLabel[cid] = parseInt(obj.color_label, 10) || 0;
            },

            applyAutoRead: function (obj) {

                // looks like attachment?
                if (obj && obj.msgref) return;

                var cid = getCID(obj);
                if (unseen[cid] === true) {
                    unseen[cid] = false;
                    delete explicitUnseen[cid];
                    api.markRead(obj);
                }
            },

            canAutoRead: function (obj) {
                var cid = getCID(obj);
                if (!(cid in unseen)) { //unseen list is not initialized if mailapp was not opened before
                                        //this makes sure mails get removed correctly in notification area if this happens
                    unseen[cid] = true;
                    return true;
                } else {
                    return this.isUnseen(cid) && (!(cid in explicitUnseen) || explicitUnseen[cid] < (_.now() - DELAY));
                }
            },

            clear: function () {
                threads = {};
                threadHash = {};
            }
        };

        return self;

    }());

    // generate basic API
    var api = apiFactory({
        module: 'mail',
        keyGenerator: function (obj) {
            return obj ? (obj.folder_id || obj.folder) + '.' + obj.id + '.' + (obj.view || api.options.requests.get.view || '') : '';
        },
        requests: {
            all: {
                folder: 'default0/INBOX',
                columns: '601,600,611,102', // + flags & color_label
                extendColumns: 'io.ox/mail/api/all',
                sort: '610', // received_date
                order: 'desc',
                deleted: 'true',
                cache: false // allow DB cache
            },
            list: {
                action: 'list',
                columns: '102,600,601,602,603,604,605,607,610,611,614,652',
                extendColumns: 'io.ox/mail/api/list'
            },
            get: {
                action: 'get',
                view: settings.get('allowHtmlMessages', true) ? (settings.get('allowHtmlImages', false) ? 'html' : 'noimg') : 'text',
                embedded: 'true'
            },
            getUnmodified: {
                action: 'get',
                unseen: 'true',
                view: 'html',
                embedded: 'true'
            },
            search: {
                action: 'search',
                folder: 'default0/INBOX',
                columns: '601,600,611',
                extendColumns: 'io.ox/mail/api/all',
                sort: '610',
                order: 'desc',
                getData: function (query, options) {
                    var map = { from: 603, to: 604, cc: 605, subject: 607, text: -1 }, composite = [];
                    _(options).each(function (value, key) {
                        if (key in map && value === 'on') {
                            composite.push({ col: map[key], pattern: query });
                        }
                    });
                    return composite;
                }
            }
        },
        // composite key for 'all' cache
        cid: function (o) {
            return (o.action || 'all') + ':' + o.folder + DELIM + [o.sort, o.order, o.max || 0, !!o.unseen, !!o.deleted].join('.');
        },

        fail: {
            get: function (e, ids) {
                if (e.code === 'MSG-0032') {
                    // mail no longer exists, so we remove it from caches
                    // we don't trigger any event here, as it might run into cyclic event chains
                    api.updateCaches([ids]);
                }
            }
        },
        // filter list request (special fix for nested messages; don't have folder; inline action checks fail)
        filter: function (obj) {
            return obj.folder_id !== undefined;
        },
        pipe: {
            all: function (response, opt) {
                // reset tracker! if we get a seen mail here, although we have it in 'explicit unseen' hash,
                // another devices might have set it back to seen.
                tracker.reset(response.data || response); // threadedAll || all
                return response;
            },
            listPost: function (data) {
                _(data).each(function (obj) {
                    if (obj) {
                        if (tracker.isUnseen(obj)) {
                            obj.flags = obj.flags & ~32;
                        } else {
                            obj.flags = obj.flags | 32;
                        }
                    }
                });
                return data;
            },
            get: function (data, options) {
                // inject view (text/html/noimg). need this to generate proper cache keys.
                data.view = options.view;
                // a mail should be always marked as seen on fetch
                data.flags = data.flags | 32;
                // was unseen?
                if (data.unseen) {
                    folderAPI.decUnread(data);
                }
                return data;
            }
        },
        params: {
            all: function (options) {
                if (options.sort === 'thread') {
                    options.sort = 610;
                }
                return options;
            }
        }
    });

    /**
     * updates the view used for get requests, used on mail settings save to be responsive
     */
    api.updateViewSettings = function () {
        api.options.requests.get.view = settings.get('allowHtmlMessages', true) ? (settings.get('allowHtmlImages', false) ? 'html' : 'noimg') : 'text';
        api.trigger('viewChanged');//special event to redraw current detailview
    };

    // publish tracker
    api.tracker = tracker;

    api.separator = settings.get('defaultseparator', '/');

    api.SENDTYPE = {
        NORMAL:  '0',
        REPLY:   '1',
        FORWARD: '2',
        DRAFT:   '3',
        EDIT_DRAFT: '4'
    };

    api.FLAGS = {
        ANSWERD:     1,
        DELETED:     2,
        DRAFT:       4,
        FLAGGED:     8,
        RECENT:     16,
        SEEN:       32,
        USER:       64,
        SPAM:      128,
        FORWARDED: 256
    };

    api.COLORS = {
        NONE:        0,
        RED:         1,
        ORANGE:      7,
        YELLOW:     10,
        LIGHTGREEN:  6,
        GREEN:       3,
        LIGHTBLUE:   9,
        BLUE:        2,
        PURPLE:      5,
        PINK:        8,
        GRAY:        4
    };

    // control for each folder:
    // undefined -> first fetch
    // true -> has been fetched in this session
    // false -> caused by refresh
    var cacheControl = {},
        getAll = api.getAll,
        getList = api.getList,
        get = api.get,
        search = api.search;

    api.getAll = function (options, useCache) {
        // use cache?
        var cid = api.cid(options);
        if (useCache === 'auto') {
            useCache = (cacheControl[cid] !== false);
        }
        // support for from-to
        options = options || {};
        if (options.sort === 'from-to') {
            options.sort = accountAPI.is('sent', options.folder) ? 604 : 603;
        }
        return getAll.call(this, options, useCache).done(function () {
            cacheControl[cid] = true;
        });
    };

    /**
     * pipes getList() to remove typesuffix from sender
     * @param  {array} ids
     * @param  {boolean} useCache (default is true)
     * @param  {object} options
     * @return {deferred}
     */
    api.getList = function (ids, useCache, options) {
        //TOOD: use this until backend removes channel suffix
        return getList.call(this, ids, useCache, options).then(function (data) {
            _.each(data, util.removeChannelSuffix);
            return data;
        });
    };

    /**
     * pipes get() to remove typesuffix from sender
     * @param  {object} options
     * @param  {boolan} useCache (default is true)
     * @fires api#refresh.list
     * @return {deferred} (resolve returns response)
     */
    api.get = function (options, useCache) {
        //TOOD: use this until backend removes channel suffix
        return get.call(this, options, useCache).then(function (mail) {
            if (_.isObject(mail)) {
                util.removeChannelSuffix(mail);
            }
            return mail;
        });
    };

    api.search = function (query, options) {
        if (options.sort === 'from-to') {
            options.sort = accountAPI.is('sent', options.folder) ? 604 : 603;
        }
        return search.call(this, query, options);
    };

    /**
     * requests data for all ids
     * @param  {object} options
     * @param  {boolean} useCache (default is true)
     * @return {deferred} returns array of threads
     */
    api.getAllThreads = function (options, useCache) {
        // request for brand new thread support
        options = options || {};
        options = $.extend(options, {
            action: 'threadedAll',
            columns: '601,600,611,102', // +flags +color_label
            sort: options.sort || '610',
            sortKey: 'threaded-' + (options.sort || '610'),
            konfetti: true,
            order: options.order || 'desc',
            includeSent: !accountAPI.is('sent', options.folder),
            cache: false, // never use server cache
            max: options.max || 500 // apply internal limit to build threads fast enough
        });
        // use cache?
        var cid = api.cid(options);
        if (useCache === 'auto') {
            useCache = (cacheControl[cid] !== false);
        }
        return getAll.call(this, options, useCache, null, false)
            .done(function (response) {
                _(response.data).each(tracker.addThread);
                cacheControl[cid] = true;
            });
    };

    /**
     * get mails in thread
     * @param  {object} obj (mail object)
     * @return {array} of mail objects
     */
    api.getThread = function (obj) {
        var cid, thread, len;

        if (typeof obj === 'string') {
            cid = obj;
            obj = _.cid(obj);
        } else {
            cid = _.cid(obj);
            obj = api.reduce(obj);
        }

        if ((thread = tracker.getThread(cid)).length) {
            len = thread.length;
            return _(thread).map(function (obj, i) {
                return {
                    folder_id: obj.folder_id,
                    id: obj.id,
                    threadKey: cid,
                    threadPosition: len - i,
                    threadSize: len
                };
            });
        } else {
            return [{
                folder_id: obj.folder_id || obj.folder,
                id: obj.id,
                threadKey: cid,
                threadPosition: 1,
                threadSize: 1
            }];
        }
    };

    /**
     * get threads
     * @param  {array} ids (mail objects)
     * @return {deferred} returns array of thread objects
     */
    api.getThreads = function (ids) {
        return this.getList(ids).pipe(function (data) {
            // clone not to mess up with searches
            data = _.deepClone(data);
            // inject thread size
            var i = 0, obj;
            for (; (obj = data[i]); i++) {
                obj.threadSize = tracker.getThreadSize(obj);
                obj.unreadCount = tracker.getUnreadCount(obj);
            }
            return data;
        });
    };

    var update = function (list, data, apiAction) {

        // allow single object and arrays
        list = _.isArray(list) ? list : [list];

        // pause http layer
        http.pause();

        // now talk to server
        _(list).map(function (obj) {
            return http.PUT({
                module: 'mail',
                params: {
                    action: apiAction || 'update',
                    id: obj.id,
                    folder: obj.folder || obj.folder_id,
                    timestamp: _.now() // to be safe
                },
                data: data,
                appendColumns: false
            });
        });
        // resume & trigger refresh
        return http.resume().pipe(function () {
            // trigger update events
            _(list).each(function (obj) {
                api.trigger('update:' + encodeURIComponent(_.cid(obj)), obj);
            });
            // return list
            return list;
        });
    };

    var resetTrashFolders = function () {
        return $.when.apply($,
            _(accountAPI.getFoldersByType('trash')).map(function (folder) {
                return api.caches.all.grepRemove(folder + DELIM);
            })
        );
    };

    var clearCaches = function (obj, targetFolderId) {
        return function () {
            var id = obj.folder_id || obj.folder;
            return $.when(
                api.caches.get.remove(obj),
                api.caches.get.remove(id),
                api.caches.list.remove(obj),
                api.caches.list.remove(id),
                api.caches.all.grepRemove(targetFolderId + DELIM) // clear target folder
            );
        };
    };

    var refreshAll = function (obj) {
        $.when.apply($, obj).done(function () {
            api.trigger('refresh.all');
        });
    };

    api.update = function () {
        console.error('Do not call this directly because mail is so special');
    };

    /**
     * update item in all caches via callback in element
     * @param {array} list
     * @param {function} callback
     * @return {deferred}
     */
    api.updateAllCache = (function () {

        function update(folder_id, hash, callback) {
            // get proper keys (differ due to sort/order suffix)
            return api.caches.all.grepKeys(folder_id + DELIM).pipe(function (keys) {
                return $.when.apply($, _(keys).map(function (folder_id) {
                    return api.caches.all.get(folder_id).pipe(function (co) {
                        // handles threadView: on || off
                        if (co) {
                            co.data = co.data || co;
                            // update affected items
                            return $.when.apply($,
                                _(co.data).map(function (obj) {
                                    if (_.cid(obj) in hash) {
                                        callback(obj);
                                        // handles threadView: on || off
                                        var elem = obj.thread || obj;
                                        return $.when(
                                            api.caches.list.merge(elem),
                                            api.caches.get.merge(elem)
                                        );
                                    } else {
                                        return DONE;
                                    }
                                })
                            ).pipe(function () {
                                return api.caches.all.add(folder_id, co);
                            });
                        } else {
                            return DONE;
                        }
                    });
                }));
            });
        }

        return function (list, callback) {
            // get affected folders first
            var folders = {}, hash = {};
            _([].concat(list)).each(function (obj) {
                hash[_.cid(obj)] = true;
                folders[obj.folder_id] = true;
            });
            // run update for each folder
            return $.when.apply($, _(folders).map(function (value, folder_id) {
                return update(folder_id, hash, callback || _.identity);
            }));
        };
    }());

    api.on('not-found', function (e, obj) {
        tracker.ignore(obj);
        api.trigger('refresh.list');
    });


    /**
     * cleaning up
     * @param  {string]} folder_id
     * @fires  api#refresh.all
     * @return {deferred}
     */
    api.expunge = function (folder_id) {
        notifications.yell('info', gt('Cleaning up... This may take a few seconds.'));
        // new clear
        return http.PUT({
            module: 'mail',
            appendColumns: false,
            params: {
                action: 'expunge'
            },
            data: [folder_id]
        })
        .then(function (data) {
            return api.caches.all.grepRemove(folder_id + DELIM).pipe(function () {
                api.trigger('refresh.all');
                folderAPI.reload(folder_id);
                return data;
            });
        })
        .done(function () {
            notifications.yell('success', gt('The folder has been cleaned up.'));
            folderAPI.reload(folder_id);
        });
    };

    /**
     * deletes all mails from a specific folder
     * @param  {string} folder_id
     * @fires  api#refresh.all
     * @return {deferred}
     */
    api.clear = function (folder_id) {
        notifications.yell('info', gt('Emptying folder... This may take a few seconds.'));
        // new clear
        return http.PUT({
            module: 'folders',
            appendColumns: false,
            params: {
                action: 'clear',
                tree: '1'
            },
            data: [folder_id]
        })
        .then(function (data) {
            return api.caches.all.grepRemove(folder_id + DELIM).pipe(function () {
                api.trigger('refresh.all');
                folderAPI.reload(folder_id);
                return data;
            });
        })
        .then(function () {
            return resetTrashFolders();
        })
        .done(function () {
            notifications.yell('success', gt('The folder has been emptied.'));
            folderAPI.reload(folder_id);
        });
    };

    /**
     * sets color
     * @param  {array|object} list of mail objects
     * @param  {string} label (numeric color id mapped in api.COLORS)
     * @param  {boolean} local
     * @fires  api#refresh.list
     * @return {promise} done returns list of mails in current folder
     */
    api.changeColor = function (list, label, local) {

        list = [].concat(list);

        label = String(label); // Bugfix: #24730

        return tracker.update(list, function (obj) {
                obj.color_label = label;
                tracker.setColorLabel(obj);
            })
            .then(function () {
                return local ? DONE : update(list, { color_label: label });
            })
            .done(function () { api.trigger('refresh.list'); });
    };

    /**
     * marks list of mails unread
     * @param {array} list
     * @fires api#refresh.list
     * @return {deferred}
     */
    api.markUnread = function (list) {
        list = [].concat(list);

        _(list).each(function (obj) {
            obj.flags = obj.flags & ~32;
            api.caches.get.merge(obj);
            api.caches.list.merge(obj);
        });

        return $.when(
            tracker.update(list, function (obj) {
                tracker.setUnseen(obj);
                obj.flags = obj.flags & ~32;
            })
            .done(function () { api.trigger('refresh.list'); }),
            update(list, { flags: api.FLAGS.SEEN, value: false }).done(function () {
                folderAPI.reload(list);
            })
        );
    };

    /**
     * marks list of mails read
     * @param {array} list
     * @fires api#refresh.list
     * @fires api#update:set-seen (list)
     * @return {deferred}
     */
    api.markRead = function (list) {
        list = [].concat(list);

        function updateCache(list) {
            return tracker.update(list, function (obj) {
                tracker.setSeen(obj);
                obj.flags = obj.flags | 32;
                api.caches.get.merge(obj);
                api.caches.list.merge(obj);
            });
        }

        function reloadFolders(list) {
            _(list).chain()
            .map(function (elem) {
                return elem.folder || elem.folder_id;
            }).uniq().each(function (elem) {
                folderAPI.reload(elem);
            });
        }

        if (list[0].folder && !list[0].id) {
            // request is to mark folder as read, so update all items in the
            // folder (cache only, backend will handle the rest)
            return api.caches.list.values().done(function (res) {
                //FIXME: is there a better way to get all elements within a folder?
                var folderItems = _(res).select(function (obj) {
                        var f = list[0].folder;
                        return (obj.folder === f) || (obj.folder_id === f);
                    });

                return updateCache(folderItems).done(function () {
                    api.trigger('refresh.list');
                    update(list, { flags: api.FLAGS.SEEN, value: true }).done(function () {
                        reloadFolders(list);
                        api.trigger('update:set-seen', list);//used by notification area
                    });
                });
            });
        }

        return updateCache(list).done(function () {
            api.trigger('refresh.list');
            update(list, { flags: api.FLAGS.SEEN, value: true }).done(function () {
                reloadFolders(list);
                api.trigger('update:set-seen', list);//used by notification area
            });
        });
    };

    /**
     * marks list of mails as spam
     * @param {array} list
     * @return {deferred}
     */
    api.markSpam = function (list) {
        this.trigger('refresh.pending');
        tracker.clear();
        return update(list, { flags: api.FLAGS.SPAM, value: true })
            .then(function () {
                return api.caches.all.grepRemove(_(list).first().folder_id + DELIM);
            })
            .done(function () {
                api.trigger('refresh.all');
            });
    };

    api.noSpam = function (list) {
        this.trigger('refresh.pending');
        tracker.clear();
        return update(list, { flags: api.FLAGS.SPAM, value: false })
            .then(function () {
                return api.caches.all.grepRemove(_(list).first().folder_id + DELIM);
            })
            .done(function () {
                api.trigger('refresh.all');
            });
    };

    /**
     * move mails to another folder
     * @param  {array} list
     * @param  {string} targetFolderId
     * @fires  api#refresh.all
     * @fires  api#move (list, targetFolderId)
     * @return {deferred}
     */
    api.move = function (list, targetFolderId) {
        if (list.length >= 100) {
            notifications.yell('info', gt('Moving mails ... This may take a few seconds.'));

            return update(list, { folder_id: targetFolderId })
            .done(function () {
                notifications.yell('success', gt('Mails have been moved'));
                api.trigger('move', list, targetFolderId);
                folderAPI.reload(targetFolderId, list);
                api.caches.all.clear().done(function () {
                    api.trigger('refresh.all');
                });
            });

        } else {
         // call updateCaches (part of remove process) to be responsive
            return api.updateCaches(list).pipe(function () {
                // trigger visual refresh
                api.trigger('refresh.all');
                // start update on server
                return update(list, { folder_id: targetFolderId })
                    .pipe(function () {
                        list = _.isArray(list) ? list : [list];
                        return _(list).map(function (obj) {
                            return (clearCaches(obj, targetFolderId))();
                        });
                    })
                    .done(function () {
                        notifications.yell('success', gt('Mail has been moved'));
                        api.trigger('move', list, targetFolderId);
                        folderAPI.reload(targetFolderId, list);
                    });
            });
        }

    };

    /**
     * copies a number of mails to another folder
     * @param  {array} list
     * @param  {string} targetFolderId
     * @return {deferred}
     */
    api.copy = function (list, targetFolderId) {
        return update(list, { folder_id: targetFolderId }, 'copy')
            .pipe(clearCaches(list, targetFolderId))
            .done(refreshAll)
            .done(function () {
                notifications.yell('success', gt('Mail has been copied'));
                folderAPI.reload(targetFolderId, list);
            });
    };

    var react = function (action, obj, view) {
        // get proper view first
        view = $.trim(view || 'text').toLowerCase();
        view = view === 'text/plain' ? 'text' : view;
        view = view === 'text/html' ? 'html' : view;
        return http.PUT({
                module: 'mail',
                params: {
                    action: action || '',
                    view: view
                },
                data: _([].concat(obj)).map(function (obj) {
                    return api.reduce(obj);
                }),
                appendColumns: false
            })
            .pipe(function (data) {
                var text = '', quote = '', tmp = '';
                // transform pseudo-plain text to real text
                if (data.attachments && data.attachments.length) {
                    if (data.attachments[0].content === '') {
                        // nothing to do - nothing to break
                    } else {
                        //content-type specific
                        if (data.attachments[0].content_type === 'text/plain') {
                            $('<div>')
                                // escape everything but BR tags
                                .html(data.attachments[0].content.replace(/<(?!br)/ig, '&lt;'))
                                .contents().each(function () {
                                    if (this.tagName === 'BR') {
                                        text += '\n';
                                    } else {
                                        text += $(this).text();
                                    }
                                });
                            // remove white space
                            text = $.trim(text);
                            // polish for html editing
                            if (view === 'html') {
                                // escape '<'
                                text = text.replace(/</ig, '&lt;');
                                // replace '\n>' sequences by blockquote-tags
                                _(text.split(/\n/).concat('\n')).each(function (line) {
                                    if (/^> /.test(line)) {
                                        quote += line.substr(2) + '\n';
                                    } else {
                                        tmp += (quote !== '' ? '<blockquote><p>' + quote + '</p></blockquote>' : '') + line + '\n';
                                        quote = '';
                                    }
                                });
                                // transform line-feeds back to BR
                                data.attachments[0].content = $.trim(tmp).replace(/\n/g, '<br>');
                            } else {
                                // replace
                                data.attachments[0].content = $.trim(text);
                            }
                        } else if (data.attachments[0].content_type === 'text/html') {
                            // robust approach for large mails
                            tmp = document.createElement('DIV');
                            tmp.innerHTML = data.attachments[0].content;
                            _(tmp.getElementsByTagName('BLOCKQUOTE')).each(function (node) {
                                node.removeAttribute('style');
                            });
                            data.attachments[0].content = tmp.innerHTML;
                            tmp = null;
                        }
                    }
                } else {
                    data.attachments = data.attachments || [{}];
                    data.attachments[0].content = '';
                }
                return data;
            });
    };

    /**
     * get mail object with unmodified content (in case externalresources warning message was ignored)
     * @param  {object]} obj (mail object)
     * @return {deferred} obj (mail object)
     */
    api.getUnmodified = function (obj) {
        // has folder?
        if ('folder_id' in obj || 'folder' in obj) {
            return this.get({
                action: 'get',
                id: obj.id,
                folder: obj.folder || obj.folder_id,
                view: 'html'
            }, false);
        } else if ('parent' in obj) {
            // nested message!?
            var id = obj.id, parent = obj.parent;
            return this.get({
                    action: 'get',
                    id: obj.parent.id,
                    folder: obj.parent.folder || obj.parent.folder_id,
                    view: 'html'
                }, false)
                .pipe(function (data) {
                    return _.chain(data.nested_msgs)
                        .filter(function (obj) {
                            if (obj.id === id) {
                                obj.parent = parent;
                                return true;
                            } else {
                                return false;
                            }
                        })
                        .first().value();
                });
        } else {
            console.error('api.getUnmodified(). Invalid case.', obj);
            return $.Deferred().resolve(obj);
        }
    };

    /**
     * get source code of specified mail
     * @param  {object} obj (mail)
     * @return {deferred} returns source string
     */
    api.getSource = function (obj) {
        return this.get({
            action: 'get',
            id: obj.id,
            src: 1,
            folder: obj.folder || obj.folder_id,
            view: 'html'
        }, false);
    };

    /**
     * prepares object content for 'replayall' action
     * @param  {object} obj (mail object)
     * @param  {string} view (html or text)
     * @return {deferred} done returns prepared object
     */
    api.replyall = function (obj, view) {
        return react('replyall', obj, view);
    };

    /**
     * prepares object content for 'reply' action
     * @param  {object} obj (mail object)
     * @param  {string} view (html or text)
     * @return {deferred} done returns prepared object
     */
    api.reply = function (obj, view) {
        return react('reply', obj, view);
    };

    /**
     * prepares object content for 'forward' action
     * @param  {object} obj (mail object)
     * @param  {string} view (html or text)
     * @return {deferred} done returns prepared object
     */
    api.forward = function (obj, view) {
        return react('forward', obj, view);
    };

    /**
     * sends a mail
     * @param  {object} data (mail object)
     * @param  {array} files
     * @param  {jquery} form (for 'oldschool')
     * @fires  api#refresh.all
     * @fires  api#refresh.list
     * @return {deferred}
     */
    api.send = function (data, files, form) {
        var deferred,
            flatten = function (recipient) {
                var name = $.trim(recipient[0] || '').replace(/^["']+|["']+$/g, ''),
                    address = recipient[1],
                    typesuffix = recipient[2] || '';
                return name === '' ? address : '"' + name + '" <' + address + typesuffix + '>';
            };

        // clone data (to avoid side-effects)
        data = _.clone(data);

        // flatten from, to, cc, bcc
        data.from = _(data.from).map(flatten).join(', ');
        data.to = _(data.to).map(flatten).join(', ');
        data.cc = _(data.cc).map(flatten).join(', ');
        data.bcc = _(data.bcc).map(flatten).join(', ');

        function mapArgs(obj) {
            return {
                'args': [{'com.openexchange.groupware.contact.pairs': [{'folder': obj.folder_id, 'id': obj.id}]}],
                'identifier': 'com.openexchange.contact'
            };
        }

        if (data.contacts_ids) {
            data.datasources = _.chain(data.contacts_ids).map(mapArgs).value();
        }

        if (Modernizr.file && 'FormData' in window) {
            deferred = handleSendXHR2(data, files, deferred);
        } else {
            deferred = handleSendTheGoodOldWay(data, form);
        }

        return deferred.then(function (text) {
            // wait a moment, then update mail index
            setTimeout(function () {
                // clear inbox & sent folder
                var folders = [].concat(
                    accountAPI.getFoldersByType('inbox'),
                    accountAPI.getFoldersByType('sent'),
                    accountAPI.getFoldersByType('drafts')
                );
                $.when.apply(
                    _(folders).map(function (id) {
                        return api.caches.all.grepRemove(id + DELIM);
                    })
                )
                .done(function () {
                    api.trigger('refresh.all');
                });
            }, 3000);
            // IE9
            if (_.isObject(text))
                return text;
            // process HTML-ish non-JSONP response
            var a = text.indexOf('{'),
                b = text.lastIndexOf('}');
            if (a > -1 && b > -1) {
                return JSON.parse(text.substr(a, b - a + 1));
            } else {
                return {};
            }
        })
        .then(function (result) {
            //skip block if error returned
            if (result.data) {
                var base = _(result.data.toString().split(api.separator)),
                    id = base.last(),
                    folder = base.without(id).join(api.separator);
                api.get({ folder_id: folder, id: id }).then(function (mail) {
                    $.when(api.caches.list.add(data), api.caches.get.add(data))
                    .done(function () {
                        api.trigger('refresh.list');
                    });
                });
            }
            return result;
        });
    };

    function handleSendXHR2(data, files) {

        var form = new FormData();
        // add mail data
        form.append('json_0', JSON.stringify(data));
        // add files
        _(files).each(function (file, index) {
            form.append('file_' + index, file);
        });

        return http.UPLOAD({
            module: 'mail',
            params: {
                action: 'new',
                deleteDraftOnTransport: data.sendtype === api.SENDTYPE.EDIT_DRAFT
            },
            data: form,
            dataType: 'text'
        });
    }

    function handleSendTheGoodOldWay(data, form) {
        return http.FORM({
            module: 'mail',
            action: 'new',
            data: data,
            form: form,
            field: 'json_0'
        });
    }

    /**
     * save mail attachments in files app
     * @param  {array} list
     * @param  {string} target (folder id) [optional]
     * @fires  api#refresh.all
     * @return {deferred}
     */
    api.saveAttachments = function (list, target) {
        // be robust
        target = target || config.get('folder.infostore');
        // support for multiple attachments
        list = _.isArray(list) ? list : [list];
        http.pause();
        // loop
        _(list).each(function (data) {
            http.PUT({
                module: 'mail',
                params: {
                    action: 'attachment',
                    id: data.mail.id,
                    folder: data.mail.folder_id,
                    dest_folder: target,
                    attachment: data.id
                },
                data: { folder_id: target, description: 'Saved mail attachment' },
                appendColumns: false
            });
        });
        return http.resume().done(function () {
            require(['io.ox/files/api'], function (fileAPI) {
                fileAPI.caches.all.grepRemove(target + DELIM);
                fileAPI.trigger('refresh.all');
            });
        });
    };

    /**
     * get url for attachment in requested mode
     * @param  {object} data (attachment)
     * @param  {string} mode ('download', 'zip', 'email, 'view', 'open')
     * @return {string} url
     */
    api.getUrl = function (data, mode) {
        var url = ox.apiRoot + '/mail', first;
        if (mode === 'zip') {
            first = _(data).first();
            return url + '?' + $.param({
                action: 'zip_attachments',
                folder: (first.parent || first.mail).folder_id,
                id: (first.parent || first.mail).id,
                attachment: _(data).pluck('id').join(','),
                session: ox.session // required here!
            });
        } else if (mode === 'eml:reference') {
            //if eml stored as reference use parent object
            return this.getUrl(_([].concat(data)).first().parent, 'eml');
        } else if (mode === 'eml') {
            data = [].concat(data);
            first = _(data).first();
            // multiple?
            if (data.length > 1) {
               // zipped
                return url + '?' + $.param({
                    action: 'zip_messages',
                    folder: first.folder_id,
                    id: _(data).pluck('id').join(','),
                    session: ox.session
                });
            } else {
                // single EML
                return url + '?' + $.param($.extend(api.reduce(first), {
                    action: 'get',
                    src: 1,
                    save: 1,
                    session: ox.session
                }));
            }
        } else {
            // inject filename for more convenient file downloads
            url += (data.filename ? '/' + encodeURIComponent(data.filename) : '') + '?' +
                $.param({
                    action: 'attachment',
                    folder: (data.parent || data.mail).folder_id,
                    id: (data.parent || data.mail).id,
                    attachment: data.id
                });
            switch (mode) {
            case 'view':
            case 'open':
                return url + '&delivery=view';
            case 'download':
                return url + '&delivery=download';
            default:
                return url;
            }
        }
    };

    var lastUnseenMail = 0;

    /**
     * checks inbox for new mails
     * @fires api#new-mail (recent, unseen)
     * @return {deferred} done returns { unseen: [], recent: [] }
     */
    api.checkInbox = function () {
        // look for new unseen mails in INBOX
        return http.GET({
            module: 'mail',
            params: {
                action: 'all',
                folder: 'default0/INBOX',
                columns: '610,600,601,611', //received_date, id, folder_id, flags
                unseen: 'true',
                deleted: 'true',
                sort: '610',
                order: 'desc'
            }
        })
        .pipe(function (unseen) {
            var recent;
            // check most recent mail
            recent = _(unseen).filter(function (obj) {
                return obj.received_date > lastUnseenMail;
            });
            if ((recent.flags & 2) !== 2) { // ignore mails 'mark as deleted'. Trigger even if no new mails are added to ensure read mails are removed
                api.trigger('new-mail', recent, unseen);
                if (recent.length > 0) {
                    lastUnseenMail = recent[0].received_date;
                    api.newMailTitle(true);
                }
            }
            return {
                unseen: unseen,
                recent: recent || []
            };
        });
    };

    /**
     * bind to global refresh; clears caches and trigger refresh.all
     * @fires  api#refresh.all
     * @return {promise}
     */
    api.refresh = function (e) {
        if (ox.online) {
            // reset cache control
            _(cacheControl).each(function (val, cid) {
                cacheControl[cid] = false;
            });
            api.checkInbox().always(function () {
                // trigger
                api.trigger('refresh.all');
            });
        }
    };

    /**
     * remove elements from list
     * @param  {array} list (list)
     * @param  {object} hash (ids of items to be removed)
     * @return {array} (cleaned list)
     */
    api.localRemove = function (list, hash) {
        // reverse lookup first to get affacted top-level elements
        var reverse = {};
        _(hash).each(function (value, cid) {
            var threadCID = tracker.getThreadCID(cid);
            if (threadCID !== undefined) {
                // is a thread, but we store the inner cid since we loop over root elements
                reverse[threadCID] = cid;
            }
        });
        // loop over list and check occurence via hash
        return _(list).filter(function (obj) {
            var cid = _.cid(obj), found = cid in hash, length = obj.thread ? obj.thread.length : 1, s, entire;
            // case #1: found in hash; no thread
            if (found && length <= 1) {
                return false;
            }
            // case #2: found in hash; root element
            if (found && length > 1) {
                // delete entire thread?
                entire = _(obj.thread).chain().map(_.cid)
                    .inject(function (sum, cid) { return sum + (cid in hash ? 1 : 0); }, 0).value() === length;
                if (entire) {
                    return false;
                } else {
                    // copy props from second thread item
                    s = obj.thread[1];
                    _.extend(obj, { folder_id: s.folder_id, id: s.id, flags: s.flags, color_label: s.color_label });
                    obj.thread.splice(0, 1);
                    return true;
                }
            }
            // case #3: found via reverse lookup
            if (cid in reverse) {
                obj.thread = _(obj.thread).filter(function (o) {
                    return _.cid(o) !== reverse[cid];
                });
                return true;
            }
            // otherwise
            return true;
        });
    };

    /**
     * @return {string} default folder for mail
     */
    api.getDefaultFolder = function () {
        return folderAPI.getDefaultFolder('mail');
    };

    /**
     * get account id
     * @param  {[type]} initialFolder (folder id)
     * @return {string} account id
     */
    api.getAccountIDFromFolder = function (initialFolder) {
        var accountId = /^default(\d*)\b/.exec(initialFolder);
        return accountId[1];
    };

    /**
     * beautifies mail text
     * @param  {string} str
     * @param  {integer} lengthLimit
     * @return {string}
     */
    api.beautifyMailText = function (str, lengthLimit) {
        lengthLimit = lengthLimit || 500;
        str = String(str)
            .substr(0, lengthLimit) // limit overall length
            .replace(/-{3,}/g, '---') // reduce dashes
            .replace(/<br\s?\/?>(&gt;)+/ig, ' ') // remove quotes after line breaks
            .replace(/<br\s?\/?>/ig, ' ') // remove line breaks
            .replace(/<[^>]+(>|$)/g, '') // strip tags
            .replace(/(http(s?):\/\/\S+)/i, '<a href="$1" target="_blank">http$2://...</a>') // links
            .replace(/&#160;/g, ' ') // convert to simple white space
            .replace(/\s{2,}/g, ' '); // reduce consecutive white space
        // trim
        return $.trim(str);
    };

    /**
     * imports mail as EML
     * @param  {object} options (file: {}, folder: string )
     * @fires  api#refresh.all
     * @return {deferred} returns array with objects (id, folder_id)
     */
    api.importEML = function (options) {
        options.folder = options.folder || api.getDefaultFolder();

        var form = new FormData();
        form.append('file', options.file);

        return http.UPLOAD({
                module: 'mail',
                params: {
                    action: 'import',
                    folder: options.folder,
                    force: true // don't check from address!
                },
                data: form,
                fixPost: true
            })
            .pipe(function (data) {
                return api.caches.all.grepRemove(options.folder + DELIM).pipe(function () {
                    api.trigger('refresh.all');
                    folderAPI.reload(options.folder);
                    return data;
                });
            });
    };

    // change API's default options if allowHtmlMessages changes
    settings.on('change:allowHtmlMessages', function (e, value) {
        api.options.requests.get.view = value ? 'noimg' : 'text';
    });

    // RegExp suffix for recursive grepRemove:
    // id + '/' for subfolders or id + DELIM for the top folder
    var reSuffix = ')(?:/|' + _.escapeRegExp(DELIM) + ')';

    accountAPI.on('refresh.all create:account', function () {
        folderAPI.getSubFolders().done(function (folders) {
            var ids = [];
            _.chain(folders).pluck('id')
                .filter(accountAPI.isUnified)
                .each(function (id) { ids.push(_.escapeRegExp(id)); });
            var re = new RegExp('(?:' + ids.join('|') + reSuffix);
            $.when.apply($, _.map(
                [api.caches.all].concat(_.toArray(folderAPI.caches)),
                function (cache) { return cache.grepRemove(re); }
            )).done(function () { api.trigger('refresh.all'); });
        });
    });

    /**
     * sets title to 'New Mail' or default
     * @param  {boolean} state
     * @return {undefined}
     */
    api.newMailTitle = function (state) {
        if (state === true) {//show new mail title
            document.fixedtitle = true;
            document.title = gt('New Mail');
        } else {//stop showing new mail title
            document.fixedtitle = false;
            document.title = document.temptitle;
        }
    };

    return api;
});
