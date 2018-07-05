/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2016 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */

define('io.ox/mail/actions/ical', [
    'settings!io.ox/core',
    'settings!io.ox/calendar',
    'io.ox/core/notifications',
    'gettext!io.ox/mail'
], function (coreSettings, calendarSettings, notifications, gt) {

    'use strict';

    return function (baton) {
        var attachment = _.isArray(baton.data) ? _.first(baton.data) : baton.data;

        require(['io.ox/core/api/conversion']).done(function (conversionAPI) {
            conversionAPI.convert(
                {
                    identifier: 'com.openexchange.mail.ical',
                    args: [
                        { 'com.openexchange.mail.conversion.fullname': attachment.parent.folder_id },
                        { 'com.openexchange.mail.conversion.mailid': attachment.parent.id },
                        { 'com.openexchange.mail.conversion.sequenceid': attachment.id }
                    ]
                },
                {
                    identifier: 'com.openexchange.chronos.ical',
                    args: [
                        { 'com.openexchange.groupware.calendar.folder': calendarSettings.get('chronos/defaultFolderId') },
                        { 'com.openexchange.groupware.task.folder': coreSettings.get('folder/tasks') }
                    ]
                }
            )
            .done(function () {
                notifications.yell('success', gt('The appointment has been added to your calendar'));
            })
            .fail(notifications.yell);
        });
    };
});
