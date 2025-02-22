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
Feature('Chat > Appearance');

Before(async ({ users }) => {
    await users.create();
    await users[0].context.hasCapability('chat');
});

After(async ({ users }) => {
    await users[0].context.doesntHaveCapability('chat');
    await users.removeAll();
});

Scenario('Open, close and toggle chat', ({ I, chat }) => {
    I.login();
    chat.openChat();
    I.waitForElement('.io-ox-windowmanager-sticky-panel .ox-chat');
    I.waitForText('New Chat', 3, '.io-ox-windowmanager-sticky-panel .ox-chat');

    I.click('~Chat', '#io-ox-toprightbar');
    I.dontSee('New Chat');

    I.click('~Chat', '#io-ox-toprightbar');
    I.see('New Chat', '.io-ox-windowmanager-sticky-panel .ox-chat');

    I.click('~Detach window');
    I.see('Chat', '.floating-window');

    I.click('~Chat', '#io-ox-toprightbar');
    I.waitForDetached('Chat', 3, '.floating-window');

});
