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

define('io.ox/core/folder/extensions', [
    'io.ox/core/folder/node',
    'io.ox/core/folder/api',
    'io.ox/core/api/account',
    'io.ox/core/extensions',
    'io.ox/core/capabilities',
    'io.ox/contacts/util',
    'io.ox/core/api/user',
    'io.ox/mail/api',
    'gettext!io.ox/core',
    'io.ox/core/folder/folder-color',
    'io.ox/backbone/mini-views/upsell',
    'io.ox/core/folder/blacklist',
    'settings!io.ox/core',
    'settings!io.ox/mail',
    'io.ox/core/http',
    'io.ox/core/folder/favorites'
], function (TreeNodeView, api, account, ext, capabilities, contactUtil, userAPI, mailAPI, gt, color, UpsellView, blacklist, settings, mailSettings, http) {

    'use strict';

    var INBOX = 'default0' + mailAPI.separator + 'INBOX';

    if (capabilities.has('webmail')) {
        // define virtual/standard
        api.virtual.add('virtual/standard', function () {
            http.pause();
            var list = [
                    // inbox
                    api.get(INBOX),
                    // sent, drafts, spam, trash, archive
                    // default0 is alternative for IMAP server that list standard folders below INBOX
                    api.list('default0')
                ],
                defaultFolders = mailSettings.get('defaultFolder') || {};
            // append all-unssen below INBOX
            if (mailSettings.get('features/unseenFolder', false)) list.push(api.get('virtual/all-unseen'));
            // sent, drafts, spam, trash, archive
            _(account.getTypes()).each(function (type, folder) {
                if (type === 'inbox') return;
                if (!account.isPrimary(folder)) return;
                // non-default and undefined folders are skipped
                if (!defaultFolders[type]) return;
                if (type === 'archive' && !capabilities.has('archive_emails')) return;
                list.push(api.get(folder));
            });
            http.resume();
            return this.concat.apply(this, list);
        });

        // myfolders
        api.virtual.add('virtual/myfolders', function () {
            var id = api.altnamespace ? 'default0' : INBOX;
            return api.list(id).then(function (list) {
                return _(list).filter(function (data) {
                    if (data.id.indexOf('default0/External accounts') === 0) return false;
                    if (account.isStandardFolder(data.id)) return false;
                    if (api.is('public|shared', data)) return false;
                    return true;
                });
            });
        });

        api.on('after:rename', function (id, data) {
            if (data.folder_id !== INBOX) return;
            api.virtual.reload('virtual/myfolders');
        });

        // remote folders
        api.virtual.add('virtual/remote', function () {
            // use the setting for dsc here in if-else, also consider altnamespace
            var dsc = mailSettings.get('dsc/enabled', false),
                id = mailSettings.get('dsc/folder');
            // smart cache environment
            if (dsc) {
                if (account.hasDSCAccount()) {
                    return account.getStatus().then(function (status) {
                        //remove main account
                        delete status['0'];

                        // only request if status is at least for one dsc account ok
                        if (_(status).any(function (account) { return account.status === 'ok'; })) {
                            return api.list(id);
                        }
                        return [];
                    });

                }
                // no account yet, return empty array
                return $.Deferred().resolve([]);
            }
            // standard environment
            return api.list('1').then(function (list) {
                return _(list).filter(function (data) {
                    return account.isExternal(data.id);
                });
            });

        });
    }

    // TODO: right capability
    if (capabilities.has('filestore')) {
        api.virtual.add('virtual/filestorage', function () {
            return api.list('1').then(function (list) {
                return _(list).filter(function (data) {
                    return api.isExternalFileStorage(data);
                });
            });
        });
    }

    function getMyFilesFolder() {
        var id = settings.get('folder/infostore');
        return id ? api.get(id) : null;
    }

    function getMySharesFolder() {

        if (capabilities.has('guest')) return;
        if (!capabilities.has('gab || share_links')) return;

        return $.when({
            id: 'virtual/myshares',
            folder_id: '9',
            module: 'infostore',
            own_rights: 403710016, // all rights but admin
            permissions: [{ bits: 403710016, entity: ox.user_id, group: false }],
            standard_folder: true,
            supported_capabilities: [],
            title: gt('My shares')
        });
    }

    var attachmentView = settings.get('folder/mailattachments', {});

    if (attachmentView.all) blacklist.add(attachmentView.all);

    function getAllAttachmentsFolder() {
        var id = attachmentView.all;
        return id ? api.get(id) : null;
    }

    function getTrashFolder() {
        return api.list('9').then(function (list) {
            return _(list).filter(function (data) {
                return api.is('trash', data);
            });
        });
    }

    if (capabilities.has('infostore')) {
        api.virtual.add('virtual/drive/private', function () {
            return this.concat(getMyFilesFolder(), getMySharesFolder(), getAllAttachmentsFolder(), getTrashFolder());
        });
        api.virtual.add('virtual/drive/private-without-myshares', function () {
            return this.concat(getMyFilesFolder(), getAllAttachmentsFolder(), getTrashFolder());
        });
        api.virtual.add('virtual/drive/public', function () {
            return api.list('9').then(function (list) {
                return _(list).filter(function (data) {
                    if (String(data.id) === String(settings.get('folder/infostore'))) return false;
                    if (api.is('trash', data)) return false;
                    if (api.isExternalFileStorage(data)) return false;
                    return true;
                });
            });
        });
    }

    var extensions = {

        unifiedFolders: function (tree) {
            this.append(
                // standard folders
                new TreeNodeView({
                    empty: false,
                    filter: function (id, model) {
                        // we check for ^default to make sure we only consider mail folders
                        return /^default/.test(model.id) && account.isUnified(model.id);
                    },
                    folder: '1',
                    headless: true,
                    open: true,
                    tree: tree,
                    parent: tree
                })
                .render().$el.addClass('unified-folders')
            );
        },

        standardFolders: function (tree) {
            var view = new TreeNodeView({
                filter: function (id, model) {
                    // do not filter unseen messages folder if enabled
                    if (model.id === 'virtual/all-unseen' && mailSettings.get('unseenMessagesFolder')) return true;
                    return account.isStandardFolder(model.id);
                },
                folder: 'virtual/standard',
                headless: true,
                open: true,
                tree: tree,
                parent: tree
            });
            this.append(
                view.render().$el.addClass('standard-folders')
            );
            // show / hide folder on setting change
            view.listenTo(mailSettings, 'change:unseenMessagesFolder', function () {
                view.onReset();
            });
        },

        localFolders: function (tree) {

            var defaultId = api.altnamespace ? 'default0' : INBOX;

            var node = new TreeNodeView({
                filter: function (id, model) {
                    // filtering for DSC folders
                    if (account.isDSC(model.id)) {
                        return false;
                    }
                    return true;
                },
                contextmenu: 'myfolders',
                // always show the folder for altnamespace
                // otherwise the user cannot create folders
                empty: !!api.altnamespace,
                // convention! virtual folders are identified by their id starting with "virtual"
                folder: 'virtual/myfolders',
                icons: tree.options.icons,
                contextmenu_id: defaultId,
                parent: tree,
                title: gt('My folders'),
                tree: tree
            });

            // open "My folders" whenever a folder is added to INBOX/root
            api.on('create:' + defaultId, function () {
                node.toggle(true);
            });

            this.append(node.render().$el);
        },

        remoteAccounts: function (tree) {
            this.append(
                new TreeNodeView({
                    folder: 'virtual/remote',
                    headless: true,
                    open: true,
                    icons: tree.options.icons,
                    tree: tree,
                    parent: tree,
                    isRemote: true
                })
                .render().$el.addClass('remote-folders')
            );
        },

        remoteSingleAccount: function (tree) {
            var self = this;
            api.get(tree.options.folderBase).done(function (folderObj) {
                self.append(
                    new TreeNodeView({
                        folder: folderObj.folder_id,
                        headless: false,
                        open: true,
                        icons: tree.options.icons,
                        tree: tree,
                        parent: tree,
                        isRemote: true
                    })
                    .render().$el.addClass('remote-folders')
                );
            });
        },

        fileStorageAccounts: function (tree) {
            this.append(
                new TreeNodeView({
                    //empty: false,
                    folder: 'virtual/filestorage',
                    headless: true,
                    open: true,
                    icons: tree.options.icons,
                    tree: tree,
                    parent: tree
                })
                .render().$el.addClass('filestorage-folders')
            );
        },

        addStorageAccount: (function () {
            if (_.device('smartphone')) return $.noop;

            var links = $('<div class="links">');

            function getAvailableServices() {
                var services = ['google', 'dropbox', 'boxcom', 'msliveconnect'];

                return require(['io.ox/core/api/filestorage']).then(function (filestorageApi) {
                    var availableFilestorageServices = filestorageApi.rampup().then(function () {
                        return _(filestorageApi.isStorageAvailable()).map(function (service) { return service.match(/\w*?$/)[0]; });
                    });

                    return $.when(require(['io.ox/keychain/api']), availableFilestorageServices);
                }).then(function (keychainApi, availableFilestorageServices) {
                    return _(keychainApi.submodules).filter(function (submodule) {
                        if (services.indexOf(submodule.id) < 0) return false;
                        // we need support for both accounts, Oauth accounts and filestorage accounts.
                        return (!submodule.canAdd || submodule.canAdd.apply(this)) && availableFilestorageServices.indexOf(submodule.id) >= 0;
                    });
                });
            }

            function draw() {
                getAvailableServices().done(function (services) {
                    if (services.length > 0) {
                        links.empty().show().append(
                            $('<a href="#" data-action="add-storage-account" role="button">')
                            .text(gt('Add storage account'))
                            .on('click', function (e) {
                                e.preventDefault();
                                require(['io.ox/files/actions/add-storage-account'], function (addStorageAccount) {
                                    addStorageAccount();
                                });
                            })
                        );
                    } else {
                        links.hide();
                    }
                });
            }

            return function () {
                this.append(links);

                require(['io.ox/core/api/filestorage'], function (filestorageApi) {
                    // remove old listeners
                    filestorageApi.off('create delete update', draw);
                    // append new listeners and draw immediatly
                    filestorageApi.on('create delete update', draw);
                    draw();
                });
            };
        })(),

        addRemoteAccount: function () {
            if (!capabilities.has('multiple_mail_accounts')) return;

            this.append(
                $('<div class="links">').append(
                    $('<a href="#" data-action="add-mail-account" role="button">')
                    .text(gt('Add mail account'))
                    .on('click', function (e) {
                        e.preventDefault();
                        require(['io.ox/mail/accounts/settings'], function (m) {
                            m.mailAutoconfigDialog(e);
                        });
                    })
                )
            );
        },

        subscribe: function (baton) {
            var title;
            if (baton.module === 'contacts') title = gt('Subscribe address book');
            else if (baton.module === 'calendar') title = gt('Subscribe calendar');
            this.append($('<div>').append(
                    $('<a href="#" data-action="subscribe-address-book" role="button">')
                    .text(title)
                    .on('click', function (e) {
                        e.preventDefault();
                        if (capabilities.has('subscription')) {
                            require(['io.ox/core/sub/subscriptions'], function (subscriptions) {
                                subscriptions.buildSubscribeDialog({
                                    module: baton.module,
                                    app: baton.view.app
                                });
                            });
                        } else {
                            require(['io.ox/core/upsell'], function (upsell) {
                                if (upsell.enabled(['subscription'])) {
                                    upsell.trigger({
                                        type: 'inline-action',
                                        id: 'io.ox/core/foldertree/contextmenu/default/subscribe',
                                        missing: upsell.missing(['subscription'])
                                    });
                                }
                            });
                        }
                    })
                )
            );
        },

        allAttachments: function () {
            if (!attachmentView.all) return;
            this.append(
                $('<div class="links">').append(
                    $('<a href="#" data-action="all-attachments" role="button">')
                    .text(gt('View all attachments'))
                    .on('click', function (e) {
                        e.preventDefault();
                        ox.launch('io.ox/files/main', { folder: attachmentView.all }).done(function () {
                            this.folder.set(attachmentView.all);
                        });
                    })
                )
            );
        },

        synchronizeAccount: function () {
            this.append(new UpsellView({
                id: 'folderview/mail',
                className: 'links',
                requires: 'active_sync',
                title: gt('Synchronize with your tablet or smartphone')
            }).render().$el);
        },

        otherFolders: function (tree) {
            this.append(
                new TreeNodeView({
                    //empty: false,
                    filter: function (id, model) {
                        // exclude standard folder
                        if (account.isStandardFolder(model.id)) return false;
                        // 'default0/virtual' is dovecot's special "all" folder
                        if (model.id === 'default0/virtual') return false;
                        // alt namespace only allows public/shared folder here
                        return api.altnamespace ? api.is('public|shared', model.toJSON()) : true;
                    },
                    folder: 'default0',
                    headless: true,
                    open: true,
                    icons: tree.options.icons,
                    tree: tree,
                    parent: tree
                })
                .render().$el.addClass('other-folders')
            );
        },

        myContactData: function () {
            // check if users can edit their own data (see bug 34617)
            if (settings.get('user/internalUserEdit', true) === false) return;

            this.append($('<div>').append(
                    $('<a href="#" data-action="my-contact-data" role="button">')
                    .text(gt('My contact data'))
                    .on('click', function (e) {
                        e.preventDefault();
                        require(['io.ox/core/settings/user'], function (userSettings) {
                            userSettings.openModalDialog();
                        });
                    })
                )
            );
        },

        rootFolders: function (tree) {
            var options = {
                folder: tree.root,
                headless: true,
                open: true,
                tree: tree,
                parent: tree
            };

            if (tree.options.hideTrashfolder) {
                options.filter = function (id, model) {
                    //exclude trashfolder
                    return !api.is('trash', model.attributes);
                };
            }

            // TODO: disable when only one account
            if (tree.module === 'infostore') {
                var previous = options.filter;
                options.filter = function (id, model) {
                    // get response of previously defined filter function
                    var unfiltered = (previous ? previous.apply(this, arguments) : true);
                    // exclude external accounts
                    return unfiltered && !api.isExternalFileStorage(model);
                };
            }
            this.append(
                new TreeNodeView(options).render().$el.addClass('root-folders')
            );
        },

        privateDriveFolders: function (tree) {
            this.append(
                new TreeNodeView({
                    //empty: false,
                    folder: 'virtual/drive/private',
                    headless: true,
                    open: true,
                    icons: tree.options.icons,
                    tree: tree,
                    parent: tree
                })
                .render().$el.addClass('private-drive-folders')
            );
        },

        privateDriveFoldersWithoutMyShares: function (tree) {
            this.append(
                new TreeNodeView({
                    //empty: false,
                    folder: 'virtual/drive/private-without-myshares',
                    headless: true,
                    open: true,
                    icons: tree.options.icons,
                    tree: tree,
                    parent: tree
                })
                .render().$el.addClass('private-drive-folders')
            );
        },

        publicDriveFolders: function (tree) {
            this.append(
                new TreeNodeView({
                    //empty: false,
                    folder: 'virtual/drive/public',
                    headless: true,
                    open: true,
                    icons: tree.options.icons,
                    tree: tree,
                    parent: tree
                })
                .render().$el.addClass('public-drive-folders')
            );
        }
    };

    var INDEX = 100;

    //
    // Mail
    //

    ext.point('io.ox/core/foldertree/mail/app').extend(
        {
            id: 'unified-folders',
            index: INDEX += 100,
            draw: extensions.unifiedFolders
        },
        {
            id: 'standard-folders',
            index: INDEX += 100,
            draw: extensions.standardFolders
        },
        {
            id: 'local-folders',
            index: INDEX += 100,
            draw: extensions.localFolders
        },
        {
            id: 'other',
            index: INDEX += 100,
            draw: extensions.otherFolders
        },
        {
            id: 'all-attachments',
            index: INDEX += 100,
            draw: extensions.allAttachments
        },
        {
            id: 'remote-accounts',
            index: INDEX += 100,
            draw: extensions.remoteAccounts
        },
        {
            id: 'add-account',
            index: INDEX += 100,
            draw: extensions.addRemoteAccount
        },
        {
            id: 'upsell-mail',
            index: INDEX += 100,
            draw: extensions.synchronizeAccount
        }
    );

    ext.point('io.ox/core/foldertree/mail/popup').extend(
        {
            id: 'standard-folders',
            draw: extensions.standardFolders
        },
        {
            id: 'local-folders',
            draw: extensions.localFolders
        },
        {
            id: 'other',
            draw: extensions.otherFolders
        },
        {
            id: 'remote-accounts',
            draw: extensions.remoteAccounts
        }
    );

    ext.point('io.ox/core/foldertree/mail/dsc').extend(
        {
            id: 'remote-accounts',
            draw: extensions.remoteSingleAccount
        }
    );

    // looks identical to popup but has no favorites
    ext.point('io.ox/core/foldertree/mail/subscribe').extend(
        {
            id: 'root-folders',
            draw: extensions.rootFolders
        }
    );

    ext.point('io.ox/core/foldertree/mail/account').extend(
        {
            id: 'root-folders',
            draw: extensions.rootFolders
        }
    );

    ext.point('io.ox/core/foldertree/mail/filter').extend(
        {
            id: 'standard-folders',
            draw: extensions.standardFolders
        },
        {
            id: 'local-folders',
            draw: extensions.localFolders
        },
        {
            id: 'other',
            draw: extensions.otherFolders
        }
    );

    //
    // Files / Drive
    //

    ext.point('io.ox/core/foldertree/infostore/app').extend(
        {
            id: 'private-folders',
            index: 100,
            draw: extensions.privateDriveFolders
        },
        {
            id: 'public-folders',
            index: 200,
            draw: extensions.publicDriveFolders
        },
        {
            id: 'remote-accounts',
            index: 300,
            draw: extensions.fileStorageAccounts
        }, {
            id: 'add-external-account',
            index: 400,
            draw: extensions.addStorageAccount
        }
    );

    ext.point('io.ox/core/foldertree/infostore/popup').extend(
        {
            id: 'private-folders',
            index: 100,
            draw: extensions.privateDriveFoldersWithoutMyShares
        },
        {
            id: 'public-folders',
            index: 200,
            draw: extensions.publicDriveFolders
        },
        {
            id: 'remote-accounts',
            index: 300,
            draw: extensions.fileStorageAccounts
        }
    );

    //
    // Contacts
    //

    ext.point('io.ox/core/foldertree/contacts/links').extend(
        {
            id: 'subscribe',
            index: 300,
            capabilities: 'subscription',
            draw: extensions.subscribe
        },
        {
            id: 'my-contact-data',
            index: 400,
            draw: extensions.myContactData
        }
    );

    //
    // Calendar
    //

    ext.point('io.ox/core/foldertree/calendar/links').extend(
        {
            id: 'subscribe',
            index: 300,
            capabilities: 'subscription',
            draw: extensions.subscribe
        }
    );

    // helper

    function addFolder(e) {
        e.preventDefault();
        ox.load(['io.ox/core/folder/actions/add']).done(function (add) {
            add(e.data.folder, { module: e.data.module });
        });
    }

    _('contacts calendar tasks'.split(' ')).each(function (module) {

        //
        // Flat trees
        //

        var sectionNames = {
            'contacts': {
                'private':  gt('My address books'),
                'public':   gt('Public address books'),
                'shared':   gt('Shared address books'),
                'hidden':   gt('Hidden address books')
            },
            'calendar': {
                'private':  gt('My calendars'),
                'public':   gt('Public calendars'),
                'shared':   gt('Shared calendars'),
                'hidden':   gt('Hidden calendars')
            },
            'tasks': {
                'private':  gt('My tasks'),
                'public':   gt('Public tasks'),
                'shared':   gt('Shared tasks'),
                'hidden':   gt('Hidden tasks')
            }
        };

        function getTitle(module, type) {
            return sectionNames[module][type];
        }

        var defaultExtension = {
            id: 'standard-folders',
            index: 100,
            draw: function (tree) {

                var links = $('<div class="links">'),
                    baton = ext.Baton({ module: module, view: tree, context: tree.context }),
                    folder = 'virtual/flat/' + module,
                    model_id = 'flat/' + module,
                    defaults = { count: 0, empty: false, indent: false, open: false, tree: tree, parent: tree },
                    privateFolders,
                    publicFolders,
                    placeholder = $('<div>');

                // no links. Used for example in move folder picker
                if (!tree.options.noLinks) {
                    ext.point('io.ox/core/foldertree/' + module + '/links').invoke('draw', links, baton);
                }

                this.append(placeholder);

                // call flat() here to cache the folders. If not, any new TreeNodeview() and render() call calls flat() resulting in a total of 12 flat() calls.
                api.flat({ module: module }).always(function () {

                    privateFolders = new TreeNodeView(_.extend({}, defaults, { folder: folder + '/private', model_id: model_id + '/private', title: getTitle(module, 'private') }));

                    // open private folder whenever a folder is added to it
                    api.pool.getCollection('flat/' + module + '/private').on('add', function () {
                        privateFolders.toggle(true);
                    });

                    // open public folder whenever a folder is added to it
                    api.pool.getCollection('flat/' + module + '/public').on('add', function () {
                        privateFolders.toggle(true);
                    });

                    publicFolders = new TreeNodeView(_.extend({}, defaults, { folder: folder + '/public', model_id: model_id + '/public', title: getTitle(module, 'public') }));

                    placeholder.replaceWith(
                        // private folders
                        privateFolders.render().$el.addClass('section'),
                        // links
                        links,
                        // public folders
                        publicFolders.render().$el.addClass('section'),
                        // shared with me
                        new TreeNodeView(_.extend({}, defaults, { folder: folder + '/shared', model_id: model_id + '/shared', title: getTitle(module, 'shared') }))
                        .render().$el.addClass('section'),
                        // // shared by me
                        // new TreeNodeView(_.extend({}, defaults, { folder: folder + '/sharing', model_id: model_id + '/sharing', title: gt('Shared by me') }))
                        // .render().$el.addClass('section'),
                        // hidden folders
                        new TreeNodeView(_.extend({}, defaults, { folder: folder + '/hidden', model_id: model_id + '/hidden', title: getTitle(module, 'hidden') }))
                        .render().$el.addClass('section')
                    );
                });
            }
        };

        ext.point('io.ox/core/foldertree/' + module + '/app').extend(_.extend({}, defaultExtension));
        ext.point('io.ox/core/foldertree/' + module + '/popup').extend(_.extend({}, defaultExtension));

        //
        // Links
        //

        ext.point('io.ox/core/foldertree/' + module + '/links').extend(
            {
                index: 200,
                id: 'private',
                draw: function (baton) {

                    if (baton.context !== 'app') return;

                    var module = baton.module,
                        folder = api.getDefaultFolder(module),
                        title = gt('Add new folder');

                    if (module === 'calendar') title = gt('Add new calendar');
                    else if (module === 'contacts') title = gt('Add new address book');

                    // guests might have no default folder
                    if (!folder) return;

                    this.append(
                        $('<div>').append(
                            $('<a href="#" data-action="add-subfolder" role="button">')
                            .text(title)
                            .on('click', { folder: folder, module: module }, addFolder)
                        )
                    );
                }
            }
        );

        //
        // Upsell
        //

        ext.point('io.ox/core/foldertree/contacts/links').extend({
            index: 1000,
            id: 'upsell-contacts',
            draw: function (baton) {

                if (baton.context !== 'app') return;

                this.append(new UpsellView({
                    id: 'folderview/contacts',
                    requires: 'carddav',
                    title: gt('Synchronize with your tablet or smartphone')
                }).render().$el);
            }
        });

        ext.point('io.ox/core/foldertree/calendar/links').extend({
            index: 1000,
            id: 'upsell-calendar',
            draw: function (baton) {

                if (baton.context !== 'app') return;

                this.append(new UpsellView({
                    id: 'folderview/calendar',
                    requires: 'caldav',
                    title: gt('Synchronize with your tablet or smartphone')
                }).render().$el);
            }
        });

        //
        // Shared folders
        //

        function openPermissions(e) {
            require(['io.ox/files/share/permissions'], function (controller) {
                controller.showFolderPermissions(e.data.id);
            });
        }

        function openSubSettings(e) {
            var options = { id: 'io.ox/core/sub', data: e.data.folder, refresh: true };
            ox.launch('io.ox/settings/main', options).done(function () {
                this.setSettingsPane(options);
            });
        }

        function openColorSelection(e) {
            // check, if clicked on the :before element
            if (e.offsetX < 0 || e.clientX < $(e.target).offset().left) {
                // process as context-menu event to view
                e.type = 'contextmenu';
                e.data.view.$el.trigger(e);
            }
        }

        ext.point('io.ox/core/foldertree/node').extend(
            {
                id: 'shared-by',
                index: 100,
                draw: function (baton) {

                    var model = baton.view.model, data = model.toJSON();
                    if (!/^(contacts|calendar|tasks)$/.test(data.module)) return;
                    if (!api.is('shared', data)) return;

                    baton.view.options.a11yDescription.push(gt('Shared by other users'));
                }
            },
            {
                id: 'shared',
                index: 200,
                draw: function (baton) {

                    this.find('.folder-node:first .folder-shared:first').remove();
                    baton.view.options.a11yDescription = baton.view.options.a11yDescription.filter(function (description) {
                        return description !== gt('You share this folder with other users');
                    });

                    if (_.device('smartphone')) return;
                    // drive has virtual folder 'Shared by me'
                    if (baton.data.module === 'infostore') return;
                    if (!api.is('unlocked', baton.data)) return;

                    this.find('.folder-node:first').append(
                        $('<i class="fa folder-shared">').attr('title', gt('You share this folder with other users'))
                        .on('click', { id: baton.data.id }, openPermissions)
                    );
                    baton.view.options.a11yDescription.push(gt('You share this folder with other users'));
                }
            },
            {
                id: 'sub',
                index: 300,
                draw: function (baton) {

                    if (!api.isVirtual(baton.view.folder)) {
                        this.find('.folder-sub:first').remove();
                    }

                    // ignore shared folders
                    if (api.is('shared', baton.data)) return;
                    if (!api.is('subscribed', baton.data)) return;

                    this.find('.folder-node:first').append(
                        $('<i class="fa folder-sub">').attr('title', gt('This folder has subscriptions'))
                        .on('click', { folder: baton.data }, openSubSettings)
                    );
                    baton.view.options.a11yDescription.push(gt('This folder has publications and/or subscriptions'));
                }
            },
            {
                id: 'color',
                index: 400,
                draw: function (baton) {
                    if (!/^calendar$/.test(baton.data.module)) return;
                    if (!api.is('private', baton.data)) return;
                    if (/^virtual/.test(baton.data.id)) return;

                    var folderColor = color.getFolderColor(baton.data),
                        folderLabel = this.find('.folder-label');

                    // remove any color-label.* classes from folder.
                    folderLabel.each(function (index, node) {
                        node.className = _(node.className.split(' ')).filter(function (c) {
                            return !c.match(/color-label(-\d{1,2})?/);
                        }).join(' ');
                    }).addClass('color-label color-label-' + folderColor);

                    if (_.device('!smartphone')) {
                        folderLabel.off('click', openColorSelection)
                            .on('click', { view: baton.view, folder: baton.data }, openColorSelection);
                    }
                }
            }
        );
    });

    return extensions;
});
