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
 * @author Christoph Hellweg <christoph.hellweg@open-xchange.com>
 */

define('io.ox/files/filepicker', [
    'io.ox/core/extensions',
    'io.ox/core/tk/dialogs',
    'io.ox/core/folder/picker',
    'io.ox/core/cache',
    'io.ox/files/api',
    'io.ox/core/tk/selection',
    'settings!io.ox/core',
    'gettext!io.ox/files',
    'io.ox/core/tk/upload',
    'io.ox/core/notifications',
    'io.ox/core/folder/api',
    'io.ox/core/page-controller',
    'io.ox/core/toolbars-mobile'
], function (ext, dialogs, picker, cache, filesAPI, Selection, settings, gt, upload, notifications, folderAPI, PageController, Bars) {

    'use strict';

    var FilePicker = function (options) {

        options = _.extend({
            filter: function () { return true; },
            sorter: function () {},
            header: gt('Add files'),
            primaryButtonText: gt('Save'),
            // cancelButtonText: gt('Cancel'), // really?
            multiselect: true,
            width: window.innerWidth * 0.8,
            uploadButton: false,
            tree: {
                // must be noop (must return undefined!)
                filter: $.noop
            },
            acceptLocalFileType: '', //e.g.  '.jpg,.png,.doc', 'audio/*', 'image/*' see@ https://developer.mozilla.org/de/docs/Web/HTML/Element/Input#attr-accept
            cancel: $.noop,
            initialize: $.noop
        }, options);

        var filesPane = $('<ul class="io-ox-fileselection list-unstyled">'),
            $uploadButton,
            def = $.Deferred(),
            self = this,
            toolbar = $('<div class="mobile-toolbar">'),
            navbar = $('<div class="mobile-navbar">'),
            pcContainer = $('<div class="picker-pc-container">'),
            pages = new PageController({ appname: 'filepicker', toolbar: toolbar, navbar: navbar, container: pcContainer, disableAnimations: true }),
            containerHeight = $(window).height() - 200,
            hub = _.extend({}, Backbone.Events),
            currentFolder;

        pages.addPage({
            name: 'folderTree',
            navbar: new Bars.NavbarView({
                title: gt('Folders'),
                extension: 'io.ox/mail/mobile/navbar' //save to use as this is very generic
            }),
            startPage: true
        });

        pages.addPage({
            name: 'fileList',
            navbar: new Bars.NavbarView({
                title: gt('Files'),
                extension: 'io.ox/mail/mobile/navbar'
            })
        });

        pages.setBackbuttonRules({
            'fileList': 'folderTree'
        });

        pages.getNavbar('fileList').setLeft(gt('Folders'));

        pages.getNavbar('fileList').on('leftAction', function () {
            pages.goBack({ disableAnimations: true });
        });

        Selection.extend(this, filesPane, { markable: true });

        this.selection.keyboard(filesPane, true);
        this.selection.setMultiple(options.multiselect);

        if (options.multiselect) {
            this.selection.setEditable(true, '.checkbox-inline');
            filesPane.addClass('multiselect');
        } else {
            filesPane.addClass('singleselect');
        }

        if (_.device('!desktop')) {
            options.uploadButton = false;
        }

        function toggleOkButton(state) {
            $('[data-action="ok"]', filesPane.closest('.add-infostore-file')).prop('disabled', !state);
        }

        toggleOkButton(false);

        this.selection.on('change', function (e, list) {
            toggleOkButton(list.length > 0);
        });

        function onFolderChange(id) {

            if (currentFolder === id) {
                hub.trigger('folder:changed');
                return;
            }
            if (options.uploadButton) {
                folderAPI.get(id).done(function (folder) {
                    $('[data-action="alternative"]', filesPane.closest('.add-infostore-file'))
                    .attr('disabled', !folderAPI.can('create', folder));
                });
            }
            if (_.device('smartphone')) {
                folderAPI.get(id).done(function (folder) {
                    pages.getNavbar('fileList').setTitle(folder.title);
                }).fail(function () {
                    pages.getNavbar('fileList').setTitle(gt('Files'));
                });
            }

            // disable ok button on folder change (selection will enable it)
            toggleOkButton(false);

            filesPane.empty();
            filesAPI.getAll(id, { cache: false }).done(function (files) {
                filesPane.append(
                    _.chain(files)
                    .filter(options.filter)
                    .sortBy(options.sorter)
                    .map(function (file) {
                        var title = (file.filename || file.title),
                            $div = $('<li class="file selectable">').attr('data-obj-id', _.cid(file)).append(
                                $('<label class="checkbox-inline sr-only">')
                                    .attr('title', title)
                                    .append(
                                        $('<input type="checkbox" class="reflect-selection" tabindex="-1">')
                                            .val(file.id).data('file', file)
                                    ),
                                $('<div class="name">').text(title)
                            );
                        if (options.point) {
                            ext.point(options.point + '/filelist/filePicker/customizer').invoke('customize', $div, file);
                        }
                        return $div;
                    })
                    .value()
                );
                self.selection.clear();
                self.selection.init(files);
                self.selection.selectFirst();
                currentFolder = id;
                hub.trigger('folder:changed');
            });
        }

        function fileUploadHandler(e) {
            var queue,
                dialog = e.data.dialog,
                tree = e.data.tree;

            queue = upload.createQueue({
                start: function () {
                    dialog.busy();
                },
                progress: function (item) {
                    var o = item.options;

                    return filesAPI.upload({
                        file: item.file,
                        filename: o.filename,
                        folder: o.folder,
                        timestamp: _.now()
                    })
                    .then(
                        function success(data) {
                            item.data = data;
                        },
                        function fail(e) {
                            if (e && e.data && e.data.custom) {
                                notifications.yell(e.data.custom.type, e.data.custom.text);
                            }
                        }
                    );
                },
                stop: function (current, position, list) {
                    var defList = _(list).map(function (file) {
                        return filesAPI.get(file.data);
                    });

                    $.when.apply(this, defList).then(function success() {
                        var filtered = _(arguments).filter(options.filter);

                        if (filtered.length > 0) {
                            def.resolve(filtered);
                            dialog.close();
                        } else {
                            notifications.yell('error', gt.ngettext(
                                'The uploaded file does not match the requested file type.',
                                'None of the uploaded files matches the requested file type.', list.length));
                        }

                        dialog.idle();
                    }, notifications.yell);
                }
            });

            _(e.target.files).each(function (file) {
                queue.offer(file, { folder: tree.selection.get(), filename: file.name });
            });
        }

        picker({

            addClass: 'zero-padding add-infostore-file',
            button: options.primaryButtonText,
            alternativeButton: options.uploadButton ? gt('Upload local file') : undefined,
            height: _.device('smartphone') ? containerHeight : 350,
            module: 'infostore',
            persistent: 'folderpopup/filepicker',
            root: '9',
            settings: settings,
            title: options.header,
            width: options.width,
            async: true,
            abs: false,
            folder: options.folder || undefined,
            hideTrashfolder: options.hideTrashfolder || undefined,
            customize: options.customize || undefined,
            selection: options.selection || undefined,

            done: function (id, dialog) {
                def.resolve(
                    _(filesPane.find('li.selected input')).map(function (node) {
                        return $(node).data('file');
                    })
                );

                dialog.close();
            },

            filter: options.tree.filter,

            initialize: function (dialog, tree) {
                if (options.uploadButton) {
                    $uploadButton = $('<input name="file" type="file" class="file-input">')
                        .attr('multiple', options.multiselect)
                        .attr('accept', options.acceptLocalFileType)
                        .hide()
                        .on('change', { dialog: dialog, tree: tree }, fileUploadHandler);
                }
                // standard handling for desktop only
                if (_.device('!smartphone')) {
                    dialog.getContentNode().append(filesPane);
                    filesPane.on('dblclick', '.file', function () {
                        var file = $('input', this).data('file');
                        if (!file) return;
                        def.resolve([file]);
                        dialog.close();
                    });
                } else {
                    // some re-sorting of nodes for mobile
                    // we have to use the pagecontroller pages instead of the classic
                    // splitview on desktop
                    var container = dialog.getBody().parent();
                    pages.getPage('fileList').append(filesPane);
                    pages.getPage('folderTree').append(dialog.getBody());

                    pcContainer.css('height', containerHeight + 'px');
                    pcContainer.append(navbar, toolbar);
                    pcContainer.insertAfter('.clearfix', container);

                    // always change pages on click, do not wait for folder-change
                    dialog.getBody().on('click', 'li .folder.selectable.open', function (e) {
                        if ($(e.target).closest('.folder-arrow').length) return;
                        pages.changePage('fileList', { disableAnimations: true });
                    });
                }

                tree.on('change', onFolderChange);
                options.initialize(dialog);
            },

            alternative: function (dialog) {
                dialog.idle();
                if ($uploadButton) {
                    $uploadButton.trigger('click');
                }
            },
            cancel: options.cancel
        });

        return def.promise();
    };
    return FilePicker;
});
