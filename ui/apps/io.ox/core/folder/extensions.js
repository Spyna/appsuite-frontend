/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/folder/extensions', [
    'io.ox/core/folder/node',
    'io.ox/core/folder/api',
    'io.ox/core/api/account',
    'io.ox/core/extensions',
    'io.ox/core/capabilities',
    'io.ox/core/api/user',
    'io.ox/mail/api',
    'gettext!io.ox/core',
    'io.ox/calendar/util',
    'io.ox/core/folder/favorites'
], function (TreeNodeView, api, account, ext, capabilities, userAPI, mailAPI, gt, calendarUtil) {

    'use strict';

    var INBOX = 'default0' + mailAPI.separator + 'INBOX';

    // define virtual/standard
    api.virtual.add('virtual/standard', function () {
        return this.concat(
            // inbox
            api.get(INBOX),
            // sent, drafts, spam, trash, archive
            // default0 is alternative for IMAP server that list standard folders below INBOX
            api.list('default0'), api.list(INBOX)
        );
    });

    // myfolders
    api.virtual.add('virtual/myfolders', function () {
        var id = api.altnamespace ? 'default0' : INBOX;
        return api.list(id).then(function (list) {
            return _(list).filter(function (data) {
                if (account.isStandardFolder(data.id)) return false;
                if (api.is('public|shared', data)) return false;
                return true;
            });
        });
    });

    // remote folders
    api.virtual.add('virtual/remote', function () {
        return api.list('1').then(function (list) {
            return _(list).filter(function (data) {
                return account.isExternal(data.id);
            });
        });
    });

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
            this.append(
                // standard folders
                new TreeNodeView({
                    filter: function (id, model) {
                        return account.isStandardFolder(model.id);
                    },
                    folder: 'virtual/standard',
                    headless: true,
                    open: true,
                    tree: tree,
                    parent: tree
                })
                .render().$el.addClass('standard-folders')
            );
        },

        localFolders: function (tree) {

            var defaultId = api.altnamespace ? 'default0' : INBOX;

            var node = new TreeNodeView({
                contextmenu: 'myfolders',
                count: 0,
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
                    //empty: false,
                    folder: 'virtual/remote',
                    headless: true,
                    open: true,
                    icons: tree.options.icons,
                    tree: tree,
                    parent: tree
                })
                .render().$el.addClass('remote-folders')
            );
        },

        addRemoteAccount: function () {

            if (!capabilities.has('multiple_mail_accounts')) return;

            this.append(
                $('<div class="links">').append(
                    $('<a href="#" data-action="add-mail-account" tabindex="1" role="button">')
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

        rootFolders: function (tree) {
            this.append(
                new TreeNodeView({
                    folder: tree.root,
                    headless: true,
                    open: true,
                    tree: tree,
                    parent: tree
                })
                .render().$el
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
            id: 'remote-accounts',
            index: INDEX += 100,
            draw: extensions.remoteAccounts
        },
        {
            id: 'add-account',
            index: INDEX += 100,
            draw: extensions.addRemoteAccount
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

    ext.point('io.ox/core/foldertree/infostore/app').extend({
        id: 'standard-folders',
        index: 100,
        draw: extensions.rootFolders
    });

    ext.point('io.ox/core/foldertree/infostore/popup').extend({
        id: 'standard-folders',
        index: 100,
        draw: extensions.rootFolders
    });

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
                    publicFolders;

                ext.point('io.ox/core/foldertree/' + module + '/links').invoke('draw', links, baton);

                privateFolders = new TreeNodeView(_.extend({}, defaults, { empty: true, folder: folder + '/private', model_id: model_id + '/private', title: getTitle(module, 'private') }));

                // open private folder whenever a folder is added to it
                api.pool.getCollection('flat/' + module + '/private').on('add', function () {
                    privateFolders.toggle(true);
                });

                // open public folder whenever a folder is added to it
                api.pool.getCollection('flat/' + module + '/public').on('add', function () {
                    privateFolders.toggle(true);
                });

                publicFolders = new TreeNodeView(_.extend({}, defaults, { folder: folder + '/public',  model_id: model_id + '/public',  title: getTitle(module, 'public') }));

                this.append(
                    // private folders
                    privateFolders.render().$el.addClass('section'),
                    // links
                    links,
                    // public folders
                    publicFolders.render().$el.addClass('section'),
                    // shared with me
                    new TreeNodeView(_.extend({}, defaults, { folder: folder + '/shared',  model_id: model_id + '/shared',  title: getTitle(module, 'shared') }))
                    .render().$el.addClass('section'),
                    // // shared by me
                    // new TreeNodeView(_.extend({}, defaults, { folder: folder + '/sharing', model_id: model_id + '/sharing', title: gt('Shared by me') }))
                    // .render().$el.addClass('section'),
                    // hidden folders
                    new TreeNodeView(_.extend({}, defaults, { folder: folder + '/hidden',  model_id: model_id + '/hidden',  title: getTitle(module, 'hidden') }))
                    .render().$el.addClass('section')
                );
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
                        title = module === 'calendar' ? gt('Add new calendar') : gt('Add new folder');

                    this.append(
                        $('<div>').append(
                            $('<a href="#" tabindex="1" data-action="add-subfolder" role="menuitem">')
                            .text(title)
                            .on('click', { folder: folder, module: module }, addFolder)
                        )
                    );
                }
            }
        );

        //
        // Shared folders
        //

        function openPermissions(e) {
            require(['io.ox/core/permissions/permissions'], function (controller) {
                controller.show(e.data.id);
            });
        }

        function openSubSettings(e) {
            var options = { id: 'io.ox/core/sub', folder: e.data.folder.id, data: e.data.folder };
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

                    this.find('.owner').remove();

                    var name = data['com.openexchange.folderstorage.displayName'],
                        //#. %1$s is the folder owner
                        title = gt.format(gt.pgettext('owner', 'Shared by: %1$s'), name);

                    this.addClass('shared').find('.folder-node').append(
                        $('<div class="owner">').text(title)
                    );
                    baton.view.options.a11yDescription.push(gt('Shared by other users'));
                }
            },
            {
                id: 'shared',
                index: 200,
                draw: function (baton) {

                    this.find('.folder-node:first .folder-shared:first').remove();

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

                    var folderColor = calendarUtil.getFolderColor(baton.data),
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
