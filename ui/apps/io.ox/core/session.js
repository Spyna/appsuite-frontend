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

define('io.ox/core/session', ['io.ox/core/http'], function (http) {

    'use strict';

    var set = function (data) {
        ox.session = data.session || '';
        ox.user = data.user; // might have a domain; depends on what the user entered on login
        ox.user_id = data.user_id || 0;
        ox.language = data.locale || 'en_US';
    };

    var that = {

        autoLogin: function () {
            // GET request
            return http.GET({
                module: 'login',
                appendColumns: false,
                appendSession: false,
                processResponse: false,
                timeout: 3000, // just try that for 3 secs
                params: {
                    action: 'autologin',
                    client: 'com.openexchange.ox.gui.dhtml'
                }
            })
            .done(set);
        },

        login: (function () {

            var pending = null;

            return function (username, password, store) {

                var def = $.Deferred();

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
                        http.POST({
                            module: 'login',
                            appendColumns: false,
                            appendSession: false,
                            processResponse: false,
                            params: {
                                action: 'login',
                                name: username,
                                password: password
                            }
                        })
                        .done(function (data) {
                            // store session
                            set(data);
                            // set permanent cookie
                            if (store) {
                                that.store().done(function () {
                                    def.resolve(data);
                                }).fail(def.reject);
                            } else {
                                def.resolve(data);
                            }
                        })
                        .fail(def.reject);
                    }
                } else {
                    // offline
                    set({ session: 'offline', user: username });
                    def.resolve({ session: ox.session, user: ox.user });
                }

                return def;
            };
        }()),

        store: function () {
            // GET request
            return http.GET({
                module: 'login',
                appendColumns: false,
                processResponse: false,
                params: {
                    action: 'store'
                }
            });
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
        }
    };

    return that;
});
