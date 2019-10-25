/**
* This work is provided under the terms of the CREATIVE COMMONS PUBLIC
* LICENSE. This work is protected by copyright and/or other applicable
* law. Any use of the work other than as authorized under this license
* or copyright law is prohibited.
*
* http://creativecommons.org/licenses/by-nc-sa/2.5/
* © 2019 OX Software GmbH, Germany. info@open-xchange.com
*
* @author Francisco Laguna <francisco.laguna@open-xchange.com>
*/

/// <reference path="../../../steps.d.ts" />

Feature('Mail Compose');

Before(async (users) => {
    await users.create(); // The user running the test
    await users.create(); // 1st member of distributionlist
    await users.create(); // 2nd member of distributionlist
    await users.create(); // another user, addressed individually
});
After(async (users) => {
    await users.removeAll();
});

Scenario('[C85622] Address Book Popup', async (I, users) => {
    // Preparation
    // Create Distributionlist
    await I.haveSetting('io.ox/mail//features/registerProtocolHandler', false);
    // Log in and switch to mail app
    I.login('app=io.ox/mail');
    // Create distributionlist
    var distribution_list = [
        { display_name: users[1].get('display_name'), mail: users[1].get('primaryEmail'), mail_field: 0 },
        { display_name: users[2].get('display_name'), mail: users[2].get('primaryEmail'), mail_field: 0 }
    ];
    await I.executeAsyncScript(function (distribution_list, done) {
        require(['settings!io.ox/core', 'io.ox/contacts/api'], function (settings, contacts) {
            contacts.create({
                mark_as_distributionlist: true,
                folder_id: settings.get('folder/contacts'),
                display_name: 'Erisian Disciples',
                distribution_list: distribution_list
            }).done(done);
        });
    }, distribution_list);
    I.waitForText('Compose');
    I.click('Compose');
    // Wait for the compose dialog
    I.waitForVisible('.io-ox-mail-compose textarea.plain-text,.io-ox-mail-compose .contenteditable-editor');

    // Enter everything but the last letter of the display name of user 3 in the To field
    // To make the autocomplete dropdown appear
    var displayName = users[3].get('display_name');
    var partialName = displayName.substring(0, displayName.length - 1);
    I.wait(1); // Wait for focus
    I.fillField('To', partialName);
    I.wait(1); // Wait for popup
    // Check that the dropdown with the user appeared
    I.see(displayName);
    // Click on the entry to add it to the To: field
    I.click(locate('div').withText(displayName).inside('.tt-dropdown-menu'));

    // Now let's do the same thing for the distribution list
    I.fillField('To', 'Erisian');
    I.wait(1); // Wait for popup
    I.see('Erisian Disciples');
    I.click(locate('div').withText('Erisian Disciples').inside('.tt-dropdown-menu'));

    // Verify we see the given_name + sur_name combination for users[3]
    I.see(users[3].get('given_name') + ' ' + users[3].get('sur_name'), '.tokenfield');
    // The display names of users[1] and users[2] (because that's how they were saved in the d-list)
    I.see(users[1].get('display_name'), '.tokenfield');
    I.see(users[2].get('display_name'), '.tokenfield');

    // Compose an email and send it
    I.fillField('Subject', 'Hail Eris! All Hail Discordia!');
    I.click('Send');
    I.waitForInvisible('.io-ox-mail-compose textarea.plain-text,.io-ox-mail-compose .contenteditable-editor');
    I.wait(1);
    // Verify the mail arrived at the other accounts
    [users[1], users[2], users[3]].forEach(function (current_user) {
        I.logout();
        I.login('app=io.ox/mail', { user: current_user });
        I.waitForText('Hail Eris! All Hail Discordia!', 5);
    });
});
