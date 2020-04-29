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

Feature('Mail Compose');

const expect = require('chai').expect;

Before(async (users) => {
    await users.create(); // Sender
    await users.create(); // Recipient
});

After(async (users) => {
    await users.removeAll();
});

Scenario('[C12122] Auto-size recipient fields', async function (I, mail) {
    let height;

    I.login('app=io.ox/mail');
    mail.newMail();

    height = await I.grabCssPropertyFrom({ css: '[data-extension-id="to"]' }, 'height');
    expect(parseInt(height, 10)).to.be.most(40);

    I.click({ css: '[placeholder="To"]' });
    for (let i = 0; i < 5; i++) {
        I.fillField('To', `testmail${i}@testmail.com`);
        I.pressKey('Enter');
        I.wait(0.2);
    }

    height = await I.grabCssPropertyFrom({ css: '[data-extension-id="to"]' }, 'height');
    expect(parseInt(height, 10)).to.be.greaterThan(40);

    for (let i = 1; i < 5; i++) {
        I.click('~Remove', `~testmail${i}@testmail.com`);
    }

    height = await I.grabCssPropertyFrom({ css: '[data-extension-id="to"]' }, 'height');
    expect(parseInt(height, 10)).to.be.most(40);

});

Scenario('[Bug 62794] no drag and drop of pictures while composing a new mail', async function (I, mail) {

    I.login();
    mail.newMail();
    I.waitForElement('.editor iframe');

    await I.dropFiles('e2e/media/files/generic/contact_picture.png', '.io-ox-mail-compose .editor .inplace-dropzone');

    within({ frame: '.editor iframe' }, () => {
        I.waitForElement('body img');
    });
});

Scenario('[C271752] Reduce image size for image attachments in mail compose', async (I, mail, users) => {
    let [sender, recipient] = users;

    // enable Image resize setting
    await I.haveSetting('io.ox/mail//features/imageResize', true);

    // Login as 'sender'
    I.login('app=io.ox/mail', { user: sender });

    // compose mail
    mail.newMail();
    I.fillField('To', recipient.get('primaryEmail'));
    I.fillField('Subject', 'Reduced Image size Test');
    I.say('📢 add local file', 'blue');

    // attach Image
    I.attachFile('.composetoolbar input[type="file"]', 'e2e/media/placeholder/1030x1030.png');
    I.waitForDetached('.io-ox-fileselection');

    // switch Image size
    I.waitForText('Original');
    I.click('Image size: Original');
    I.click('Small (320 px)');
    I.dontSee('Original');

    // send Mail to 'recipient' and logout
    mail.send();
    I.logout();

    /////////////////// Continue as 'recipient' ///////////////////////
    // Log in as second user and navigate to mail app
    I.login('app=io.ox/mail', { user: recipient });

    I.waitForText('Reduced Image size Test');

    // Open mail
    mail.selectMail('Reduced Image size Test');

    // Verify Attachment
    I.waitForText('1 attachment');
    I.click('1 attachment');
    I.see('1030x1030.png');

    // Let's view the content
    I.click('1030x1030.png');
    I.waitForElement('.dropdown.open');
    I.click('View', '.dropdown.open .dropdown-menu');
    I.waitForText('Shares', 20);
});
