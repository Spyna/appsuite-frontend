/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/folder/actions/common',
    ['io.ox/mail/api',
     'io.ox/core/api/folder',
     'io.ox/core/tk/dialogs',
     'io.ox/core/notifications',
     'gettext!io.ox/core'], function (mailAPI, folderAPI, dialogs, notifications, gt) {

    'use strict';

    return {

        markFolderSeen: function (e) {
            mailAPI.allSeen(e.data.folder);
        },

        expungeFolder: function (e) {
            // get current folder id
            var folder = e.data.folder;
            notifications.yell('busy', gt('Cleaning up... This may take a few seconds.'));
            mailAPI.expunge(folder).done(function () {
                notifications.yell('success', gt('The folder has been cleaned up.'));
            });
        },

        clearFolder: function (e) {
            var baton = e.data.baton,
            id = _(baton.app.folderView.selection.get()).first();
            folderAPI.get({ folder: id }).done(function (folder) {
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
    };
});
