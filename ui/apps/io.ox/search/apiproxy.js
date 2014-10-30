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
 * @author Frank Paczynski <frank.paczynski@open-xchange.com>
 */

define('io.ox/search/apiproxy',[
    'io.ox/core/extensions',
    'gettext!io.ox/core',
    'io.ox/search/api',
    'io.ox/core/notifications'
], function (ext, gt, api, notifications) {

    'use strict';

    // use proxy as managing wrapper for the model matching autocompletes naming conventions
    var init = function (app) {

        /**
         * allows manipulating facet data returned by apis autocomplete action
         */
        var POINT = ext.point('io.ox/search/api/autocomplete');

        POINT.extend({
            id: 'exclusive',
            index: 100,
            customize: function (baton) {
                _.each(baton.data, function (facet) {
                    // handle 'exclusive' facets (use options as values also)
                    if (facet.style === 'exclusive' && !facet.values) {
                        facet.values = [];
                        _.each(facet.options, function (option) {
                            var value = _.extend({}, option, { options: facet.options });
                            delete value.filter;
                            facet.values.push(value);
                        });
                    }
                });
            }
        });

        POINT.extend({
            id: 'custom-facet-daterange',
            index: 200,
            customize: function (baton) {
                if (baton.args[0].params.module !== 'mail') return;

                // for mail only
                _.each(baton.data, function (facet) {
                    // hack to add custom timespan value
                    if (facet.id === 'date') {

                        // new id
                        facet.id = facet.id + '.custom';
                        var tmp = _.copy(facet.values[0]);

                        delete tmp.filter;
                        tmp.facet = facet.id;
                        tmp.name = gt('date range');
                        tmp.id = 'daterange';
                        tmp.point = 'daterange';
                        tmp.options = [];

                        delete facet.options;
                        facet.values = [tmp];
                    }
                });
            }
        });

        POINT.extend({
            id: 'only-once',
            index: 300,
            customize: function (baton) {

                if (_.device('smartphone')) return;

                var whitelist = {
                        style: ['simple'],
                        id: ['contacts', 'contact', 'participant', 'task_participants']
                    };

                // flag  facet
                _.each(baton.data, function (facet) {
                    var style = _.contains(whitelist.style, facet.style),
                        id = _.contains(whitelist.id, facet.id),
                        advanced = !(style || id);

                    // flag when not in whitelist
                    if (advanced) {
                        facet.flags.push('advanced');
                    } else if (style) {
                        facet.flags.push('highlander');
                    }
                });
            }
        });

        POINT.extend({
            id: 'folder',
            index: 350,
            customize: function (baton) {
                baton.data.push({
                    id: 'folder',
                    name: gt('Folder'),
                    style: 'custom',
                    custom: true,
                    hidden: true,
                    flags: [
                        _.device('smartphone') ? '' : 'advanced',
                        'conflicts:folder_type'
                    ],
                    values: [{
                        facet: 'folder',
                        id: 'custom',
                        custom: '',
                        filter: {}
                    }]
                });
            }
        });

        /**
         * success handler to pass data through extension point
         * @param  {[type]} data [description]
         * @return {deferred} returns available facets
         */
        function extend (args, data) {
            var baton = ext.Baton.ensure({ app: app, data: data.facets, args: args });
            POINT.invoke('customize', this, baton);
            return baton.data;
        }

        /**
         * calls api and pass the response through an extension point
         * @param {object} any number of objects that will be
         * @return {deferred} returns available facets
         * extended into one new options object
         */
        function autocomplete () {
            var args = [{}].concat(Array.prototype.slice.call(arguments)),
                opt = $.extend.apply(undefined, args);
            // call api
            return api.autocomplete(opt).then(extend.bind(this, args));
        }

        var model = app.getModel(),
            proxy = {
                // alias for autocomplete tk
                search: function (query, options) {
                    var standard = {
                            params: {
                                module: model.getModule()
                            },
                            data: {
                                prefix: query
                            }
                        };

                    return model.getFacets()
                            .then(function (facets) {
                                // extend standard options
                                standard.data.facets = facets;
                            })
                            .then(function () {
                                // call server
                                return autocomplete(standard, options);
                            })
                            .then(undefined, function (error) {
                                // fallback when app doesn't support search
                                if (error && error.code === 'SVL-0010') {
                                    var app = model.getApp();
                                    // add temporary mapping (default app)
                                    model.defaults.options.mapping[app] = model.defaults.options.defaultApp;
                                    return autocomplete(standard, options, { params: { module: model.getModule() } });
                                }
                                return error;
                            })
                            .then(function (data) {

                                var pool = model.get('pool'),
                                    hash = {};

                                _.each(data, function (facet) {
                                    hash[facet.id] = true;
                                });

                                // add
                                _.each(pool, function (facet) {
                                    if (!hash[facet.id])
                                        data.unshift(facet);
                                });
                                return data;
                            })
                            .then(function (data) {
                                // match convention in autocomplete tk
                                var data = {
                                    list: data,
                                    hits: 0
                                };
                                model.set({
                                    query: query,
                                    autocomplete: data.list
                                }, {
                                    silent: true
                                });
                                return data;
                            }, notifications.yell);
                },
                query: (function () {

                    function filterFacets(opt, view, facets) {
                        // extend options
                        view.trigger('query:running');
                        opt.data.facets = _.filter(facets, function (facet) {
                            // TODO: remove hack to ingore folder facet when empty
                            return !('value' in facet) || (facet.value !== 'custom');
                        });
                    }

                    function getResults(opt) {
                        // TODO: better solution needed
                        var folderOnly = !opt.data.facets.length || (opt.data.facets.length === 1 && opt.data.facets[0].facet === 'folder');
                        // call server
                        return folderOnly ? $.Deferred().resolve(undefined) : api.query(opt);
                    }

                    function enrich(opt, result) {
                        // add requst params to result
                        if (result) result.request = opt;
                        return result;
                    }

                    function drawResults(result) {
                        var start = Date.now();
                        if (result) {
                            model.setItems(result, start);
                            app.view.trigger('query:result', result);
                        }
                        app.view.trigger('query:stop');
                        return result;
                    }

                    function fail(result) {
                        notifications.yell(result);
                        app.view.trigger('query:stop');
                        app.view.trigger('query:fail');
                    }

                    return function (sync, params) {
                        var opt = {
                            params: _.extend({ module: model.getModule() }, params),

                            data: {
                                start: model.get('start'),
                                // workaround: more searchresults?
                                size: model.get('size') + model.get('extra')
                            }
                        };
                        app.view.trigger('query:start');
                        return model.getFacets()
                            .done(filterFacets.bind(this, opt, app.view))
                            .then(getResults.bind(this, opt))
                            .then(enrich.bind(this, opt))
                            .then(
                                // success
                                sync ? drawResults : _.lfo(drawResults),
                                // fail
                                sync ? fail : _.lfo(fail)
                            );
                    };
                }())
            };
        return proxy;
    };

    return {
        init: init
    };
});
