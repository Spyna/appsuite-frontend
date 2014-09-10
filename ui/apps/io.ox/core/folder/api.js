/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/folder/api',
    ['io.ox/core/http',
     'io.ox/core/event',
     'io.ox/core/folder/util',
     'io.ox/core/folder/sort',
     'io.ox/core/folder/blacklist',
     'io.ox/core/folder/title',
     'io.ox/core/folder/bitmask',
     'io.ox/core/api/account',
     'settings!io.ox/core',
     'gettext!io.ox/core'], function (http, Events, util, sort, blacklist, getFolderTitle, Bitmask, account, settings, gt) {

    'use strict';

    var api = {}, pool;

    // add event hub
    Events.extend(api);

    //
    // Utility functions
    //

    function tree(id) {
        id = String(id);
        // use tree 0 for mail, use tree 1 for all other modules.
        // we need tree 1 for files so that 'altNames' works.
        return id === '1' || /^default\d+/.test(id) ? 0 : 1;
    }

    function injectIndex(item, index) {
        item.index = index;
        return item;
    }

    function onChangeModelId(model) {
        delete pool.models[model.previous('id')];
        pool.models[model.id] = model;
    }

    function unfetch(model) {
        pool.unfetch(model.id);
    }

    function isFlat(id) {
        return /^(contacts|calendar|tasks)$/.test(id);
    }

    function getCollectionId(id, all) {
        return (all ? 'all/' : '') + String(id);
    }

    //
    // Model & Collections
    //

    var FolderModel = Backbone.Model.extend({
        constructor: function () {
            Backbone.Model.apply(this, arguments);
            this.on('change:id', onChangeModelId);
        }
    });

    var FolderCollection = Backbone.Collection.extend({
        constructor: function () {
            Backbone.Collection.apply(this, arguments);
            this.fetched = false;
        },
        comparator: 'index',
        model: FolderModel
    });

    // collection pool
    function Pool() {

        this.models = {};
        this.collections = {};
    }

    _.extend(Pool.prototype, {

        addModel: function (data) {
            var id = data.id;
            if (this.models[id] === undefined) {
                // add new model
                this.models[id] = new FolderModel(data);
            } else {
                // update existing model
                this.models[id].set(data);
            }
            return this.models[id];
        },

        addCollection: function (id, list, options) {
            // transform list to models
            var models = _(list).map(this.addModel, this);
            // options
            options = options || {};
            // update collection
            var collection = this.getCollection(id),
                type = options.reset || !collection.fetched ? 'reset' : 'set';
            collection[type](models);
            collection.fetched = true;
        },

        getModel: function (id) {
            return this.models[id] || (this.models[id] = new FolderModel({ id: id }));
        },

        getCollection: function (id, all) {
            id = getCollectionId(id, all);
            return this.collections[id] || (this.collections[id] = new FolderCollection());
        },

        unfetch: function (id) {
            if (id === '0') {
                return _(this.collections).each(function (collection) {
                    collection.fetched = false;
                });
            }
            var collection = this.collections[id];
            if (!collection) return;
            collection.fetched = false;
            collection.each(unfetch);
        }
    });

    // get instance
    pool = new Pool();

    //
    // Used by list() and ramp-up
    //

    function processListResponse(id, list) {
        // 1. apply blacklist
        list = blacklist.apply(list);
        // 2. apply custom order
        list = sort.apply(id, list);
        // 3. inject index
        _(list).each(injectIndex);
        // done
        return list;
    }

    //
    // Use ramp-up data
    //

    _(ox.rampup.folder).each(function (data) {
        pool.addModel(data);
    });

    var rampup = {};

    _(ox.rampup.folderlist || {}).each(function (list, id) {
        // make objects
        rampup[id] = _(list).map(function (data) {
            return _.isArray(data) ? http.makeObject(data, 'folders') : data;
        });
    });

    //
    // Propagate
    // central hub to coordinate events and caches
    // (see files/api.js for a full implementation for files)
    //

    var ready = $.when();

    function propagate(arg) {

        if (arg instanceof Backbone.Model) {

            var model = arg, data = model.toJSON(), id = data.id;

            if (model.changed.total) {
                api.trigger('update:total', id, data);
                api.trigger('update:total:' + id, data);
            }
            if (model.changed.unread) {
                api.trigger('update:unread', id, data);
                api.trigger('update:unread:' + id, data);
            }
            return;
        }

        if (/^account:(create|delete|unified-enable|unified-disable)$/.test(arg)) {
            // need to refresh subfolders of root folder 1
            return list('1', { cache: false }).done(function () {
                api.trigger('refresh');
            });
        }

        return ready;
    }

    //
    // Define a virtual collection
    //

    var virtual = {

        hash: {},

        get: function (id) {
            var getter = this.hash[id];
            return getter !== undefined ? getter() : $.Deferred().reject();
        },

        add: function (id, getter) {
            this.hash[id] = getter;
            pool.getModel(id).set('subfolders', true);
        },

        concat: function () {
            return $.when.apply($, arguments).then(function () {
                return _(arguments).chain().flatten().map(injectIndex).value();
            });
        }
    };

    //
    // Get a single folder
    //

    function get(id, options) {

        id = String(id);
        options = _.extend({ cache: true }, options);

        var model = pool.models[id];
        if (options.cache === true && model !== undefined && model.has('title')) return $.when(model.toJSON());

        if (/^virtual/.test(id)) return $.when({ id: id });

        return http.GET({
            module: 'folders',
            params: {
                action: 'get',
                altNames: true,
                id: id,
                timezone: 'UTC',
                tree: tree(id)
            }
        })
        .then(function (data) {
            // update/add model
            var model = pool.addModel(data);
            // propagate changes via api events
            propagate(model);
            // to make sure we always get the same result (just data; not timestamp)
            return data;
        });
    }

    //
    // Special case: Get multiple folders at once
    //

    function multiple(ids) {
        try {
            http.pause();
            return $.when.apply($,
                _(ids).map(function (id) {
                    return get(id).then(null, function () { return $.when(undefined); });
                })
            )
            .then(function () {
                return _(arguments).toArray();
            });
        } finally {
            http.resume();
        }
    }

    //
    // Get subfolders
    //

    function list(id, options) {

        id = String(id);
        options = _.extend({ all: false, cache: true }, options);

        // already cached?
        var collectionId = getCollectionId(id, options.all),
            collection = pool.getCollection(collectionId);
        if (collection.fetched && options.cache === true) return $.when(collection.toJSON());

        // use rampup data?
        if (rampup[id]) {
            var array = processListResponse(id, rampup[id]);
            pool.addCollection(id, array);
            delete rampup[id];
            return $.when(array);
        }

        // flat?
        var data = /^flat\/([^/]+)\/([^/]+)$/.exec(id), module, section;
        if (data) {
            module = data[1];
            section = data[2];
            return flat({ module: module, cache: options.cache }).then(function (sections) {
                return sections[section];
            });
        }

        // special handling for virtual folders
        if (/^virtual/.test(id)) return virtual.get(id).done(function (array) {
            pool.addCollection(collectionId, array);
        });

        return http.GET({
            module: 'folders',
            params: {
                action: 'list',
                all: options.all ? '1' : '0',
                altNames: true,
                parent: id,
                timezone: 'UTC',
                tree: tree(id)
            },
            appendColumns: true
        })
        .then(function (array) {
            array = processListResponse(id, array);
            pool.addCollection(collectionId, array);
            // to make sure we always get the same result (just data; not timestamp)
            return array;
        });
    }

    //
    // Get folder path
    //

    function path(id) {

        var result = [], current = id, data, done = false;

        // be robust
        if (id === undefined) return $.when([]);

        // try to resolve via pool
        do {
            result.push(data = pool.getModel(current).toJSON());
            current = data.folder_id;
            done = String(current) === '1';
        } while (current && !done);

        // resolve in reverse order (root > folder)
        if (done) return $.when(result.reverse());

        return http.GET({
            module: 'folders',
            params: {
                action: 'path',
                altNames: true,
                id: id,
                tree: tree(id)
            },
            appendColumns: true
        })
        .then(function (data) {
            // loop over folders to remove root and add to pool
            return _(data)
                .filter(function (folder) {
                    pool.addModel(folder);
                    return folder.id !== '1';
                })
                .reverse();
        });
    }


    //
    // Flat list
    //

    function makeObject(array) {
        return http.makeObject(array, 'folders');
    }

    function getSection(type) {
        if (type === 3) return 'shared';
        if (type === 2) return 'public';
        return 'private';
    }

    function getFlatCollectionId(module, section) {

        return 'flat/' + module + '/' + section;
    }

    function getFlatCollection(module, section) {
        return pool.getCollection(getFlatCollectionId(module, section));
    }

    function flat(options) {

        options = _.extend({ module: undefined, cache: true }, options);

        // missing module?
        if (ox.debug && !options.module) {
            console.warn('Folder API > flat() - Missing module', options);
            return $.Deferred().reject();
        }

        // already cached?
        var module = options.module,
            collection = getFlatCollection(module, 'private');

        if (collection.fetched && options.cache === true) {
            return $.when({
                'private' : collection.toJSON(),
                'public'  : getFlatCollection(module, 'public').toJSON(),
                'shared'  : getFlatCollection(module, 'shared').toJSON(),
                'sharing' : getFlatCollection(module, 'sharing').toJSON(),
                'hidden'  : getFlatCollection(module, 'hidden').toJSON()
            });
        }

        return http.GET({
            module: 'folders',
            appendColumns: true,
            params: {
                action: 'allVisible',
                altNames: true,
                content_type: module,
                timezone: 'UTC',
                tree: 1
            }
        })
        .then(function (data) {
            var sections = {},
                hidden = [],
                sharing = [],
                hash = settings.get(['folder/hidden'], {}),
                collectionId;
            // loop over results to get proper objects and sort out hidden folders
            _(data).each(function (section, id) {
                var array = _(section)
                    .chain()
                    .map(makeObject)
                    .filter(function (folder) {
                        // read access?
                        if (!util.can('read', folder)) return false;
                        // store section / easier than type=1,2,3
                        if (hash[folder.id]) { hidden.push(folder); return false; }
                        // sharing?
                        if (util.is('shared-by-me', folder)) sharing.push(folder);
                        // otherwise
                        return true;
                    })
                    .value();
                // process response and add to pool
                collectionId = getFlatCollectionId(module, id);
                array = processListResponse(collectionId, array);
                pool.addCollection(collectionId, sections[id] = array, { reset: true });
            });
            // add collection for hidden folders
            collectionId = getFlatCollectionId(module, 'hidden');
            hidden = processListResponse(collectionId, hidden);
            pool.addCollection(collectionId, sections.hidden = hidden, { reset: true });
            // add collection for folders shared by me
            collectionId = getFlatCollectionId(module, 'sharing');
            sharing = processListResponse(collectionId, sharing);
            pool.addCollection(collectionId, sections.sharing = sharing, { reset: true });
            // done
            return sections;
        });
    }

    //
    // Update folder
    //

    function update(id, changes, options) {

        if (!_.isObject(changes) || _.isEmpty(changes)) return;

        // update model
        options = _.extend({ silent: false }, options);
        var model = pool.getModel(id).set(changes, { silent: options.silent });

        return http.PUT({
            module: 'folders',
            params: {
                action: 'update',
                id: id,
                timezone: 'UTC',
                tree: tree(id)
            },
            data: changes,
            appendColumns: false
        })
        .then(
            function success(newId) {
                // id change? (caused by rename or move)
                if (id !== newId) model.set('id', newId);
                // trigger event
                if (!options.silent) api.trigger('update', id, newId, model.toJSON());
                // fetch subfolders of parent folder to ensure proper order after rename/move
                if (id !== newId) return list(model.get('folder_id'), { cache: false }).then(function () {
                    return newId;
                });
            },
            function fail(error) {
                if (error && error.code && error.code === 'FLD-0018') {
                    error.error = gt('Could not save settings. There have to be at least one user with administration rights.');
                }
                if (!options.silent) {
                    api.trigger('update:fail', error, id);
                }
                return error;
            }
        );
    }

    //
    // Move folder
    //

    function move(id, target) {

        if (id === target) return;

        // prepare move
        var model = pool.getModel(id),
            parent = model.get('folder_id'),
            collection = pool.getCollection(parent);

        // remove model from parent collection
        collection.remove(model);
        // update parent folder; subfolders might have changed
        pool.getModel(parent).set('subfolders', collection.length > 0);

        return update(id, { folder_id: target }).done(function (newId) {
            // update new parent folder
            pool.getModel(target).set('subfolders', true);
            // trigger event
            api.trigger('move', id, newId);
        });
    }

    //
    // Create folder
    //

    function create(id, options) {

        // get parent folder first - actually just to inherit 'module';
        return get(id).then(function (parent) {
            // default options
            options = _.extend({
                module: parent.module,
                subscribed: 1,
                title: gt('New Folder')
            }, options);
            // go!
            return http.PUT({
                module: 'folders',
                params: {
                    action: 'new',
                    autorename: true,
                    folder_id: id,
                    tree: tree(id)
                },
                data: options,
                appendColumns: false
            })
            .then(function getNewFolder(newId) {
                return get(newId);
            })
            .then(function reloadSubFolders(data) {
                return (
                    isFlat(options.module) ? flat({ module: options.module, cache: false }) : list(id, { cache: false })
                )
                .then(function () {
                    // make sure to return new folder data
                    return data;
                });
            })
            .done(function updateParentFolder(data) {
                pool.getModel(id).set('subfolders', true);
                api.trigger('create', data);
            })
            .fail(function fail(error) {
                api.trigger('create:fail', error, id);
            });
        });
    }

    //
    // Remove folder
    //

    function removeFromCollection(model) {
        // flat folders are different
        var module = model.get('module'), section, parent, collection;
        if (isFlat(module)) {
            // contacts, calendar, tasks
            section = getSection(model.get('type'));
            collection = getFlatCollection(module, section);
            collection.remove(model);
        } else {
            // mail and drive
            parent = model.get('folder_id');
            collection = pool.getCollection(parent);
            collection.remove(model);
            // update parent folder; subfolders might have changed
            pool.getModel(parent).set('subfolders', collection.length > 0);
        }
    }

    function remove(id) {

        // get model
        var model = pool.getModel(id), data = model.toJSON();

        // trigger event
        api.trigger('remove:prepare', data);

        // update collection
        removeFromCollection(model);

        // delete on server
        return http.PUT({
            module: 'folders',
            params: {
                action: 'delete',
                failOnError: true,
                tree: tree(id)
            },
            data: [id],
            appendColumns: false
        })
        .then(
            function success() {
                api.trigger('remove', id, data);
                api.trigger('remove:' + id, data);
                api.trigger('remove:' + data.module, data);
            },
            function fail() {
                api.trigger('remove:fail', id);
            }
        );
    }

    //
    // Provide text node
    //

    function updateTextNode(data) {
        this.nodeValue = _.noI18n(data.title || data.id);
    }

    function getTextNode(id) {
        var node = document.createTextNode('');
        get(id).done(updateTextNode.bind(node));
        return node;
    }

    //
    // ignoreSentItems()
    // check a list of object if they originate from more than one folder
    // if so remove items from "sent" folder; useful for delete/move actions and threads
    //

    function fromSameFolder(list) {
        return _(list).chain().pluck('folder_id').uniq().value().length <= 1;
    }

    function isNotSentFolder(obj) {
        return !account.is('sent', obj.folder_id);
    }

    function ignoreSentItems(list) {
        // not array or just one?
        if (!_.isArray(list) || list.length === 1) return list;
        // all from same folder?
        if (fromSameFolder(list)) return list;
        // else: exclude sent items
        return _(list).filter(isNotSentFolder);
    }

    //
    // Reload folder
    //

    function getFolderId(arg) {
        return _.isString(arg) ? arg : (arg ? arg.folder_id : null);
    }

    function reload() {
        _.chain(arguments).flatten().map(getFolderId).compact().uniq().each(function (id) {
            get(id, { cache: false });
        });
    }

    //
    // Hide/show (flat) folder
    //

    function hide(id) {
        // get model & module
        var model = pool.getModel(id), module = model.get('module');
        // change state
        settings.set(['folder/hidden', id], true).save();
        // reload sections; we could handle this locally
        // but this is a dead-end when it comes to sorting

        flat({ module: module, cache: false });
    }

    function show(id) {
        // get model & module
        var model = pool.getModel(id), module = model.get('module');
        // change state
        settings.remove(['folder/hidden', id]).save();
        // reload sections; we could handle this locally
        // but this is a dead-end when it comes to sorting
        flat({ module: module, cache: false });
    }

    function toggle(id, state) {
        if (state === true) show(id); else hide(id);
    }

    //
    // Change unseen count
    //

    function changeUnseenCounter(id, delta) {
        var model = pool.getModel(id);
        model.set('unread', Math.max(0, model.get('unread') + delta));
    }

    //
    // Refresh all folders
    //

    function refresh() {
        // pause http layer to get one multiple
        http.pause();
        // loop over all subfolder collection and reload
        _(pool.collections).each(function (collection, id) {
            // check collection.fetched; no need to fetch brand new subfolders
            if (collection.fetched) list(id, { cache: false });
        });
        // go!
        http.resume();
    }

    ox.on('please:refresh refresh^', refresh);

    // publish api
    _.extend(api, {
        FolderModel: FolderModel,
        FolderCollection: FolderCollection,
        Pool: Pool,
        pool: pool,
        get: get,
        list: list,
        multiple: multiple,
        path: path,
        flat: flat,
        update: update,
        move: move,
        create: create,
        remove: remove,
        reload: reload,
        hide: hide,
        show: show,
        toggle: toggle,
        refresh: refresh,
        bits: util.bits,
        is: util.is,
        can: util.can,
        virtual: virtual,
        isFlat: isFlat,
        getFlatCollection: getFlatCollection,
        getDefaultFolder: util.getDefaultFolder,
        getTextNode: getTextNode,
        getFolderTitle: getFolderTitle,
        ignoreSentItems: ignoreSentItems,
        processListResponse: processListResponse,
        changeUnseenCounter: changeUnseenCounter,
        getSection: getSection,
        Bitmask: Bitmask
    });

    return api;
});
