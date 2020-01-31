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

Scenario('Compose and discard with/without prompts', async function (I, users, mail) {
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
    mail.newMail();
    I.click('Discard');
    I.dontSee('Do you really want to discard your message?');
    I.waitForDetached('.io-ox-mail-compose');

    // workflow 3: Compose & discard with signature and vcard
    I.openApp('Settings', { folder: 'virtual/settings/io.ox/mail/settings/compose' });
    I.waitForText('Append vCard', 5, '.settings-detail-pane');
    I.click('Append vCard');

    I.selectFolder('Signatures');
    I.waitForText('Default signature for new messages');
    I.selectOption('Default signature for new messages', 'My signature');
    // yep, this seems useless, but when you have no default signature set, the default compose signature will be used
    // if you have unset (explicitedly checked no signature) the reply/forward signature. no signature will be selected on reply
    I.selectOption('Default signature for replies or forwards', 'My signature');
    I.selectOption('Default signature for replies or forwards', 'No signature');

    I.openApp('Mail');
    mail.newMail();

    let text = await I.grabValueFrom({ css: 'textarea.plain-text' });
    text = Array.isArray(text) ? text[0] : text;
    expect(text).to.contain('My unique signature content');
    I.see('1 attachment', '.io-ox-mail-compose');
    I.see('VCF', '.io-ox-mail-compose .mail-attachment-list');
    I.click('Discard');
    I.dontSee('Do you really want to discard your message?');

    // workflow 4: Compose with subject, then discard
    mail.newMail();
    I.fillField('Subject', 'Test');
    I.click('Discard');
    I.see('Do you really want to discard your message?');
    I.click('Discard message');

    // workflow 5: Compose with to, subject, some text, then send
    mail.newMail();
    I.fillField('To', user.get('primaryEmail'));
    I.fillField('Subject', 'Testsubject');
    I.fillField({ css: 'textarea.plain-text' }, 'Testcontent');
    mail.send();

    I.waitForVisible({ css: 'li.unread' }, 30); // wait for one unread mail
    mail.selectMail('Testsubject');
    I.see('Testsubject', '.mail-detail-pane');
    I.waitForVisible('.mail-detail-pane .attachments');
    I.see('1 attachment');

    I.waitForElement('.mail-detail-frame');
    I.switchTo('.mail-detail-frame');
    I.see('Testcontent');
    I.switchTo();

    // workflow 2: Reply & discard
    I.click('Reply');
    I.waitForVisible('.io-ox-mail-compose textarea.plain-text');
    I.wait(0.5);
    text = await I.grabValueFrom('.io-ox-mail-compose textarea.plain-text');
    text = Array.isArray(text) ? text[0] : text;
    expect(text).to.match(new RegExp(
        '\\n' +
        '> On .*wrote:\\n' + // e.g. "> On November 28, 2018 3:30 PM User f484eb <test.user-f484eb@ox-e2e-backend.novalocal> wrote:"
        '> \\n' +
        '>  \\n' +
        '> Testcontent'
    ));
    I.click('Discard');
    I.dontSee('Do you really want to discard your message?');
});

Scenario('Compose mail with different attachments', async function (I, users, mail) {
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
    I.waitForText('Save', 5, '.window-footer button');
    I.click('Close');

    I.openApp('Mail');

    // workflow 6: Compose with local Attachment(s)
    // workflow 7: Compose with file from Drive
    // workflow 8: Compose with inline images
    mail.newMail();

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
    I.waitNumberOfVisibleElements('.attachments .inline-items > li', 2);

    I.fillField('To', user.get('primaryEmail'));
    I.fillField('Subject', 'Testsubject');
    mail.send();

    I.waitForVisible({ css: 'li.unread' }, 30); // wait for one unread mail
    mail.selectMail('Testsubject');
    I.see('Testsubject', '.mail-detail-pane');
    I.waitForVisible('.attachments');
    I.see('3 attachments');

    // workflow 12: Reply e-mail with attachment and re-adds attachments of original mail
    I.click('Reply');

    // upload local file via the hidden input in the toolbar
    I.say('📢 add another local image', 'blue');
    I.waitForElement('.composetoolbar input[type="file"]');
    I.attachFile('.composetoolbar input[type="file"]', 'e2e/media/placeholder/800x600.png');
    I.waitNumberOfVisibleElements('.attachments .inline-items > li', 1);
    I.wait(1); // there still might be a focus event somewhere

    mail.send();

    I.waitForVisible({ css: 'li.unread' }, 30); // wait for one unread mail
    mail.selectMail('Testsubject');
    I.see('Testsubject', '.mail-detail-pane');
    I.waitForVisible('.attachments');
    I.see('2 attachments'); // has 2 attachments as one of the attachments is inline
});

Scenario('Compose with inline image, which is removed again', async function (I, users, mail) {
    const [user] = users;

    await I.haveSetting('io.ox/mail//messageFormat', 'html');

    I.login('app=io.ox/mail');

    // workflow 9: Compose, add and remove inline image
    mail.newMail();

    // attach inline image
    I.attachFile('.editor input[type="file"]', 'e2e/media/placeholder/800x600.png');

    I.switchTo('.io-ox-mail-compose-window .editor iframe');
    I.waitForElement({ css: 'img' });
    I.click({ css: 'img' });
    I.pressKey('Delete');
    I.switchTo();

    I.fillField('To', user.get('primaryEmail'));
    I.fillField('Subject', 'Testsubject');
    mail.send();

    I.waitForVisible({ css: 'li.unread' }, 30); // wait for one unread mail
    mail.selectMail('Testsubject');
    I.see('Testsubject', '.mail-detail-pane');
    I.waitForVisible('.mail-detail-frame');
    I.dontSeeElement('.attachments');
});

