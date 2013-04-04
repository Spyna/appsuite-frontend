/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2012 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 */

define('io.ox/core/cache/simple', ["io.ox/core/extensions"], function (ext) {

    'use strict';

    var storage = {},
        instances = {};

    function SimpleStorage(id) {
        storage[id] = {};
        _.extend(this, {
            clear: function () {
                storage[id] = {};
                return $.Deferred().resolve();
            },
            get: function (key) {
                var key = String(key);
                return $.Deferred().resolve(
                    key in storage[id] ? JSON.parse(storage[id][key]) : null
                );
            },
            set: function (key, data) {
                // use stringify to work with copies
                storage[id][String(key)] = JSON.stringify(data);
                return $.Deferred().resolve(key);
            },
            remove: function (key) {
                delete storage[id][String(key)];
                return $.Deferred().resolve();
            },
            keys: function () {
                var key, tmp = [];
                for (key in storage[id]) {
                    tmp.push(key);
                }
                return $.Deferred().resolve(tmp);
            }
        });
    }

    var that = {
        id: 'simple',
        index: 1000,
        getInstance: function (theId) {
            if (!instances[theId]) {
                return instances[theId] = new SimpleStorage(theId);
            }
            return instances[theId];
        },
        getStorageLayerName: function () {
            return 'cache/simple';
        },
        isUsable: function () {
            return true;
        },
        gc: function () {
        },
        clear: function () {
            storage = {};
            instances = {};
        }
    };

    ext.point("io.ox/core/cache/storage").extend(that);

    return that;
});
