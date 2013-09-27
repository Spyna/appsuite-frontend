/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2013
 * Mail: info@open-xchange.com
 *
 * @author David Bauer <david.bauer@open-xchange.com>
 */

define('io.ox/core/pubsub/subscriptions',
    ['io.ox/core/extensions',
     'io.ox/core/pubsub/model',
     'io.ox/core/api/pubsub',
     'io.ox/core/api/folder',
     'io.ox/core/notifications',
     'io.ox/core/tk/dialogs',
     'io.ox/keychain/api',
     'gettext!io.ox/core/pubsub',
     'settings!io.ox/core'
    ],
    function (ext, pubsub, api, folderAPI, notifications, dialogs, keychainAPI, gt) {

    'use strict';

    var POINT = 'io.ox/core/pubsub/subscribe',

    // needs id and module (e.g. contacts)
    buildSubscribeDialog = function (options) {
        options = options || {};
        var model = new pubsub.Subscription({
                folder: options.folder,
                entity: { folder: options.folder },
                entityModule: options.module
            }),
            view = new SubscriptionView({ model: model }).render(options.app);
    },

    SubscriptionView = Backbone.View.extend({
        tagName: "div",
        _modelBinder: undefined,
        initialize: function (options) {
            this._modelBinder = new Backbone.ModelBinder();
        },
        render: function (app) {
            var self = this,

            popup = new dialogs.ModalDialog({async: true})
                .addPrimaryButton('subscribe', gt('Subscribe'))
                .addButton('cancel', gt('Cancel'));

            popup.getHeader().append($('<h4>').text(gt('Subscribe')));

            api.sources.getAll().done(function (data) {
                var baton = ext.Baton({ view: self, model: self.model, data: self.model.attributes, services: data, popup: popup, newFolder: true });

                function removeFolder(id) {
                    return folderAPI.remove({ folder: id });
                }

                function saveModel(newFolder) {

                    notifications.yell('info', gt('Checking credentials... This may take a few seconds.'));
                    var folder = self.model.attributes.folder;

                    self.model.save().then(
                        function saveSuccess(id) {
                            //set id, if none is present (new model)
                            if (!self.model.id) { self.model.id = id; }
                            api.subscriptions.refresh({ id: id, folder: folder }).then(
                                function refreshSuccess(data) {
                                    notifications.yell('info', gt('Subscription successfully created.'));
                                    popup.close();
                                    return self.model;
                                },
                                function refreshFail(error) {
                                    popup.idle();
                                    popup.getBody().find('.control-group:not(:first)').addClass('error');
                                    showErrorInline(popup.getBody(), gt('Error:'), _.noI18n(error.error));
                                    api.subscriptions.destroy(id);
                                    self.model = self.model.clone();
                                    if (newFolder) {
                                        removeFolder(folder);
                                    }
                                }
                            ).then(function (model) {
                                return model.fetch();
                            }).then(function (model, collection) {
                                var subscriptions = pubsub.subscriptions();
                                //update the model-(collection)
                                subscriptions.add(model, {merge: true});
                            }).then(function () {
                                return app.folderView.idle().repaint();
                            }).done(function () {
                                app.folder.set(folder);
                            });
                        },
                        function saveFail(error) {
                            popup.idle();
                            if (!self.model.valid) {
                                if (!error.model) {
                                    showErrorInline(popup.getBody(), gt('Error:'), _.noI18n(error.error));
                                } else {
                                    notifications.yell({
                                        type: 'error',
                                        headline: gt('Error'),
                                        message: gt('The subscription could not be created.')
                                    });
                                }
                            }
                            if (newFolder) {
                                removeFolder(folder);
                            }
                        }
                    );
                }

                popup.getBody().addClass('form-horizontal max-height-200');
                ext.point(POINT + '/dialog').invoke('draw', popup.getBody(), baton);
                popup.show(function () {
                    popup.getBody().find('select.service-value').focus();
                });
                popup.on('subscribe', function (action) {

                    popup.busy();
                    var invalid;

                    _.each(popup.getBody().find('input'), function (input) {
                        if (!$(input).val()) {
                            $(input).closest('.control-group').addClass('error');
                            popup.idle();
                            invalid = true;
                        } else {
                            $(input).closest('.control-group').removeClass('error');
                        }
                    });

                    if (invalid) { return; }

                    if (baton.newFolder) {

                        var service = findId(baton.services, baton.model.get('source'));

                        // add new folders under module's default folder!
                        var folder = require('settings!io.ox/core').get('folder/' + self.model.get('entityModule'));
                        folderAPI.create({
                            folder: folder,
                            data: {
                                title: service.displayName || gt('New Folder'),
                                module: self.model.get('entityModule')
                            },
                            silent: true
                        })
                        .then(function (folder) {
                            self.model.attributes.folder = self.model.attributes.entity.folder = folder.id;
                            saveModel(true);
                        });
                    } else {
                        saveModel();
                    }

                });
            });

        }
    });

    function showErrorInline(node, label, msg) {
        node.find('div.alert').remove();
        node.prepend($('<div class="alert alert-error alert-block">').append(
            $('<strong>').text(label),
            $.txt(' ' + msg),
            $('<button type="button" data-dismiss="alert" class="btn close">').text('x'))
        );

    }

    function findId(list, id) {
        //FIXME: use _.findWhere, once available, to get rid of the anonymous function
        return _(list).find(function (t) {
            return t.id === id;
        });
    }

    function buildForm(node, baton) {
        node.empty();
        var service = findId(baton.services, baton.model.get('source'));

        function setSource(id) {
            baton.model.setSource(service, { 'account': parseInt(id, 10) });
        }

        function oauth() {
            var win = window.open(ox.base + "/busy.html", "_blank", "height=400, width=600");
            return keychainAPI.createInteractively(service.displayName.toLowerCase(), win);
        }

        _.each(service.formDescription, function (fd) {
            var controls;
            if (fd.widget === 'oauthAccount') {
                var accounts = _.where(keychainAPI.getAll(), { serviceId: fd.options.type });
                if (accounts.length === 1) {
                    setSource(accounts[0].id);
                    controls = $('<button type="button" class="btn disabled">').text(accounts[0].displayName);
                } else if (accounts.length > 1) {
                    controls = $('<select name="' + fd.name + '">').on('change', function () {
                        setSource($(this).val());
                    });
                    _.each(accounts, function (account) {
                        controls.append(
                            $('<option>').text(account.displayName).val(account.id)
                        );
                    });
                    // set initially to first account in list
                    setSource(accounts[0].id);
                } else {
                    controls = $('<button type="button" class="btn">').text(gt('Add new account')).on('click', function () {
                        oauth().done(function (data) {
                            buildForm(node, baton);
                        });
                    });
                }

            } else {
                var input_type = fd.name === 'password' ? 'password' : 'text';
                controls = $('<input type="' + input_type + '" name="' + fd.name + '">');
            }
            node.append(
                $('<div>').addClass('control-group').append(
                    $('<label>').addClass('control-label').attr('for', fd.name).text((fd.name === 'account' ? gt('Account') : fd.displayName)),
                    $('<div>').addClass('controls').append(controls)
                )
            );
        });
        var source = {};
        node.on('change blur', 'input[type="text"], input[type="password"]', function (e) {
            var cgroup = $(this).closest('.control-group');
            if (!$(this).val()) {
                cgroup.addClass('error');
            } else {
                cgroup.removeClass('error');
                source[$(this).attr('name')] = $(this).val();
                baton.model.setSource(service, source);
            }
        });
    }

    ext.point(POINT + '/dialog').extend({
        id: 'service',
        index: 100,
        draw: function (baton) {
            var node, userform;

            this.append($('<div>').addClass('control-group').append(
                $('<label>').addClass('control-label').attr('for', 'service-value').text(gt('Source')),
                $('<div>').addClass('controls').append(
                    node = $('<select>').attr('name', 'service-value').addClass('service-value').on('change', function () {
                        userform.parent().find('.alert-error').remove();
                        userform.parent().find('.error').removeClass('error');
                        baton.model.setSource(findId(baton.services, node.val()));
                        buildForm(userform, baton);
                    }))));

            _.each(baton.services, function (service) {
                if (baton.data.entityModule === service.module) {
                    node.append($('<option>').text(service.displayName).val(service.id));
                }
            });

            if (!baton.model.source()) {
                baton.model.setSource(findId(baton.services, node.val()));
            } else {
                node.val(baton.model.source().service.id);
            }

            this.append(userform = $('<div>').addClass('userform'));
            buildForm(userform, baton);

        }
    });

    ext.point(POINT + '/dialog').extend({
        id: 'targetfolder',
        index: 200,
        draw: function (baton) {
            var node;
            this.append(
                $('<div>').addClass('control-group').append(
                    $('<div>').addClass('controls').append(
                        $('<label>').addClass('checkbox').text(gt('Add new folder for this subscription')).append(
                            $('<input type="checkbox">').prop('checked', true).on('change', function () {
                                if (!$(this).prop('checked')) {
                                    baton.newFolder = false;
                                }
                            })
                        )
                    )
                )
            );
        }
    });

    ext.point(POINT + '/dialog').extend({
        id: 'durationinformation',
        index: 300,
        draw: function (baton) {

            var fullNode = $('<div>').addClass('alert alert-info').append(
                $('<b>').addClass('privacy-label').text(gt('Approximate Duration for Subscriptions')),
                        $('<div>').addClass('privacy-text').text(
                            gt('Subscribing to items that are not delivered by another Open-Xchange Server (i.e. OXMF) may take some time. Example: Importing 100 contacts from Xing takes about 5 minutes. We are continually improving this functionality. Future releases will work significantly faster.')));
            var link = $('<div>').addClass('control-group').append($('<a href="#">').addClass('controls').text(gt('Approximate Duration for Subscriptions')).on('click', function (e) {
                    e.preventDefault();
                    link.replaceWith(fullNode);
                }));
            this.append(link);
        }
    });

    return {
        buildSubscribeDialog: buildSubscribeDialog
    };
});
