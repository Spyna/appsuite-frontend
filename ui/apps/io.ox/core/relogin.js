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

define('io.ox/core/relogin', [
    'io.ox/core/extensions',
    'io.ox/core/session',
    'io.ox/core/notifications',
    'io.ox/core/capabilities',
    'io.ox/core/boot/util',
    'io.ox/backbone/views/modal',
    'gettext!io.ox/core',
    'settings!io.ox/core'
], function (ext, session, notifications, capabilities, util, ModalDialog, gt, settings) {

    'use strict';

    ext.point('io.ox/core/relogin').extend({
        id: 'default',
        render: function () {
            this.$body.append(
                $('<div>').text(gt('You have to sign in again'))
            );
            this.addButton({ action: 'ok', label: gt('Ok') });
            this.on('ok', function () {
                this.trigger('relogin:continue');
            });
        }
    }, {
        id: 'password',
        index: 100,
        render: function (baton) {
            if (!settings.get('features/reloginPopup', !ox.serverConfig.oidcLogin && !ox.serverConfig.samlLogin)) return;
            // no pwd for guests via link or guests that actually have not set a password
            if (capabilities.has('guest && anonymous') || (capabilities.has('guest') && settings.get('password/emptyCurrent'))) return;

            var guid = _.uniqueId('form-control-label-');
            this.$header.append(
                $('<div>').text(gt('Please sign in again to continue'))
            );
            this.$body.append(
                $('<label>').attr('for', guid).text(gt('Password')),
                $('<input type="password" name="relogin-password" class="form-control">').attr('id', guid)
            );
            this
            .addButton({ className: 'btn-default', label: gt('Cancel'), placement: 'left', action: 'cancel' })
            .addButton({ action: 'relogin', label: gt('Sign in') })
            .on('cancel', function () {
                ox.trigger('relogin:cancel');
                gotoLogoutLocation();
            })
            .on('relogin', function () {
                var self = this.busy();
                // relogin
                session.login({
                    name: ox.user,
                    password: this.$body.find('input').val(),
                    rampup: false,
                    staySignedIn: ox.secretCookie
                }).then(
                    function success() {
                        notifications.yell('close');
                        self.$body.find('input').val('');
                        self.trigger('relogin:success');
                        self.close();
                    },
                    function fail(e) {
                        // eloquentify standard error message ;-)
                        if (e.code === 'LGI-0006') {
                            e.error = gt('Please enter correct password');
                        }
                        notifications.yell({
                            headline: gt('Failed to sign in'),
                            type: 'error',
                            message: e.error
                        });
                        self.idle();
                        self.$body.find('input').focus().select();
                        self.trigger('relogin:fail', e);
                    }
                );
            });

            baton.preventDefault();
        }
    });

    function getReason(error) {
        return error && error.code === 'SES-0205' ?
            gt('Your IP address has changed') :
            gt('Your session is expired');
    }

    function getLoginLocation() {
        var location = capabilities.has('guest') ?
            settings.get('customLocations/guestLogin') || ox.serverConfig.guestLoginLocation :
            settings.get('customLocations/login') || ox.serverConfig.loginLocation;
        return _.url.vars(location || ox.loginLocation || '');
    }

    function getLogoutLocation() {
        var location = capabilities.has('guest') ?
            settings.get('customLocations/guestLogout') || ox.serverConfig.guestLogoutLocation :
            settings.get('customLocations/logout') || ox.serverConfig.logoutLocation;
        return _.url.vars(location || ox.logoutLocation || '');
    }

    function gotoLoginLocation() {
        _.url.redirect(getLoginLocation());
    }

    function gotoLogoutLocation() {
        _.url.redirect(getLogoutLocation());
    }

    ext.point('io.ox/core/boot/login').replace({
        id: 'default',
        relogin: function (baton) {
            if (baton.data.reloginState !== 'success') return gotoLoginLocation();
            if (util.checkTabHandlingSupport()) {
                require(['io.ox/core/api/tab'], function (tabAPI) {
                    tabAPI.propagate('propagateLogin', {
                        session: ox.session,
                        language: ox.language,
                        theme: ox.theme,
                        user: ox.user,
                        user_id: ox.user_id,
                        context_id: ox.context_id,
                        relogin: true,
                        exceptWindow: tabAPI.getWindowName(),
                        storageKey: tabAPI.DEFAULT_STORAGE_KEYS.SESSION
                    });
                });
            }
        }
    });

    function showDialog(error) {
        var def = $.Deferred();
        new ModalDialog({
            async: true,
            enter: 'relogin',
            backdrop: 'static',
            focus: 'input',
            title: getReason(error),
            point: 'io.ox/core/relogin'
        })
        .build(function () {
            this.$el.addClass('relogin');
        }).on('open', function () {
            $('html').addClass('relogin-required');
            $('#io-ox-core').addClass('blur');
        }).on('relogin:continue', function () {
            def.resolve({ reason: 'relogin:continue' });
        })
        .on('relogin:success', function () {
            def.resolve({ reason: 'relogin:success' });
        })
        .open();

        return def.done(function () {
            $('html').removeClass('relogin-required');
            $('#io-ox-core').removeClass('blur');
        });
    }


    ext.point('io.ox/core/boot/login').extend({
        id: 'userPrompt',
        index: 5000,
        relogin: function (baton) {
            return showDialog(baton.data.error).then(function (result) {
                if (result && result.reason === 'relogin:success') baton.data.reloginState = 'success';
            });
        }
    });

    var queue = [], pending = false;
    function relogin(request, deferred, error) {

        if (!ox.online) return;

        if (!pending) {

            // enqueue last request
            queue = (request && deferred) ? [{ request: request, deferred: deferred }] : [];

            // set flag
            pending = true;

            var Stage = require('io.ox/core/extPatterns/stage');
            var baton = ext.Baton.ensure({ error: error, reloginState: 'pending' });
            Stage.run('io.ox/core/boot/login', baton, { methodName: 'relogin' }).then(function () {
                if (baton.data.reloginState !== 'success') return;
                // process queue
                var i = 0, item, http = require('io.ox/core/http');
                for (; (item = queue[i]); i++) {
                    if (!item.request.noRetry) {
                        http.retry(item.request)
                            .done(item.deferred.resolve)
                            .fail(item.deferred.fail);
                    }
                }
                // set flag
                pending = false;
            });

        } else if (request && deferred) {
            // enqueue last request
            queue.push({ request: request, deferred: deferred });
        }
    }

    ox.off('relogin:required', ox.relogin);
    ox.on('relogin:required', relogin);

    return relogin;
});
