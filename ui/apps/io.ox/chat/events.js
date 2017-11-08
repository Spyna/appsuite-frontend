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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/chat/events', [], function () {

    'use strict';

    // simple event aggregator
    var events = _.extend({}, Backbone.Events);

    // forward local command clicks into event hub
    $(document).on('click', '.ox-chat [data-cmd]', function (e) {
        e.preventDefault();
        var node = $(e.currentTarget), data = node.data();
        if (ox.debug) console.log('cmd', data.cmd, data);
        events.trigger('cmd cmd:' + data.cmd, data);
    });

    return events;
});
