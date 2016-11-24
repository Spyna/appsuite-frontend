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
/* global blankshield */
define('io.ox/files/actions', [

    'io.ox/core/folder/api',
    'io.ox/files/api',
    'io.ox/files/util',
    'io.ox/core/api/filestorage',

    'io.ox/core/extensions',
    'io.ox/core/extPatterns/links',
    'io.ox/core/capabilities',

    'settings!io.ox/files',
    'gettext!io.ox/files'

], function (folderAPI, api, util, filestorageApi, ext, links, capabilities, settings, gt) {

    'use strict';

    var Action = links.Action,
        COMMENTS = settings.get('features/comments', true);

    // actions
    new Action('io.ox/files/actions/upload', {
        requires: function (e) {
            return e.baton.app.folder.getData().then(function (data) {
                //hide for virtual folders (other files root, public files root)
                var virtual = _.contains(['14', '15'], data.id);
                //no new files in trash folders
                return folderAPI.can('create', data) && !virtual && !folderAPI.is('trash', data);
            });
        },
        action: function (baton) {
            var elem = $(baton.e.target),
                input;

            // remove old input-tags resulting from 'add local file' -> 'cancel'
            elem.siblings('input').remove();

            elem.after(
                input = $('<input type="file" name="file" multiple>')
                .css('display', 'none')
                .on('change', function (e) {
                    var app = baton.app;
                    require(['io.ox/files/upload/main'], function (fileUpload) {
                        e.preventDefault();

                        var list = [];
                        _(e.target.files).each(function (file) {
                            list.push(_.extend(file, { group: 'file' }));
                        });
                        var options = _.extend({ folder: app.folder.get() }, baton.file_options);
                        fileUpload.setWindowNode(app.getWindowNode());
                        fileUpload.create.offer(list, options);
                    });
                    input.remove();
                })
            );

            input.trigger('click');
        }
    });

    // editor
    if (window.Blob) {

        new Action('io.ox/files/actions/editor', {
            requires: function (e) {
                return api.versions.getCurrentState(e.baton.data).then(function (currentVersion) {
                    return util.conditionChain(
                        currentVersion,
                        e.collection.has('one', 'modify'),
                        !util.hasStatus('lockedByOthers', e),
                        (/\.(csv|txt|js|css|md|tmpl|html?)(\.pgp)?$/i).test(e.context.filename),
                        (!(/\.pgp$/i).test(e.context.filename) || capabilities.has('guard-drive')),  // if has .pgp, must have Guard capability
                        (e.baton.openedBy !== 'io.ox/mail/compose'),
                        util.isFolderType('!trash', e.baton)
                    );
                });
            },
            action: function (baton) {
                var launch = function (params) {
                    if (ox.ui.App.reuse('io.ox/editor:edit.' + _.cid(baton.data))) {
                        // if this was opened from the viewer, close it now
                        if (baton.context && baton.context.viewerEvents) {
                            baton.context.viewerEvents.trigger('viewer:close');
                        }
                        return;
                    }
                    ox.launch('io.ox/editor/main', { folder: baton.data.folder_id, id: baton.data.id, params: _.extend({}, params) }).done(function () {
                        // if this was opened from the viewer, close it now
                        if (baton.context && baton.context.viewerEvents) {
                            baton.context.viewerEvents.trigger('viewer:close');
                        }
                    });
                };

                // Check if Guard file.  If so, do auth then call with parameters
                if (((baton.data.meta && baton.data.meta.Encrypted) || baton.data.filename.endsWith('.pgp')) && capabilities.has('guard-drive')) {
                    require(['io.ox/guard/auth/authorizer'], function (guardAuth) {
                        guardAuth.authorize().then(function (auth) {
                            var params = {
                                cryptoAction: 'Decrypt',
                                cryptoAuth: auth
                            };
                            launch(params);
                        });
                    });
                    return;
                }

                launch();
            }
        });

        new Action('io.ox/files/actions/editor-new', {
            requires: function (e) {
                return e.baton.app.folder.getData().then(function (data) {
                    //hide for virtual folders (other files root, public files root)
                    var virtual = _.contains(['14', '15'], data.id);

                    //no new files in trash folders
                    if (folderAPI.is('trash', data)) return false;
                    // no new files in virtual folders
                    if (virtual) return false;
                    // no new files in mail attachments
                    if (e.baton.openedBy === 'io.ox/mail/compose') return false;

                    return folderAPI.can('create', data);
                });
            },
            action: function (baton) {
                ox.launch('io.ox/editor/main').done(function () {
                    this.create({ folder: baton.app.folder.get() });
                });
            }
        });
    }

    new Action('io.ox/files/actions/download', {
        requires: function (e) {
            // no file-system, no download
            if (_.device('ios')) return false;

            if (e.collection.has('multiple')) {
                var result = true;
                _.each(e.baton.data, function (obj) {
                    if (!obj.filename || !obj.file_size) {
                        result = false;
                    }
                });
                return result;
            }

            // 'description only' items
            return !_.isEmpty(e.baton.data.filename) || e.baton.data.file_size > 0;
        },
        multiple: function (list) {
            ox.load(['io.ox/files/actions/download']).done(function (action) {
                action(list);
            });
        }
    });

    new Action('io.ox/files/actions/download-folder', {
        requires: function (e) {
            // no file-system, no download
            if (_.device('ios')) return false;
            // single folders only
            return e.collection.has('one', 'folders');
        },
        action: function (baton) {
            require(['io.ox/files/api'], function (api) {
                api.zip(baton.data.id);
            });
        }
    });

    new Action('io.ox/files/actions/downloadversion', {
        requires: function (e) {
            // no file-system, no download
            if (_.device('ios')) return false;
            if (e.collection.has('multiple')) return true;
            // 'description only' items
            return !_.isEmpty(e.baton.data.filename) || e.baton.data.file_size > 0;
        },
        multiple: function (list) {
            // loop over list, get full file object and trigger downloads
            require(['io.ox/core/download'], function (download) {
                _(list).each(function (o) {
                    download.file(o);
                });
            });
        }
    });

    new Action('io.ox/files/actions/permissions', {
        requires: function (e) {
            if (_.device('smartphone')) return false;
            if (!e.collection.has('one')) return false;
            // get proper id
            var id = e.collection.has('folders') ? e.baton.data.id : e.baton.data.folder_id;
            return folderAPI.pool.getModel(id).isShareable();
        },
        action: function (baton) {
            require(['io.ox/files/share/permissions'], function (controller) {
                var model = baton.models[0];
                if (model.isFile()) {
                    controller.showFilePermissions(baton.data);
                } else {
                    controller.showFolderPermissions(baton.data.id);
                }
            });
        }
    });

    new Action('io.ox/files/actions/open', {
        requires: function (e) {
            if (e.collection.has('multiple')) return false;
            if (e.collection.has('folders')) return false;
            if (e.baton.data.file_mimetype) {
                // no 'open' menu entry for office documents, PDF and plain text
                if (api.Model.prototype.isOffice.call(this, e.baton.data.file_mimetype)) return false;
                if (api.Model.prototype.isPDF.call(this, e.baton.data.file_mimetype)) return false;
                if (api.Model.prototype.isText.call(this, e.baton.data.file_mimetype)) return false;
            }
            // 'description only' items
            return !_.isEmpty(e.baton.data.filename) || e.baton.data.file_size > 0;
        },
        multiple: function (list) {
            _(list).each(function (file) {
                blankshield.open(api.getUrl(file, 'open'));
            });
        }
    });

    new Action('io.ox/files/actions/sendlink', {
        capabilities: 'webmail !alone',
        requires: function (e) {
            return util.conditionChain(
                _.device('!smartphone'),
                !_.isEmpty(e.baton.data),
                e.collection.has('some', 'items'),
                e.baton.openedBy !== 'io.ox/mail/compose',
                util.isFolderType('!attachmentView', e.baton),
                util.isFolderType('!trash', e.baton)
            );
        },
        multiple: function (list) {
            ox.load(['io.ox/files/actions/sendlink']).done(function (action) {
                action(list);
            });
        }
    });

    new Action('io.ox/files/actions/send', {
        capabilities: 'webmail',
        requires: function (e) {
            var list = _.getArray(e.context);
            return util.conditionChain(
                _.device('!smartphone'),
                !_.isEmpty(e.baton.data),
                e.collection.has('some', 'items'),
                e.baton.openedBy !== 'io.ox/mail/compose',
                _(list).reduce(function (memo, obj) {
                    return memo || obj.file_size > 0;
                }, false),
                util.isFolderType('!trash', e.baton)
            );
        },
        multiple: function (array) {
            api.getList(array).done(function (list) {
                var filtered_list = _.filter(list, function (o) { return o.file_size !== 0; });
                if (filtered_list.length === 0) return;
                ox.registry.call('mail-compose', 'compose', { infostore_ids: filtered_list });
            });
        }
    });

    new Action('io.ox/files/actions/showlink', {
        requires: function (e) {
            return util.conditionChain(
                capabilities.has('!alone !guest'),
                _.device('!smartphone'),
                !_.isEmpty(e.baton.data),
                e.collection.has('some', 'items'),
                util.isFolderType('!attachmentView', e.baton),
                util.isFolderType('!trash', e.baton)
            );
        },
        multiple: function (list) {
            ox.load(['io.ox/files/actions/showlink']).done(function (action) {
                action(list);
            });
        }
    });

    new Action('io.ox/files/actions/delete', {
        requires: function (e) {
            // hide in mail compose preview
            if (e.baton.openedBy === 'io.ox/mail/compose') return false;
            // not in standalone mode
            if (e.context.standalone) return false;
            return e.collection.has('some', 'delete') && util.hasStatus('!lockedByOthers', e);
        },
        multiple: function (list, baton) {
            ox.load(['io.ox/files/actions/delete']).done(function (action) {
                if (!baton.models) {
                    api.pool.add(list);
                    baton.models = api.pool.resolve(list);
                }
                action(baton.models);
            });
        }
    });

    new Action('io.ox/files/actions/viewer', {
        requires: function (e) {
            if (e.collection.has('guard') && !capabilities.has('guard-drive')) return false;
            return e.collection.has('some', 'items');
        },
        action: function (baton) {
            ox.load(['io.ox/core/viewer/main']).done(function (Viewer) {
                var viewer = new Viewer(),
                    selection = [].concat(baton.data);

                if (selection.length > 1) {
                    // only show selected files - the first one is automatically selected
                    viewer.launch({ files: selection });
                } else {
                    viewer.launch({ selection: _(selection).first(), files: baton.collection.models });
                }
            });
        }
    });

    new Action('io.ox/files/actions/launchpresenter', {
        capabilities: 'presenter document_preview',
        requires: function (e) {
            if (!e.collection.has('one')) {
                return false;
            }
            var model = e.baton.models[0];
            var type = model.isEncrypted() ? model.getGuardMimeType() : model.getMimeType();
            return ((model.isPresentation(type) || model.isPDF(type)) && model.isFile(type));
        },
        action: function (baton) {
            var fileModel = baton.models[0];
            if (fileModel.isEncrypted()) {
                require(['io.ox/guard/auth/authorizer'], function (authorizer) {
                    authorizer.authorize().then(function (auth) {
                        var params = {
                            cryptoAction: 'Decrypt',
                            cryptoAuth: auth,
                        };
                        fileModel.set('file_options', { params: params });
                        ox.launch('io.ox/presenter/main', fileModel);
                    });
                });
            } else {
                ox.launch('io.ox/presenter/main', fileModel);
            }

        }
    });

    //drive action for double-click or enter in files
    new Action('io.ox/files/actions/default', {
        action: function (baton) {
            require(['io.ox/core/extPatterns/actions']).done(function (actions) {
                actions.invoke('io.ox/files/actions/viewer', null, baton);
            });
        }
    });

    new Action('io.ox/files/actions/lock', {
        capabilities: '!alone',
        requires: function (e) {
            return _.device('!smartphone') &&
                !_.isEmpty(e.baton.data) &&
                e.collection.has('some', 'modify', 'items') &&
                // hide in mail compose preview
                (e.baton.openedBy !== 'io.ox/mail/compose') &&
                util.hasStatus('!locked', e);
        },
        multiple: function (list) {
            ox.load(['io.ox/files/actions/lock-unlock']).done(function (action) {
                action.lock(list);
            });
        }
    });

    new Action('io.ox/files/actions/unlock', {
        capabilities: '!alone',
        requires: function (e) {
            return _.device('!smartphone') &&
                !_.isEmpty(e.baton.data) &&
                e.collection.has('some', 'modify', 'items') &&
                // hide in mail compose preview
                (e.baton.openedBy !== 'io.ox/mail/compose') &&
                util.hasStatus('lockedByMe', e);
        },
        multiple: function (list) {
            ox.load(['io.ox/files/actions/lock-unlock']).done(function (action) {
                action.unlock(list);
            });
        }
    });

    new Action('io.ox/files/actions/add-to-portal', {
        capabilities: 'portal',
        requires: function (e) {
            return util.conditionChain(
                e.collection.has('one', 'items'),
                !_.isEmpty(e.baton.data),
                util.isFolderType('!trash', e.baton)
            );
        },
        action: function (baton) {
            ox.load(['io.ox/files/actions/add-to-portal']).done(function (action) {
                action(baton.data);
            });
        }
    });

    function hasObjectWritePermissions(data) {
        if (_.isArray(data)) data = _(data).first();
        if (!_.isObject(data)) return false;
        var array = data.object_permissions || data['com.openexchange.share.extendedObjectPermissions'],
            myself = _(array).findWhere({ entity: ox.user_id });
        return !!(myself && (myself.bits >= 2));
    }

    new Action('io.ox/files/actions/rename', {
        requires: function (e) {
            // one?
            if (!e.collection.has('one')) return false;
            if (util.hasStatus('lockedByOthers', e)) return false;
            // hide in mail compose preview
            if (e.baton.openedBy === 'io.ox/mail/compose') return false;
            // case 1: folder?
            if (e.collection.has('folders')) {
                return e.collection.has('rename:folder');
            }
            // case 2: file
            // access on folder?
            if (e.collection.has('modify')) return true;
            // check object permission
            return hasObjectWritePermissions(e.baton.data);
        },
        action: function (baton) {
            // if this is a folder use the folder rename action
            if (baton.data.folder_id === 'folder') {
                ox.load(['io.ox/core/folder/actions/rename']).done(function (action) {
                    action(baton.data.id);
                });
            } else {
                // files use the file rename action
                ox.load(['io.ox/files/actions/rename']).done(function (action) {
                    action(baton.data);
                });
            }
        }
    });

    new Action('io.ox/files/actions/save-as-pdf', {
        capabilities: 'document_preview', // document converter.
        requires: function (e) {
            // one?
            if (!e.collection.has('one')) return false;

            // hide in mail compose preview
            if (e.baton.openedBy === 'io.ox/mail/compose') return false;

            // is folder?
            if (e.collection.has('folders')) return false;

            var
                model         = e.baton.models[0];
          //    isAccessWrite = folderAPI.can('create', folderAPI.pool.models[model.get('folder_id')].toJSON());
          //
          //if (!isAccessWrite(e)) return false;

            // preferred variant over >> return (model.isFile() && !model.isPDF()); <<
            return (model.isFile() && (model.isOffice() || model.isText()));
        },
        action: function (baton) {
            // files use the file rename action
            ox.load(['io.ox/files/actions/save-as-pdf']).done(function (action) {
                action(baton);
            });
        }
    });

    new Action('io.ox/files/actions/edit-description', {
        requires: function (e) {
            if (!e.collection.has('one', 'items')) return false;
            if (util.hasStatus('lockedByOthers', e)) return false;
            // hide in mail compose preview
            if (e.baton.openedBy === 'io.ox/mail/compose') return false;
            if (!(folderAPI.pool.getModel(e.baton.data.folder_id || e.baton.data[0].folder_id).supports('extended_metadata'))) return false;
            // access on folder?
            if (e.collection.has('modify')) return true;
            // check object permission
            return hasObjectWritePermissions(e.baton.data);
        },
        action: function (baton) {
            ox.load(['io.ox/files/actions/edit-description']).done(function (action) {
                action(baton.data);
            });
        }
    });

    new Action('io.ox/files/actions/upload-new-version', {
        requires: function (e) {
            // hide in mail compose preview and only when file backend supports version comments
            return e.collection.has('one', 'modify', 'items') && util.hasStatus('!lockedByOthers', e) && (e.baton.openedBy !== 'io.ox/mail/compose') && COMMENTS &&
                   folderAPI.pool.getModel(e.baton.data.folder_id || e.baton.data[0].folder_id) && folderAPI.pool.getModel(e.baton.data.folder_id || e.baton.data[0].folder_id).can('add:version');
        },
        action: function (baton) {
            ox.load(['io.ox/files/actions/upload-new-version']).done(function (action) {
                action(baton.data);
            });
        }
    });

    function moveAndCopy(type, label, success) {
        new Action('io.ox/files/actions/' + type, {
            requires:  function (e) {
                if (!e.collection.has('some')) return false;
                if (e.baton.openedBy === 'io.ox/mail/compose') return false;
                if (util.hasStatus('lockedByOthers', e)) return false;
                // anonymous guests just have one folder so no valid target folder (see bug 42621)
                if (capabilities.has('guest && anonymous')) return false;
                // copy
                if (type === 'copy') return e.collection.has('some', 'items', 'read');
                // move
                return e.collection.has('delete');
            },
            multiple: function (list, baton) {
                ox.load(['io.ox/files/actions/move-copy']).done(function (action) {
                    var options = {
                        type: type,
                        label: label,
                        success: success,
                        successCallback: function (response) {
                            if (!_.isString(response)) {
                                var conflicts = { warnings: [] };
                                if (_.isObject(response)) {
                                    response = [response];
                                }
                                // find possible conflicts with filestorages and offer a dialog with ignore warnings option see(Bug 39039)
                                _(response).each(function (error) {
                                    if (error.error) {
                                        if (error.error.categories === 'CONFLICT' && (error.error.code === 'FILE_STORAGE-0045' || error.error.code === 'FLD-1038')) {
                                            if (!conflicts.title) {
                                                conflicts.title = error.error.error;
                                            }
                                            if (_.isObject(error.error.warnings)) {
                                                conflicts.warnings.push(error.error.warnings.error);
                                            } else {
                                                _(error.error.warnings).each(function (warning) {
                                                    conflicts.warnings.push(warning.error);
                                                });
                                            }
                                        }
                                    }
                                });
                                if (conflicts.title) {
                                    require(['io.ox/core/tk/filestorageUtil'], function (filestorageUtil) {
                                        filestorageUtil.displayConflicts(conflicts, {
                                            callbackIgnoreConflicts: function () {
                                                api[type](list, baton.target, true);
                                            }
                                        });
                                    });
                                } else {
                                    //no error, must be success
                                    require(['io.ox/core/yell'], function (yell) {
                                        yell('success', list.length > 1 ? success.multiple : success.single);
                                    });
                                }
                            } else {
                                require(['io.ox/core/yell'], function (yell) {
                                    yell('error', response);
                                });
                            }
                        }
                    };
                    action(list, baton, options);
                });
            }
        });
    }

    moveAndCopy('move', gt('Move'), { single: gt('File has been moved'), multiple: gt('Files have been moved') });
    moveAndCopy('copy', gt('Copy'), { single: gt('File has been copied'), multiple: gt('Files have been copied') });

    function isShareable(e, type) {
        var id, model;
        // not possible for multi-selection
        if (e.collection.has('multiple')) return false;
        // get folder id
        if (e.collection.has('one')) {
            // use selected file or folders
            id = e.collection.has('folders') ? e.baton.data.id : e.baton.data.folder_id;
        } else if (e.baton.app) {
            // use current folder
            id = e.baton.app.folder.get();
        }
        if (e.collection.has('guard')) return false;  // Guard sharing not supported currently
        if (!id) return false;
        // general capability and folder check
        model = folderAPI.pool.getModel(id);
        if (!model.isShareable()) return false;
        return type === 'invite' ? model.supportsInviteGuests() : true;
    }

    // folder based actions
    new Action('io.ox/files/actions/invite', {
        capabilities: 'invite_guests',
        requires: function (e) {
            return isShareable(e, 'invite');
        },
        action: function (baton) {
            ox.load(['io.ox/files/actions/share']).done(function (action) {
                if (baton.models && baton.models.length) {
                    // share selected file
                    action.invite(baton.models);
                } else {
                    // share current folder
                    // convert folder model into file model
                    var id = baton.app.folder.get(),
                        model = new api.Model(folderAPI.pool.getModel(id).toJSON());
                    action.invite([model]);
                }
            });
        }
    });

    new Action('io.ox/files/actions/getalink', {
        capabilities: 'share_links',
        requires: function (e) {
            return isShareable(e, 'link');
        },
        action: function (baton) {
            ox.load(['io.ox/files/actions/share']).done(function (action) {
                if (baton.models && baton.models.length) {
                    action.link(baton.models);
                } else {
                    // share current folder
                    // convert folder model into file model
                    var id = baton.app.folder.get(),
                        model = new api.Model(folderAPI.pool.getModel(id).toJSON());
                    action.link([model]);
                }
            });
        }
    });

    new Action('io.ox/files/icons/audioplayer', {
        requires: function (e) {
            if (_.device('android')) return false;
            return util.checkMedia('audio', e);
        },
        action: function (baton) {
            ox.load(['io.ox/files/mediaplayer']).done(function (mediaplayer) {
                mediaplayer.init({
                    baton: baton,
                    videoSupport: false
                });
            });
        }
    });

    new Action('io.ox/files/icons/videoplayer', {
        requires: function (e) {
            if (_.device('android')) return false;
            return util.checkMedia('video', e);
        },
        action: function (baton) {
            ox.load(['io.ox/files/mediaplayer']).done(function (mediaplayer) {
                mediaplayer.init({
                    baton: baton,
                    videoSupport: true
                });
            });
        }
    });

    // version specific actions

    new Action('io.ox/files/versions/actions/makeCurrent', {
        requires: function (e) {
            // hide in mail compose preview
            return e.collection.has('one', 'items', 'modify') && !e.context.current_version && (e.baton.openedBy !== 'io.ox/mail/compose');
        },
        action: function (baton) {
            api.versions.setCurrent(baton.data);
        }
    });

    new Action('io.ox/files/versions/actions/delete', {
        requires: function (e) {
            // hide in mail compose preview
            return e.collection.has('one', 'items', 'delete') && e.baton.openedBy !== 'io.ox/mail/compose';
        },
        action: function (baton) {
            ox.load(['io.ox/files/actions/versions-delete']).done(function (action) {
                action(baton.data);
            });
        }
    });

    //
    // Add new folder
    //

    new Action('io.ox/files/actions/add-folder', {
        requires: function (e) {
            var model = folderAPI.pool.getModel(e.baton.app.folder.get());
            return folderAPI.can('create:folder', model.toJSON()) && !folderAPI.is('trash', model.toJSON());
        },
        action: function (baton) {
            var id = baton.app.folder.get(), model = folderAPI.pool.getModel(id);
            ox.load(['io.ox/core/folder/actions/add']).done(function (add) {
                add(id, { module: model.get('module') });
            });
        }
    });

    // guidance
    new Action('io.ox/files/actions/guidance', {
        action: function (baton) {
            require(['io.ox/files/guidance/main'], function (guidance) {
                guidance.sidePopup(baton.app, baton.e);
            });
        }
    });

    new Action('io.ox/files/actions/guidance-reload', {
        action: function (baton) {
            require(['io.ox/files/guidance/main'], function (guidance) {
                guidance.reloadPopup(baton.app, baton.e);
            });
        }
    });

    new Action('io.ox/files/premium/actions/synchronize', {
        capabilities: 'boxcom || google || msliveconnect',
        requires: function () {
            // use client onboarding here, since it is a setting and not a capability
            if (!capabilities.has('client-onboarding')) return false;
            return _.device('!smartphone');
        },
        action: function () {
            require(['io.ox/onboarding/clients/wizard'], function (wizard) {
                wizard.run();
            });
        }
    });

    // 'new' dropdown
    new links.ActionLink('io.ox/files/links/toolbar/default', {
        index: 100,
        id: 'upload',
        label: gt('Add local file'),
        ref: 'io.ox/files/actions/upload'
    });

    new links.ActionLink('io.ox/files/links/toolbar/default', {
        index: 200,
        id: 'note',
        label:
            //#. Please translate like "take a note", "Notiz" in German, for example.
            //#. more like "to notice" than "to notify".
            gt('Add note'),
        ref: 'io.ox/files/actions/editor-new'
    });

    new links.ActionLink('io.ox/files/links/toolbar/default', {
        index: 300,
        id: 'add-folder',
        label: gt('Add new folder'),
        ref: 'io.ox/files/actions/add-folder'
    });

    // share dropdown
    new links.ActionLink('io.ox/files/links/toolbar/share', {
        index: 100,
        id: 'invite',
        label: gt('Invite people'),
        //#. sharing: a guest user will be created for the owner of that email address
        description: gt('Every recipient gets an individual link. Guests can also create and change files.'),
        ref: 'io.ox/files/actions/invite'
    });

    new links.ActionLink('io.ox/files/links/toolbar/share', {
        index: 200,
        id: 'getalink',
        label: gt('Get link'),
        //#. sharing: a link will be created
        description: gt('Everybody gets the same link. The link just allows to view the file or folder.'),
        ref: 'io.ox/files/actions/getalink'
    });

    // INLINE (only used by mobile toolbar atm)
    var index = 100;

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'open',
        index: index += 100,
        prio: 'lo',
        mobile: 'hi',
        label: gt('Open in browser'),
        ref: 'io.ox/files/actions/open'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'openviewer',
        index: index += 100,
        prio: 'hi',
        mobile: 'hi',
        label: gt('View'),
        ref: 'io.ox/files/actions/viewer'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'editor',
        index: index += 100,
        prio: 'hi',
        mobile: 'lo',
        label: gt('Edit'),
        ref: 'io.ox/files/actions/editor'
    }));

    // add another link for the viewer
    ext.point('io.ox/core/viewer/toolbar/links/drive').extend(new links.Link({
        id: 'editor',
        index: 100,
        prio: 'hi',
        mobile: 'lo',
        label: gt('Edit'),
        ref: 'io.ox/files/actions/editor'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'download',
        index: index += 100,
        prio: 'hi',
        mobile: 'lo',
        label: gt('Download'),
        ref: 'io.ox/files/actions/download'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'download-folder',
        prio: 'hi',
        mobile: 'lo',
        label: gt('Download'),
        ref: 'io.ox/files/actions/download-folder'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'delete',
        index: index += 100,
        prio: 'hi',
        mobile: 'lo',
        label: gt('Delete'),
        ref: 'io.ox/files/actions/delete'
    }));

    // low

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'send',
        index: index += 100,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Send by mail'),
        ref: 'io.ox/files/actions/send',
        section: 'share'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'sendlink',
        index: index += 100,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Send as internal link'),
        ref: 'io.ox/files/actions/sendlink',
        section: 'share'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'showlink',
        index: index += 100,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Show internal link'),
        ref: 'io.ox/files/actions/showlink',
        section: 'share'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'add-to-portal',
        index: index += 100,
        prio: 'lo',
        mobile: 'none',
        label: gt('Add to portal'),
        ref: 'io.ox/files/actions/add-to-portal',
        section: 'share'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'invite',
        index: index += 100,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Invite people'),
        ref: 'io.ox/files/actions/invite',
        section: 'share'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'getalink',
        index: index += 100,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Get link'),
        ref: 'io.ox/files/actions/getalink',
        section: 'share'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'rename',
        index: index += 100,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Rename'),
        ref: 'io.ox/files/actions/rename',
        section: 'edit'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'edit-description',
        index: index += 100,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Edit description'),
        ref: 'io.ox/files/actions/edit-description',
        section: 'edit'
    }));

    //ext.point('io.ox/files/links/inline').extend(new links.Link({
    //    id: 'save-as-pdf',
    //    index: index += 100,
    //    prio: 'lo',
    //    mobile: 'lo',
    //    label: gt('Save as PDF'),
    //    ref: 'io.ox/files/actions/save-as-pdf',
    //    section: 'save-as'
    //}));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'move',
        index: index += 100,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Move'),
        ref: 'io.ox/files/actions/move',
        section: 'file-op'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'copy',
        index: index += 100,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Copy'),
        ref: 'io.ox/files/actions/copy',
        section: 'file-op'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'lock',
        index: index += 100,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Lock'),
        ref: 'io.ox/files/actions/lock',
        section: 'file-op'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'unlock',
        index: index += 100,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Unlock'),
        ref: 'io.ox/files/actions/unlock',
        section: 'file-op'
    }));

    // version links

    ext.point('io.ox/files/versions/links/inline').extend(new links.Link({
        id: 'open',
        index: 100,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Open'),
        ref: 'io.ox/files/actions/open'
    }));

    ext.point('io.ox/files/versions/links/inline').extend(new links.Link({
        id: 'editor',
        index: 150,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Edit'),
        section: 'edit',
        ref: 'io.ox/files/actions/editor'
    }));

    ext.point('io.ox/files/versions/links/inline').extend(new links.Link({
        id: 'download',
        index: 200,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Download'),
        ref: 'io.ox/files/actions/downloadversion'
    }));

    ext.point('io.ox/files/versions/links/inline').extend(new links.Link({
        id: 'makeCurrent',
        index: 250,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Make this the current version'),
        ref: 'io.ox/files/versions/actions/makeCurrent'
    }));

    ext.point('io.ox/files/versions/links/inline').extend(new links.Link({
        id: 'delete',
        index: 300,
        prio: 'lo',
        mobile: 'lo',
        label: gt('Delete version'),
        ref: 'io.ox/files/versions/actions/delete',
        special: 'danger'
    }));

    // Drag and Drop

    ext.point('io.ox/files/dnd/actions').extend({
        id: 'create',
        index: 10,
        label: gt('Drop here to upload a <b class="dndignore">new file</b>'),
        multiple: function (files, app) {
            require(['io.ox/files/upload/main'], function (fileUpload) {
                fileUpload.create.offer(files, { folder: app.folder.get() });
            });
        }
    });

    ext.point('io.ox/files/dnd/actions').extend({
        id: 'newVersion',
        index: 20,
        isEnabled: function (app) {
            return !!app.currentFile;
        },
        label: function (app) {
            if (app.currentFile.filename || app.currentFile.title) {
                return gt(
                    //#. %1$s is the filename or title of the file
                    'Drop here to upload a <b class="dndignore">new version</b> of "%1$s"',
                    String(app.currentFile.filename || app.currentFile.title).replace(/</g, '&lt;')
                );
            }
            return gt('Drop here to upload a <b class="dndignore">new version</b>');
        },
        action: function (file, app) {
            require(['io.ox/files/upload/main'], function (fileUpload) {
                fileUpload.update.offer(file, { folder: app.folder.get() });
            });
        }
    });

    ext.point('io.ox/files/folderview/premium-area').extend(new links.InlineLinks({
        index: 100,
        id: 'inline-premium-links',
        ref: 'io.ox/files/links/premium-links',
        classes: 'list-unstyled'
    }));

    ext.point('io.ox/files/links/premium-links').extend(new links.Link({
        index: 100,
        prio: 'hi',
        id: 'share-files',
        label: gt('Share your folders'),
        ref: 'io.ox/files/premium/actions/synchronize'
    }));
});
