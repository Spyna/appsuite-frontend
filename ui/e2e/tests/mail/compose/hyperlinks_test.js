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
 * @author David Bauer <david.bauer@open-xchange.com>
 *
 */

/// <reference path="../../../steps.d.ts" />

Feature('Mail Compose');

Before(async (users) => {
    await users.create();
});

After(async (users) => {
    await users.removeAll();
});

Scenario('[C8821] Send mail with Hyperlink', function (I, mail) {

    let hyperLink = 'https://foo.bar';
    let linkText = 'appsuite link';
    I.login('app=io.ox/mail');
    mail.newMail();
    I.fillField('To', 'foo@bar');
    I.fillField('Subject', 'test subject');
    I.click({ css: 'i.mce-i-link' });
    I.waitForVisible('.mce-reset');
    I.fillField('.mce-combobox input.mce-textbox', hyperLink);
    I.fillField({ css: 'input.mce-last' }, linkText);
    I.click('Ok');
    I.waitForVisible('#mce_0_ifr');
    within({ frame: '#mce_0_ifr' }, () => {
        I.waitForText(linkText);
        I.click(linkText);
    });
    I.click({ css: 'i.mce-i-link' });
    I.waitForVisible('.mce-reset');
    I.seeInField('.mce-combobox input.mce-textbox', hyperLink);
    I.seeInField({ css: 'input.mce-last' }, linkText);
    I.click('Ok');
    mail.send();
    I.selectFolder('Sent');
    I.waitForText('test subject', 30, '.list-view li[data-index="0"]');
    I.click('.list-view li[data-index="0"]');
    I.waitForVisible('.mail-detail-frame');
    within({ frame: '.mail-detail-frame' }, () => {
        I.waitForText(linkText);
        I.click(linkText);
    });
    I.switchToNextTab();
    I.seeInTitle('foo.bar');
});

Scenario('[C8822] Send Mail with Hyperlink from existing text', function (I, mail) {
    I.login('app=io.ox/mail');
    mail.newMail();
    I.fillField('To', 'foo@bar');
    I.fillField('Subject', 'test subject');
    within({ frame: '#mce_0_ifr' }, () => {
        I.fillField('.mce-content-body', 'testlink');
        I.doubleClick({ css: 'div.default-style' });
    });
    I.click({ css: 'i.mce-i-link' });
    I.waitForVisible('.mce-reset');
    I.fillField('.mce-combobox input.mce-textbox', 'http://foo.bar');
    I.click('Ok');
    within({ frame: '#mce_0_ifr' }, () => {
        I.seeElement('a');
    });
    mail.send();
    I.selectFolder('Sent');
    I.waitForText('test subject', 30, '.list-view li[data-index="0"]');
    I.click('.list-view li[data-index="0"]');
    I.waitForText('testlink', '.rightside.mail-detail-pane .body.user-select-text');
});

Scenario('[C8823] Send Mail with Hyperlink by typing the link', function (I, mail) {
    // test String has to contain whitespace at the end for URL converting to work
    const testText = 'Some test text https://foo.bar  ';
    I.login('app=io.ox/mail');
    mail.newMail();
    I.fillField('To', 'foo@bar');
    I.fillField('Subject', 'test subject');
    I.wait(0.5);
    within({ frame: '#mce_0_ifr' }, () => {
        I.fillField('.mce-content-body', testText);
        I.seeElement('a');
    });
    mail.send();
    I.selectFolder('Sent');
    I.waitForText('test subject', 30, '.list-view li[data-index="0"]');
    I.click('.list-view li[data-index="0"]');
    I.waitForVisible('.mail-detail-frame');
    within({ frame: '.mail-detail-frame' }, () => {
        I.waitForText(testText.trim());
        I.seeElement({ css: 'a[href="https://foo.bar"]' });
    });
});

Scenario('[C8824] Remove hyperlinks', async function (I, mail) {
    const iframeLocator = '.io-ox-mail-compose-window .editor iframe';
    const defaultText = 'Dies ist ein testlink http://example.com.';

    await I.haveSetting('io.ox/mail//features/registerProtocolHandler', false);

    I.login('app=io.ox/mail');
    mail.newMail();

    I.click('~Maximize');

    // Write some text with the default settings
    await within({ frame: iframeLocator }, async () => {
        I.click('.default-style');
        I.fillField({ css: 'body' }, defaultText);
        I.pressKey('Enter');
        I.see('http://example.com', 'a');
        I.pressKey('ArrowLeft');
        I.pressKey('ArrowLeft');
        I.pressKey('ArrowLeft');
    });

    I.click('.mce-btn[data-name="link"]');
    I.fillField('Url', '');
    I.pressKey('Enter');

    await within({ frame: iframeLocator }, async () => {
        I.dontSeeElement('a');
    });
});
