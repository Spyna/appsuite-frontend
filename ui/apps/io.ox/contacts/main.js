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
 *
 */

define('io.ox/contacts/main',
    ['io.ox/contacts/util',
     'io.ox/contacts/api',
     'io.ox/core/tk/vgrid',
     'io.ox/help/hints',
     'io.ox/contacts/view-detail',
     'io.ox/core/tk/dropdown-options',
     'io.ox/core/extensions',
     'io.ox/core/extPatterns/actions',
     'io.ox/core/commons',
     'io.ox/core/capabilities',
     'io.ox/contacts/toolbar',
     'gettext!io.ox/contacts',
     'settings!io.ox/contacts',
     'io.ox/core/folder/api',
     'io.ox/core/toolbars-mobile',
     'io.ox/core/page-controller',
     'io.ox/core/commons-folderview',
     'io.ox/contacts/mobile-navbar-extensions',
     'io.ox/contacts/mobile-toolbar-actions',
     'less!io.ox/contacts/style'
    ], function (util, api, VGrid, hints, viewDetail, dropdownOptions, ext, actions, commons, capabilities, toolbar, gt, settings, folderAPI, Bars, PageController, FolderView) {

    'use strict';

    // application object
    var app = ox.ui.createApp({
        name: 'io.ox/contacts',
        title: 'Address Book'
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
            if (_.device('!small')) return;
            var c = app.getWindow().nodes.main;
            var navbar = $('<div class="mobile-navbar">'),
                toolbar = $('<div class="mobile-toolbar">');
            app.navbar = navbar;
            app.toolbar = toolbar;

            app.pages = new PageController(app);

            app.getWindow().nodes.body.addClass('classic-toolbar-visible').append(navbar, toolbar);

            // create 3 pages with toolbars and navbars
            app.pages.addPage({
                name: 'folderTree',
                container: c,
                navbar: new Bars.NavbarView({
                    app: app,
                    extension: 'io.ox/contacts/mobile/navbar'
                })
            });

            app.pages.addPage({
                name: 'listView',
                container: c,
                startPage: true,
                navbar: new Bars.NavbarView({
                    app: app,
                    extension: 'io.ox/contacts/mobile/navbar'
                }),
                toolbar: new Bars.ToolbarView({
                    app: app,
                    page: 'listView',
                    extension: 'io.ox/contacts/mobile/toolbar'
                }),
                secondaryToolbar: new Bars.ToolbarView({
                    app: app,
                    page: 'detailView', // nasty, but saves duplicate code. We reuse the toolbar from detailView for multiselect
                    extension: 'io.ox/contacts/mobile/toolbar'
                })
            });

            app.pages.addPage({
                name: 'detailView',
                container: c,
                navbar: new Bars.NavbarView({
                    app: app,
                    extension: 'io.ox/contacts/mobile/navbar'
                }),
                toolbar: new Bars.ToolbarView({
                    app: app,
                    page: 'detailView',
                    extension: 'io.ox/contacts/mobile/toolbar'

                })
            });

            // important
            // tell page controller about special navigation rules
            app.pages.setBackbuttonRules({
                'listView': 'folderTree'
            });
        },

        'pages-desktop': function (app) {
            if (_.device('small')) return;

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

        'folder-view-mobile': function (app) {

            if (_.device('!small')) return;

            var view = new FolderView(app, {
                type: 'contacts',
                container: app.pages.getPage('folderTree')
            });
            view.handleFolderChange();
            view.load();

        },

        /*
         * Split into left and right pane
         */
        'vsplit': function (app) {
            // replacing vsplit with new pageController
            // TODO: refactor app.left and app.right
            var left = app.pages.getPage('listView'),
                right = app.pages.getPage('detailView');

            app.left = left;
            app.right = right.addClass('default-content-padding f6-target').attr('tabindex', 1).scrollable();
        },

        'vgrid': function (app) {
            var grid = app.grid;

            app.left.append(
                // grid container
                app.gridContainer
            );

            // add template
            grid.addTemplate({
                build: function () {
                    var name, description, private_flag;
                    this.addClass('contact').append(
                        private_flag = $('<i class="fa fa-lock private_flag">').hide(),
                        name = $('<div class="fullname">'),
                        description = $('<div class="bright-text">')
                    );
                    return { name: name, private_flag: private_flag, description: description };
                },
                set: function (data, fields) {
                    var fullname, name, description;
                    if (data.mark_as_distributionlist === true) {
                        name = data.display_name || '';
                        fields.name.text(_.noI18n(name));
                        fields.private_flag.get(0).style.display =
                            data.private_flag ? '' : 'none';
                        fields.description.text(gt('Distribution list'));
                    } else {
                        fullname = $.trim(util.getFullName(data));
                        if (fullname) {
                            name = fullname;
                            fullname = util.getFullName(data, true); // use html output
                            fields.name.html(fullname);
                        } else {
                            name = $.trim(util.getFullName(data) || data.yomiLastName || data.yomiFirstName || data.display_name || util.getMail(data));
                            fields.name.text(_.noI18n(name));
                        }
                        description = $.trim(util.getJob(data));
                        fields.private_flag.get(0).style.display =
                            data.private_flag ? '' : 'none';
                        fields.description.text(_.noI18n(description));
                        if (name === '' && description === '') {
                            // nothing is written down, add some text, so user isn’t confused
                            fields.name.addClass('bright-text').text(gt('Empty name and description found.'));
                            fields.description.text(gt('Edit to set a name.'));
                        } else {
                            fields.name.removeClass('bright-text');
                        }
                    }
                    this.attr({ 'aria-label': _.noI18n(name) });
                }
            });

            // The label function can be overwritten by an extension.
            var getLabel = function (data) {
                return $.trim(data.sort_name || '').slice(0, 1).toUpperCase();
            };
            ext.point('io.ox/contacts/getLabel').each(function (extension) {
                if (extension.getLabel) getLabel = extension.getLabel;
            });

            // add label template
            grid.addLabelTemplate({
                build: function () {
                },
                set: function (data) {
                    this.text(_.noI18n(getLabel(data)));
                }
            });

            // requires new label?
            grid.requiresLabel = function (i, data, current) {
                if (!data) { return false; }
                var prefix = getLabel(data);
                prefix = prefix.replace(/[ÄÀÁÂÃÄÅ]/g, 'A')
                    .replace(/[ÖÒÓÔÕÖ]/g, 'O')
                    .replace(/[ÜÙÚÛÜ]/g, 'U');
                return (i === 0 || prefix !== current) ? prefix : false;
            };

            commons.wireGridAndAPI(grid, api);
        },

        'thumbindex': function (app) {

            var fullIndex = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

            /**
             * Thumb index
             */
            function Thumb(opt) {
                if (this instanceof Thumb) {
                    if (_.isString(opt)) {
                        this.text = opt;
                    } else {
                        _.extend(this, opt || {});
                    }
                } else {
                    return new Thumb(opt);
                }
            }

            Thumb.prototype.draw = function (baton) {
                var node = $('<div class="thumb-index">')
                    .text(this.label || _.noI18n(this.text));
                if (this.enabled(baton)) {
                    node.data('text', this.text);
                } else {
                    node.addClass('thumb-index-disabled');
                }
                return node;
            };

            Thumb.prototype.enabled = function (baton) {
                return this.text in baton.labels;
            };

            function thumbClick() {
                var text = $(this).data('text');
                if (text) app.grid.scrollToLabelText(text, /* silent? */ _.device('small'));
            }

            function thumbMove(e) {
                e.preventDefault();
                if (e.originalEvent && e.originalEvent.targetTouches) {
                    var touches = e.originalEvent.targetTouches[0],
                        x = touches.clientX,
                        y = touches.clientY,
                        element = document.elementFromPoint(x, y),
                        text = $(element).data('text');
                    if (text) app.grid.scrollToLabelText(text, /* silent? */ _.device('small'));
                }
            }

            app.Thumb = Thumb;

            app.left.append( // thumb index
                app.thumbs = $('<div class="atb contact-grid-index">')
                    .on('click', '.thumb-index', thumbClick)
                    .on('touchmove', thumbMove)
            );
            // draw thumb index
            var baton = new ext.Baton({ app: app, data: [], Thumb: Thumb });

            ext.point('io.ox/contacts/thumbIndex').extend({
                index: 100,
                id: 'draw',
                draw: function () {

                    // get labels
                    baton.labels = app.grid.getLabels().textIndex || {};

                    // update thumb listf
                    ext.point('io.ox/contacts/thumbIndex').invoke('getIndex', app.thumbs, baton);

                    app.thumbs.empty();

                    _(baton.data).each(function (thumb) {
                        app.thumbs.append(thumb.draw(baton));
                    });
                },
                getIndex: function (baton) {
                    baton.data = _.map(fullIndex, baton.Thumb);
                }
            });
        },

        /*
         * Init all nav- and toolbar labels for mobile
         */
        'navbars-mobile': function (app) {

            if (!_.device('small')) return;

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
                .setTitle('') // no title
                .setLeft(
                    //#. Used as button label for a navigation action, like the browser back button
                    gt('Back')
                );

            // TODO restore last folder as starting point
            app.pages.showPage('listView');
        },

        'toolbars-mobile': function () {
            if (!_.device('small')) return;

            // tell each page's back button what to do
            app.pages.getNavbar('listView').on('leftAction', function () {
                app.pages.goBack();
            });

            app.pages.getNavbar('detailView').on('leftAction', function () {
                app.pages.goBack();
            });

            // checkbox toggle
            app.pages.getNavbar('listView').on('rightAction', function () {
                if (app.props.get('checkboxes') === true) {
                    // leave multiselect? -> clear selection
                    app.grid.selection.clear();
                }
                app.props.set('checkboxes', !app.props.get('checkboxes'));
            });

            app.pages.getNavbar('folderTree').on('rightAction', function () {
                app.toggleFolders();
            });

        },

        'swipe-mobile': function () {
            // helper to remove button from grid

            /*var removeButton = function () {
                if (showSwipeButton) {
                    var g = grid.getContainer();
                    $('.swipeDelete', g).remove();
                    showSwipeButton = false;
                }
            };

            app.grid.selection.on('change', removeButton);

            app.grid.selection.on('change', function () {
                if (showSwipeButton) {
                    removeButton();
                }
            });

            ext.point('io.ox/contacts/swipeDelete').extend({
                index: 666,
                id: 'deleteButton',
                draw: function (baton) {
                    // remove old buttons first
                    if (showSwipeButton) {
                        removeButton();
                    }
                    this.append(
                        $('<div class="mail cell-button swipeDelete fadein fast">')
                            .text(gt('Delete'))
                            .on('mousedown', function (e) {
                                // we have to use mousedown as the selection listens to this, too
                                // otherwise we are to late to get the event
                                e.stopImmediatePropagation();
                            }).on('tap', function (e) {
                                e.preventDefault();
                                removeButton();
                                showSwipeButton = false;
                                actions.invoke('io.ox/contacts/actions/delete', null, baton);
                            })
                    );
                    showSwipeButton = true;
                }
            });

            // swipe handler
            var swipeRightHandler = function (e, id, cell) {
                var obj = _.cid(id);

                if (hasDeletePermission === undefined) {
                    folderAPI.get({folder: obj.folder_id, cache: true}).done(function (data) {
                        if (folderAPI.can('delete', data)) {
                            hasDeletePermission = true;
                            api.getList([obj]).done(function (list) {
                                ext.point('io.ox/contacts/swipeDelete').invoke('draw', cell, list[0]);
                            });
                        }
                    });
                } else if (hasDeletePermission) {
                    api.getList([obj]).done(function (list) {
                        ext.point('io.ox/contacts/swipeDelete').invoke('draw', cell, list[0]);
                    });
                }
            };
            */

        },

        'show-contact': function (app) {
            if (_.device('small')) return;
            // LFO callback
            var showContact, drawContact, drawFail, grid = app.grid;

            showContact = function (obj) {
                // get contact
                app.right.busy(true);
                if (obj && obj.id !== undefined) {
                    app.currentContact = api.reduce(obj);
                    api.get(app.currentContact)
                        .done(_.lfo(drawContact))
                        .fail(_.lfo(drawFail, obj));
                } else {
                    app.right.idle().empty();
                }
            };

            showContact.cancel = function () {
                _.lfo(drawContact);
                _.lfo(drawFail);
            };

            drawContact = function (data) {
                var baton = ext.Baton({ data: data, app: app });
                baton.disable('io.ox/contacts/detail', 'inline-actions');
                if (grid.getMode() === 'all') baton.disable('io.ox/contacts/detail', 'breadcrumb');
                app.right.idle().empty().append(viewDetail.draw(baton));
            };

            drawFail = function (obj) {
                app.right.idle().empty().append(
                    $.fail(gt('Couldn\'t load contact data.'), function () {
                        showContact(obj);
                    })
                );
            };

            app.showContact = showContact;
            commons.wireGridAndSelectionChange(grid, 'io.ox/contacts', showContact, app.right, api, true);
        },

        'show-contact-mobile': function (app) {
            if (_.device('!small')) return;
            // LFO callback
            var showContact, drawContact, drawFail, grid = app.grid;

            showContact = function (obj) {
                // get contact
                //app.pages.getPage('detailView').busy();
                if (obj && obj.id !== undefined) {
                    app.right.empty().busy();
                    app.currentContact = api.reduce(obj);
                    api.get(app.currentContact)
                        .done(_.lfo(drawContact))
                        .fail(_.lfo(drawFail, obj));
                } else {
                    app.right.idle();
                }
            };

            showContact.cancel = function () {
                _.lfo(drawContact);
                _.lfo(drawFail);
            };

            drawContact = function (data) {
                var baton = ext.Baton({ data: data, app: app });
                baton.disable('io.ox/contacts/detail', 'inline-actions');

                app.right.idle().empty().append(viewDetail.draw(baton));
            };

            drawFail = function (obj) {
                app.right.idle().empty().append(
                    $.fail(gt('Couldn\'t load contact data.'), function () {
                        showContact(obj);
                    })
                );
            };

            app.showContact = showContact;
            commons.wireGridAndSelectionChange(grid, 'io.ox/contacts', showContact, app.right, api, true);
        },
        /*
         * Always change pages on tap, don't wait for data to load
         */
        'select:contact-mobile': function (app) {
            if (_.device('!small')) return;
            app.grid.getContainer().on('click', '.vgrid-cell.selectable', function () {
                if (app.props.get('checkboxes') === true) return;
                // hijack selection event hub to trigger page-change event
                app.grid.selection.trigger('pagechange:detailView');
                app.pages.changePage('detailView');
            });
        },

        'delete:contact-mobile': function (app) {
            if (_.device('!small')) return;
            api.on('delete', function () {
                if (app.pages.getCurrentPage().name === 'detailView') {
                    app.pages.goBack();
                }
            });
        },

        'update:image': function () {
            api.on('update:image', function (evt, updated) {
                if (updated.folder === app.currentContact.folder_id && updated.id === app.currentContact.id) {
                    app.showContact(app.currentContact);
                }
            });
        },
        /*
         * Folder view support
         */
        'folder-view': function (app) {
            // folder tree
            commons.addFolderView(app, { type: 'contacts', view: 'FolderList' });
            app.getWindow().nodes.sidepanel.addClass('border-right');
        },

        /*
         * Default application properties
         */
        'props': function (app) {
            // introduce shared properties
            app.props = new Backbone.Model({
                'checkboxes': _.device('small') ? false : app.settings.get('showCheckboxes', true),
                'mobileFolderSelectMode': false
            });
        },

        'vgrid-checkboxes': function (app) {
            // always hide checkboxes on small devices initially
            if (_.device('small')) return;
            var grid = app.getGrid();
            grid.setEditable(app.props.get('checkboxes'));
        },

        'vgrid-checkboxes-mobile': function (app) {
            // always hide checkboxes on small devices initially
            if (_.device('!small')) return;
            var grid = app.getGrid();
            app.props.on('change:checkboxes', function () {
                grid.setEditable(app.props.get('checkboxes'));
            });

        },

        /*
         * Set folderview property
         */
        'prop-folderview': function (app) {
            app.props.set('folderview', _.device('small') ? false : app.settings.get('folderview/visible/' + _.display(), true));
        },

        /*
         * Store view options
         */
        'store-view-options': function (app) {
            if (_.device('small')) return;
            app.props.on('change', _.debounce(function () {
                var data = app.props.toJSON();
                app.settings
                    .set('showCheckboxes', data.checkboxes)
                    .save();
            }, 500));
        },

        /*
         * Respond to folder view changes
         */
        'change:folderview': function (app) {
            if (_.device('small')) return;
            app.props.on('change:folderview', function (model, value) {
                app.toggleFolderView(value);
            });
            app.on('folderview:close', function () {
                app.props.set('folderview', false);
            });
            app.on('folderview:open', function () {
                app.props.set('folderview', true);
            });
        },

        'change:folder': function (app) {
            if (_.device('small')) return;
            // folder change
            app.grid.on('change:ids', function () {
                ext.point('io.ox/contacts/thumbIndex').invoke('draw', app.thumbs, app.baton);
            });
        },

        'folder-view-mobile-listener': function () {
            if (_.device('!small')) return;
            // always change folder on click
            // No way to use tap here since folderselection really messes up the event chain
            app.pages.getPage('folderTree').on('click', '.folder.selectable', function (e) {
                if (app.props.get('mobileFolderSelectMode') === true) {
                    $(e.currentTarget).trigger('contextmenu'); // open menu
                    return; // do not change page in edit mode
                }
                app.pages.changePage('listView');
            });
        },

        'change:folder-mobile': function () {
            if (_.device('!small')) return;
            app.grid.on('change:ids', function () {
                ext.point('io.ox/contacts/thumbIndex').invoke('draw', app.thumbs, app.baton);
                app.folder.getData().done(function (d) {
                    app.pages.getNavbar('listView').setTitle(d.title);
                });

            });
        },

        'toggle-folder-editmode': function (app) {
            if (_.device('!small')) return;
            var toggleFolders =  function () {
                var state = app.props.get('mobileFolderSelectMode'),
                    page = app.pages.getPage('folderTree');

                if (state) {
                    app.props.set('mobileFolderSelectMode', false);
                    app.pages.getNavbar('folderTree').setRight(gt('Edit'));
                    page.removeClass('mobile-edit-mode');

                } else {
                    app.props.set('mobileFolderSelectMode', true);
                    app.pages.getNavbar('folderTree').setRight(gt('Cancel'));
                    page.addClass('mobile-edit-mode');

                }
            };
            app.toggleFolders = toggleFolders;
        },

        /*
         * Respond to change:checkboxes
         */
        'change:checkboxes': function (app) {
            if (_.device('small')) return;
            app.props.on('change:checkboxes', function (model, value) {
                var grid = app.getGrid();
                grid.setEditable(value);
            });
        },

        /*
         * Folerview toolbar
         */
        'folderview-toolbar': function (app) {
            if (_.device('small')) return;
            commons.mediateFolderView(app);
        },

        'api-events': function (app) {
            api.on('create update delete refresh.all', function () {
                folderAPI.reload(app.folder.get());
            });
        },

        'drag-and-drop': function (app) {
            // drag & drop
            app.getWindow().nodes.outer.on('selection:drop', function (e, baton) {
                actions.invoke('io.ox/contacts/actions/move', null, baton);
            });
        },

        'inplace-search': function (app) {
            if (_.device('small') || !(capabilities.has('search'))) return;

            require(['io.ox/search/main'], function (facetedsearch) {
                //register
                commons.wireGridAndSearch(app.grid, app.getWindow(), facetedsearch.apiproxy);
            });
        }
    });

    // launcher
    app.setLauncher(function (options) {

        // get window
        var win = ox.ui.createWindow({
            name: 'io.ox/contacts',
            chromeless: true,
            facetedsearch: true
        });

        app.setWindow(win);
        app.settings = settings;

        app.gridContainer = $('<div class="abs border-left border-right contact-grid-container">');

        app.grid = new VGrid(app.gridContainer, {
            settings: settings,
            hideTopbar: _.device('small'),
            hideToolbar: _.device('small')
            //swipeRightHandler: swipeRightHandler,
        });

        commons.wireGridAndWindow(app.grid, win);
        commons.wireFirstRefresh(app, api);
        commons.wireGridAndRefresh(app.grid, api, win);
        if (_.device('!small')) commons.addGridToolbarFolder(app, app.grid, 'CONTACTS');

        app.getGrid = function () {
            return app.grid;
        };

        // go!
        commons.addFolderSupport(app, app.grid, 'contacts', options.folder)
            .always(function () {
                app.mediate();
                win.show();
            });
    });

    return {
        getApp: app.getInstance
    };
});
