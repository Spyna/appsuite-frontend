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
 * @author Frank Paczynski <frank.paczynski@open-xchange.com>
 * @author Julian Bäume <julian.baeume@open-xchange.com>
 */

define('io.ox/core/import/import', [
    'io.ox/core/extensions',
    'io.ox/core/tk/dialogs',
    'io.ox/core/tk/attachments',
    'io.ox/core/folder/api',
    'io.ox/core/api/import',
    'io.ox/core/notifications',
    'gettext!io.ox/core',
    'less!io.ox/core/import/style'
], function (ext, dialogs, attachments, folderAPI, api, notifications, gt) {

    'use strict';

    ext.point('io.ox/core/import').extend({
        id: 'select',
        index: 100,
        draw: function (baton) {

            var nodes = {};
            nodes.row = $('<div class="form-group">').appendTo($(this));

            //lable and select
            nodes.label = $('<label>').attr('for', 'import-format').text(gt('Format')).appendTo(nodes.row);
            nodes.select = $('<select class="form-control" name="action">')
                .attr({ id: 'import-format', 'aria-label': gt('select format') })
                .appendTo(nodes.row);
            //add option
            ext.point('io.ox/core/import/format').invoke('draw', nodes.select, baton);
            //avoid find
            baton.nodes.select = nodes.select;
        }
    });

    ext.point('io.ox/core/import/format').extend({
        id: 'ical',
        index: 100,
        draw: function (baton) {
            if (!/^(calendar|tasks)$/.test(baton.module)) return;
            return this.append(
                $('<option value="ICAL">').text(gt('iCal'))
            );
        }
    });


    ext.point('io.ox/core/import/format').extend({
        id: 'vcard',
        index: 200,
        draw: function (baton) {
            if (!/^(contacts)$/.test(baton.module)) return;
            return this.append(
                $('<option value="VCARD">').text(gt('vCard'))
            );
        }
    });

    ext.point('io.ox/core/import/format').extend({
        id: 'csv',
        index: 300,
        draw: function (baton) {
            if (!/^(contacts)$/.test(baton.module)) return;
            return this.append(
                $('<option value="CSV">').text(gt('CSV'))
            );
        }
    });

    ext.point('io.ox/core/import').extend({
        id: 'file',
        index: 200,
        draw: function (baton) {
            var label = $('<span class="filename">');
            this.append(
                baton.nodes.file_upload = attachments.fileUploadWidget({
                    multi: false,
                    buttontext: gt('Upload file')
                }).append(label)
            );
            var $input = baton.nodes.file_upload.find('input[type="file"]');
            $input.on('change', function (e) {
                e.preventDefault();
                var buttonText = '';
                if ($input[0].files && $input[0].files.length > 0) {
                    buttonText = $input[0].files[0].name;
                }
                label.text(buttonText);
            });
        }
    });

    ext.point('io.ox/core/import').extend({
        id: 'checkbox',
        index: 200,
        draw: function (baton) {

            // show option only for calendar and tasks
            if (!(baton.module === 'calendar' || baton.module === 'tasks')) return;
            var guid = _.uniqueId('form-control-label-');
            this.append(
                $('<div class="checkbox">').append(
                    $('<label>').attr('for', guid).append(
                        $('<input type="checkbox" name="ignore_uuids">').attr('id', guid),
                        baton.module === 'calendar' ?
                            gt('Ignore existing events. Helpful to import public holiday calendars, for example.') :
                            gt('Ignore existing events')
                    )
                )
            );
        }
    });

    ext.point('io.ox/core/import').extend({
        id: 'help',
        index: 300,
        draw: function (baton) {

            if (baton.module !== 'contacts') return;

            this.append(
                $('<div class="help-block">').append(
                    // inline help
                    $('<b>').text(gt('Note on CSV files:')),
                    $.txt(' '),
                    $('<span>').text(
                        gt('The first record of a valid CSV file must define proper column names. Supported separators are comma and semi-colon.')
                    ),
                    $.txt(' '),
                    // link to online help
                    $('<a href="" target="help" style="white-space: nowrap">')
                        .attr('href', 'help/l10n/' + ox.language + '/ox.appsuite.user.sect.datainterchange.import.contactscsv.html')
                        .text(gt('Learn more'))
                )
            );
        }
    });

    return {

        show: function (module, id) {

            id = String(id);

            var baton = { id: id, module: module, format: {}, nodes: {} };

            //get folder and process
            folderAPI.get(id).done(function () {

                new dialogs.ModalDialog({
                    help: 'ox.appsuite.user.sect.datainterchange.import.contactscsv.html'
                })
                .build(function () {

                    this.getHeader().append(
                        $('<h4>').text(gt('Import from file'))
                    );

                    this.form = $('<form method="post" accept-charset="UTF-8" enctype="multipart/form-data">');
                    this.getContentNode().append(this.form);

                    ext.point('io.ox/core/import').invoke('draw', this.form, baton);

                    this.addPrimaryButton('import', gt('Import'), 'import')
                        .addButton('cancel', gt('Cancel'), 'cancel');

                    this.getPopup().addClass('import-dialog');
                })
                .on('import', function () {

                    var type = baton.nodes.select.val() || '',
                        file = baton.nodes.file_upload.find('input[type=file]'),
                        popup = this;

                    function getDefautMessage(module) {
                        switch (module) {
                            case 'contacts':
                                //#. Error message if contact import failed
                                return gt('There was no contact data to import');
                            case 'tasks':
                                //#. Error message if task import failed
                                return gt('There was no task data to import');
                            default:
                                //#. Error message if calendar import failed
                                return gt('There was no appointment data to import');
                        }
                    }

                    function failHandler(data) {

                        var message;

                        if (_.isArray(data)) {
                            data = _(data)
                            .chain()
                            .map(function (item) { return (item || {}).error; })
                            .compact()
                            .value();
                            message = data.length ? data.join('\n\n') : getDefautMessage(module);
                        } else {
                            // we only show "error"; sometimes "error_desc" contains a better
                            // but untranslated hint, sometimes it contains the same
                            message = data.error;
                        }

                        notifications.yell({ type: 'error', message: message, duration: -1 });
                        popup.idle();
                    }

                    if (file.val() === '') {
                        notifications.yell('error', gt('Please select a file to import'));
                        popup.idle();
                        return;
                    } else if (baton.nodes.select.val() === 'ICAL' && !(/\.(ical|ics)$/i).test(file.val())) {
                        notifications.yell('error', gt('Please select a valid iCal File to import'));
                        popup.idle();
                        return;
                    }

                    api.importFile({
                        file: file[0].files ? file[0].files[0] : [],
                        form: this.form,
                        type: type,
                        ignoreUIDs: popup.getContentNode().find('input[name="ignore_uuids"]').prop('checked'),
                        folder: id
                    })
                    .done(function (data) {

                        // get failed records
                        var failed = _.filter(data, function (item) {
                                return item && item.error;
                            }),
                            custom;

                        // cache
                        try {
                            require(['io.ox/' + baton.module + '/api'], function (api) {
                                // todo: clean that up; fails for calendar
                                if (api.caches.all.grepRemove) {
                                    api.caches.all.grepRemove(id + api.DELIM).done(function () {
                                        // use named refresh.all so apis can differenciate if they wish
                                        api.trigger('refresh.all:import');
                                    });
                                } else if (api.refresh) {
                                    api.refresh();
                                }
                            });

                        } catch (e) {
                            // if api is unknown, refresh everything
                            if (ox.debug) console.warn('import triggering global refresh because of unknown API', e);
                            ox.trigger('refresh^');
                        }

                        // partially failed?
                        if (failed.length === 0) {
                            // all good; no failures
                            notifications.yell('success', gt('Data imported successfully'));
                        } else if (data.length === failed.length) {
                            // failed
                            // #. Failure message if no data (e.g. appointments) could be imported
                            custom = { error: gt('Failed to import any data') };
                            failHandler([].concat(custom, failed));
                        } else {
                            // partially failed
                            custom = { error: gt('Data only partially imported (%1$s of %2$s records)', (data.length - failed.length), data.length) };
                            failHandler([].concat(custom, failed));
                        }
                        baton = null;
                        popup.close();
                    })
                    .fail(failHandler);
                })
                .on('close', function () {
                    this.form = baton.nodes = null;
                })
                .show(function () {
                    //focus
                    this.find('select').focus();
                });
            });
        }
    };

});
