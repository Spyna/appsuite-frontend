/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2012 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author David Bauer <david.bauer@open-xchange.com>
 */

define('io.ox/files/views/create',
    ['io.ox/core/tk/dialogs',
     'io.ox/core/extensions',
     'io.ox/files/api',
     'io.ox/core/tk/upload',
     'gettext!io.ox/files',
     'io.ox/core/tk/attachments',
     'io.ox/core/notifications'
    ], function (dialogs, ext, api, upload, gt, attachments, notifications) {

        'use strict';

        var POINT = 'io.ox/files/create',
            baton = new ext.Baton(),
            oldMode = _.browser.IE < 10,
            dndInfo = $('<div class="dndinfo alert alert-info">').text(gt('You can drag and drop files from your computer to upload either a new file or another version of a file.')),

            show = function (app) {
                var dialog = new dialogs.CreateDialog({ width: 450, center: true, async: true, container: $('.io-ox-files-window'), 'tabTrap': true }),
                    $form = $('<form>', { 'class': 'files-create col-lg-12', 'accept-charset': 'UTF-8', enctype: 'multipart/form-data', method: 'POST' }),
                    description = '';
                ext.point(POINT + '/form').invoke('draw', $form, baton);
                ext.point(POINT + '/filelist').invoke();

                //clear file list
                baton.fileList.clear();

                //save handler
                $form.on('submit', function (e) {
                    e.preventDefault();
                    uploadFiles();
                });

                /**
                 * upload filelist collected by fileList
                 */
                function uploadFiles() {
                    var $input = $form.find('input[type="file"]'),
                        //fileList = ($input.length > 0 ? $input[0].files : []) || [],
                        files = baton.fileList.get();
                    if (files.length) {
                        description = $form.find('textarea').val();
                        app.queues.create.offer(files, { description: description, folder: app.folder.get() });
                        baton.fileList.clear();
                        dialog.close();
                    } else {
                        notifications.yell('error', gt('No file selected for upload.'));
                        dialog.idle();
                        $input.focus();
                    }
                }

                //TODO: add support for multiple files via filelist widget
                function uploadFilesIE9() {
                    var files = ($form.find('input[type="file"]').length > 0 ? $form.find('input[type="file"]').prop('disabled', false)[0].files : []) || [],
                        folder = app.folder.get();
                    if ($form.find('input[type="file"]').val()) {
                        // disable autologout -> bug 29389
                        ox.autoLogout.stop();

                        api.uploadFile({
                            form: $form,
                            file: _(files).first(),
                            json: {
                                folder: app.folder.get(),
                                description: $form.find('textarea').val()
                            },
                            folder: folder
                        })
                        .done(function (data) {
                            api.propagate('new', data);
                            notifications.yell('success', gt('This file has been added'));
                            dialog.close();
                        })
                        .fail(function (e) {
                            if (e && e.data && e.data.custom) {
                                notifications.yell(e.data.custom.type, e.data.custom.text);
                            }
                            dialog.close();
                        })
                        .always(function () {
                            // reenable autologout -> bug 29389
                            ox.autoLogout.start();
                        });
                    } else {
                        notifications.yell('error', gt('No file selected for upload.'));
                        dialog.idle();
                        $form.find('input[type="file"]').focus();
                    }
                }

                //dialog
                dialog.header($('<h4>').text(gt('Upload new files')));
                dialog.getBody().append($('<div>').addClass('row').append($form));
                dialog.getBody().append(
                    (_.device('!touch') && (!_.browser.IE || _.browser.IE > 9) ? dndInfo : '')
                );
                dialog.getBody().append(baton.fileList.getNode());
                dialog
                    .addPrimaryButton('save', gt('Save'), 'save', {'tabIndex': '1'})
                    .addButton('cancel', gt('Cancel'), 'cancel', {'tabIndex': '1'})
                    .on('save', function () {
                        if (oldMode)
                            uploadFilesIE9();
                        else
                            uploadFiles();
                    })
                    .show(function () { $form.find('.btn-file').focus(); });
            };

        ext.point(POINT + '/form').extend({
            index: 100,
            id: 'createfile',
            draw: function (baton) {
                ext.point(POINT + '/form/field').invoke('draw', this, baton);
            }
        });

        ext.point(POINT + '/form/field')
            .extend({
                id: 'file',
                index: 200,
                draw: function (baton) {
                    var $inputWrap = attachments.fileUploadWidget(),
                        $input = $inputWrap.find('input[type="file"]'),
                        changeHandler = function (e) {
                            e.preventDefault();
                            if (!oldMode) {
                                var list = [];
                                //fileList to array of files
                                _($input[0].files).each(function (file) {
                                    list.push(_.extend(file, {group: 'file'}));
                                });
                                baton.fileList.add(list);
                                $input.trigger('reset.fileupload');
                                dndInfo.remove();
                            }
                        };
                    this.append($inputWrap);
                    $input.on('change', changeHandler);
                }
            })
            .extend({
                id: 'comment',
                index: 300,
                draw: function () {
                    var guid = _.uniqueId('form-control-label-');
                    this.append(
                        $('<div class="form-group">').append(
                            $('<label>').text(gt('Description')).attr('for', guid),
                            $('<textarea class="form-control"></textarea>').attr({
                                tabindex: 1,
                                rows: 4,
                                name: 'description',
                                id: guid
                            })
                        )
                    );
                }
            });

        //referenced via baton.fileList
        ext.point(POINT + '/filelist').extend(new attachments.EditableFileList({
                    id: 'attachment_list',
                    itemClasses: 'col-md-6',
                    fileClasses: 'background',
                    preview: false,
                    labelmax: 18,
                    registerTo: baton,
                    index: 300
                },
                baton
            )
        );

        return {
            show: show
        };

    }
);
