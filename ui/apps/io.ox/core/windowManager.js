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
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */
define('io.ox/core/windowManager', [
], function () {
    'use strict';

    if (ox.windowManager) return true;

    console.log('loading windowManager');

    if (!window.name) {
        window.name = 'main';
    }

    var wins = [],
        makeParent = function () {
            console.log('this window is now the parent');
            require(['io.ox/core/sockets', 'io.ox/core/capabilities'], function (socket, capabilities) {
                // get connected socket
                socket.getSocket().done(function (socket) {
                    console.log('sockets connected', socket);
                    if (capabilities.has('webmail')) {
                        socket.on('ox:mail:new', function (data) {
                            console.log('new mail');
                            // simple event forwarding
                            _(ox.windowManager.windows).each(function (win) {
                                if (win.name === window.name) return;
                                win.ox.trigger('socket:mail:new', data);
                            });
                        });
                    }
                });
            });
        };

    if (window.opener) {
        wins = _(window.opener.ox.windowManager.windows).filter(function (win) {
            return win;
        });
    }
    ox.windowManager = {
        // add existing windows
        windows: wins,
        get: function (name) {
            return _(this.windows).findWhere({ name: name });
        },
        broadcastTo: function (data, id) {
            if (!data) return;
            if (!id) {
                _(this.windows).each(function (win) {
                    win.ox.trigger('broadcast', data, window.name);
                });
            }
            if (id && this.get(id)) {
                this.get(id).ox.trigger('broadcast', data, window.name);
            }
        },
        openAppInWindow: function (options) {
            options = options || {};
            options.name = options.name || 'app';
            var win = window.open(ox.root + '/', _.uniqueId(window.name + '_' + options.name + '_'), options.windowAttributes);
            return win;
        }
    };

    // add event listeners to own window
    $(window).on('unload', function () {
        _(ox.windowManager.windows).each(function (win) {
            if (win.name === window.name) return;
            win.ox.trigger('windowClosed', window);
        });
    });

    // add event listeners to ox object
    ox.on('windowClosed', function (win) {
        var prevIndex = ox.windowManager.windows.findIndex(function (obj) { return obj.name === window.name; });
        if (!ox.windowManager.get(win.name)) return;
        ox.windowManager.windows.splice(ox.windowManager.windows.findIndex(function (obj) { return obj.name === win.name; }), 1);
        // check if we need a new parent
        if (prevIndex !== 0 && ox.windowManager.windows[0].name === window.name) {
            makeParent();
        }
    });
    ox.on('windowOpened', function (win) {
        ox.windowManager.windows.push(win);
    });

    // trigger add event on other windows and add own window to collection
    _(ox.windowManager.windows).each(function (win) {
        win.ox.trigger('windowOpened', window);
    });
    ox.windowManager.windows.push(window);

    // check if this window is the parent window
    if (ox.windowManager.windows.length === 1) {
        makeParent();
    }

    ox.on('broadcast', function (data) {
        console.log(data);
    });

    return true;
});
