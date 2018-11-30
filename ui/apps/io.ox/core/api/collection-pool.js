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
 */

define('io.ox/core/api/collection-pool', ['io.ox/core/api/backbone'], function (backbone) {

    'use strict';

    var pools = {},
        collections = {},
        // to avoid unnecessary/endless recursion
        skip = false,
        skipRemove = false,
        Collection = backbone.Collection.extend({
            _removeModels: function (models, options) {
                models = _(models).filter(function (model) {
                    return model.preserve !== true;
                });
                return backbone.Collection.prototype._removeModels.call(this, models, options);
            }
        });

    function propagateRemove(module, model) {
        if (skip || skipRemove) return;
        try {
            _(collections[module]).each(function (entry) {
                var target = entry.collection.get(model.cid);
                if (!target) return;
                target.preserve = model.preserve;
                skip = true;
                entry.collection.remove(target);
            });
        } finally {
            // use try/finally to make sure we always reset 'skip'
            skip = false;
        }
    }

    function propagateChange(module, model) {
        if (skip) return;
        try {
            _(collections[module]).each(function (entry) {
                var cid = !!model.changed.cid ? model.previous('cid') : model.cid,
                    target = entry.collection.get(cid),
                    data;
                if (!target) return;
                skip = true;
                data = model.toJSON();
                delete data.index;
                target.set(data);
            });
        } finally {
            // use try/finally to make sure we always reset 'skip'
            skip = false;
        }
    }

    function gc(hash) {

        // Garbage Collection
        // ------------------
        // concept:
        // - on first refresh, all collections are marked as expired
        // - collections that are still used in UI will be updated and therefore "expired" will be set to false
        // - models that are in active collections are collected
        // - all remaining models will be removed

        // hash to track referenced models
        var models = {};

        // look for expired collection
        _(hash).each(function (entry, id) {
            // ignore detail collection
            if (id === 'detail') return;
            // ignore search collections cause their lack of proper reset handling (TODO)
            if (id.indexOf('search') === 0) return;
            if (entry.collection.expired) {
                // remove collections if marked as expired
                entry.collection.reset();
                delete hash[id];
            } else {
                // track all referenced models
                entry.collection.each(function (model) {
                    models[model.cid] = true;
                    _(this.getDependentModels(model.cid)).each(function (model) {
                        models[model.cid] = true;
                    });
                }, this);
            }
        }, this);

        // loop over detail collection to find expired models
        var expired = this.get('detail').filter(function (model) {
            if (model['index/virtual/favorites/infostore'] !== undefined) return false;
            if (model['index/virtual/favoriteFiles/infostore'] !== undefined) return false;
            return !models[model.cid];
        });

        // remove expired models from detail collection
        this.get('detail').remove(expired, { silent: true });

        // clean up
        expired = models = null;

        // mark all collections as expired
        _(hash).each(function (entry, id) {
            // ignore detail collection and those with gc=false, e.g. all-visible
            if (id === 'detail' || entry.collection.gc === false) return;
            // mark as expired
            entry.collection.expire();
        });
    }

    function Pool(module, options) {

        var hash = collections[module] || (collections[module] = {});

        options = options || {};
        this.Collection = options.Collection || Collection;
        this.Model = options.Model || backbone.Model;

        this.getCollections = function () {
            return hash;
        };

        this.get = function (cid) {

            var entry = hash[cid];

            if (entry) {
                entry.access = _.now();
                return entry.collection;
            }

            // register new collection
            var collection = new this.Collection();
            hash[cid] = { access: _.now(), collection: collection };

            // add attributes
            collection.expired = false;
            collection.complete = false;
            collection.sorted = true;

            collection.expire = function () {
                this.expired = true;
                this.trigger('expire');
            };

            // to simplify debugging
            collection.cid = cid;

            // propagate changes in all collections
            return collection.on({
                'remove': propagateRemove.bind(this, module),
                'change': propagateChange.bind(this, module)
            });
        };

        this.getModule = function () {
            return module;
        };

        this.gc = function () {
            gc.call(this, hash);
        };

        // clear pool on global refresh
        ox.on('refresh^', _.throttle(gc.bind(this, hash), 5000));
    }

    // create new pool / singleton per module
    // avoids having different instances per module
    Pool.create = function (module, options) {
        return pools[module] || (pools[module] = new Pool(module, options));
    };

    // inspect
    Pool.inspect = function () {
        _(pools).each(function (pool, module) {
            var count = 0, collections = pool.getCollections();
            _(collections).each(function (entry) {
                count += _(entry.collection).size();
            });
            console.debug('Pool:', module, 'Model count:', count, 'Collections:', collections);
        });
    };

    // don't propagate remove events; usually during a collection.set
    Pool.preserve = function (fn) {
        skipRemove = true;
        if (fn) fn();
        skipRemove = false;
    };

    _.extend(Pool.prototype, {

        getDefault: function () {
            return new this.Collection();
        },

        propagate: function (type, data) {
            if (type === 'change') {
                propagateChange.call(this, this.getModule(), new this.Model(data));
            }
        },

        map: _.identity,

        add: function (cid, data) {
            if (arguments.length === 1) { data = cid; cid = 'detail'; }
            var collection = this.get(cid), valid, expired = [];
            data = _([].concat(data)).map(this.map, collection);

            // find modules that are expired (changed in another browser or by a shared user etc)
            if (cid === 'detail') {
                _(data).each(function (item) {
                    valid = !collection.get(_.cid(item)) || (collection.get(_.cid(item)) && collection.get(_.cid(item)).get('last_modified') >= item.last_modified);
                    if (!valid) {
                        item.expired = true;
                        expired.push(_.cid(item));
                    } else {
                        item.expired = false;
                    }
                });
            }

            collection.add(data, { merge: true, parse: true });

            if (expired.length > 0) {
                // trigger event for the expired models, so views can update
                collection.trigger('expired_models', expired);
            }

            return collection;
        },

        // resolve a list of composite keys (cids) to models
        // skips items that are a model already
        resolve: function (list) {
            var collection = this.get('detail'), Model = this.Model;
            return _([].concat(list)).map(function (item) {
                return item instanceof Model ? item : collection.get(_.cid(item)) || {};
            });
        },

        getDetailModel: function (data) {

            var cid = _.cid(data), collection = this.get('detail'), model;

            if ((model = collection.get(cid))) return model;

            model = new this.Model(data);

            // add to pool unless it looks like a nested object
            if (data.folder_id !== undefined && data.parent === undefined) collection.add(model);

            return model;
        },

        grep: function () {
            var args = arguments;

            function contains(memo, str) {
                return memo && this.indexOf(str) > -1;
            }

            return _(this.getCollections())
                .chain()
                .filter(function (entry, id) {
                    return _(args).reduce(contains.bind(id), true);
                })
                .pluck('collection')
                .value();
        },

        getByFolder: function (id) {
            return this.grep('folder=' + id + '&');
        },

        getBySorting: function (sort, folder) {
            return this.grep('folder=' + folder + '&', 'sort=' + sort);
        },

        // used by garbage collector to resolve threads
        getDependentModels: function (/* cid */) {
            return [];
        },

        resetFolder: function (ids) {
            var list = _(this.getByFolder(ids));
            list.invoke('expire');
            return list;
        },

        preserveModel: function (cid, state) {
            _(this.getCollections()).each(function (entry) {
                var model = entry.collection.get(cid);
                if (model) model.preserve = !!state;
            });
        }
    });

    return Pool;
});
