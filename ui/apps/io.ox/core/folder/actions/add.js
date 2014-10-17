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
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/folder/actions/add',
    ['io.ox/core/folder/api',
     'io.ox/core/tk/dialogs',
     'io.ox/core/extensions',
     'io.ox/core/notifications',
     'gettext!io.ox/core'
    ], function (api, dialogs, ext, notifications, gt) {

    'use strict';

    /**
     * @param folder {string} (optional) folder id
     * @param title {string} (optional) title
     * @param opt {object} (optional) options object can contain only
     * a module name, for now
     */
    function add(folder, title, opt) {

        var opt = opt || {}, invalid = false;

        // check for valid filename
        ext.point('io.ox/core/filename')
            .invoke('validate', null, title, 'folder')
            .find(function (result) {
                if (result !== true) {
                    notifications.yell('warning', result);
                    return (invalid = true);
                }
            });

        if (invalid) return $.Deferred().reject();

        // call API
        return api.create(folder, {
            title: $.trim(title),
            module: opt.module
        })
        .fail(notifications.yell);
    }

    function getTitle(folder, module) {
        if (module === 'mail' || module === 'infostore') {
            return gt('New subfolder');
        }
        else if (folder === '2') {
            return module === 'calendar' ? gt('New public calendar') : gt('New public folder');
        }
        else {
            return module === 'calendar' ? gt('New private calendar') : gt('New private folder');
        }
    }

    function getName(module) {
        return module === 'calendar' ? gt('New calendar') : gt('New folder');
    }

    /**
     * @param folder {string} (optional) folder id
     * @param opt {object} (optional) options object - will be forwarded
     * to folder API
     */
    return function (folder, opt) {

        if (!folder) return;

        folder = String(folder);
        opt = opt || {};

        new dialogs.ModalDialog({
            async: true,
            width: 400,
            enter: 'add'
        })
        .header(
            $('<h4>').text(getTitle(folder, opt.module))
        )
        .build(function () {
            var guid = _.uniqueId('label_');
            this.getContentNode().append(
                $('<div class="form-group">').append(
                    $('<label class="sr-only">').text(gt('Folder name')).attr('for', guid),
                    $('<input type="text" class="form-control">').attr({ id: guid, placeholder: gt('Folder name') })
                )
            );
        })
        .addPrimaryButton('add', gt('Add'))
        .addButton('cancel', gt('Cancel'))
        .on('add', function () {
            add(folder, this.getContentNode().find('input').val(), opt)
                .then(this.close, this.idle);
        })
        .show(function () {
            this.find('input').val(getName(opt.module)).focus().select();
        });
    };
});
