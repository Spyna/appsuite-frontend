/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2012
 * Mail: info@open-xchange.com
 *
 * @author David Bauer <david.bauer@open-xchange.com>
 */

define('io.ox/files/views/create', [
        'io.ox/core/tk/dialogs',
        'io.ox/core/extensions',
        'io.ox/files/api',
        'gettext!io.ox/files',
        'io.ox/core/tk/attachments',
        'io.ox/core/notifications'
    ], function (dialogs, ext, api, gt, attachments, notifications) {

        'use strict';

        var POINT = 'io.ox/files/create',

        show = function (app) {

            var $form = $('<form>', { 'accept-charset': 'UTF-8', enctype: 'multipart/form-data', method: 'POST' }),
            dialog = new dialogs.CreateDialog({ easyOut: true, width: 600, center: true});

            ext.point(POINT + '/form').invoke('draw', $form);

            $form.on('submit', function (e) { e.preventDefault(); saveFile(); });

            function saveFile() {
                var files = ($form.find('input[type="file"]').length > 0 ? $form.find('input[type="file"]')[0].files : []) || [],
                    folder = app.folder.get();
                if ($form.find('input[type="file"]').val()) {
                    api.uploadFile({
                        form: $form,
                        file: _(files).first(),
                        json: {
                            folder: folder,
                            description: $form.find('textarea').val(),
                            title: $form.find('input[type="text"]').val()
                        },
                        folder: folder
                    }).done(function (data) {
                        api.propagate('new', data);
                        notifications.yell('success', gt('This file has been added'));
                        dialog.close();
                    }).fail(function (e) {
                        if (e && e.code && (e.code === 'UPL-0005' || e.code === 'IFO-1700')) {
                            notifications.yell('error', gt(e.error, e.error_params[0], e.error_params[1]));
                        }
                        else if (e && e.code && e.code === 'FLS-0024') {
                            notifications.yell('error', gt('The allowed quota is reached.'));
                        }
                        else {
                            notifications.yell('error', gt('This file has not been added'));
                        }
                    });
                } else {
                    notifications.yell('error', gt('No file selected for upload.'));
                    dialog.idle();
                    $form.find('input[type="file"]').focus();
                }
            }

            dialog.header($('<h4>').text(gt('Add new file')));
            dialog.getBody().append($('<div>').addClass('row-fluid').append($form));
            dialog
                .addPrimaryButton('save', gt('Save'), 'save')
                .addButton('cancel', gt('Cancel'), 'cancel')
                .on('save', function (e) {
                    saveFile();
                })
                .show(function () { $form.find('input:first').focus(); });
        };

        ext.point(POINT + '/form').extend({
            index: 100,
            id: 'createfile',
            draw: function () {
                ext.point(POINT + '/field').invoke('draw', this);
            }
        });

        ext.point(POINT + '/field')
            .extend({
                id: 'file',
                index: 200,
                draw: function () {
                    this.append(attachments.fileUploadWidget({displayLabel: true}));
                }
            })
            .extend({
                id: 'comment',
                index: 300,
                draw: function () {
                    this.append(
                        $('<label>').text(gt('Description')),
                        $('<textarea name="description" rows="8" class="span12" tabindex="1"></textarea>')
                    );
                }
            });

        return {
            show: show
        };

    }
);
