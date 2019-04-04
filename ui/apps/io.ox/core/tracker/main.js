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

define('io.ox/core/tracker/main', [
    'io.ox/core/tracker/api',
    'io.ox/core/tracker/duration',
    'settings!io.ox/core'
], function (api, duration, settings) {

    'use strict';

    // track browser and unique visit once on setup
    api.add('browser');
    api.add('unique', { id: ox.context_id + '/' + ox.user_id });

    if (settings.get('tracker/eyeballtime', true)) {
        duration.start();
    }
});
