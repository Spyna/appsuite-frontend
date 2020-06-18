/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2019 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Maik Schäfer <maik.schaefer@open-xchange.com>
 *
 */

/// <reference path="../../steps.d.ts" />

const expect = require('chai').expect;

Feature('Calendar > Create');

Before(async (users) => {
    await users.create();
    await users.create();
});

After(async (users) => {
    await users.removeAll();
});

//helper function for creating appointments, added ability to select color
const createAppointment = ({ subject, folder, startTime, color }) => {
    const { I } = inject();
    // select calendar
    I.clickToolbar('New appointment');
    I.waitForText('Appointments in public calendar');
    I.click('Create in public calendar');
    I.waitForVisible('.io-ox-calendar-edit-window');
    I.retry(5).fillField('Subject', subject);
    I.see(folder, '.io-ox-calendar-edit-window .folder-selection');
    if (startTime) {
        I.retry(3).click('~Start time');
        I.retry(3).click(startTime);
    }
    if (color) {
        I.click('Appointment color', '.color-picker-dropdown');
        I.waitForElement('.color-picker-dropdown.open');
        I.click(locate('a').inside('.color-picker-dropdown.open').withAttr({ title: color }));
    }

    // save
    I.click('Create', '.io-ox-calendar-edit-window');
    I.waitForDetached('.io-ox-calendar-edit-window', 5);
};

Scenario('[C264519] Create appointments with colors in public folder', async function (I, users, calendar, dialogs) {
    const folderLocator = locate({ css: 'div.folder-node' }).withAttr({ title: 'New calendar' });
    const selectInsideFolder = (node) => locate(node).inside(folderLocator);

    I.login('app=io.ox/calendar');
    calendar.waitForApp();

    I.say('Create public calendar');
    I.waitForText('Add new calendar', 5, '.folder-tree');
    I.click('Add new calendar', '.folder-tree');

    I.clickDropdown('Personal calendar');

    dialogs.waitForVisible();
    I.waitForText('Add as public calendar', 5, dialogs.locators.body);
    I.checkOption('Add as public calendar', dialogs.locators.body);
    dialogs.clickButton('Add');
    I.waitForDetached('.modal-dialog');

    I.say('Grant permission to user b');
    I.click('.folder-node .folder-arrow .fa.fa-caret-right');
    I.selectFolder('New calendar');
    I.retry(3).click(selectInsideFolder({ css: 'a.folder-options' }));

    I.clickDropdown('Permissions / Invite people');
    dialogs.waitForVisible();
    I.waitForElement('.form-control.tt-input', 5, dialogs.locators.header);
    I.fillField('.form-control.tt-input', users[1].get('primaryEmail'));
    I.pressKey('Enter');
    dialogs.clickButton('Save');
    I.waitForDetached('.modal-dialog');

    I.say('create 2 test appointments with different colors');
    createAppointment({ subject: 'testing is fun', folder: 'New calendar', startTime: '8:00 AM', color: 'dark green' });
    createAppointment({ subject: 'testing is awesome', folder: 'New calendar', startTime: '10:00 AM', color: 'dark cyan' });
    I.logout();

    I.say('Login user b');
    I.waitForVisible('#io-ox-login-screen');
    I.login('app=io.ox/calendar', { user: users[1] });
    calendar.waitForApp();

    I.waitForVisible('.folder-node .folder-arrow .fa.fa-caret-right');
    I.click('.folder-node .folder-arrow .fa.fa-caret-right');
    I.selectFolder('New calendar');
    I.retry(3).click(selectInsideFolder({ css: 'div.color-label' }));
    //check if public appointments are there
    I.see('testing is fun', '.workweek .appointment');
    I.see('testing is awesome', '.workweek .appointment');
    //see if appointment colors still drawn with customized color (See Bug 65410)
    const appointmentColors = (await I.grabCssPropertyFrom('.workweek .appointment', 'backgroundColor'))
        // webdriver resolves with rgba, puppeteer with rgb for some reason
        .map(c => c.indexOf('rgba') === 0 ? c : c.replace('rgb', 'rgba').replace(')', ', 1)'));
    expect(appointmentColors).to.deep.equal(['rgba(55, 107, 39, 1)', 'rgba(57, 109, 123, 1)']);
});
