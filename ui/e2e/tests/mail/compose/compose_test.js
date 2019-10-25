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
/// <reference path="../../../steps.d.ts" />

const expect = require('chai').expect;

Feature('Mail Compose');

Before(async function (users) {
    await users.create();
});

After(async function (users) {
    await users.removeAll();
});

Scenario('Compose and discard with/without prompts', async function (I, users) {
    const [user] = users;

    // preparations
    await I.haveSnippet({
        content: '<p>My unique signature content</p>',
        displayname: 'My signature',
        misc: { insertion: 'above', 'content-type': 'text/html' },
        module: 'io.ox/mail',
        type: 'signature'
    });
    await I.haveSetting('io.ox/mail//appendVcard', false);
    await I.haveSetting('io.ox/mail//messageFormat', 'text');

    I.login('app=io.ox/mail');

    // workflow 1: Compose & discard
    I.clickToolbar('Compose');
    I.retry(5).click('Discard');
    I.dontSee('Do you really want to discard your message?');

    // workflow 3: Compose & discard with signature and vcard
    I.click('~Settings', '#io-ox-settings-topbar-icon');

    I.selectFolder('Mail');
    I.waitForVisible('.rightside h1');
    I.selectFolder('Compose');
    I.retry(5).click('Append vCard');

    I.selectFolder('Signatures');
    I.waitForText('Default signature for new messages');
    I.selectOption('Default signature for new messages', 'My signature');
    // yep, this seems useless, but when you have no default signature set, the default compose signature will be used
    // if you have unset (explicitedly checked no signature) the reply/forward signature. no signature will be selected on reply
    I.selectOption('Default signature for replies or forwards', 'My signature');
    I.selectOption('Default signature for replies or forwards', 'No signature');

    I.openApp('Mail');

    I.clickToolbar('Compose');
    I.waitForVisible({ css: 'textarea.plain-text' });
    I.wait(0.2);
    let text = await I.grabValueFrom({ css: 'textarea.plain-text' });
    expect(text[0]).to.contain('My unique signature content');
    I.see('1 attachment', '.io-ox-mail-compose');
    I.see('VCF', '.io-ox-mail-compose .mail-attachment-list');
    I.click('Discard');
    I.dontSee('Do you really want to discard your message?');

    // workflow 4: Compose with subject, then discard
    I.clickToolbar('Compose');
    I.waitForFocus('[placeholder="To"]');
    I.fillField('Subject', 'Test');
    I.click('Discard');
    I.see('Do you really want to discard your message?');
    I.click('Discard message');

    // workflow 5: Compose with to, subject, some text, then send
    I.clickToolbar('Compose');
    I.waitForFocus('[placeholder="To"]');
    I.fillField('To', user.get('primaryEmail'));
    I.fillField('Subject', 'Testsubject');
    I.fillField({ css: 'textarea.plain-text' }, 'Testcontent');
    I.click('Send');

    I.waitForVisible({ css: 'li.unread' }); // wait for one unread mail
    I.click({ css: 'li.unread' });
    I.waitForVisible('.mail-detail-pane .subject');
    I.see('Testsubject', '.mail-detail-pane');
    I.waitForVisible('.attachments');
    I.see('1 attachment');

    I.switchTo('.mail-detail-frame');
    I.see('Testcontent');
    I.switchTo();

    // workflow 2: Reply & discard
    I.click('Reply');
    I.waitForVisible('textarea.plain-text');
    const reply = await I.grabValueFrom({ css: 'textarea.plain-text' });
    expect(reply[0]).to.match(new RegExp(
        '\\n' +
        '> On .*wrote:\\n' + // e.g. "> On November 28, 2018 3:30 PM User f484eb <test.user-f484eb@ox-e2e-backend.novalocal> wrote:"
        '> \\n' +
        '>  \\n' +
        '> Testcontent'
    ));
    I.click('Discard');
    I.dontSee('Do you really want to discard your message?');
});

