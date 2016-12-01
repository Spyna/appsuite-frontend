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
 * @author Julian Bäume <julian.baeume@open-xchange.com>
 */

define('io.ox/oauth/backbone', [
    'io.ox/core/http',
    'less!io.ox/oauth/style'
], function (http) {
    'use strict';

    var generateId = function () {
        generateId.id = generateId.id + 1;
        return generateId.id;
    };

    generateId.id = 1;

    var Account = {};

    Account.Model = Backbone.Model.extend({
        hasScope: function (scope) {
            return _(this.get('enabledScopes')).contains(scope);
        },
        enableScopes: function (scopes) {
            var wanted = this.get('wantedScopes') || this.get('enabledScopes') || [];
            scopes = _([].concat(scopes, wanted)).uniq();
            //if scopes is empty, add all availableScopes by default?
            this.set('wantedScopes', scopes);

            return this;
        },
        disableScopes: function (scopes) {
            var wanted = this.get('wantedScopes') || this.get('enabledScopes') || [];
            scopes = _(wanted).difference([].concat(scopes));
            this.set('wantedScopes', scopes);

            return this;
        },
        reauthorize: function (options) {
            options = _.extend({ force: true }, options);
            var account = this,
                needsReauth = options.force || (this.get('wantedScopes') || []).reduce(function (acc, scope) {
                    return acc || !account.hasScope(scope);
                }, false);
            if (!needsReauth) return $.when();

            var callbackName = 'oauth' + generateId(),
                params = {
                    action: 'init',
                    serviceId: account.get('serviceId'),
                    displayName: account.get('displayName'),
                    cb: callbackName,
                    id: account.id
                };

            params.scopes = (_([].concat(this.get('enabledScopes'), this.get('wantedScopes'))).uniq()).join(' ');
            var popupWindow = window.open(ox.base + '/busy.html', '_blank', 'height=800, width=1200, resizable=yes, scrollbars=yes');
            popupWindow.focus();

            return http.GET({
                module: 'oauth/accounts',
                params: params
            })
            .then(function (interaction) {
                var def = $.Deferred();

                window['callback_' + callbackName] = def.resolve;
                popupWindow.location = interaction.authUrl;

                return def;
            }).then(function () {
                delete window['callback_' + callbackName];
                popupWindow.close();
                account.enableScopes(account.get('enabledScopes'));
                account.set('enabledScopes', account.get('wantedScopes'));
                account.unset('wantedScopes');
                return account;
            });
        },
        sync: function (method, model, options) {
            switch (method) {
                case 'create':
                    var popupWindow = model.get('popup') || window.open(ox.base + '/busy.html', '_blank', 'height=800, width=1200, resizable=yes, scrollbars=yes');
                    return require(['io.ox/core/tk/keys']).then(function () {

                        var callbackName = 'oauth' + generateId(),
                            params = {
                                action: 'init',
                                cb: callbackName,
                                display: 'popup',
                                displayName: model.get('displayName'),
                                redirect: true,
                                serviceId: model.get('serviceId'),
                                session: ox.session
                            },
                            def = $.Deferred();

                        if (model.get('wantedScopes').length > 0) params.scopes = model.get('wantedScopes').join(' ');

                        window['callback_' + callbackName] = def.resolve;

                        popupWindow.location = ox.apiRoot + '/oauth/accounts?' + $.param(params);

                        return def.done(function () {
                            delete window['callback_' + callbackName];
                        });
                    }).then(function (response) {
                        // FIXME: should the caller close the popup?
                        popupWindow.close();

                        if (!response.data) {
                            // TODO handle a possible error object in response
                            return $.Deferred().reject();
                        }

                        var id = response.data.id;
                        //get fresh data from the server to be sure we have valid data (IE has some problems otherwise see Bug 37891)
                        return http.GET({
                            module: 'oauth/accounts',
                            params: {
                                action: 'get',
                                id: id
                            }
                        }).then(function (res) {
                            model.set(res);
                            return res;
                        });
                    }).done(options.success).fail(options.error);
                case 'update':
                    return model.reauthorize({ force: false }).then(function () {
                        if (!model.changed.displayName) return;
                        return http.PUT({
                            module: 'oauth/accounts',
                            params: {
                                action: 'update',
                                id: model.id
                            },
                            data: {
                                displayName: model.get('displayName')
                            }
                        });
                    }).then(function () {
                        return model.toJSON();
                    }).done(options.success).fail(options.error);
                case 'delete':
                    return http.PUT({
                        module: 'oauth/accounts',
                        params: {
                            action: 'delete',
                            id: model.id
                        }
                    }).done(options.success).fail(options.error);
                case 'read':
                    return http.GET({
                        module: 'oauth/accounts',
                        params: {
                            action: 'get',
                            id: model.id
                        }
                    }).then(function (res) {
                        model.set(res);
                        return res;
                    }).done(options.success).fail(options.error);
                default:
            }
        }
    });

    Account.Collection = Backbone.Collection.extend({
        model: Account.Model,
        forService: function (serviceId, limits) {
            limits = _.extend({}, limits);
            return this.filter(function (account) {
                return account.get('serviceId') === serviceId &&
                    (!limits.scope || _(account.get('enabledScopes')).contains(limits.scope));
            });
        }
    });

    var iconsForService = {
        'com.openexchange.oauth.google': 'fa-google',
        'com.openexchange.oauth.yahoo': 'fa-yahoo'
    };

    var ServiceItemView = Backbone.View.extend({
        tagName: 'li',
        className: 'service-item',
        render: function () {
            this.$el.attr({
                role: 'button',
                tabindex: '0'
            }).append(
                $('<i class="service-icon fa">')
                    .addClass(this.model.get('icon') || iconsForService[this.model.id] || 'fa-envelope'),
                this.model.get('displayName')
            ).data({
                cid: this.model.cid
            });
            return this;
        }
    });
    var ServicesListView = Backbone.View.extend({
        tagName: 'ul',
        className: 'form-group list-unstyled services-list-view',
        events: {
            'keypress li': 'select',
            'click li': 'select'
        },
        ItemView: ServiceItemView,
        render: function () {
            var ItemView = this.ItemView;
            this.$el.append(
                this.collection.map(function (service) {
                    var view = new ItemView({
                        model: service
                    });
                    return view.render().$el;
                })
            );
            return this;
        },
        select: function (ev) {
            //ignore keypress events other than space and return keys
            if (ev.type === 'keypress' && ev.which !== 13 && ev.which !== 32) return;

            var service = this.collection.get($(ev.currentTarget).data('cid'));
            this.trigger('select', service);
            this.trigger('select:' + service.id, service);
        }
    });

    return {
        Account: Account,
        Views: {
            ServicesListView: ServicesListView,
            ServiceItemView: ServiceItemView
        }
    };
});
