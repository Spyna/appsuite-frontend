/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2018 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Björn Köster <bjoern.koester@open-xchange.com>
 */

const expect = require('chai').expect;
const moment = require('moment');

Feature('Calendar');

Before(async function (users) {
    await users.create();
});

After(async function (users) {
    await users.removeAll();
});

Scenario('Create appointment and check if the color is correctly applied and removed ', async function (I, users, calendar) {
    await I.haveSetting({
        'io.ox/core': { autoOpenNotification: false, showDesktopNotifications: false },
        'io.ox/calendar': { showCheckboxes: true }
    });
    const folder = `cal://0/${await I.grabDefaultFolder('calendar')}`;
    const time = moment().startOf('week').add(1, 'day').add(16, 'hours');
    const format = 'YYYYMMDD[T]HHmmss';
    await I.haveAppointment({
        folder: folder,
        summary: 'test appointment one',
        startDate: { value: time.format(format), tzid: 'Europe/Berlin' },
        endDate: { value: time.add(1, 'hour').format(format), tzid: 'Europe/Berlin' }
    });

    I.login('app=io.ox/calendar&perspective="week:workweek"');
    calendar.waitForApp();
    I.waitForText('test appointment one', 5, '.workweek');
    I.see('test appointment one', '.workweek .appointment .title');

    I.seeNumberOfElements('.workweek .appointment .title', 1);

    I.say('Get colors #1');
    // get folder color
    const [folderColor] = await I.grabCssPropertyFrom('li.selected[aria-label^="' + users[0].userdata.sur_name + ', ' + users[0].userdata.given_name + '"] .color-label', 'background-color');
    // get appointment color
    let [appointmentColor] = await I.grabCssPropertyFrom('.workweek .appointment', 'background-color');
    // check if the color is the same

    expect(folderColor).equal(appointmentColor);

    I.say('Change color');
    I.click('test appointment one', '.workweek .appointment .title');
    I.waitForVisible('.io-ox-sidepopup [data-action="io.ox/calendar/detail/actions/edit"]');
    I.click('Edit', '.io-ox-sidepopup');
    I.waitForVisible('.io-ox-calendar-edit-window');
    I.retry(5).click('Appointment color', '.color-picker-dropdown');
    I.click('dark red');
    I.click('Save', '.io-ox-calendar-edit-window');
    I.waitForDetached('.io-ox-calendar-edit-window', 5);

    I.say('Get colors #2');
    // get appointment color
    [appointmentColor] = await I.grabCssPropertyFrom('.workweek .appointment', 'background-color');
    // check if the color is the same
    expect(folderColor).not.equal(appointmentColor);
    // the color might differ if the appointment has .hover class which is not predictable
    expect(appointmentColor).be.oneOf(['rgb(181, 54, 54)', 'rgb(200, 70, 70)']);

    I.say('Change color back to folder color');
    I.click('test appointment one', '.workweek .appointment .title');
    I.waitForText('Edit', 5, '.io-ox-sidepopup');
    I.click('Edit', '.io-ox-sidepopup');
    I.waitForVisible('.io-ox-calendar-edit-window');
    I.retry(5).click('Appointment color', '.color-picker-dropdown');
    I.click('Use calendar color');
    I.click('Save', '.io-ox-calendar-edit-window');
    I.waitForDetached('.io-ox-calendar-edit-window', 5);

    I.say('Get colors #3');
    // get appointment color
    [appointmentColor] = await I.grabCssPropertyFrom('.workweek .appointment', 'background-color');
    // check if the color is the same
    expect(folderColor).equal(appointmentColor);
    expect(appointmentColor).not.to.be.oneOf(['rgb(181, 54, 54, 1)', 'rgb(200, 70, 70, 1)']);

});

// TODO reenable this, as soon as the grabCSSPropertyFrom is fixed in codecept. See https://github.com/Codeception/CodeceptJS/pull/2059
Scenario('Changing calendar color should change appointment color that uses calendar color ', async function (I, users, calendar) {
    await I.haveSetting({
        'io.ox/core': { autoOpenNotification: false, showDesktopNotifications: false },
        'io.ox/calendar': { showCheckboxes: true }
    });
    const folder = `cal://0/${await I.grabDefaultFolder('calendar')}`;
    const time = moment().startOf('week').add(1, 'day').add(16, 'hours');
    const format = 'YYYYMMDD[T]HHmmss';
    await I.haveAppointment({
        folder: folder,
        summary: 'test appointment one',
        startDate: { value: time.format(format), tzid: 'Europe/Berlin' },
        endDate: { value: time.add(1, 'hour').format(format), tzid: 'Europe/Berlin' }
    });
    await I.haveAppointment({
        folder: folder,
        summary: 'test appointment two',
        startDate: { value: time.format(format), tzid: 'Europe/Berlin' },
        endDate: { value: time.add(1, 'hour').format(format), tzid: 'Europe/Berlin' }
    });

    I.login('app=io.ox/calendar&perspective="week:workweek"');
    calendar.waitForApp();

    I.say('Check colors');
    I.see('test appointment one', '.workweek .appointment .title');
    I.see('test appointment two', '.workweek .appointment .title');
    I.seeNumberOfElements('.workweek .appointment .title', 2);

    I.say('Change color of first appointment');
    I.click('test appointment one', '.workweek .appointment .title');
    I.waitForVisible('.io-ox-sidepopup [data-action="io.ox/calendar/detail/actions/edit"]');
    I.click('Edit', '.io-ox-sidepopup');
    I.waitForVisible('.io-ox-calendar-edit-window');
    I.retry(5).click('Appointment color', '.color-picker-dropdown');
    const [darkRed] = await I.grabCssPropertyFrom({ css: 'a[title="dark red"] > i' }, 'background-color');
    I.click('dark red');
    I.click('Save', '.io-ox-calendar-edit-window');
    I.waitForDetached('.io-ox-calendar-edit-window', 5);

    I.say('Change calendar color to dark green');
    I.click('.folder-options');
    I.waitForVisible('.io-ox-calendar-color-picker-container a[title="dark green"]');
    const [darkGreen] = await I.grabCssPropertyFrom({ css: 'a[title="dark green"] > i' }, 'background-color');
    I.say(darkGreen);
    I.click('dark green');
    I.waitForDetached('.dropdown.open');
    I.waitForText('test appointment one', 5, '.workweek');

    I.say('Check correctly applied colors');
    I.wait(0.2);
    // get folder color
    const [folderColor] = await I.grabCssPropertyFrom({ css: 'li.selected[aria-label^="' + users[0].userdata.sur_name + ', ' + users[0].userdata.given_name + '"] .color-label' }, 'background-color');
    // get appointment colors
    const [appointmentOneColor] = await I.grabCssPropertyFrom('.workweek .appointment[aria-label*="test appointment one"]', 'background-color');
    const [appointmentTwoColor] = await I.grabCssPropertyFrom('.workweek .appointment[aria-label*="test appointment two"]', 'background-color');
    I.say(appointmentTwoColor);
    expect(folderColor, 'folderColor equals darkGreen').equal(darkGreen);
    expect(appointmentOneColor, 'appointment one color equals darkRed').equal(darkRed);
    expect(appointmentTwoColor, 'appointment two color equals darkGreen').be.oneOf([darkGreen, 'rgb(49, 93, 34)']);
});