Scenario('Compose mail with different attachments', async function (I, users) {
    const [user] = users;

    await I.haveSetting('io.ox/mail//messageFormat', 'html');

    I.login('app=io.ox/files');

    // create textfile in drive
    I.clickToolbar('New');
    I.click('Add note');
    I.waitForVisible('.io-ox-editor');
    I.fillField('Title', 'Testdocument.txt');
    I.fillField('Note', 'Some content');
    I.click('Save');
    I.waitForText('Save', 5, '.window-footer');
    I.click('Close');

    I.openApp('Mail');

    // workflow 6: Compose with local Attachment(s)
    // workflow 7: Compose with file from Drive
    // workflow 8: Compose with inline images
    I.clickToolbar('Compose');
    I.waitForFocus('[placeholder="To"]');

    // upload local file via the hidden input in the toolbar
    I.say('📢 add local file', 'blue');
    I.attachFile('.composetoolbar input[type="file"]', 'e2e/media/placeholder/800x600.png');

    // attach from drive
    I.say('📢 add drive file', 'blue');
    I.waitForInvisible('.window-blocker');
    I.retry(5).click('Attachments');
    I.click('Add from Drive');
    I.waitForText('Testdocument.txt');
    I.click('Add');

    // attach inline image
    I.say('📢 add inline image', 'blue');
    I.attachFile('.editor input[type="file"]', 'e2e/media/placeholder/800x600.png');
    I.wait(1);

    I.seeNumberOfVisibleElements('.inline-items > li', 2);

    I.fillField('To', user.get('primaryEmail'));
    I.fillField('Subject', 'Testsubject');
    I.click('Send');

    I.waitForVisible({ css: 'li.unread' }); // wait for one unread mail
    I.click({ css: 'li.unread' });
    I.waitForVisible('.mail-detail-pane .subject');
    I.see('Testsubject', '.mail-detail-pane');
    I.waitForVisible('.attachments');
    I.see('3 attachments');

    // workflow 12: Reply e-mail with attachment and re-adds attachments of original mail
    I.click('Reply');

    // upload local file via the hidden input in the toolbar
    I.say('📢 add another local image', 'blue');
    I.waitForElement('.composetoolbar input[type="file"]');
    I.attachFile('.composetoolbar input[type="file"]', 'e2e/media/placeholder/800x600.png');

    I.retry(5).click('Send');

    I.waitForVisible({ css: 'li.unread' }); // wait for one unread mail
    I.click({ css: 'li.unread' });
    I.waitForVisible('.mail-detail-pane .subject');
    I.see('Testsubject', '.mail-detail-pane');
    I.waitForVisible('.attachments');
    I.see('2 attachments'); // has 2 attachments as one of the attachments is inline
});

Scenario('Compose with inline image, which is removed again', async function (I, users) {
    const [user] = users;

    await I.haveSetting('io.ox/mail//messageFormat', 'html');

    I.login('app=io.ox/mail');

    // workflow 9: Compose, add and remove inline image
    I.clickToolbar('Compose');
    I.waitForFocus('[placeholder="To"]');

    // attach inline image
    I.attachFile('.editor input[type="file"]', 'e2e/media/placeholder/800x600.png');
    I.wait(1);

    within({ frame: '.io-ox-mail-compose-window .editor iframe' }, async () => {
        I.click('img');
        I.pressKey('Delete');
    });

    I.fillField('To', user.get('primaryEmail'));
    I.fillField('Subject', 'Testsubject');
    I.click('Send');

    I.waitForVisible({ css: 'li.unread' }); // wait for one unread mail
    I.click({ css: 'li.unread' });
    I.waitForVisible('.mail-detail-pane .subject');
    I.see('Testsubject', '.mail-detail-pane');
    I.waitForVisible('.mail-detail-frame');
    I.dontSeeElement('.attachments');
});

