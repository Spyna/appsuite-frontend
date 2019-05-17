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
 * @author Kristof Kamin <kristof.kamin@open-xchange.com>
 */

define('io.ox/files/favorites', [
    'io.ox/core/folder/node',
    'io.ox/core/folder/api',
    'io.ox/files/api',
    'io.ox/core/extensions',
    'io.ox/core/upsell',
    'settings!io.ox/core',
    'gettext!io.ox/core'
], function (TreeNodeView, folderAPI, filesAPI, ext, upsell, settings, gt) {

    'use strict';

    var module = 'infostore';

    var FOLDERS_INFOSTORE_PATH = 'favorites/infostore';
    var FILESS_INFOSTORE_PATH = 'favoriteFiles/infostore';

    // skip if no capability (use capabilities from upsell to work in demo mode)
    if (!upsell.has('infostore')) return;

    var // register collection
        collectionId = 'virtual/favorites/infostore',
        model = folderAPI.pool.getModel(collectionId),
        collection = folderAPI.pool.getCollection(collectionId),
        // track folders without permission or that no longer exist
        invalid = {};

    // Add infos for the filesview
    model.set('title', gt('Favorites'));
    model.set('folder_id', '9');
    model.set('own_rights', 1);
    model.set('standard_folder', true);

    function storeFolders(elements) {
        settings.set(FOLDERS_INFOSTORE_PATH, elements);
    }

    function storeFiles(elements) {
        settings.set(FILESS_INFOSTORE_PATH, elements);
    }

    function addFavoriteIndex(model) {
        var fileModel = new filesAPI.Model(model.toJSON());
        fileModel.set('index/' + collectionId, true, { silent: true });
        return fileModel;
    }

    /**
     * Add a folder to the collection
     * @param {Integer} id
     *
     * Additional parameters
     * @param {Folder|File|false} model
     *  Folder model
     */
    function addFavorite(id, model) {

        model = model || folderAPI.pool.getModel(id);

        addFavorites([model]);
    }

    function addFavorites(models) {

        if (!models || models.length === 0) return;

        var folderSettings = settings.get(FOLDERS_INFOSTORE_PATH, []);
        var fileSettings = settings.get(FILESS_INFOSTORE_PATH, []);

        var updateFolders = false;
        var updateFiles = false;
        var collectionModels = [];

        models.forEach(function (model) {
            if (model && model.attributes && model.attributes.id) {
                if (model.attributes.folder_name) {

                    if (folderSettings.indexOf(model.attributes.id) < 0) {
                        folderSettings.push(model.attributes.id);
                        collectionModels.push(addFavoriteIndex(model));
                        updateFolders = true;
                    }

                } else {

                    var file = {
                        id: model.attributes.id,
                        folder_id: model.attributes.folder_id
                    };

                    if (!containsFile(fileSettings, file)) {
                        fileSettings.push(file);
                        collectionModels.push(addFavoriteIndex(model));
                        updateFiles = true;
                    }
                }
            }
        });

        if (updateFolders) {
            storeFolders(folderSettings);
        }
        if (updateFiles) {
            storeFiles(fileSettings);
        }

        if (collectionModels.length > 0) {
            settings.save();
            collection.add(collectionModels);
            triggerCollectionUpdate();
        }

    }

    function removeFavorites(models) {

        if (!models || models.length === 0) return;

        var folders = [];
        var files = [];

        models.forEach(function (obj) {
            var id = obj;
            if (typeof obj === 'object' && obj.attributes && obj.attributes.id) {
                if (obj.attributes.folder_name) {
                    folders.push(obj.id);
                } else if (obj.attributes.folder_id) {
                    files.push({
                        id: obj.attributes.id,
                        folder_id: obj.attributes.folder_id
                    });
                }
            } else if (typeof obj === 'object' && obj.id && obj.folder_id) {
                files.push({
                    id: obj.id,
                    folder_id: obj.folder_id
                });
            } else {

                var model = filesAPI.pool.get('detail').get(id);
                if (model && model.attributes && model.attributes.folder_id) {
                    files.push({
                        id: model.attributes.id,
                        folder_id: model.attributes.folder_id
                    });
                } else {
                    model = folderAPI.pool.getModel(id);
                    if (model && model.attributes && model.attributes.folder_name) {
                        folders.push(id);
                    }
                }
            }
        });
        var updateCollection = false;
        if (folders.length > 0) {

            var folderSettings = settings.get(FOLDERS_INFOSTORE_PATH, []);

            var newFolderSettings = folderSettings.filter(function (folder) {
                return folders.indexOf(folder) < 0;
            });
            if (folderSettings.length !== newFolderSettings.length) {
                updateCollection = true;
                storeFolders(newFolderSettings);
            }
        }

        if (files.length > 0) {

            var fileSettings = settings.get(FILESS_INFOSTORE_PATH, []);

            var newFileSettings = fileSettings.filter(function (file) {
                return !containsFile(files, file);
            });
            if (fileSettings.length !== newFileSettings.length) {
                updateCollection = true;
                storeFiles(newFileSettings);
            }

        }

        if (updateCollection) {
            settings.save();
            collection.remove(models);
            triggerCollectionUpdate();
        }
    }

    function containsFile(files, file) {
        return _.find(files, function (removeFile) {
            return removeFile.id === file.id && removeFile.folder_id === file.folder_id;
        });
    }

    /**
     * Trigger to update sorting in myFavoriteListView (drive).
     */
    function triggerCollectionUpdate() {
        collection.trigger('update:collection');
    }

    function refreshCollection() {
        var cache = !collection.expired && collection.fetched;

        // get saved favorites from setting
        var folderSettings = settings.get(FOLDERS_INFOSTORE_PATH, []);
        var fileSettings = settings.get(FILESS_INFOSTORE_PATH, []);

        var folderDef = $.Deferred();
        var fileDef = $.Deferred();

        folderAPI.multiple(folderSettings, { errors: true, cache: cache }).then(function (response) {
            // remove non-existent entries
            var responseList = _(response).filter(function (item) {
                if (item.error && /^(FLD-0008|FLD-0003|ACC-0002|FLD-1004|IMAP-1002|FILE_STORAGE-0004)$/.test(item.code)) {
                    invalid[item.id] = true;
                    return false;
                }
                delete invalid[item.id];
                return true;
            });

            folderDef.resolve(responseList);
        });

        filesAPI.getList(fileSettings, { errors: true, cache: cache, fullModels: true }).then(function (response) {
            fileDef.resolve(response);
        });

        return $.when(folderDef, fileDef).then(function (favoriteFolders, favoriteFiles) {
            var returnList = [];
            var folders = [];
            var files = [];
            _.each(favoriteFolders, function (folder) {
                if (folder) {
                    folderAPI.injectIndex.bind(folderAPI, folder);
                    var folderModel = folderAPI.pool.getModel(folder.id);
                    // convert folder model into file model
                    folderModel = new filesAPI.Model(folderModel.toJSON());
                    filesAPI.pool.add('detail', folderModel.toJSON());
                    returnList.push(folderModel);

                    folders.push(folder.id);
                }
            });

            _.each(favoriteFiles, function (file) {
                if (file) {
                    folderAPI.injectIndex.bind(folderAPI, file);
                    returnList.push(file);

                    files.push({
                        id: file.attributes.id,
                        folder_id: file.attributes.folder_id
                    });
                }
            });

            storeFolders(folders);
            storeFiles(files);
            settings.save();

            collection.reset(returnList);
            collection.fetched = true;
            collection.expired = false;

            model.set('subscr_subflds', favoriteFolders.length > 0);
            triggerCollectionUpdate();

            return returnList;
        });
    }

    /**
     * Definition for virtual folder
     */
    folderAPI.virtual.add(collectionId, function () {
        return refreshCollection();
    });

    // Folder API listener ----------------------------------------------------

    folderAPI.on('rename', function (id, data) {
        var changedModel = collection.get(_.cid(data));
        if (changedModel) {
            changedModel.set('title', data.title);
            triggerCollectionUpdate();
        }
    });

    folderAPI.on('remove move collection:remove', function (id, data) {
        removeFavorites([data]);
    });

    // Files API listener -----------------------------------------------------

    filesAPI.on('rename description add:version remove:version change:version', function (obj) {
        var id = obj;
        if (typeof obj === 'object') {
            id = (obj.folder_id !== undefined) ? _.cid(obj) : obj.id;
        } else {
            obj = _.cid(obj);
        }

        filesAPI.get(obj).done(function (file) {
            var changedModel = collection.get(id);
            if (changedModel) {
                changedModel.set('com.openexchange.file.sanitizedFilename', file['com.openexchange.file.sanitizedFilename']);
                changedModel.set('title', file.filename);
                triggerCollectionUpdate();
            }
        });
    });

    filesAPI.on('remove:file favorites:remove move', function (list) {
        removeFavorites(list);
    });

    filesAPI.on('favorites:add', function (files) {
        addFavorites(files);
    });

    // Folder tree view extensions --------------------------------------------

    var extension = {
        id: 'favorites',
        index: 1,
        draw: function (tree) {

            this.append(
                new TreeNodeView({
                    empty: false,
                    folder: collectionId,
                    indent: !folderAPI.isFlat(module),
                    open: false,
                    parent: tree,
                    sortable: true,
                    title: gt('Favorites'),
                    tree: tree,
                    icons: tree.options.icons
                })
                    .render().$el.addClass('favorites')
            );
        }
    };

    // Add folder tree view to drive app
    ext.point('io.ox/core/foldertree/infostore/app').extend(_.extend({}, extension));
    // Add foler tree view to popup dialog e.g. Portal 'Open Docuemnt' dialog
    ext.point('io.ox/core/foldertree/infostore/popup').extend(_.extend({}, extension));

    //
    // Folder View ------------------------------------------------------------
    //

    /**
     * Add contextmenu entry 'Add to Favorites' or 'Remove from favorites'
     *
     * @param {Element} node to add the context menu entry
     * @param {Object} options
     */
    function addContextMenuEntry(node, options) {

        if (options.data.module !== 'infostore') return;

        var link = $('<a href="#" role="menuitem">').attr('data-action', options.action).text(options.text).on('click', $.preventDefault); // always prevent default

        if (options.enabled) {
            link.on('click', options.data, options.handler);
        } else {
            link.attr('aria-disabled', true).removeAttr('tabindex').addClass('disabled');
        }

        node.append($('<li role="presentation">').append(link));
    }

    /**
     * Function for add listener
     * @param {Event} e
     */
    function onClickAdd(e) {
        addFavorite(e.data.id);
    }

    /**
     * Function for remove listener
     * @param {Event} e
     */
    function onClickRemove(e) {
        removeFavorites([e.data.id]);
    }

    ext.point('io.ox/core/foldertree/contextmenu/default').extend({
        id: 'toggle-infostore-favorite',
        // place after "Add new folder"
        index: 1010,
        draw: function (baton) {

            var id = baton.data.id,
                module = baton.module,

                // stored favorites from settings
                favorites = settings.get(FOLDERS_INFOSTORE_PATH, []),
                favoriteFiles = settings.get(FILESS_INFOSTORE_PATH, []);

            _.each(favoriteFiles, function (file) {
                favorites.push(file.id);
            });

            // checks if given element is in the favorite setting
            var isFavorite = _.find(favorites, function (elemId) {
                if (elemId === id) {
                    return true;
                }
            });

            // don't offer for trash folders
            if (folderAPI.is('trash', baton.data)) return;

            addContextMenuEntry(this, {
                action: 'toggle-infostore-favorite',
                data: { id: id, module: module },
                enabled: true,
                handler: isFavorite ? onClickRemove : onClickAdd,
                text: isFavorite ? gt('Remove from favorites') : gt('Add to favorites')
            });
        }
    });

    return {
        add: addFavorite,
        remove: removeFavorites
    };
});
