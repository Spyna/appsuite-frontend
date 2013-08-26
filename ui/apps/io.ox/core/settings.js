/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2012
 * Mail: info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/settings', ['io.ox/core/http', 'io.ox/core/cache', 'io.ox/core/event'], function (http, cache, Event) {

    'use strict';

    var clone = function (obj) {
        // simple, fast, and robust
        if (_.isUndefined(obj)) {
            return undefined;
        }
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (e) {
            console.error(obj, e, e.stack);
            throw e;
        }
    };

    var getParts = function (key) {
        return _.isArray(key) ? key : String(key).split(/\//);
    };

    var get = function (source, path, defaultValue) {
        // no argument?
        if (path === undefined) { return clone(source); }
        // get parts
        var key, parts = getParts(path), tmp = source || {};
        while (parts.length) {
            key = parts.shift();
            tmp = tmp[key];
            if (tmp === undefined) { return defaultValue; }
        }
        return clone(tmp);
    };

    // once cache for all
    var settingsCache;

    var Settings = function (path, tree, meta) {

        var self = this, detached = false,
            saved = JSON.parse(JSON.stringify(tree || {}));

        tree = tree || {};
        meta = meta || {};

        this.get = function (path, defaultValue) {
            return get(tree, path, defaultValue);
        };

        this.meta = function (path) {
            return get(meta, path, {});
        };

        this.isConfigurable = function (path) {
            var meta = this.meta(path);
            return 'configurable' in meta ? meta.configurable : true; // default is true!
        };

        this.contains = function (path) {
            var key, parts = getParts(path), tmp = tree || {};
            while (parts.length) {
                key = parts.shift();
                if (parts.length) {
                    if (_.isObject(tmp)) {
                        tmp = tmp[key];
                    } else {
                        return false;
                    }
                } else {
                    return _.isObject(tmp) && key in tmp;
                }
            }
        };

        var resolve = function (path, callback, create) {
            var key, parts = getParts(path), tmp = tree || {}, notPlainObject;
            while (parts.length) {
                key = parts.shift();
                if (_.isObject(tmp)) {
                    if (parts.length) {
                        notPlainObject = !!create && (!_.isObject(tmp[key]) || _.isArray(tmp[key]));
                        tmp = notPlainObject ? (tmp[key] = {}) : tmp[key];
                    } else {
                        callback(tmp, key);
                    }
                } else break;
            }
        };

        this.set = function (path, value) {
            // overwrite entire tree?
            if (arguments.length === 1 && _.isObject(path)) {
                tree = path;
                self.trigger('reset', tree);
            } else {
                resolve(path, function (tmp, key) {
                    var previous = tmp[key];
                    tmp[key] = value;
                    self.trigger('change:' + path, value).trigger('change', path, value, previous);
                }, true);
            }
            return this;
        };

        this.remove = function (path) {
            resolve(path, function (tmp, key) {
                var value = tmp[key];
                delete tmp[key];
                self.trigger('remove:' + path).trigger('remove change', path, value);
            });
            return this;
        };

        var applyDefaults = function () {
            return require([path + '/settings/defaults']).pipe(function (defaults) {
                tree = _.extend(defaults, tree);
            });
        };

        var change = function (model, e) {
            _(model.changed).each(function (value, path) {
                self.set(path, value, { validate: true });
            });
        };

        this.createModel = function (ModelClass) {
            return new ModelClass(tree).on('change', change);
        };

        this.stringify = function () {
            return JSON.stringify(this.get());
        };

        this.detach = function () {
            detached = true;
            return this;
        };

        this.load = function () {

            var load = function () {
                return http.PUT({
                    module: 'jslob',
                    params: { action: 'list' },
                    data: [path]
                })
                .then(
                    function success(data) {
                        if (!detached) {
                            tree = data[0].tree;
                            meta = data[0].meta;
                            saved = JSON.parse(JSON.stringify(tree));
                            return applyDefaults();
                        } else {
                            return $.when();
                        }
                    },
                    function fail(e) {
                        tree = {};
                        meta = {};
                        saved = {};
                        detached = true;
                        console.error('Cannot load jslob', path, e);
                        return applyDefaults();
                    }
                )
                .then(function () {
                    self.trigger('load', tree, meta);
                    var data = { tree: tree, meta: meta };
                    return settingsCache.add(path, data).pipe(function () { return data; });
                });
            };

            return settingsCache.get(path).pipe(function (data) {
                if (data !== null) {
                    tree = data.tree;
                    meta = data.meta;
                    if (ox.online) load(); // read-through caching
                    return data;
                } else if (ox.online) {
                    return load();
                } else { // offline
                    self.detach();
                    return { tree: tree, meta: meta };
                }
            });
        };

        this.clear = function () {
            return settingsCache.remove(path).pipe(function () {
                return http.PUT({
                    module: 'jslob',
                    params: {
                        action: 'set',
                        id: path
                    },
                    data: {}
                })
                .done(function () {
                    tree = {};
                    meta = {};
                    self.trigger('reset');
                });
            });
        };

        /**
         * Save settings to cache and backend.
         *
         * You can use the request object to find out whether the save
         * attempt was successful.
         *
         * @return The deffered object of the request sent
         *
         */
        this.save = (function () {

            var request, save = _.throttle(function (data, update) {
                request = http.PUT({
                    module: 'jslob',
                    params: { action: update ? 'update' : 'set', id: path },
                    data: data
                })
                .done(function (result) {
                    if (update) {
                        //this has been an update!
                        data = result.tree;
                    }
                    saved = JSON.parse(JSON.stringify(data));
                    self.trigger('save');
                });
            }, 5000); // limit to 5 seconds

            return function (custom) {

                if (detached) {
                    console.warn('Not saving detached settings.', path);
                }
                if (!custom && _.isEqual(saved, tree)) return $.when();

                var data = { tree: custom || tree, meta: meta },
                     deleted = _(saved).chain()
                         .keys()
                         .difference(_.keys(data.tree))
                         .value()
                         .length > 0, // we have deleted keys, can’t update
                    changed = _(data.tree).chain()
                        .pairs()
                        .map(function (prop) {
                            var eq = _.isEqual(saved[prop[0]], prop[1]);
                            return eq ? null : prop;
                        })
                        .compact()
                        .object()
                        .value();

                settingsCache.add(path, data);
                save(deleted ? data.tree : changed, !deleted);

                return request;
            };
        }());

        /**
         * facade for this.save to notify user in case of errors
         * @return {deferred}
         */
        this.saveAndYell = function (custom, options) {
            var def = this.save(custom),
                //options
                opt = $.extend({
                    debug: false
                }, options),
                notify = function (e) {
                    require(['io.ox/core/notifications'], function (notifications) {
                        notifications.yell(e);
                    });
                };

            //debug
            if (opt.debug) {
                def.always(function () {
                    var list = _.isArray(this) ? this : [this];
                    _.each(list, function (current) {
                        if (current.state)
                            console.warn('SAVEANDYELL: ' +  current.state());
                        else if (def.state)
                            console.warn('SAVEANDYELL: ' +  def.state());
                    });
                });
            }

            //yell on reject
            return def.fail(function (e) {
                        require(['io.ox/core/notifications'], function (notifications) {
                            var obj = e || { type: 'error' };
                            //use obj.message for custom error message
                            notifications.yell(obj);
                        });
                    });
        };

        Event.extend(this);
    };

    var list = 'io.ox/core io.ox/core/updates io.ox/mail io.ox/contacts io.ox/calendar'.split(' '), promise;

    function preload(path) {
        if (!promise) {
            promise = http.PUT({
                module: 'jslob',
                params: { action: 'list' },
                data: list
            })
            .then(function (data) {
                var hash = {};
                _(data).each(function (jslob) {
                    hash[jslob.id] = { tree: jslob.tree, meta: jslob.meta };
                });
                return hash;
            });
        }
        return promise.then(function (hash) {
            return require([path + '/settings/defaults']).then(
               function defaultsSuccess(defaults) {
                    if (hash[path] && hash[path].tree) {
                        hash[path].tree = _.extend(defaults, hash[path].tree || {});
                    }
                    return hash[path] || { tree: {}, meta: {} };
                },
                function defaultsFail(e) {
                    console.warn('Could not load defaults for', path);
                    return $.Deferred().resolve(
                        hash[path] || { tree: {}, meta: {} }
                    );
                }
            );
        });
    }

    return {
        load: function (name, req, load, config) {
            // init cache?
            if (!settingsCache) {
                settingsCache = new cache.SimpleCache('settings', true);
            }
            // bulk load?
            if (_(list).contains(name)) {
                preload(name).then(
                    function preloadSuccess(data) {
                        var settings = new Settings(name, data.tree, data.meta);
                        load(settings);
                    },
                    function preloadFail() {
                        // hard fail
                        alert('Severe error: Failed to load important user settings. Please check your connection and retry.');
                        location.href = 'signin#autologin=false';
                    }
                );
            } else {
                var settings = new Settings(name);
                settings.load().then(
                    function loadSuccess() {
                        load(settings);
                    },
                    function loadFaul() {
                        try {
                            load.error({});
                        } catch (e) {
                            console.error(e.message);
                        }
                        requirejs.undef('settings!' + name);
                    }
                );
            }
        }
    };
});

// define corresponding plugin now (not earlier)
(function () {
    'use strict';
    // just to fool build system.
    window[0 || 'define']('settings', ['io.ox/core/settings'], _.identity);
}());

