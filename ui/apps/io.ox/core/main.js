/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2011 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/main',
    ['io.ox/core/desktop',
     'io.ox/core/session',
     'io.ox/core/http',
     'io.ox/core/api/apps',
     'io.ox/core/extensions',
     'io.ox/core/extPatterns/stage',
     'io.ox/core/date',
     'io.ox/core/notifications',
     'io.ox/core/commons', // defines jQuery plugin
     'io.ox/core/upsell',
     'io.ox/core/capabilities',
     'io.ox/core/ping',
     'settings!io.ox/core',
     'gettext!io.ox/core',
     'io.ox/core/relogin',
     'io.ox/core/bootstrap/basics'
    ], function (desktop, session, http, appAPI, ext, Stage, date, notifications, commons, upsell, capabilities, ping, settings, gt) {

    'use strict';

    var DURATION = 250;

    // enable special logging to investigate why boot fails
    var debug = _.url.hash('debug') === 'boot' ? function () { console.log.apply(console, arguments); } : $.noop;

    debug('core: Loaded');

    _.stepwiseInvoke = function (list, method, context) {
        if (!_.isArray(list)) return $.when();
        var args = Array.prototype.slice.call(arguments, 3), done = $.Deferred(), tmp = [];
        function store(result) {
            tmp.push(result);
        }
        function tick() {
            // are we done now?
            if (list.length === 0) return done.resolve(tmp);
            // get next item
            var item = list.shift();
            // has method?
            if (item && _.isFunction(item[method])) {
                // call method and expect a deferred object
                var ret = item[method].apply(context, args);
                if (ret && ret.promise) return ret.done(store).then(tick, done.reject);
            }
            tick();
        }
        tick();
        return done.promise();
    };

    var logout = function (opt) {

        opt = _.extend({
            autologout: false
        }, opt || {});

        $('#background-loader').fadeIn(DURATION, function () {

            $('#io-ox-core').hide();
            var extensions = ext.point('io.ox/core/logout').list();
            _.stepwiseInvoke(extensions, 'logout', this, new ext.Baton(opt)).then(
                function logout() {
                    session.logout().always(function () {
                        // get logout locations
                        var location = settings.get('customLocations/logout'),
                            fallback = ox.serverConfig.logoutLocation || ox.logoutLocation,
                            logoutLocation = location || (fallback + (opt.autologout ? '#autologout=true' : ''));
                            // Substitute some variables
                            // [hostname], [login]
                        logoutLocation = logoutLocation.replace('[hostname]', window.location.hostname);
                        _.url.redirect(logoutLocation);
                    });
                },
                function cancel() {
                    $('#io-ox-core').show();
                    $('#background-loader').fadeOut(DURATION);
                }
            );
        });
    };

    // listen for logout event
    ext.point('io.ox/core/logout').extend({
        id: 'saveSettings',
        logout: function () {
            // force save requests for all pending settings
            var pending = settings.getAllPendingSettings(),
                defs = [];
            if (!_.isEmpty(pending)) {
                _(pending).each(function (setting) {
                    defs.push(setting.save(undefined, { force: true }));
                });
            }
            return $.when(defs);
        }
    });

    //
    // handle online/offline mode
    //
    function showIndicator(text) {
        $('#io-ox-offline').text(text).stop().show().animate({ bottom: '0px' }, 200);
    }

    function hideIndicator() {
        $('#io-ox-offline').stop().animate({ bottom: '-41px' }, 200, function () { $(this).hide(); });
    }

    ox.on('connection:online connection:offline', function (e) {
        if (e.type === 'connection:offline') {
            showIndicator(gt('Offline'));
            ox.online = false;
        } else {
            hideIndicator();
            ox.online = true;
        }
    });

    ox.on('connection:up connection:down', function (e) {
        if (ox.online) {
            if (e.type === 'connection:down') {
                showIndicator(gt('Server unreachable'));
            } else {
                hideIndicator();
            }
        }
    });

    if (!ox.online) {
        $(window).trigger('offline');
    }

    var topbar = $('#io-ox-topbar'),
        launchers = $('.launchers', topbar),
        launcherDropdown = $('.launcher-dropdown ul', topbar);

    topbar.attr({
        'aria-label': gt('Applications')
    });

    $('a.dropdown-toggle', topbar).attr({
        'aria-label': gt('Launcher dropdown. Press [enter] to jump to the dropdown.'),
        'role': 'button',
        'aria-haspopup': 'true'
    });

    // whatever ...
    gt.pgettext('app', 'Portal');
    gt.pgettext('app', 'Mail');
    gt.pgettext('app', 'Address Book');
    gt.pgettext('app', 'Calendar');
    gt.pgettext('app', 'Scheduling');
    gt.pgettext('app', 'Tasks');
    gt.pgettext('app', 'Drive');
    gt.pgettext('app', 'Conversations');

    var tabManager = _.debounce(function () {
        var items = launchers.children('.launcher'),
            launcherDropDownIcon = $('.launcher-dropdown', topbar),
            forceDesktopLaunchers = settings.get('forceDesktopLaunchers', false);

        // we don't show any launcher in top-bar on small devices
        if (_.device('smartphone') && !forceDesktopLaunchers) {
            items.hide();
            launcherDropDownIcon.show();
            return;
        }

        // Reset first
        launchers.children('.launcher:hidden').each(function (i, node) {
            $(node).show();
        });

        var itemsVisible = launchers.children('.launcher:visible'),
            itemsRightWidth = topbar.find('.launchers-secondary').outerWidth(true),
            itemsLeftWidth = 0,
            viewPortWidth = $(document).width(),
            launcherDropDownIconWidth = launcherDropDownIcon.outerWidth(true);

        launcherDropDownIcon.hide();

        itemsVisible.each(function () {
            itemsLeftWidth += $(this).outerWidth(true);
        });

        var visibleTabs,
            i = 0,
            hidden = 0;
        for (i = items.length; i > 1; i--) {
            visibleTabs = itemsVisible.length - hidden;
            if (itemsLeftWidth + itemsRightWidth <= viewPortWidth) {
                break;
            } else {
                var lastVisibleItem = launchers.children('.launcher:visible').last();
                itemsLeftWidth = itemsLeftWidth - lastVisibleItem.outerWidth(true);
                lastVisibleItem.hide();
                hidden++;
                if (hidden === 1) {
                    itemsLeftWidth += launcherDropDownIconWidth;
                }
                if (visibleTabs <= 4) {
                    //$('.launcher.left-corner', topbar).hide();
                }
            }
        }
        $('li', launcherDropdown).hide();

        if (hidden > 0) {
            launcherDropDownIcon.show();
            for (i = hidden; i > 0; i--) {
                $('li', launcherDropdown).eq(-i).show();
            }
        }
    }, 100);

    // add launcher
    var addLauncher = function (side, label, fn, arialabel) {
        var node = $('<li class="launcher">');

        if (fn) {
            node.on('click', function (e) {
                e.preventDefault();
                var self = $(this), content;
                // set fixed width, hide label, be busy
                content = self.contents();
                self.css('width', self.width() + 'px').text('\u00A0').busy();
                // call launcher
                (fn.call(this) || $.when()).done(function () {
                    // revert visual changes
                    self.idle().empty().append(content).css('width', '');
                });
            });
        }

        //construct
        node.append(function () {
            if (_.isString(label)) {
                return $('<a href="#" class="apptitle" tabindex="1" role="menuitem">').text(gt.pgettext('app', label));
            } else if (label[0].tagName === 'I') {
                return arialabel ? $('<a href="#" class="apptitle" tabindex="1" role="button" aria-label="' + arialabel + '">').append(label) : $('<a href="#" class="apptitle" tabindex="1" role="button">').append(label);
            } else {
                return label;
            }
        });

        return node.appendTo(side === 'left' ? launchers : topbar);
    };

    function initRefreshAnimation() {

        var count = 0,
            timer = null,
            useSpinner = _.device('webkit || firefox || ie > 9'),
            duration = useSpinner ? 500 : 1500,
            refreshIcon = null;

        function off() {
            if (count === 0 && timer === null) {
                if (useSpinner) {
                    refreshIcon = refreshIcon || $('#io-ox-refresh-icon').find('i');
                    refreshIcon.addClass('icon-spin-paused').removeClass('icon-spin');
                } else {
                    $('#io-ox-refresh-icon').removeClass('io-ox-progress');
                }
            }
        }

        http.on('start', function () {
            if (count === 0) {
                if (timer === null) {
                    if (useSpinner) {
                        refreshIcon = refreshIcon || $('#io-ox-refresh-icon').find('i');
                        refreshIcon.addClass('icon-spin').removeClass('icon-spin-paused');
                    } else {
                        $('#io-ox-refresh-icon').addClass('io-ox-progress');
                    }
                }
                clearTimeout(timer);
                timer = setTimeout(function () {
                    timer = null;
                    off();
                }, duration);
            }
            count++;
        });

        http.on('stop', function () {
            count = Math.max(0, count - 1);
            off();
        });
    }

    var refresh;

    (function () {

        var interval = parseInt(settings.get('refreshInterval', 300000), 10),
            next = _.now() + interval;

        ext.point('io.ox/core/refresh').extend({
            action: function () {
                if (ox.online && ox.session !== '') {
                    try {
                        // trigger global event
                        ox.trigger('refresh^');
                    } catch (e) {
                        console.error('io.ox/core/refresh:default', e.message, e);
                    }
                }
            }
        });

        refresh = function () {
            next = _.now() + interval;
            ext.point('io.ox/core/refresh').invoke('action');
        };

        function check() {
            if (_.now() > next) { refresh(); }
        }

        setInterval(check, 10000); // check every 10 seconds

    }());

    (function () {

        var CHECKINTERVAL = 10,     // check only in this interval to optimize script performance
            WARNINGSTART = 30,      // threshold for warning dialog in sconds
            interval = 0,           // init logout interval
            timeout = null,         // main timeout reference
            checker = null,         // checker timeout reference
            timeoutStart,           // remember timeout init
            dialog = null,          // init warning dialog
            changed = false;

        var getTimeLeft = function () {
            return Math.ceil((timeoutStart + interval - _.now()) / 1000);
        };

        var getInterval = function () {
            return parseInt(settings.get('autoLogout', 0), 10);
        };

        // clear current timeout and reset activity status
        var resetTimeout = function () {
            clearTimeout(timeout);
            timeout = setTimeout(function () {
                logout({ autologout: true });
            }, interval);
            timeoutStart = _.now();
            changed = false;
        };

        // check activity status
        var check = function () {
            if (changed && dialog === null) {
                resetTimeout();
            } else {
                var timeLeft = getTimeLeft();

                if (timeLeft <= WARNINGSTART && dialog === null) {
                    // show warnig dialog
                    require(['io.ox/core/tk/dialogs'], function (dialogs) {

                        var countdown = timeLeft,
                            getString = function (sec) {
                                return gt.format(
                                    gt.ngettext(
                                        'You will be automatically signed out in %1$d second',
                                        'You will be automatically signed out in %1$d seconds', sec
                                    ), gt.noI18n(sec)
                                );
                            },
                            node = $('<span>').text(getString(countdown)),
                            countdownTimer = setInterval(function () {
                                if (countdown <= 0) {
                                    logout({ autologout: true });
                                } else {
                                    countdown--;
                                    node.text(getString(countdown));
                                }
                            }, 1000);

                        clearTimeout(timeout);

                        dialog = new dialogs.ModalDialog({ easyOut: false })
                            .header($('<h4>').text(gt('Automatic sign out')))
                            .append(node)
                            .topmost()
                            .addPrimaryButton('cancel', gt('Cancel'))
                            .addAlternativeButton('force', gt('Sign out now'))
                            .setUnderlayStyle({
                                backgroundColor: 'white',
                                opacity: 0.90
                            })
                            .show()
                            .done(function (action) {
                                resetTimeout();
                                clearInterval(countdownTimer);
                                dialog = null;
                                if (action === 'force') {
                                    logout();
                                }
                            });

                    });
                }
            }
        };

        var change = function () {
            changed = true;
        };

        var start = function () {

            interval = getInterval();

            if (interval > 0 && timeout === null) {

                // bind mouse, keyboard and touch events to monitor user activity
                $(document).on('mousedown mousemove scroll touchstart touchmove keydown', change);
                // start timeout
                resetTimeout();
                // check every x seconds to reduce setTimeout operations
                checker = setInterval(check, 1000 * CHECKINTERVAL);
            }

        };

        var stop = function () {
            if (checker && timeout) {
                clearTimeout(timeout);
                clearInterval(checker);
                timeout = checker = null;
                $(document).off('mousedown mousemove scroll touchstart touchmove keydown', change);
            }
        };

        var restart = function () {
            stop();
            start();
        };

        var debug = function () {
            CHECKINTERVAL = 1;
            WARNINGSTART = 10;
            getInterval = function () { return 12000; };
            restart();
        };

        ox.autoLogout = {
            start: start,
            stop: stop,
            restart: restart,
            debug: debug
        };

        start();

    }());

    //
    // Connection metrics
    //

    function launch() {

        debug('core: launch()');

        /**
         * Listen to events on apps collection
         */

        function add(node, container, model) {
            var placeholder;
            node.attr({
                'data-app-name': model.get('name') || model.id,
                'data-app-guid': model.guid
            });
            // is launcher?
            if (model instanceof ox.ui.AppPlaceholder) {
                node.addClass('placeholder');
                if (!upsell.has(model.get('requires'))) {
                    node.addClass('upsell').children('a').first().prepend(
                        $('<i class="icon-lock">')
                    );
                }
            } else {
                placeholder = container.children('.placeholder[data-app-name="' + $.escape(model.get('name')) + '"]');
                if (placeholder.length) {
                    node.insertBefore(placeholder);
                }
                placeholder.remove();
            }
        }

        function addUserContent(model, launcher, first) {

            var ariaBasicLabel =
                    //#. %1$s is app title/name
                    gt('close for %1$s', model.get('title')),
                quitApp = $('<a href="#" class="closelink" tabindex="1" role="button" aria-label="' + ariaBasicLabel + '">')
                    .append($('<i class="icon-remove">'))
                    .on('click', function (e) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        model.getWindow().app.quit();
                    })
                    .on('focus', function () {
                        quitApp.attr('aria-label', ariaBasicLabel);
                    });

            if (model.get('closable')) {
                launcher.addClass('closable');
                if (first) {
                    launcher.find('a').after(quitApp);
                }
            }

            if (model.get('userContent')) {
                var cls = model.get('userContentClass') || '',
                    icon = model.get('userContentIcon') || '';
                launcher.addClass('user-content').addClass(cls).children().first().prepend($('<span>').append(
                    $('<i class="' + icon + '">'))
                );
            }
        }

        ox.ui.apps.on('add', function (model) {

            if (model.get('title') === undefined) return;

            // create topbar launcher
            var node = addLauncher('left', model.get('title'), function () { model.launch(); }),
                title = model.get('title'),
                name;

            add(node, launchers, model);

            // call extensions to customize
            name = model.get('name') || model.id;
            ext.point('io.ox/core/topbar/launcher').invoke('draw', node, ext.Baton({ model: model, name: name }));

            // is user-content?
            addUserContent(model, node, true);

            // add list item
            node = $('<li>').append(
                $('<a>', {
                    href: '#',
                    'data-app-name': name,
                    'data-app-guid': model.guid,
                    tabindex: 1,
                    'role': 'menuitem'
                })
                .text(gt.pgettext('app', title))
            );
            launcherDropdown.append(
                node.on('click', function (e) {
                    e.preventDefault();
                    model.launch();
                })
            );
            add(node, launcherDropdown, model);
            tabManager();
        });

        ox.ui.apps.on('remove', function (model) {
            launchers.children('[data-app-guid="' + model.guid + '"]').remove();
            launcherDropdown.children('[data-app-guid="' + model.guid + '"]').remove();
            tabManager();
        });

        ox.ui.apps.on('launch resume', function (model) {
            // mark last active app
            if (_.device('smartphone')) {
                if (!settings.get('forceDesktopLaunchers', false)) {
                    launchers.hide();
                }
            }
            launchers.children().removeClass('active-app')
                .filter('[data-app-guid="' + model.guid + '"]').addClass('active-app');
            launcherDropdown.children().removeClass('active-app')
                .filter('[data-app-guid="' + model.guid + '"]').addClass('active-app');
        });

        ox.ui.apps.on('change:title', function (model, value) {
            var node = $('[data-app-guid="' + model.guid + '"]', launchers);
            $('a.apptitle', node).text(value);
            addUserContent(model, node);
            launcherDropdown.find('a[data-app-guid="' + model.guid + '"]').text(value);
            tabManager();
        });

        ext.point('io.ox/core/topbar/right').extend({
            id: 'notifications',
            index: 100,
            draw: function () {
                var self = this;
                // we don't need this right from the start,
                // so let's delay this for responsiveness
                if (ox.online) {
                    _.defer(function () {
                        self.prepend(notifications.attach(addLauncher));
                        tabManager();
                    });
                }
            }
        });

        ext.point('io.ox/core/topbar/right').extend({
            id: 'refresh',
            index: 200,
            draw: function () {
                this.append(
                    addLauncher('right', $('<i class="icon-refresh launcher-icon">').attr('aria-hidden', 'true'), function () {
                        refresh();
                        return $.when();
                    },  gt('Refresh'))
                    .attr('id', 'io-ox-refresh-icon')
                );
            }
        });

        ext.point('io.ox/core/topbar/right/dropdown').extend({
            id: 'settings',
            index: 100,
            draw: function () {
                this.append(
                    $('<li>').append(
                        $('<a href="#" data-app-name="io.ox/settings" role="menuitem" aria-haspopup="true" tabindex="1">').text(gt('Settings'))
                    )
                    .on('click', function (e) {
                        e.preventDefault();
                        ox.launch('io.ox/settings/main');
                    })
                );
            }
        });

        ext.point('io.ox/core/topbar/right/dropdown').extend({
            id: 'app-specific-help',
            index: 200,
            draw: function () { //replaced by module
                var helpDir = 'help/l10n/' + ox.language + '/',
                    node = this,
                    startingPoints = {
                    'io.ox/contacts': 'ox.appsuite.user.chap.contacts.html',
                    'io.ox/calendar': 'ox.appsuite.user.chap.calendar.html',
                    'io.ox/tasks': 'ox.appsuite.user.chap.tasks.html',
                    'io.ox/mail': 'ox.appsuite.user.chap.email.html',
                    'io.ox/files': 'ox.appsuite.user.chap.files.html',
                    'io.ox/portal': 'ox.appsuite.user.sect.portal.customize.html'
                };
                node.append(
                    $('<li class="divider" aria-hidden="true" role="presentation"></li>'),
                    $('<li>', {'class': 'io-ox-specificHelp'}).append(
                        $('<a target="_blank" href="" role="menuitem" tabindex="1">').text(gt('Help'))
                        .on('click', function (e) {
                            var currentApp = ox.ui.App.getCurrentApp(),
                                currentType = currentApp.attributes.name,
                                target = currentType in startingPoints ? startingPoints[currentType] : 'index.html';
                            e.preventDefault();
                            window.open(helpDir + target);
                        })
                    )
                );
            }
        });

        ext.point('io.ox/core/topbar/right/dropdown').extend({
            id: 'divider-before-fullscreen',
            index: 290,
            draw: function () {
                this.append(
                    $('<li class="divider" aria-hidden="true" role="presentation">')
                );
            }
        });

        // fullscreen doesn't work for safari (see )
        if (_.device('!safari')) {
            ext.point('io.ox/core/topbar/right/dropdown').extend({
                id: 'fullscreen',
                index: 300,
                draw: function () {
                    if (BigScreen.enabled) {
                        var fullscreenButton;
                        BigScreen.onenter = function () {
                            fullscreenButton.text(gt('Exit Fullscreen'));
                        };
                        BigScreen.onexit = function () {
                            fullscreenButton.text(gt('Fullscreen'));
                        };
                        this.append(
                            $('<li>').append(
                                fullscreenButton = $('<a href="#" data-action="fullscreen" role="menuitem" tabindex="1">').text(gt('Fullscreen'))
                            )
                            .on('click', function (e) {
                                e.preventDefault();
                                BigScreen.toggle();
                            })
                        );
                    }
                }
            });
        }

        ext.point('io.ox/core/topbar/right/dropdown').extend({
            id: 'about',
            index: 400,
            draw: function () {
                this.append(
                    $('<li>').append(
                        $('<a href="#" data-action="about" role="menuitem" tabindex="1">').text(gt('About'))
                    )
                    .on('click', function (e) {
                        e.preventDefault();
                        require(['io.ox/core/about/about'], function (about) {
                            about.show();
                        });
                    })
                );
            }
        });

        ext.point('io.ox/core/topbar/right/dropdown').extend({
            id: 'feedback',
            index: 250,
            draw: function () {
                var currentSetting = settings.get('feeback/show', 'both');
                if (currentSetting === 'both' || currentSetting === 'topbar') {
                    this.append(
                        $('<li>').append(
                            $('<a href="#" data-action="feedback" role="menuitem" tabindex="1">').text(gt('Give feedback'))
                        )
                        .on('click', function (e) {
                            e.preventDefault();
                            require(['io.ox/core/feedback/feedback'], function (feedback) {
                                feedback.show();
                            });
                        })
                    );
                }
            }
        });

        ext.point('io.ox/core/topbar/right/dropdown').extend({
            id: 'logout',
            index: 1000,
            draw: function () {
                this.append(
                    $('<li class="divider" aria-hidden="true" role="presentation"></li>'),
                    $('<li>').append(
                        $('<a href="#" data-action="logout" role="menuitem" tabindex="1">').text(gt('Sign out'))
                    )
                    .on('click', function (e) {
                        e.preventDefault();
                        logout();
                    })
                );
            }
        });

        ext.point('io.ox/core/topbar/right').extend({
            id: 'dropdown',
            index: 1000,
            draw: function () {
                var div, a, ul;
                this.append(
                    div = $('<div class="launcher" role="presentation">').append(
                        a = $('<a class="dropdown-toggle" data-toggle="dropdown" href="#" role="button" aria-haspopup="true" tabindex="1">').append(
                            $('<i class="icon-cog icon-white launcher-icon" aria-hidden="true">')
                        ),
                        ul = $('<ul id="topbar-settings-dropdown" class="dropdown-menu" role="menu">')
                    )
                );
                if (!Modernizr.touch) {
                    div.hover(
                        function () { $(this).addClass('hover'); },
                        function () { $(this).removeClass('hover'); }
                    );
                }
                ext.point('io.ox/core/topbar/right/dropdown').invoke('draw', ul);
                a.attr('aria-label', gt('Settings'));
                a.dropdown();

                a.one('click', function () {//adjust dropdown on first click to be sure logo is loaded (we need the width)
                    if (parseInt($('#io-ox-top-logo-small').css('width'), 10) > 150) {//adjust dropdown for to large logos
                        ul.css('right', 'auto');
                    }
                });
            }
        });

        ext.point('io.ox/core/topbar/right').extend({
            id: 'logo',
            index: 10000,
            draw: function () {
                // add small logo to top bar
                this.append(
                    $('<div>', { id: 'io-ox-top-logo-small' })
                );
            }
        });

        // launchpad
        ext.point('io.ox/core/topbar/launchpad').extend({
            id: 'default',
            draw: function () {
                if (capabilities.has('launchpad')) {
                    addLauncher('left', $('<i class="icon-th icon-white">').attr('aria-label', gt('Your Applications')), function () {
                        return require(['io.ox/launchpad/main'], function (m) {
                            launchers.children().removeClass('active-app');
                            launcherDropdown.children().removeClass('active-app');
                            launchers.children().first().addClass('active-app');
                            m.show();
                        });
                    })
                    .addClass('left-corner'); // to match dimensions of side navigation
                }
            }
        });

        // favorites
        ext.point('io.ox/core/topbar/favorites').extend({
            id: 'default',
            draw: function () {
                var favorites = appAPI.getAllFavorites();
                favorites.sort(function (a, b) {
                    return ext.indexSorter(a, b);
                });
                _(favorites).each(function (obj) {
                    if (upsell.visible(obj.requires)) {
                        ox.ui.apps.add(new ox.ui.AppPlaceholder({
                            id: obj.id,
                            title: obj.title,
                            requires: obj.requires
                        }));
                    }
                });
            }
        });

        ext.point('io.ox/core/topbar').extend({
            id: 'default',
            draw: function () {

                var rightbar = $('<div class="launchers-secondary">');

                // right side
                ext.point('io.ox/core/topbar/right').invoke('draw', rightbar);

                topbar.append(rightbar);

                // refresh animation
                initRefreshAnimation();

                ext.point('io.ox/core/topbar/launchpad').invoke('draw');
                ext.point('io.ox/core/topbar/favorites').invoke('draw');

                $(window).resize(tabManager);
            }
        });

        ext.point('io.ox/core/relogin').extend({
            draw: function () {
                this.append(
                    gt('Your session is expired'), $.txt(_.noI18n('.')), $('<br>'),
                    $('<small>').text(gt('Please sign in again to continue'))
                );
            }
        });

        ext.point('io.ox/core/feedback').extend({
            draw: function () {
                require(['io.ox/core/feedback/feedback'], function (feedback) {
                    feedback.drawButton();
                });
            }
        });

        // add some senseless characters to avoid unwanted scrolling
        if (location.hash === '') {
            location.hash = '#!';
        }

        var autoLaunchArray = function () {

            var autoStart = [];

            if (settings.get('autoStart') === 'none') {
                autoStart = [];
            } else {
                autoStart = _([].concat(settings.get('autoStart'))).filter(function (o) {
                    return !_.isUndefined(o) && !_.isNull(o);
                });
                if (_.isEmpty(autoStart)) {
                    autoStart.push('io.ox/mail');
                }
            }

            return autoStart;
        };

        var getAutoLaunchDetails = function (str) {
            var pair = (str || '').split(/:/), app = pair[0], method = pair[1] || '';
            return { app: (/\/main$/).test(app) ? app : app + '/main', method: method };
        };

        var mobileAutoLaunchArray = function () {
            var autoStart = _([].concat(settings.get('autoStartMobile', 'io.ox/portal'))).filter(function (o) {
                return !_.isUndefined(o) && !_.isNull(o);
            });
            //always add mail as fallback
            autoStart.push('io.ox/mail');
            return autoStart;
        };

        // checks url which app to launch, needed to handle direct links
        function appCheck() {
            if (_.url.hash('m')) {
                //direkt link
                switch (_.url.hash('m')) {
                case 'task':
                    _.url.hash({ app: 'io.ox/tasks' });
                    break;
                case 'calendar':
                    // only list perspective can handle ids
                    _.url.hash({ app: 'io.ox/calendar', perspective: 'week:week' });
                    break;
                case 'infostore':
                    // only list perspective can handle ids
                    _.url.hash({ app: 'io.ox/files', perspective: 'list' });
                    break;
                case 'contact':
                    _.url.hash({ app: 'io.ox/contacts' });
                    break;
                }
                // fill id and folder, then clean up
                _.url.hash({
                    folder: _.url.hash('f'),
                    id: _.url.hash('f') + '.' + _.url.hash('i'),
                    m: null,
                    f: null,
                    i: null
                });
            }

            // always use portal on small devices!
            if (_.device('small')) {
                return mobileAutoLaunchArray();
            }

            var appURL = _.url.hash('app'),
                manifest = appURL && ox.manifests.apps[getAutoLaunchDetails(appURL).app],
                mailto = _.url.hash('mailto') !== undefined && appURL === 'io.ox/mail/write:compose';

            if (manifest && (manifest.refreshable || mailto)) {
                return appURL.split(/,/);
            } else {
                return autoLaunchArray();
            }
        }

        var baton = ext.Baton({
            block: $.Deferred(),
            autoLaunch: appCheck()
        });

        baton.autoLaunchApps = _(baton.autoLaunch)
        .chain()
        .map(function (m) {
            return getAutoLaunchDetails(m).app;
        })
        .filter(function (m) {
            //don’t autoload without manifest
            //don’t autoload disabled apps
            return ox.manifests.apps[m] !== undefined && !ox.manifests.isDisabled(m);
        })
        .compact()
        .value();

        var drawDesktop = function () {
            ext.point('io.ox/core/desktop').invoke('draw', $('#io-ox-desktop'), {});
            drawDesktop = $.noop;
        };

        ox.ui.windowManager.on('empty', function (e, isEmpty, win) {
            if (isEmpty) {
                drawDesktop();
                ox.ui.screens.show('desktop');
                ox.launch(getAutoLaunchDetails(win || settings.get('autoStart', 'io.ox/mail/main')).app);
            } else {
                ox.ui.screens.show('windowmanager');
            }
        });

        function fail(type) {
            return function () {
                console.error('core: Failed to load:', type, baton);
            };
        }

        requirejs.onError = function (e) {
            console.error('requirejs', e.message, arguments);
        };

        // start loading stuff
        baton.loaded = $.when(
            baton.block,
            ext.loadPlugins().fail(fail('loadPlugins')),
            require(baton.autoLaunchApps).fail(fail('autoLaunchApps')),
            require(['io.ox/core/api/account']).then(
                function (api) {
                    var def = $.Deferred();
                    api.all().always(def.resolve);
                    return def;
                },
                fail('account')
            )
        );

        new Stage('io.ox/core/stages', {
            id: 'first',
            index: 100,
            run: function () {
                debug('core: Stage "first"');
            }
        });

        new Stage('io.ox/core/stages', {
            id: 'update-tasks',
            index: 200,
            run: function () {

                debug('core: Stage "update-tasks"');

                require(['io.ox/core/updates/updater']).then(
                    function success(updater) {
                        // this is not mission-critical so continue if anything fails
                        return updater.runUpdates().always(function () {
                            return $.when();
                        });
                    },
                    function fail() {
                        return $.when();
                    }
                );
            }
        });

        new Stage('io.ox/core/stages', {
            id: 'secretCheck',
            index: 250,
            run: function () {
                if (ox.online) {
                    require(['io.ox/keychain/api'], function (keychainAPI) {
                        keychainAPI.checkSecrets().done(function (analysis) {
                            if (!analysis.secretWorks) {
                                // Show dialog
                                require(['io.ox/keychain/secretRecoveryDialog'], function (d) { d.show(); });
                                if (ox.debug) {
                                    console.error('Couldn\'t decrypt accounts: ', analysis.diagnosis);
                                }
                            }
                        });
                    });
                }
            }
        });

        new Stage('io.ox/core/stages', {
            id: 'restore-check',
            index: 300,
            run: function (baton) {

                debug('core: Stage "restore-check"');

                return ox.ui.App.canRestore().done(function (canRestore) {
                    baton.canRestore = canRestore;
                });
            }
        });

        new Stage('io.ox/core/stages', {
            id: 'restore-confirm',
            index: 400,
            run: function (baton) {

                debug('core: Stage "restore-confirm"');

                if (baton.canRestore) {

                    var dialog,
                        def = $.Deferred().done(function () {
                            $('#background-loader').busy().fadeIn();
                            topbar.show();
                            dialog.remove();
                            dialog = null;
                        });

                    $('#io-ox-core').append(
                        dialog = $('<div class="core-boot-dialog" tabindex="0">').append(
                            $('<div class="header">').append(
                                $('<h3>').text(gt('Restore applications')),
                                $('<div>').text(
                                    gt('The following applications can be restored. Just remove the restore point if you don\'t want it to be restored.')
                                )
                            ),
                            $('<ul class="content">'),
                            $('<div class="footer">').append(
                                $('<button type="button" class="btn btn-primary">').text(gt('Continue'))
                            )
                        )
                    );

                    // draw savepoints to allow the user removing them
                    ox.ui.App.getSavePoints().done(function (list) {
                        _(list).each(function (item) {
                            this.append(
                                $('<li class="restore-item">').append(
                                    $('<a href="#" role="button" class="remove">').data(item).append(
                                        $('<i class="icon-trash">')
                                    ),
                                    item.icon ? $('<i class="' + item.icon + '">') : $(),
                                    $('<span>').text(gt.noI18n(item.description || item.module))
                                )
                            );
                        }, dialog.find('.content'));
                    });

                    dialog.on('click', '.footer .btn', def.resolve);
                    dialog.on('click', '.content .remove', function (e) {
                        e.preventDefault();
                        var node = $(this),
                            id = node.data('id');
                        // remove visually first
                        node.closest('li').remove();
                        // remove restore point
                        ox.ui.App.removeRestorePoint(id).done(function (list) {
                            // continue if list is empty
                            if (list.length === 0) {
                                _.url.hash({});
                                baton.canRestore = false;
                                def.resolve();
                            }
                        });
                    });

                    topbar.hide();
                    $('#background-loader').idle().fadeOut(function () {
                        dialog.find('.btn-primary').focus();
                    });

                    return def;
                }
            }
        });

        new Stage('io.ox/core/stages', {
            id: 'restore',
            index: 500,
            run: function (baton) {

                debug('core: Stage "restore"');

                if (baton.canRestore) {
                    // clear auto start stuff (just conflicts)
                    baton.autoLaunch = [];
                    baton.autoLaunchApps = [];
                }
                if (baton.autoLaunch.length === 0 && !baton.canRestore) {
                    drawDesktop();
                    return baton.block.resolve(true);
                }
                return baton.block.resolve(baton.autoLaunch.length || baton.canRestore || location.hash === '#!');
            }
        });

        new Stage('io.ox/core/stages', {
            id: 'load',
            index: 600,
            run: function (baton) {

                debug('core: Stage "load"', baton);

                return baton.loaded.done(function (instantFadeOut) {

                    debug('core: Stage "load" > loaded.done');

                    // draw top bar now
                    ext.point('io.ox/core/topbar').invoke('draw');

                    // help here
                    if (!ext.point('io.ox/core/topbar').isEnabled('default')) {
                        $('#io-ox-screens').css('top', '0px');
                        topbar.hide();
                    }
                    //draw fedbackButton
                    var currentSetting = settings.get('feeback/show', 'both');
                    if (currentSetting === 'both' || currentSetting === 'side') {
                        ext.point('io.ox/core/feedback').invoke('draw');
                    }

                    debug('core: Stage "load" > autoLaunch ...');

                    // auto launch
                    _(baton.autoLaunch)
                    .chain()
                    .map(function (id) {
                        return getAutoLaunchDetails(id);
                    })
                    .filter(function (details) {
                        //don’t autoload without manifest
                        //don’t autoload disabled apps
                        return ox.manifests.apps[details.app] !== undefined && !ox.manifests.isDisabled(details.app);
                    })
                    .each(function (details, index) {
                        //only load first app on small devices
                        if (_.device('smartphone') && index > 0) return;
                        // split app/call
                        var launch, method;
                        debug('core: autoLaunching', details.app);
                        launch = ox.launch(details.app);
                        method = details.method;
                        // explicit call?
                        if (method) {
                            launch.done(function () {
                                if (_.isFunction(this[method])) {
                                    this[method]();
                                }
                            });
                        }
                    });
                    // restore apps
                    ox.ui.App.restore();

                    baton.instantFadeOut = instantFadeOut;
                })
                .fail(function () {
                    console.warn('core: Stage "load" > loaded.fail!', baton);
                });
            }
        });

        new Stage('io.ox/core/stages', {
            id: 'curtain',
            index: 700,
            run: function (baton) {

                debug('core: Stage "curtain"');

                if (baton.instantFadeOut) {
                    // instant fade out
                    $('#background-loader').idle().hide();
                    return $.when();
                } else {
                    var def = $.Deferred();
                    $('#background-loader').idle().fadeOut(DURATION, def.resolve);
                    return def;
                }
            }
        });

        debug('core: launch > run stages');
        Stage.run('io.ox/core/stages', baton);
    }

    return {
        logout: logout,
        launch: launch,
        addLauncher: addLauncher
    };
});
