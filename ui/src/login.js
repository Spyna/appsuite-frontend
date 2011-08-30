/**
 * 
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
 * 
 */


/*jslint bitwise: false, nomen: false, onevar: false, plusplus: false, regexp: false, white: true, browser: true, devel: true, evil: true, forin: true, undef: true, eqeqeq: true, immed: true */
/*global $, ox, require */

$(document).ready(function () {

    "use strict";
    
    // animations
    var DURATION = 250,
        // flags
        relogin = false,
        // functions
        cont,
        cleanUp,
        loadCore,
        loginSuccess,
        fnSubmit,
        fnChangeLanguage,
        changeLanguage,
        setDefaultLanguage,
        autoLogin,
        initialize;

    // continuation
    cont = function () {
        $("#io-ox-login-username").focus();
    };
    
    cleanUp = function () {
        // remove dom nodes
        $("#io-ox-login-footer").remove();
        // update form
        $("#io-ox-login-username").attr("disabled", "disabled");
        $("#io-ox-login-password").val("");
        // unbind
        $("#io-ox-login-form").unbind("submit");
        // free closures
        cleanUp = fnChangeLanguage = 
            changeLanguage = initialize = null;
    };
    
    /**
     * Load core
     */
    loadCore = function () {
        // remove unnecessary stuff
        cleanUp();
        // get configuration
        require("io.ox/core/config").load()
            .done(function () {
                // load core
                require(["io.ox/core/main", "css!themes/default/core.css"], function (core) {
                    // go!
                    core.launch();
                });
            });
        // show loader
        $("#background_loader").fadeIn(DURATION, function () {
            // hide login dialog
            $("#io-ox-login-screen").hide();
            $(this).busy();
        });
    };
    
    // default success handler
    loginSuccess = loadCore;

    /**
     * Handler for form submit
     */
    fnSubmit = function (e) {
        // stop
        e.preventDefault();
        // restore form
        var restore = function () {
                // stop being busy
                $("#io-ox-login-blocker").hide();
                $("#io-ox-login-feedback").idle();
            },
            // fail handler
            fail = function (error) {
                // fail
                $("#io-ox-login-feedback").idle();
                // shake it!
                $("#login-box-content").stop().effect("shake", {
                    direction: "left",
                    times: 4,
                    distance: 10
                }, 50, function () {
                    // show error
                    $("#io-ox-login-feedback").text(
                        _.formatError(error, "%1$s")
                    );
                    // restore form
                    restore();
                    // reset focus
                    $("#io-ox-login-" + (relogin ? "password" : "username")).focus();
                });
            },
            // get user name / password
            username = $("#io-ox-login-username").val(),
            password = $("#io-ox-login-password").val();
        // be busy
        $("#io-ox-login-blocker").show();
        $("#io-ox-login-feedback").busy().empty();
        // user name and password shouldn't be empty
        if ($.trim(username).length === 0 || $.trim(password).length === 0) {
            fail({
                error: "Please enter your credentials.",
                code: "UI-0001"
            });
            return;
        }
        // login
        if (ox.offline) {
            loginSuccess();
        } else {
            require("io.ox/core/session")
            .login(
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
        }
    };
    
    changeLanguage = function (id) {
        // change language
        var cont = function (data) {
            // get all nodes
            $("[data-i18n]").each(function () {
                var node = $(this),
                    val = (id === "en_US") ? node.attr("data-i18n") : data[node.attr("data-i18n")];
                switch (this.tagName) {
                    case "INPUT":
                        node.val(val);
                        break;
                    default:
                        node.text(val);
                        break;
                }
            });
        };
        // get language pack
        if (id !== "en_US") {
            return $.when(
                $.ajax({
                    url: "src/i18n/" + id + ".js",
                    dataType: "json"
                })
                .done(cont)
            );
        } else {
            cont({});
            return $.Deferred().resolve();
        }
    };
    
    fnChangeLanguage = function (e) {
        // stop event
        e.preventDefault();
        // change language
        changeLanguage(e.data);
    };
    
    /**
     * Set default language
     */
    setDefaultLanguage = function () {
        // look at navigator.language with en_US as fallback
        var navLang = (navigator.language || navigator.userLanguage).substr(0, 2),
            lang = "en_US", id = "";
        for (id in ox.serverConfig.languages) {
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
            if (!relogin) {
                // enqueue last request
                queue = [{ request: request, deferred: deferred }];
                // set flag
                relogin = true;
                // set header
                $("#io-ox-login-header").html(
                    "Your session is expired." + "<br/>" + 
                    "<small>Please sign in again to continue.</small>"
                );
                // bind
                $("#io-ox-login-form").bind("submit", fnSubmit);
                $("#io-ox-login-password").val("");
                // set success handler
                loginSuccess = function () {
                    $("#io-ox-login-screen").fadeOut(DURATION, function () {
                        $("#io-ox-login-screen-decorator").hide();
                        // process queue
                        var i = 0, item, http = require("io.ox/core/http");
                        for (; item = queue[i]; i++) {
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
                    $("#io-ox-login-password").focus();
                });
            } else {
                // enqueue last request
                queue.push({ request: request, deferred: deferred });
            }
        };
    }());
    
    /**
     * Try auto login
     */
    autoLogin = function () {
        require("io.ox/core/session").autoLogin()
            .done(loadCore)
            .fail(initialize)
            .fail(function (error) {
                // offline?
                if (error.error === "0 general") {
                    ox.offline = true;
                    $("#io-ox-login-feedback").text(
                        "No internet connection. Using offline mode."
                    );
                }
            })
    };
    
    /**
     * Initialize login screen
     */
    initialize = function () {
        // shortcut
        var sc = ox.serverConfig, lang = sc.languages, node, id = "",
            header = "", footer = "";
        // show languages
        if (lang !== false) {
            node = $("#io-ox-language-list");
            for (id in lang) {
                node.append(
                    $("<a/>", { href: "#" })
                    .bind("click", id, fnChangeLanguage)
                    .text(lang[id])
                );
                node.append(document.createTextNode("\u00a0 "));
            }
        } else {
            $("#io-ox-languages").remove();
        }
        // update header
        header = sc.pageHeader || "open xchange 7";
        $("#io-ox-login-header").html(header);
        // update footer
        footer = sc.copyright ? sc.copyright + " " : "";
        footer += sc.version ? "Version: " + sc.version + " " : "";
        footer += sc.buildDate ? "(" + sc.buildDate + ")" : "";
        $("#io-ox-copyright").html(footer);
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
        // recommend chrome frame?
        if (_.browser.IE <= 8) {
            var link = "http://www.google.com/chromeframe/?user=true";
            $("#io-ox-login-feedback").html(
                '<div>Your browser is slow and outdated!</div>' +
                '<div style="font-size: 0.8em">Try <a href="' + link + '" target="_blank">Google Chrome Frame</a> ' +
                'for much better performance. It&rsquo;s awesome! ' +
                'Administrator rights are not required. Just restart IE after installation.</div>'
            );
        }
        // use browser language
        return setDefaultLanguage().done(function () {
            // show login dialog
            $("#io-ox-login-blocker").bind("mousedown", false);
            $("#io-ox-login-form").bind("submit", fnSubmit);
            $("#io-ox-login-screen").show();
            $("#io-ox-login-username").removeAttr("disabled").focus();
            $("#background_loader").idle().fadeOut(DURATION, cont);
        });
    };
    
    // init require.js
    require({
        // inject version
        baseUrl: ox.base + "/apps"
    });
    
    // teach require.js to use deferred objects
    var req = require;
    require = function (deps, callback) {
        if (_.isArray(deps)) {
            // use deferred object
            var def = $.Deferred().done(callback);
            req(deps, def.resolve);
            return def;
        } else {
            // bypass
            return req.apply(this, arguments);
        }
    };
    
    // get pre core & server config
    require([ox.base + "/src/serverconfig.js", ox.base + "/pre-core.js"])
    .done(function (data) {
        // store server config
        ox.serverConfig = data;
        // set page title now
        document.title = ox.serverConfig.pageTitle || "ox7";
        // add global dispatcher
        require("io.ox/core/event").Dispatcher.extend(ox);
        // auto login?
        if (ox.serverConfig.autoLogin === true) {
            autoLogin();
        } else {
            initialize();
        }
    });

});