Scenario('Compose with drivemail attachment and edit draft', async function (I, users) {
    const [user] = users;
    const user2 = await users.create();
    let counter = 5;

    async function setSettings() {
        await user.hasConfig('com.openexchange.mail.deleteDraftOnTransport', true);
        await I.haveSetting('io.ox/mail//messageFormat', 'html');
        await I.haveSetting('io.ox/mail//features/deleteDraftOnClose', true);
        I.wait(1.5);
        await I.haveSetting('io.ox/mail//deleteDraftOnTransport', true);
    }
    async function checkSettings() {
        let settingSet = await I.executeScript(function () {
            return require('settings!io.ox/mail').get('deleteDraftOnTransport');
        });
        return settingSet;
    }

    await setSettings();
    I.login('app=io.ox/files');
    let setting = await checkSettings();
    I.say(`DeleteDraftOnTranport = ${setting}`);

    while (!setting && counter > 0) {
        await setSettings();
        setting = await checkSettings();
        I.say(`DeleteDraftOnTranport = ${setting}`);
        counter--;
    }
    // create textfile in drive
    I.clickToolbar('New');
    I.click('Add note');
    I.waitForVisible('.io-ox-editor');
    I.fillField('Title', 'Testdocument.txt');
    I.fillField('Note', 'Some content');
    I.click('Save');
    I.waitForText('Save', 5, '.window-footer');
    I.click('Close');

    I.openApp('Mail');

    // workflow 10: Compose with Drive Mail attachment
    I.clickToolbar('Compose');

    // attach from drive
    I.retry(5).click('Attachments');
    I.click('Add from Drive');
    I.waitForText('Testdocument.txt');
    I.click('Add');

    I.retry(5).click('Use Drive Mail');
    I.fillField('Subject', 'Testsubject');
    I.click('Discard');
    // TODO find out whether this should be shown with the new compose api
    I.click('Save as draft');
    I.waitForInvisible('.floating-window');

    I.logout();

    I.login('app=io.ox/mail');

    I.waitForText('Drafts');
    I.selectFolder('Drafts');
    I.click('.io-ox-mail-window li.list-item');

    // workflow 17: Edit copy
    I.clickToolbar('Edit copy');
    I.waitForText('Subject');
    I.waitForVisible('.contenteditable-editor');
    I.wait(1); // add a short wait period until the ui has eventually focused the editor

    I.fillField('To', user2.get('primaryEmail'));
    I.wait(1);
    I.pressKey('Enter');
    I.click('Send');
    I.waitForInvisible('.floating-window');
    I.wait(1);
    I.waitNumberOfVisibleElements('.io-ox-mail-window li.list-item', 1);

    // workflow 11: Compose mail, add Drive-Mail attachment, close compose, logout, login, edit Draft, remove Drive-Mail option, send Mail
    // workflow 16: Edit draft
    I.clickToolbar('Edit draft');
    I.waitForText('Subject');

    I.waitForText('Use Drive Mail');

    I.retry(5).click('Use Drive Mail');
    I.seeCheckboxIsChecked('Use Drive Mail');
    I.seeNumberOfVisibleElements('.inline-items > li', 1);

    I.fillField('To', user.get('primaryEmail'));
    I.wait(1);
    I.fillField('Subject', 'Testsubject');
    I.click('Send');
    I.waitForInvisible('.floating-window');
    I.wait(1);
    I.waitForDetached('.io-ox-mail-window li.list-item');

    I.selectFolder('Inbox');

    I.waitForVisible({ css: 'li.unread' }); // wait for one unread mail
    I.click({ css: 'li.unread' });
    I.waitForVisible('.mail-detail-pane .subject');
    I.see('Testsubject', '.mail-detail-pane');

    I.switchTo('.mail-detail-frame');
    I.see('Testdocument.txt');
    I.switchTo();
});

Scenario('Compose mail with vcard and read receipt', async function (I, users) {
    const user2 = await users.create();

    I.login('app=io.ox/mail');

    // workflow 13: Compose mail and attach v-card
    // workflow 15: Compose with read-receipt
    I.clickToolbar('Compose');

    I.waitForText('Subject');
    I.waitForFocus('[placeholder="To"]');
    I.fillField('To', user2.get('primaryEmail'));
    I.fillField('Subject', 'Testsubject');
    I.click('Options');
    I.click('Attach Vcard');
    I.click('Options');
    I.click('Request read receipt');
    I.click('Send');
    I.waitForInvisible('.floating-window');

    I.logout();

    I.login('app=io.ox/mail', { user: user2 });

    I.waitForVisible({ css: 'li.unread' }); // wait for one unread mail
    I.click({ css: 'li.unread' });
    I.waitForVisible('.mail-detail-pane .subject');
    I.see('Testsubject', '.mail-detail-pane');
    I.waitForVisible('.attachments');
    I.see('1 attachment');

    // I.logout();

    // I.login('app=io.ox/mail');

    // TODO check read aknowledgement
    // I.waitForVisible({ css: 'li.unread' }); // wait for one unread mail
    // I.click({ css: 'li.unread' });
    // I.waitForVisible('.mail-detail-pane .subject');
    // I.see('Read acknowledgement', '.mail-detail-pane');
});

Scenario('Compose mail, refresh and continue work at restore point', async function (I, users) {
    const [user] = users;

    await I.haveSetting('io.ox/mail//messageFormat', 'text');
    await I.haveSetting('io.ox/mail//autoSaveAfter', 1000);

    I.login();

    I.clickToolbar('Compose');
    I.waitForFocus('[placeholder="To"]');
    I.fillField('To', user.get('primaryEmail'));
    I.fillField('Subject', 'Testsubject');
    I.fillField({ css: 'textarea.plain-text' }, 'Testcontent');
    I.wait(3);

    I.refreshPage();

    I.waitForElement('#io-ox-taskbar');
    I.retry(5).click('Mail: Testsubject', '#io-ox-taskbar');

    I.waitForText('Subject');

    I.seeInField('Subject', 'Testsubject');
    I.seeInField({ css: 'textarea.plain-text' }, 'Testcontent');
});
