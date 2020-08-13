/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2020 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Maik Schäfer <maik.schaefer@open-xchange.com>
 *
 */

/// <reference path="../../steps.d.ts" />

Feature('Switchboard > Zoom');

Before(async (users) => {

    await Promise.all([
        await users.create(),
        await users.create()
    ]);
});

After(async (users) => {
    await users.removeAll();
});

Scenario('User can connect zoom account through settings', (I, settings) => {

    I.login('app=io.ox/settings');
    settings.waitForApp();
    I.waitForText('Zoom Integration', 5, settings.locators.tree);
    I.click('Zoom Integration');
    I.waitForText('Connect with Zoom', 5, settings.locators.main);
    I.click('Connect with Zoom');
    I.waitForText('You have linked the following Zoom account', 10, settings.locators.main);
});

Scenario('User can connect zoom account through appointments', (I, calendar) => {

    I.login('app=io.ox/calendar');
    calendar.waitForApp();
    calendar.newAppointment();
    I.waitForText('Conference', 5, calendar.locators.edit);
    I.selectOption('conference-type', 'zoom');
    I.waitForText('Connect with Zoom');
    I.click('Connect with Zoom');
    I.waitForVisible('.fa.fa-video-camera');
    I.waitForText('Link', 5, '.conference-view.zoom');
    I.dontSee('Connect with Zoom');
});

Scenario('User can connect zoom account through addressbook', (I, users, contacts, dialogs) => {

    const [user1] = users;

    I.login('app=io.ox/contacts&folder=6', { user: user1 });
    I.waitForElement('.io-ox-contacts-window');
    I.waitForVisible('.io-ox-contacts-window .classic-toolbar');
    I.waitForVisible('.io-ox-contacts-window .tree-container');
    I.waitForText('Call', 5, '.switchboard-actions');
    I.click('Call');
    I.waitForText('Call via Zoom', 5, '.dropdown.open');
    I.click('Call via Zoom');
    dialogs.waitForVisible();
    I.waitForText('You first need to connect OX App Suite with Zoom.', 5, dialogs.locators.body);
    I.click('Connect with Zoom', dialogs.locators.footer);
    I.waitForText('Call', 5, dialogs.locators.footer);
    I.dontSee('You first need to connect OX App Suite with Zoom.');
    I.dontSee('Connect with Zoom');
});
