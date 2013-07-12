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

define('io.ox/core/api/account',
    ['settings!io.ox/mail',
     'io.ox/core/http',
     'io.ox/core/cache',
     'io.ox/core/event'
    ], function (settings, http, Cache, Events) {

    'use strict';

    // quick hash for sync checks
    var idHash = {},
        typeHash = {},
        // default separator
        separator = settings.get('defaultseparator', '/');

    var process = function (data) {

        var isArray = _.isArray(data);
        data = isArray ? data : [data];

        var rPath = /^default\d+/,

            fix = function (account, id, title) {
                var prefix = 'default' + account.id + separator,
                    field = id + '_fullname';
                if (account.id === 0 && !account[field]) {
                    var folder = settings.get(['folder', id]);
                    // folder isn't available in config
                    if (!folder) {
                        // educated guess
                        folder = settings.get('folder/inbox') + separator +  (account[id] || title);
                    }
                    account[field] = folder;
                } else if (!account[field]) {
                    // educated guess
                    account[field] = prefix + (account[id] || title);
                } else if (!rPath.test(account[field])) {
                    // missing prefix
                    account[field] = prefix + account[field];
                }
            };

        _(data).each(function (account) {
            fix(account, 'trash', 'Trash');
            fix(account, 'sent', 'Sent');
            fix(account, 'drafts', 'Drafts');
            fix(account, 'spam', 'Spam');
            fix(account, 'confirmed_spam', 'Confirmed Spam');
            fix(account, 'confirmed_ham', 'Confirmed Ham');
        });

        return isArray ? data : data[0];
    };

    var invalidateRoot = function () {
        ox.api.cache.folder0.setComplete('1', false);
        ox.api.cache.folder1.setComplete('1', false);
    };

    var invalidateFolder = function (id) {
        ox.api.cache.folder0.removeChildren(id, true); // deep
        ox.api.cache.folder0.remove(id);
        ox.api.cache.folder1.removeChildren(id, true); // deep
        ox.api.cache.folder1.remove(id);
    };

    var regParseAccountId = new RegExp('^default\\d+' + separator + '[^' + separator + ']+' + separator),
        regUnified = new RegExp('^default\\d+' + separator + '[^' + separator + ']+$');

    var api = {};

    Events.extend(api);

    /**
     * is PIM User
     * @return {deferred} resolves if it's a pim
     */
    api.isPIM = function () {
        var def = $.Deferred();
        require(['io.ox/core/api/folder'], function (folderAPI) {
            //PIM uses don't have access to the global address book
            //TODO: I would have preferred to use folderAPI.can('read', 6)
            folderAPI.get({ folder: 6, cache: false, suppressYell: true})
            .then(def.reject, def.resolve);
        });
        return def;
    };

    /**
     * is unified
     * @param  {string}  id (folder_id)
     * @return {boolean}
     */
    api.isUnified = function (id) {
        // is account? (unified inbox is not a usual account)
        return !api.isAccount(id);
    };

    /**
     * is unified folder
     * @param  {string}  id (folder_id)
     * @return {boolean}
     */
    api.isUnifiedFolder = function (id) {
        return regUnified.test(id) && api.isUnified(id);
    };

    /**
     * is account folder
     * @param  {string}  id (folder_id)
     * @return {boolean}
     */
    api.isAccount = function (id) {
        if (_.isNumber(id)) return id in idHash;
        var match = String(id).match(/^default(\d+)/);
        return match && match[1] in idHash;
    };

    /**
     * is primary folder
     * @param  {string}  id (folder_id)
     * @return {boolean}
     */
    api.isPrimary = function (id) {
        return (/^default0/).test(id);
    };

    /**
     * is external folder
     * @param  {string}  id (folder_id)
     * @return {boolean}
     */
    api.isExternal = function (id) {
        return !api.isPrimary(id) && !api.isUnified(id);
    };

    /**
     * get unified mailbox name
     * @return {deferred} returns array or null
     */
    api.getUnifiedMailboxName = function () {
        var def = $.Deferred();
        require(['io.ox/core/api/folder'], function (folderAPI) {
            return $.when(
                folderAPI.getSubFolders(),
                api.all()
            ).then(function (folders, accounts) {
                var mailFolders, mailAccounts, unified, diff;

                mailFolders = _(folders).chain()
                    .filter(function (folder) { return folder.id.match(/^default(\d+)/);  })
                    .map(function (folder) { return parseInt(folder.id.match(/^default(\d+)/)[1], 10); })
                    .uniq().value();
                mailAccounts = _(accounts).map(function (account) { return account.id; });
                diff = _.difference(mailFolders, mailAccounts);

                if (diff.length > 0) {
                    return def.resolve('default' + diff[0]);
                }
                return def.resolve(null);
            });
        });
        return def;
    };

    /**
     * check folder type
     * @param  {string} type (foldertype, example is 'drafts')
     * @param  {type} id [optional]
     * @return {boolean}
     */
    api.is = (function () {

        var unifiedFolders = {
            inbox:  /^default\d+\DINBOX(?:\/|$)/,
            sent:   /^default\d+\DSent(?:\/|$)/,
            trash:  /^default\d+\DTrash(?:\/|$)/,
            drafts: /^default\d+\DDrafts(?:\/|$)/,
            spam:   /^default\d+\DSpam(?:\/|$)/
        };

        function is(type, id) {
            if (api.isUnified(id)) {
                var re = unifiedFolders[type];
                return Boolean(re && re.test(id));
            } else {
                return typeHash[id] === type;
            }
        }

        return function (type, id) {
            type = String(type || '').split('|');
            return _(type).reduce(function (memo, type) {
                return memo || is(type, id);
            }, false);
        };
    }());

    /**
     * return folders for accounts
     * @param  {string} type ('inbox', 'send', 'drafts')
     * @return {array} folders
     */
    api.getFoldersByType = function (type) {
        return _(typeHash).chain().map(function (value, key) {
            return value === type ? key : null;
        }).compact().value();
    };

    /**
     * get account id
     * @param  {string|number} str (folder_id|account_id)
     * @param  {boolean} strict
     * @return {integer} account id
     */
    api.parseAccountId = function (str, strict) {
        if (typeof str === 'number') {
            // return number
            return str;
        } else if (/^default(\d+)/.test(String(str))) {
            // is not unified mail?
            if (!api.isUnified(str)) {
                return parseInt(str.replace(/^default(\d+)(.*)$/, '$1'), 10);
            } else {
                // strip off unified prefix
                var tail = str.replace(regParseAccountId, '');
                if (tail !== str && /^default\d+/.test(tail)) {
                    return api.parseAccountId(tail, strict);
                } else {
                    if (!strict) {
                        return 0;
                    } else {
                        var m = str.match(/^default(\d+)/);
                        return m && m.length ? parseInt(m[1], 10) : 0;
                    }
                }
            }
        } else {
            // default account
            return 0;
        }
    };

    /**
     * get the primary address for a given account
     * @param  {string} account_id [optional: default account will be used instead]
     * @return {deferred} returns array (name, primary adress)
     */
    api.getPrimaryAddress = function (account_id) {

        return api.get(account_id || 0)
        .then(ensureDisplayName)
        .then(function (account) {

            if (!account) return $.Deferred().reject(account);

            // use user-setting for primary account and unified folders
            if (account_id === 0 || api.isUnified(account_id)) {
                return require(['settings!io.ox/mail']).then(function (settings) {
                    var defaultSendAddress = $.trim(settings.get('defaultSendAddress', ''));
                    return [account.personal, defaultSendAddress || account.primary_address];
                });
            }

            return [account.personal, account.primary_address];
        })
        .then(function (address) {
            return getAddressArray(address[0], address[1]);
        });
    };

    /**
     * get primary address from folder
     * @param  {string} folder_id
     * @return {deferred} object with properties 'displayname' and 'primaryaddress'
     */
    api.getPrimaryAddressFromFolder = function (folder_id) {

        // get account id (strict)
        var account_id = this.parseAccountId(folder_id, true),
            isUnified = api.isUnified(account_id);

        // get primary address
        return this.getPrimaryAddress(isUnified ? 0 : account_id);
    };

    api.getDefaultDisplayName = function () {
        return require(['io.ox/contacts/util', 'io.ox/core/api/user']).then(function (util, api) {
            return api.get({ id: ox.user_id }).then(function (data) {
                return util.getMailFullName(data);
            });
        });
    };

    // make sure account's personal is set
    var ensureDisplayName = (function () {

        var defer = null;

        return function (account) {

            // no account given or account already has "personal"
            if (!account || account.personal) {
                return $.Deferred().resolve(account);
            }

            if (defer === null) {
                // load personal once
                defer = api.getDefaultDisplayName();
            }

            return defer.then(function (personal) {
                account.personal = personal;
                return account;
            });
        };

    }());

    api.trimAddress = function (address) {
        address = $.trim(address);
        // apply toLowerCase only for mail addresses, don't change phone numbers
        return address.indexOf('@') > -1 ? address.toLowerCase() : address;
    };

    function getAddressArray(name, address) {
        name = $.trim(name || '');
        address = api.trimAddress(address);
        return [name !== address ? name : '', address];
    }

    /**
     * get sender adress
     * @param  {object} account
     * @return {deferred} returns array the personal name and a list of (alias) addresses
     */
    function getSenderAddress(account) {

        // just for robustness
        if (!account) return [];

        if (!account.addresses) { // null, undefined, empty
            return [getAddressArray(account.personal, account.primary_address)];
        }

        // looks like addresses continas primary address plus aliases
        var addresses = String(account.addresses || '').split(',').sort();
        // build common array of [display_name, email]
        return _(addresses).map(function (address) {
            return getAddressArray(account.personal, address);
        });
    }

    /**
     * get a list of addresses that can be used when sending mails
     * @param  {string} accountId [optional: default account will be used instead]
     * @return {deferred} returns array the personal name and a list of (alias) addresses
     */
    api.getSenderAddresses = function (accountId) {
        return this.get(accountId || 0)
            .then(ensureDisplayName)
            .then(getSenderAddress);
    };

    /**
     * get all sender addresses
     * @return {promise} returns array of arrays
     */
    api.getAllSenderAddresses = function () {
        return api.all()
        .then(function (list) {
            return $.when.apply($, _(list).map(ensureDisplayName));
        })
        .then(function () {
            return _(arguments).flatten(true);
        })
        .then(function (list) {
            return $.when.apply($, _(list).map(getSenderAddress));
        })
        .then(function () {
            return _(arguments).flatten(true);
        })
        .then(function (addresses) {
            // addresses.unshift(['Matthias Biggeleben', 'all@open-xchange.com']);
            // addresses.unshift(['Matthias Biggeleben', 'all@open-xchange.com']);
            // addresses.push(['Matthias Biggeleben', 'all@open-xchange.com']);
            return addresses;
        });
    };

    /**
     * Get all mail accounts
     */

    var accountsAllCache = new Cache.ObjectCache('account', true, function (o) { return String(o.id); });

    /**
     * get all accounts
     * @return {deferred} returns array of account object
     */
    api.all = function () {

        var getter = function () {
            return http.GET({
                module: 'account',
                params: { action: 'all' },
                appendColumns: true,
                processResponse: true
            });
        };

        return accountsAllCache.keys().pipe(function (keys) {
            if (keys.length > 0) {
                return accountsAllCache.values();
            } else if (ox.online) {
                return getter().pipe(function (data) {
                    data = process(data);
                    accountsAllCache.add(data);
                    return data;
                });
            } else {
                return [];
            }
        })
        .pipe(function (list) {

            idHash = {};
            typeHash = {};

            _(list).each(function (account) {
                // remember account id
                idHash[account.id] = true;
                // remember types
                _('sent trash drafts spam'.split(' ')).each(function (type) {
                    typeHash[account[type + '_fullname']] = type;
                });
                // add inbox
                typeHash['default' + account.id + '/INBOX'] = 'inbox';
            });
            return list;
        });
    };


    /**
     * get mail account
     * @param  {string} id
     * @return {deferred} returns account object
     */
    api.get = function (id) {

        var getter = function () {
            return api.all().pipe(function () {
                return accountsAllCache.get(id);
            });
        };

        return accountsAllCache.get(id, getter);
    };

    /**
     * create mail account
     * @param  {object} data (attributes)
     * @fires  api#create:account (data)
     * @return {deferred}
     */
    api.create = function (data) {
        return http.PUT({
            module: 'account',
            params: { action: 'new' },
            data: data,
            appendColumns: false
        })
        .then(function (data) {
            // reload all accounts
            return accountsAllCache.clear()
            .then(function () {
                return api.all();
            })
            .then(function () {
                api.trigger('create:account', { id: data.id, email: data.primary_address, name: data.name });
                require(['io.ox/core/api/folder'], function (api) {
                    api.propagate('account:create');
                });
                return data;
            });
        });
    };

    /**
     * delete mail account
     * @param  {object} data (attributes)
     * @fires  api#refresh.all
     * @fires  api#delete
     * @return {deferred}
     */
    api.remove = function (data) {
        return http.PUT({
            module: 'account',
            params: {action: 'delete'},
            data: data
        }).done(function () {
            accountsAllCache.remove(data).done(function () {
                api.trigger('refresh.all');
                api.trigger('delete');
                require(['io.ox/core/api/folder'], function (api) {
                    api.propagate('account:delete');
                });
            });
        });
    };

    /**
     * validate account data
     * @param  {object} data (accont object)
     * @return {deferred} returns boolean
     */
    api.validate = function (data) {
        return http.PUT({
            module: 'account',
            appendColumns: false,
            params: { action: 'validate' },
            data: data
        })
        // always successful but either true or false
        .then(
            function success(bool) {
                return $.Deferred().resolve(bool);
            },
            function fail() {
                return $.Deferred().resolve(false);
            }
        );
    };

    /**
     * update account
     * @param  {object} data (account)
     * @return {deferred} returns new account object
     */
    api.update = function (data) {
        // don't send computed data
        delete data.mail_url;
        delete data.transport_url;
        // update
        return http.PUT({
            module: 'account',
            params: { action: 'update' },
            data: data
        })
        .then(function (result) {

            // detect changes
            accountsAllCache.get(result).done(function (obj) {
                var enabled = result.unified_inbox_enabled;
                if (obj !== null && obj.unified_inbox_enabled !== enabled) {
                    require(['io.ox/core/api/folder'], function (api) {
                        api.propagate(enabled ? 'account:unified-enable' : 'account:unified-disable');
                    });
                }
            });

            return accountsAllCache.remove(data).then(function () {
                if (_.isObject(result)) {
                    //update call returned the new object, just return it
                    return result;
                }
                // update call didn’t return the new account -> get the data ourselves
                return http.GET({
                    module: 'account',
                    params: { action: 'get', id: data.id },
                    appendColumns: false
                });
            }).then(function (result) {
                // update call returned the new account (this is the case for mail)
                return accountsAllCache.add(result, _.now());
            }).done(function () {
                api.trigger('refresh.all');
                api.trigger('update', result);
            });
        });
    };

    /**
     * get autoconfig for given emailadress
     * @param  {object} data (email, password)
     * @return {deferred} returns best available mail server settings (may be incomplete or empty)
     */
    api.autoconfig = function (data) {
        return http.GET({
            module: 'autoconfig',
            params: {
                action: 'get',
                email: data.email,
                password: data.password
            }
        });
    };

    api.cache = accountsAllCache;

    /**
     * jslob testapi
     * @return {deferred}
     */
    api.configtestAll = function () {
        return http.GET({
            module: 'jslob',
            params: {
                action: 'all'
            }
        });
    };

    /**
     * jslob testapi
     * @return {deferred}
     */
    api.configtestList = function (data) {
        return http.PUT({
            module: 'jslob',
            params: {
                action: 'list'
            },
            data: data
        });
    };

    /**
     * jslob testapi
     * @return {deferred}
     */
    api.configtestUpdate = function (data, id) {
        return http.PUT({
            module: 'jslob',
            params: {
                action: 'update',
                id: id
            },
            data: data
        });
    };

    /**
     * jslob testapi
     * @return {deferred}
     */
    api.configtestSet = function (data, id) {
        return http.PUT({
            module: 'jslob',
            params: {
                action: 'set',
                id: id
            },
            data: data
        });
    };

    /**
     * bind to global refresh; clears caches and trigger refresh.all
     * @fires  api#refresh.all
     * @return {promise}
     */
    api.refresh = function () {
        accountsAllCache.clear().then(function () {
            api.trigger('refresh.all');
        });
    };

    ox.on('refresh^', function () {
        api.refresh();
    });

    return api;
});
