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
 * @author Christoph Hellweg <christoph.hellweg@open-xchange.com>
 */

define('io.ox/contacts/actions/invite', [
    'io.ox/contacts/api',
    'io.ox/calendar/util'
], function (api, calendarUtil) {

    'use strict';

    return function (list) {
        var def = null,
            distLists = [];

        function mapContact(obj) {
            if (obj.distribution_list && obj.distribution_list.length) {
                distLists.push(obj);
                return;
            } else if (obj.internal_userid || obj.user_id) {
                // internal user
                return { type: 1, user_id: obj.internal_userid || obj.user_id, display_name: obj.display_name, email1: obj.email1 };
            }
            // external user
            return { type: 5, display_name: obj.display_name, mail: obj.mail || obj.email1 || obj.email2 || obj.email3 };
        }

        function filterContact(obj) {
            return obj.type === 1 || !!obj.mail;
        }

        function filterForDistlists(list) {
            var cleaned = [];
            _(list).each(function (single) {
                if (!single.mark_as_distributionlist) {
                    cleaned.push(single);
                } else {
                    distLists = distLists.concat(single.distribution_list);
                }
            });
            return cleaned;
        }

        // check for anonymous contacts
        if (list.length === 1 && (list[0].id === 0 || list[0].folder_id === 0)) {
            var adress = list[0].email1 || list[0].email2 || list[0].email3;
            def = $.Deferred().resolve([{ type: 5, mail: adress }]);
        } else {

            def = api.getList(list, true, {
                check: function (obj) {
                    return obj.mark_as_distributionlist || obj.internal_userid || obj.email1 || obj.email2 || obj.email3;
                }
            })
            .then(function (list) {
                // set participants
                var participants = _.chain(filterForDistlists(list)).map(mapContact).flatten(true).filter(filterContact).value(),
                    externalParticipants = [];

                distLists = _.union(distLists);
                //remove external participants without contact or they break the request
                _(distLists).each(function (participant) {
                    if (!participant.id) {
                        externalParticipants.push(participant);
                    }
                });
                distLists = _.difference(distLists, externalParticipants);

                return api.getList(distLists)
                    .then(function (obj) {
                        var resolvedContacts = _.chain([].concat(obj, externalParticipants))
                            .map(mapContact)
                            .flatten(true)
                            .filter(filterContact)
                            .value();
                        return participants.concat(resolvedContacts);
                    });

            });
        }

        def.done(function (participants) {

            require(['io.ox/calendar/edit/main', 'settings!io.ox/calendar'], function (m, calendarSettings) {
                m.getApp().launch().done(function () {
                    var refDate = moment().startOf('hour').add(1, 'hours'),
                        attendees = [];
                    _.each(participants, function (user) {
                        attendees.push(calendarUtil.createAttendee(user));
                    });
                    this.create({
                        attendees: attendees,
                        folder_id: calendarSettings.get('chronos/defaultFolderId'),
                        startDate: { value: refDate.format('YYYYMMDD[T]HHmmss'), tzid: refDate.tz() },
                        endDate: { value: refDate.add(1, 'hours').format('YYYYMMDD[T]HHmmss'), tzid: refDate.tz() }
                    });
                });
            });
        });

    };

});