Scenario('Compose with drivemail attachment and edit draft', async function (I, users, mail, drive) {
    const [user] = users;
    const user2 = await users.create();

    await Promise.all([
        user.hasConfig('com.openexchange.mail.deleteDraftOnTransport', true),
        I.haveSetting({
            'io.ox/mail': {
                messageFormat: 'html',
                'features/deleteDraftOnClose': true,
                deleteDraftOnTransport: true
            }
        })
    ]);
    I.login('app=io.ox/files');

    I.say('Create textfile in drive');
    drive.waitForApp();
    I.clickToolbar('New');
    I.click('Add note');
    I.waitForVisible('.io-ox-editor');
    I.fillField('Title', 'Testdocument.txt');
    I.fillField('Note', 'Some content');
    I.waitForClickable(locate('button').withText('Save'));
    I.click('Save');
    I.waitForNetworkTraffic();
    I.click('Close');

    I.say('Add attachment to new draft');
    I.click(locate({ css: 'button[data-id="io.ox/mail"]' }).inside({ css: 'div[id="io-ox-appcontrol"]' }));
    mail.waitForApp();

    // workflow 10: Compose with Drive Mail attachment
    mail.newMail();

    // attach from drive
    I.click('Attachments');
    I.clickDropdown('Add from Drive');
    I.waitForText('Testdocument.txt');
    I.click('Add');

    I.waitForText('Use Drive Mail');
    I.checkOption('Use Drive Mail');
    I.fillField('Subject', 'Testsubject #1');
    I.click('Discard');
    I.waitForText('Save as draft', 5, '.modal-dialog');
    I.click('Save as draft', '.modal-dialog');
    I.waitForDetached('.io-ox-taskbar-container .taskbar-button');

    I.selectFolder('Drafts');
    mail.selectMail('Testsubject #1');

    // workflow 17: Edit copy
    I.say('Edit copy of that draft');
    I.clickToolbar('Edit copy');
    I.waitForElement('.editor iframe');
    within({ frame: '.editor iframe' }, () => {
        I.fillField('body', 'Editing a copy');
    });
    I.fillField('To', user2.get('primaryEmail'));
    I.fillField('Subject', 'Testsubject #2');
    mail.send();
    I.waitForDetached('.io-ox-taskbar-container .taskbar-button');

    // workflow 11: Compose mail, add Drive-Mail attachment, close compose, logout, login, edit Draft, remove Drive-Mail option, send Mail
    // workflow 16: Edit draft
    I.say('Edit original draft');
    I.clickToolbar('Edit draft');
    I.waitForElement('.editor iframe');
    within({ frame: '.editor iframe' }, () => {
        I.fillField('body', 'Editing draft');
    });
    I.waitForText('Use Drive Mail');
    I.checkOption('Use Drive Mail');
    I.seeNumberOfVisibleElements('.inline-items > li', 1);

    I.fillField('To', user.get('primaryEmail'));
    I.fillField('Subject', 'Testsubject #3');
    I.say('Send edited original draft');
    mail.send();
    I.waitForDetached('.io-ox-taskbar-container .taskbar-button');

    I.selectFolder('Inbox');

    I.waitForVisible('.list-view li.unread', 30); // wait for one unread mail
    mail.selectMail('Testsubject #3');

    I.waitForElement('.mail-detail-frame');
    I.switchTo('.mail-detail-frame');
    I.see('Testdocument.txt');
    I.switchTo();

});

Scenario('Compose mail with vcard and read receipt', async function (I, users, mail) {
    const user2 = await users.create();

    I.login('app=io.ox/mail');

    // workflow 13: Compose mail and attach v-card
    // workflow 15: Compose with read-receipt
    mail.newMail();

    I.fillField('To', user2.get('primaryEmail'));
    I.fillField('Subject', 'Testsubject');
    I.click('Options');
    I.click('Attach Vcard');
    I.click('Options');
    I.click('Request read receipt');
    mail.send();

    I.logout();

    I.login('app=io.ox/mail', { user: user2 });

    I.waitForVisible({ css: 'li.unread' }, 30); // wait for one unread mail
    mail.selectMail('Testsubject');
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

Scenario('Compose mail, refresh and continue work at restore point', async function (I, users, mail) {
    const [user] = users;

    await I.haveSetting('io.ox/mail//messageFormat', 'text');
    await I.haveSetting('io.ox/mail//autoSaveAfter', 1000);

    I.login();
    mail.newMail();

    I.fillField('To', user.get('primaryEmail'));
    I.fillField('Subject', 'Testsubject');
    I.fillField({ css: 'textarea.plain-text' }, 'Testcontent');
    // give it some time to store content
    I.wait(3);

    I.refreshPage();

    I.waitForText('Mail: Testsubject', 30, '#io-ox-taskbar');
    I.wait(1);
    I.click('Mail: Testsubject', '#io-ox-taskbar');

    I.waitForText('Subject', 30, '.io-ox-mail-compose');
    I.waitForElement('.io-ox-mail-compose textarea.plain-text');

    I.seeInField('Subject', 'Testsubject');
    I.seeInField('.io-ox-mail-compose textarea.plain-text', 'Testcontent');
});
