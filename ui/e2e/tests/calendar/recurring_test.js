/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2018 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Christoph Kopp <chrsitoph.kopp@open-xchange.com>
 */

Feature('Calendar: Create appointment');

Before(async function (users) {
    await users.create();
    await users.create();
});

After(async function (users) {
    await users.removeAll();
});

Scenario('Create recurring appointments with one participant', async function (I, users) {
    I.haveSetting('io.ox/core//autoOpenNotification', false);
    I.haveSetting('io.ox/core//showDesktopNotifications', false);
    I.haveSetting('io.ox/calendar//showCheckboxes', true);

    I.login('app=io.ox/calendar');
    I.waitForVisible('[data-app-name="io.ox/calendar"]', 5);

    // create in Day view
    I.selectFolder('Calendar');
    I.clickToolbar('View');
    I.click('List');
    I.clickToolbar('New');
    I.waitForVisible('.io-ox-calendar-edit-window');

    I.fillField('Subject', 'test recurring');
    I.fillField('Location', 'invite location');

    const { start, isNextMonth } = await I.executeAsyncScript(function (done) {
        done({
            start: `.date-picker[data-attribute="startDate"] .date[id$="_${moment().startOf('week').add('8', 'day').format('l')}"]`,
            isNextMonth: moment().month() !== moment().add('8', 'days').month()
        });
    });

    I.click('~Date (M/D/YYYY)');
    if (isNextMonth) I.click('~Go to next month', '.date-picker.open');
    I.click(start);

    I.click('~Start time');
    I.click('4:00 PM');

    I.click('Repeat', '.io-ox-calendar-edit-window');
    I.click('.btn.btn-link.summary');

    I.waitForElement('.modal-dialog');

    I.click('.modal-dialog [name="recurrence_type"]');
    I.selectOption('.modal-dialog [name="recurrence_type"]', 'Daily');

    I.selectOption('.modal-dialog [name="until change:occurrences"]', 'After a number of occurrences');

    I.waitForElement('.modal-dialog [name="occurrences"]');
    I.fillField('[name="occurrences"]', '5');

    I.click('Apply', '.modal-dialog');
    I.click('Apply', '.modal-dialog');

    I.waitForDetached('.modal-dialog');

    // add user 1
    I.fillField('input.add-participant.tt-input', users[1].userdata.primaryEmail);
    I.pressKey('Enter');
    // save
    I.click('Create', '.io-ox-calendar-edit-window');

    I.waitForDetached('.io-ox-calendar-edit-window', 5);

    // check in list view
    I.clickToolbar('View');
    I.click('List');

    I.see('test recurring', '.list-view .appointment .title');

    I.seeNumberOfElements('.list-view .appointment .title', 5);

    I.logout();

    // reset settings
    I.haveSetting('io.ox/core//autoOpenNotification', true);
    I.haveSetting('io.ox/core//showDesktopNotifications', false);
    I.haveSetting('io.ox/calendar//showCheckboxes', false);

    // user 1
    I.haveSetting('io.ox/core//autoOpenNotification', false, { user: users[1] });
    I.haveSetting('io.ox/core//showDesktopNotifications', false, { user: users[1] });
    I.haveSetting('io.ox/calendar//showCheckboxes', true, { user: users[1] });

    // login new user1 for accept
    I.login('app=io.ox/calendar', { user: users[1] });
    I.waitForVisible('[data-app-name="io.ox/calendar"]', 5);

    I.selectFolder('Calendar');

    I.clickToolbar('View');
    I.click('List');

    I.see('test recurring', '.list-view .appointment .title');
    I.seeNumberOfElements('.list-view .appointment .title', 5);

    I.click('test recurring', '.list-view .list-item .title');

    I.waitForDetached('.rightside .multi-selection-message');
    I.see('test recurring', '.rightside');
    I.see('invite location', '.rightside');

    I.waitForVisible('[data-action="changestatus"]');

    I.click('Status');

    I.waitForElement('.modal-dialog');
    I.click('Series', '.modal-dialog');
    I.click('Accept', '.modal-dialog');

    I.waitForDetached('.modal-dialog', 5);

    I.waitForElement('.rightside .participant a.accepted[title="' + users[1].userdata.primaryEmail + '"]');

    I.logout();

    // login owner
    I.login('app=io.ox/calendar');
    I.waitForVisible('[data-app-name="io.ox/calendar"]', 5);

    I.selectFolder('Calendar');
    I.clickToolbar('View');
    I.click('List');

    // check in list view
    I.clickToolbar('View');
    I.click('List');

    I.see('test recurring', '.list-view .appointment:nth-child(5) .title');

    I.click('test recurring', '.list-view .list-item:nth-child(5) .title');

    // owner
    I.waitForElement('.rightside .participant a.accepted[title="' + users[0].userdata.primaryEmail + '"]');
    // accepted
    I.waitForElement('.rightside .participant a.accepted[title="' + users[1].userdata.primaryEmail + '"]');

    // edit
    I.waitForVisible('[data-action="edit"]');
    I.click('[data-action="edit"]');
    I.waitForVisible('.io-ox-dialog-popup');
    I.click('Cancel', '.io-ox-dialog-popup');

    I.click('[data-action="edit"]');
    I.waitForVisible('.io-ox-dialog-popup');
    I.click('All future appointments', '.io-ox-dialog-popup');

    I.waitForVisible('.io-ox-calendar-edit-window');

    I.fillField('Subject', 'test recurring edit');
    I.fillField('Location', 'invite location edit');
    I.click('Save', '.io-ox-calendar-edit-window');

    // check in list view
    I.clickToolbar('View');
    I.click('List');

    I.see('test recurring edit', '.list-view .appointment .title');

    I.seeNumberOfElements('.list-view .appointment .title', 5);

    // edit
    I.see('test recurring edit', '.list-view .appointment .title');

    I.click({ xpath: '//div[text()="test recurring edit"]' });

    I.waitForVisible('[data-action="edit"]');
    I.click('[data-action="edit"]');

    I.waitForVisible('.io-ox-dialog-popup');
    I.click('This appointment', '.io-ox-dialog-popup');

    I.waitForVisible('.io-ox-calendar-edit-window');

    I.fillField('Subject', 'test recurring edit new');
    I.click('Save', '.io-ox-calendar-edit-window');
    I.waitForDetached('.io-ox-calendar-edit-window');

    I.seeNumberOfElements('//div[contains(concat(" ", @class, " "), "list-view-control")]//div[@class="title" and text()="test recurring edit new"]', 1);
    I.click('//div[contains(concat(" ", @class, " "), "list-view-control")]//div[@class="title" and text()="test recurring edit new"]');

    //edit exeption
    I.waitForVisible('[data-action="edit"]');
    I.click('[data-action="edit"]');

    I.waitForVisible('.io-ox-dialog-popup');
    I.click('This appointment', '.io-ox-dialog-popup');

    I.waitForVisible('.io-ox-calendar-edit-window');

    I.fillField('Subject', 'test recurring edit new edit');
    I.click('Save', '.io-ox-calendar-edit-window');
    I.waitForDetached('.io-ox-calendar-edit-window');

    I.seeNumberOfElements('//div[contains(concat(" ", @class, " "), "list-view-control")]//div[@class="title" and text()="test recurring edit new edit"]', 1);
    I.click('//div[contains(concat(" ", @class, " "), "list-view-control")]//div[@class="title" and text()="test recurring edit new edit"]');

    I.waitForVisible('[data-action="delete"]');
    I.click('[data-action="delete"]');

    I.waitForVisible('.io-ox-dialog-popup');
    I.click('This appointment', '.io-ox-dialog-popup');

    I.waitForDetached('.io-ox-dialog-popup');

    I.seeNumberOfElements('//div[contains(concat(" ", @class, " "), "list-view-control")]//div[@class="title" and text()="test recurring edit"]', 3);

    // check in Month view
    /*
    This is shaky!

    I.clickToolbar('View');
    I.click('Month');

    I.seeNumberOfElements('//div[contains(concat(" ", @class, " "), "monthview-container")]//div[@class="title" and text()="test recurring edit"]', 3);

    // check in Week view
    I.clickToolbar('View');
    I.click('Week');

    I.seeNumberOfElements('//div[contains(concat(" ", @class, " "), "weekview-container week")]//div[@class="title" and text()="test recurring edit"]', 3);

    // check in Workweek view
    I.clickToolbar('View');
    I.click('Workweek');

    I.seeNumberOfElements('//div[contains(concat(" ", @class, " "), "workweek")]//div[@class="title" and text()="test recurring edit"]', 3);

    */

    I.logout();

    // login new user1 for decline
    I.login('app=io.ox/calendar', { user: users[1] });
    I.waitForVisible('[data-app-name="io.ox/calendar"]', 5);

    I.selectFolder('Calendar');

    I.clickToolbar('View');
    I.click('List');

    I.see('test recurring edit', '.list-view .appointment .title');
    I.seeNumberOfElements('.list-view .appointment .title', 4);

    I.click({ xpath: '//div[text()="test recurring edit"]' });

    I.waitForDetached('.rightside .multi-selection-message');
    I.see('test recurring edit', '.rightside');
    I.see('invite location', '.rightside');

    I.waitForVisible('[data-action="changestatus"]');
    I.click('Status');

    I.waitForVisible('.modal-dialog');

    I.click('Series', '.modal-dialog');

    I.click('Decline', '.modal-dialog');

    I.waitForDetached('.modal-dialog', 5);

    I.waitForElement('.rightside .participant a.declined[title="' + users[1].userdata.primaryEmail + '"]');
    I.seeNumberOfElements('.list-view .appointment .declined', 3);

    I.click({ xpath: '//div[text()="test recurring edit"]' });
    I.waitForVisible('[data-action="changestatus"]');
    I.click('Status');

    I.waitForVisible('.modal-dialog');
    I.click('Appointment', '.modal-dialog');
    I.waitForVisible('.modal-dialog [data-action="tentative"]');
    I.click('Tentative', '.modal-dialog');

    I.waitForDetached('.modal-dialog', 5);

    I.seeNumberOfElements('.list-view .appointment .tentative', 1);
    I.seeNumberOfElements('.list-view .appointment .declined', 2);

    I.logout();

});
