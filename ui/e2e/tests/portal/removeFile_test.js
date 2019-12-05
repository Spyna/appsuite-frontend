/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2019 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Olena Stute <olena.stute@open-xchange.com>
 */

/// <reference path="../../steps.d.ts" />

Feature('Portal');

Before(async (users) => {
    await users.create();
});
After(async (users) => {
    await users.removeAll();
});

Scenario('[C7486] Remove a file', async (I, users) => {

    // Add a file to drive
    const infostoreFolderID = await I.grabDefaultFolder('infostore', { user: users[0] });
    await I.haveFile(infostoreFolderID, 'e2e/media/files/generic/testdocument.odt');

    // clear the portal settings
    await I.haveSetting('io.ox/portal//widgets/user', '{}');

    //Add a file to portal as a widget
    I.login('app=io.ox/files');
    I.waitForElement('.file-list-view.complete');
    I.click('.file-list-view.complete li.list-item[aria-label^="testdocument.odt"]');

    I.clickToolbar('.io-ox-files-main .classic-toolbar li.more-dropdown');
    I.waitForElement('.dropdown-menu.dropdown-menu-right li >a[data-action="io.ox/files/actions/add-to-portal"]');
    I.click('Add to portal');

    //Verify file widget on Portal
    I.openApp('Portal');
    I.waitForVisible('.io-ox-portal');
    I.waitForElement('~testdocument.odt');

    // remove file widget from portal
    I.click('~testdocument.odt, Disable widget');
    I.waitForVisible({ css: '.modal-dialog' });
    I.click('Delete', '.modal-dialog');

    // verify that the file widget is removed
    I.dontSee('~testdocument.odt');
    I.click('Customize this page');
    I.waitForText('Portal settings');
    I.dontSee('testdocument.odt');
});
