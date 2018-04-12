/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2017 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Richard Petersen <richard.petersen@open-xchange.com>
 */

define('io.ox/settings/security/sessions/settings/pane', [
    'io.ox/core/extensions',
    'io.ox/backbone/views/extensible',
    'gettext!io.ox/core',
    'io.ox/core/http',
    'io.ox/backbone/mini-views/settings-list-view',
    'io.ox/backbone/disposable',
    'io.ox/backbone/mini-views/listutils',
    'settings!io.ox/core',
    'less!io.ox/settings/security/sessions/settings/style'
], function (ext, ExtensibleView, gt, http, SettingsListView, DisposableView, listUtils, settings) {

    'use strict';

    function buildConfirmationDialog(text, confirmText) {
        var def = new $.Deferred();
        confirmText = confirmText || gt('Ok');
        require(['io.ox/backbone/views/modal'], function (ModalDialog) {
            new ModalDialog({ title: text, async: true })
            .build(function () { this.$body.remove(); })
            .addCancelButton()
            .addButton({ label: confirmText, action: 'ok' })
            .on('ok', def.resolve)
            .open();
        });
        return def.promise();
    }

    var SessionModel = Backbone.Model.extend({

        idAttribute: 'sessionId',

        initialize: function () {
            ext.point('io.ox/settings/sessions/deviceType').invoke('customize', this);
            ext.point('io.ox/settings/sessions/operatingSystem').invoke('customize', this);
            ext.point('io.ox/settings/sessions/application').invoke('customize', this);
        },

        getDeviceInfo: function (name) {
            var device = this.get('device') || {};
            return device[name] || {};
        }

    });

    ext.point('io.ox/settings/sessions/deviceType').extend({
        id: 'desktop-mobile',
        index: 100,
        customize: function () {
            var os = this.getDeviceInfo('os').name || '';
            if (os === 'ios' || os === 'android') this.set('deviceType', 'phone');
            else this.set('deviceType', 'desktop');
        }
    });

    ext.point('io.ox/settings/sessions/operatingSystem').extend({
        id: 'os',
        index: 100,
        customize: (function () {
            var mapping = {
                //#. Context: Session Management. Active session on platform/os.
                windows: gt('Windows'),
                //#. Context: Session Management. Active session on platform/os.
                linux: gt('Linux'),
                //#. Context: Session Management. Active session on platform/os.
                macos: gt('Mac'),
                //#. Context: Session Management. Active session on platform/os.
                ios: gt('iOS'),
                //#. Context: Session Management. Active session on platform/os.
                android: gt('Android')
            };

            return function () {
                var os = this.getDeviceInfo('os').name || '';
                this.set('operatingSystem', mapping[os]);
            };
        }())
    });

    ext.point('io.ox/settings/sessions/application').extend({
        id: 'browsers',
        index: 100,
        customize: (function () {
            var mapping = {
                chrome: gt('Chrome'),
                safari: gt('Safari'),
                'mobile safari': gt('Safari'),
                firefox: gt('Firefox'),
                edge: gt('Edge'),
                msie: gt('Internet Explorer'),
                opera: gt('Opera'),
                chromium: gt('Chromium')
            };
            return function () {
                var deviceInfo = this.getDeviceInfo('client');
                if (deviceInfo.type !== 'browser') return;
                var family = deviceInfo.family || '',
                    name = deviceInfo.name || '';
                this.set('application', mapping[family] || mapping[name]);
            };
        }())
    });

    ext.point('io.ox/settings/sessions/application').extend({
        id: 'oxapp',
        index: 200,
        customize: (function () {
            var mapping = {
                oxdriveapp: settings.get('productname/oxdrive') || 'OXDrive',
                oxmailapp: settings.get('productname/mailapp') || 'OX Mail',
                oxsyncapp: settings.get('productname/oxtender') || 'OXtender'
            };
            return function () {
                var deviceInfo = this.getDeviceInfo('client');
                if (deviceInfo.type !== 'oxapp') return;
                var family = deviceInfo.family || deviceInfo.name || '',
                    name = deviceInfo.name || '';
                this.set('application', mapping[family] || mapping[name]);
            };
        }())
    });

    ext.point('io.ox/settings/sessions/application').extend({
        id: 'dav',
        index: 300,
        customize: (function () {
            var mapping = {
                //#. Context: Session Management. Refers to the macos calendar
                macos_calendar: gt('Calendar'),
                //#. Context: Session Management. Refers to the macos addressbook
                macos_addressbook: gt('Addressbook'),
                //#. Context: Session Management. Refers to ios calendar and/or addressbook
                'ios_calendar/addressbook': gt('Calendar/Addressbook'),
                thunderbird_lightning: gt('Thunderbird Lightning'),
                emclient: gt('eM Client'),
                emclient_appsuite: gt('Appsuite eM Client'),
                caldav_sync: gt('CalDav'),
                carddav_sync: gt('CardDav'),
                davdroid: gt('DAVdroid'),
                windows_phone: gt('CalDav/CardDav'),
                windows: gt('CalDav/CardDav'),
                generic_caldav: gt('CalDav'),
                generic_carddav: gt('CardDav')
            };
            return function () {
                var deviceInfo = this.getDeviceInfo('client');
                if (deviceInfo.type !== 'dav') return;
                var family = deviceInfo.family || deviceInfo.name || '',
                    name = deviceInfo.name || '';
                this.set('application', mapping[family] || mapping[name] || gt('CalDav/CardDav'));
            };
        }())
    });

    ext.point('io.ox/settings/sessions/application').extend({
        id: 'eas',
        index: 400,
        customize: (function () {
            var mapping = {
                usmeasclient: gt('Exchange Active Sync')
            };
            return function () {
                var deviceInfo = this.getDeviceInfo('client');
                if (deviceInfo.type !== 'eas') return;
                var family = deviceInfo.family || '',
                    name = deviceInfo.name || '';
                this.set('application', mapping[family] || mapping[name] || gt('Exchange Active Sync'));
            };
        }())
    });

    var SessionCollection = Backbone.Collection.extend({

        model: SessionModel,

        comparator: function (model) {
            // sort ascending
            // current session should always be topmost
            if (model.get('sessionId') === ox.session) return -10000000000000;
            return -model.get('lastActive');
        },

        initialize: function () {
            this.initial = this.fetch();
        },

        fetch: function () {
            var self = this;
            return http.GET({
                url: '/ajax/sessionmanagement?action=all'
            }).then(function success(data) {
                self.set(data);
            });
        }
    });

    var SessionItemView = DisposableView.extend({

        tagName: 'li',

        className: 'settings-list-item',

        events: {
            'click a[data-action="delete"]': 'onDelete'
        },

        render: function () {
            var isCurrent = this.model.get('sessionId') === ox.session,
                lastActive = this.model.has('lastActive') ? moment(this.model.get('lastActive')).fromNow() : '';
            this.$el.empty().append(
                $('<div>').append(
                    $('<div class="fa-stack client-icon">').addClass(this.model.get('deviceType')).addClass(this.model.get('os')).append(
                        $('<i class="fa fa-stack-1x device" aria-hidden="true">'),
                        $('<i class="fa fa-stack-1x os" aria-hidden="true">')
                    ),
                    $('<div class="primary">').append(
                        $('<span>').text(this.model.get('application') || gt('Unknown application')),
                        $('<span>').text('(' + (this.model.get('operatingSystem') || gt('Unknown device')) + ')')
                    ),
                    $('<div class="secondary">').append(
                        $('<span>').text(this.model.get('location')),
                        //#. text in the settings pane to indicate session that is currently active
                        isCurrent ? $('<span class="label label-success">').text(gt('Now active')) : $('<span>').text(lastActive)
                    )
                ),
                $('<div class="list-item-controls">').append(
                    !isCurrent ? $('<a href="#" class="action" data-action="delete">').text(gt('Sign out')) : ''
                )
            );
            return this;
        },
        onDelete: function (e) {
            var self = this,
                // assign collection here since the view might be removed later
                collection = this.collection;
            e.preventDefault();
            buildConfirmationDialog(gt('Do you really want to sign out from that device?'), gt('Sign out')).done(function () {
                var dialog = this;
                http.PUT({
                    url: '/ajax/sessionmanagement',
                    params: {
                        action: 'delete'
                    },
                    data: [self.model.get('sessionId')]
                }).fail(function (error) {
                    require(['io.ox/core/yell'], function (yell) {
                        yell(error);
                    });
                    collection.fetch();
                }).always(function () {
                    dialog.close();
                });

                // trigger destroy will remove the model from all collections
                // do not use destroy(), because that will use the backbone sync mechanism
                self.model.trigger('destroy', self.model);
            });
        }

    });

    var SessionView = Backbone.View.extend({

        className: 'session-list-container',

        initialize: function () {
            this.$el.data('view', this);
        },

        render: function () {
            var self = this;
            this.collection.initial.always(function () {
                self.$el.append(
                    self.listView = new SettingsListView({
                        collection: self.collection,
                        childView: SessionItemView,
                        childOptions: { collection: self.collection }
                    }).render().$el
                );
            });
            return this;
        }

    });

    ext.point('io.ox/settings/security/sessions/settings/detail').extend({
        id: 'view',
        index: 100,
        draw: function () {
            this.append(
                new ExtensibleView({
                    point: 'io.ox/settings/sessions/settings/detail/view',
                    collection: new SessionCollection()
                })
                .render().$el
            );
        }
    });

    ext.point('io.ox/settings/sessions/settings/detail/view').extend({
        id: 'title',
        index: 100,
        render: function () {
            this.$el
                .addClass('io-ox-session-settings')
                .append(
                    $('<h1>').text(gt('You are currently signed in with the following devices'))
                );
        }
    });

    ext.point('io.ox/settings/sessions/settings/detail/view').extend({
        id: 'spinner',
        index: 200,
        render: function (baton) {
            var spinner;
            this.$el.append(spinner = $('<div>').busy());
            baton.view.collection.initial.always(function () {
                spinner.remove();
            });
        }
    });

    ext.point('io.ox/settings/sessions/settings/detail/view').extend({
        id: 'list',
        index: 300,
        render: function (baton) {
            this.$el.append(
                new SessionView({
                    collection: baton.view.collection
                }).render().$el
            );
        }
    });

    ext.point('io.ox/settings/sessions/settings/detail/view').extend({
        id: 'remove-all',
        index: 1000,
        render: function (baton) {
            var link;
            this.$el.append(
                link = $('<button data-action="remove-all" class="btn btn-primary hidden">').text('Sign out from all clients').on('click', function (e) {
                    e.preventDefault();
                    buildConfirmationDialog(gt('Do you really want to sign out from all clients except the current one?'), gt('Sign out')).done(function () {
                        var dialog = this;
                        this.busy();
                        http.GET({
                            url: '/ajax/sessionmanagement',
                            params: { action: 'clear' }
                        }).fail(function (error) {
                            require(['io.ox/core/yell'], function (yell) {
                                yell(error);
                            });
                        }).always(function () {
                            baton.view.collection.fetch().always(dialog.close);
                        });
                    });
                })
            );
            baton.view.collection.initial.done(function () {
                if (baton.view.collection.length === 0) return;
                link.removeClass('hidden');
            });
        }
    });

    return {
        Model: SessionModel,
        Collection: SessionCollection,
        View: SessionView
    };

});
