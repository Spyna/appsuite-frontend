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
 * @author Mario Scheliga <mario.scheliga@open-xchange.com>
 */

define('io.ox/settings/accounts/settings/pane',
    ['io.ox/core/extensions',
       'io.ox/core/tk/dialogs',
       'io.ox/keychain/api',
       'io.ox/keychain/model',
       'io.ox/core/api/folder',
       'gettext!io.ox/settings/accounts',
       'withPluginsFor!keychainSettings'
   ], function (ext, dialogs, api, keychainModel, folderAPI, gt) {

    'use strict';

    var collection,

        createExtpointForSelectedAccount = function (args) {
            if (args.data.id !== undefined && args.data.accountType !== undefined) {
                ext.point('io.ox/settings/accounts/' + args.data.accountType + '/settings/detail').invoke('draw', args.data.node, args);
            }
        },

        removeSelectedItem = function (account) {
            var def = $.Deferred();
            require(['io.ox/core/tk/dialogs'], function (dialogs) {
                new dialogs.ModalDialog({easyOut: true})
                    .text(gt('Do you really want to delete this account?'))
                    .addPrimaryButton('delete', gt('Delete account'))
                    .addButton('cancel', gt('Cancel'))
                    .show()
                    .done(function (action) {
                        if (action === 'delete') {
                            def.resolve();
                            api.remove(account).done(function () {
                                folderAPI.subFolderCache.remove('1');
                                folderAPI.folderCache.remove('default' + account);
                                folderAPI.trigger('update');
                            });
                        } else {
                            def.reject();
                        }
                    });
            });
        },

        drawItem = function (o) {
            return $('<div class="selectable deletable-item">').attr({
                'data-id': o.id,
                'data-accounttype': o.accountType
            }).append(
                $('<div class="pull-right">').append(
                    $('<a class="action" tabindex="3" data-action="edit">').text(gt('Edit')),
                    $('<a class="close">').attr({
                        'data-action': 'delete',
                        title: gt('Delete'),
                        tabindex: 3
                    }).append($('<i class="icon-trash">'))
                ),
                $('<span data-property="displayName" class="list-title">')
            );
        },

        drawAddButton = function () {
            return $('<div class="controls">').append(
                $('<div class="btn-group pull-right">').append(
                    $('<a class="btn btn-primary dropdown-toggle" data-toggle="dropdown" href="#" aria-haspopup="true" tabindex="1">').append(
                        $.txt(gt('Add account')), $.txt(' '),
                        $('<span class="caret">')
                    ),
                    $('<ul class="dropdown-menu" role="menu">')
                )
            );
        },

        drawRecoveryButton = function () {
            return $('<button class="btn btn-danger" data-action="recover">').text(gt("Recovery Dialog")).on("click", function () {
                ox.load(["io.ox/keychain/secretRecoveryDialog"]).done(function (srd) {
                    srd.show();
                });
            });
        },

        drawPane = function () {
            return $('<div class="io-ox-accounts-settings">').append(
                $('<h1 class="no-margin">').text(gt('Mail and Social Accounts')),
                drawAddButton(),
                $('<ul class="settings-list">'),
                drawRecoveryButton()
            );
        },

        AccountSelectView = Backbone.View.extend({

            tagName: 'li',

            _modelBinder: undefined,
            initialize: function (options) {
                this._modelBinder = new Backbone.ModelBinder();
            },
            render: function () {
                var self = this;
                self.$el.empty().append(drawItem({
                    id: this.model.get('id'),
                    accountType: this.model.get('accountType')
                }));

                var defaultBindings = Backbone.ModelBinder.createDefaultBindings(self.el, 'data-property');
                self._modelBinder.bind(self.model, self.el, defaultBindings);

                return self;
            },
            events: {
                'click [data-action="edit"]': 'onSelect',
                'click [data-action="delete"]': 'onDelete',
                'keydown [data-action="edit"]': 'onSelect',
                'keydown [data-action="delete"]': 'onDelete'
            },
            onDelete: function (e) {
                if ((e.type === 'click') || (e.which === 13)) {
                    var account = {
                        id: this.model.get('id'),
                        accountType: this.model.get('accountType')
                    };
                    if (account.id !== 0) {
                        removeSelectedItem(account);
                    } else {
                        new dialogs.ModalDialog({easyOut: true})
                            .text(gt('Your primary mail account can not be deleted.'))
                            .addPrimaryButton('ok', gt('Ok'))
                            .show();
                    }
                    e.preventDefault();
                }
            },
            onSelect: function (e) {
                if (e.type !== 'click' && e.which !== 13) {
                    return;
                }
                this.$el.parent().find('div[selected="selected"]').attr('selected', null);
                this.$el.find('.deletable-item').attr('selected', 'selected');
            }
        });


    /**
     * Extension point for account settings detail view
     *
     * This extension point provides a list to manage accounts of the keyring.
     *
     * As an extension to basic extension points, accounts can implement a canAdd
     * attribute of type {bool|function} to specify if the user is able to add new
     * accounts of this type. If false, the user is able to view the account in the
     * list and edit it, but it will be filtered from the dropdown menu of the add
     * button.
     *
     */



    ext.point('io.ox/settings/accounts/settings/detail').extend({
        index: 300,
        id: 'accountssettings',
        draw: function (data) {
            var  that = this;

            function redraw() {

                that.empty();
                var allAccounts = api.getAll();

                collection = keychainModel.wrap(allAccounts);

                var AccountsView = Backbone.View.extend({

                    initialize: function () {
                        _.bindAll(this);
                        this.collection = collection;

                        this.collection.bind('add', this.render);
                        this.collection.bind('remove', this.render);
                    },
                    render: function () {
                        var self = this,
                            $dropDown;
                        self.$el.empty().append(drawPane);
                        this.collection.each(function (item) {
                            self.$el.find('.settings-list').append(
                                new AccountSelectView({ model: item }).render().el
                            );
                        });

                        // Enhance Add... options
                        $dropDown = this.$el.find('.dropdown-menu');

                        _(api.submodules).chain()
                        .select(function (submodule) {
                            return !submodule.canAdd || submodule.canAdd.apply(this);
                        })
                        .each(function (submodule) {
                            $dropDown.append(
                                $('<li>').append(
                                    $('<a>', { tabindex: 1, role: 'menuitem', href: '#', 'data-actionname': submodule.actionName || submodule.id || '' })
                                    .text(submodule.displayName)
                                    .on('click', function (e) {
                                        e.preventDefault();
                                        // looks like oauth?
                                        if ('reauthorize' in submodule) {
                                            var win = window.open(ox.base + '/busy.html', '_blank', 'height=400, width=600');
                                            submodule.createInteractively(win);
                                        } else {
                                            submodule.createInteractively(e);
                                        }
                                    })
                                )
                            );
                        }).value();

                        return this;
                    },

                    events: {
                        'click [data-action="edit"]': 'onEdit',
                        'keydown [data-action="edit"]': 'onEdit'
                    },

                    onAdd: function (args) {
                        require(['io.ox/settings/accounts/settings/createAccountDialog'], function (accountDialog) {
                            accountDialog.createAccountInteractively(args);
                        });
                    },

                    onEdit: function (e) {
                        if ((e.type === 'click') || (e.which === 13)) {
                            var selected = this.$el.find('[selected]');
                            e.data = {};
                            e.data.id = selected.data('id');
                            e.data.accountType = selected.data('accounttype');
                            e.data.node = this.el;
                            createExtpointForSelectedAccount(e);
                            e.preventDefault();
                        }
                    }

                });

                var accountsList = new AccountsView();

                that.append(accountsList.render().el);
            }

            redraw();

            api.on('refresh.all refresh.list', redraw);
            data.grid.selection.on('change', function (a, b) {
                api.off('refresh.all refresh.list', redraw);
            });
        },
        save: function () {
            // TODO
            //console.log('now accounts get saved?');
        }
    });

    return {};

});

