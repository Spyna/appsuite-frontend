/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2019 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 */

/// <reference path="../../../../steps.d.ts" />
const moment = require('moment');
const crypto = require('crypto');
const util = require('util');
const fs = require('fs');

Feature('Settings > Calendar > Notifications');

Before(async function (users) {
    await users.create();
});

After(async function (users) {
    await users.removeAll();
});

Scenario('[C7873] Configure incoming invitation mails to be deleted after accepting or declining', async function (I, users) {

    // Helper to generate invitation mails
    var eventGenerator = {
        // Creates the .eml source for an invitation mail
        // Options are:
        // * recipient: List of [display_name, email_address]
        // * day: Moment object of the day the appointment should occur
        // * title: Title of the appointment
        createICalEML(options) {
            return `From: "Fake McOrganiser" <organiser@eris.invalid>
To: "${options.recipient[0]}" <${options.recipient[1]}>
Subject: ${options.title}
MIME-Version: 1.0
Content-Type: multipart/mixed; 
    boundary="----=_Part_129_1662523581.1554810431933"

------=_Part_129_1662523581.1554810431933
Content-Type: multipart/alternative; 
    boundary="----=_Part_130_1152172383.1554810431977"

------=_Part_130_1152172383.1554810431977
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: quoted-printable

Ereigniskarte!

------=_Part_130_1152172383.1554810431977
Content-Type: text/calendar; charset=UTF-8; method=REQUEST
Content-Transfer-Encoding: 7bit

BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Open-Xchange//7.10.2-Rev1//EN
METHOD:REQUEST
BEGIN:VEVENT
DTSTAMP:${options.day.format('YYYYMMDD')}T085304Z
ATTENDEE;CN="${options.recipient[0]}";PARTSTAT=NEEDS-ACTION;CUTYPE=INDIVIDUAL;EMAIL=${options.recipient[1]}:mailto:${options.recipient[1]}
ATTENDEE;CN="Fake McOrganiser";PARTSTAT=ACCEPTED;CUTYPE=INDIVIDUAL;EMAIL=organiser@eris.invalid:mailto:organiser@eris.invalid
CLASS:PUBLIC
CREATED:${options.day.format('YYYYMMDD')}T085304Z
DESCRIPTION:Come! Come!
DTSTART;VALUE=DATE:${options.day.format('YYYYMMDD')}
DTEND;VALUE=DATE:${options.day.add(1, 'days').format('YYYYMMDD')}
LAST-MODIFIED:${options.day.format('YYYYMMDD')}T085304Z
LOCATION:Location
ORGANIZER;CN="Fake McOrganiser":mailto:organiser@eris.invalid
SEQUENCE:0
SUMMARY:${options.title}
TRANSP:OPAQUE
UID:ea1300a8-af19-4622-bc8f-d030a06db0fe
X-MICROSOFT-CDO-ALLDAYEVENT:TRUE
X-MICROSOFT-CDO-BUSYSTATUS:BUSY
END:VEVENT
END:VCALENDAR

------=_Part_130_1152172383.1554810431977--

------=_Part_129_1662523581.1554810431933
Content-Type: text/plain;
Content-Disposition: attachment; filename=invite.ics

Test

------=_Part_129_1662523581.1554810431933--
            `;
        },
        // Creates a .eml file. Options same as #createICalEML plus:
        // * filename - Where to save the file
        async generateInvitationEMLFile(options) {
            const fs_writeFile = util.promisify(fs.writeFile);
            return fs_writeFile(options.filename, this.createICalEML(options));
        }
    };

    let [user] = users;
    // We need two calendar invitation mails
    // We'll just add them with the helper, so we don't have to wait for the pooling
    const recipient = [user.get('display_name'), user.get('primaryEmail')];

    // Generate first invitation mail
    const eml1 = '/tmp/' + crypto.randomBytes(16).toString('hex') + '.eml';
    await eventGenerator.generateInvitationEMLFile({ filename: eml1, title: 'Erisian Dialectic Bath Supplies n Grill', day: moment().add(5, 'days'), recipient:  recipient });

    // Generate second invitation mail
    const eml2 = '/tmp/' + crypto.randomBytes(16).toString('hex') + '.eml';
    await eventGenerator.generateInvitationEMLFile({ filename: eml2, title: 'Grand Cabal of the Golden Bananabread Beaking Day', day: moment().add(23, 'days'), recipient:  recipient });

    // Import both mails
    await I.haveMail({ folder: 'default0/INBOX', path: eml1 });
    await I.haveMail({ folder: 'default0/INBOX', path: eml2 });

    await I.haveSetting('io.ox/calendar//deleteInvitationMailAfterAction', true);
    // Accept the appointment

    I.login('app=io.ox/mail');
    I.waitForElement(locate('li.list-item').withText('Erisian Dialectic'));
    I.click(locate('li.list-item').withText('Erisian Dialectic'));
    I.waitForElement(locate('.btn.accept').inside('.itip-actions'));
    I.click(locate('.btn.accept').inside('.itip-actions'));

    // Verify the email was deleted
    I.wait(2);
    I.dontSee('Erisian Dialectic');

    // Change the setting
    I.click('[title=Settings]');
    I.waitForVisible('#topbar-settings-dropdown');
    I.click('Settings');

    I.waitForElement(locate('.folder[aria-label=Calendar]'));
    I.click(locate('.folder[aria-label=Calendar]'));
    I.waitForElement(locate('div.checkbox').withDescendant('input[name=deleteInvitationMailAfterAction]'));
    I.click(locate('div.checkbox').withDescendant('input[name=deleteInvitationMailAfterAction]'));
    // Accept the second appointment
    I.openApp('Mail');
    I.waitForVisible(locate('li.list-item').withText('Grand Cabal'));
    I.click(locate('li.list-item').withText('Grand Cabal'));
    I.waitForElement(locate('.btn.accept').inside('.itip-actions'));
    I.click(locate('.btn.accept').inside('.itip-actions'));

    // Verify the mail hasn't been deleted
    I.wait(2);
    I.see('Grand Cabal');

});
