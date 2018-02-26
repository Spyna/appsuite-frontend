/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2016 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Tobias Prinz <tobias.prinz@open-xchange.com>
 * @author Julian Bäume <julian.baeume@open-xchange.com>
 */

define('io.ox/tours/settings', [
    'io.ox/core/tk/wizard',
    'gettext!io.ox/tours'
], function (Tour, gt) {

    'use strict';

    /* Tour: Settings */
    Tour.registry.add({
        id: 'default/io.ox/settings',
        app: 'io.ox/settings',
        priority: 1
    }, function () {
        new Tour()
        .step()
            .title(gt('Opening the settings'))
            .content(gt('To open the settings, click the user image on the upper right side of the menu bar. Select Settings.'))
            .hotspot('#topbar-settings-dropdown a[data-name="io.ox/settings"]')
            .spotlight('#topbar-settings-dropdown a[data-name="io.ox/settings"]')
            .referTo('#topbar-settings-dropdown')
            .waitFor('.smart-dropdown-container #topbar-settings-dropdown a[data-name="io.ox/settings"]')
            .on('before:show', function () {
                // without smart-dropdowns onClick handler may cause hiding
                _.defer(function () {
                    $('#topbar-settings-dropdown:not(:visible)').dropdown('toggle');
                });
            })
            .on('hide', function () {
                $('#topbar-settings-dropdown:visible').dropdown('toggle');
            })
            .end()
        .step()
            .title(gt('How the settings are organized'))
            .content(gt('The settings are organized in topics. Select the topic on the left side, e.g Basic settings or E-Mail.'))
            .navigateTo('io.ox/settings/main')
            .waitFor('.io-ox-settings-window .folder-tree')
            .spotlight('.io-ox-settings-window .folder-tree')
            .end()
        .step()
            .title(gt('Editing settings'))
            .content(gt('Edit a setting on the right side. In most of the cases, the changes are activated immediately.'))
            .spotlight('.io-ox-settings-window .settings-detail-pane')
            .end()
        .step()
            .title(gt('Opening the help'))
            .content(gt('To open the help, click the user image on the upper right side of the menu bar. Select Help. The help for the currently selected app is displayed. To browse the complete help, click on Start Page or Table Of Contents at the upper part of the window.'))
            .hotspot('#topbar-settings-dropdown a.io-ox-context-help')
            .spotlight('#topbar-settings-dropdown a.io-ox-context-help')
            .referTo('#topbar-settings-dropdown')
            .waitFor('.smart-dropdown-container #topbar-settings-dropdown a.io-ox-context-help')
            .on('before:show', function () {
                $('#topbar-settings-dropdown:not(:visible)').dropdown('toggle');
            })
            .on('hide', function () {
                $('#topbar-settings-dropdown:visible').dropdown('toggle');
            })
            .end()
        .step()
            .title(gt('Signing out'))
            .content(gt('To sign out, click the System menu icon on the upper right side of the menu bar. Select Sign out.'))
            .hotspot('#topbar-settings-dropdown a[data-name="logout"]')
            .spotlight('#topbar-settings-dropdown a[data-name="logout"]')
            .referTo('#topbar-settings-dropdown')
            .waitFor('#topbar-settings-dropdown a[data-name="logout"]')
            .on('wait', function () {
                $('#topbar-settings-dropdown:not(:visible)').dropdown('toggle');
            })
            .on('hide', function () {
                $('#topbar-settings-dropdown:visible').dropdown('toggle');
            })
            .end()
        .start();
    });
});
