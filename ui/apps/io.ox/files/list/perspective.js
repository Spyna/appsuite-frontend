/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2012 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/files/list/perspective',
    ['io.ox/files/list/view-detail',
     'io.ox/files/api',
     'io.ox/core/tk/vgrid',
     'io.ox/core/tk/upload',
     'io.ox/core/extPatterns/dnd',
     'io.ox/core/extPatterns/shortcuts',
     'io.ox/core/commons',
     'io.ox/core/extensions',
     'gettext!io.ox/files',
     'io.ox/core/bootstrap/basics'
     ], function (viewDetail, api, VGrid, upload, dnd, shortcuts, commons, ext, gt) {

    'use strict';

    var perspective = new ox.ui.Perspective('list');
    var firstTime = false;
    perspective.render = function (app) {

        var win = app.getWindow(),
        vsplit = commons.vsplit(this.main, app),
        left = vsplit.left.addClass('border-right'),
        right = vsplit.right.addClass('default-content-padding f6-target').attr('tabindex', 1).scrollable(),
        gridOptions = {
            settings: app.settings,
            showToggle: _.device('smartphone') ? false: true
        },
        grid = new VGrid(left, gridOptions),
        optDropdown = null,
        dropZone;

        grid.prop('order', 'asc')
            .prop('sort', 702)
            .prop('folder', app.folder.get());

        grid.addTemplate({
            build: function () {
                var name;
                this
                    .addClass('file')
                    .append(name = $('<div>').addClass('name'));
                return { name: name };
            },
            set: function (data, fields, index) {
                var title = data.filename || data.title || '\u00A0';
                fields.name.text(cut(title));
            }
        });

        function cut(str, maxLen, cutPos) {
            if (!cutPos) cutPos = 25;
            if (!maxLen) maxLen = 70;
            str = String(str || '');
            if (str.length > maxLen) {
                return str.substr(0, maxLen - cutPos).trim() + '\u2026' + str.substr(str.length - cutPos).trim();
            } else {
                return str;
            }
        }

        commons.wireGridAndAPI(grid, api);
        commons.wireGridAndSearch(grid, win, api);

        if (app.getWindow().search.active) {
            grid.setMode('search');
        }

        // The list request is not needed and is too slow
        // ids contains all required information
        grid.setListRequest(function (ids) {
            return $.Deferred().resolve(ids);
        });

        // LFO callback
        app.currentFile = null;

        var showFile, selectFile, drawFail;

        showFile = function (obj) {
            // get file
            if (_.cid(app.currentFile) === _.cid(obj)) {
                return;
            }
            right.busy(true);
            api.get(obj)
                .done(_.lfo(selectFile))
                .fail(_.lfo(drawFail));
        };

        showFile.cancel = function () {
            _.lfo(selectFile);
            _.lfo(drawFail);
        };

        selectFile = function (data) {
            right.idle().empty().append(viewDetail.draw(data, app));
            right.parent().scrollTop(0);
            app.currentFile = data;
            if (dropZone) {
                dropZone.update();
            }
            // shortcutPoint.activateForContext({
            //     data: data,
            //     view: app.detailView,
            //     folder: data.folder_id
            // });
        };

        drawFail = function (obj) {
            right.idle().empty().append(
                $.fail(gt("Couldn't load file data."), function () {
                    showFile(obj);
                })
            );
        };

        commons.wireGridAndSelectionChange(grid, 'io.ox/files', showFile, right, api);

        grid.selection.on('empty', function () {
            app.currentFile = null;
            if (_.browser.IE === undefined || _.browser.IE > 9) {
                dropZone.update();
            }
        })
        .on('change', function (evt, selected) {
            if (selected.length > 1) {
                app.currentFile = null;
            }
        });

        // delete item
        api.on('beforedelete', function () {
            grid.selection.selectNext();
        });

        // Uploads
        app.queues = {};

        var uploadedFiles = [];

        app.queues.create = upload.createQueue({
            start: function () {
                win.busy();
                grid.selection.clearIndex();
            },
            progress: function (file, position, files) {
                var pct = position / files.length;
                win.busy(pct, 0);
                return api.uploadFile({ file: file, folder: app.folder.get() })
                    .done(function (data) {
                        // select new item
                        uploadedFiles.push(data);
                    })
                    .progress(function (e) {
                        var sub = e.loaded / e.total;
                        win.busy(pct + sub / files.length, sub);
                    })
                    .fail(function (e) {
                        require(['io.ox/core/notifications'], function (notifications) {
                            if (e && e.data && e.data.custom) {
                                notifications.yell(e.data.custom.type, e.data.custom.text);
                            }
                        });
                    });
            },
            stop: function () {
                api.trigger('refresh.all');
                grid.selection.clearIndex();
                grid.selection.set(uploadedFiles);
                uploadedFiles = [];
                grid.refresh();
                win.idle();
            }
        });

        var currentVersionUpload;

        app.queues.update = upload.createQueue({
            start: function () {
                win.busy();
                currentVersionUpload = {
                    id: app.currentFile.id,
                    folder: app.currentFile.folder_id
                };
            },
            progress: function (data, position, files) {
                var pct = position / files.length;
                win.busy(pct, 0);
                return api.uploadNewVersion({
                        file: data,
                        id: currentVersionUpload.id,
                        folder: currentVersionUpload.folder,
                        timestamp: _.now(),
                        silent: position < files.length - 1
                    })
                    .progress(function (e) {
                        var sub = e.loaded / e.total;
                        win.busy(pct + sub / files.length, sub);
                    })
                    .fail(function (e) {
                        require(['io.ox/core/notifications'], function (notifications) {
                            if (e && e.data && e.data.custom) {
                                notifications.yell(e.data.custom.type, e.data.custom.text);
                            }
                        });
                    });
            },
            stop: function () {
                win.idle();
            }
        });

        if (_.browser.IE === undefined || _.browser.IE > 9) {
            dropZone = new dnd.UploadZone({
                ref: 'io.ox/files/dnd/actions'
            }, app);


        // var shortcutPoint = new shortcuts.Shortcuts({
        //     ref: 'io.ox/files/shortcuts'
        // });
            if (dropZone) dropZone.include();


            app.on('perspective:list:hide', function () {
                if (dropZone) dropZone.remove();
                // shortcutPoint.deactivate();
            });

            app.on('perspective:list:show', function () {
                if (dropZone) dropZone.include();
                // shortcutPoint.deactivate();
            });

        }


        function buildOption(value, text) {
            return $('<li>').append($('<a href="#"><i/></a>').attr('data-option', value).append($.txt(text)));
        }

        function updateGridOptions() {
            var dropdown = grid.getToolbar().find('.grid-options'),
                list = dropdown.find('ul'),
                props = grid.prop();
            // uncheck all
            list.find('i').attr('class', 'icon-none');
            // sort
            list.find('[data-option="' + props.order + '"], [data-option="' + props.sort + '"]')
                .find('i').attr('class', 'icon-ok');
            // order
            var opacity = [1, 0.4][props.order === 'asc' ? 'slice' : 'reverse']();
            dropdown.find('.icon-arrow-down').css('opacity', opacity[0]).end()
                .find('.icon-arrow-up').css('opacity', opacity[1]).end();
        }

        ext.point('io.ox/files/vgrid/toolbar').extend({
            id: 'dropdown',
            index: 1000,
            draw: function () {
                this.append(
                    optDropdown = $('<div class="grid-options dropdown">')
                        .append(
                            $('<a href="#" tabindex="1" data-toggle="dropdown" role="menuitem" aria-haspopup="true">').attr('aria-label', gt('Sort options'))
                                .append(
                                    $('<i class="icon-arrow-down">'),
                                    $('<i class="icon-arrow-up">')
                                )
                                .dropdown(),
                            $('<ul class="dropdown-menu" role="menu">')
                                .append(
                                    buildOption(702, gt('File name')),
                                    buildOption(704, gt('File size')),
                                    buildOption(5, gt('Last modified')),
                                    $('<li class="divider">'),
                                    buildOption('asc', gt('Ascending')),
                                    buildOption('desc', gt('Descending'))
                                )
                                .on('click', 'a', { grid: grid }, function () {
                                    var option = $(this).attr('data-option');
                                    switch (option) {
                                    case 'asc':
                                    case 'desc':
                                        grid.prop('order', option).refresh(true);
                                        break;
                                    case '702': // Sort by filename
                                    case '704': // Sort by filesize
                                    case '5':   // Sort by last modified
                                        grid.prop('sort', Number(option)).refresh(true);
                                        break;
                                    default:
                                        break;
                                    }
                                })
                        )
                );
            }
        });

        grid.setAllRequest(function () {
            var prop = grid.prop();

            return app.folder.getData().pipe(function (folder) {
                // set folder data to view and update
                return api.getAll({
                    folder: prop.folder,
                    order: prop.order,
                    sort: prop.sort
                });
            });
        });

        // Add status for uploads

        commons.wireGridAndWindow(grid, win);
        commons.wireFirstRefresh(app, api);
        commons.wireGridAndRefresh(grid, api, win);
        commons.addGridFolderSupport(app, grid);
        commons.addGridToolbarFolder(app, grid);

        grid.on('change:prop', updateGridOptions);
        updateGridOptions();

        app.invalidateFolder = function (data) {
            api.propagate('change', data);
            if (data) {
                grid.selection.clearIndex();
                grid.selection.set([data]);
            }
            grid.refresh();
        };

        app.on('folder:change', function (e, id, folder) {
            app.currentFile = null;
            if (_.browser.IE === undefined || _.browser.IE > 9) {
                dropZone.remove();
                if (dropZone) dropZone.include();
            }
            updateGridOptions();
            grid.refresh(true);
        });

        grid.paint();
    };
    return perspective;
});
