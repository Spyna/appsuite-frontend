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
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

define('io.ox/mail/main', [
    'io.ox/mail/util',
    'io.ox/mail/api',
    'io.ox/core/commons',
    'io.ox/mail/listview',
    'io.ox/core/tk/list-control',
    'io.ox/mail/threadview',
    'io.ox/core/extensions',
    'io.ox/core/extPatterns/actions',
    'io.ox/core/extPatterns/links',
    'io.ox/core/api/account',
    'io.ox/core/notifications',
    'io.ox/core/toolbars-mobile',
    'io.ox/core/page-controller',
    'io.ox/core/capabilities',
    'io.ox/core/folder/tree',
    'io.ox/core/folder/view',
    'gettext!io.ox/mail',
    'settings!io.ox/mail',
    'io.ox/mail/actions',
    'io.ox/mail/mobile-navbar-extensions',
    'io.ox/mail/mobile-toolbar-actions',
    'io.ox/mail/toolbar',
    'io.ox/mail/import',
    'less!io.ox/mail/style',
    'io.ox/mail/folderview-extensions'
], function (util, api, commons, MailListView, ListViewControl, ThreadView, ext, actions, links, account, notifications, Bars, PageController, capabilities, TreeView, FolderView, gt, settings) {

    'use strict';

    // application object
    var app = ox.ui.createApp({
        name: 'io.ox/mail',
        id: 'io.ox/mail',
        title: 'Mail'
    });

    app.mediator({
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

            // create 4 pages with toolbars and navbars
            app.pages.addPage({
                name: 'folderTree',
                navbar: new Bars.NavbarView({
                    baton: baton,
                    extension: 'io.ox/mail/mobile/navbar'
                })
            });

            app.pages.addPage({
                name: 'listView',
                startPage: true,
                navbar: new Bars.NavbarView({
                    baton: baton,
                    extension: 'io.ox/mail/mobile/navbar'
                }),
                toolbar: new Bars.ToolbarView({
                    baton: baton,
                    page: 'listView',
                    extension: 'io.ox/mail/mobile/toolbar'
                }),
                secondaryToolbar: new Bars.ToolbarView({
                    baton: baton,
                    page: 'listView/multiselect',
                    extension: 'io.ox/mail/mobile/toolbar'
                })
            });

            app.pages.addPage({
                name: 'threadView',
                navbar: new Bars.NavbarView({
                    baton: baton,
                    extension: 'io.ox/mail/mobile/navbar'
                }),
                toolbar: new Bars.ToolbarView({
                    baton: baton,
                    page: 'threadView',
                    extension: 'io.ox/mail/mobile/toolbar'
                })
            });

            app.pages.addPage({
                name: 'detailView',
                navbar: new Bars.NavbarView({
                    baton: baton,
                    extension: 'io.ox/mail/mobile/navbar'
                }),
                toolbar: new Bars.ToolbarView({
                    baton: baton,
                    page: 'detailView',
                    extension: 'io.ox/mail/mobile/toolbar'
                })
            });

            // important
            // tell page controller about special navigation rules
            app.pages.setBackbuttonRules({
                'listView': 'folderTree',
                'threadView': 'listView'
            });
        },
        /*
         * Init all nav- and toolbar labels for mobile
         */
        'navbars-mobile': function (app) {

            if (!_.device('smartphone')) return;

            app.pages.getNavbar('listView')
                .setLeft(gt('Folders'))
                .setRight(
                    //#. Used as a button label to enter the "edit mode"
                    gt('Edit')
                );

            app.pages.getNavbar('folderTree')
                .setTitle(gt('Folders'))
                .setLeft(false)
                .setRight(gt('Edit'));

            app.pages.getNavbar('detailView')
                .setTitle('')
                .setLeft(
                    //#. Used as button label for a navigation action, like the browser back button
                    gt('Back')
                );

            app.pages.getNavbar('threadView')
                .setTitle(gt('Thread'))
                .setLeft(gt('Back'));

            // TODO restore last folder as starting point
            app.pages.showPage('listView');
        },

        'toolbars-mobile': function () {
            if (!_.device('smartphone')) return;

            // tell each page's back button what to do
            app.pages.getNavbar('listView').on('leftAction', function () {
                app.pages.goBack();
            });
            app.pages.getNavbar('threadView').on('leftAction', function () {
                app.pages.goBack();
            });
            app.pages.getNavbar('detailView').on('leftAction', function () {
                app.pages.goBack();
            });

            // checkbox toggle
            app.pages.getNavbar('listView').on('rightAction', function () {
                app.props.set('checkboxes', !app.props.get('checkboxes'));
            });

        },

        'pages-desktop': function (app) {
            if (_.device('smartphone')) return;

            // add page controller
            app.pages = new PageController(app);

            // create 2 pages
            // legacy compatibility
            app.getWindow().nodes.main.addClass('vsplit');

            app.pages.addPage({
                name: 'listView',
                container: app.getWindow().nodes.main,
                classes: 'leftside'
            });
            app.pages.addPage({
                name: 'detailView',
                container: app.getWindow().nodes.main,
                classes: 'rightside'
            });
        },

        /*
         * Folder view support
         */
        'folder-view': function (app) {

            if (_.device('smartphone')) return;

            // tree view
            var tree = new TreeView({ app: app, module: 'mail', contextmenu: true });

            // initialize folder view
            FolderView.initialize({ app: app, tree: tree });
            app.folderView.resize.enable();
        },

        /*
         * Convenience functin to toggle folder view
         */
        'folder-view-toggle': function (app) {
            if (_.device('smartphone')) return;
            app.getWindow().nodes.main.on('dblclick', '.list-view-control .toolbar', function () {
                app.folderView.toggle();
            });
        },

        /*
         * Default application properties
         */
        'props': function (app) {
            // introduce shared properties
            app.props = new Backbone.Model({
                'layout': _.device('smartphone') ? 'vertical' : app.settings.get('layout', 'vertical'),
                'checkboxes': _.device('smartphone') ? false : app.settings.get('showCheckboxes', false),
                'contactPictures': _.device('smartphone') ? false : app.settings.get('showContactPictures', false),
                'exactDates': app.settings.get('showExactDates', false),
                'mobileFolderSelectMode': false
            });
        },

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

        /*
         * Folder view support
         */
        'folder-view-mobile': function (app) {

            if (_.device('!smartphone')) return app;

            var nav = app.pages.getNavbar('folderTree'),
                page = app.pages.getPage('folderTree');

            nav.on('rightAction', function () {
                app.toggleFolders();
            });

            var tree = new TreeView({ app: app, module: 'mail', root: '1', contextmenu: true });

            // initialize folder view
            FolderView.initialize({ app: app, tree: tree });
            page.append(tree.render().$el);
        },

        /*
         * Split into left and right pane
         */
        'vsplit': function (app) {
            // replacing vsplit with new pageController
            // TODO: refactor app.left and app.right
            var left = app.pages.getPage('listView'),
                right = app.pages.getPage('detailView');

            app.left = left.addClass('border-right');
            app.right = right.addClass('mail-detail-pane').attr({
                'role': 'complementary',
                'aria-label': gt('Mail Details')
            });
        },

        /*
         * Setup list view
         */
        'list-view': function (app) {
            app.listView = new MailListView({ app: app, draggable: true, ignoreFocus: true, preserve: true, selectionOptions: { mode: 'special' } });
            app.listView.model.set({ folder: app.folder.get() });
            app.listView.model.set('thread', true);
            // for debugging
            window.list = app.listView;
        },

        'list-view-checkboxes': function (app) {
            // always hide checkboxes on small devices initially
            if (_.device('smartphone')) return;
            app.listView.toggleCheckboxes(app.props.get('checkboxes'));
        },

        'list-view-checkboxes-mobile': function (app) {
            // always hide checkboxes on small devices initially
            if (!_.device('smartphone')) return;
            app.props.set('checkboxes', false);
            app.listView.toggleCheckboxes(false);
        },

        /*
         * Scroll-o-mat
         * Scroll to top if new unseen messages arrive
         */
        'auto-scroll': function (app) {
            app.listView.on('add', function (model, index) {
                // only for top position
                if (index !== 0) return;
                // only for unseen messages
                if (!util.isUnseen(model.toJSON())) return;
                // only scroll to top if scroll position is below 50% of outer height
                var height = app.listView.$el.height() / 2;
                if (app.listView.$el.scrollTop() > height) return;
                // scroll to top
                app.listView.$el.scrollTop(0);
            });
        },

        /*
         * Get folder-based view options
         */
        'get-view-options': function (app) {
            app.getViewOptions = function (folder) {
                var options = app.settings.get(['viewOptions', folder]);
                return _.extend({ sort: 610, order: 'desc', thread: false }, options);
            };
        },

        /*
         * Set folderview property
         */
        'prop-folderview': function (app) {
            app.props.set('folderview', _.device('smartphone') ? false : app.settings.get('folderview/visible/' + _.display(), true));
        },

        /*
         * Respond to changed sort option
         */
        'change:sort': function (app) {
            app.props.on('change:sort', function (model, value) {
                var model = app.listView.model;
                // resolve from-to
                if (value === 'from-to') value = account.is('sent|drafts', model.get('folder')) ? 604 : 603;
                // set proper order first
                model.set('order', (/^(610|608)$/).test(value) ? 'desc' : 'asc', { silent: true });
                app.props.set('order', model.get('order'));
                // turn off conversation mode for any sort order but date (610)
                if (value !== 610) app.props.set('thread', false);
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

        /*
         * Respond to conversation mode changes
         */
        'change:thread': function (app) {
            app.props.on('change:thread', function (model, value) {
                if (app.listView.collection) {
                    app.listView.collection.expired = true;
                }
                if (value === true) {
                    app.props.set('sort', 610);
                    app.listView.model.set('thread', true);
                } else {
                    app.listView.model.set('thread', false);
                }
            });
        },

        /*
         * Store view options
         */
        'store-view-options': function (app) {
            app.props.on('change', _.debounce(function () {
                var folder = app.folder.get(), data = app.props.toJSON();
                app.settings
                    .set(['viewOptions', folder], { sort: data.sort, order: data.order, thread: data.thread })
                    .set('layout', data.layout)
                    .set('showContactPictures', data.contactPictures)
                    .set('showExactDates', data.exactDates);
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
         * Setup list view control
         */
        'list-view-control': function (app) {
            app.listControl = new ListViewControl({ id: 'io.ox/mail', listView: app.listView, app: app });
            app.left.append(
                app.listControl.render().$el
                    //#. items list (e.g. mails)
                    .attr('aria-label', gt('Item list'))
                    .find('.toolbar')
                    //#. toolbar with 'select all' and 'sort by'
                    .attr('aria-label', gt('Item list options'))
                    .end()
            );
            // make resizable
            app.listControl.resizable();
        },

        /*
         * Setup thread view
         */
        'thread-view': function (app) {
            if (_.device('smartphone')) return;
            app.threadView = new ThreadView.Desktop();
            app.right.append(app.threadView.render().$el);
        },

        'thread-view-mobile': function (app) {
            if (!_.device('smartphone')) return;

            // showing single mails will be done with the plain desktop threadview
            app.threadView = new ThreadView.Mobile();
            app.threadView.$el.on('showmail', function (e) {
                var cid = $(e.target).data().cid;
                app.showMail(cid);
                app.pages.changePage('detailView');
            });

            app.pages.getPage('threadView').append(app.threadView.render().$el);

        },

        /*
         * Selection message
         */
        'selection-message': function (app) {
            app.right.append(
                $('<div class="io-ox-center multi-selection-message"><div></div></div>')
            );
        },

        /*
         * Connect thread view's top nagivation with list view
         */
        'navigation': function (app) {
            // react on thread view navigation
            app.threadView.on({
                back: function () {
                    app.right.removeClass('preview-visible');
                    app.listView.focus();
                },
                previous: function () {
                    app.listView.previous();
                },
                next: function () {
                    app.listView.next();
                }
            });
        },

        /*
         * Selection changes in list view should be reflected in thread view navigation
         */
        'position': function (app) {

            function update() {
                var list = app.listView;
                app.threadView.updatePosition(list.getPosition() + 1)
                    .togglePrevious(list.hasPrevious())
                    .toggleNext(list.hasNext());
            }

            app.listView.on('selection:action', update);

            update();
        },

        /*
         * Respond to folder change
         */
        'folder:change': function (app) {

            // close mail detail view in list-mode on folder selection
            app.folderView.tree.on('selection:action', function () {
                if (app.props.get('layout') === 'list') {
                    app.threadView.trigger('back');
                }
            });

            app.on('folder:change', function (id) {

                if (app.props.get('mobileFolderSelectMode')) return;

                var options = app.getViewOptions(id),
                    fromTo = $(app.left[0]).find('.dropdown.grid-options .dropdown-menu [data-value="from-to"] span'),
                    showFrom = account.is('sent|drafts', id);

                app.props.set(options);
                app.listView.model.set('folder', id);
                app.folder.getData();

                if (showFrom) {
                    fromTo.text(gt('To'));
                } else {
                    fromTo.text(gt('From'));
                }
            });
        },

        /*
         * Change foldername on mobiles in navbar
         */
        'folder:change-mobile': function (app) {
            if (!_.device('smartphone')) return;
            app.on('folder:change', function () {
                if (app.props.get('mobileFolderSelectMode')) return;
                app.folder.getData().done(function (d) {
                    app.pages.getNavbar('listView').setTitle(d.title);
                });
            });
        },

        /*
         * Define basic function to show an email
         */
        'show-mail': function (app) {
            if (_.device('smartphone')) return;
            app.showMail = function (cid) {
                app.threadView.show(cid, app.props.get('thread'));
            };
        },

        /*
         * Define basic function to show an email
         */
        'show-mail-mobile': function (app) {
            if (!_.device('smartphone')) return;
            app.showMail = function (cid) {
                // render mail view and append it to detailview's page
                app.pages.getPage('detailView').empty().append(app.threadView.renderMail(cid));
            };
        },

        /*
         * Define basic function to show an thread overview on mobile
         */
        'mobile-show-thread-overview': function (app) {
            // clicking on a thread will show a custom overview
            // based on a custom threadview only showing mail headers
            app.showThreadOverview = function (cid) {
                app.threadView.show(cid, app.props.get('thread'));
            };
        },

        /*
         * Define basic function to reflect empty selection
         */
        'show-empty': function (app) {
            app.showEmpty = function () {
                app.threadView.empty();
                app.right.find('.multi-selection-message div').text(
                    gt('No message selected')
                );
            };
        },

        /*
         * Define function to reflect multiple selection
         */
        'show-multiple': function (app) {
            if (_.device('smartphone')) return;
            app.showMultiple = function (list) {
                app.threadView.empty();
                list = api.resolve(list, app.props.get('thread'));
                app.right.find('.multi-selection-message div').text(
                    gt('%1$d messages selected', list.length)
                );
            };
        },

        /*
         * Define function to reflect multiple selection
         */
        'show-multiple-mobile': function (app) {
            if (_.device('!smartphone')) return;

            app.showMultiple = function (list) {

                app.threadView.empty();
                if (list) {
                    list = api.resolve(list, app.props.get('thread'));
                    app.pages.getCurrentPage().navbar.setTitle(
                        //#. This is a short version of "x messages selected", will be used in mobile mail list view
                        gt('%1$d selected', list.length));
                    // re-render toolbar
                    app.pages.getCurrentPage().secondaryToolbar.render();
                } else {
                    app.folder.getData().done(function (d) {
                        app.pages.getCurrentPage().navbar.setTitle(d.title);
                    });
                }
            };
        },

        'selection-mobile': function (app) {

            if (!_.device('smartphone')) return;

            app.listView.on({
                'selection:empty': function () {
                    if (app.props.get('checkboxes')) app.showMultiple(false);
                },
                'selection:one': function (list) {
                    if (app.props.get('checkboxes')) app.showMultiple(list);
                },
                'selection:multiple': function (list) {
                    if (app.props.get('checkboxes')) app.showMultiple(list);
                },
                'selection:action': function (list) {

                    if (app.listView.selection.get().length === 1 && !app.props.get('checkboxes')) {
                        // check for thread
                        var cid = list[0].substr(7),
                            isThread = this.collection.get(cid).get('threadSize') > 1;

                        if (isThread) {
                            app.showThreadOverview(list[0]);
                            app.pages.changePage('threadView');
                        } else {
                            app.showMail(list[0]);
                            app.pages.changePage('detailView');
                        }
                    }
                }
            });
        },

        /*
         * Respond to single and multi selection in list view
         */
        'selection': function (app) {

            if (_.device('smartphone')) return;

            function resetRight(className) {
                return app.right
                    .removeClass('selection-empty selection-one selection-multiple preview-visible'.replace(className, ''))
                    .addClass(className);
            }

            var react = _.debounce(function (type, list) {

                if (app.props.get('layout') === 'list' && type === 'action') {
                    resetRight('selection-one preview-visible');
                    app.showMail(list[0]);
                    return;
                } else if (app.props.get('layout') === 'list' && type === 'one') {
                    //don't call show mail (an in visible detailview would be drawn which marks it as read)
                    resetRight('selection-one');
                    return;
                }

                switch (type) {
                case 'empty':
                    resetRight('selection-empty');
                    app.showEmpty();
                    break;
                case 'one':
                case 'action':
                    resetRight('selection-one');
                    app.showMail(list[0]);
                    break;
                case 'multiple':
                    resetRight('selection-multiple');
                    app.showMultiple(list);
                    break;
                }
            }, 100);

            app.listView.on({
                'selection:empty': function () {
                    react('empty');
                },
                'selection:one': function (list) {
                    var type = 'one';
                    if ( app.listView.selection.getBehavior() === 'alternative' ) {
                        type = 'multiple';
                    }
                    react(type, list);
                },
                'selection:multiple': function (list) {
                    react('multiple', list);
                },
                'selection:action': function (list) {
                    // make sure we are not in multi-selection
                    if (app.listView.selection.get().length === 1) react('action', list);
                }
            });
        },

        /*
         * Thread view navigation must respond to changing layout
         */
        'change:layout': function (app) {
            app.props.on('change:layout', function (model, value) {
                app.threadView.toggleNavigation(value === 'list');
            });

            app.threadView.toggleNavigation(app.props.get('layout') === 'list');
        },

        /*
         * Respond to changing layout
         */
        'apply-layout': function (app) {
            if (_.device('smartphone')) return;
            app.applyLayout = function () {

                var layout = app.props.get('layout'), nodes = app.getWindow().nodes, toolbar, className,
                    savedWidth = app.settings.get('listview/width/' + _.display()),
                    savedHeight = app.settings.get('listview/height/' + _.display());

                function applyWidth(x) {
                    var width = x === undefined ? '' :  x + 'px';
                    app.right.css('left', width);
                    app.left.css('width', width);
                }

                function applyHeight(x) {
                    var height = x === undefined ? '' :  x + 'px';
                    app.right.css('top', height);
                    app.left.css('height', height);
                }

                // remove inline styles from using the resize bar
                app.left.css({ width: '', height: '' });
                app.right.css({ left: '', top: '' });

                if (layout === 'vertical' || layout === 'compact') {
                    nodes.main.addClass('preview-right').removeClass('preview-bottom preview-none');
                    if (!_.device('touch')) applyWidth(savedWidth);
                } else if (layout === 'horizontal') {
                    nodes.main.addClass('preview-bottom').removeClass('preview-right preview-none');
                    if (!_.device('touch')) applyHeight(savedHeight);
                } else if (layout === 'list') {
                    nodes.main.addClass('preview-none').removeClass('preview-right preview-bottom');
                }

                // relocate toolbar
                toolbar = nodes.body.find('.classic-toolbar-container');
                className = 'classic-toolbar-visible';
                if (layout === 'compact') {
                    nodes.body.removeClass(className);
                    app.right.addClass(className).prepend(toolbar);
                } else {
                    app.right.removeClass(className);
                    nodes.body.addClass(className).prepend(toolbar);
                }

                if (layout !== 'list' && app.props.previousAttributes().layout === 'list' && !app.right.hasClass('preview-visible')) {
                    //listview did not create a detailview for the last mail, it was only selected, so detailview needs to be triggered manually(see bug 33456)
                    app.listView.selection.triggerChange();
                }
            };

            app.props.on('change:layout', function () {
                app.applyLayout();
                app.listView.redraw();
            });

            app.getWindow().on('show:initial', function () {
                app.applyLayout();
            });
        },

        /*
         * Respond to global refresh
         */
        'refresh': function (app) {
            api.on('refresh.all', function reload() {
                app.listView.reload();
            });
        },

        /*
         * auto select first seen email (only on initial startup)
         */
        'auto-select': function (app) {

            // no auto-selection needed on smartphones
            if (_.device('smartphone')) return;

            app.listView.on('first-reset', function () {
                // defer to have a visible window
                _.defer(function () {
                    app.listView.collection.find(function (model, index) {
                        if (!util.isUnseen(model.get('flags'))) {
                            app.listView.selection.select(index);
                            return true;
                        }
                    });
                });
            });
        },

        'init-navbarlabel-mobile': function (app) {
            if (!_.device('smartphone')) return;

            // prepare first start
            app.listView.on('first-reset', function () {
                app.folder.getData().done(function (d) {
                    app.pages.getNavbar('listView').setTitle(d.title);
                });
            });
        },

        /*
         * Prefetch first 10 relevant (unseen) emails
         */
        'prefetch': function (app) {

            var count = settings.get('prefetch/count', 5);
            if (!_.isNumber(count) || count <= 0) return;

            app.prefetch = function (collection) {
                // get first 10 undeleted emails
                var http = require('io.ox/core/http');
                http.pause();
                collection.chain()
                    .filter(function (obj) {
                        return !util.isDeleted(obj);
                    })
                    .slice(0, count)
                    .each(function (model) {
                        var thread = model.get('thread') || [model.toJSON()], i, obj;
                        for (i = thread.length - 1; obj = thread[i]; i--) {
                            // get data
                            if (_.isString(obj)) obj = _.cid(obj);
                            // most recent or first unseen? (in line with threadview's autoSelectMail)
                            if ((i === 0 || util.isUnseen(obj)) && !util.isDeleted(obj)) {
                                api.get({ unseen: true, id: obj.id, folder: obj.folder_id });
                                break;
                            }
                        }
                    });
                http.resume();
            };

            app.listView.on('first-reset', app.prefetch);
        },

        /*
         * Prefetch mail-compose code
         */
        'prefetch-compose': function () {
            if (_.device('smartphone')) return;
            setTimeout(function () {
                require(['io.ox/mail/compose/bundle']);
            }, 3000);
        },

        /*
         * Connect collection loader with list view
         */
        'connect-loader': function (app) {
            app.listView.connect(api.collectionLoader);
        },

        /*
         * Select next item in list view if current item gets deleted
         */
        'before-delete': function (app) {

            // fixes scrolling issue on mobiles during delete
            if (_.device('smartphone')) return;

            function isSingleThreadMessage(ids, selection) {
                if (ids.length !== 1) return false;
                if (selection.length !== 1) return false;
                var a = _.cid(ids[0]), b = String(selection[0]).replace(/^thread\./, '');
                return a !== b;
            }

            api.on('beforedelete', function (e, ids) {
                if (isSingleThreadMessage(ids, app.listView.selection.get())) return;
                app.listView.selection.dodge();
            });
        },

        'before-delete-mobile': function (app) {
            if (!_.device('smartphone')) return;
            // if a mail will be deleted in detail view, go back one page
            api.on('beforedelete', function () {
                if (app.pages.getCurrentPage().name === 'detailView') {
                    app.pages.goBack();
                }
                app.listView.selection.selectNone();
            });
        },

        /*
         * Add support for drag & drop
         */
        'drag-drop': function () {
            app.getWindow().nodes.outer.on('selection:drop', function (e, baton) {
                // remember if this list is based on a single thread
                baton.isThread = baton.data.length === 1 && /^thread\./.test(baton.data[0]);
                // resolve thread
                baton.data = api.resolve(baton.data, app.props.get('thread'));
                // call action
                actions.invoke('io.ox/mail/actions/move', null, baton);
            });
        },

        /*
         * Handle archive event based on keyboard shortcut
         */
        'selection-archive': function () {
            app.listView.on('selection:archive', function (list) {
                var baton = ext.Baton({ data: list });
                // remember if this list is based on a single thread
                baton.isThread = baton.data.length === 1 && /^thread\./.test(baton.data[0]);
                // resolve thread
                baton.data = api.resolve(baton.data, app.props.get('thread'));
                // call action
                actions.invoke('io.ox/mail/actions/archive', null, baton);
            });
        },

        /*
         * Handle delete event based on keyboard shortcut or swipe gesture
         */
        'selection-delete': function () {
            app.listView.on('selection:delete', function (list) {
                var baton = ext.Baton({ data: list });
                // remember if this list is based on a single thread
                baton.isThread = baton.data.length === 1 && /^thread\./.test(baton.data[0]);
                // resolve thread
                baton.data = api.resolve(baton.data, app.props.get('thread'));
                // call action
                actions.invoke('io.ox/mail/actions/delete', null, baton);
            });
        },

        /*
         * Add support for selection:
         */
        'selection-doubleclick': function (app) {
            // detail app does not make sense on small devices
            // they already see emails in full screen
            if (_.device('smartphone')) return;
            app.listView.on('selection:doubleclick', function (list) {
                ox.launch('io.ox/mail/detail/main', { cid: list[0] });
            });
        },

        /*
         * Add support for selection:
         */
        'selection-mobile-swipe': function (app) {
            if (_.device('!smartphone')) return;

            ext.point('io.ox/mail/mobile/swipeButtonMore').extend(new links.Dropdown({
                id: 'actions',
                index: 1,
                classes: '',
                label: '',
                ariaLabel: '',
                icon: '',
                noCaret: true,
                ref: 'io.ox/mail/links/inline'
            }));

            app.listView.on('selection:more', function (list, node) {
                var baton = ext.Baton({ data: list });
                // remember if this list is based on a single thread
                baton.isThread = baton.data.length === 1 && /^thread\./.test(baton.data[0]);
                // resolve thread
                baton.data = api.resolve(baton.data, app.props.get('thread'));
                // call action
                // we open a dropdown here with options.
                ext.point('io.ox/mail/mobile/swipeButtonMore').invoke('draw', node, baton);
                node.find('a').click();
            });
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
         * Respond to change:checkboxes
         */
        'change:checkboxes': function (app) {
            if (_.device('smartphone')) return;
            if ( app.listView.selection.getBehavior() === 'alternative' ) {
                app.listView.toggleCheckboxes(true);
            } else {
                app.props.on('change:checkboxes', function (model, value) {
                    app.listView.toggleCheckboxes(value);
                });
            }
        },

        /*
         * Respond to change:checkboxes on mobiles
         * Change "edit" to "cancel" on button
         */
        'change:checkboxes-mobile': function (app) {
            if (_.device('!smartphone')) return;

            // intial hide
            app.listControl.$el.toggleClass('toolbar-top-visible', false);

            app.props.on('change:checkboxes', function (model, value) {
                app.listView.toggleCheckboxes(value);
                app.listControl.$el.toggleClass('toolbar-top-visible', value);
                if (value) {
                    app.pages.getNavbar('listView')
                        .setRight(gt('Cancel'))
                        .hide('.left');
                } else {
                    app.pages.getNavbar('listView')
                        .setRight(gt('Edit'))
                        .show('.left');
                    // reset navbar title on cancel
                    app.folder.getData().done(function (d) {
                        app.pages.getCurrentPage().navbar.setTitle(d.title);
                    });

                    // reset selection
                    app.listView.selection.selectNone();
                }
            });
        },

        /*
         * Respond to change:contactPictures
         */
        'change:contactPictures': function (app) {
            app.props.on('change:contactPictures', function () {
                app.listView.redraw();
            });
        },

        /*
         * Respond to change:exactDates
         */
        'change:exactDates': function (app) {
            app.props.on('change:exactDates', function () {
                app.listView.redraw();
            });
        },

        'fix-mobile-lazyload': function (app) {
            if (_.device('!smartphone')) return;
            // force lazyload to load, otherwise the whole pane will stay empty...
            app.pages.getPage('detailView').on('pageshow', function () {
                $(this).find('li.lazy').trigger('scroll');
            });
        },

        'inplace-find': function (app) {

            if (_.device('smartphone') || !capabilities.has('search')) return;

            app.searchable();

            var find = app.get('find');

            find.on('change:state', function (e, state) {

                if (state !== 'launched') return;

                require(['io.ox/core/api/collection-loader'], function (CollectionLoader) {
                    var manager = find.view.model.manager,
                        searchcid = _.bind(manager.getResponseCid, manager),
                        mode = 'default';
                    // define collection loader for search results
                    var collectionLoader = new CollectionLoader({
                            module: 'mail',
                            mode: 'search',
                            fetch: function (params) {
                                var self = this,
                                    limit = params.limit.split(','),
                                    start = parseInt(limit[0]),
                                    size = parseInt(limit[1]) - start;

                                find.model.set({
                                    'start': start,
                                    'size': size,
                                    'extra': 1
                                }, { silent: true });

                                var params = { sort: app.props.get('sort'), order: app.props.get('order') };
                                return find.getSearchResult(params, true).then(function (response) {
                                    response = response || {};
                                    var list = response.results || [],
                                        request = response.request || {};
                                    // add 'more results' info to collection (compare request limits and result)
                                    self.collection.search = {
                                        next: list.length !== 0 && list.length === request.data.size
                                    };
                                    return list;
                                });
                            },
                            cid: searchcid,
                            each: function (obj) {
                                api.processThreadMessage(obj);
                            }
                        });
                    var register = function () {
                            var view = find.view.model,
                                // remember original setCollection
                                setCollection = app.listView.setCollection;
                            // hide sort options
                            app.listControl.$el.find('.grid-options:first').hide();
                            app.listView.connect(collectionLoader);
                            mode = 'search';
                            // wrap setCollection
                            app.listView.setCollection = function (collection) {
                                view.stopListening();
                                view.listenTo(collection, 'add reset remove', find.trigger.bind(view, 'find:query:result', collection));
                                return setCollection.apply(this, arguments);
                            };
                        };

                    // events
                    find.on({
                        'find:idle': function () {
                            if (mode === 'search') {
                                // show sort options
                                app.listControl.$el.find('.grid-options:first').show();
                                // reset collection loader
                                app.listView.connect(api.collectionLoader);
                                app.listView.load();
                            }
                            mode = 'default';
                        },
                        'find:query': _.debounce(function () {
                            // register/connect once
                            if (app.listView.loader.mode !== 'search') register();
                            // load
                            app.listView.load();
                        }, 10)
                    });

                });
            });
        }

    });

    // launcher
    app.setLauncher(function () {

        // get window
        var win = ox.ui.createWindow({
            name: 'io.ox/mail',
            title: 'Inbox',
            chromeless: true,
            find: capabilities.has('search')
        });

        if (_.url.hash().mailto) ox.registry.call('mail-compose', 'compose');

        app.setWindow(win);
        app.settings = settings;
        window.mailapp = app;

        commons.addFolderSupport(app, null, 'mail', app.options.folder)
            .always(function always() {
                app.mediate();
                win.show();
            })
            .fail(function fail(result) {
                var errorMsg = (result && result.error) ? result.error + ' ' : '';
                errorMsg += gt('Application may not work as expected until this problem is solved.');
                notifications.yell('error', errorMsg);
            });
    });

    return {
        getApp: app.getInstance
    };
});
