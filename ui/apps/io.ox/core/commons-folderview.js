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

define('io.ox/core/commons-folderview',
    ['io.ox/core/extensions',
     'io.ox/core/extPatterns/links',
     'io.ox/core/notifications',
     'io.ox/core/api/folder',
     'settings!io.ox/core',
     'settings!io.ox/caldav',
     'io.ox/core/capabilities',
     'gettext!io.ox/core'], function (ext, links, notifications, api, coreConfig, caldavConfig, capabilities, gt) {

    'use strict';

    function initExtensions(POINT, app) {

        // mobile quirks
        /* our product gets designed by others, turn this on again
        if (_.device('small')) {
            //nobody needs options and create in folder tree on mobile
            ext.point(POINT + '/sidepanel/toolbar').disable('add');
            ext.point(POINT + '/sidepanel/toolbar').disable('options');
        }
        */

        // default options
        ext.point(POINT + '/options').extend({
            id: 'defaults',
            index: 100,
            rootFolderId: '1',
            type: undefined,
            view: 'ApplicationFolderTree',
            // disable folder popup as it takes to much space for startup on small screens
            visible: _.device('small') ? false : app.settings.get('folderview/visible/' + _.display(), false)
        });

        // draw container
        ext.point(POINT + '/sidepanel').extend({
            draw: function (baton) {
                this.prepend(
                    // sidepanel
                    baton.$.sidepanel = $('<div class="abs border-right foldertree-sidepanel">')
                    .append(
                        // container
                        baton.$.container = $('<div class="abs foldertree-container">'),
                        // toolbar
                        baton.$.toolbar = $('<div class="abs foldertree-toolbar">')
                    )
                );
            }
        });

        // draw click intercept-div which intercepts
        // clicks on the visible rest of the grids on mobile
        // when folder tree is expanded
        ext.point(POINT + '/sidepanel/mobile').extend({
            id: 'spacer',
            draw: function (baton) {
                this.prepend(
                    // sidepanel
                    baton.$.spacer = $('<div class="mobile-clickintercept">')
                        .addClass('foldertree-click-intercept')
                        .on('touchstart', {baton: baton}, function (e) {
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            e.data.baton.app.toggleFolderView();
                        }).hide()
                );
            }
        });

        // toolbar
        ext.point(POINT + '/sidepanel/toolbar').extend({
            id: 'add',
            index: 100,
            draw: function (baton) {
                var ul;
                this.append(
                    $('<div class="toolbar-action pull-left dropdown dropup" data-action="add">').append(
                        $('<a href="#" class="dropdown-toggle">')
                            .attr({
                                'data-toggle': 'dropdown',
                                tabindex: 1,
                                role: 'menuitem',
                                'aria-haspopup': true,
                                title: gt('Add folder menu'),
                                'aria-label': gt('Add folder menu')
                            })
                            .append($('<i class="icon-plus">')),
                        ul = $('<ul class="dropdown-menu" role="menu">')
                    )
                );
                ext.point(POINT + '/sidepanel/toolbar/add').invoke('draw', ul, baton);
            }
        });

        ext.point(POINT + '/sidepanel/toolbar').extend({
            id: 'options',
            index: 200,
            draw: function (baton) {
                var ul;
                this.append(
                    $('<div class="toolbar-action pull-left dropdown dropup" data-action="options">').append(
                        $('<a href="#" class="dropdown-toggle">')
                            .attr({
                                'data-toggle': 'dropdown',
                                tabindex: 1,
                                role: 'menuitem',
                                title: gt('Folder actions'),
                                'aria-label': gt('Folder actions'),
                                'aria-haspopup': true
                            })
                            .append($('<i class="icon-cog" aria-hidden="true" role="presentation">')),
                        ul = $('<ul class="dropdown-menu" role="menu">').append(
                            $('<li class="dropdown-header" role="presentation" aria-hidden="true">').text(_.noI18n(baton.data.title))
                        )
                    )
                );
                ext.point(POINT + '/sidepanel/toolbar/options').invoke('draw', ul, baton);
            }
        });

        function addTopLevelFolder(e) {
            e.preventDefault();
            e.data.app.folderView.add('1', { module: 'mail' });
        }

        function addSubFolder(e) {
            e.preventDefault();
            // set explicit folder?
            if (/^(contacts|calendar|tasks)$/.test(e.data.type)) {
                e.data.app.folderView.add(api.getDefaultFolder(e.data.type));
            } else {
                e.data.app.folderView.add();
            }
        }

         // toolbar actions
        ext.point(POINT + '/sidepanel/toolbar/add').extend({
            id: 'add-toplevel-folder',
            index: 100,
            draw: function (baton) {
                if (baton.options.type === 'mail') {
                    // only show for mail
                    this.append($('<li>').append(
                        $('<a href="#" data-action="add-toplevel-folder" tabindex="1" role="menuitem">').text(gt('Add new folder'))
                        .on('click', { app: baton.app }, addTopLevelFolder)
                    ));
                }
            }
        });

        ext.point(POINT + '/sidepanel/toolbar/add').extend({
            id: 'add-folder',
            index: 200,
            draw: function (baton) {
                // only mail and infostore show hierarchies
                var label = /^(contacts|calendar|tasks)$/.test(baton.options.type) ? gt('Add private folder') : gt('Add subfolder'),
                    link = $('<a href="#" data-action="add-subfolder" role="menuitem">').text(label);
                if (api.can('create', baton.data)) {
                    link.attr('tabindex', 1).on('click', { app: baton.app, type: baton.options.type }, addSubFolder);
                } else {
                    link.attr('aria-disabled', true).addClass('disabled');
                }
                this.append($('<li>').append(link));
            }
        });

        function createPublicFolder(e) {
            e.preventDefault();
            // public folder has the magic id 2
            e.data.app.folderView.add('2', { module: e.data.module });
        }

        ext.point(POINT + '/sidepanel/toolbar/add').extend({
            id: 'add-public-folder',
            index: 200,
            draw: function (baton) {

                var type = baton.options.type,
                    link = $('<a href="#" data-action="add-public-folder" role="menuitem">').text(gt('Add public folder'));

                if (!capabilities.has('edit_public_folders')) return;
                if (!(type === 'contacts' || type === 'calendar' || type === 'tasks')) return;

                api.get({folder: 2}).then(function (public_folder) {
                    if (api.can('create', public_folder)) {
                        link.attr('tabindex', 1).on('click', {app: baton.app, module: type}, createPublicFolder);
                    } else {
                        link.attr('aria-disabled', true).addClass('disabled');
                    }
                });
                this.append($('<li>').append(link));
            }
        });

        function publish(e) {
            e.preventDefault();
            require(['io.ox/core/pubsub/publications'], function (publications) {
                publications.buildPublishDialog(e.data.baton);
            });
        }

        ext.point(POINT + '/sidepanel/toolbar/add').extend({
            id: 'publications',
            index: 500,
            draw: function (baton) {
                // do not draw if not available
                if (capabilities.has('publication') && api.can('publish', baton.data)) {
                    this.append(
                        $('<li class="divider" aria-hidden="true" role="presentation">'),
                        $('<li>').append(
                            $('<a href="#" data-action="publications" role="menuitem" tabindex="1">')
                            .text(gt('Share this folder'))
                            .on('click', { baton: baton }, publish)
                        )
                    );
                }
            }
        });

        function subscribe(e) {
            e.preventDefault();
            require(['io.ox/core/pubsub/subscriptions'], function (subscriptions) {
                subscriptions.buildSubscribeDialog(e.data.baton);
            });
        }

        ext.point(POINT + '/sidepanel/toolbar/add').extend({
            id: 'subscribe',
            index: 600,
            draw: function (baton) {
                // do not draw if not available
                if (capabilities.has('subscription') && api.can('subscribe', baton.data)) {
                    this.append(
                        $('<li>').append(
                            $('<a href="#" data-action="subscriptions" role="menuitem" tabindex="1">')
                            .text(gt('Subscription'))
                            .on('click', { baton: baton }, subscribe)
                        )
                    );
                }
            }
        });

        function renameFolder(e) {
            e.preventDefault();
            e.data.app.folderView.rename();
        }

        ext.point(POINT + '/sidepanel/toolbar/options').extend({
            id: 'rename',
            index: 100,
            draw: function (baton) {
                var link = $('<a href="#" data-action="rename" role="menuitem">').text(gt('Rename'));
                this.append($('<li>').append(link));
                if (api.can('rename', baton.data)) {
                    link.attr('tabindex', 1).on('click', { app: baton.app }, renameFolder);
                } else {
                    link.attr('aria-disabled', true).addClass('disabled').on('click', $.preventDefault);
                }
            }
        });

        function deleteFolder(e) {
            e.preventDefault();
            e.data.app.folderView.remove();
        }

        ext.point(POINT + '/sidepanel/toolbar/options').extend({
            id: 'delete',
            index: 500,
            draw: function (baton) {
                var link = $('<a href="#" data-action="delete" role="menuitem">').text(gt('Delete'));
                this.append(
                    (baton.options.type === 'mail' ? '' : $('<li class="divider" role="presentation" aria-hidden="true">')),
                    $('<li>').append(link)
                );
                if (api.can('deleteFolder', baton.data)) {
                    link.attr('tabindex', 1).on('click', { app: baton.app }, deleteFolder);
                } else {
                    link.attr('aria-disabled', true).addClass('disabled').on('click', $.preventDefault);
                }
            }
        });

        function exportData(e) {
            e.preventDefault();
            require(['io.ox/core/export/export'], function (exporter) {
                //module,folderid
                exporter.show(e.data.baton.data.module, String(e.data.baton.app.folderView.selection.get()));
            });
        }

        ext.point(POINT + '/sidepanel/toolbar/options').extend({
            id: 'export',
            index: 250,
            draw: function (baton) {
                if (_.device('!ios && !android')) {
                    var link = $('<a href="#" data-action="export">').text(gt('Export'));
                    this.append(
                        $('<li>').append(link)
                    );
                    if (api.can('export', baton.data)) {
                        link.attr('tabindex', 1).on('click', { baton: baton }, exportData);
                    } else {
                        link.attr('aria-disabled', true).addClass('disabled').on('click', $.preventDefault);
                    }
                }
            }
        });

        function importData(e) {
            e.preventDefault();
            require(['io.ox/core/import/import'], function (importer) {
                importer.show(e.data.baton.data.module, String(e.data.baton.app.folderView.selection.get()));
            });
        }

        ext.point(POINT + '/sidepanel/toolbar/options').extend({
            id: 'import',
            index: 245,
            draw: function (baton) {
                if (_.device('!ios && !android')) {
                    var link = $('<a href="#" data-action="import">').text(gt('Import'));
                    this.append(
                        $('<li>').append(link)
                    );
                    if (api.can('import', baton.data)) {
                        link.attr('tabindex', 1).on('click', { baton: baton }, importData);
                    } else {
                        link.attr('aria-disabled', true).addClass('disabled').on('click', $.preventDefault);
                    }
                }
            }
        });


        function setFolderPermissions(e) {
            e.preventDefault();
            var app = e.data.app,
                folder = String(app.folder.get());
            require(['io.ox/core/permissions/permissions'], function (permissions) {
                permissions.show(folder);
            });
        }

        ext.point(POINT + '/sidepanel/toolbar/options').extend({
            id: 'permissions',
            index: 300,
            draw: function (baton) {
                if (capabilities.has('!alone') && capabilities.has('gab') && _.device('!smartphone')) {
                    var link = $('<a href="#" data-action="permissions" tabindex="1" role="menuitem">').text(gt('Permissions'));
                    this.append(
                        $('<li class="divider" aria-hidden="true" role="presentation">'),
                        $('<li>').append(link.on('click', { app: baton.app }, setFolderPermissions))
                    );
                }
            }
        });

        function showFolderProperties(e) {

            e.preventDefault();

            // get current folder id
            var baton = e.data.baton, id = baton.app.folder.get();

            api.get({ folder: id }).done(function (folder) {
                require(['io.ox/core/tk/dialogs', 'io.ox/core/tk/folderviews'], function (dialogs, views) {
                    var title = gt('Properties'),
                    dialog = new dialogs.ModalDialog({
                        easyOut: true
                    })
                    .header(
                        api.getBreadcrumb(folder.id, { prefix: title }).css({ margin: '0' })
                    )
                    .build(function () {
                        function ucfirst(str) {
                            return str.charAt(0).toUpperCase() + str.slice(1);
                        }
                        var node = this.getContentNode().append(
                            $('<div class="row-fluid">').append(
                                $('<label>')
                                    .css({'padding-top': '5px', 'padding-left': '5px'})
                                    .addClass('span3')
                                    .text(gt('Folder type')),
                                $('<input>', { type: 'text' })
                                    .addClass('span9')
                                    .attr('readonly', 'readonly')
                                    .val(ucfirst(folder.module))
                            )
                        );
                        // show CalDAV URL for calendar folders
                        // users requires "caldav" capability
                        if (folder.module === 'calendar' && capabilities.has('caldav')) {
                            node.append(
                                $('<div class="row-fluid">').append(
                                    $('<label>')
                                        .css({'padding-top': '5px', 'padding-left': '5px'})
                                        .addClass('span3')
                                        .text(gt('CalDAV URL')),
                                    $('<input>', { type: 'text' })
                                        .addClass('span9')
                                        .attr('readonly', 'readonly')
                                        .val(
                                            _.noI18n(caldavConfig.get('url')
                                                .replace("[hostname]", location.host)
                                                .replace("[folderId]", id)
                                        )
                                    )
                                )
                            );
                        }
                    })
                    .addPrimaryButton('ok', gt('Close'))
                    .show().done(function () { dialog = null; });
                });
            });
        }

        ext.point(POINT + '/sidepanel/toolbar/options').extend({
            id: 'properties',
            index: 400,
            draw: function (baton) {
                if (_.device('!smartphone')) {
                    var link = $('<a href="#" data-action="properties" tabindex="1" role="menuitem">').text(gt('Properties'));
                    if (!capabilities.has('gab')) {
                        //workaround: add divider if not set by permissions yet
                        this.append($('<li class="divider" aria-hidden="true" role="presentation">'));
                    }
                    this.append($('<li>').append(link));
                    link.on('click', { baton: baton }, showFolderProperties);
                }
            }
        });

        function moveFolder(e) {

            e.preventDefault();

            // get current folder id
            var baton = e.data.baton, id = baton.app.folder.get();

            api.get({ folder: id }).done(function (folder) {
                require(['io.ox/core/tk/dialogs', 'io.ox/core/tk/folderviews'], function (dialogs, views) {
                    var title = gt('Move folder'),
                        dialog = new dialogs.ModalDialog({ easyOut: true })
                            .header(
                                api.getBreadcrumb(folder.id, { prefix: title }).css({ margin: '0' })
                            )
                            .addPrimaryButton('ok', title)
                            .addButton('cancel', gt('Cancel'));
                    dialog.getBody().css('height', '250px');
                    var type = baton.options.type,
                        tree = new views.FolderTree(dialog.getBody(), {
                            type: type,
                            rootFolderId: type === 'infostore' ? '9' : '1',
                            skipRoot: true,
                            tabindex: 0,
                            cut: folder.id,
                            customize: function (data) {
                                var canMove = api.can('moveFolder', folder, data);
                                if (!canMove) {
                                    this.removeClass('selectable').addClass('disabled');
                                }
                            }
                        });
                    dialog.show(function () {
                        tree.paint().done(function () {
                            // open the foldertree to the current folder
                            tree.select(folder.id).done(function () {
                                // select first active element
                                tree.selection.updateIndex().selectFirst();
                                // focus
                                dialog.getBody().focus();
                            });
                        });
                    })
                    .done(function (action) {
                        if (action === 'ok') {
                            var selectedFolder = tree.selection.get();
                            if (selectedFolder.length === 1) {
                                // move action
                                api.move(folder.id, selectedFolder[0]).fail(notifications.yell);
                            }
                        }
                        tree.destroy().done(function () {
                            tree = dialog = null;
                        });
                    });
                });
            });
        }

        ext.point(POINT + '/sidepanel/toolbar/options').extend({
            id: 'move',
            index: 200,
            draw: function (baton) {

                if (!/^(mail|infostore)$/.test(baton.options.type)) return;
                if (_.device('smartphone')) return;

                var link = $('<a href="#" data-action="delete" role="menuitem">').text(gt('Move'));
                this.append($('<li>').append(link));
                if (api.can('deleteFolder', baton.data)) {
                    link.attr('tabindex', 1).on('click', { baton: baton }, moveFolder);
                } else {
                    link.attr('aria-disabled', true).addClass('disabled').on('click', $.preventDefault);
                }
            }
        });
    }

    /**
     * Add folder view
     */
    function add(app, options) {

        var container = $(),
            sidepanel = $(),
            visible = false,
            tmpVisible = false,
            top = 0,
            onChangeFolder, changeFolder, changeFolderOff, changeFolderOn,
            fnHide, fnShow, fnResize, fnShowSml, fnHideSml, initResize, restoreWidth, makeResizable,
            toggle, toggleTree, loadTree, initTree,
            name = app.getName(),
            POINT = name + '/folderview',
            TOGGLE = name + '/links/toolbar',
            ACTION = name + '/actions/toggle-folderview',
            baton = new ext.Baton({ app: app });

        changeFolder = function (e, folder) {
            app.folderView.selection.set(folder.id);
        };

        changeFolderOn = function () {
            app.on('folder:change', changeFolder);
        };

        changeFolderOff = function () {
            app.off('folder:change', changeFolder);
        };

        onChangeFolder = function (e, selection) {
            var id = _(selection).first();

            api.get({ folder: id }).done(function (data) {
                if (_.device('small')) {
                    // close tree
                    fnHideSml();
                }
                if (data.module === options.type) {
                    changeFolderOff();
                    app.folder.set(id);
                    changeFolderOn();
                }
            });
        };

        restoreWidth = $.noop;

        makeResizable = function () {

            var resizeBar, minSidePanelWidth, windowContainer, maxSidePanelWidth;

            sidepanel.append(resizeBar = $('<div class="resizebar">'));
            // needs to match min-width!
            minSidePanelWidth = 170;

            function resetWidths() {
                if ($(window).width() < 700) {
                    app.getWindow().nodes.body.css('left', '');
                    sidepanel.removeAttr('style');
                }
            }

            function getWidths() {
                windowContainer = sidepanel.closest('.window-container-center');
                maxSidePanelWidth = windowContainer.width() / 2;
                restoreWidth();
            }

            function applyWidth(width) {
                var nodes = app.getWindow().nodes;
                nodes.body.css('left', width + 'px');
                nodes.sidepanel.css('width', width + 'px');
                windowContainer.data('resize-width', width);
            }

            restoreWidth = function () {
                var width = app.settings.get('folderview/width/' + _.display(), 250);
                applyWidth(width);
                resetWidths();
            };

            resizeBar.off('mousedown').on('mousedown', function (e) {
                e.preventDefault();
                windowContainer.on('mousemove', function (e) {
                    var newWidth = e.pageX;
                    if (newWidth < maxSidePanelWidth && newWidth > minSidePanelWidth) {
                        applyWidth(newWidth);
                    }
                });
            });

            getWidths();

            windowContainer.on('mouseup', function (e) {
                windowContainer.off('mousemove');
                var width = $(this).data('resize-width') || 250;
                app.settings.set('folderview/width/' + _.display(), width).save();
            });

            $(window).off('resize.folderview').on('resize.folderview', function (e) {
                if (!visible) { fnHide(); } else { fnShow(true);  }
            });
        };

        fnResize = function () {
            var nodes = app.getWindow().nodes;
            if ($(document).width() > 700) {
                nodes.body.css('left', '50px');
            } else {
                nodes.body.css('left', '0px');
            }
        };

        fnHide = function () {
            app.settings.set('folderview/visible/' + _.display(), visible = false).save();
            top = container.scrollTop();
            var nodes = app.getWindow().nodes;
            fnResize();
            nodes.sidepanel.removeClass('visible').css('width', '');
            app.trigger('folderview:close');
            if (app.getGrid) {
                app.getGrid().focus();
            }
        };

        fnShow = function (resized) {
            app.settings.set('folderview/visible/' + _.display(), visible = true).save();
            var nodes = app.getWindow().nodes;
            fnResize();
            nodes.sidepanel.addClass('visible');
            restoreWidth();
            if (!resized) {
                baton.$.container.focus();
            }
            app.trigger('folderview:open');
            return $.when();
        };

        fnHideSml = function () {
            app.settings.set('folderview/visible/' + _.display(), visible = false).save();
            top = container.scrollTop();
            $('.window-container-center').removeClass('animate-moveright').addClass('animate-moveleft');
            baton.$.spacer.hide();
            app.trigger('folderview:close');
        };

        fnShowSml = function () {
            app.settings.set('folderview/visible/' + _.display(), visible = true).save();
            $('.window-container-center').removeClass('animate-moveleft').addClass('animate-moveright');
            baton.$.spacer.show();
            app.trigger('folderview:open');
            return $.when();
        };

        toggle = function () {
            if (_.device('smartphone')) {
                if (visible) { fnHideSml(); } else { fnShowSml();  }
            } else {
                if (visible) { fnHide(); } else { fnShow();  }
            }
        };

        initResize = function () {

            // no resize in either touch devices or small devices
            if (_.device('smartphone')) return;

            makeResizable();
            restoreWidth();
        };

        initTree = function (views) {

            // work with old non-device specific setting (<= 7.2.2) and new device-specific approach (>= 7.4)
            var open = app.settings.get('folderview/open', {});
            if (open && open[_.display()]) open = open[_.display()];
            open = _.isArray(open) ? open : [];

            // init tree before running toolbar extensions
            var tree = baton.tree = app.folderView = new views[options.view](container, {
                    type: options.type,
                    rootFolderId: String(options.rootFolderId),
                    open: open,
                    toggle: function (open) {
                        app.settings.set('folderview/open/' + _.display(), open).save();
                    }
                });

            // draw toolbar
            tree.selection.on('change', function (e, selection) {
                if (selection.length) {
                    var id = selection[0];
                    api.get({ folder: id }).done(function (data) {
                        baton.data = data;
                        // update toolbar
                        ext.point(POINT + '/sidepanel/toolbar').invoke('draw', baton.$.toolbar.empty(), baton);
                        // reload tree node
                        tree.reloadNode(id);
                    });
                }
            });

            // mobile quirks, cannot be applied to css class
            // because it would be applied to desktop clients using
            // a small screen, too
            if (_.device('smartphone')) {
                // mobile stuff
                $('.window-sidepanel').css({
                    'width': '90%',
                    'left': '-90%',
                    'right': 'intial'
                });
                // listen to swipe
                // TODO: works not reliable on android stock browsers, add a manual close button also
                sidepanel.on('swipeleft', toggle);

            }
            // paint now
            return tree.paint().pipe(function () {

                if (options.visible === false) {
                    initResize();
                }

                return tree.select(app.folder.get()).done(function () {

                    tree.selection.on('change', onChangeFolder);
                    toggleTree = toggle;
                    sidepanel.idle();

                    changeFolderOn();

                    api.on('create', function (e, data) {
                        tree.repaint().done(function () {
                            tree.select(data.id);
                        });
                    });

                    api.on('delete:prepare', function (e, data) {
                        var folder = data.folder_id, id = data.id;
                        if (folder === '1') {
                            folder = api.getDefaultFolder(data.module) || '1';
                        }
                        tree.select(folder);
                        tree.removeNode(id);
                    });

                    api.on('delete', function (e, id) {
                        app.trigger('folder:delete', id);
                    });

                    api.on('refresh', function () {
                        tree.repaint();
                    });

                    api.on('update', function (e, id, newId, data) {
                        // this is used by folder rename, since the id might change (mail folders)
                        var sel = tree.selection.get();
                        if (_.isEqual(sel, [id])) {
                            tree.repaint().done(function () {
                                tree.idle();
                                if (newId !== id) tree.select(newId);
                            });
                        } else {
                            if (!id && !newId && sel.length === 0) {
                                tree.select(coreConfig.get('folder/' + options.type) + '');
                            }
                            tree.repaint();
                        }
                    });

                    api.on('delete:fail update:fail create:fail', function (e, error) {
                        notifications.yell(error);
                        tree.repaint();
                    });

                    api.on('update:unread', function (e, id, data) {
                        tree.reloadNode(id);
                    });

                    // just a delveopment hack - turning off - no right click menus!
                    // sidepanel.on('contextmenu', '.folder', function (e) {
                    //     e.preventDefault();
                    //     $(this).closest('.foldertree-sidepanel').find('.foldertree-toolbar > [data-action="options"]').addClass('open');
                    //     return false;
                    // });

                    initTree = loadTree = null;
                });
            });
        };

        loadTree = function (e) {
            toggle();
            app.showFolderView = _.device('smartphone') ? fnShowSml : fnShow;
            app.hideFolderView = _.device('smartphone') ? fnHideSml : fnHide;
            app.toggleFolderView = toggle;
            loadTree = toggleTree = $.noop;
            return require(['io.ox/core/tk/folderviews']).pipe(initTree);
        };

        toggleTree = loadTree;

        app.showFolderView = loadTree;
        app.hideFolderView = $.noop;
        app.toggleFolderView = loadTree;
        app.folderView = null;

        app.folderViewIsVisible = function () {
            return visible;
        };

        initExtensions(POINT, app);

        // apply all options
        _(ext.point(POINT + '/options').all()).each(function (obj) {
            options = _.extend(obj, options || {});
        });

        baton.options = options;

        // draw sidepanel & container
        ext.point(POINT + '/sidepanel').invoke('draw', app.getWindow().nodes.sidepanel, baton);

        if (_.device('smartphone')) {
            ext.point(POINT + '/sidepanel/mobile').invoke('draw', app.getWindow().nodes.outer, baton);
        }

        sidepanel = baton.$.sidepanel;
        container = baton.$.container;

        var icon = $('<i class="icon-folder-close">').attr('aria-label', gt('Toggle folder'));

        app.on('folderview:open', function () {
            icon.attr('class', 'icon-folder-open');
        });

        app.on('folderview:close', function () {
            icon.attr('class', 'icon-folder-close');
        });

        new links.ActionGroup(TOGGLE, {
            id: 'folder',
            index: 200,
            icon: function () {
                return icon;
            }
        });

        new links.Action(ACTION, {
            action: function (baton) {
                toggleTree();
            }
        });

        new links.ActionLink(TOGGLE + '/folder', {
            index: 100,
            id: 'toggle',
            label: gt('Toggle folder'),
            addClass: 'folderview-toggle',
            ref: ACTION
        });

        if (options.visible === true) {
            toggleTree();
            app.getWindow().on('open', initResize);
        }

        // auto-open on drag
        app.getWindow().nodes.body
            .on('selection:dragstart', function () {
                tmpVisible = !visible;
                app.showFolderView();
            })
            .on('selection:dragstop', function () {
                if (tmpVisible) {
                    app.hideFolderView();
                }
            });
    }

    return {
        add: add
    };
});
