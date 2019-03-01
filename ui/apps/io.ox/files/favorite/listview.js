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
 * @author York Richter <york.richter@open-xchange.com>
 */

define('io.ox/files/favorite/listview', [
    'io.ox/core/extensions',
    'io.ox/core/folder/breadcrumb',
    'io.ox/core/tk/list',
    'io.ox/core/tk/list-contextmenu',
    'io.ox/files/common-extensions',
    'settings!io.ox/core',
    'io.ox/core/folder/api',
    'io.ox/files/api',
    'io.ox/backbone/views/actions/util',
    'less!io.ox/files/favorite/style',
    'io.ox/files/favorite/view-options'
], function (ext, BreadcrumbView, ListView, ContextMenu, extensions, settings, FolderAPI, FilesAPI, actionsUtil) {

    'use strict';

    var LISTVIEW = 'io.ox/files/favorite/myfavorites/listview', ITEM = LISTVIEW + '/item';

    var MyFavoriteListView = ListView.extend(ContextMenu).extend({

        ref: LISTVIEW,

        initialize: function (options) {

            options.collection = this.collection = FolderAPI.pool.getCollection('virtual/favorites/infostore');

            // use same context menu as main list view
            this.contextMenuRef = 'io.ox/files/listview/contextmenu';

            this.folderID = settings.get('favorites/infostore', []);

            ListView.prototype.initialize.call(this, options);

            this.$el.addClass('myfavorites-list column-layout');

            this.model.set({ sort: options.app.props.get('sort'), order: options.app.props.get('order') });
            this.toggleCheckboxes(false);

            this.load();
            this.sortBy();

            this.listenTo(this.model, 'change:sort change:order', this.sortBy);
            this.listenTo(options.collection, 'update:collection', this.sortBy);

            // DoubleClick handler
            this.$el.on(
                _.device('touch') ? 'tap' : 'dblclick',
                '.list-item .list-item-content',
                function (element) {
                    var cid = $(element.currentTarget).parent().attr('data-cid');
                    if ($(element.currentTarget).parent().attr('data-is-file') !== 'false') {
                        var app = options.app,
                            selectedModel = _(FilesAPI.resolve([cid], false)).invoke('toJSON'),
                            baton = ext.Baton({ data: selectedModel[0], all: app.myFavoriteListView.collection, app: app, options: { eventname: 'selection-doubleclick' } });
                        // Tested: false
                        actionsUtil.invoke('io.ox/files/actions/default', baton);
                    } else {
                        options.app.folder.set(cid.replace(/^folder./, ''), true);
                    }
                }
            );
        },
        load: function () {
            var self = this;
            var files = [],
                folders = [];
            var cache = !self.collection.expired && self.collection.fetched;
            _.each(self.collection.models, function (model) {
                if (model.folder_name) {
                    folders.push(model.id);
                } else {
                    files.push(model);
                }
            });
            require(['io.ox/files/api']).then(function (FilesAPI) {
                return FilesAPI.getList(files, { errors: true, cache: cache, onlyAttributes: true }).then(function (favoriteFiles) {
                    return FolderAPI.multiple(folders, { errors: true, cache: cache }).then(function (favoriteFolders) {

                        // Elements to be shown in the listView
                        var resetElements = [];
                        _.each(favoriteFolders, function (elem) {
                            resetElements.push(elem);
                        });
                        _.each(favoriteFiles, function (elem) {
                            resetElements.push(elem);
                        });
                        self.collection.reset(resetElements);
                    });
                });
            });
        },
        sortBy: function () {
            var desc = this.model.get('order') === 'desc';
            switch (this.model.get('sort')) {
                case 5: // sort by date
                    this.collection.comparator = function (shareA) {
                        var ret = shareA.get('last_modified');
                        if (shareA.isFolder()) {
                            ret = (desc ? '1' : '0') + ret;
                        } else {
                            ret = (desc ? '0' : '1') + ret;
                        }
                        return desc ? -ret : ret;
                    };
                    break;
                case 702: // sort by name
                    this.collection.comparator = function (shareA, shareB) {
                        var a = shareA.getDisplayName().toLowerCase(),
                            b = shareB.getDisplayName().toLowerCase();
                        if (shareA.isFolder()) {
                            a = (desc ? '1' : '0') + a;
                        } else {
                            a = (desc ? '0' : '1') + a;
                        }
                        if (shareB.isFolder()) {
                            b = (desc ? '1' : '0') + b;
                        } else {
                            b = (desc ? '0' : '1') + b;
                        }
                        var ret = a > b ? 1 : -1;
                        return desc ? -ret : ret;
                    };
                    break;
                default:
            }
            // the list view needs a proper "index" attribute for sorting
            this.collection.sort({ silent: true });
            this.collection.each(function (model, index) {
                model.set('index', index);
            });
            this.collection.trigger('sort');
            this.app.props.set(this.model.attributes);
        },

        getContextMenuData: function (selection) {
            return this.app.getContextualData(selection, 'favorites');
        }
    });

    //
    // Extensions
    //

    ext.point(ITEM).extend(
        {
            id: 'default',
            index: 100,
            draw: function (baton) {
                ext.point(ITEM + '/list').invoke('draw', this, baton);
            }
        }
    );

    // list layout

    ext.point(ITEM + '/list').extend(
        {
            id: 'file-type',
            index: 10,
            draw: function (baton) {
                if (baton && baton.model) {
                    var filetype = baton.model.getFileType ? baton.model.getFileType() : false;
                    this.closest('.list-item')
                        .addClass('file-type-' + filetype)
                        .attr('data-is-favorite-view', true)
                        .attr('data-is-file', filetype !== 'folder');
                }
            }
        },
        {
            id: 'locked',
            index: 20,
            draw: extensions.locked
        },
        {
            id: 'col1',
            index: 100,
            draw: function () {
                var column = $('<div class="list-item-column column-1">').append('<i class="fa file-type-icon" aria-hidden="true">');
                this.append(column);
            }
        },
        {
            id: 'col2',
            index: 200,
            draw: function (baton) {
                var column = $('<div class="list-item-column column-2">');
                extensions.filename.call(column, baton);
                this.append(column);
            }
        },
        {
            id: 'col3',
            index: 300,
            draw: function (baton) {

                if (_.device('smartphone')) return;

                var breadcrumb = new BreadcrumbView({
                    folder: baton.model.getFileType ? baton.model.attributes.folder_id : baton.model.id,
                    exclude: ['9'],
                    notail: true,
                    isLast: true
                });

                breadcrumb.handler = function (id) {
                    // launch files and set/change folder
                    ox.launch('io.ox/files/main', { folder: id }).done(function () {
                        this.folder.set(id);
                    });
                };

                this.append(
                    $('<div class="list-item-column column-3 gray">').append(
                        breadcrumb.render().$el
                    )
                );
            }
        },
        {
            id: 'col4',
            index: 400,
            draw: function (baton) {
                if (_.device('smartphone')) return;
                var column = $('<div class="list-item-column column-4 gray">');
                extensions.smartdate.call(column, baton);
                this.append(column);
            }
        }
    );

    return MyFavoriteListView;
});
