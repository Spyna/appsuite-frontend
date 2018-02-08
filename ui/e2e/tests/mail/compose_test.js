/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2017 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Richard Petersen <richard.petersen@open-xchange.com>
 */
/// <reference path="../../steps.d.ts" />

Feature('Mail compose');

// https://testrail.open-xchange.com/index.php?/cases/view/7382
Scenario('Compose plain text mail', function (I) {
    // 0) log in to settings and set compose mode to html
    I.login('app=io.ox/settings');
    I.waitForVisible('.io-ox-settings-main');

    // open mail settings
    I.selectFolder('Mail');
    I.waitForVisible('.rightside h1');
    I.selectFolder('Compose');

    // set compose mode to html
    I.waitForVisible('[name="messageFormat"][value="html"] + i');
    I.checkOption({ css: '[name="messageFormat"][value="html"] + i' });

    // 1) Switch to the mail app, select "Create mail"
    I.click('#io-ox-launcher button.launcher-btn');
    I.click('Mail', { css: '#io-ox-launcher' });

    // 1.1) Mark all messages as read to identify the new message later on
    I.selectFolder('Inbox');
    I.waitForVisible('.selected .contextmenu-control');
    I.click('.selected .contextmenu-control');
    I.click('.dropdown.open a[data-action="markfolderread"]');

    // 1.2) continue opening mail compose
    I.click('Compose', '.primary-action');
    I.waitForVisible('.io-ox-mail-compose textarea.plain-text,.io-ox-mail-compose .contenteditable-editor');
    I.wait(1);

    // 2) Select "Plain Text" as text format under "Options"
    I.click('Options');
    I.click('Plain Text');
    I.waitForVisible('.io-ox-mail-compose textarea.plain-text');
    I.waitForInvisible('.io-ox-mail-compose .editable-toolbar');

    // 3) Set a recipient, add a subject and mail text
    I.insertMailaddress('.io-ox-mail-compose div[data-extension-id="to"] input.tt-input', 0);
    I.fillField('.io-ox-mail-compose [name="subject"]', 'Test subject');
    I.fillField({ css: 'textarea.plain-text' }, 'Test text');
    I.seeInField({ css: 'textarea.plain-text' }, 'Test text');

    // 4) Send the E-Mail and check it as recipient
    I.click('Send');
    I.waitForVisible('.io-ox-mail-window .leftside ul li.unread');
    I.click('.io-ox-mail-window .leftside ul li.unread');
    I.waitForVisible('.io-ox-mail-window .mail-detail-pane .subject');
    I.see('Test subject', '.mail-detail-pane');

    // 4.1) Assert body content
    I.switchTo('.mail-detail-frame');
    I.see('Test text');
    I.switchTo();

    // 5) Check the "Sent" folder
    I.selectFolder('Sent objects');
    I.click('.io-ox-mail-window .leftside ul li.list-item');
    I.waitForVisible('.io-ox-mail-window .mail-detail-pane .subject');
    I.see('Test subject', '.mail-detail-pane');

    // 5.1) Assert body content
    I.switchTo('.mail-detail-frame');
    I.see('Test text');
    I.switchTo();

    I.logout();
});
