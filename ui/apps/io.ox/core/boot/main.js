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

define('io.ox/core/boot/main', [

    'themes',
    'gettext',
    'io.ox/core/manifests',
    'io.ox/core/session',
    'io.ox/core/boot/util',
    'io.ox/core/boot/form',
    'io.ox/core/boot/config',
    'io.ox/core/boot/login/auto',
    'io.ox/core/boot/login/token'

], function (themes, gettext, manifests, session, util, form, config, autologin, tokenlogin) {

    'use strict';

    var exports = {

        start: function () {

            var loginType = this.getLoginType();

            util.debug('loginType=' + loginType);

            switch (loginType) {
            case 'none': return this.useForm();
            case 'cookie': return this.useCookie();
            case 'session': return this.useSession();
            case 'token': return this.useToken();
            }
        },

        getLoginType: function () {
            var hash = _.url.hash();
            if (hash.login_type !== undefined) return hash.login_type;
            if (hash.tokenSession) return 'token';
            if (hash.session) return 'session';
            if (hash.autologin === 'false') return 'none';
            return 'cookie';
        },

        useForm: function () {

            config.server().done(function serverConfigLoaded() {

                // forceHTTPS
                if (ox.serverConfig.forceHTTPS && location.protocol !== 'https:' && !ox.debug) {
                    location.href = 'https:' + location.href.substring(location.protocol.length);
                    return;
                }

                // set page title now
                util.setPageTitle(
                    ox.serverConfig.pageTitle + (_.device('small') ? ' Login' : '')
                );

                gettext.setLanguage('en_US');

                var theme = _.url.hash('theme') || ox.serverConfig.signinTheme || 'login';
                util.debug('Load default language and theme ...', theme);

                // theme
                $.when(
                    themes.set(theme),
                    require(['io.ox/core/boot/i18n'])
                )
                .done(function () {
                    // log
                    util.debug('Load default language and theme DONE.');
                    form();
                });
            });
        },

        useCookie: function () {
            autologin();
        },

        useSession: function () {
            tokenlogin(); // yep, both use tokenlogin
        },

        useToken: function () {
            tokenlogin(); // yep, both use tokenlogin
        },

        loadUI: function () {

            util.debug('Load UI ...');
            util.debug('Load UI > load core plugins and current language', ox.language);

            // signin phase is over (important for gettext)
            ox.signin = false;

            // make sure we have loaded precore.js now
            $.when(
                require(['io.ox/core/boot/load', ox.base + '/precore.js']),
                gettext.setLanguage(ox.language),
                manifests.manager.loadPluginsFor('core')
            )
            .then(function (response) {
                return response[0];
            })
            .done(function (load) {
                util.debug('Load UI > current language and core plugins DONE.');
                gettext.enable();
                load();
            });
        }
    };

    //
    // Respond to failed login
    //

    ox.once('login:fail', function () {
        exports.useForm();
    });

    //
    // Respond to successful login
    //

    ox.once('login:success', function (data) {

        $('#background-loader').fadeIn(util.DURATION, function () {
            $('#io-ox-login-screen').hide().empty();
        });

        // load user config
        config.user().done(function () {
            // apply session data (again) & page title
            session.set(data);
            util.setPageTitle(ox.serverConfig.pageTitle);
            // load UI
            exports.loadUI();
        });
    });

    return exports;

});
