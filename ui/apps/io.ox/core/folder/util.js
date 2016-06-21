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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/folder/util', [
    'io.ox/core/api/account',
    'settings!io.ox/mail',
    'settings!io.ox/core'
], function (account, mailSettings, coreSettings) {

    'use strict';

    // magic permission check
    function perm(bits, offset) {
        return (bits >> offset) & (offset >= 28 ? 1 : 127);
    }

    function bits(data, offset) {
        return perm(_.firstOf(data.own_rights, data, 0), offset || 0);
    }

    function getDefaultFolder(type) {
        type = type || 'mail';
        return type === 'mail' ? mailSettings.get('folder/inbox') : coreSettings.get('folder/' + type);
    }

    //
    // Is?
    //

    function is(type, data) {

        var result, i = 0, id = '', $i, folders;

        // check multiple folder?
        if (_.isArray(data)) {
            // for multiple folders, all folders must satisfy the condition
            return _(data).reduce(function (memo, o) {
                return memo && is(type, o);
            }, true);
        }

        // split? (OR)
        if (type.search(/\|/) > -1) {
            var types = type.split(/\|/);
            for ($i = types.length, result = false; i < $i; i++) {
                if (is(types[i], data)) {
                    result = true;
                    break;
                }
            }
            return result;
        }

        // is?
        switch (type) {
            case 'private':
                return data.type === 1;
            case 'public':
                // special file folder: regard as public
                return data.type === 2 || /^(10|14|15)$/.test(data.id);
            case 'shared':
                return data.type === 3;
            case 'system':
                // some folders have legacy type 7 but are actually system folders, so check module too
                return data.type === 5 || data.module === 'system';
            case 'trash':
                // some trash folders have the legacy type 7, so check standard_folder_type too
                return data.type === 16 || data.standard_folder_type === 12;
            case 'mail':
                return data.module === 'mail';
            case 'messaging':
                return data.module === 'messaging';
            case 'calendar':
                return data.module === 'calendar';
            case 'contacts':
                return data.module === 'contacts';
            case 'tasks':
                return data.module === 'tasks';
            case 'infostore':
            case 'files':
            case 'drive':
                return data.module === 'infostore';
            case 'account':
                return data.module === 'system' && /^default(\d+)?/.test(String(data.id));
            case 'unifiedfolder':
                if (data) id = data.id !== undefined ? data.id : data;
                return account.isUnifiedFolder(id);
            case 'external':
                return (/^default[1-9]/).test(String(data.id)) && !is('unifiedmail', data);
            case 'defaultfolder':
                // standardfolders of external accounts are not in the settings, so use account api first
                if (account.getType(data.id)) return true;

                // get default folder
                folders = mailSettings.get('folder');
                for (id in folders) {
                    if (folders[id] === data.id) return true;
                }
                return false;
            case 'insideDefaultfolder':
                // get default folder
                folders = mailSettings.get('folder');
                for (id in folders) {
                    // folder starts with defaultfolder id
                    if (data.id.indexOf(folders[id]) === 0) return true;
                }
                return false;
            case 'published':
                return !!data['com.openexchange.publish.publicationFlag'];
            case 'subscribed':
                return !!data['com.openexchange.subscribe.subscriptionFlag'];
            case 'unlocked':
            case 'shared-by-me':
                // maybe need a better word. It's shared TO others
                if (!data.permissions || data.permissions.length <= 1) return false;
                // only shared BY me, not TO me
                return data.type === 1 || data.type === 7 || (data.module === 'infostore' && data.created_by === ox.user_id);
            case 'hidden':
                var hash = coreSettings.get(['folder/hidden'], {});
                id = _.isObject(data) ? data.id : data;
                return hash[id] === true;
            case 'attachmentView':
                var attachmentView = coreSettings.get('folder/mailattachments', {});

                return _.isEmpty(attachmentView) ? false : (_.values(attachmentView).indexOf(data.id) > -1);
            default:
                return false;
        }
    }

    //
    // Special case
    //

    function canMove(folder, target) {

        // new target?
        if (folder.folder_id === target.id) return false;
        // Prevent moving into folder itself
        if (folder.id === target.id) return false;
        // Prevent moving shared folders
        if (folder.type === 3 || target.type === 3) return false;
        // Prevent moving system folders
        if (folder.type === 5) return false;
        // Prevent moving default folders
        if (is('defaultfolder', folder)) return false;
        // Prevent moving private folders to other folders than private folders
        if (folder.type === 1 && target.type !== 1 && target.id !== 1 && (target.type !== 7)) return false;
        // Prevent moving public folders to other folders than public folders
        if (folder.type === 2 && target.type !== 2 && !(target.id in { 2: 1, 10: 1, 15: 1 })) return false;
        // Prevent moving folders to other not allowed modules
        if (folder.module !== target.module) return false;
        // Check rights Admin right source folder and create subfolders in target
        if (!can('create:folder', folder) || !can('create:folder', target)) return false;

        return true;
    }

    //
    // Can?
    //

    function can(action, data, obj) {
        // check multiple folder?
        if (_.isArray(data)) {
            // for multiple folders, all folders must satisfy the condition
            return _(data).reduce(function (memo, folder) {
                return memo && can(action, folder, obj);
            }, true);
        }
        // vars
        var rights = data.own_rights,
            bits,
            isSystem = data.standard_folder || is('system', data),
            isAdmin = perm(rights, 28) === 1,
            isMail = data.module === 'mail',
            // is my folder ?
            compareValue = (obj && ox.user_id !== _.firstOf(obj.created_by, 0)) ? 1 : 0;
        // switch
        switch (action) {
            case 'read':
                // can read objects? (see bug 28379 and 23933 and 44957)
                // hide folders where your only permission is to see the foldername (rights !== 1)
                return perm(rights, 7) > 0 && rights !== 1;
            case 'create':
                // can create objects?
                // only folder creation is allowed in system folders
                // don't use the isSystem variable because it is also true for standard folders
                if (is('system', data)) return false;
                // mail is special (no-select folder; see bug 44957)
                if (isMail && !can('read', data)) return false;
                // even if permission bit is 4 "create objects and subfolders" because
                // there is no bit for only create subfolders, see Bug 39598
                return perm(rights, 0) > 1;
            case 'write':
                // can write objects
                return perm(rights, 14) > compareValue;
            case 'delete':
                // can delete objects
                return perm(rights, 21) > compareValue;
            case 'rename':
            case 'rename:folder':
                // can rename?
                // for mail we can check bit 30
                if (isMail) return perm(rights, 30) === 1;
                // for all other apps: if we have admin privileges
                // and it's not a system folder, we can rename the folder
                return isAdmin && !isSystem;
            case 'create:folder':
                // check 3rd bit (value is 4! see http://oxpedia.org/wiki/index.php?title=HTTP_API#PermissionFlags)
                // backend promised that it's sufficient to check this bit; isAdmin would be wrong here
                bits = perm(rights, 0);
                return (bits & 4) === 4 || (bits & 64) === 64;
            case 'delete:folder':
            case 'remove:folder':
                // must be admin; system and default folder cannot be deleted
                return isAdmin && !isSystem && !is('defaultfolder', data);
            case 'move:folder':
                return canMove(data, obj);
            case 'import':
                // import data
                return (rights & 127) >= 2 && is('calendar|contacts|tasks', data);
            case 'export':
                // export data (not allowed for shared folders)
                return !is('shared', data) && is('contacts|calendar|tasks', data);
            case 'empty':
                // empty folder
                return (rights >> 21 & 127) && is('mail', data);
            case 'changepermissions':
            case 'change:permissions':
                return isAdmin;
            case 'viewproperties':
                // view properties
                return !isMail && !is('account', data) && (data.capabilities & 1);
            case 'publish':
                // check folder capability
                if (_(data.supported_capabilities).indexOf('publication') === -1) return false;
                // contact?
                if (data.module === 'contacts') return true;
                // files?
                return data.module === 'infostore' && can('create', data) && rights !== 1 && rights !== 4;
            case 'subscribe':
                // check folder capability
                if (_(data.supported_capabilities).indexOf('subscription') === -1) return false;
                // check rights
                return (/^(contacts|calendar|infostore)$/).test(data.module) && can('write', data);
            case 'subscribe:imap':
                // subscription works for mail only, not for standard folders, and only if the mail system supports it
                if (!isMail) return false;
                if (data.standard_folder && /^(7|9|10|11|12)$/.test(data.standard_folder_type)) return false;
                return Boolean(data.capabilities & Math.pow(2, 4));
            default:
                return false;
        }
    }

    /*
     * Expects a TreeNodeView and expands this view and all parent views.
     */
    function open(view) {
        if (!view) return;
        if (!view.toggle) return;

        view.toggle('open');
        if (view.options) open(view.options.parent);
    }

    return {
        perm: perm,
        bits: bits,
        is: is,
        can: can,
        getDefaultFolder: getDefaultFolder,
        open: open
    };
});
