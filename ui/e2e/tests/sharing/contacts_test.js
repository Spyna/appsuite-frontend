/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2019 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Julian Bäume <julian.baeume@open-xchange.com>
 *
 */

/// <reference path="../../steps.d.ts" />

Feature('Sharing');

Before(async (users) => {
    await users.create();
    await users.create();
});

After(async (users) => {
    await users.removeAll();
});

Scenario('[C104306] contact folders using “Permisions” dialog and sharing link', async (I, users, contacts, mail) => {
    let url;
    // Alice shares a folder with 2 contacts
    session('Alice', async () => {
        const defaultFolder = await I.grabDefaultFolder('contacts');
        await Promise.all([
            I.haveContact({ display_name: 'Wonderland, Alice', folder_id: defaultFolder, first_name: 'Alice', last_name: 'Wonderland' }),
            I.haveContact({ display_name: 'Builder, Bob', folder_id: defaultFolder, first_name: 'Bob', last_name: 'Builder' })
        ]);

        I.login('app=io.ox/contacts');
        contacts.waitForApp();
        I.waitForText('My address books');
        I.click('.folder-arrow', '~My address books');

        I.openFolderMenu('Contacts');
        I.clickDropdown('Permissions / Invite people');

        I.waitForText('Permissions for folder');
        I.click('~Select contacts');
        I.waitForElement('.modal .list-view.address-picker li.list-item');
        I.fillField('Search', users[1].get('name'));
        I.waitForText(users[1].get('name'), 5, '.address-picker');
        I.waitForText(users[1].get('primaryEmail'));
        I.click(users[1].get('primaryEmail'), '.address-picker .list-item');
        I.click({ css: 'button[data-action="select"]' });
        I.waitForDetached('.address-picer');
        I.waitForElement(locate('.permissions-view .row').at(2));
        I.click('Author');
        I.clickDropdown('Viewer');

        I.click('Save', '.modal');
        I.waitForDetached('.modal');

        I.openFolderMenu('Contacts');
        I.clickDropdown('Create sharing link');
        I.waitForText('Sharing link created for folder');
        I.waitForFocus('.share-wizard input[type="text"]');
        url = await I.grabValueFrom('.share-wizard input[type="text"]');
        url = Array.isArray(url) ? url[0] : url;
        I.click('Close');
    });

    // Bob receives the share
    session('Bob', () => {
        I.login('app=io.ox/mail', { user: users[1] });
        mail.waitForApp();
        I.waitForText('has shared the folder', undefined, '.list-view');
        I.click(locate('li.list-item'));
        I.waitForElement('.mail-detail-frame');
        within({ frame: '.mail-detail-frame' }, () => {
            I.waitForText('View folder');
            I.click('View folder');
        });

        I.waitForText('Builder', 30, '.io-ox-contacts-window');
        I.waitForVisible('li[aria-label="Shared address books"] .subfolders .folder.selectable');
        I.see(`${users[0].get('sur_name')}, ${users[0].get('given_name')}: Contacts`, '.folder-tree');
        I.seeNumberOfElements(locate('.contact.vgrid-cell').inside('.io-ox-contacts-window'), 2);
        I.see('Wonderland', '.io-ox-contacts-window');

        // check for missing edit rights
        I.seeElement(locate('.io-ox-contacts-window .classic-toolbar a.disabled').withText('Edit'));
    });

    // Eve uses external link to shared folder
    session('Eve', () => {
        I.amOnPage(url);
        contacts.waitForApp();
        I.waitForText(`${users[0].get('sur_name')}, ${users[0].get('given_name')}: Contacts`, 5, '.folder-tree');
        // I.seeNumberOfElements(locate('.contact.vgrid-cell').inside('.io-ox-contacts-window'), 4);
        I.waitForText('Builder', 5, '.vgrid');
        I.see('Wonderland', '.vgrid');

        // check for missing edit rights
        I.seeElement(locate('.io-ox-contacts-window .classic-toolbar a.disabled').withText('Edit'));
    });

    session('Alice', () => {
        I.openFolderMenu('Contacts');
        I.clickDropdown('Permissions / Invite people');
        I.waitForElement('.btn[title="Actions"]');
        I.click('.btn[title="Actions"]');
        I.clickDropdown('Revoke access');
        I.click('Save');
        I.waitToHide('.modal');

        I.click({ css: '.folder-tree [title="Actions for Contacts"]' });
        I.clickDropdown('Create sharing link');
        I.waitForText('Sharing link created for folder');
        I.waitForFocus('.share-wizard input[type="text"]');
        I.click('Remove link');
        I.waitForDetached('.modal');
        I.waitForText('The link has been removed');
    });

    session('Bob', () => {
        I.triggerRefresh();
        I.retry(5).seeNumberOfElements(locate('.contact').inside('.io-ox-contacts-window'), 0);
        I.dontSee('Builder', '.io-ox-contacts-window');
        I.dontSee('Wonderland', '.io-ox-contacts-window');
    });

    session('Eve', () => {
        I.amOnPage(url);
        I.waitForText('The share you are looking for does not exist.');
    });
});
