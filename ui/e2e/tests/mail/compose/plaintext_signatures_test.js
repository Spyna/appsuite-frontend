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

Feature('Mail compose: Plaintext signatures');

Before(async function (users) {
    await users.create();
});

After(async function (users) {
    await users.removeAll();
    signatures.forEach(signature => {
        delete signature.id;
        delete signature.plaintext;
    });
});

const signatures = [{
    content: '<p>The content of the first signature</p>',
    displayname: 'First signature above',
    misc: { insertion: 'above', 'content-type': 'text/html' },
    module: 'io.ox/mail',
    type: 'signature'
}, {
    content: '<p>The content of the second signature</p>',
    displayname: 'Second signature above',
    misc: { insertion: 'above', 'content-type': 'text/html' },
    module: 'io.ox/mail',
    type: 'signature'
}, {
    content: '<p>The content of the third signature</p>',
    displayname: 'First signature below',
    misc: { insertion: 'below', 'content-type': 'text/html' },
    module: 'io.ox/mail',
    type: 'signature'
}, {
    content: '<p>The content of the fourth signature</p>',
    displayname: 'Second signature below',
    misc: { insertion: 'below', 'content-type': 'text/html' },
    module: 'io.ox/mail',
    type: 'signature'
}];

async function selectAndAssertSignature(I, name, compare) {
    I.click('Signatures');
    I.click(name);
    let result = await I.grabValueFrom('.io-ox-mail-compose textarea.plain-text');
    if (compare instanceof RegExp) expect(result).to.match(compare);
    else expect(result).to.equal(compare);
}

function getTestMail(user) {
    return {
        attachments: [{
            content: '<div>Test content</div>',
            content_type: 'text/html',
            disp: 'inline'
        }],
        from: [[user.get('displayname'), user.get('primaryEmail')]],
        sendtype: 0,
        subject: 'Test subject',
        to: [[user.get('displayname'), user.get('primaryEmail')]]
    };
}

Scenario('compose new mail with signature above correctly placed and changed', async function (I) {
    for (let signature of signatures) {
        var response = await I.haveSnippet(signature);
        signature.id = response.data;
        signature.plaintext = signature.content.replace(/<[^>]*>/g, '');
    }
    await I.haveSetting('io.ox/mail//defaultSignature', signatures[0].id);
    await I.haveSetting('io.ox/mail//messageFormat', 'text');

    I.login('app=io.ox/mail');
    I.waitForVisible('.io-ox-mail-window');

    I.clickToolbar('Compose');
    I.waitForVisible('.io-ox-mail-compose textarea.plain-text');
    I.wait(1);
    expect(await I.grabValueFrom('.io-ox-mail-compose textarea.plain-text')).to.equal(`\n\n${signatures[0].plaintext}`);

    await selectAndAssertSignature(I, 'Second signature above', `\n\n${signatures[1].plaintext}`);
    await selectAndAssertSignature(I, 'First signature below', `\n\n${signatures[2].plaintext}`);
    await selectAndAssertSignature(I, 'Second signature below', `\n\n${signatures[3].plaintext}`);
    await selectAndAssertSignature(I, 'No signature', '');
    await selectAndAssertSignature(I, 'First signature above', `\n\n${signatures[0].plaintext}`);

    // insert some text
    I.click('.io-ox-mail-compose textarea.plain-text');
    I.pressKey(['Up arrow', 'Up arrow', 'some user input']);
    expect(await I.grabValueFrom('.io-ox-mail-compose textarea.plain-text')).to.equal(`some user input\n\n${signatures[0].plaintext}`);

    await selectAndAssertSignature(I, 'Second signature above', `some user input\n\n${signatures[1].plaintext}`);
    await selectAndAssertSignature(I, 'First signature below', `some user input\n\n${signatures[2].plaintext}`);
    await selectAndAssertSignature(I, 'Second signature below', `some user input\n\n${signatures[3].plaintext}`);
    await selectAndAssertSignature(I, 'No signature', 'some user input');
    await selectAndAssertSignature(I, 'First signature above', `some user input\n\n${signatures[0].plaintext}`);

    // discard mail
    I.click('Discard');
    I.click('Discard message');
    I.waitForVisible('.io-ox-mail-window');

    I.logout();
});

Scenario('compose new mail with signature below correctly placed initially', async function (I) {
    for (let signature of signatures) {
        var response = await I.haveSnippet(signature);
        signature.id = response.data;
        signature.plaintext = signature.content.replace(/<[^>]*>/g, '');
    }
    await I.haveSetting('io.ox/mail//defaultSignature', signatures[2].id);
    await I.haveSetting('io.ox/mail//messageFormat', 'text');

    I.login('app=io.ox/mail');
    I.waitForVisible('.io-ox-mail-window');

    I.clickToolbar('Compose');
    I.waitForVisible('.io-ox-mail-compose textarea.plain-text');
    I.wait(1);
    expect(await I.grabValueFrom('.io-ox-mail-compose textarea.plain-text')).to.equal(`\n\n${signatures[2].plaintext}`);

    // discard mail
    I.click('Discard');
    I.waitForVisible('.io-ox-mail-window');

    I.logout();
});

