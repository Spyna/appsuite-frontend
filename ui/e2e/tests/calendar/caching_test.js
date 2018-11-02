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
});

After(async function (users) {
    await users.removeAll();
});

Scenario('Create never ending appointment and check display in several views', async function (I) {
    I.login('app=io.ox/calendar');
    I.waitForVisible('[data-app-name="io.ox/calendar"]', 5);

    // toggle weeks to activate caching
    I.clickToolbar('View');
    I.click('Week');
    I.waitForVisible('.weekview-container.week button.weekday.today');

    I.click('.weekview-container.week button[title="Next Week"]');
    I.dontSeeElement('.weekview-container.week button.weekday.today');
    I.click('.weekview-container.week button[title="Previous Week"]');
    I.waitForVisible('.weekview-container.week button.weekday.today');

    // toggle months to activate caching
    I.clickToolbar('View');
    I.click('Month');
    I.waitForVisible('.monthview-container td.day.today');

    // just skip 2 months, because "today" might still be visible in the "next" month
    I.click('.monthview-container button[title="Next Month"]');
    I.click('.monthview-container button[title="Next Month"]');
    I.dontSeeElement('.monthview-container td.day.today:not(.out)');

    I.click('.monthview-container button[title="Previous Month"]');
    I.click('.monthview-container button[title="Previous Month"]');
    I.waitForVisible('.monthview-container td.day.today');

    // create in List view
    I.selectFolder('Calendar');
    I.clickToolbar('View');
    I.click('List');
    I.clickToolbar('New');
    I.waitForVisible('.io-ox-calendar-edit-window');

    I.fillField('Subject', 'test caching');
    I.fillField('Location', 'caching location');

    const { start, dayCountNextMonth } = await I.executeAsyncScript(function (done) {
        done({
            start: `.date-picker[data-attribute="startDate"] .date[id$="_${moment().startOf('week').add('1', 'day').format('l')}"]`,
            dayCountNextMonth: moment().add(1, 'months').daysInMonth()

        });
    });

    I.click('~Date (M/D/YYYY)');
    I.click(start);

    I.click('All day', '.io-ox-calendar-edit-window');

    I.click('Repeat', '.io-ox-calendar-edit-window');
    I.click('.btn.btn-link.summary');

    I.click('.modal-dialog [name="recurrence_type"]');
    I.selectOption('.modal-dialog [name="recurrence_type"]', 'Daily');

    I.click('Apply', '.modal-dialog');

    I.waitForDetached('.modal-dialog');

    // save
    I.click('Create', '.io-ox-calendar-edit-window');

    I.waitForDetached('.io-ox-calendar-edit-window', 5);

    // check in week view
    I.clickToolbar('View');
    I.click('Week');
    I.waitForVisible('.weekview-container.week button.weekday.today');

    I.see('test caching', '.weekview-container.week .appointment .title');
    I.seeNumberOfElements('.weekview-container.week .appointment .title', 6);

    I.click('.weekview-container.week button[title="Next Week"]');
    I.dontSeeElement('.weekview-container.week button.weekday.today');

    I.see('test caching', '.weekview-container.week .appointment .title');
    I.seeNumberOfElements('.weekview-container.week .appointment .title', 7);
    I.click('.weekview-container.week button[title="Previous Week"]');
    I.waitForVisible('.weekview-container.week button.weekday.today');
    // check in month view
    I.clickToolbar('View');
    I.click('Month');
    I.waitForVisible('.monthview-container td.day.today');

    I.waitForVisible('.monthview-container .day .appointment .title');
    I.see('test caching', '.monthview-container .day .appointment .title');

    // just skip 2 months, because "today" might still be visible in the "next" month
    I.click('.monthview-container button[title="Next Month"]');
    I.click('.monthview-container button[title="Next Month"]');
    I.dontSeeElement('.monthview-container td.day.today:not(.out)');

    I.see('test caching', '.monthview-container .appointment .title');
    I.seeNumberOfElements('.monthview-container .day:not(.out) .appointment .title', dayCountNextMonth);

    I.logout();

});
