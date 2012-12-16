/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2011
 * Mail: info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

// init require.js
require({
    // inject version
    baseUrl: ox.base + "/apps",
    waitSeconds: 30 //_.browser.IE ? 20 : 10
});

// add fake console (esp. for IE)
if (typeof window.console === 'undefined') {
    window.console = { log: $.noop, debug: $.noop, error: $.noop, warn: $.noop };
}

$(document).ready(function () {

    "use strict";

    // animations
    var DURATION = 250,
        // flags
        relogin = false,
        // functions
        cont,
        cleanUp,
        gotoCore,
        loadCore,
        loginSuccess,
        fnSubmit,
        fnChangeLanguage,
        changeLanguage,
        setDefaultLanguage,
        autoLogin,
        initialize,
        // shortcut
        enc = encodeURIComponent;

    // suppress context menu
    $(document).on('contextmenu', function (e) {
        if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) {
            e.preventDefault();
        }
    });

    // check for supported browser
    function browserCheck() {
        var supp = false;
        _.each(_.browserSupport, function(value, key) {
            if (_.browser[key] >= value) {
                supp =  true;
            }
        });
        return supp;
    }

    // feedback
    function feedback(type, node) {
        $("#io-ox-login-feedback").empty().append(
            $('<div class="alert alert-block alert-' + type + ' selectable-text">').append(node)
        );
    }

    // continuation
    cont = function () {
        $("#io-ox-login-username").focus().select();
    };

    cleanUp = function () {
        // remove dom nodes
        $("#io-ox-login-footer").remove();
        // update form
        $("#io-ox-login-username").attr("disabled", "disabled");
        $("#io-ox-login-password").val("");
        // unbind
        $("#io-ox-login-form").off("submit");
        // free closures
        cleanUp = fnChangeLanguage = changeLanguage = initialize = $.noop;
    };

    gotoCore = function (viaAutoLogin) {
        if (ox.signin === true) {
            // show loader
            $("#background_loader").fadeIn(DURATION, function () {
                var location = "#?" + enc(
                    _.rot("session=" + ox.session + "&user=" + ox.user +
                        "&user_id=" + ox.user_id + "&language=" + ox.language, 1)
                );
                // use redirect servlet for real login request
                // this even makes chrome and safari asking for storing credentials
                // skip this for auto-login or during offline mode
                if (viaAutoLogin || !ox.online) {
                    _.url.redirect(location);
                } else {
                    // use redirect servlet
                    $("#io-ox-login-form")
                        .off('submit')
                        .attr('action', ox.apiRoot + '/redirect')
                        .removeAttr('target')
                        .find('input[type=hidden][name=location]').val(ox.root + '/' + location /* _.url.get(location) */).end()
                        .submit();
                }
            });
        } else {
            loadCore();
        }
    };

    /**
     * Load core
     */
    loadCore = function () {
        // remove unnecessary stuff
        cleanUp();
        // hide login dialog
        $("#io-ox-login-screen").hide();
        $(this).busy();
        // get configuration & core
        require(['io.ox/core/config', 'themes', 'settings!io.ox/core']).done(function (config, themes, settings) {
            var theme = settings.get('theme') || 'default';
            config.load().done(function () {
                $.when(
                    require(['io.ox/core/main']),
                    themes.set(theme)
                ).done(function (core) {
                    // go!
                    core.launch();
                })
                .fail(function (e) {
                    console.error('Cannot launch core!', e);
                });
            });
        });
    };

    // default success handler
    loginSuccess = gotoCore;

    /**
     * Handler for form submit
     */
    fnSubmit = function (e) {
        // stop unless iOS
        e.preventDefault();
        // restore form
        var restore = function () {
                // stop being busy
                $("#io-ox-login-blocker").hide();
                $("#io-ox-login-feedback").idle();
            },
            // fail handler
            fail = function (error, focus) {
                // fail
                $("#io-ox-login-feedback").idle();
                // visual response (shake sucks on touch devices)
                $("#io-ox-login-form").css('opacity', '');
                // show error
                if (error && error.error === '0 general') {
                    error = { error: $('#io-ox-login-feedback-strings').find('[data-i18n-id="no-connection"]').text() };
                }
                feedback('info', $.txt(_.formatError(error, "%1$s")));
                // restore form
                restore();
                // reset focus
                $("#io-ox-login-" + (_.isString(focus) ? focus : (relogin ? "password" : "username"))).focus().select();
            },
            // get user name / password
            username = $("#io-ox-login-username").val(),
            password = $("#io-ox-login-password").val();
        // be busy
        $("#io-ox-login-form").css('opacity', 0.5);
        $("#io-ox-login-blocker").show();
        $("#io-ox-login-feedback").busy().empty();
        // user name and password shouldn't be empty
        if ($.trim(username).length === 0) {
            return fail({ error: "Please enter your credentials.", code: "UI-0001" }, 'username');
        }
        if ($.trim(password).length === 0 && ox.online) {
            return fail({ error: "Please enter your password.", code: "UI-0002" }, 'password');
        }
        // login
        require(['io.ox/core/session']).done(function (session) {
            session.login(
                username,
                password,
                $("#io-ox-login-store-box").prop("checked")
            )
            .done(function () {
                // success
                restore();
                loginSuccess();
            })
            .fail(fail);
        });
    };

    changeLanguage = function (id) {
        // if the user sets a language on the login page, it will be used for the rest of the session, too
        return require(['io.ox/core/login.' + id]).done(function (gt) {
            // get all nodes
            $("[data-i18n]").each(function () {
                var node = $(this),
                    val = gt(node.attr("data-i18n")),
                    target = node.attr("data-i18n-attr") || 'text';
                switch (target) {
                case 'value': node.val(val); break;
                case 'text': node.text(val); break;
                case 'label': node.contents().get(-1).nodeValue = val; break;
                default: node.attr(target, val); break;
                }
            });
            // update placeholder (IE9 fix)
            if (_.browser.IE) {
                $('input[type=text], input[type=password]').val('').placeholder();
            }
        });
    };

    fnChangeLanguage = function (e) {
        // stop event
        e.preventDefault();
        // change language
        changeLanguage(e.data.id);
        // the user forced a language
        ox.forcedLanguage = e.data.id;
    }

    var getBrowserLanguage = function () {
        var language = (navigator.language || navigator.userLanguage).substr(0, 2),
            languages = ox.serverConfig.languages || {};
        return _.chain(languages).keys().find(function (id) {
                return id.substr(0, 2) === language;
            }).value();
    };
    /**
     * Set default language
     */
    setDefaultLanguage = function () {
        // look at navigator.language with en_US as fallback
        var navLang = (navigator.language || navigator.userLanguage).substr(0, 2),
            languages = ox.serverConfig.languages || {},
            lang = "en_US", id = "";
        for (id in languages) {
            // match?
            if (id.substr(0, 2) === navLang) {
                lang = id;
                break;
            }
        }
        return changeLanguage(lang);
    };

    /**
     * Relogin
     */
    (function () {

        var queue = [];

        ox.relogin = function (request, deferred) {
            if (!ox.online) {
                return;
            }
            if (!relogin) {
                // enqueue last request
                queue = [{ request: request, deferred: deferred }];
                // set flag
                relogin = true;
                // set header (if we come around here, we have extensions)
                require(['io.ox/core/extensions'], function (ext) {
                    ext.point('io.ox/core/relogin').invoke('draw', $('#io-ox-login-header').find('h1').empty());
                });
                // bind
                $("#io-ox-login-form").on("submit", fnSubmit);
                $("#io-ox-login-username").val(ox.user || "");
                $("#io-ox-login-password").val("");
                // set success handler
                loginSuccess = function () {
                    $("#io-ox-login-screen").fadeOut(DURATION, function () {
                        $("#io-ox-login-screen-decorator").hide();
                        // process queue
                        var i = 0, item, http = require('io.ox/core/http');
                        for (; (item = queue[i]); i++) {
                            http.retry(item.request)
                                .done(item.deferred.resolve)
                                .fail(item.deferred.fail);
                        }
                        // set flag
                        relogin = false;
                    });
                };
                // show login dialog
                $("#io-ox-login-screen-decorator").show();
                $("#io-ox-login-screen").addClass("relogin").fadeIn(DURATION, function () {
                    $("#io-ox-login-password").focus().select();
                });
            } else {
                // enqueue last request
                queue.push({ request: request, deferred: deferred });
            }
        };
    }());

    /**
     * Auto login
     */
    autoLogin = function () {

        function loadCoreFiles() {
            // Set user's language (as opposed to the browser's language)
            // Load core plugins
            return require(['io.ox/core/gettext', 'io.ox/core/manifests']).pipe(function (gt, manifests) {
                gt.setLanguage(ox.language);
                if (!ox.online) {
                    return require([ox.base + '/pre-core.js']);
                }
                return manifests.manager.loadPluginsFor('core').pipe(function () {
                    return require([ox.base + '/pre-core.js']);
                });
            });
        }

        require(['io.ox/core/session', 'io.ox/core/capabilities', 'io.ox/core/manifests']).done(function (session, capabilities, manifests) {

            var useAutoLogin = (true || capabilities.has("autologin")) && ox.online, initialized;

            function continueWithoutAutoLogin() {
                if (ox.signin) {
                    initialize();
                } else {
                    _.url.redirect('signin');
                }
            }

            function fetchUserSpecificServerConfig() {
                var def = $.Deferred();
                require(['io.ox/core/http', 'io.ox/core/cache'], function (http, cache) {
                    var configCache = new cache.SimpleCache('serverconfig', true);
                    if (ox.online) {
                        http.GET({
                            module: 'apps/manifests',
                            params: {
                                action: 'config'
                            }
                        }).done(function (data) {
                            configCache.add('userconfig', data);
                            ox.serverConfig = data;
                            capabilities.reset();
                            manifests.reset();
                            def.resolve();
                        }).fail(def.reject);
                    } else {
                        configCache.get('userconfig').done(function (data) {
                            if (data) {
                                ox.serverConfig = data;
                                capabilities.reset();
                                manifests.reset();
                                def.resolve();
                            } else {
                                def.reject();
                            }
                        });
                    }
                    
                }).fail(def.reject);
                return def;
            }

            // got session via hash?
            if (_.url.hash('session')) {

                ox.session = _.url.hash('session');
                ox.user = _.url.hash('user');
                ox.user_id = parseInt(_.url.hash('user_id') || '0', 10);
                ox.language = _.url.hash('language');
                _.url.redirect('#');

                initialized = fetchUserSpecificServerConfig();

                $.when(loadCoreFiles(), initialized).done(loadCore);

            } else {
                // try auto login!?
                (useAutoLogin ? session.autoLogin() : $.when())
                .done(function () {

                    if (useAutoLogin) {
                        fetchUserSpecificServerConfig().done(function () {
                            loadCoreFiles().done(function () { gotoCore(true); });
                        });
                    } else {
                        continueWithoutAutoLogin();
                    }
                })
                .fail(function () {
                    continueWithoutAutoLogin();
                });
            }
        });
    };

    /**
     * Initialize login screen
     */
    initialize = function () {
        // shortcut
        var sc = ox.serverConfig, lang = sc.languages, node, id = "", footer = "";
        // show languages
        if (lang !== false) {
            node = $("#io-ox-language-list");
            for (id in lang) {
                node.append(
                    $('<a href="#">')
                    .on('click', { id: id }, fnChangeLanguage)
                    .text(lang[id])
                );
                node.append(document.createTextNode("\u00A0 "));
            }
        } else {
            $("#io-ox-languages").remove();
        }
        // update header
        $("#io-ox-login-header-prefix").text((sc.pageHeaderPrefix || '') + ' ');
        $("#io-ox-login-header-label").text(sc.pageHeader || '');
        // update footer
        footer = sc.copyright ? sc.copyright + " " : "";
        footer += sc.version ? "Version: " + sc.version + " " : "";
        footer += sc.buildDate ? "(" + sc.buildDate + ")" : "";
        $("#io-ox-copyright").text(footer);
        // hide checkbox?
        if (sc.autoLogin === false) {
            $("#io-ox-login-store").remove();
        }
        // hide forgot password?
        if (sc.forgotPassword === false) {
            $("#io-ox-forgot-password").remove();
        } else {
            $("#io-ox-forgot-password").find("a").attr("href", sc.forgotPassword);
        }
        // disable password?
        if (!ox.online) {
            $("#io-ox-login-password").attr("disabled", "disabled");
            feedback('info', $.txt("Offline mode"));
        } else {
            $("#io-ox-login-password").removeAttr("disabled");
        }
        // supported browser?
        if (!browserCheck()) {
            // warn user
            feedback('info', $(
                    '<b>Your browser is currently not supported!</b> ' +
                    '<div>Please use <a href="http://www.google.com/chrome" target="_blank">Google Chrome</a> for best results.</di>'
                ));
        } else if (_.browser.IE <= 8) {
            // recommend chrome frame?
            var link = "http://www.google.com/chromeframe/?user=true";
            feedback('info', $(
                '<b>Your browser is slow and outdated!</b> ' +
                'Try <a href="' + link + '" target="_blank">Google Chrome Frame</a> ' +
                'for much better performance. It&rsquo;s awesome! ' +
                'You don&rsquo;t need administrator rights. Just restart IE after installation.</div>'
            ));
        }
        return $.when(
                // load extensions
                require(['io.ox/core/manifests']).pipe(function (manifests) {
                    return manifests.manager.loadPluginsFor(ox.signin ? 'signin' : 'core');
                }),
                // use browser language
                setDefaultLanguage()
            )
            .done(function () {
                // show login dialog
                $("#io-ox-login-blocker").on("mousedown", false);
                $("#io-ox-login-form").on("submit", fnSubmit);
                $("#io-ox-login-username").removeAttr("disabled").focus().select();
                $("#background_loader").idle().fadeOut(DURATION, cont);
            });
    };

    // teach require.js to use deferred objects
    var req = window.req = require;
    require = function (deps, callback) {
        if (_.isArray(deps)) {
            // use deferred object
            var def = $.Deferred().done(callback || $.noop);
            req(deps, def.resolve, def.reject);
            return def;
        } else {
            // bypass
            return req.apply(this, arguments);
        }
    };
    _.extend(require, req);

    // searchfield fix
    if (!_.browser.Chrome) {
        $("html").addClass("no-searchfield");
    }

    // do we have a mouse?
    if (!Modernizr.touch) {
        $("html").addClass("mouse");
    }

    // no ellipsis? (firefox)
    // TODO: fix this; v11 support text-overflow
    if (_.browser.Firefox) {
        $("html").addClass("no-ellipsis");
    }

    // be busy
    $("#background_loader").busy();

    var boot = function () {

        // get pre core & server config -- and init http & session
        require(['io.ox/core/http', 'io.ox/core/cache', 'io.ox/core/session'])
            .done(function (http, cache) {
                var configCache = new cache.SimpleCache('serverconfig', true),
                    loadConfig = $.Deferred();

                if (ox.online) {
                    loadConfig = http.GET({
                        module: 'apps/manifests',
                        params: {
                            action: 'config'
                        }
                    }).done(function (data) {
                        configCache.add('generalconfig', data);
                    });
                } else {
                    configCache.get('generalconfig').done(function (data) {
                        if (data) {
                            loadConfig.resolve(data);
                        } else {
                            loadConfig.resolve({
                                capabilities: [],
                                manifests: []
                            });
                        }
                    });
                }
                

                loadConfig.done(function (data) {
                    // store server config
                    ox.serverConfig = data;
                    // set page title now
                    document.title = _.noI18n(ox.serverConfig.pageTitle || '');
                    // continue
                    autoLogin();
                });
            });
    };

    // handle online/offline mode
    if (!ox.signin) {
        $(window).on("online offline", function (e) {
            if (e.type === "offline") {
                $("#io-ox-offline").text("Offline").fadeIn(DURATION);
                ox.online = false;
            } else {
                $("#io-ox-offline").text("Online").fadeOut(DURATION);
                ox.online = true;
            }
        });
        if (!ox.online) {
            $(window).trigger("offline");
        }
    }

    // handle document visiblity
    $(window).on("blur focus", function (e) {
            ox.windowState = e.type === "blur" ? "background" : "foreground";
        });

    // clear persistent caches due to update?
    // TODO: add indexedDB once it's getting used
    if (Modernizr.localstorage) {
        var ui = JSON.parse(localStorage.getItem('appsuite-ui') || '{}');
        if (ui.version !== ox.version) {
            console.warn('clearing localStorage due to UI update');
            localStorage.clear();
            localStorage.setItem('appsuite-ui', JSON.stringify({ version: ox.version }));
        }
    }

    // reload if files have change; need this during development
    if (Modernizr.applicationcache && _.browser.Chrome && ox.debug) {

        (function () {

            var ac = window.applicationCache, clear, updateReady, cont;

            clear = function () {
                ac.removeEventListener('cached', cont, false);
                ac.removeEventListener('noupdate', cont, false);
                ac.removeEventListener('error', cont, false);
                ac.removeEventListener('updateready', updateReady, false);
            };

            updateReady = function () {
                // if manifest has changed, we have to swap caches and reload
                if (ac.status === ac.UPDATEREADY) {
                    clear();
                    location.reload();
                }
            };

            cont = function (e) {
                clear();
                boot();
            };

            ac.addEventListener('cached', cont, false);
            ac.addEventListener('noupdate', cont, false);
            ac.addEventListener('error', cont, false);
            ac.addEventListener('updateready', updateReady, false);

        }());
    } else {
        boot();
    }
});
