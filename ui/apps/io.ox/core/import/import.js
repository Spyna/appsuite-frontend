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
    'io.ox/backbone/mini-views/common',
    'io.ox/core/extensions',
    'io.ox/backbone/views/modal',
    'io.ox/core/tk/attachments',
    'io.ox/core/folder/api',
    'io.ox/core/api/import',
    'io.ox/core/notifications',
    'gettext!io.ox/core'
], function (mini, ext, ModalDialog, attachments, folderAPI, api, notifications, gt) {

    'use strict';

    ext.point('io.ox/core/import').extend({
        id: 'select',
        index: 100,
        render: function (baton) {
            baton.module = this.model.get('module');

            var list = [],
                guid = _.uniqueId('select-');

            ext.point('io.ox/core/import/format').invoke('customize', list, baton);

            if (list.length === 0) return;
            // default selection
            this.model.set('format', list[0].value);
            if (list.length === 1) return;
            this.$body.append(
                $('<div class="form-group">').append(
                    $('<label>').attr('for', guid).text(gt('Format')),
                    new mini.SelectView({ id: guid, name: 'format', list: list, model: this.model })
                        .render().$el
                        .attr('aria-label', gt('select format'))
                )
            );
        }
    });

    ext.point('io.ox/core/import/format').extend({
        id: 'ical',
        index: 100,
        customize: function (baton) {
            if (!/^(calendar|tasks)$/.test(baton.module)) return;
            this.push({ value: 'ICAL', label: gt('Calendar') });
        }
    });


    ext.point('io.ox/core/import/format').extend({
        id: 'vcard',
        index: 200,
        customize: function (baton) {
            if (!/^(contacts)$/.test(baton.module)) return;
            this.push({ value: 'VCARD', label: gt('vCard') });
        }
    });

    ext.point('io.ox/core/import/format').extend({
        id: 'csv',
        index: 300,
        customize: function (baton) {
            if (!/^(contacts)$/.test(baton.module)) return;
            this.push({ value: 'CSV', label: gt('CSV') });
        }
    });

    ext.point('io.ox/core/import').extend({
        id: 'file',
        index: 200,
        render: function (baton) {
            var label = $('<span class="filename">').css('margin-left', '7px'),
                fileUpload;
            this.$body.append(
                fileUpload = attachments.fileUploadWidget({
                    multi: false,
                    buttontext: gt('Upload file')
                }).append(label).addClass('form-group')
            );
            var $input = this.$fileUploadInput = fileUpload.find('input[type="file"]');
            if (baton.module === 'calendar') $input.attr('accept', '.ics,.ical');
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
        id: 'foldername',
        index: 300,
        render: function (baton) {
            if (!/^(calendar)$/.test(baton.module)) return;
            if (baton.model.get('folderId')) return;
            this.model.set('folderName', gt('Imported calendar'));
            this.$body.append(
                $('<div class="form-group">').append(
                    mini.getInputWithLabel('folderName', gt('New calendar name'), this.model)
                )
            );
        }
    });

    ext.point('io.ox/core/import').extend({
        id: 'checkbox',
        index: 400,
        render: function (baton) {

            // show option only for calendar and tasks
            if (!(baton.module === 'calendar' || baton.module === 'tasks')) return;
            this.$body.append(
                new mini.CustomCheckboxView({
                    name: 'ignoreUuids',
                    model: this.model,
                    label: baton.module === 'calendar' ?
                        gt('Ignore existing appointments') :
                        gt('Ignore existing events')
                }).render().$el
            );
        }
    });

    ext.point('io.ox/core/import').extend({
        id: 'help',
        index: 500,
        render: function (baton) {

            if (baton.module !== 'contacts') return;

            this.$body.append(
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

    ext.point('io.ox/core/import').extend({
        id: 'calendar-help-block',
        index: 600,
        render: function (baton) {

            if (baton.module !== 'calendar') return;

            this.$body.append(
                $('<div class="help-block">').append(
                    gt('Ignoring existing appointments is helpful to import public holiday calendars, for example.'),
                    gt('Please note that other participants are removed on calendar import.')
                )
            );
        }
    });

    return {

        show: function (module, id) {

            new ModalDialog({
                focus: module === 'calendar' ? 'input[name="file"]' : 'select[name="format"]',
                async: true,
                help: 'ox.appsuite.user.sect.datainterchange.import.contactscsv.html',
                point: 'io.ox/core/import',
                title: gt('Import from file'),
                model: new Backbone.Model({
                    folderId: id,
                    module: module
                })
            })
            .inject({
                createFolder: function (module, title) {
                    var invalid = false,
                        folder = module === 'calendar' ? '1' : folderAPI.getDefaultFolder(module);
                    ext.point('io.ox/core/filename')
                        .invoke('validate', null, title, 'folder')
                        .find(function (result) {
                            if (result !== true) {
                                notifications.yell('warning', result);
                                return (invalid = true);
                            }
                        });
                    if (invalid) return $.Deferred().reject();
                    return folderAPI.create(folder, { title: $.trim(title), module: module === 'calendar' ? 'event' : module })
                        .fail(notifications.yell);
                },
                getFolder: function () {
                    if (!id) return this.createFolder(module, this.model.get('folderName'));
                    return folderAPI.get(id);
                },
                getDefaultFailMessage: function () {
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
                },
                onPartialFail: function (data) {
                    var message;
                    if (_.isArray(data)) {
                        data = _(data)
                        .chain()
                        .map(function (item) { return (item || {}).error; })
                        .compact()
                        .value();
                        message = data.length ? data.join('\n\n') : this.getDefaultFailMessage(module);
                    } else {
                        // we only show "error"; sometimes "error_desc" contains a better
                        // but untranslated hint, sometimes it contains the same
                        message = data.error;
                    }

                    notifications.yell({ type: 'error', message: message, duration: -1 });
                    this.close();
                },
                onCompleteFail: function (data) {
                    if (!id && this.tempFolder && this.model.get('module') === 'calendar') {
                        var parent = this.tempFolder.folder_id;
                        folderAPI.remove(this.tempFolder.id).then(function () {
                            folderAPI.pool.unfetch(parent);
                            folderAPI.refresh();
                        });
                    }
                    this.onPartialFail(data);
                }
            })
            .addCancelButton()
            .addButton({ action: 'import', label: gt('Import') })
            .on('import', function () {
                var self = this,
                    file = this.$fileUploadInput;
                if (file.val() === '') {
                    notifications.yell('error', gt('Please select a file to import'));
                    this.idle();
                    return;
                } else if (this.model.get('format') === 'ICAL' && !(/\.(ical|ics)$/i).test(file.val())) {
                    notifications.yell('error', gt('Please select a valid iCal File to import'));
                    this.idle();
                    return;
                } else if (!id && !this.model.get('folderName')) {
                    notifications.yell('error', gt('You must enter a folder name'));
                    return this.idle();
                }
                this.getFolder().then(function (folder) {
                    self.tempFolder = folder;
                    return api.importFile({
                        file: file[0].files ? file[0].files[0] : [],
                        form: self.form,
                        type: self.model.get('format'),
                        ignoreUIDs: self.model.get('ignoreUuids'),
                        folder: folder.id
                    });
                }, function fail(error) {
                    notifications.yell(error);
                }).then(function (data) {
                    if (!data) return self.idle();
                    // get failed records
                    var failed = _.filter(data, function (item) {
                            return item && item.error;
                        }),
                        custom;

                    // cache
                    try {
                        require(['io.ox/' + module + '/api'], function (api) {
                            if (api.caches && api.caches.all.grepRemove) {
                                api.caches.all.grepRemove(self.tempFolder.id + api.DELIM).done(function () {
                                    // use named refresh.all so apis can differenciate if they wish
                                    api.trigger('refresh.all:import');
                                });
                            } else if (api.refresh) {
                                // use gc to invalidate caches if the api uses a collection-pool
                                if (api.pool) {
                                    api.pool.gc();
                                }
                                api.refresh();
                            }
                        });
                        // update folder data
                        folderAPI.reload(self.tempFolder);
                    } catch (e) {
                        // if api is unknown, refresh everything
                        if (ox.debug) console.warn('import triggering global refresh because of unknown API', e);
                        ox.trigger('refresh^');
                    }

                    // partially failed?
                    if (failed.length === 0) {
                        // all good; no failures
                        notifications.yell('success', gt('Data imported successfully'));
                        folderAPI.refresh();
                    } else if (data.length === failed.length) {
                        // failed
                        // #. Failure message if no data (e.g. appointments) could be imported
                        custom = { error: gt('Failed to import any data') };
                        self.onCompleteFail([].concat(custom, failed));
                    } else {
                        // partially failed
                        custom = { error: gt('Data only partially imported (%1$s of %2$s records)', (data.length - failed.length), data.length) };
                        self.onPartialFail([].concat(custom, failed));
                        folderAPI.refresh();
                    }
                    self.close();
                }, this.onCompleteFail.bind(this));
            })
            .open();

        }
    };

});
