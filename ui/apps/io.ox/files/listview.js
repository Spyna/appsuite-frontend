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

define('io.ox/files/listview', [
    'io.ox/core/tk/list',
    'io.ox/backbone/mini-views/contextmenu-utils',
    'io.ox/core/extensions',
    'io.ox/files/common-extensions',
    'io.ox/files/api',
    'settings!io.ox/core',
    'io.ox/files/view-options',
    'less!io.ox/files/style'
], function (ListView, ContextMenuUtils, ext, extensions, filesAPI, settings) {

    'use strict';

    var LISTVIEW = 'io.ox/files/listview', ITEM = LISTVIEW + '/item';

    function onContextMenu(e) {
        ContextMenuUtils.checkKeyboardEvent(e);
        var view = this;
        var app = view.app;
        // the link to render the context menu with it's entries.
        var link = 'io.ox/core/file/contextmenu/default';
        // context menu when clicked below the list.
        // var linkOutsideList = link + '/outsideList'; Disabled for now

        // android sends context events on long tap, but currently we don't want a context menu on smartphones and tablets
        if (_.device('smartphone') || _.device('android')) { return; }

        var list = view.selection.get();
        if (!list) return;
        // turn cids into proper objects
        var cids = list, models = filesAPI.resolve(cids, false);
        list = _(models).invoke('toJSON');
        // extract single object if length === 1
        var data = list.length === 1 ? list[0] : list;

        return require(['io.ox/core/folder/api']).then(function (folderApi) {
            var folderId = app.folder.get(),
                model = folderApi.pool.getModel(folderId);

            var baton = new ext.Baton({ data: data, models: models, collection: app.listView.collection, app: app, allIds: [], view: view, linkContextMenu: link/*, linkContextMenuOutsideList: linkOutsideList*/, insideTrash: folderApi.is('trash', model.toJSON()) });

            view.contextMenu.showContextMenu(e, baton);
        });
    }

    //
    // Extend ListView
    //

    var FileListView = ListView.extend({

        ref: LISTVIEW,

        initialize: function () {
            ListView.prototype.initialize.apply(this, arguments);
            var view = this;
            view.contextMenu = arguments[0].contextMenu;

            view.$el.addClass('file-list-view');

            view.favorites = settings.get('favorites/infostore', []);
            view.favoriteFiles = settings.get('favoriteFiles/infostore', []);
            settings.on('change:favorites/infostore', function () {
                view.favorites = settings.get('favorites/infostore', []);
                view.favoriteFiles = settings.get('favoriteFiles/infostore', []);
            });
        },

        getCompositeKey: function (model) {
            return model.isFolder() ? 'folder.' + model.get('id') : model.cid;
        },

        onChange: function (model) {
            // ignore irrelevant changed attributes (see bug 49257)
            var relevantChanges = _.intersection(_(model.changed).keys(), FileListView.relevantAttributes);
            if (!relevantChanges.length) return;
            ListView.prototype.onChange.apply(this, arguments);
        },

        onContextMenu: onContextMenu
    });

    // we redraw only if a relevant attribute changes (to avoid flickering)
    FileListView.relevantAttributes = ['index', 'id', 'last_modified', 'locked_until', 'filename', 'file_mimetype', 'file_size', 'source', 'title', 'version', 'index/virtual/favorites/infostore'];

    //
    // Extension for detail sidebar
    //

    ext.point('io.ox/core/viewer/sidebar/fileinfo').extend({
        index: 50,
        id: 'thumbnail',
        draw: function (baton) {
            var body = this.find('.sidebar-panel-body');
            _.defer(function () {
                // only append in files app
                if (body.closest('.viewer-sidebar.rightside').length) {
                    var oldColumn = body.closest('.viewer-sidebar.rightside').find('.sidebar-panel-thumbnail'),
                        column =  oldColumn.length ? oldColumn : $('<div class="sidebar-panel-thumbnail" role="tabpanel">');
                    column.empty();
                    extensions.thumbnail.call(column, baton);
                    body.before(column);
                }
                body = null;
            });
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
                var layout = (baton.app && baton.app.props.get('layout')) || 'list';
                if (!baton.model) {
                    baton.model = new filesAPI.Model(baton.data);
                }
                ext.point(ITEM + '/' + layout).invoke('draw', this, baton);
            }
        },
        {
            id: 'aria-label',
            index: 200,
            draw: extensions.ariaLabel
        }
    );

    var isAttachmentView = function (baton) {
        var attachmentView = settings.get('folder/mailattachments', {});
        return (_.values(attachmentView).indexOf(baton.app.folder.get()) > -1);
    };

    // list layout

    ext.point(ITEM + '/list').extend(
        {
            id: 'file-type',
            index: 10,
            draw: extensions.fileTypeClass
        },
        {
            id: 'locked',
            index: 20,
            draw: extensions.locked
        },
        {
            id: 'col1',
            index: 100,
            draw: function (baton) {
                var column = $('<div class="list-item-column column-1">');
                extensions.fileTypeIcon.call(column, baton);
                this.append(column);
            }
        },
        {
            id: 'col2',
            index: 200,
            draw: function (baton) {
                var column = $('<div class="list-item-column column-2">');

                this.parent().tooltip('destroy');

                extensions.filename.call(column, baton);
                this.append(column);
            }
        },
        {
            id: 'mail-attachment-from',
            index: 210,
            draw: function (baton) {
                if (_.device('smartphone')) return;
                if (!isAttachmentView(baton)) return;
                var column = $('<div class="list-item-column column-5">');
                extensions.mailFrom.call(column, baton);
                this.addClass('attachment-view').append(column);
            }
        },
        {
            id: 'mail-attachment-subject',
            index: 220,
            draw: function (baton) {
                if (_.device('smartphone')) return;
                if (!isAttachmentView(baton)) return;
                var column = $('<div class="list-item-column column-5">');
                extensions.mailSubject.call(column, baton);
                this.append(column);
            }
        },
        {
            id: 'col3',
            index: 300,
            draw: function (baton) {
                if (_.device('smartphone')) return;
                if (isAttachmentView(baton) && baton.app.props.get('sort') !== 5) return;
                var column = $('<div class="list-item-column column-3 gray">');
                extensions.smartdate.call(column, baton);
                this.append(column);
            }
        },
        {
            id: 'col4',
            index: 500,
            draw: function (baton) {
                if (_.device('smartphone')) return;
                if (isAttachmentView(baton) && baton.app.props.get('sort') !== 704) return;
                var column = $('<div class="list-item-column column-4 gray">');
                extensions.size.call(column, baton);
                this.append(column);
            }
        }
    );

    // icon layout

    ext.point(ITEM + '/icon').extend(
        {
            id: 'file-type',
            index: 10,
            draw: extensions.fileTypeClass
        },
        {
            id: 'thumbnail',
            index: 100,
            draw: function () {
                extensions.thumbnail.apply(this, arguments);

                //this.prepend($('<div class="thumbnail-effects-box"></div>')); // please do not remove.
                this.prepend($('<div class="thumbnail-masking-box"></div>'));
            }
        },
        {
            id: 'locked',
            index: 200,
            draw: extensions.locked
        },

        {
            id: 'file-icon',
            index: 300,
            draw: function (baton) {
                var icon = $('<div class="filename-file-icon">');
                extensions.fileTypeIcon.call(icon, baton);
                this.append(icon);
            }
        },
        {
            id: 'filename',
            index: 400,
            draw: function (baton) {
                // use inner ellipsis for too long filenames
                extensions.filename.call(this, baton, { max: 36, charpos: 'middle', suppressExtension: true, optimizeWordbreak: true });

                // additionally render a long version filename tooltip on hover
                extensions.filenameTooltip.call(this, baton);
            }
        }
    );

    // tile layout

    ext.point(ITEM + '/tile').extend(
        {
            id: 'file-type',
            index: 10,
            draw: extensions.fileTypeClass
        },
        {
            id: 'thumbnail',
            index: 100,
            draw: function () {
                extensions.thumbnail.apply(this, arguments);

                //this.prepend($('<div class="thumbnail-effects-box"></div>')); // please do not remove.
                this.prepend($('<div class="thumbnail-masking-box"></div>'));
            }
        },
        {
            id: 'locked',
            index: 200,
            draw: extensions.locked
        },
        {
            id: 'filename',
            index: 400,
            draw: function (baton) {
                // render a long version filename tooltip on hover
                extensions.filenameTooltip.call(this, baton);
            }
        }
    );

    return FileListView;
});
