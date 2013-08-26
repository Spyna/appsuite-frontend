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

define("io.ox/core/desktop",
    ["io.ox/core/event",
     "io.ox/core/extensions",
     "io.ox/core/extPatterns/links",
     "io.ox/core/cache",
     "io.ox/core/notifications",
     "io.ox/core/upsell",
     "io.ox/core/adaptiveLoader",
     "gettext!io.ox/core"], function (Events, ext, links, cache, notifications, upsell, adaptiveLoader, gt) {

    "use strict";

    /**
     * Core UI
     */

    // current window
    var currentWindow = null;

    // top bar
    var appGuid = 0,
        appCache = new cache.SimpleCache('app-cache', true);

    // Apps collection
    ox.ui.apps = new Backbone.Collection();

    var AbstractApp = Backbone.Model.extend({

        defaults: {
            title: ''
        },

        initialize: function () {
            var self = this;
            this.guid = appGuid++;
            this.id = this.id || 'app-' + appGuid;
            this.getInstance = function () {
                return self;
            };
        },

        getName: function () {
            return this.get('name');
        },

        setTitle: function (title) {
            this.set('title', title);
            return this;
        },

        getTitle: function () {
            return this.get('title');
        },

        call: $.noop
    });

    ox.ui.AppPlaceholder = AbstractApp.extend({

        initialize: function () {
            // call super constructor
            AbstractApp.prototype.initialize.apply(this, arguments);
        },

        launch: function () {
            var self = this, id = (this.get('name') || this.id) + '/main', requires = this.get('requires');
            if (upsell.has(requires)) {
                //resolve/reject clears busy animation
                var def = $.Deferred();
                return ox.launch(id, { launched: def.promise() })
                         .then(function () { self.quit(); })
                         .always(def.resolve);
            } else {
                upsell.trigger({ type: 'app', id: id, missing: upsell.missing(requires) });
            }
        },

        quit: function (force) {
            // mark as not running
            this.set('state', 'stopped');
            // remove from list
            ox.ui.apps.remove(this);
        }
    });

    ox.ui.App = AbstractApp.extend({

        defaults: {
            window: null,
            state: 'ready',
            saveRestorePointTimer: null,
            launch: function () { return $.when(); },
            quit: function () { return $.when(); }
        },

        initialize: function () {

            var self = this;

            // call super constructor
            AbstractApp.prototype.initialize.apply(this, arguments);

            this.set('uniqueID', _.now() + '.' + String(Math.random()).substr(3, 4));

            var save = $.proxy(this.saveRestorePoint, this);
            $(window).on('unload', save);
            this.set('saveRestorePointTimer', setInterval(save, 10 * 1000)); // 10 secs

            // add folder management
            this.folder = (function () {

                var folder = null, that, win = null, grid = null, type, initialized = $.Deferred();

                that = {

                    initialized: initialized.promise(),

                    unset: function () {
                        // unset
                        folder = null;
                        // update window title?
                        if (win) {
                            win.setTitle(_.noI18n(''));
                        }
                        // update grid?
                        if (grid) {
                            grid.clear();
                        }
                    },

                    set: function (id) {
                        var def = $.Deferred();
                        if (id !== undefined && id !== null && String(id) !== folder) {
                            var activeApp = _.url.hash('app');
                            require(['io.ox/core/api/folder'], function (api) {
                                api.get({ folder: id })
                                .done(function (data) {
                                    // off
                                    api.off('change:' + folder);
                                    var appchange = _.url.hash('app') !== activeApp; //app has changed while folder was requested
                                    // remember
                                    folder = String(id);
                                    if (!appchange) {//only change if the app did not change
                                        // update window title & toolbar?
                                        if (win) {
                                            win.setTitle(_.noI18n(data.title));
                                            win.updateToolbar();
                                        }
                                        // update grid?
                                        if (grid && grid.prop('folder') !== folder) {
                                            grid.busy().prop('folder', folder);
                                            if (win && win.search.active) {
                                                win.search.close();
                                            } else {
                                                grid.refresh();
                                            }
                                            // load fresh folder & trigger update event
                                            api.reload(id);
                                        }
                                        // update hash
                                        _.url.hash('folder', folder);
                                        self.trigger('folder:change', folder, data);
                                    }
                                    def.resolve(data, appchange);

                                    if (initialized.state() !== 'resolved') {
                                        initialized.resolve(folder, data);
                                    }
                                })
                                .fail(def.reject);
                            });
                        } else {
                            def.reject();
                        }
                        return def;
                    },

                    setType: function (t) {
                        type = t;
                        return this;
                    },

                    setDefault: function () {
                        var def = new $.Deferred();
                        require(['settings!io.ox/core', 'settings!io.ox/mail'], function (coreConfig, mailConfig) {
                            var defaultFolder = type === 'mail' ?
                                    mailConfig.get('folder/inbox') :
                                    coreConfig.get('folder/' + type);
                            if (defaultFolder) {
                                that.set(defaultFolder)
                                    .done(def.resolve)
                                    .fail(def.reject);
                            } else {
                                def.reject();
                            }
                        });
                        return def;
                    },

                    get: function () {
                        return folder;
                    },

                    getData: function () {

                        if (folder === null) return $.Deferred.resolve({});

                        return require(['io.ox/core/api/folder']).pipe(function (api) {
                            return api.get({ folder: folder });
                        });
                    },

                    updateTitle: function (w) {
                        win = w;
                        return this;
                    },

                    updateGrid: function (g) {
                        grid = g;
                        return this;
                    },

                    destroy: function () {
                        that = win = grid = null;
                    }
                };

                return that;
            }());
        },

        setLauncher: function (fn) {
            this.set('launch', fn);
            return this;
        },

        setQuit: function (fn) {
            this.set('quit', fn);
            return this;
        },

        setWindow: function (win) {
            this.set('window', win);
            win.app = this;
            // add app name
            if (this.has('name')) {
                win.nodes.outer.attr('data-app-name', this.get('name'));
            }
            return this;
        },

        getWindow: function () {
            return this.get('window');
        },

        getWindowNode: function () {
            return this.has('window') ? this.get('window').nodes.main : $();
        },

        getWindowTitle: function () {
            return this.has('window') ? this.has('window').getTitle() : '';
        },

        /**
         * Registers an event handler at a global browser object (e.g. the
         * window, the document, or the <body> element) that listens to the
         * specified event or events. The event handler will only be active
         * while the application window is visible, and will be inactive while
         * the application window is hidden.
         *
         * @param {Object|String} target
         *  The target object that will trigger the specified events. Can be
         *  any object or value that can be passed to the jQuery constructor.
         *
         * @param {String} eventType
         *  The event name(s) the handler function will be registered for.
         *
         * @param {Function} eventHandler
         *  The event handler function bound to the specified events. Will be
         *  triggered once automatically when the application window becomes
         *  visible.
         *
         * @returns {ox.io.App}
         *  A reference to this application instance.
         */
        registerGlobalEventHandler: function (target, eventType, eventHandler) {
            var handlers = {
                show: function () {
                    $(target).on(eventType, eventHandler);
                    eventHandler();
                },
                hide: function () {
                    $(target).off(eventType, eventHandler);
                }
            };
            if (this.getWindow().on(handlers).state.visible) handlers.show();
            return this;
        },

        /**
         * Registers an event handler at the browser window that listens to
         * 'resize' events. The event handler will only be active while the
         * application window is visible, and will be inactive while the
         * application window is hidden.
         *
         * @param {Function} resizeHandler
         *  The resize handler function bound to 'resize' events of the browser
         *  window. Will be triggered once automatically when the application
         *  window becomes visible.
         *
         * @returns {ox.io.App}
         *  A reference to this application instance.
         */
        registerWindowResizeHandler: function (resizeHandler) {
            return this.registerGlobalEventHandler(window, 'resize', resizeHandler);
        },

        setState: function (obj) {
            for (var id in obj) {
                _.url.hash(id, String(obj[id]));
            }
        },

        getState: function () {
            return _.url.hash();
        },

        launch: function (options) {

            var deferred = $.when(),
                self = this,
                isDisabled = ox.manifests.isDisabled(this.getName() + '/main');

            // update hash
            if (this.get('name') !== _.url.hash('app')) {
                _.url.hash({ folder: null, perspective: null, id: null });
            }
            if (this.has('name')) {
                _.url.hash('app', this.get('name'));
            }

            if (this.get('state') === 'ready') {
                this.set('state', 'initializing');
                if (isDisabled) {
                    deferred = $.Deferred().reject();
                } else {
                    deferred = this.get('launch').call(this, options || {}) || $.when();
                }
                deferred
                .done(function () {
                    ox.ui.apps.add(self);
                    self.set('state', 'running');
                    self.trigger('launch', self);
                })
                .fail(function () {
                    ox.launch(
                        require('settings!io.ox/core').get('autoStart')
                    );
                });
            } else if (this.has('window')) {
                // toggle app window
                this.get('window').show();
                this.trigger('resume', this);
            }

            return deferred.pipe(function () {
                return $.Deferred().resolveWith(self, arguments);
            });
        },

        quit: function (force) {
            // call quit function
            var def = force ? $.when() : (this.get('quit').call(this) || $.when()), win, self = this;
            return def.done(function () {
                // not destroyed?
                if (force && self.destroy) {
                    self.destroy();
                }
                // update hash but don't delete information of other apps that might already be open at this point (async close when sending a mail for exsample);
                if (!_.url.hash('app') || self.getName() === _.url.hash('app').split(':', 1)[0]) {
                    //we are still in the app to close so we can clear the URL
                    _.url.hash({ app: null, folder: null, perspective: null, id: null });
                }
                // don't save
                clearInterval(self.get('saveRestorePointTimer'));
                self.removeRestorePoint();
                $(window).off('unload', $.proxy(self.saveRestorePoint, self));
                // destroy stuff
                self.folder.destroy();
                if (self.has('window')) {
                    win = self.get('window');
                    win.trigger("quit");
                    ox.ui.windowManager.trigger("window.quit", win);
                    win.destroy();
                }
                // remove from list
                ox.ui.apps.remove(self);
                // mark as not running
                self.trigger('quit');
                self.set('state', 'stopped');
                // remove app's properties
                for (var id in self) {
                    delete self[id];
                }
                // don't leak
                self = win = null;
            });
        },

        saveRestorePoint: function () {
            var self = this, uniqueID = self.get('uniqueID');
            if (this.failSave) {
                appCache.get('savepoints').done(function (list) {
                    // might be null, so:
                    list = list || [];
                    var data, ids, pos;
                    try {
                        data = self.failSave();
                        ids = _(list).pluck('id');
                        pos = _(ids).indexOf(uniqueID);
                        data.id = uniqueID;
                        if (data) {
                            if (pos > -1) {
                                // replace
                                list.splice(pos, 1, data);
                            } else {
                                // add
                                list.push(data);
                            }
                        }
                    } catch (e) {
                        // looks broken, so remove from list
                        if (pos > -1) { list.splice(pos, 1); delete self.failSave; }
                    }
                    if (list.length > 0) {
                        appCache.add('savepoints', list);
                    }
                });
            }
        },

        removeRestorePoint: function () {
            var uniqueID = this.get('uniqueID');
            ox.ui.App.removeRestorePoint(uniqueID);
        }
    });

    // static methods
    _.extend(ox.ui.App, {

        canRestore: function () {
            // use get instead of contains since it might exist as empty list
            return this.getSavePoints().pipe(function (list) {
                return list && list.length;
            });
        },

        getSavePoints: function () {
            return appCache.get('savepoints').pipe(function (list) {
                return _(list || []).filter(function (obj) { return 'point' in obj; });
            });
        },

        removeRestorePoint: function (id) {
            return appCache.get('savepoints').pipe(function (list) {
                list = list || [];
                var ids = _(list).pluck('id'),
                    pos = _(ids).indexOf(id);
                list = list.slice();
                if (pos > -1) {
                    list.splice(pos, 1);
                }
                return appCache.add('savepoints', list).then(function () {
                    return list;
                });
            });
        },

        restore: function () {
            this.getSavePoints().done(function (data) {
                $.when.apply($,
                    _(data).map(function (obj) {
                        adaptiveLoader.stop();
                        var requirements = adaptiveLoader.startAndEnhance(obj.module, [obj.module + "/main"]);
                        return ox.load(requirements).pipe(function (m) {
                            return m.getApp().launch().done(function () {
                                // update unique id
                                obj.id = this.get('uniqueID');
                                if (this.failRestore) {
                                    // restore
                                    this.failRestore(obj.point);
                                }
                            });
                        });
                    })
                )
                .done(function () {
                    // we don't remove that savepoint now because the app might crash during restore!
                    // in this case, data would be lost
                    appCache.add('savepoints', data || []);
                });
            });
        },

        get: function (name) {
            return ox.ui.apps.filter(function (app) {
                return app.getName() === name;
            });
        },

        getByCid: function (cid) {
            return ox.ui.apps.chain().filter(function (app) {
                return app.cid === cid;
            }).first().value();
        },

        reuse: function (cid) {
            var app = ox.ui.apps.find(function (m) { return m.cid === cid; }), win;
            if (app) {
                app.launch();
                return true;
            }
            return false;
        },

        getCurrentApp: function () {
            return currentWindow !== null ? currentWindow.app : null;
        },

        getCurrentWindow: function () {
            return currentWindow;
        }
    });

    // show
    $("#io-ox-core").show();

    // check if any open application has unsaved changes
    window.onbeforeunload = function () {

        var // find all applications with unsaved changes
            dirtyApps = ox.ui.apps.filter(function (app) {
                return _.isFunction(app.hasUnsavedChanges) && app.hasUnsavedChanges();
            });

        // browser will show a confirmation dialog, if onbeforeunload returns a string
        if (dirtyApps.length > 0) {
            return gt('There are unsaved changes.');
        }
    };

    /**
     * Create app
     */
    ox.ui.createApp = function (options) {
        return new ox.ui.App(options);
    };

    ox.ui.screens = (function () {

        var current = null,

            that = {

                add: function (id) {
                    return $('<div>', { id: 'io-ox-' + id }).addClass('abs').hide()
                        .appendTo('#io-ox-screens');
                },

                get: function (id) {
                    return $('#io-ox-screens').find('#io-ox-' + id);
                },

                current: function () {
                    return current;
                },

                hide: function (id) {
                    this.get(id).hide();
                    this.trigger('hide-' + id);
                },

                show: function (id) {
                    $('#io-ox-screens').children().each(function (i, node) {
                        var attr = $(this).attr('id'),
                            screenId = String(attr || '').substr(6);
                        if (screenId !== id) {
                            that.hide(screenId);
                        }
                    });
                    this.get(id).show();
                    current = id;
                    this.trigger('show-' + id);
                }
            };

        Events.extend(that);

        return that;

    }());

    ox.ui.Perspective = (function () {

        var Perspective = function (name) {
            // init
            this.main = $();
            this.name = name;
            this.rendered = false;
            this.render = $.noop;
            this.save = $.noop;
            this.restore = $.noop;
            this.afterShow = $.noop;
            this.afterHide = $.noop;

            this.show = function (app, opt) {

                var win = app.getWindow();
                if (opt.perspective === win.currentPerspective) return;

                this.main = win.addPerspective(this);

                // trigger change event
                if (win.currentPerspective !== 'main') {
                    win.trigger('change:perspective', name, opt.perspective);
                } else {
                    win.trigger('change:initialPerspective', name);
                }

                // set perspective (show)
                win.setPerspective(this);

                _.url.hash('perspective', opt.perspective);

                // render?
                if (!this.rendered) {
                    this.render(app, opt);
                    this.rendered = true;
                }

                win.currentPerspective = opt.perspective;
                win.updateToolbar();
                this.afterShow(app, opt);
            };

            this.hide = function () {
                this.main.hide();
                this.afterHide();
            };
        };

        function handlePerspectiveChange(app, p, newPers) {

            var oldPers = app.getWindow().getPerspective();

            if (oldPers && _.isFunction(oldPers.save)) {
                oldPers.save();
            }

            if (newPers) {
                newPers.show(app, { perspective: p });
                if (_.isFunction(newPers.restore)) {
                    newPers.restore();
                }
            }
        }

        Perspective.show = function (app, p) {

            if (p === 'main') {
                var win = app.getWindow(),
                    perspective = win.getPerspective();
                if (perspective) {
                    perspective.hide();
                }
                win.currentPerspective = 'main';
                win.nodes.main.show();
                return $.when();
            }

            return require([app.get('name') + '/' + p.split(":")[0] + '/perspective'], function (newPers) {
                handlePerspectiveChange(app, p, newPers);
            });
        };

        return Perspective;

    }());

    ox.ui.windowManager = (function () {

        var that = Events.extend({}),
            // list of windows
            windows = [],
            // get number of open windows
            numOpen = function () {
                return _(windows).inject(function (count, obj) {
                    return count + (obj.state.open ? 1 : 0);
                }, 0);
            };

        that.getWindows = function () {
            return windows.slice();
        };

        ox.ui.screens.on('hide-windowmanager', function () {
            if (currentWindow) {
                currentWindow.hide();
            }
        });

        that.hide = function () {
            ox.ui.screens.hide('windowmanager');
        };

        that.show = function () {
            ox.ui.screens.show('windowmanager');
        };

        that.on("window.open window.show", function (e, win) {
            // show window managher
            this.show();
            // move/add window to top of stack
            windows = _(windows).without(win);
            windows.unshift(win);
            // add current windows to cache
            if (windows.length > 1) {
                var winCache = _(windows).map(function (w) {
                    return w.name;
                });
                appCache.add('windows', winCache || []);
            }
        });

        that.on("window.beforeshow", function (e, win) {
            that.trigger("empty", false);
        });

        that.on("window.close window.quit window.pre-quit", function (e, win, type) {
            // fallback for different trigger functions
            if (!type) {
                type = e.type + '.' + e.namespace;
            }
            var pos = _(windows).indexOf(win), i, $i, w;
            if (pos !== -1) {
                // quit?
                if (type === "window.quit") {
                    // remove item at pos
                    windows.splice(pos, 1);
                }
                // close?
                else if (type === "window.close" || type === 'window.pre-quit') {
                    // add/move window to end of stack
                    windows = _(windows).without(win);
                    windows.push(win);
                }
                // find first open window
                for (i = 0, $i = windows.length; i < $i; i++) {
                    w = windows[i];
                    if (w !== win && w.state.open) {
                        w.show();
                        break;
                    }
                }
                //remove the window from cache if it's there
                appCache.get('windows').done(function (winCache) {
                    var index = _.indexOf(winCache, win.name);

                    if (index > -1) {
                        winCache.splice(index, 1);
                        appCache.add('windows', winCache || []);
                    }
                });
            }

            var isEmpty = numOpen() === 0;
            if (isEmpty) {
                appCache.get('windows').done(function (winCache) {
                    that.trigger("empty", true, winCache ? winCache[1] || null : null);
                });
            } else {
                that.trigger("empty", false);
            }
        });

        return that;

    }());

    /**
     * Create window
     */
    ox.ui.createWindow = (function () {

        // window guid
        var guid = 0,

            pane = $("#io-ox-windowmanager-pane"),

            getX = function (node) {
                return node.data("x") || 0;
            },

            scrollTo = function (node, cont) {

                var index = node.data("index") || 0,
                    left = (-index * 101),
                    done = function () {
                        // use timeout for smoother animations
                        setTimeout(function () {
                            _.call(cont);
                        }, 10);
                    };
                // change?
                if (left !== getX(pane)) {
                    // remember position
                    pane.data("x", left);
                    // do motion TODO: clean up here!
                    if (true) {
                        pane.animate({ left: left + "%" }, 0, done);
                    }
                    // touch device?
                    else if (Modernizr.touch) {
                        pane.css("left", left + "%");
                        done();
                    }
                    // use CSS transitions?
                    else if (Modernizr.csstransforms3d) {
                        pane.one(_.browser.WebKit ? "webkitTransitionEnd" : "transitionend", done);
                        pane.css("left", left + "%");
                    } else {
                        pane.stop().animate({ left: left + "%" }, 250, done);
                    }
                } else {
                    done();
                }
            },

            // window class
            Window = function (id, name) {

                name = name || 'generic';

                this.id = id;
                this.name = name;
                this.nodes = { title: $(), toolbar: $(), controls: $(), closeButton: $() };
                this.search = { query: '', active: false };
                this.state = { visible: false, running: false, open: false };
                this.app = null;
                this.detachable = false;
                this.simple = false;

                var quitOnClose = false,
                    perspectives = {},
                    self = this,
                    firstShow = true,
                    shown = $.Deferred();

                this.updateToolbar = function () {
                    var folder = this.app && this.app.folder ? this.app.folder.get() : null,
                        baton = ext.Baton({ window: this, $: this.nodes, app: this.app, folder: folder });
                    ext.point(name + '/toolbar').invoke('draw', this.nodes.toolbar.empty(), baton);
                };

                ext.point(name + '/window-title').extend({
                    id: 'default',
                    draw: function () {
                        return $('<h1 class="window-title">').append(
                            ext.point(name + '/window-title-label')
                                .invoke('draw', this).first().value() || $()
                        );
                    }
                });

                ext.point(name + '/window-title-label').extend({
                    id: 'default',
                    draw: function () {
                        return $('<span class="window-title-label">');
                    }
                });

                ext.point(name + '/window-toolbar').extend({
                    id: 'default',
                    draw: function () {
                        return $('<div class="window-toolbar">');
                    }
                });

                ext.point(name + '/window-head').extend({
                    id: 'default',
                    draw: function () {
                        return this.head.append(
                            this.toolbar = ext.point(name + '/window-toolbar')
                                .invoke('draw', this).first().value() || $()
                        );
                    }
                });

                ext.point(name + '/window-body').extend({
                    id: 'default',
                    draw: function () {
                        return this.body.append(
                            // search area
                            this.search = $('<div class="window-search">'),
                            // default perspective
                            this.main = $('<div class="abs window-content">')
                        );
                    }
                });

                this.shown = shown.promise();

                this.show = function (cont) {
                    var appchange = false;
                    //use the url app string before the first ':' to exclude parameter additions (see how mail write adds the current mode here)
                    if (currentWindow && _.url.hash('app') && self.name !== _.url.hash('app').split(':', 1)[0]) {
                        appchange = true;
                    }
                    // get node and its parent node
                    var node = this.nodes.outer, parent = node.parent();
                    // if not current window or if detached (via funny race conditions)
                    if (!appchange && self && (currentWindow !== this || parent.length === 0)) {
                        // show
                        if (firstShow) {
                            node.data("index", guid - 1).css("left", ((guid - 1) * 101) + "%");
                        }
                        if (node.parent().length === 0) {
                            if (this.simple) {
                                node.insertAfter('#io-ox-topbar');
                                $('body').css('overflowY', 'auto');
                            } else {
                                node.appendTo(pane);
                            }
                        }
                        ox.ui.windowManager.trigger("window.beforeshow", self);
                        this.trigger("beforeshow");
                        this.updateToolbar();
                        //set current appname in url, was lost on returning from edit app
                        if (!_.url.hash('app') || self.app.getName() !== _.url.hash('app').split(':', 1)[0]) {//just get everything before the first ':' to exclude parameter additions
                            _.url.hash('app', self.app.getName());
                        }
                        node.show();
                        scrollTo(node, function () {
                            if (self === null) return;
                            if (currentWindow && currentWindow !== self) {
                                currentWindow.hide();
                            }
                            currentWindow = self;
                            _.call(cont);
                            self.state.visible = true;
                            self.state.open = true;
                            self.trigger("show");
                            document.temptitle = gt.format(
                                //#. Title of the browser window
                                //#. %1$s is the name of the page, e.g. OX App Suite
                                //#. %2$s is the title of the active app, e.g. Calendar
                                gt.pgettext('window title', '%1$s %2$s'),
                                _.noI18n(ox.serverConfig.pageTitle),
                                self.getTitle());
                            if (document.fixedtitle !== true) {//to prevent erasing the New Mail title
                                document.title = document.temptitle;
                            }

                            if (firstShow) {
                                shown.resolve();
                                self.trigger("show:initial"); // alias for open
                                self.trigger("open");
                                self.state.running = true;
                                ox.ui.windowManager.trigger("window.open", self);
                                firstShow = false;
                            }
                            ox.ui.windowManager.trigger("window.show", self);
                            ox.ui.apps.trigger('resume', self.app);
                        });
                    } else {
                        _.call(cont);
                    }
                    return this;
                };

                this.hide = function () {
                    // detach if there are no iframes
                    this.trigger("beforehide");
                    // TODO: decide on whether or not to detach nodes
                    if (this.simple || (this.detachable && this.nodes.outer.find("iframe").length === 0)) {
                        this.nodes.outer.detach();
                        $('body').css('overflowY', '');
                    } else {
                        this.nodes.outer.hide();
                    }
                    this.state.visible = false;
                    this.trigger("hide");
                    ox.ui.windowManager.trigger("window.hide", this);
                    if (currentWindow === this) {
                        currentWindow = null;
                        document.temptitle = _.noI18n(ox.serverConfig.pageTitle);
                        if (document.fixedtitle !== true) {//to prevent erasing the New Mail title
                            document.title = document.temptitle;
                        }
                    }
                    return this;
                };

                this.toggle = function () {
                    if (currentWindow === this) {
                        this.hide();
                    } else {
                        this.show();
                    }
                    return this;
                };

                this.preQuit = function () {
                    this.hide();
                    this.state.open = false;
                    this.trigger("pre-quit");
                    ox.ui.windowManager.trigger("window.pre-quit", this);
                    return this;
                };

                this.close = function () {

                    // local self
                    var self = this;

                    if (quitOnClose && this.app !== null) {
                        this.trigger("beforequit");
                        this.app.quit()
                            .done(function () {
                                self.state.open = false;
                                self.state.running = false;
                                self = null;
                            });
                    } else {
                        this.hide();
                        this.state.open = false;
                        this.trigger("close");
                        ox.ui.windowManager.trigger("window.close", this);
                    }
                    return this;
                };

                var BUSY_SELECTOR = 'input:not([type="file"], [type="hidden"]), select, textarea, button',
                    TOGGLE_CLASS = 'toggle-disabled';

                this.busy = function (pct, sub, callback) {
                    // use self instead of this to make busy/idle robust for callback use
                    var blocker;
                    if (self) {
                        blocker = self.nodes.blocker;
                        $('body').focus(); // steal focus
                        self.nodes.main.find(BUSY_SELECTOR)
                            .not(':disabled').attr('disabled', 'disabled').addClass(TOGGLE_CLASS);
                        if (_.isNumber(pct)) {
                            pct = Math.max(0, Math.min(pct, 1));
                            blocker.idle().find('.bar').eq(0).css('width', (pct * 100) + '%').parent().show();
                            if (_.isNumber(sub)) {
                                blocker.find('.bar').eq(1).css('width', (sub * 100) + '%').parent().show();
                            }
                            blocker.show();
                        } else {
                            blocker.find('.progress').hide();
                            blocker.busy().show();
                        }
                        if (_.isFunction(callback)) {
                            callback.call(blocker);
                        }
                        self.trigger('busy');
                    }
                    return this;
                };

                this.idle = function (enable) {
                    // use self instead of this to make busy/idle robust for callback use
                    if (self) {
                        self.nodes.blocker.find('.progress').hide()
                            .end().idle().hide()
                            .find('.header, .footer').empty();
                        self.nodes.main.find(BUSY_SELECTOR).filter('.' + TOGGLE_CLASS)
                            .removeAttr('disabled').removeClass(TOGGLE_CLASS);
                        self.trigger('idle');
                    }
                    return this;
                };

                this.destroy = function () {
                    // hide window
                    this.hide();
                    // trigger event
                    this.trigger("destroy");
                    // disconnect from app
                    if (this.app !== null) {
                        this.app.win = null;
                        this.app = null;
                    }
                    // destroy everything
                    this.events.destroy();
                    this.show = this.busy = this.idle = $.noop;
                    this.nodes.outer.remove();
                    this.nodes = self = null;
                    return this;
                };

                this.setQuitOnClose = function (flag) {
                    quitOnClose = !!flag;
                    return this;
                };

                var title = "";

                this.getTitle = function () {
                    return title;
                };

                this.setTitle = function (str) {
                    if (_.isString(str)) {
                        title = str;
                        self.nodes.title.find('span').first().text(title);
                        if (this === currentWindow) {

                            document.temptitle = gt.format(
                                //#. Title of the browser window
                                //#. %1$s is the name of the page, e.g. OX App Suite
                                //#. %2$s is the title of the active app, e.g. Calendar
                                gt.pgettext('window title', '%1$s %2$s'),
                                _.noI18n(ox.serverConfig.pageTitle),
                                title);
                            if (document.fixedtitle !== true) {//to prevent erasing the New Mail title
                                document.title = document.temptitle;
                            }
                        }
                        this.trigger('change:title');
                    } else {
                        console.error('window.setTitle(str) exprects string!', str);
                    }
                    return this;
                };

                this.search = {

                    active: false,
                    query: '',
                    previous: '',
                    lastFocus: '',

                    open: function () {
                        if (!this.active) {
                            this.lastFocus = $(document.activeElement);
                            self.trigger('search:open');
                            self.nodes.body.addClass('search-open');
                            self.nodes.searchField.focus();
                            this.active = true;
                        }
                        return this;
                    },

                    close: function () {
                        if (this.active) {
                            self.trigger('search:close');
                            self.nodes.body.removeClass('search-open');
                            this.active = false;
                            self.nodes.searchField.val('');
                            self.trigger('search:cancel cancel-search');
                            this.query = this.previous = '';
                            this.lastFocus.focus();
                        }
                        return this;
                    },

                    clear: function () {
                        if (this.active) {
                            self.trigger('search:clear');
                            self.nodes.searchField.val('');
                            this.query = this.previous = '';
                        }
                    },

                    toggle: function () {
                        if (this.active) { this.close(); } else { this.open(); }
                        return this;
                    },

                    getOptions: function () {
                        var tmp = {}, data = self.nodes.search.find('.search-options').data();
                        if (data && data.options) {
                            _.each(data.options, function (item) {
                                if (item.checked !== undefined)
                                    tmp[item.name] = item.checked ? 'on' : 'off';
                            });
                        }
                        return tmp;
                    },

                    getQuery: function () {
                        return $.trim(self.nodes.searchField.val());
                    },

                    setQuery: function (query) {
                        self.nodes.searchField.val(this.query = query);
                        return this;
                    },

                    start: function (query) {
                        this.open().setQuery(query);
                        self.trigger('search', query);
                        return this;
                    },

                    stop: function () {
                        this.close();
                        return this;
                    }
                };

                this.addClass = function () {
                    var o = this.nodes.outer;
                    return o.addClass.apply(o, arguments);
                };

                this.addButton = function (options) {

                    var o = $.extend({
                        label: "Action",
                        action: $.noop
                    }, options || {});

                    return $("<div>")
                        .addClass("io-ox-toolbar-link")
                        .text(String(o.label))
                        .on("click", o.action)
                        .appendTo(this.nodes.toolbar);
                };

                this.addPerspective = function (pers) {
                    var id = pers.name, node;
                    if (this.nodes[id] === undefined) {
                        this.nodes.body.append(
                            node = $('<div class="abs window-content">').hide()
                        );
                        perspectives[id] = pers;
                        return this.nodes[id] = node;
                    } else {
                        return this.nodes[id];
                    }
                };

                this.getPerspective = function () {
                    var cur = this.currentPerspective.split(':')[0];
                    return perspectives[cur];
                };

                this.setPerspective = function (pers) {
                    var id = pers.name, current = this.currentPerspective.split(':')[0];
                    if (id !== current && id in perspectives) {
                        if (current in perspectives) perspectives[current].hide();
                        this.nodes[this.currentPerspective = id].show();
                    }
                    return this;
                };

                this.currentPerspective = 'main';

                this.setChromeless = function (mode) {
                    if (mode) {
                        this.nodes.outer.addClass('chromeless-window');
                        this.nodes.head.hide();
                        this.nodes.body.css('left', '0px');
                    } else {
                        this.nodes.outer.removeClass('chromeless-window');
                        this.nodes.head.show();
                        this.nodes.body.css('left', '');
                    }
                };
            };

        // window factory
        return function (options) {

            var opt = $.extend({
                chromeless: false,
                classic: false,
                id: 'window-' + guid,
                name: '',
                search: false,
                title: '',
                toolbar: false,
                width: 0
            }, options);

            // get width
            var meta = (String(opt.width).match(/^(\d+)(px|%)$/) || ["", "100", "%"]).splice(1),
                width = meta[0],
                unit = meta[1],
                // create new window instance
                win = new Window(opt.id, opt.name),
                // close window
                close = function () {
                    win.close();
                };

            // window container
            win.nodes.outer = $('<div class="window-container">')
                .attr({ id: opt.id, "data-window-nr": guid });

            // create very simple window?
            if (opt.simple) {
                win.simple = true;
                win.nodes.outer.addClass('simple-window').append(
                    win.nodes.main = $('<div class="window-content" tabindex="-1">')
                );
                win.nodes.blocker = $();
                win.nodes.sidepanel = $();
                win.nodes.head = $();
                win.nodes.body = $();
                win.nodes.search = $();

            } else {

                win.nodes.outer.append(
                    $('<div class="window-container-center">')
                    .data({ width: width + unit })
                    .css({ width: width + unit })
                    .append(
                        // blocker
                        win.nodes.blocker = $('<div class="abs window-blocker">').hide().append(
                            $('<div class="abs header">'),
                            $('<div class="progress progress-striped active first"><div class="bar" style="width: 0%;"></div></div>').hide(),
                            $('<div class="progress progress-striped progress-warning active second"><div class="bar" style="width: 0%;"></div></div>').hide(),
                            $('<div class="abs footer">')
                        ),
                        // window HEAD
                        win.nodes.head = $('<div class="window-head">'),
                        // window SIDEPANEL
                        win.nodes.sidepanel = $('<div class="window-sidepanel collapsed">'),
                        // window BODY
                        win.nodes.body = $('<div class="window-body">')
                    )
                    // capture controller events
                    .on('controller:quit', function () {
                        if (win.app) { win.app.quit(); }
                    })
                );

                // classic window header?
                if (opt.classic) win.nodes.outer.addClass('classic');

                // add default css class
                if (opt.name) {
                    win.nodes.outer.addClass(opt.name.replace(/[.\/]/g, '-') + '-window');
                }

                // draw window head
                ext.point(opt.name + '/window-head').invoke('draw', win.nodes);
                ext.point(opt.name + '/window-body').invoke('draw', win.nodes);
            }

            // add event hub
            Events.extend(win);

            // search?
            if (opt.search) {
                // search
                var triggerSearch = function (query) {
                        win.trigger('search', query);
                    };

                var searchId = 'search_' + _.now(); // acccessibility

                var searchHandler = {

                    keydown: function (e) {
                        if (e.which === 27) {
                            win.search.close();
                        } else if (e.which === 13) {
                            searchHandler.change(e);
                        }
                    },

                    clear: function (e) {
                        win.search.clear();
                    },

                    change: function (e) {
                        e.stopPropagation();
                        win.search.query = win.search.getQuery();
                        win.search.options = JSON.stringify(win.search.getOptions());
                        var changed = win.search.query !== win.search.previous || win.search.options !== win.search.optionsprev;
                        // trigger search?
                        if (win.search.query !== '' && changed) {
                            win.search.optionsprev = win.search.options;
                            triggerSearch(win.search.previous = win.search.query);
                        }
                        else if (win.search.query === '') {
                            win.search.clear();
                        }
                    }
                };

                $('<form class="form-search form-inline">').append(
                    $('<div class="input-append">').append(
                        $('<label>', { 'for': searchId }).addClass('search-query-container').append(
                            // search field
                            win.nodes.searchField = $('<input type="text" class="span6 search-query">')
                            .attr({
                                name: 'query',
                                autocomplete: 'off',
                                tabindex: '1',
                                placeholder: gt('Search') + ' ...',
                                id: searchId,
                                'aria-label': gt('Search')
                            })
                            .on(searchHandler)
                            .placeholder(),
                            // 'clear' X
                            $('<i class="icon-remove clear-query">')
                            .on('click', searchHandler.clear)
                        ),
                        $('<button type="submit" data-action="search" class="btn margin-right" aria-hidden="true">')
                            .on('click', searchHandler.change)
                            .append('<i class="icon-search">')

                    ),
                    //abort button
                    $('<a href="#" data-action="remove" tabindex="1">×</a>')
                    .addClass('close close-big')
                    .on('click', function (e) { e.preventDefault(); win.search.stop(); })
                )
                .on('change', 'input', function () { win.search.previous = ''; })
                .on('submit', false)
                .appendTo(win.nodes.search);
            }

            // fix height/position/appearance
            if (opt.chromeless) {

                win.setChromeless(true);

            } else if (opt.name) {

                // toolbar
                ext.point(opt.name + '/toolbar').extend(new links.ToolbarLinks({
                    id: 'links',
                    ref: opt.name + '/links/toolbar'
                }));

                // add search
                if (opt.search === true) {

                    new links.Action(opt.name + '/actions/search', {
                        action:  function (baton) {
                            baton.window.search.toggle();
                        }
                    });

                    new links.ActionLink(opt.name + '/links/toolbar/search', {
                        label: gt('Toggle search'),
                        ref: opt.name + '/actions/search'
                    });

                    new links.ActionGroup(opt.name + '/links/toolbar', {
                        id: 'search',
                        index: 300,
                        icon: function () {
                            return $('<i class="icon-search">').attr('aria-label', gt('Search'));
                        }
                    });

                    // look for ctrl/cmd + F
                    win.nodes.outer.on('keydown', function (e) {
                        if (e.which === 70 && e.metaKey) {
                            e.preventDefault();
                            win.search.toggle();
                        }
                    });
                }

                // add fullscreen handler
                if (opt.fullscreen === true) {

                    new links.Action(opt.name + '/actions/fullscreen', {
                        action:  function (baton) {
                            if (BigScreen.enabled) {
                                BigScreen.toggle(baton.$.outer.get(0));
                            }
                        }
                    });

                    new links.ActionLink(opt.name + '/links/toolbar/fullscreen', {
                        ref: opt.name + '/actions/fullscreen'
                    });

                    new links.ActionGroup(opt.name + '/links/toolbar', {
                        id: 'fullscreen',
                        index: 1000,
                        icon: function () {
                            return $('<i class="icon-resize-full">');
                        }
                    });
                }
            }
            // inc
            guid++;

            // return window object
            return win;
        };

    }());

    // wraps require function
    ox.load = (function () {

        var def,
            $blocker = $('#background_loader'),
            buttonTimer,
            launched;

        function startTimer() {
            var blockerTimer = setTimeout(function () {
                // visualize screen blocker
                ox.busy(true);
                buttonTimer = setTimeout(function () {
                    // add button to abort
                    if (!$blocker[0].firstChild) {
                        var button = $('<button type="button" class="btn btn-primary">').text(gt('Cancel')).fadeIn();
                        button.on('click', function () {
                            def.reject(true);
                            clear(blockerTimer);
                        });
                        $blocker
                            .append(button);
                    }
                }, 5000);
            }, 1000);
            return blockerTimer;
        }

        function clear(blockerTimer) {
            clearTimeout(blockerTimer);
            clearTimeout(buttonTimer);
            blockerTimer = null;
            buttonTimer = null;
            setTimeout(function () {
                if (blockerTimer === null) {
                    ox.idle();
                }
            }, 0);
        }

        function clearViaLauncher(blockerTimer) {
//            launched is a deferred used for a delayed clear
            launched.always(function () {
                clear(blockerTimer);
            });
        }

        return function (req, data) {
            assert(arguments.length <= 1 || arguments.length === 2 && !_.isFunction(data), 'ox.load does not support callback params.');

            def = $.Deferred();
            launched = data && data.launched ? data.launched : $.Deferred().resolve();

            // block UI
            if (!$blocker.hasClass('secure')) {
                ox.busy();
            }
            var blockertimer = startTimer();

            require(req).always(clearViaLauncher(blockertimer)).then(
                def.resolve,
                function fail() {
                    def.reject(false);
                    if (_.isArray(req)) {
                        for (var i = 0; i < req.length; i++) {
                            requirejs.undef(req[i]);
                        }
                    }
                }
            );

            return def;
        };
    }());

    ox.busy = function (block) {
        // init screen blocker
        $('#background_loader')[block ? 'busy' : 'idle']()
            .show()
            .addClass('secure' + (block ? ' block' : ''));
    };

    ox.idle = function () {
        $('#background_loader')
            .removeClass('secure block')
            .hide()
            .idle()
            .empty();
    };
    // only disable, don't show night-rider
    ox.disable = function () {
        $('#background_loader')
            .addClass('busy block secure')
            .on('touchmove', function (e) {
                e.preventDefault();
                return false;
            })
            .show();
    };

    // simple launch
    ox.launch = function (id, data) {
        var def = $.Deferred();
        if (_.isString(id)) {
            adaptiveLoader.stop();
            var requirements = adaptiveLoader.startAndEnhance(id.replace(/\/main$/, ''), [id]);
            ox.load(requirements, data).then(
                function (m) {
                    m.getApp(data).launch(data).done(function () {
                        def.resolveWith(this, arguments);
                    });
                },
                function (err) {
                    notifications.yell('error', gt('Failed to start application. Maybe you have connection problems. Please try again.'));
                    requirejs.undef(id);
                }
            );
        } else {
            def.resolve({});
        }
        return def;
    };

    ox.ui.apps.on("resume", function (app) {
        adaptiveLoader.stop();
        adaptiveLoader.listen(app.get("name"));
    });


    return {};

});
