/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2020 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Anne Matthes <anne.matthes@open-xchange.com>
 */
/// <reference path="../../steps.d.ts" />

const { expect } = require('chai');

Feature('Chat commands and emojis');

Before(async (users) => {
    await Promise.all([
        users.create(),
        users.create()
    ]);
    await users[0].context.hasCapability('chat');
});

After(async (users) => {
    await Promise.all([
        users.removeAll()
    ]);
});

Scenario('Send emojis', async (I, users, chat) => {
    await session('Alice', async () => {
        I.login({ user: users[0] });
        chat.createPrivateChat(users[1].userdata.email1);

        I.waitForElement('.controls');
        I.fillField('~Message', ':)');
        I.pressKey('Enter');
        I.waitForElement('.only-emoji .emoji', 3, '.ox-chat .messages');
        expect((await I.grabCssPropertyFrom('.only-emoji .emoji', 'font-size'))[0]).to.equal('40px');

        I.waitForElement('.controls');
        I.fillField('~Message', 'Some text and :)');
        I.pressKey('Enter');
        expect((await I.grabCssPropertyFrom('.contains-emoji:not(.only-emoji) .emoji', 'font-size'))[0]).to.equal('22px');

        I.click('~Detach window', '.chat-rightside');
        I.click('Add emoji', '.ox-chat');
        I.waitForElement('.emoji-picker', 3, '.ox-chat');
        I.click('.emoji-icons button', '.ox-chat');
        I.click('~Send', '.ox-chat');

        I.retry(3).seeNumberOfVisibleElements('.ox-chat .messages .emoji', 3);
    });
});

Scenario('User can be mentioned via @', async (I, users, chat) => {
    await session('Alice', async () => {
        I.login({ user: users[0] });
        chat.createPrivateChat(users[1].userdata.email1);

        I.waitForElement('.controls');
        I.fillField('~Message', `@${users[1].userdata.sur_name} can you update?`);
        I.pressKey('Enter');
        I.waitForElement('.mention:not(.me)', 3, '.ox-chat .messages');
        I.fillField('~Message', `@${users[0].userdata.sur_name} has to check the feature.`);
        I.pressKey('Enter');
        I.waitForElement('.mention.me', 3, '.ox-chat .messages');
    });
});
