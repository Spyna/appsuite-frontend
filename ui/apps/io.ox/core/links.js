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

define('io.ox/core/links', [
    'io.ox/core/yell',
    'io.ox/core/capabilities'
], function (yell, capabilities) {

    'use strict';

    // open app with given folder
    function openFolder(app, id) {
        // open files app
        require(['io.ox/core/folder/api'], function (api) {
            api.get(id).then(
                function () {
                    ox.launch(app, { folder: id }).done(function () {
                        // set proper folder
                        if (app === 'io.ox/calendar/main') this.folders.setOnly(id);
                        else if (this.folder.get() !== id) this.folder.set(id);
                    });
                },
                yell
            );
        });
    }

    //
    // Generic app
    //
    var appHandler = function (e) {
        e.preventDefault();
        var data = $(this).data(),
            // special handling for text and spreadsheet
            options = /^io.ox\/office\//.test(data.app) ?
                { action: 'load', file: { folder_id: data.folder, id: data.id } } :
                _(data).pick('folder', 'folder_id', 'id', 'cid');

        ox.launch(data.app + '/main', options).done(function () {
            // special handling for settings (bad, but apparently solved differently)
            if (_.isFunction(this.setSettingsPane)) this.setSettingsPane(options);
            // set proper folder
            else if (data.folder && this.folder.get() !== data.folder) this.folder.set(data.folder);
        });
    };

    $(document).on('click', '.deep-link-app', appHandler);

    //
    // Files
    //
    var filesHandler = function (e) {
        e.preventDefault();
        var data = $(this).data();
        if (data.id) {
            // open file in viewer
            require(['io.ox/core/viewer/main', 'io.ox/files/api'], function (Viewer, api) {
                api.get(_(data).pick('folder', 'id')).then(
                    function sucess(data) {
                        var viewer = new Viewer();
                        viewer.launch({ files: [data] });
                    },
                    // fail
                    yell
                );
            });
        } else {
            openFolder('io.ox/files/main', data.folder);
        }
    };
    $(document).on('click', '.deep-link-files', filesHandler);

    //
    // Address book
    //
    var contactsHandler = function (e) {
        e.preventDefault();
        var data = $(this).data();
        ox.launch('io.ox/contacts/main', { folder: data.folder }).done(function () {
            var app = this, folder = data.folder, id = String(data.id || '').replace(/\//, '.');
            if (app.folder.get() === folder) {
                app.getGrid().selection.set(id);
            } else {
                app.folder.set(folder).done(function () {
                    app.getGrid().selection.set(id);
                });
            }
        });
    };

    $(document).on('click', '.deep-link-contacts', contactsHandler);

    //
    // Calendar
    //
    var calendarHandler = function (e) {
        e.preventDefault();
        var data = $(this).data();
        if (data.id) {
            ox.load(['io.ox/core/tk/dialogs', 'io.ox/calendar/api', 'io.ox/calendar/view-detail', 'io.ox/core/folder/api']).done(function (dialogs, api, view, folderApi) {
                // chrome uses a shadowdom, this prevents the sidepopup from finding the correct parent to attach.
                var sidepopup = new dialogs.SidePopup({ arrow: !_.device('chrome'), tabTrap: true });
                if (_.device('chrome')) {
                    sidepopup.setTarget(document.body);
                }
                sidepopup.show(e, function (popup) {
                    popup.busy();
                    // fix special id format
                    if (/^\d+\/\d+.\d+$/.test(data.id)) {
                        data = api.cid(data.id.replace(/\//, '.'));
                    }
                    api.get(data).then(
                        function success(data) {
                            // some invitation mails contain links to events where the participant has no reading rights. We don't know until we check, as this data is not part of the appointment.
                            // folder data is used to determine if the this is a shared folder and the folder owner must be used when confirming instead of the logged in user
                            folderApi.get(data.get('folder')).always(function (result) {
                                popup.idle().append(view.draw(data, { container: popup, noFolderCheck: result.error !== undefined }));
                            });
                        },
                        function fail(e) {
                            sidepopup.close();
                            yell(e);
                        }
                    );
                });
            });
        } else {
            openFolder('io.ox/calendar/main', data.folder);
        }
    };

    $(document).on('click', '.deep-link-calendar', calendarHandler);

    //
    // Tasks
    //
    var tasksHandler = function (e) {
        e.preventDefault();
        var data = $(this).data();
        ox.launch('io.ox/tasks/main', { folder: data.folder }).done(function () {
            var app = this,
                folder = data.folder,
                id = String(data.id || '').replace(/\//, '.'),
                cid = id.indexOf('.') > -1 ? id : _.cid({ folder: folder, id: id });

            $.when()
                .then(function () {
                    // set folder
                    if (!app.folder.get() === folder) return app.folder.set(folder);
                })
                .then(function () {
                    // select item
                    if (id) return app.getGrid().selection.set(cid);
                });
        });
    };

    $(document).on('click', '.deep-link-tasks', tasksHandler);

    //
    // Mail
    //

    var mailHandler = function (e) {
        e.preventDefault();

        var node = $(this), data = node.data(), address, name, tmp, params = {};

        require(['io.ox/mail/sanitizer'], function (sanitizer) {

            // has data?
            if (data.address) {
                // use existing address and name
                address = data.address;
                name = data.name || data.address;
            } else {
                // parse mailto string
                // cut off leading "mailto:" and split at "?"
                tmp = node.attr('href').substr(7).split(/\?/, 2);
                // address
                address = tmp[0];
                // use link text as display name
                name = node.text();
                // process additional parameters; all lower-case (see bug #31345)
                params = _.deserialize(tmp[1]);
                for (var key in params) params[key.toLowerCase()] = params[key];
            }

            // go!
            ox.registry.call('mail-compose', 'compose', {
                to: [[name, address]],
                subject: params.subject || '',
                attachments: [{ content: sanitizer.sanitize({ content: params.body || '', content_type: 'text/html' }, { WHOLE_DOCUMENT: false }).content, disp: 'inline' }]
            });
        });
    };

    if (capabilities.has('webmail')) {
        $(document).on('click', '.mailto-link', mailHandler);
    }

    // event hub
    ox.on('click:deep-link-mail', function (e, scope) {
        var types = e.currentTarget.className.split(' ');

        if (types.indexOf('deep-link-files') >= 0) filesHandler.call(scope, e);
        else if (types.indexOf('deep-link-contacts') >= 0) contactsHandler.call(scope, e);
        else if (types.indexOf('deep-link-calendar') >= 0) calendarHandler.call(scope, e);
        else if (types.indexOf('deep-link-tasks') >= 0) tasksHandler.call(scope, e);
        else if (types.indexOf('deep-link-app') >= 0) appHandler.call(scope, e);
        else if (types.indexOf('mailto-link') >= 0) mailHandler.call(scope, e);
    });

});