Scenario('Reply to mail with signature above correctly placed and changed', async function (I, users) {
    let [user] = users;
    for (let signature of signatures) {
        var response = await I.haveSnippet(signature);
        signature.id = response.data;
        signature.plaintext = signature.content.replace(/<[^>]*>/g, '');
    }
    await I.haveSetting('io.ox/mail//defaultSignature', signatures[0].id);
    await I.haveSetting('io.ox/mail//messageFormat', 'text');
    await I.haveMail(getTestMail(user));

    I.login('app=io.ox/mail');
    I.waitForVisible('.io-ox-mail-window');

    // click on first email
    I.click('.io-ox-mail-window .leftside ul li.list-item');
    I.waitForVisible('.io-ox-mail-window .mail-detail-pane .subject');
    expect(await I.grabTextFrom('.io-ox-mail-window .mail-detail-pane .subject')).to.equal('Test subject');

    // reply to that mail
    I.click('Reply');
    I.waitForVisible('.io-ox-mail-compose textarea.plain-text');
    I.wait(1);
    expect(await I.grabValueFrom('.io-ox-mail-compose textarea.plain-text')).to.match(
        new RegExp(`^\\n\\n${signatures[0].plaintext}\\n\\n(>[^\\n]*(\\n)?)+$`)
    );

    await selectAndAssertSignature(I, 'Second signature above', new RegExp(`^\\n\\n${signatures[1].plaintext}\\n\\n(>[^\\n]*(\\n)?)+$`));
    await selectAndAssertSignature(I, 'First signature below', new RegExp(`^\\n\\n(>[^\\n]*(\\n)?)+\\n\\n${signatures[2].plaintext}$`));
    await selectAndAssertSignature(I, 'Second signature below', new RegExp(`^\\n\\n(>[^\\n]*(\\n)?)+\\n\\n${signatures[3].plaintext}$`));
    await selectAndAssertSignature(I, 'No signature', /^\n\n(>[^\n]*(\n)?)+$/);
    await selectAndAssertSignature(I, 'First signature above', new RegExp(`^\\n\\n${signatures[0].plaintext}\\n\\n(>[^\\n]*(\\n)?)+$`));

    // insert some text at the very beginning
    I.click('.io-ox-mail-compose textarea.plain-text');
    I.pressKey(['PageUp', 'some user input']);
    expect(await I.grabValueFrom('.io-ox-mail-compose textarea.plain-text')).to.match(
        new RegExp(`^some user input\\n\\n${signatures[0].plaintext}\\n\\n(>[^\\n]*(\\n)?)+$`)
    );

    await selectAndAssertSignature(I, 'Second signature above', new RegExp(`^some user input\\n\\n${signatures[1].plaintext}\\n\\n(>[^\\n]*(\\n)?)+$`));
    await selectAndAssertSignature(I, 'First signature below', new RegExp(`^some user input\\n\\n(>[^\\n]*(\\n)?)+\\n\\n${signatures[2].plaintext}$`));
    await selectAndAssertSignature(I, 'Second signature below', new RegExp(`^some user input\\n\\n(>[^\\n]*(\\n)?)+\\n\\n${signatures[3].plaintext}$`));
    await selectAndAssertSignature(I, 'No signature', /^some user input\n\n(>[^\n]*(\n)?)+$/);
    await selectAndAssertSignature(I, 'First signature above', new RegExp(`^some user input\\n\\n${signatures[0].plaintext}\\n\\n(>[^\\n]*(\\n)?)+$`));

    // discard mail
    I.click('Discard');
    I.click('Discard message');
    I.waitForVisible('.io-ox-mail-window');

    I.logout();
});

Scenario('reply to mail with signature below correctly placed initially', async function (I, users) {
    let [user] = users;
    for (let signature of signatures) {
        var response = await I.haveSnippet(signature);
        signature.id = response.data;
        signature.plaintext = signature.content.replace(/<[^>]*>/g, '');
    }
    await I.haveSetting('io.ox/mail//defaultSignature', signatures[2].id);
    await I.haveSetting('io.ox/mail//messageFormat', 'text');
    await I.haveMail(getTestMail(user));

    I.login('app=io.ox/mail');
    I.waitForVisible('.io-ox-mail-window');

    // click on first email
    I.click('.io-ox-mail-window .leftside ul li.list-item');
    I.waitForVisible('.io-ox-mail-window .mail-detail-pane .subject');
    expect(await I.grabTextFrom('.io-ox-mail-window .mail-detail-pane .subject')).to.equal('Test subject');

    // reply to that mail
    I.click('Reply');
    I.waitForVisible('.io-ox-mail-compose textarea.plain-text');
    I.wait(1);
    expect(await I.grabValueFrom('.io-ox-mail-compose textarea.plain-text')).to.match(
        new RegExp(`^\\n\\n(>[^\\n]*(\\n)?)+\\n\\n${signatures[2].plaintext}$`)
    );

    // discard mail
    I.click('Discard');
    I.waitForVisible('.io-ox-mail-window');

    I.logout();
});
