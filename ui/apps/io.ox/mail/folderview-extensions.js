/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2013 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Julian Bäume <julian.baeume@open-xchange.com>
 */

define('io.ox/mail/folderview-extensions',
    ['io.ox/core/extensions',
     'io.ox/core/api/folder',
     'io.ox/mail/api',
     'io.ox/core/notifications',
     'io.ox/core/capabilities',
     'gettext!io.ox/mail'
    ], function (ext, folderAPI, mailAPI, notifications, capabilities, gt) {

    'use strict';

    var POINT = 'io.ox/mail/folderview';

    function addAccount(e) {
        e.preventDefault();
        require(['io.ox/mail/accounts/settings'], function (m) {
            m.mailAutoconfigDialog(e);
        });
    }

    if (capabilities.has('multiple_mail_accounts')) {
        ext.point(POINT + '/sidepanel/links').extend({
            id: 'add-account',
            index: 300,
            draw: function () {
                if (_.device('!smartphone')) {
                    this.append($('<div>').append(
                        $('<a href="#" data-action="add-mail-account" tabindex="1" role="button">')
                        .text(gt('Add mail account'))
                        .on('click', addAccount)
                    ));
                }
            }
        });
    }

    function markFolderSeen(e) {
        e.preventDefault();
        mailAPI.allSeen(e.data.folder);
    }

    ext.point(POINT + '/sidepanel/context-menu').extend({
        id: 'mark-folder-read',
        index: 50,
        draw: function (baton) {
            this.append(
                $('<li>').append(
                    $('<a href="#" data-action="markfolderread" tabindex="1" role="menuitem">')
                        .text(gt('Mark all mails as read'))
                        .on('click', { folder: baton.data.id, app: baton.app }, markFolderSeen)
                )
            );
        }
    });

    function expungeFolder(e) {
        e.preventDefault();
        // get current folder id
        var folder = e.data.folder;
        notifications.yell('busy', gt('Cleaning up... This may take a few seconds.'));
        mailAPI.expunge(folder).done(function () {
            notifications.yell('success', gt('The folder has been cleaned up.'));
        });
    }

    ext.point(POINT + '/sidepanel/context-menu').extend({
        id: 'expunge',
        index: 75,
        draw: function (baton) {
            var link = $('<a href="#" data-action="expunge" role="menuitem">').text(gt('Clean up'));
            this.append($('<li>').append(link));
            if (folderAPI.can('delete', baton.data)) {
                link.attr('tabindex', 1).on('click', { folder: baton.data.id }, expungeFolder);
            } else {
                link.attr('aria-disabled', true).addClass('disabled').on('click', $.preventDefault);
            }
            this.append($('<li class="divider">'));
        }
    });

    function clearFolder(e) {
        e.preventDefault();

        var baton = e.data.baton,
        id = _(baton.app.folderView.selection.get()).first();
        $.when(
            folderAPI.get({ folder: id }),
            ox.load(['io.ox/core/tk/dialogs'])
        ).done(function (folder, dialogs) {
            new dialogs.ModalDialog()
                .text(gt('Do you really want to empty folder "%s"?', folderAPI.getFolderTitle(folder.title, 30)))
                .addPrimaryButton('delete', gt('Empty folder'), 'delete', {tabIndex: '1'})
                .addButton('cancel', gt('Cancel'), 'cancel', {tabIndex: '1'})
                .show()
                .done(function (action) {
                    if (action === 'delete') {
                        mailAPI.clear(id);
                    }
                });
        });
    }

    ext.point(POINT + '/sidepanel/context-menu').extend({
        id: 'clear',
        index: 450,
        draw: function (baton) {
            var link = $('<a href="#" data-action="clearfolder" role="menuitem">').text(gt('Empty folder'));
            this.append($('<li class="divider">'), $('<li>').append(link));
            if (folderAPI.can('delete', baton.data)) {
                link.attr('tabindex', 1).on('click', { baton: baton }, clearFolder);
            } else {
                link.attr('aria-disabled', true).addClass('disabled').on('click', $.preventDefault);
            }
        }
    });

});
