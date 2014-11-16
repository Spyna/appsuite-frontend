/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2012 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define('io.ox/calendar/settings/defaults', function () {

    'use strict';

    var settingsDefaults = {
        interval: 30,
        startTime: 8,
        endTime: 18,
        defaultReminder: 15,
        viewView: 'week:workweek',
        showDeclinedAppointments: true,
        markFulltimeAppointmentsAsFree: false,
        notifyNewModifiedDeleted: true,
        notifyAcceptedDeclinedAsCreator: false,
        notifyAcceptedDeclinedAsParticipant: false,
        deleteInvitationMailAfterAction: true
    };

    return settingsDefaults;
});
