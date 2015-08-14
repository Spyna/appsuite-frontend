/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2015 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 * @author Julian Bäume <julian.baeume@open-xchange.com>
 *
 */

define('io.ox/files/api', [
    'io.ox/core/http',
    'io.ox/core/folder/api',
    'io.ox/core/api/backbone',
    'io.ox/core/api/collection-pool',
    'io.ox/core/api/collection-loader',
    'io.ox/core/capabilities',
    'settings!io.ox/core',
    'settings!io.ox/files',
    'gettext!io.ox/files'
], function (http, folderAPI, backbone, Pool, CollectionLoader, capabilities, settings, filesSettings, gt) {

    'use strict';

    var api = {};

    //
    // Backbone Model & Collection for Files
    //

    var regUnusableType = /^application\/(force-download|binary|x-download|octet-stream|vnd|vnd.ms-word.document.12|odt|x-pdf)$/i;

    // basic model with custom cid
    api.Model = backbone.Model.extend({

        /**
         * Constructor, to initialize the model with mail and PIM attachments,
         * besides Drive model attributes.
         */
        constructor: function ( attributes, options ) {
            attributes = attributes || {};
            var normalizedAttrs;
            // check if model is initialized with mail, pim or drive model attributes
            if (_.isObject(attributes.mail)) {
                // mail attachment
                normalizedAttrs = {
                    filename: attributes.filename,
                    file_size: attributes.size,
                    file_mimetype: attributes.content_type,
                    id: attributes.id,
                    folder_id: attributes.mail.folder_id || null,
                    origData: attributes,
                    source: 'mail'
                };

            } else if (_.isNumber(attributes.attached) && _.isNumber(attributes.module)) {
                // pim attachment
                normalizedAttrs = {
                    filename: attributes.filename,
                    file_size: attributes.file_size,
                    file_mimetype: attributes.file_mimetype,
                    id: attributes.id,
                    folder_id: attributes.folder,
                    module: attributes.module,
                    origData: attributes,
                    source: 'pim'
                };

            } else if (_.isString(attributes.guardUrl)) {
                // Guard
                normalizedAttrs = attributes;
                normalizedAttrs.source = 'guard';

            } else {
                // drive
                normalizedAttrs = attributes;
                normalizedAttrs.source = 'drive';
            }
            // call parent constructor
            backbone.Model.call( this, normalizedAttrs, options );

            this.listenTo(this, 'change:filename', function (m, newName) {
                //maybe update versions if filename is changed
                var versions = this.get('versions');
                if (!versions) return;

                for (var i = 0; i < versions.length; i++) {
                    if (versions[i].version === m.get('version')) {
                        versions[i].filename = newName;
                        break;
                    }
                }
                this.set('versions', versions);
            });
        },

        isFolder: function () {
            return this.has('standard_folder');
        },

        isFile: function () {
            // we cannot check for "filename", because there are files without a file; yep!
            // so we rather check if it's not a folder
            return !this.isFolder() && this.get('source') === 'drive';
        },

        isImage: function (type) {
            return /^image\//.test(type || this.getMimeType());
        },

        isAudio: function (type) {
            return /^audio\//.test(type || this.getMimeType());
        },

        isVideo: function (type) {
            return /^video\//.test(type || this.getMimeType());
        },

        isOffice: function (type) {
            return /^application\/(msword|vnd.ms-word|vnd.ms-excel|vnd.ms-powerpoint|vnd.oasis|vnd.openxmlformats)/.test(type || this.getMimeType());
        },

        isPDF: function (type) {
            return /^application\/pdf$/.test(type || this.getMimeType());
        },

        isText: function (type) {
            return /^(text\/plain|application\/rtf|text\/rtf)$/.test(type || this.getMimeType());
        },

        isPresentation: function (type) {
            return /^application\/vnd.(ms-powerpoint|openxmlformats-officedocument.presentationml|oasis.opendocument.presentation)/.test(type || this.getMimeType());
        },

        isEncrypted: function () {
            if (this.get('source') === 'guard') return (true);
            // check if file has "guard" file extension
            return /\.(grd|grd2|pgp)$/.test(this.get('filename'));
        },

        isLocked: function () {
            return this.get('locked_until') > _.now();
        },

        isMailAttachment: function () {
            return this.get('source') === 'mail';
        },

        isPIMAttachment: function () {
            return this.get('source') === 'pim';
        },

        getDisplayName: function () {
            return this.get('filename') || this.get('title') || '';
        },

        getExtension: function () {
            var parts = String(this.get('filename') || '').split('.');
            return parts.length === 1 ? '' : parts.pop().toLowerCase();
        },

        getMimeType: function () {
            // split by ; because this field might contain further unwanted data
            var type = String(this.get('file_mimetype')).toLowerCase().split(';')[0];
            // unusable mime type?
            if (regUnusableType.test(type)) {
                // return mime type based on file extension
                return api.mimeTypes[this.getExtension()] || type;
            }
            // fix mime type?
            if (type === 'audio/mp3') return 'audio/mpeg';
            // otherwise
            return type;
        },

        getFileType: function () {
            if (this.isFolder()) {
                return 'folder';
            }
            var extension = this.getExtension();
            for (var type in this.types) {
                if (this.types[type].test(extension)) return type;
            }
        },

        types: {
            image: /^(gif|bmp|tiff|jpe?g|gmp|png)$/,
            audio: /^(aac|mp3|m4a|m4b|ogg|opus|wav)$/,
            video: /^(avi|m4v|mp4|ogv|ogm|mov|mpeg|webm)$/,
            doc:   /^(docx|docm|dotx|dotm|odt|ott|doc|dot|rtf)$/,
            xls:   /^(csv|xlsx|xlsm|xltx|xltm|xlam|xls|xlt|xla|xlsb|ods|ots)$/,
            ppt:   /^(pptx|pptm|potx|potm|ppsx|ppsm|ppam|odp|otp|ppt|pot|pps|ppa)$/,
            pdf:   /^pdf$/,
            zip:   /^(zip|tar|gz|rar|7z|bz2)$/,
            txt:   /^(txt|md)$/,
            guard: /^(grd|grd2|pgp)$/
        },

        supportsPreview: function () {
            if (this.isEncrypted()) return false;
            var type = this.getMimeType();
            if (this.isImage(type)) return 'thumbnail';
            if (this.isAudio(type)) return 'cover';
            if (capabilities.has('document_preview') && (this.isPDF(type) || this.isOffice(type) || this.isText(type))) return 'preview';
            return false;
        },

        getUrl: function (type, options) {
            return api.getUrl(this.toJSON(), type, options);
        }
    });

    // collection using custom models
    api.Collection = backbone.Collection.extend({
        model: api.Model
    });

    //
    // Special Mime Types
    //

    api.mimeTypes = {
        // images
        'jpg':  'image/jpeg',
        'jpeg': 'image/jpeg',
        'png':  'image/png',
        'gif':  'image/gif',
        'tif':  'image/tiff',
        'tiff': 'image/tiff',
        'bmp':  'image/bmp',
        // audio
        'mp3':  'audio/mpeg',
        'ogg':  'audio/ogg',
        'opus': 'audio/ogg',
        'aac':  'audio/aac',
        'm4a':  'audio/mp4',
        'm4b':  'audio/mp4',
        'wav':  'audio/wav',
        // video
        'mp4':  'video/mp4',
        'm4v':  'video/mp4',
        'ogv':  'video/ogg',
        'ogm':  'video/ogg',
        'webm': 'video/webm',
        // CSV
        'csv':  'text/csv',
        // open office
        'odc':  'application/vnd.oasis.opendocument.chart',
        'odb':  'application/vnd.oasis.opendocument.database',
        'odf':  'application/vnd.oasis.opendocument.formula',
        'odg':  'application/vnd.oasis.opendocument.graphics',
        'otg':  'application/vnd.oasis.opendocument.graphics-template',
        'odi':  'application/vnd.oasis.opendocument.image',
        'odp':  'application/vnd.oasis.opendocument.presentation',
        'otp':  'application/vnd.oasis.opendocument.presentation-template',
        'ods':  'application/vnd.oasis.opendocument.spreadsheet',
        'ots':  'application/vnd.oasis.opendocument.spreadsheet-template',
        'odt':  'application/vnd.oasis.opendocument.text',
        'odm':  'application/vnd.oasis.opendocument.text-master',
        'ott':  'application/vnd.oasis.opendocument.text-template',
        'oth':  'application/vnd.oasis.opendocument.text-web',
        // pdf
        'pdf':  'application/pdf',
        // microsoft office
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xlsm': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xltx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
        'xltm': 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'pptm': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'ppsx': 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
        'potx': 'application/vnd.openxmlformats-officedocument.presentationml.template',
        'potm': 'application/vnd.openxmlformats-officedocument.presentationml.template',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'docm': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'dotx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
        'dotm': 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
        'doc':  'application/msword',
        'dot':  'application/msword',
        'xls':  'application/vnd.ms-excel',
        'xlb':  'application/vnd.ms-excel',
        'xlt':  'application/vnd.ms-excel',
        'ppt':  'application/vnd.ms-powerpoint',
        'pps':  'application/vnd.ms-powerpoint'
    };

    // get URL to open, download, or preview a file
    // options:
    // - scaletype: contain or cover or auto
    // - height: image height in pixels
    // - widht: image widht in pixels
    // - version: true/false. if false no version will be appended
    api.getUrl = function (file, type, options) {

        options = _.extend({ scaletype: 'contain' }, options);

        var url = ox.apiRoot + '/files',
            folder = encodeURIComponent(file.folder_id),
            id = encodeURIComponent(file.id),
            version = file.version !== undefined && options.version !== false ? '&version=' + file.version : '',
            // basic URL
            query = '?action=document&folder=' + folder + '&id=' + id + version,
            // file name
            name = file.filename ? '/' + encodeURIComponent(file.filename) : '',
            // scaling options
            scaling = options.width && options.height ? '&scaleType=' + options.scaletype + '&width=' + options.width + '&height=' + options.height : '',
            // avoid having identical URLs across contexts (rather edge case)
            // also inject last_modified if available; needed for "revisionless save"
            // the content might change without creating a new version (which would be part of the URL)
            buster = _([ox.user_id, ox.context_id, file.last_modified]).compact().join('.') || '';

        if (buster) query += '&' + buster;

        switch (type) {
            case 'download':
                return (file.meta && file.meta.downloadUrl) || url + name + query + '&delivery=download';
            case 'thumbnail':
                return (file.meta && file.meta.thumbnailUrl) || url + query + '&delivery=view' + scaling;
            case 'preview':
                return (file.meta && file.meta.previewUrl) || url + query + '&delivery=view' + scaling + '&format=preview_image&content_type=image/jpeg';
            case 'cover':
                return ox.apiRoot + '/image/file/mp3Cover?folder=' + folder + '&id=' + id + scaling + '&content_type=image/jpeg&' + buster;
            case 'play':
                return url + query + '&delivery=view';
            // open/view
            default:
                return url + name + query + '&delivery=view';
        }
    };

    //
    // Pool
    //

    var pool = Pool.create('files', { Collection: api.Collection, Model: api.Model });

    // guess 23 is "meta"
    var allColumns = '1,2,3,5,20,23,700,702,703,704,705,707';

    /**
     * map error codes and text phrases for user feedback
     * @param  {event} e
     * @return { event }
     */
    var failedUpload = function (e) {
        e.data = e.data || {};
        //customized error messages
        if (e && e.code && (e.code === 'UPL-0005' || e.code === 'IFO-1700')) {
            e.data.custom = {
                type: 'error',
                text: /*#, dynamic*/gt(e.error, e.error_params[0], e.error_params[1])
            };
        } else if (e && e.code && e.code === 'IFO-0100' && e.problematic && e.problematic[0] && e.problematic[0].id === 700) {
            e.data.custom = {
                type: 'error',
                text: gt('The provided filename exceeds the allowed length.')
            };
        } else if (e && e.code && e.code === 'FLS-0024') {
            e.data.custom = {
                type: 'error',
                text: gt('The allowed quota is reached.')
            };
        } else {
            e.data.custom = {
                type: 'error',
                text: gt('This file could not be uploaded.') +
                    // add native error message unless generic "0 An unknown error occurred"
                    (!/^0 /.test(e.error) ? '\n' + e.error : '')
            };
        }
        return e;
    };

    // add event hub
    _.extend(api, Backbone.Events);

    api.pool = pool;

    api.collectionLoader = new CollectionLoader({
        module: 'files',
        getQueryParams: function (params) {
            return {
                action: 'all',
                folder: params.folder || settings.get('folder/infostore'),
                columns: allColumns,
                sort: params.sort || '702',
                order: params.order || 'asc',
                // tell server to prefetch thumbnails (see bug 39897)
                pregenerate_previews: true,
                timezone: 'utc'
            };
        },
        httpGet: function (module, params) {
            return $.when(
                folderAPI.list(params.folder),
                // this one might fail due to lack of permissions; error are transformed to empty array
                http.GET({ module: module, params: _(params).omit('limit') }).then(null, $.when)
            )
            .then(function (folders, files) {
                return [].concat(folders, files[0] || []);
            });
        },
        // use client-side limit
        useSlice: true,
        // set higher limit; works much faster than mail
        // we pick a number than looks for typical columns, so 5 * 6 * 7 = 210
        LIMIT: 210
    });

    api.collectionLoader.each = function (data) {
        api.pool.add('detail', data);
    };

    // resolve a list of composite keys
    api.resolve = (function () {

        function map(cid) {
            // return either folder or file models
            if (/^folder\./.test(cid)) {
                // convert folder model to file model
                var data = folderAPI.pool.getModel(cid.substr(7)).toJSON();
                data.folder_id = 'folder';
                return new api.Model(data);
            } else {
                // return existing file model
                return pool.get('detail').get(cid);
            }
        }

        return function (list, json) {
            var models = _(list).chain().map(map).compact().value();
            return json === false ? models : _(models).invoke('toJSON');
        };

    }());

    //
    // GET a single file
    //
    api.get = function (file, options) {

        options = _.extend({ cache: true }, options);

        if (options.cache) {
            var model = pool.get('detail').get(_.cid(file));
            // look for an attribute that is not part of the "all" request
            // to determine if we can use a cached model
            if (model && model.has('description')) return $.when(model.toJSON());
        }

        var params =  {
            action: 'get',
            id: file.id,
            folder: file.folder_id || file.folder,
            timezone: 'UTC'
        };

        if (options.columns) params.columns = options.columns;

        return http.GET({
            module: 'files',
            params: params
        })
        .then(function (data) {
            pool.add('detail', data);
            return data;
        });
    };

    //
    // GET all files of a folder (for compatibility)
    //
    api.getAll = function (folder, options) {

        options = _.extend({ columns: allColumns }, options);

        return http.GET({
            module: 'files',
            params: {
                action: 'all',
                columns: options.columns,
                folder: folder,
                timezone: 'UTC'
            }
        })
        .then(function (data) {
            pool.add('detail', data);
            return data;
        });
    };

    //
    // GET multiple files
    //
    api.getList = (function () {

        function has(item) {
            return this.get(_.cid(item));
        }

        function getter(item) {
            return this.get(_.cid(item)).toJSON();
        }

        function add(item) {
            pool.add('detail', item);
        }

        return function (ids, options) {

            var uncached = ids, collection = pool.get('detail');
            options = _.extend({ cache: true }, options);

            // empty?
            if (ids.length === 0) return $.when([]);

            // get uncached items
            if (options.cache) uncached = _(ids).reject(has, collection);

            // all cached?
            if (uncached.length === 0) return $.when(_(ids).map(getter, collection));

            return http.fixList(uncached, http.PUT({
                module: 'files',
                params: { action: 'list', columns: allColumns, timezone: 'UTC' },
                data: http.simplify(uncached)
            }))
            .then(function (array) {
                // add new items to the pool
                _(array).each(add);
                // reconstruct results
                return _(ids).map(getter, collection);
            });
        };

    }());

    //
    // Lock/unlock files
    //

    var lockToggle = function (list, action) {
        // pause http layer
        http.pause();
        // process all updates
        _(list).each(function (item) {
            http.PUT({
                module: 'files',
                params: {
                    action: action,
                    id: item.id,
                    folder: item.folder_id || item.folder,
                    timezone: 'UTC'
                    // Use 10s diff for debugging purposes
                    // diff: 10000
                },
                appendColumns: false
            });
        });
        // resume & trigger refresh
        return http.resume();
    };

    function updateLockedUntil(list, value) {
        var collection = pool.get('detail');
        list.forEach(function (obj) {
            var model = collection.get(_.cid(obj));
            if (model) model.set('locked_until', value);
        });
    }

    /**
     * unlocks files
     * @param  {array} list
     * @return { deferred }
     */
    api.unlock = function (list) {
        // allow single object and arrays
        list = _.isArray(list) ? list : [list];
        updateLockedUntil(list, 0);
        return lockToggle(list, 'unlock').done(function () {
            api.propagate('unlock', list);
        });
    };

    /**
     * locks files
     * @param  {array} list
     * @return { deferred }
     */
    api.lock = function (list) {
        // allow single object and arrays
        list = _.isArray(list) ? list : [list];
        // lock for 60s until server responds with the actual value
        updateLockedUntil(list, _.now() + 60000);
        return lockToggle(list, 'lock').then(function () {
            return api.propagate('lock', list);
        });
    };

    /**
     * deletes all files from a specific folder
     * @param  {string} folder_id
     * @return { deferred }
     */
    api.clear = function (folder_id) {

        pool.getByFolder(folder_id).forEach(function (collection) {
            collection.expired = true;
            collection.reset();
        });

        // new clear
        return http.PUT({
            module: 'folders',
            appendColumns: false,
            params: {
                action: 'clear',
                tree: '1'
            },
            data: [folder_id]
        })
        .done(function () {
            api.propagate('clear', { folder_id: folder_id });
        });
    };

    //
    // Respond to folder API
    //
    folderAPI.on({
        'before:clear': function (id) {
            // clear target folder
            _(pool.getByFolder(id)).each(function (collection) {
                collection.reset([]);
            });
        },
        'remove:infostore': function () {
            var id = filesSettings.get('folder/trash');
            if (id) {
                folderAPI.list(id, { cache: false });
                _(pool.getByFolder(id)).each(function (collection) {
                    collection.expired = true;
                });
            }
        },
        // sync with folder API
        'before:remove before:move': function (data) {
            var collection = pool.get('detail'), cid = _.cid(data);
            collection.remove(collection.get(cid));
        }
    });

    //
    // Delete files
    //

    function prepareRemove(ids) {

        api.trigger('beforedelete', ids);

        var collection = pool.get('detail'),
            models = _(ids).map(function (item) {
                return collection.get(_.cid(item));
            });

        collection.remove(models);
    }

    api.remove = function (ids, hardDelete) {

        prepareRemove(ids);

        return http.wait(
            http.PUT({
                module: 'files',
                params: { action: 'delete', timestamp: _.then(), hardDelete: Boolean(hardDelete) },
                data: http.simplify(ids),
                appendColumns: false
            })
            .done(function () {
                api.propagate('remove:file', ids);
            })
        );
    };

    //
    // Move / Copy
    //

    function move(list, targetFolderId, ignoreConflicts) {
        http.pause();
        _(list).map(function (item) {
            // move files and folders
            return item.folder_id === 'folder' ?
                folderAPI.move(item.id, targetFolderId, ignoreConflicts) :
                api.update(item, { folder_id: targetFolderId }, { silent: true });
        });
        return http.resume();
    }

    function copy(list, targetFolderId) {
        http.pause();
        _(list).map(function (item) {
            return http.PUT({
                module: 'files',
                params: {
                    action: 'copy',
                    id: item.id,
                    folder: item.folder_id,
                    timestamp: item.timestamp || _.then()
                },
                data: { folder_id: targetFolderId },
                appendColumns: false
            });
        });
        return http.resume();
    }

    function transfer(type, list, targetFolderId, ignoreConflicts) {
        var fn = type === 'move' ? move : copy;

        return http.wait(fn(list, targetFolderId, ignoreConflicts)).then(function (response) {
            var errorText, i = 0, $i = response ? response.length : 0;
            // look if anything went wrong
            for (; i < $i; i++) {
                if (response[i].error) {
                    errorText = response[i].error.error;
                    break;
                }
            }
            // propagete move/copy event
            api.propagate(type, list, targetFolderId);
            return errorText || response;
        });
    }

    /**
     * Move files to another folder
     * @param  {array} list of objects { id, folder_id }
     * @param  {string} targetFolderId
     * @param  {boolean} ignoreConflicts
     */
    api.move = function (list, targetFolderId, ignoreConflicts) {
        prepareRemove(list);
        return transfer('move', list, targetFolderId, ignoreConflicts);
    };

    /**
     * Copy files to another folder
     * @param  {array} list
     * @param  {string} targetFolderId
     * @param  {boolean} ignoreConflicts
     */
    api.copy = function (list, targetFolderId, ignoreConflicts) {
        return transfer('copy', list, targetFolderId, ignoreConflicts);
    };

    //
    // Download zipped content of a folder
    //
    api.zip = function (id) {
        return require(['io.ox/core/download']).then(function (download) {
            download.url(
                ox.apiRoot + '/files?' + $.param({ action: 'zipfolder', folder: id, recursive: true, session: ox.session })
            );
        });
    };

    //
    // Update file
    // @param {object} file { id, folder_id }
    // @param {object} changes The changes to apply; not sent to server if empty
    //
    api.update = function (file, changes, options) {

        if (!_.isObject(changes) || _.isEmpty(changes)) return;

        var model = api.pool.get('detail').get(_.cid(file));
        if (model) model.set(changes);

        // build split data object to support notifications
        options = _.extend({ silent: false }, options);
        var data = { file: changes };

        if (options.notification && !_.isEmpty(options.notification)) {
            data.notification = options.notification;
        }

        return http.PUT({
            module: 'files',
            params: {
                action: 'update',
                id: file.id,
                timestamp: _.then()
            },
            data: data,
            appendColumns: false
        })
        .done(function () {
            if (!options.silent) api.propagate('change:file', file, changes);
        });
    };

    function performUpload(options, data) {

        options = _.extend({
            // used by api.version.upload to be different from api.upload
            action: 'new',
            folder: settings.get('folder/infostore'),
            // allow API consumers to override the module (like OX Guard will certainly do)
            module: 'files'
        }, options);

        var params = _.extend({
            action: options.action,
            filename: options.filename,
            timestamp: _.then()
        }, options.params);

        var formData = new FormData();

        if ('filename' in options) {
            formData.append('file', options.file, options.filename);
        } else if ('file' in options) {
            formData.append('file', options.file);
        }

        // add data
        formData.append('json', JSON.stringify(data));

        return http.UPLOAD({
            module: options.module,
            params: params,
            data: formData,
            fixPost: true
        })
        .fail(failedUpload);
    }

    /**
     * Upload a new file
     * @param {object} file options
     *     - options.file - a File object (as in Blob)
     *     - options.filename - an optional filename (overrides the name value of options.file)
     *     - options.module - override the module used to upload to (default: 'files')
     *     - options.folder - the id of the folder to upload the file into
     *
     *     - options.description - optional meta data for the file object
     * @returns {object}
     *     - a promise resolving to the created file
     *     - promise can be aborted using promise.abort function
     */
    api.upload = function (options) {
        var folder_id = options.folder_id || options.folder;
        options.action = 'new';
        return performUpload(options, {
            folder_id: folder_id,
            description: options.description || ''
        })
        .then(function (result) {
            // result.data just provides the new file id
            api.propagate('add:file', { id: result.data, folder_id: folder_id });
            // return id and folder id
            return { id: result.data, folder_id: folder_id };
        });
    };

    // File versions

    api.versions = {
        /**
         * Upload new version for a file
         * @param {object} file options
         *     - options.file - a File object (as in Blob)
         *     - options.filename - an optional filename (overrides the name value of options.file)
         *     - options.module - override the module used to upload to (default: 'files')
         *     - options.folder - the id of the folder to upload the file into
         *     - options.id - the id of the file
         *
         *     - options.version_comment - optional meta data for the file object
         * @returns {object}
         *     - a promise resolving to the created file
         *     - promise can be aborted using promise.abort function
         */
        upload: function (options) {
            options.action = 'update';
            return performUpload(options, {
                id: options.id,
                folder_id: options.folder_id || options.folder,
                version_comment: options.version_comment || ''
            })
            .then(function () {
                return api.propagate('add:version', options);
            });
        },

        load: function (file, options) {

            options = _.extend({ cache: true }, options);

            // skip if we don't have a model to add data
            var cid = _.cid(file), model = pool.get('detail').get(cid);
            if (!model) return $.when([]);

            // cache hit?
            if (options.cache && model.has('versions')) return $.when(model.get('versions'));

            return http.GET({
                module: 'files',
                params: {
                    action: 'versions',
                    folder: file.folder_id,
                    id: file.id,
                    timezone: 'utc'
                },
                appendColumns: true
            })
            .then(function (data) {
                model.set('versions', data);
                // make sure we always get the same result (just data; not timestamp)
                return data;
            });
        },

        remove: function (file) {

            // update model instantly
            var cid = _.cid(file), model = pool.get('detail').get(cid);
            if (model && _.isArray(model.get('versions'))) {
                model.set('versions', model.get('versions').filter(function (item) {
                    return item.version !== file.version;
                }));
            }

            return http.PUT({
                module: 'files',
                params: {
                    action: 'detach',
                    id: file.id,
                    folder: file.folder_id,
                    timestamp: _.then()
                },
                data: [file.version],
                appendColumns: false
            })
            .then(function () {
                return api.propagate('remove:version', file);
            });
        },

        setCurrent: function (file) {
            // update model
            var model = pool.get('detail').get(_.cid(file));
            if (model && _.isArray(model.get('versions'))) {
                model.set('versions', model.get('versions').map(function (item) {
                    item.current_version = (item.version === file.version);
                    return item;
                }));
            }
            // update server-side
            // if there is only version, the request works.
            // if the other fields are present, we get a backend error
            var changes = { version: file.version };
            return api.update(file, changes).done(function () {
                // the mediator will reload the current collection
                api.propagate('change:version', file);
            });
        }
    };

    //
    // Search
    //
    api.search = function (query, options) {

        options = _.extend({ action: 'search', columns: api.search.columns, sort: '702', order: 'asc', limit: 100 }, options);

        return http.PUT({
            module: 'files',
            params: _(options).pick('action', 'columns', 'sort', 'order', 'limit', 'folder'),
            data: api.search.getData(query, options)
        })
        .done(function (data) {
            pool.add('detail', data);
            return data;
        });
    };

    // make extensible
    api.search.columns = allColumns;
    api.search.getData = function (query) {
        return { pattern: query };
    };

    /**
     * Propagate changes beyond pure model updates
     *
     * @param  {string} type
     * @param  {file} obj
     * @param  {file} changes [optional]
     * @return { promise } [if necessary]
     *
     * Usage:
     *   api.propagate('add:file', file);
     *   api.propagate('lock', array);
     *   api.propagate('remove:file', array);
     *   api.propagate('change:file', file, [changes]);
     *   api.propagate('move', array, [targetFolderId]);
     */
    api.propagate = (function () {

        // keep support for old names
        var oldschool = { 'new': 'add:file', 'change': 'change:file', 'update': 'change:file', 'delete': 'remove:file' };

        function reloadVersions(file) {
            http.pause();
            api.get(file, { cache: false });
            api.versions.load(file, { cache: false });
            return http.resume().then(function (response) {
                // explicitly return the file data
                return response[0].data;
            });
        }

        return function (type, file) {

            // get another copy for array support
            // move, copy, lock, unlock, remove:file handle multiple files at once
            var list = _.isArray(file) ? file : [file];

            // reduce attributes
            file = _(file).pick('folder', 'folder_id', 'id', 'version');

            // translate oldschool names
            type = oldschool[type] || type;

            // might help for a while
            if (ox.debug) console.log('files/api.propagate()', type, file, list, arguments[2] || {});

            switch (type) {

                case 'add:file':
                    api.trigger('add:file', file);
                    // file count changed, need to reload folder
                    folderAPI.reload(list);
                    break;

                case 'add:version':
                    // reload versions list
                    return reloadVersions(file).done(function () {
                        // the mediator will reload the current collection
                        api.trigger('add:version', file);
                    });

                case 'change:file':
                    // we trigger both change and update for backwards-compatibility
                    api.trigger('change:file update change:file:' + _.ecid(file) + ' update:' + _.ecid(file));
                    // rename?
                    var changes = arguments[2] || {};
                    if ('title' in changes || 'filename' in changes) api.propagate('rename', file);
                    if ('object_permissions' in changes) api.propagate('permissions', file);
                    break;

                case 'change:version':
                    api.trigger('change:version', file);
                    break;

                case 'clear':
                    api.trigger('clear', file.folder_id);
                    folderAPI.reload(file.folder_id);
                    break;

                case 'copy':
                case 'move':
                    var targetFolderId = arguments[2];
                    // propagate proper event
                    api.trigger(type, list, targetFolderId);
                    // reload all affected folders (yep, copy would just need the target folder)
                    folderAPI.reload(list, targetFolderId);
                    // mark target folder as expired
                    pool.resetFolder(targetFolderId);
                    break;

                case 'lock':
                    // reload locked files to get proper timestamps
                    return api.getList(list, { cache: false });

                case 'remove:file':
                    api.trigger('remove:file', list);
                    _(list).each(function (obj) {
                        api.trigger('remove:file:' + _.ecid(obj));
                    });
                    // file count changed, need to reload folder
                    folderAPI.reload(list);
                    break;

                case 'remove:version':
                    // let's reload the version list
                    // since we might have just removed the current version
                    return reloadVersions(file).done(function () {
                        // the mediator will reload the current collection
                        api.trigger('remove:version', file);
                    });

                case 'rename':
                    api.trigger('rename', _.cid(file));
                    break;

                case 'permissions':
                    api.trigger('change:permissions', _.cid(file));
                    break;

                case 'unlock':
                    // nothing to do for unlock
                    break;
            }
        };

    }());

    api.getDefaultColumns = function (additional) {
        var columns = http.getAllColumns('files');
        return _([].concat(columns, additional)).uniq().sort().join(',');
    };

    return api;

});
