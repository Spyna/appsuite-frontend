/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2012
 * Mail: info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/files/actions',
    ['io.ox/files/api',
     'io.ox/core/extensions',
     'io.ox/core/extPatterns/links',
     'io.ox/core/extPatterns/actions',
     'io.ox/core/capabilities',
     'io.ox/core/notifications',
     'io.ox/core/util',
     'gettext!io.ox/files',
     'settings!io.ox/files'], function (api, ext, links, actionPerformer, capabilities, notifications, util, gt, settings) {

    'use strict';

    var Action = links.Action,
        ActionGroup = links.ActionGroup,
        ActionLink = links.ActionLink,
        POINT = 'io.ox/files';

    // actions

    new Action('io.ox/files/actions/switch-to-list-view', {
        requires: true,
        action: function (baton) {
            ox.ui.Perspective.show(baton.app, 'list');
        }
    });

    new Action('io.ox/files/actions/switch-to-icon-view', {
        requires: true,
        action: function (baton) {
            ox.ui.Perspective.show(baton.app, 'icons');
        }
    });

    new Action('io.ox/files/actions/upload', {
        requires: function (e) {
            return e.collection.has('create');
        },
        action: function (baton) {
            require(['io.ox/files/views/create'], function (create) {
                create.show(baton.app, {
                    uploadedFile: function (data) {
                        if ('invalidateFolder' in baton.app) {
                            baton.app.invalidateFolder(data);
                        }
                    }
                });
            });
        }
    });

    new Action('io.ox/files/actions/publish', {
        requires: 'one',
        action: function (baton) {
            require(['io.ox/core/pubsub/publications'], function (publications) {
                publications.buildPublishDialog(baton);
            });
        }
    });

    new Action('io.ox/files/actions/audioplayer', {
        requires: function (e) {
            return _.device('!android') && e.collection.has('multiple') && checkMedia(e, 'audio', true);
        },
        action: function (baton) {
            baton.app = baton.grid.getApp();
            require(['io.ox/files/mediaplayer'], function (mediaplayer) {
                mediaplayer.init({
                    baton: baton,
                    videoSupport: false
                });
            });
        }
    });

    new Action('io.ox/files/actions/videoplayer', {
        requires: function (e) {
            return _.device('!android') && e.collection.has('multiple') && checkMedia(e, 'video', true);
        },
        action: function (baton) {
            baton.app = baton.grid.getApp();
            require(['io.ox/files/mediaplayer'], function (mediaplayer) {
                mediaplayer.init({
                    baton: baton,
                    videoSupport: true
                });
            });
        }
    });

    // editor
    if (window.Blob) {

        new Action('io.ox/files/actions/editor', {
            requires: function (e) {
                return e.collection.has('one') && (/\.(txt|js|css|md|tmpl|html?)$/i).test(e.context.filename) && (e.baton.openedBy !== 'io.ox/mail/write');
            },
            action: function (baton) {
                ox.launch('io.ox/editor/main', { folder: baton.data.folder_id, id: baton.data.id });
            }
        });

        new Action('io.ox/files/actions/editor-new', {
            requires: function (e) {
                return e.baton.openedBy !== 'io.ox/mail/write';
            },
            action: function (baton) {
                ox.launch('io.ox/editor/main').done(function () {
                    this.create({ folder: baton.app.folder.get() });
                });
            }
        });
    }

    new Action('io.ox/files/actions/download', {
        requires: 'some',
        multiple: function (list) {
            // loop over list, get full file object and trigger downloads
            if (list.length === 1) {
                var o = _.first(list);
                api.get(o).done(function (file) {
                    if (o.version) {
                        file = _.extend({}, file, { version: o.version });
                    }
                    window.open(api.getUrl(file, 'download'));
                });
            } else {
                window.open(api.getUrl(list, 'zip'));
            }
        }
    });

    new Action('io.ox/files/actions/open', {
        requires: 'some',
        multiple: function (list) {
            // loop over list, get full file object and open new window
            _(list).each(function (o) {
                api.get(o).done(function (file) {
                    if (o.version) {
                        file = _.extend({}, file, { version: o.version });
                    }
                    window.open(api.getUrl(file, 'open'));
                });
            });
        }
    });

    new Action('io.ox/files/actions/sendlink', {
        capabilities: 'webmail !alone',
        requires: function (e) {
            return e.collection.has('some') && (e.baton.openedBy !== 'io.ox/mail/write');//hide in mail write preview
        },
        multiple: function (list) {
            require(['io.ox/mail/write/main'], function (m) {
                api.getList(list).done(function (list) {
                    m.getApp().launch().done(function () {
                        //generate text and html content
                        var html = [], text = [];
                        _(list).each(function (file) {
                            var url = ox.abs + ox.root + '/#!&app=io.ox/files&perspective=list&folder=' + file.folder_id + '&id=' + _.cid(file);
                            var label = gt('File: %1$s', file.filename || file.title);
                            html.push(_.escape(label) + '<br>' + gt('Direct link: %1$s', '<a data-mce-href="' + url + '" href="' + url + '">' + url + '</a>'));
                            text.push(label + '\n' + gt('Direct link: %1$s', url));
                        });
                        this.compose({ attachments: { 'text': [{ content: text.join('\n\n') }], 'html': [{ content: html.join('<br>') }] } });
                    });
                });
            });
        }
    });

    new Action('io.ox/files/actions/send', {
        capabilities: 'webmail',
        requires: function (e) {
            var list = _.getArray(e.context);
            return e.collection.has('some') && (e.baton.openedBy !== 'io.ox/mail/write') &&//hide in mail write preview
                _(list).reduce(function (memo, obj) {
                    return memo || obj.file_size > 0;
                }, false);
        },
        multiple: function (list) {
            require(['io.ox/mail/write/main'], function (m) {
                api.getList(list).done(function (list) {
                    var filtered_list = _.filter(list, function (o) { return o.file_size !== 0; });
                    if (filtered_list.length > 0) {
                        m.getApp().launch().done(function () {
                            this.compose({ infostore_ids: filtered_list });
                        });
                    }
                });
            });
        }
    });

    new Action('io.ox/files/actions/showlink', {

        requires: function (e) {
            return e.collection.has('some');
        },

        multiple: function (list) {

            api.getList(list).done(function (list) {

                // create dialog
                require(['io.ox/core/tk/dialogs'], function (dialogs) {
                    new dialogs.ModalDialog({ width: 500 })
                        .build(function () {
                            // header
                            this.header($('<h4>').text('Direct link'));
                            // content
                            this.getContentNode().addClass('user-select-text max-height-200').append(

                                _(list).map(function (file) {

                                    var url = ox.abs + ox.root +
                                        '/#!&app=io.ox/files&perspective=list' +
                                        '&folder=' + encodeURIComponent(file.folder_id) +
                                        '&id=' + encodeURIComponent(file.folder_id) + '.' + encodeURIComponent(file.id);

                                    return $('<p>').append(
                                        $('<div>').text(file.filename || file.title || ''),
                                        $('<div>').append(
                                            $('<a class="direct-link" target="_blank">')
                                            .attr('href', url)
                                            .html(util.breakableHTML(url))
                                        )
                                    );
                                })
                            );
                        })
                        .addPrimaryButton('cancel', gt('Close'))
                        .show();
                });
            });
        }
    });

    new Action('io.ox/files/actions/delete', {
        requires: function (e) {
            return e.collection.has('some') && isUnLocked(e) && (e.baton.openedBy !== 'io.ox/mail/write');//hide in mail write preview
        },
        multiple: function (list) {

            var question = gt.ngettext(
                    'Do you really want to delete this file?',
                    'Do you really want to delete these files?',
                    list.length
            ),
            responseSuccess = gt.ngettext(
                    'This file has been deleted',
                    'These files have been deleted',
                    list.length
            ),
            responseFail = gt.ngettext(
                    'This file has not been deleted',
                    'These files have not been deleted',
                    list.length
            ),
            responseFailLocked = gt.ngettext(
                    'This file has not been deleted, as it is locked by its owner.',
                    'These files have not been deleted, as they are locked by their owner.',
                    list.length
            );

            require(['io.ox/core/tk/dialogs'], function (dialogs) {
                new dialogs.ModalDialog()
                    .text(question)
                    .addPrimaryButton('delete', gt('Delete'))
                    .addButton('cancel', gt('Cancel'))
                    .show()
                    .done(function (action) {
                        if (action === 'delete') {
                            api.remove(list).done(function (data) {
                                api.propagate('delete', list[0]);
                                notifications.yell('success', responseSuccess);
                            }).fail(function (e) {
                                if (e && e.code && e.code === 'IFO-0415') {
                                    notifications.yell('error', responseFailLocked);
                                } else {
                                    notifications.yell('error', responseFail);
                                }
                            });
                        }
                    });
            });
        }
    });

    var isUnLocked = function (e) {
        var list = _.getArray(e.context);
        return _(list).reduce(function (memo, obj) {
            return memo || !api.tracker.isLockedByOthers(obj);
        }, false);
    };

    new Action('io.ox/files/actions/lock', {
        requires: function (e) {
            var list = _.getArray(e.context);
            return e.collection.has('some') && (e.baton.openedBy !== 'io.ox/mail/write') &&//hide in mail write preview
                _(list).reduce(function (memo, obj) {
                    return memo || !api.tracker.isLocked(obj);
                }, false);
        },
        multiple: function (list) {
            var responseSuccess = gt.ngettext(
                    'This file has been locked',
                    'These files have been locked',
                    list.length
            ),
            responseFail = gt.ngettext(
                    'This file has not been locked',
                    'These files have not been locked',
                    list.length
            );

            api.lock(list).done(function (data) {
                notifications.yell('success', responseSuccess);
            }).fail(function () {
                notifications.yell('error', responseFail);
            });
        }
    });

    new Action('io.ox/files/actions/unlock', {
        requires: function (e) {
            var list = _.getArray(e.context);
            return e.collection.has('some') && (e.baton.openedBy !== 'io.ox/mail/write') &&//hide in mail write preview
                _(list).reduce(function (memo, obj) {
                    return memo || api.tracker.isLockedByMe(obj);
                }, false);
        },
        multiple: function (list) {
            var responseSuccess = gt.ngettext(
                    'This file has been unlocked',
                    'These files have been unlocked',
                    list.length
            ),
            responseFail = gt.ngettext(
                    'This file has not been unlocked',
                    'These files have not been unlocked',
                    list.length
            );

            api.unlock(list).done(function (data) {
                notifications.yell('success', responseSuccess);
            }).fail(function () {
                notifications.yell('error', responseFail);
            });
        }
    });


    new Action('io.ox/files/actions/rename', {
        requires: function (e) {
            return e.collection.has('one') && isUnLocked(e) && (e.baton.openedBy !== 'io.ox/mail/write');//hide in mail write preview
        },
        action: function (baton) {
            require(['io.ox/core/tk/dialogs'], function (dialogs) {
                var $input = $('<input type="text" name="name" class="span12">'),
                    dialog = null;

                /**
                 * @return {promise}
                 */
                function fnRename() {
                    var name = $input.val(),
                        update = {
                            id: baton.data.id,
                            folder_id: baton.data.folder_id
                        };
                    //'title only' entries
                    if (!baton.data.filename && baton.data.title) {
                        update.title = name;
                    } else {
                        update.filename = name;
                    }

                    return api.update(update).fail(require('io.ox/core/notifications').yell);
                }

                /**
                 * user have to confirm if name doesn't contains a file extension
                 * @return {promise}
                 */
                function process() {
                    require(['io.ox/files/util'], function (util) {
                        util.confirmDialog($input.val(), baton.data.filename || baton.data.title)
                            .then(function () {
                                return fnRename();
                            }, function () {
                                //store user input and call action again
                                baton.data.filename_tmp = $input.val();
                                actionPerformer.invoke('io.ox/files/actions/rename', null, baton);
                            });
                    });
                }

                $input.val(baton.data.filename_tmp || baton.data.filename || baton.data.title);
                delete baton.data.filename_tmp;
                var $form = $('<form>')
                    .css('margin', '0 0 0 0')
                    .append(
                        $('<div class="row-fluid">').append(
                            $input
                        )
                    );

                //'enter'
                $form.on('submit', function (e) {
                    e.preventDefault();
                    process();
                    dialog.close();
                });

                dialog = new dialogs.ModalDialog()
                    .header($('<h4>').text(gt('Rename')))
                    .append(
                        $form
                    )
                    .addPrimaryButton('rename', gt('Rename'))
                    .addButton('cancel', gt('Cancel'));

                dialog.show(function () {
                    $input.get()[0].setSelectionRange(0, $input.val().lastIndexOf('.'));
                    $input.on('keydown', function (e) {
                        if ((e.keyCode || e.which) === 13) {
                            e.preventDefault();
                            process();
                            dialog.close();
                        }
                    });
                })
                .done(function (action) {
                    if (action === 'rename') {
                        process();
                    }
                });
            });
        }
    });

    new Action('io.ox/files/actions/edit-description', {
        requires: function (e) {
            return e.collection.has('one') && isUnLocked(e) && (e.baton.openedBy !== 'io.ox/mail/write');//hide in mail write preview
        },
        action: function (baton) {
            require(['io.ox/core/tk/dialogs', 'io.ox/core/tk/keys'], function (dialogs, KeyListener) {
                var keys = new KeyListener($input),
                    dialog = new dialogs.ModalDialog(),
                    $input = $('<textarea rows="10"></textarea>')
                            .css({width: '507px'})
                            .val(baton.data.description),
                    $form = $('<form>')
                            .css('margin', '0 0 0 0')
                            .append(
                                $input
                            );

                function fnSave() {

                    var description = $input.val();
                    var update = {
                        id: baton.data.id,
                        folder_id: baton.data.folder_id,
                        description: description
                    };

                    return api.update(update).fail(require('io.ox/core/notifications').yell);
                }

                keys.on('shift+enter', function () {
                    dialog.busy();
                    fnSave().done(function () {
                        dialog.close();
                    });
                });

                dialog
                .header($('<h4>').text(gt('Description')))
                .append(
                    $form
                )
                .addPrimaryButton('save', gt('Save'))
                .addButton('cancel', gt('Cancel'))
                .show(function () {
                    $input.select();
                    keys.include();
                })
                .done(function (action) {
                    if (action === 'save') {
                        fnSave();
                    }
                });
            });
        }
    });


    function moveAndCopy(type, label, success) {
        new Action('io.ox/files/actions/' + type, {
            id: type,
            requires:  function (e) {
                return e.collection.has('some') && (e.baton.openedBy !== 'io.ox/mail/write') && (type === 'move' ? e.collection.has('delete') && isUnLocked(e) : e.collection.has('read'));
            },
            multiple: function (list, baton) {

                var vGrid = baton.grid || (baton.app && baton.app.getGrid());

                console.log('move ...', type);

                require(['io.ox/core/tk/dialogs', 'io.ox/core/tk/folderviews', 'io.ox/core/api/folder'], function (dialogs, views, folderAPI) {

                    function commit(target) {
                        if (type === "move" && vGrid) vGrid.busy();
                        api[type](list, target).then(
                            function (errors) {
                                if (errors.length > 0) {
                                    notifications.yell('error', errors[0].error);//show only the first one, to prevent notification stacking
                                } else {
                                    notifications.yell('success', success);
                                }
                                folderAPI.reload(target, list);
                                if (type === "move" && vGrid) vGrid.idle();
                            },
                            notifications.yell
                        );
                    }

                    if (baton.target) {
                        commit(baton.target);
                    } else {
                        var dialog = new dialogs.ModalDialog()
                            .header($('<h4>').text(label))
                            .addPrimaryButton("ok", label)
                            .addButton("cancel", gt("Cancel"));
                        dialog.getBody().css({ height: '250px' });
                        var folderId = String(list[0].folder_id),
                            id = settings.get('folderpopup/last') || folderId,
                            tree = new views.FolderTree(dialog.getBody(), {
                                type: 'infostore',
                                rootFolderId: '9',
                                open: settings.get('folderpopup/open', []),
                                tabindex: 0,
                                toggle: function (open) {
                                    settings.set('folderpopup/open', open).save();
                                },
                                select: function (id) {
                                    settings.set('folderpopup/last', id).save();
                                }
                            });
                        console.log('move #2...', folderId, id, tree);
                        dialog.show(function () {
                            console.log('huhu');
                            tree.paint().done(function () {
                                console.log('huhu > DONE');
                                tree.select(id).done(function () {
                                    dialog.getBody().focus();
                                });
                            });
                        })
                        .done(function (action) {
                            if (action === 'ok') {
                                var target = _(tree.selection.get()).first();
                                if (target && target !== folderId) {
                                    commit(target);
                                }
                            }
                            tree.destroy().done(function () {
                                tree = dialog = null;
                            });
                        });
                    }
                });
            }
        });
    }

    moveAndCopy('move', gt('Move'), gt('Files have been moved'));
    moveAndCopy('copy', gt('Copy'), gt('Files have been copied'));

    new Action('io.ox/files/actions/add-to-portal', {
        capabilities: 'portal',
        require: 'one',
        action: function (baton) {
            require(['io.ox/portal/widgets'], function (widgets) {
                widgets.add('stickyfile', {
                    plugin: 'files',
                    props: {
                        id: baton.data.id,
                        folder_id: baton.data.folder_id,
                        title: baton.data.filename || baton.data.title
                    }
                });
                notifications.yell('success', gt('This file has been added to the portal'));
            });
        }
    });

    // version specific actions

    new Action('io.ox/files/versions/actions/makeCurrent', {
        requires: function (e) {
            return !e.context.current_version && (e.baton.openedBy !== 'io.ox/mail/write');//hide in mail write preview
        },
        action: function (baton) {
            var data = baton.data;
            api.update({
                id: data.id,
                last_modified: data.last_modified,
                version: data.version
            }, true);
        }
    });

    new Action('io.ox/files/versions/actions/delete', {
        requires: function (e) {
            return e.baton.openedBy !== 'io.ox/mail/write';//hide in mail write preview
        },
        action: function (baton) {
            var data = baton.data;
            require(['io.ox/core/tk/dialogs'], function (dialogs) {
                // get proper question
                var question = gt.ngettext(
                        'Do you really want to delete this file?',
                        'Do you really want to delete these files?',
                        _.isArray(data) ? data.length : 1
                );
                // ask
                new dialogs.ModalDialog()
                    .text(question)
                    .addPrimaryButton('delete', gt('Delete'))
                    .addButton('cancel', gt('Cancel'))
                    .show()
                    .done(function (action) {
                        if (action === 'delete') {
                            api.detach(data);
                        }
                    });
            });
        }
    });

    // groups

    new ActionGroup(POINT + '/links/toolbar', {
        id: 'default',
        index: 100,
        icon: function () {
            return $('<i class="icon-plus accent-color">');
        }
    });

    new ActionLink(POINT + '/links/toolbar/default', {
        index: 100,
        id: 'upload',
        label: gt('Upload new file'),
        ref: POINT + '/actions/upload'
    });

    new ActionLink(POINT + '/links/toolbar/default', {
        index: 200,
        id: 'note',
        label:
            //#. Please translate like "take a note", "Notiz" in German, for example.
            //#. more like "to notice" than "to notify".
            gt('Add note'),
        ref: POINT + '/actions/editor-new'
    });

    // VIEWS

    new ActionGroup(POINT + '/links/toolbar', {
        id: 'view',
        index: 400,
        icon: function () {
            return $('<i class="icon-eye-open">').attr('aria-label', gt('Change View'));
        }
    });

    new ActionLink(POINT + '/links/toolbar/view', {
        id: 'icons',
        index: 100,
        label: gt('Icons'),
        ref: 'io.ox/files/actions/switch-to-icon-view'
    });

    new ActionLink(POINT + '/links/toolbar/view', {
        id: 'list',
        index: 200,
        label: gt('List'),
        ref: 'io.ox/files/actions/switch-to-list-view'
    });

    // PUBLISH

    // disabled until we have full pub/sub support
    // new ActionGroup(POINT + '/links/toolbar', {
    //     id: 'publish',
    //     index: 150,
    //     label: gt('Publish'),
    //     icon: function () {
    //         return $('<i class="icon-rss">');
    //     }
    // });

    // new ActionLink(POINT + '/links/toolbar/publish', {
    //     id: 'publish',
    //     label: gt('Publish current folder'),
    //     ref: 'io.ox/files/actions/publish'
    // });

    // INLINE

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'editor',
        index: 150,
        prio: 'hi',
        label: gt('Edit'),
        ref: 'io.ox/files/actions/editor'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'open',
        index: 100,
        prio: 'hi',
        label: gt('Open'),
        ref: 'io.ox/files/actions/open'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'download',
        index: 200,
        prio: 'hi',
        label: gt('Download'),
        ref: 'io.ox/files/actions/download'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'sendlink',
        index: 300,
        label: gt('Send as link'),
        ref: 'io.ox/files/actions/sendlink'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'send',
        index: 400,
        label: gt('Send by mail'),
        ref: 'io.ox/files/actions/send'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'publish',
        index: 500,
        prio: 'lo',
        label: gt('Publish'),
        ref: 'io.ox/files/actions/publish'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'showlink',
        index: 600,
        label: gt('Show link'),
        ref: 'io.ox/files/actions/showlink'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'rename',
        index: 700,
        label: gt('Rename'),
        ref: 'io.ox/files/actions/rename'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'edit-description',
        index: 800,
        label: gt('Edit description'),
        ref: 'io.ox/files/actions/edit-description'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'move',
        index: 900,
        label: gt('Move'),
        ref: 'io.ox/files/actions/move'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'copy',
        index: 1000,
        label: gt('Copy'),
        ref: 'io.ox/files/actions/copy'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'delete',
        index: 1100,
        prio: 'hi',
        label: gt('Delete'),
        ref: 'io.ox/files/actions/delete'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'lock',
        index: 820,
        prio: 'lo',
        label: gt('Lock'),
        ref: 'io.ox/files/actions/lock'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'unlock',
        index: 850,
        prio: 'hi',
        label: gt('Unlock'),
        ref: 'io.ox/files/actions/unlock'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        id: 'add-to-portal',
        index: 1200,
        prio: 'lo',
        label: gt('Add to portal'),
        ref: 'io.ox/files/actions/add-to-portal'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        index: 2000,
        id: 'mediaplayer-audio',
        label: gt('Play audio files'),
        ref: 'io.ox/files/actions/audioplayer'
    }));

    ext.point('io.ox/files/links/inline').extend(new links.Link({
        index: 2100,
        id: 'mediaplayer-video',
        label: gt('Play video files'),
        ref: 'io.ox/files/actions/videoplayer'
    }));
    // version links


    ext.point('io.ox/files/versions/links/inline').extend(new links.Link({
        id: 'open',
        index: 100,
        label: gt('Open'),
        ref: 'io.ox/files/actions/open'
    }));

    ext.point('io.ox/files/versions/links/inline').extend(new links.Link({
        id: 'download',
        index: 200,
        label: gt('Download'),
        ref: 'io.ox/files/actions/download'
    }));

    ext.point('io.ox/files/versions/links/inline').extend(new links.Link({
        id: 'makeCurrent',
        index: 250,
        label: gt('Make this the current version'),
        ref: 'io.ox/files/versions/actions/makeCurrent'
    }));

    ext.point('io.ox/files/versions/links/inline').extend(new links.Link({
        id: 'delete',
        index: 300,
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
            app.queues.create.offer(files);
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
            } else {
                return gt('Drop here to upload a <b class="dndignore">new version</b>');
            }
        },
        action: function (file, app) {
            app.queues.update.offer(file);
        }
    });

    // Iconview Inline Links

    new Action('io.ox/files/icons/slideshow', {
        requires: function (e) {
            return _(e.baton.allIds).reduce(function (memo, obj) {
                return memo || (/\.(gif|bmp|tiff|jpe?g|gmp|png)$/i).test(obj.filename);
            }, false);
        },
        action: function (baton) {
            require(['io.ox/files/carousel'], function (carousel) {
                carousel.init({
                    fullScreen: false,
                    baton: baton,
                    attachmentMode: false
                });
            });
        }
    });

    new Action('io.ox/files/icons/slideshow-fullscreen', {
        requires: function (e) {
            return BigScreen.enabled && _(e.baton.allIds).reduce(function (memo, obj) {
                return memo || (/\.(gif|bmp|tiff|jpe?g|gmp|png)$/i).test(obj.filename);
            }, false);
        },
        action: function (baton) {
            BigScreen.request($('.io-ox-files-main .carousel')[0]);
            require(['io.ox/files/carousel'], function (carousel) {
                carousel.init({
                    fullScreen: true,
                    baton: baton,
                    attachmentMode: false
                });
            });
        }
    });

    function checkMedia(e, type, fromSelection) {
        if (!e.collection.has('multiple') && !settings.get(type + 'Enabled')) {
            return false;
        }
        if (_.isUndefined(e.baton.allIds)) {
            e.baton.allIds = e.baton.data;
        }
        if (fromSelection) {
            return api.getList(e.baton.allIds).then(function (data) {
                e.baton.allIds = data;
                return _(data).reduce(function (memo, obj) {
                    return memo || api.checkMediaFile(type, obj.filename);
                }, false);
            });
        } else {
            return _(e.baton.allIds).reduce(function (memo, obj) {
                return memo || api.checkMediaFile(type, obj.filename);
            }, false);
        }
    }

    new Action('io.ox/files/icons/audioplayer', {
        requires: function (e) {
            return _.device('!android') && checkMedia(e, 'audio');
        },
        action: function (baton) {
            require(['io.ox/files/mediaplayer'], function (mediaplayer) {
                mediaplayer.init({
                    baton: baton,
                    videoSupport: false
                });
            });
        }
    });

    new Action('io.ox/files/icons/videoplayer', {
        requires: function (e) {
            return _.device('!android') && checkMedia(e, 'video');
        },
        action: function (baton) {
            require(['io.ox/files/mediaplayer'], function (mediaplayer) {
                mediaplayer.init({
                    baton: baton,
                    videoSupport: true
                });
            });
        }
    });

    ext.point('io.ox/files/icons/actions').extend(new links.InlineLinks({
        index: 100,
        id: 'inline-links',
        ref: 'io.ox/files/icons/inline'
    }));

    ext.point('io.ox/files/icons/inline').extend(new links.Link({
        index: 100,
        prio: 'hi',
        id: 'slideshow',
        label: gt('View Slideshow'),
        ref: 'io.ox/files/icons/slideshow'
    }));

    ext.point('io.ox/files/icons/inline').extend(new links.Link({
        index: 200,
        prio: 'hi',
        cssClasses: 'io-ox-action-link fullscreen',
        id: 'slideshow-fullscreen',
        label: gt('Fullscreen'),
        ref: 'io.ox/files/icons/slideshow-fullscreen'
    }));


    ext.point('io.ox/files/icons/inline').extend(new links.Link({
        index: 300,
        id: 'mediaplayer-audio',
        label: gt('Play audio files'),
        ref: 'io.ox/files/icons/audioplayer'
    }));

    ext.point('io.ox/files/icons/inline').extend(new links.Link({
        index: 400,
        id: 'mediaplayer-video',
        label: gt('Play video files'),
        ref: 'io.ox/files/icons/videoplayer'
    }));
});
