/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2018 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Julian Bäume <julian.baeume@open-xchange.com>
 */

define('io.ox/core/boot/rampup', [
    'io.ox/core/http',
    'io.ox/core/extensions'
], function (http, ext) {
    'use strict';

    ext.point('io.ox/core/boot/rampup').extend([{
        id: 'http_pause',
        fetch: function () {
            http.pause();
        }
    }, {
        id: 'compositionSpaces',
        fetch: function () {
            ox.rampup.compositionSpaces = $.when(
                http.GET({ module: 'mailcompose', params: { action: 'all' } }),
                require(['gettext!io.ox/mail'])
            ).then(function (data, gt) {
                var list = _(data).first() || [];
                return list.map(function (id) {
                    return {
                        //#. $1$s is the subject of an email
                        description: gt('Mail: %1$s', gt('No subject')),
                        floating: true,
                        id: id + Math.random().toString(16),
                        module: 'io.ox/mail/compose',
                        point: id,
                        timestamp: new Date().valueOf(),
                        ua: navigator.userAgent
                    };
                });
            });
        }
    }, {
        id: 'http_resume',
        fetch: function () {
            return http.resume();
        }
    }]);
});
