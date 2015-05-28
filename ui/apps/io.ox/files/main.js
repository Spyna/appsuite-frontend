/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2011 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 */

define('io.ox/files/main', [
    'io.ox/core/commons',
    'gettext!io.ox/files',
    'settings!io.ox/files',
    'io.ox/core/extensions',
    'io.ox/core/folder/api',
    'io.ox/core/folder/tree',
    'io.ox/core/folder/view',
    'io.ox/files/listview',
    'io.ox/core/tk/list-control',
    'io.ox/core/extPatterns/actions',
    'io.ox/core/toolbars-mobile',
    'io.ox/core/page-controller',
    'io.ox/core/capabilities',
    'io.ox/files/api',
    'io.ox/core/viewer/views/sidebarview',
    'io.ox/files/mobile-navbar-extensions',
    'io.ox/files/mobile-toolbar-actions',
    'io.ox/files/actions',
    'less!io.ox/files/style',
    'less!io.ox/core/viewer/style',
    'io.ox/files/toolbar',
    'io.ox/files/upload/dropzone'
], function (commons, gt, settings, ext, folderAPI, TreeView, FolderView, FileListView, ListViewControl, actions, Bars, PageController, capabilities, api, Sidebarview) {

    'use strict';

    // application object
    var app = ox.ui.createApp({ name: 'io.ox/files', title: 'Drive' }),
        // app window
        win,
        sidebarView = new Sidebarview({});

    app.mediator({

        /*
         * Pages for desktop
         * As this module uses only one perspective, we only need one page
         */
        'pages-desktop': function (app) {
            if (_.device('smartphone')) return;
            var c = app.getWindow().nodes.main;

            app.pages = new PageController(app);

            // create 3 pages with toolbars and navbars
            app.pages.addPage({
                name: 'main',
                container: c,
                startPage: true
            });
        },

        /*
         * Init pages for mobile use
         * Each View will get a single page with own
         * toolbars and navbars. A PageController instance
         * will handle the page changes and also maintain
         * the state of the toolbars and navbars
         */
        'pages-mobile': function (app) {
            if (_.device('!smartphone')) return;
            var win = app.getWindow(),
                navbar = $('<div class="mobile-navbar">'),
                toolbar = $('<div class="mobile-toolbar">')
                    .on('hide', function () { win.nodes.body.removeClass('mobile-toolbar-visible'); })
                    .on('show', function () { win.nodes.body.addClass('mobile-toolbar-visible'); }),
                baton = ext.Baton({ app: app });

            app.navbar = navbar;
            app.toolbar = toolbar;
            app.pages = new PageController({ appname: app.options.name, toolbar: toolbar, navbar: navbar, container: win.nodes.main });

            win.nodes.body.addClass('classic-toolbar-visible').append(navbar, toolbar);

            // create 3 pages with toolbars and navbars
            app.pages.addPage({
                name: 'folderTree',
                navbar: new Bars.NavbarView({
                    baton: baton,
                    extension: 'io.ox/files/mobile/navbar'
                })
            });

            app.pages.addPage({
                name: 'main',
                startPage: true,
                navbar: new Bars.NavbarView({
                    baton: baton,
                    extension: 'io.ox/files/mobile/navbar'
                }),
                toolbar: new Bars.ToolbarView({
                    baton: baton,
                    page: 'main',
                    extension: 'io.ox/files/mobile/toolbar'
                }),
                secondaryToolbar: new Bars.ToolbarView({
                    baton: baton,
                    page: 'main/multiselect',
                    extension: 'io.ox/files/mobile/toolbar'
                })
            });

            /*app.pages.addPage({
                name: 'detailView',
                navbar: new Bars.NavbarView({
                    baton: baton,
                    extension: 'io.ox/files/mobile/navbar'
                }),
                toolbar: new Bars.ToolbarView({
                    baton: baton,
                    page: 'detailView',
                    extension: 'io.ox/files/mobile/toolbar'

                })
            });*/

            // important
            // tell page controller about special navigation rules
            app.pages.setBackbuttonRules({
                'main': 'folderTree'
            });
        },

        /*
         * Init all nav- and toolbar labels for mobile
         */
        'navbars-mobile': function (app) {

            if (!_.device('smartphone')) return;

            app.pages.getNavbar('main')
                .setLeft(gt('Folders'))
                .setRight(
                    //#. Used as a button label to enter the "edit mode"
                    gt('Edit')
                );

            app.pages.getNavbar('folderTree')
                .setTitle(gt('Folders'))
                .setLeft(false)
                .setRight(gt('Edit'));

            /*app.pages.getNavbar('detailView')
                // no title
                .setTitle('')
                .setLeft(
                    //#. Used as button label for a navigation action, like the browser back button
                    gt('Back')
                );
            */
            // tell each page's back button what to do
            app.pages.getNavbar('main')
                .on('leftAction', function () {
                    app.pages.goBack();
                }).hide('.right');

            /*app.pages.getNavbar('detailView').on('leftAction', function () {
                app.pages.goBack();
            });*/

            // TODO restore last folder as starting point
            app.pages.showPage('main');
        },

        /*
         * Folder view support
         */
        'folder-view': function (app) {

            if (_.device('smartphone')) return;

            // tree view
            var tree = new TreeView({ app: app, module: 'infostore', root: settings.get('rootFolderId', 9), contextmenu: true });

            // initialize folder view
            FolderView.initialize({ app: app, tree: tree });
            app.folderView.resize.enable();
        },
        /*
         * Folder view mobile support
         */
        'folder-view-mobile': function (app) {

            if (_.device('!smartphone')) return;

            var nav = app.pages.getNavbar('folderTree'),
                page = app.pages.getPage('folderTree');

            nav.on('rightAction', function () {
                app.toggleFolders();
            });

            var tree = new TreeView({ app: app, contextmenu: true, module: 'infostore', root: settings.get('rootFolderId', 9) });

            // initialize folder view
            FolderView.initialize({ app: app, tree: tree, firstResponder: 'main' });
            page.append(tree.render().$el);
        },

        /*
         * Folder change listener for mobile
         */
        'change:folder-mobile': function (app) {
            if (_.device('!smartphone')) return;

            function update() {
                app.folder.getData().done(function (d) {
                    app.pages.getNavbar('main').setTitle(d.title);
                });
            }

            app.on('folder:change', update);

            // do once on startup
            update();
        },

        /*
         * Get folder-based view options
         */
        'get-view-options': function (app) {
            app.getViewOptions = function (folder) {
                var options = app.settings.get(['viewOptions', folder]);
                return _.extend({ sort: 702, order: 'asc', layout: 'list' }, options);
            };
        },

        /*
         * Default application properties
         */
        'props': function (app) {
            // layout
            var layout = app.settings.get('layout');
            if (!/^(list|icon|tile)/.test(layout)) layout = 'list';
            // introduce shared properties
            app.props = new Backbone.Model({
                'checkboxes': _.device('smartphone') ? false : app.settings.get('showCheckboxes', false),
                'filter': 'none',
                'layout': layout,
                'folderEditMode': false
            });
            // initial setup
            var folder = app.folder.get();
            if (folder) app.props.set(app.getViewOptions(folder));
        },

        /*
         * Setup list view
         */
        'list-view': function (app) {
            app.listView = new FileListView({ app: app, draggable: true, ignoreFocus: true, noSwipe: true });
            app.listView.model.set({ folder: app.folder.get(), sort: app.props.get('sort'), order: app.props.get('order') });
            // for debugging
            window.list = app.listView;
        },

        /*
         * Setup list view control
         */
        'list-view-control': function (app) {
            app.listControl = new ListViewControl({ id: 'io.ox/files', listView: app.listView, app: app });
            var node = _.device('smartphone') ? app.pages.getPage('main') : app.getWindow().nodes.main;
            node.append(
                $('<div class="container">').append(
                    app.listControl.render().$el
                    //#. items list (e.g. mails)
                    .attr('aria-label', gt('Item list'))
                    .find('.toolbar')
                    //#. toolbar with 'select all' and 'sort by'
                    .attr('aria-label', gt('Item list options'))
                    .end()
                )
            );
            app.listControl.resizable();
        },

        /*
         * Connect collection loader with list view
         */
        'connect-loader': function (app) {
            app.listView.connect(api.collectionLoader);
        },

        /*
         * Respond to folder change
         */
        'folder:change': function (app) {

            app.on('folder:change', function (id) {
                // we clear the list now to avoid flickering due to subsequent layout changes
                app.listView.empty();
                var options = app.getViewOptions(id);
                app.props.set(options);
                app.listView.model.set('folder', id);
            });
        },

        /*
         * Store view options
         */
        'store-view-options': function (app) {
            app.props.on('change', _.debounce(function () {
                if (app.props.get('find-result')) return;
                var folder = app.folder.get(), data = app.props.toJSON();
                app.settings
                    .set(['viewOptions', folder], { sort: data.sort, order: data.order, layout: data.layout });
                if (_.device('!smartphone')) {
                    app.settings.set('showCheckboxes', data.checkboxes);
                }
                app.settings.save();
            }, 500));
        },

        /*
         * Restore view opt
         */
        'restore-view-options': function (app) {
            var data = app.getViewOptions(app.folder.get());
            app.props.set(data);
        },

        /*
         * Respond to changed sort option
         */
        'change:sort': function (app) {
            app.props.on('change:sort', function (model, value) {
                // set proper order first
                var model = app.listView.model;
                model.set('order', (/^(5|704)$/).test(value) ? 'desc' : 'asc', { silent: true });
                app.props.set('order', model.get('order'));
                // now change sort columns
                model.set('sort', value);
            });
        },

        /*
         * Respond to changed order
         */
        'change:order': function (app) {
            app.props.on('change:order', function (model, value) {
                app.listView.model.set('order', value);
            });
        },

        'selection:change': function () {
            if (_.device('!touch')) {
                app.listView.on('selection:change', function () {
                    if (app.listView.selection.isEmpty()) {
                        sidebarView.$el.empty();
                        app.getWindow().nodes.main.append(
                            sidebarView.$el.addClass('rightside').append(
                                $('<div class="io-ox-center">').append(
                                    $('<div class="summary empty">').text(gt('No elements selected'))
                                )
                            )
                        );
                        sidebarView.$el.find('.io-ox-center').wrapAll('<div class="wrapper">');
                    } else {
                        var fileModel = app.listView.collection.get(app.listView.selection.get()[0]);
                        sidebarView.render(fileModel);
                        sidebarView.renderSections();

                        app.getWindow().nodes.main.append(
                            sidebarView.$el.addClass('rightside')
                        );
                        sidebarView.$el.children().wrapAll('<div class="wrapper">');
                    }
                });
            }
        },

        /*
         * Respond to changed filter
         */
        'change:filter': function (app) {
            app.props.on('change:filter', function (model, value) {
                app.listView.selection.selectNone();
                if (value === 'none') app.listView.setFilter();
                else app.listView.setFilter('.file-type-' + value);
            });
        },

        // respond to resize events
        'resize': function (app) {

            if (_.device('smartphone')) return;

            $(window).on('resize', function () {

                var list = app.listView, width, layout, gridWidth, column;

                // skip recalcucation if invisible
                if (!list.$el.is(':visible')) return;

                width = list.$el.width();
                layout = app.props.get('layout');
                gridWidth = layout === 'icon' ? 140 : 180;
                // icon: 140px as minimum width (120 content + 20 margin/border)
                // tile: 180px (160 + 20)
                // minimum is 1, maximum is 12
                column = Math.max(1, Math.min(12, width / gridWidth >> 0));

                // update class name
                list.el.className = list.el.className.replace(/\s?grid\-\d+/g, '');
                list.$el.addClass('grid-' + column).attr('grid-count', column);
            });

            $(window).trigger('resize');
        },

        /*
         * Respond to changing layout
         */
        'change:layout': function (app) {

            app.applyLayout = function () {

                var layout = app.props.get('layout'),
                    savedWidth = app.settings.get('listview/width/' + _.display(), '360'),
                    left = app.listControl.$el.parent(),
                    right = sidebarView.$el;

                function applyWidth(x) {
                    var width = x === undefined ? '' :  x + 'px';
                    left.css('width', width);
                    right.css('left', width);
                }

                // remove inline styles from using the resize bar
                left.css({ width: '' });

                if (layout === 'list') {
                    app.listView.$el.addClass('column-layout').removeClass('grid-layout icon-layout tile-layout');
                } else if (layout === 'icon') {
                    app.listView.$el.addClass('grid-layout icon-layout').removeClass('column-layout tile-layout');
                } else {
                    app.listView.$el.addClass('grid-layout tile-layout').removeClass('column-layout icon-layout');
                }
                applyWidth(savedWidth);

                if (_.device('smartphone')) {
                    onOrientationChange();
                }
            };

            function onOrientationChange() {
                if (_.device('landscape')) {
                    //use 3 items per row on smartphones in landscape orientation
                    app.listView.$el.removeClass('grid-2').addClass('grid-3');
                } else {
                    //use 2 items per row on smartphones in portrait orientation
                    app.listView.$el.removeClass('grid-3').addClass('grid-2');
                }
            }

            if (_.device('smartphone')) {
                //use debounce here or some smartphone animations are not finished yet, resulting in incorrect orientationstate (seen on S4)
                $(window).on('orientationchange', _.debounce(onOrientationChange, 500));
            }

            app.props.on('change:layout', function () {
                _.defer(function () {
                    app.applyLayout();
                    app.listView.redraw();
                    $(document).trigger('resize');
                });
            });

            app.applyLayout();
        },

        /*
         * Add support for doubleclick
         */
        'selection-doubleclick': function (app) {

            var ev = _.device('touch') ? 'tap' : 'dblclick';

            app.listView.$el.on(ev, '.file-type-folder', function (e) {
                var obj = _.cid($(e.currentTarget).attr('data-cid'));
                app.folder.set(obj.id);
            });

            app.listView.$el.on(ev, '.list-item:not(.file-type-folder)', function (e) {
                var cid = $(e.currentTarget).attr('data-cid'),
                    selectedModel = _(api.resolve([cid], false)).invoke('toJSON'),
                    baton = ext.Baton({ data: selectedModel[0], collection: app.listView.collection, app: app });
                ox.load(['io.ox/core/viewer/main']).done(function (Viewer) {
                    var viewer = new Viewer();
                    viewer.launch( { selection: baton.data, files: baton.collection.models });
                });
            });
        },

        /*
         * Respond to API events that need a reload
         */
        'requires-reload': function (app) {
            // listen to events that affect the filename, add files, or remove files
            api.on('rename add:version remove:version change:version', _.debounce(function () {
                app.listView.reload();
            }, 100));
            // use throttled updates for add:file - in case many small files are uploaded
            api.on('add:file', _.throttle(function () {
                app.listView.reload();
            }, 10000));
            // always refresh when the last file has finished uploading
            api.on('stop:upload', _.bind(app.listView.reload, app.listView));
            var myFolder = false,
                doReload = _.debounce(function () {
                    // we only need to reload if the current folder is affected
                    if (myFolder) {
                        myFolder = false;
                        app.listView.reload();
                    }
                }, 100);
            api.on('copy', function (e, list, targetFolder) {
                var appfolder = app.folder.get();
                if (appfolder === targetFolder) {
                    myFolder = true;
                }
                doReload();
            });
        },

        /*
         * Add listener to files upload to select newly uploaded files after listview reload
         */
        'select-uploaded-files': function (app) {
            api.on('stop:upload', function (e, requests) {
                api.collectionLoader.collection.once('reload', function () {
                    $.when.apply(this, requests).done(function () {
                        var files,
                            selection = app.listView.selection,
                            items;

                        files = _(arguments).map(function (file) {
                            return _.cid({ id: file.data, folder: app.folder.get() });
                        });

                        items = selection.getItems(function () {
                            return files.indexOf($(this).attr('data-cid')) >= 0;
                        });

                        selection.selectNone();
                        selection.selectAll(items);
                    });
                });
            });
        },

        /*
         * Respond to change:checkboxes
         */
        'change:checkboxes': function (app) {

            if (_.device('smartphone')) return;

            app.props.on('change:checkboxes', function (model, value) {
                app.listView.toggleCheckboxes(value);
            });

            app.listView.toggleCheckboxes(app.props.get('checkboxes'));
        },

        'change:details': function (app) {

            if (_.device('smartphone')) return;

            app.props.on('change:details', function (model, value) {
                sidebarView.opened = value;
                app.props.set('details', value);
                sidebarView.$el.toggleClass('opened', sidebarView.opened);
                app.listControl.$el.parent().toggleClass('leftside', sidebarView.opened);
                app.applyLayout();
                app.listView.trigger('selection:change');
            });

        },

        /*
         * Respond to global refresh
         */
        'refresh': function (app) {
            ox.on('refresh^', function () {
                _.defer(function () {
                    app.listView.reload();
                });
            });
        },

        /*
         *
         */
        'folder:add/remove': function (app) {

            folderAPI.on('create', function (data) {
                if (data.folder_id === app.folder.get()) app.listView.reload();
            });

            folderAPI.on('remove', function (id, data) {
                // on folder remove, the folder model is directly removed from the collection.
                // the folder tree automatically selects the parent folder. therefore,
                // the parent folder's collection just needs to be marked as expired
                _(api.pool.getByFolder(data.folder_id)).each(function (collection) {
                    collection.expired = true;
                });
            });
        },

        /*
         * Delete file
         * leave detailview if file is deleted

        'delete:file-mobile': function (app) {
            if (_.device('!smartphone')) return;
            api.on('delete', function () {
                if (app.pages.getCurrentPage().name === 'detailView') {
                    app.pages.goBack();
                }
            });
        },
        */
        /*
         * Set folderview property
         */
        'prop-folderview': function (app) {
            app.props.set('folderview', _.device('smartphone') ? false : app.settings.get('folderview/visible/' + _.display(), true));
        },

        /*
         * Respond to folder view changes
         */
        'change:folderview': function (app) {
            if (_.device('smartphone')) return;
            app.props.on('change:folderview', function (model, value) {
                app.folderView.toggle(value);
            });
            app.on('folderview:close', function () {
                app.props.set('folderview', false);
            });
            app.on('folderview:open', function () {
                app.props.set('folderview', true);
            });
        },

        /*
         * mobile only
         * toggle edit mode in listview on mobiles
         */
        'change:checkboxes-mobile': function (app) {

            if (_.device('!smartphone')) return;

            // bind action on button
            app.pages.getNavbar('main').on('rightAction', function () {
                app.props.set('showCheckboxes', !app.props.get('showCheckboxes'));
            });

            // listen to prop event
            app.props.on('change:showCheckboxes', function () {
                var $view = app.getWindow().nodes.main.find('.view-list');
                app.selection.clear();
                if (app.props.get('showCheckboxes')) {
                    $view.removeClass('checkboxes-hidden');
                    app.pages.getNavbar('main').setRight(gt('Cancel')).hide('.left');
                } else {
                    $view.addClass('checkboxes-hidden');
                    app.pages.getNavbar('main').setRight(gt('Edit')).show('.left');
                }
            });
        },

        'toggle-secondary-toolbar': function (app) {
            app.props.on('change:showCheckboxes', function (model, state) {
                app.pages.toggleSecondaryToolbar('main', state);
            });
        },

        /*
         * Folerview toolbar
         */
        'folderview-toolbar': function (app) {

            if (_.device('smartphone')) return;

            function toggleFolderView(e) {
                e.preventDefault();
                app.folderView.toggle(e.data.state);
            }

            var side = app.getWindow().nodes.sidepanel;
            side.find('.foldertree-container').addClass('bottom-toolbar');
            side.find('.foldertree-sidepanel').append(
                $('<div class="generic-toolbar bottom visual-focus">').append(
                    $('<a href="#" class="toolbar-item" role="button" tabindex="1">')
                    .append(
                        $('<i class="fa fa-angle-double-left" aria-hidden="true">'),
                        $('<span class="sr-only">').text(gt('Close folder view'))
                    )
                    .on('click', { app: app, state: false }, toggleFolderView)
                )
            );
        },

        /*
         * folder edit mode for mobile
         */
        'toggle-folder-editmode': function (app) {

            if (_.device('!smartphone')) return;

            var toggle =  function () {

                var page = app.pages.getPage('folderTree'),
                    state = app.props.get('mobileFolderSelectMode'),
                    right = state ? gt('Edit') : gt('Cancel');

                app.props.set('mobileFolderSelectMode', !state);
                app.pages.getNavbar('folderTree').setRight(right);
                page.toggleClass('mobile-edit-mode', !state);
            };

            app.toggleFolders = toggle;
        },

        'inplace-find': function (app) {

            if (_.device('smartphone') || !capabilities.has('search')) return;

            app.searchable();
        },

        // respond to search results
        'find': function (app) {
            if (_.device('smartphone')) return;
            app.get('find').on({
                'find:query:result': function (response) {
                    api.pool.add('detail', response.results);
                }
            });
        }
    });

    // launcher
    app.setLauncher(function (options) {
        // get window
        app.setWindow(win = ox.ui.createWindow({
            name: 'io.ox/files',
            id: 'io.ox/files',
            title: 'Drive',
            chromeless: true,
            find: capabilities.has('search')
        }));

        win.addClass('io-ox-files-main');
        app.settings = settings;

        commons.wirePerspectiveEvents(app);

        win.nodes.outer.on('selection:drop', function (e, baton) {
            // convert composite keys to objects
            baton.data = _(baton.data).map(function (item) {
                return _.isString(item) ? _.cid(item) : item;
            });
            // call move action (instead of API) to have visual error handlers
            actions.invoke('io.ox/files/actions/move', null, baton);
        });

        // fix missing default folder
        options.folder = options.folder || folderAPI.getDefaultFolder('infostore') || 9;

        // go!
        return commons.addFolderSupport(app, null, 'infostore', options.folder)
            .always(function () {
                app.mediate();
                win.show(function () {
                    // trigger grid resize
                    $(window).trigger('resize');
                });
            });
    });

    return {
        getApp: app.getInstance
    };
});
