/*
 *
 * @copyright Copyright (c) OX Software GmbH, Germany <info@open-xchange.com>
 * @license AGPL-3.0
 *
 * This code is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with OX App Suite. If not, see <https://www.gnu.org/licenses/agpl-3.0.txt>.
 *
 * Any use of the work other than as authorized under this license or copyright law is prohibited.
 *
 */

/// <reference path="../../steps.d.ts" />
Feature('Chat > Search');

Before(async ({ users }) => {
    await Promise.all([
        users.create(),
        users.create()
    ]);
    await users[0].context.hasCapability('chat');
});

After(async ({ users }) => {
    await users[0].context.doesntHaveCapability('chat');
    await users.removeAll();
});

Scenario.skip('Search for a word - full text', async ({ I, users, chat }) => {
    await users.create();

    const groupTitle = 'Test Group';
    const emails = [users[1].userdata.email1, users[2].userdata.email1];

    I.login({ user: users[0] });
    chat.openChat();
    chat.createPrivateChat(users[1].userdata.email1);
    chat.sendMessage('Berlin Bangkok Brisbane');

    I.click('~Close chat', '.ox-chat');

    I.click('New Chat');
    I.clickDropdown('Group chat');
    chat.fillNewGroupForm(groupTitle, emails);
    I.click(locate({ css: 'button' }).withText('Create chat'), '.ox-chat-popup');
    I.waitForDetached('.modal-dialog');
    chat.sendMessage('Kairo Mumbai Berlin Lima');
    chat.sendMessage('Berlin');

    I.click('~Close chat', '.ox-chat');

    I.waitForElement('~Search or start new chat', 3, '.ox-chat');
    I.fillField('~Search or start new chat', 'Berlin');

    // find in 2xprivate and group
});

Scenario('Search for a user and a private chat', async ({ I, users, chat }) => {
    I.login({ user: users[0] });
    chat.openChat();
    I.waitForText('New Chat', 30);

    I.waitForElement('~Search or start new chat', 5, '.ox-chat');
    I.fillField('~Search or start new chat', users[1].userdata.given_name);
    I.waitForElement(`.search-result li[data-email="${users[1].userdata.email1}"]`, 5, '.ox-chat');
    I.click(`.search-result li[data-email="${users[1].userdata.email1}"]`, '.ox-chat');
    I.waitForElement('.ox-chat .controls');
    chat.sendMessage('Hey!');

    I.click('~Close chat', '.ox-chat');
    I.waitForElement('~Search or start new chat', 3, '.ox-chat');
    I.fillField('~Search or start new chat', users[1].userdata.sur_name);

    I.waitForElement(`.search-result li[data-email="${users[1].userdata.email1}"]`, 10, '.ox-chat');
    I.click(`.search-result li[data-email="${users[1].userdata.email1}"]`, '.ox-chat');
    I.waitForText('Hey!', 3, '.ox-chat .messages');
});

Scenario('Search for a group name', async ({ I, users, chat }) => {
    await users.create();

    const groupTitle = 'Test Group';
    const emails = [users[1].userdata.email1, users[2].userdata.email1];

    I.login({ user: users[0] });
    chat.openChat();
    I.waitForText('New Chat', 30);

    I.click('New Chat');
    I.clickDropdown('Group chat');
    chat.fillNewGroupForm(groupTitle, emails);
    I.click(locate('.btn-primary').withText('Create chat'));
    I.waitForDetached('.modal-dialog');
    I.waitForElement('~Close chat', 3, '.ox-chat');
    I.click('~Close chat', '.ox-chat');


    I.waitForElement('~Search or start new chat', 3, '.ox-chat');
    I.fillField('~Search or start new chat', groupTitle);
    I.waitForText(groupTitle, 5, '.ox-chat .search-result');
    I.retry(3).click(locate('.title').withText(groupTitle), '.ox-chat .search-result');
    I.waitForElement('.message.system', 3, '.ox-chat');
    I.seeNumberOfVisibleElements('.message.system', 2);
});

Scenario('Search for a channel name', async ({ I, users, contexts, chat, dialogs }) => {
    const context = await contexts.create();
    context.hasCapability('chat');
    const alice = await users.create(users.getRandom(), context);
    const bob = await users.create(users.getRandom(), context);

    const channelTitleA = 'Channel A ' + (+new Date());
    const channelTitleB = 'Channel B ' + (+new Date());

    await session('Alice', async () => {
        I.login({ user: alice });
        chat.openChat();
        I.waitForText('New Chat', 30);
        I.click('New Chat');
        I.clickDropdown('Channel');
        chat.fillNewChannelForm(channelTitleA);
        dialogs.clickButton('Create channel');
        I.waitForDetached('.modal-dialog');
        I.waitForElement('.ox-chat .controls');
        chat.sendMessage('Berlin Lima');
        I.waitForElement('~Close chat', 3, '.ox-chat');
        I.click('~Close chat', '.ox-chat');

        I.waitForText('New Chat', 30);
        I.click('New Chat');
        I.clickDropdown('Channel');
        chat.fillNewChannelForm(channelTitleB);
        dialogs.clickButton('Create channel');
        I.waitForDetached('.modal-dialog');
        I.waitForElement('.ox-chat .controls');
        chat.sendMessage('Berlin Lima');
        I.waitForElement('~Close chat', 3, '.ox-chat');
        I.click('~Close chat', '.ox-chat');

        I.waitForElement('~Search or start new chat', 3, '.ox-chat');
        I.fillField('~Search or start new chat', 'Channel');
        I.waitForElement(locate('.title').withText(channelTitleA), 3, '.ox-chat .search-result');
        I.waitForElement(locate('.title').withText(channelTitleB), 3, '.ox-chat .search-result');
        I.fillField('~Search or start new chat', channelTitleA);
        I.waitForInvisible(locate('.title').withText(channelTitleB), 3, '.ox-chat .search-result');
        I.retry(5).click(locate('.title').withText(channelTitleA), '.ox-chat .search-result');
        I.waitForElement('.message.system', 3, '.ox-chat');
        I.seeNumberOfVisibleElements('.message.system', 2);
    });

    await session('Bob', async () => {
        I.login({ user: bob });
        chat.openChat();
        I.waitForText('New Chat', 30);
        I.waitForElement('~Search or start new chat', 3, '.ox-chat');
        I.fillField('~Search or start new chat', channelTitleA);
        I.waitForText('No search results', 5, '.ox-chat .search-result');
    });

    await context.remove();
});
