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

Feature('Mail compose');

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

    I.login('app=io.ox/mail', { user });

    // workflow 1: Compose & discard
    I.clickToolbar('Compose');
    I.retry(5).click('Discard');
    I.dontSee('Do you really want to discard your message?');

    // workflow 3: Compose & discard with signature and vcard
    I.click('#io-ox-topbar-dropdown-icon');
    I.click('Settings', '#topbar-settings-dropdown');

    I.selectFolder('Mail');
    I.waitForVisible('.rightside h1');
    I.selectFolder('Compose');
    I.click('Append vCard');

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
    const text = await I.grabValueFrom({ css: 'textarea.plain-text' });
    expect(text).to.contain('My unique signature content');
    I.click('Options');
    const ariaChecked = await I.grabAttributeFrom('.dropdown [data-name="vcard"]', 'aria-checked');
    expect(ariaChecked).to.equal('true');
    I.pressKey('Escape');
    I.click('Discard');
    I.dontSee('Do you really want to discard your message?');

    // workflow 4: Compose with subject, then discard
    I.clickToolbar('Compose');
    I.waitForText('Subject');
    I.fillField('Subject', 'Test');
    I.click('Discard');
    I.see('Do you really want to discard your message?');
    I.click('Discard message');

    // workflow 5: Compose with to, subject, some text, then send
    I.clickToolbar('Compose');
    I.waitForText('Subject');
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
    expect(reply).to.match(new RegExp(
        '\\n' +
        '> On [^w]*wrote:\\n' + // e.g. "> On November 28, 2018 at 3:30 PM User f484eb <test.user-f484eb@ox-e2e-backend.novalocal> wrote:"
        '> \\n' +
        '> \\n' +
        '> Testcontent'
    ));
    I.click('Discard');
    I.dontSee('Do you really want to discard your message?');

    I.logout();
});

Scenario('Compose mail with different attachments', async function (I, users) {
    const [user] = users;

    await I.haveSetting('io.ox/mail//messageFormat', 'html');

    I.login('app=io.ox/files', { user });

    // create textfile in drive
    I.clickToolbar('New');
    I.click('Add note');
    I.waitForVisible('.io-ox-editor');
    I.fillField('Title', 'Testdocument.txt');
    I.fillField('Note', 'Some content');
    I.click('Save');
    I.waitForText('Save', 5, '.floating-window');
    I.click('Close');

    I.openApp('Mail');

    // workflow 6: Compose with local Attachment(s)
    // workflow 7: Compose with file from Drive
    // workflow 8: Compose with inline images
    I.clickToolbar('Compose');

    // upload local file via the hidden input in the toolbar
    I.attachFile('.composetoolbar input[type="file"]', 'e2e/media/placeholder/800x600.png');

    // attach from drive
    I.waitForInvisible('.window-blocker');
    I.click('Attachments');
    I.click('Add from Drive');
    I.waitForText('Testdocument.txt');
    I.click('Add');

    // attach inline image
    I.attachFile('.editor input[type="file"]', 'e2e/media/placeholder/800x600.png');
    I.wait(1);

    I.fillField('To', user.get('primaryEmail'));
    I.fillField('Subject', 'Testsubject');
    I.click('Send');

    I.waitForVisible({ css: 'li.unread' }); // wait for one unread mail
    I.click({ css: 'li.unread' });
    I.waitForVisible('.mail-detail-pane .subject');
    I.see('Testsubject', '.mail-detail-pane');
    I.waitForVisible('.attachments');
    I.see('3 attachments');

    I.logout();

});
