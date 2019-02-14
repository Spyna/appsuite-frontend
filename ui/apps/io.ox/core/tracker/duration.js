/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2019 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

define('io.ox/core/tracker/duration', [
    'io.ox/core/tracker/api',
    'settings!io.ox/core'
], function (api, settings) {

    'use strict';

    var interval = 1000,
        trackInterval = settings.get('tracker/eyeballInterval', 1) || 1,
        temp = {},
        counts = {},
        i;

    function getApp() {
        return ox.ui.App.getCurrentApp().get('name');
    }

    function send(app, duration) {
        api.add('duration', { eyeballs: duration, app: app });
    }

    function track() {
        if (document.visibilityState === 'hidden') return;

        var app = getApp();
        // counting seconds
        temp[app] = (!!temp[app]) ? temp[app] + 1 : 1;

        // only track full minutes
        if (temp[app] % (60 * trackInterval) === 0) {
            counts[app] = (!!counts[app]) ? counts[app] + 1 : 1;
            send(app, counts[app]);
        }
    }

    function getCount() {
        return counts;
    }

    function start() {
        if (i) return i;
        i = setInterval(track, interval);
        return i;
    }

    function stop() {
        clearInterval(i);
    }

    return {
        start: start,
        stop: stop,
        getCount: getCount
    };
});
