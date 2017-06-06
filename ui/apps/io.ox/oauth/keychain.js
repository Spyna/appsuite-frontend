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
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 */

 /**
 The keychain plugin. Use io.ox/keychain/api to interact with OAuth accounts
 **/

define('io.ox/oauth/keychain', [
    'io.ox/core/extensions',
    'io.ox/core/http',
    'io.ox/core/event',
    'io.ox/core/notifications',
    'io.ox/core/api/filestorage',
    'io.ox/oauth/backbone',
    'gettext!io.ox/core'
], function (ext, http, Events, notifications, filestorageApi, OAuth, gt) {

    'use strict';

    var accounts = new OAuth.Account.Collection(),
        point = ext.point('io.ox/keychain/api'),
        ServiceModel = Backbone.Model.extend({
            initialize: function () {
                var keychainAPI = new OAuthKeychainAPI(this.toJSON());

                // add initialized listener before extending (that triggers the initialized event)
                keychainAPI.one('initialized', function () {
                    // trigger refresh if we have accounts or the settings account list might miss Oauth accounts due to race conditions
                    if (accounts.length > 0) {
                        keychainAPI.trigger('refresh.all');
                    }
                });

                point.extend(keychainAPI);

                this.keychainAPI = keychainAPI;
            }
        }),
        ServiceCollection = Backbone.Collection.extend({
            model: ServiceModel,
            forAccount: function (account) {
                return this.get(account.get('serviceId'));
            },
            withShortId: function (shortId) {
                return this.filter(function (service) {
                    return simplifyId(service.id) === shortId;
                })[0];
            }
        }),
        services = new ServiceCollection();

    var generateId = function () {
        generateId.id = generateId.id + 1;
        return generateId.id;
    };

    generateId.id = 1;

    function simplifyId(id) {
        return id.substring(id.lastIndexOf('.') + 1);
    }

    // Extension
    function OAuthKeychainAPI(service) {
        var self = this;

        Events.extend(this);

        this.id = simplifyId(service.id);
        this.displayName = service.displayName;

        function outgoing(account) {
            if (!account) {
                return account;
            }
            account.accountType = self.id;
            return account;
        }

        function chooseDisplayName() {
            var names = {}, name, counter = 0;
            _(accounts.forService(service.id)).each(function (account) {
                names[account.displayName] = 1;
            });

            //#. %1$s is the display name of the account
            //#. e.g. My Xing account
            name = gt('My %1$s account', service.displayName);

            while (names[name]) {
                counter++;
                //#. %1$s is the display name of the account
                //#. %2$d number, if more than one account of the same service
                //#. e.g. My Xing account
                name = gt('My %1$s account (%2$d)', service.displayName, counter);
            }
            return name;
        }

        this.getAll = function () {
            return _(accounts.forService(service.id)).chain()
                .map(function (account) { return account.toJSON(); })
                .sortBy(function (account) { return account.id; })
                .map(outgoing)
                .value();
        };

        this.get = function (id) {
            return outgoing(accounts.get(id).toJSON());
        };

        this.getStandardAccount = function () {
            return outgoing(_(this.getAll()).first());
        };

        this.hasStandardAccount = function () {
            return this.getAll().length > 0;
        };

        this.createInteractively = function (popupWindow, scopes) {
            scopes = [].concat(scopes || []);

            var def = $.Deferred(),
                self = this;

            // the popup must exist already, otherwise we run into the popup blocker
            if (!popupWindow) return def.reject();

            var newAccount = new OAuth.Account.Model({
                displayName: chooseDisplayName(),
                serviceId: service.id,
                popup: popupWindow
            });

            newAccount.enableScopes(scopes);

            return newAccount.save().then(function (account) {
                accounts.add(newAccount);
                // needed for some portal plugins (xing, twitter, for example)
                self.trigger('create', account);
                ox.trigger('refresh-portal');
                notifications.yell('success', gt('Account added successfully'));
                return account;
            }, function () {
                notifications.yell('error', gt('Account could not be added'));
            });
        };

        this.remove = function (account) {
            account = accounts.get(account.id);

            return account.destroy().then(function () {
                var filestorageAccount;
                // if rampup failed, ignore filestorages, maybe the server does not support them
                if (filestorageApi.rampupDone) {
                    filestorageAccount = filestorageApi.getAccountForOauth(account.toJSON());
                    // if there is a filestorageAccount for this Oauth account, remove it too
                    if (filestorageAccount) {
                        // use softDelete parameter to only cleanup caches. Backend removes the filestorage account automatically, so we don't need to send a request
                        filestorageApi.deleteAccount(filestorageAccount, { softDelete: true });
                    }
                }
            });
        };

        this.update = function (data) {
            var account = accounts.get(data.id);
            account.set(data);

            return account.save().then(function () {
                var filestorageAccount;
                // if rampup failed, ignore filestorages, maybe the server does not support them
                if (filestorageApi.rampupDone) {
                    filestorageAccount = filestorageApi.getAccountForOauth(account.toJSON());
                }

                // if there is a filestorageAccount for this Oauth account, update it too. Changes foldername in drive
                if (filestorageAccount) {
                    var options = filestorageAccount.attributes;
                    options.displayName = account.get('displayName');

                    return $.when(account.toJSON(), filestorageApi.updateAccount(options));
                }
                return account.toJSON();
            }).done(function () {
                self.trigger('refresh.list', account.toJSON());
            });
        };

        this.reauthorize = function (account) {
            account = accounts.get(account.id);
            if (!account) return $.Deferred().reject();

            return account.reauthorize().then(function () {
                ox.trigger('refresh-portal');
                return account.toJSON();
            }, function (e) {
                notifications.yell('error', e.error);
            });
        };
        if (_.contains(['xing', 'twitter', 'linkedin', 'boxcom', 'dropbox', 'google', 'msliveconnect', 'yahoo'], this.id)) {
            this.canAdd = function (options) {
                options = _.extend({}, options);
                if (_.isString(options.scopes)) options.scopes = [options.scopes];
                return (options.scopes || []).reduce(function hasAvailableScope(acc, scope) {
                    return acc && _(service.availableScopes).contains(scope);
                }, true) && self.getAll().length === 0;
            };
        }
    }

    // services & accounts are part of the rampup data
    services.add(ox.rampup.oauth.services);
    accounts.add(ox.rampup.oauth.accounts);

    accounts.listenTo(accounts, 'add remove', function (model) {
        var service = services.forAccount(model);
        service.keychainAPI.trigger('refresh.all refresh.list', model.toJSON());
        // Some standard event handlers
        require(['plugins/halo/api'], function (haloAPI) {
            haloAPI.halo.refreshServices();
        });
    });

    filestorageApi.rampup().then(function () {
        // perform consistency check for filestorage accounts (there might be cases were they are out of sync)
        // we delay it so it doesn't prolong appsuite startup
        _.delay(filestorageApi.consistencyCheck, 5000);
    });

    return {
        services: services,
        accounts: accounts,
        serviceIDs: services.map(function (service) { return simplifyId(service.id); })
    };
});
