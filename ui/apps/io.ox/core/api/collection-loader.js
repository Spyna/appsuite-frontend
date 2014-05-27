/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2013 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/api/collection-loader', ['io.ox/core/api/collection-pool', 'io.ox/core/http'], function (Pool, http) {

    'use strict';

    var methods = { 'load': 'reset', 'paginate': 'add', 'reload': 'set' };

    function toHash(array) {
        var hash = {};
        _(array).each(function (i) { hash[i] = true; });
        return hash;
    }

    function CollectionLoader(options) {

        _.extend(this, {
            columns: '1,20',
            module: 'mail',
            ignore: 'limit max'
        }, options);

        this.pool = Pool.create(this.module);
        this.ignore = toHash(String(this.ignore).split(' '));
        this.collection = null;
        this.loading = false;

        function apply(collection, type, data) {
            var method = methods[type];
            collection[method](data);
            if (type === 'paginate' && data.length === 0) collection.trigger('complete');
            collection.trigger(type);
        }

        function fail(collection, type, e) {
            collection.trigger(type + ':fail', e);
        }

        function process(params, type) {
            // get offset
            var offset = type === 'paginate' ? this.collection.length : 0;
            // trigger proper event
            this.collection.trigger('before:' + type);
            // fetch data
            return this.fetch(params)
                .done(this.addIndex.bind(this, offset, params))
                .always(this.done.bind(this))
                .then(
                    _.lfo(apply, this.collection, type),
                    _.lfo(fail, this.collection, type)
                );
        }

        this.load = function (params) {

            params = this.getQueryParams(params || {});
            params.limit = '0,' + this.LIMIT;
            var collection = this.collection = this.getCollection(params);
            this.loading = false;

            if (collection.length > 0 && !collection.expired) {
                _.defer(function () {
                    collection.trigger('reset load');
                });
                return collection;
            }

            collection.expired = false;
            _.defer(process.bind(this), params, 'load');
            return collection;
        };

        this.paginate = function (params) {

            var collection = this.collection;
            if (this.loading) return collection;

            var offset = collection.length;
            params = this.getQueryParams(_.extend({ offset: offset }, params));
            params.limit = offset + ',' + (offset + this.LIMIT);
            this.loading = true;

            collection.expired = false;
            _.defer(process.bind(this), params, 'paginate');
            return collection;
        };

        this.reload = function (params) {

            var collection = this.collection;
            if (this.loading) return collection;

            params = this.getQueryParams(_.extend({ offset: 0 }, params));
            params.limit = '0,' + Math.max(collection.length, this.LIMIT);
            this.loading = true;

            collection.expired = false;
            _.defer(process.bind(this), params, 'reload');
            return collection;
        };
    }

    function ignore(key) {
        return !this.ignore[key];
    }

    function map(key) {
        return key + '=' + this[key];
    }

    _.extend(CollectionLoader.prototype, {

        LIMIT: 30,

        cid: function (obj) {
            return _(obj || {}).chain()
                .keys()
                .filter(ignore, this)
                .map(map, obj)
                .value().sort().join('&') || 'default';
        },

        getDefaultCollection: function () {
            return this.pool.getDefault();
        },

        getCollection: function (params) {
            var cid = this.cid(params);
            return this.pool.get(cid);
        },

        before: function (/* offset, params, data */) {
        },

        each: function (/* obj, index, offset, params */) {
        },

        after: function (/* offset, params, data */) {
        },

        addIndex: function (offset, params, data) {
            this.before(offset, params, data);
            _(data).each(function (obj, index) {
                obj.index = offset + index;
                this.each(obj, index, offset, params);
            }, this);
            this.after(offset, params, data);
        },

        fetch: function (params) {

            var key = this.module + '/' + $.param(params) + '&session=' + ox.session,
                rampup = ox.rampup[key];

            if (rampup) {
                delete ox.rampup[key];
                return $.Deferred().resolve(rampup);
            }

            return http.GET({ module: this.module, params: params });
        },

        getQueryParams: function () {
            return {};
        },

        done: function () {
            this.loading = false;
        }
    });

    return CollectionLoader;
});
