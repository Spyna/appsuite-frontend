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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/session',
    ['io.ox/core/http',
     'io.ox/core/manifests'
    ], function (http, manifests) {

    'use strict';

    var TIMEOUTS = { AUTOLOGIN: 5000, LOGIN: 10000 };

    var getBrowserLanguage = function () {
        var language = (navigator.language || navigator.userLanguage).substr(0, 2),
            languages = ox.serverConfig.languages || {};
        return _.chain(languages).keys().find(function (id) {
                return id.substr(0, 2) === language;
            }).value();
    };

    var check = function (language) {
        var languages = ox.serverConfig.languages || {};
        return language in languages ? language : false;
    };

    var set = function (data, language) {
        if ('session' in data) ox.session = data.session || '';
        if ('user' in data) ox.user = data.user || ''; // might have a domain; depends on what the user entered on login
        if ('user_id' in data) ox.user_id = data.user_id || 0;
        if ('context_id' in data) ox.context_id = data.context_id || 0;
        // if the user has set the language on the login page, use this language instead of server settings lang
        ox.language = language || check(data.locale) || check(getBrowserLanguage()) || 'en_US';
        manifests.reset();
        $('html').attr('lang', ox.language.split('_')[0]);
        // should not hide store() request here; made debugging hard
        ox.trigger('change:session', ox.session);
    };

    var that = {

        set: set,

        autoLogin: function () {
            var store = false;
            // GET request
            return http.GET({
                module: 'login',
                appendColumns: false,
                appendSession: false,
                processResponse: false,
                timeout: TIMEOUTS.AUTOLOGIN,
                params: {
                    action: 'autologin',
                    client: that.client(),
                    rampup: true,
                    rampUp: true, // remove after backend fix
                    version: that.version()
                }
            })
            // If autologin fails, try the token login
            .then(
                function (data) {
                    ox.secretCookie = true;
                    ox.rampup = data.rampUp || data.rampup || ox.rampup || {};
                    return data;
                },
                function (data) {
                    if (!_.url.hash('serverToken')) return data || {};
                    return http.POST({
                        module: 'login',
                        jsessionid: _.url.hash('jsessionid'),
                        appendColumns: false,
                        appendSession: false,
                        processResponse: false,
                        timeout: TIMEOUTS.AUTOLOGIN,
                        params: {
                            action: 'tokens',
                            client: that.client(),
                            version: that.version(),
                            serverToken: _.url.hash('serverToken'),
                            clientToken: _.url.hash('clientToken')
                        }
                    })
                    .then(function (response) {
                        return response.data;
                    });
                }
            )
            .done(function () {
                store = _.url.hash('store');
                _.url.hash({
                    jsessionid: null,
                    serverToken: null,
                    clientToken: null,
                    store: null
                });
            })
            .done(function (data) {
                set(data);
                // no "store" request here; just auto-login
            });
        },

        login: (function () {

            var pending = null;

            return function (username, password, store, language, forceLanguage) {

                var def = $.Deferred(), multiple = [];

                // online?
                if (ox.online) {
                    // pending?
                    if (pending !== null) {
                        return pending;
                    } else {
                        // mark as pending
                        pending = def.always(function () {
                            pending = null;
                        });
                        // POST request
                        if (forceLanguage) {
                            multiple.push({
                                module: 'jslob',
                                action: 'update',
                                id: 'io.ox/core',
                                data: {
                                    // permanent language change
                                    language: forceLanguage
                                }
                            });
                        }
                        http.POST({
                            module: 'login',
                            appendColumns: false,
                            appendSession: false,
                            processResponse: false,
                            params: {
                                action: 'login',
                                name: username,
                                password: password,
                                // current browser language; required for proper error messages
                                language: language || 'en_US',
                                client: that.client(),
                                version: that.version(),
                                timeout: TIMEOUTS.LOGIN,
                                multiple: JSON.stringify(multiple)
                            }
                        })
                        .done(function (data) {
                            // copy rampup data
                            ox.rampup = data.rampUp || ox.rampup || {};
                            // store session
                            // we pass forceLanguage (might be undefined); fallback is data.locale
                            set(data, forceLanguage);
                            if (store) {
                                that.store().done(function () { def.resolve(data); });
                            } else {
                                def.resolve(data);
                            }
                        })
                        .fail(function (response) {
                            if (console && console.error) {
                                console.error('Login failed!', response.error, response.error_desc || '');
                            }
                            def.reject(response);
                        });
                    }
                } else {
                    // offline
                    set({ session: 'offline', user: username }, language);
                    def.resolve({ session: ox.session, user: ox.user });
                }
                return def;
            };
        }()),

        rampup: function () {
            return http.GET({
                module: 'login',
                params: {
                    action: 'rampUp',
                    rampup: true,
                    rampUp: true // remove after backend fix
                },
                appendColumns: false,
                processResponse: false
            })
            .then(function (data) {
                return (ox.rampup = data.rampUp || data.rampup || ox.rampup || {});
            });
        },

        store: function () {
            var def = $.Deferred();
            // change from GET to POST request, cause firefox has a
            // problem otherwise if caches are empty
            http.POST({
                module: 'login',
                appendColumns: false,
                processResponse: false,
                params: { action: 'store' }
            })
            // makes store() always successful (should never block)
            .always(def.resolve);
            return def;
        },

        logout: function () {
            if (ox.online) {
                // POST request
                return http.POST({
                    module: 'login',
                    appendColumns: false,
                    processResponse: false,
                    params: {
                        action: 'logout'
                    }
                });
            } else {
                return $.Deferred().resolve();
            }
        },

        client: function () {
            return 'open-xchange-appsuite';
        },

        version: function () {
            // need to work with ox.version since we don't have the server config for auto-login
            return String(ox.version).split('.').slice(0, 3).join('.');
        }
    };

    return that;
});
