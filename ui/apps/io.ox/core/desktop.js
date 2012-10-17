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
     "gettext!io.ox/core"], function (Events, ext, links, cache, gt) {

    "use strict";

    /**
     * Core UI
     */

    console.warn(gt('i18n test string - do not translate this'));

    // current window
    var currentWindow = null;

    // top bar
    var topbar = $("#io-ox-topbar"),
        launchers = topbar.find('.launchers'),

        appGuid = 0,
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
            var self = this;
            return ox.launch((this.get('name') || this.id) + '/main').done(function () {
                self.quit();
            });
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

                var folder = null, that, win = null, grid = null, type, hChanged;

                hChanged = function (e) {
                    that.set(e.data.folder);
                    self.trigger('folder:refresh', e.data.folder);
                };

                that = {

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
                        if (id !== undefined && id !== null) {
                            require(['io.ox/core/api/folder'], function (api) {
                                api.get({ folder: id })
                                .done(function (data) {
                                    // off
                                    api.off('change:' + folder);
                                    // remember
                                    folder = String(id);
                                    // process change
                                    // look for change folder event
                                    api.on('change:' + folder, { folder: folder }, hChanged);
                                    // update window title & toolbar?
                                    if (win) {
                                        win.setTitle(_.noI18n(data.title));
                                        win.updateToolbar();
                                    }
                                    // update grid?
                                    if (grid && grid.prop('folder') !== folder) {
                                        grid.clear();
                                        grid.prop('folder', folder);
                                        if (win && win.getSearchQuery() !== '') {
                                            win.setSearchQuery('');
                                            grid.setMode('all');
                                        } else {
                                            grid.refresh();
                                        }
                                    }
                                    // update hash
                                    _.url.hash('folder', folder);
                                    self.trigger('folder:change', folder, data);
                                    def.resolve(data);
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
                        require(['io.ox/core/config'], function (config) {
                            var defaultFolder = type === 'mail' ?
                                    config.get('mail.folder.inbox') :
                                    config.get('folder.' + type);
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

        setState: function (obj) {
            for (var id in obj) {
                _.url.hash(id, String(obj[id]));
            }
        },

        getState: function () {
            return _.url.hash();
        },

        launch: function () {

            var deferred = $.when(), self = this;

            // update hash
            if (this.get('name') !== _.url.hash('app')) {
                _.url.hash('folder', null);
                _.url.hash('perspective', null);
                _.url.hash('id', null);
            }
            if (this.has('name')) {
                _.url.hash('app', this.get('name'));
            }

            if (this.get('state') === 'ready') {
                this.set('state', 'initializing');
                (deferred = this.get('launch').apply(this, arguments) || $.when())
                .done(function () {
                    ox.ui.apps.add(self);
                    self.set('state', 'running');
                    self.trigger('launch', self);
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
                // update hash
                _.url.hash('app', null);
                _.url.hash('folder', null);
                _.url.hash('perspective', null);
                _.url.hash('id', null);
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
            var self = this;
            if (this.failSave) {
                appCache.get('savepoints').done(function (list) {
                    // might be null, so:
                    list = list || [];

                    var data = self.failSave(),
                        ids = _(list).pluck('id'),
                        pos = _(ids).indexOf(self.get('uniqueID'));

                    data.id = self.get('uniqueID');

                    if (pos > -1) {
                        // replace
                        list.splice(pos, 1, data);
                    } else {
                        // add
                        list.push(data);
                    }
                    appCache.add('savepoints', list);
                });
            }
        },

        removeRestorePoint: function () {
            var self = this;
            appCache.get('savepoints').done(function (list) {
                list = list || [];
                var ids = _(list).pluck('id'),
                    pos = _(ids).indexOf(self.get('uniqueID'));

                if (pos > -1) {
                    list.splice(pos, 1);
                }
                appCache.add('savepoints', list);
            });
        }
    });

    // static methods
    _.extend(ox.ui.App, {

        canRestore: function () {
            // use get instead of contains since it might exist as empty list
            return appCache.get('savepoints').pipe(function (list) {
                return list && list.length;
            });
        },

        getSavePoints: function () {
            return appCache.get('savepoints').pipe(function (list) {
                return list || [];
            });
        },

        restore: function () {
            this.getSavePoints().done(function (data) {
                $.when.apply($,
                    _(data).map(function (obj) {
                        return require([obj.module + '/main']).pipe(function (m) {
                            return m.getApp().launch().done(function () {
                                // update unique id
                                obj.id = this.id;
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
            var rendered = false,
                initialized = false;

            this.main = $();

            this.show = function (app, force) {
                // make sure it's initialized
                if (!force) {
                    force = false;
                }
                if (!initialized) {
                    this.main = app.getWindow().addPerspective(name);
                    initialized = true;
                }
                // set perspective
                app.getWindow().setPerspective(name);
                _.url.hash('perspective', name);
                // render?
                if (!rendered || force) {
                    this.render(app);
                    rendered = true;
                }
            };

            this.render = $.noop;

            this.setRendered = function (value) {
                rendered = value;
            };
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
        });

        that.on("window.beforeshow", function (e, win) {
            that.trigger("empty", false);
        });

        that.on("window.close window.quit window.pre-quit", function (e, win, type) {

            var pos = _(windows).indexOf(win), i, $i, w;
            if (pos !== -1) {
                // quit?
                if (type === "window.quit") {
                    windows.splice(pos, 1);
                }
                // close?
                else if (type === "window.close" || type === 'window.pre-quit') {
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
            }

            that.trigger("empty", numOpen() === 0);
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

                var children = pane.find(".window-container-center"),
                    center = node.find(".window-container-center").show(),
                    index = node.data("index") || 0,
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
                this.nodes = { title: $(), toolbar: $(), controls: $() };
                this.search = { query: '', active: false };
                this.state = { visible: false, running: false, open: false };
                this.app = null;
                this.detachable = true;

                var quitOnClose = false,
                    // perspectives
                    perspectives = { main: true },
                    currentPerspective = "main",
                    self = this,
                    firstShow = true;

                this.updateToolbar = function () {
                    ext.point(name + '/toolbar')
                        .invoke('draw', this.nodes.toolbar.empty(), this.app || this);
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

                ext.point(name + '/window-controls').extend({
                    id: 'default',
                    draw: function () {
                        return $('<div class="window-controls">').append(
                            // fullscreen
                            this.fullscreenButton = $('<div class="window-control pull-right">').hide()
                                .append($('<button class="btn btn-inverse pull-right"><i class="icon-resize-full icon-white"></button>')),
                                // settings
                            this.settingsButton = $('<div class="window-control pull-right">').hide()
                                .text(_.noI18n('\u270E')),
                            // close
                            this.closeButton = $('<div class="window-control pull-right">').hide()
                                .append($('<a class="close">').text(_.noI18n('\u00D7')))
                        );
                    }
                });

                ext.point(name + '/window-head').extend({
                    id: 'default',
                    draw: function () {
                        return this.head.append(
                            $('<div class="css-table-row">').append(
                                // title
                                $('<div class="css-table-cell cell-30">').append(
                                    this.title = ext.point(name + '/window-title')
                                        .invoke('draw', this).first().value() || $()
                                ),
                                // toolbar
                                $("<div class='css-table-cell cell-40 cell-center'>").append(
                                    this.toolbar = ext.point(name + '/window-toolbar')
                                        .invoke('draw', this).first().value() || $()
                                ),
                                // controls
                                $("<div class='css-table-cell cell-30 cell-right'>").append(
                                    this.controls = ext.point(name + '/window-controls')
                                        .invoke('draw', this).first().value() || $()
                                )
                            )
                        );
                    }
                });

                ext.point(name + '/window-body').extend({
                    id: 'default',
                    draw: function () {
                        return this.body.append(
                            this.main = $('<div class="window-content">')
                        );
                    }
                });

                this.show = function (cont) {
                    // get node and its parent node
                    var node = this.nodes.outer, parent = node.parent();
                    // if not current window or if detached (via funny race conditions)
                    if (currentWindow !== this || parent.length === 0) {
                        // show
                        if (firstShow) {
                            node.data("index", guid - 1).css("left", ((guid - 1) * 101) + "%");
                        }
                        if (node.parent().length === 0) {
                            node.appendTo(pane);
                        }
                        ox.ui.windowManager.trigger("window.beforeshow", self);
                        this.trigger("beforeshow");
                        this.updateToolbar();
                        node.show();
                        scrollTo(node, function () {
                            if (currentWindow && currentWindow !== self) {
                                currentWindow.hide();
                            }
                            currentWindow = self;
                            _.call(cont);
                            self.state.visible = true;
                            self.state.open = true;
                            self.trigger("show");
                            document.title = gt('%1$s %2$s', _.noI18n(ox.serverConfig.pageTitle), self.getTitle());
                            if (firstShow) {
                                self.trigger("open");
                                self.state.running = true;
                                ox.ui.windowManager.trigger("window.open", self);
                                firstShow = false;
                            }
                            ox.ui.windowManager.trigger("window.show", self);
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
                    if (false && this.detachable && this.nodes.outer.find("iframe").length === 0) {
                        this.nodes.outer.detach();
                    } else {
                        this.nodes.outer.hide();
                    }
                    this.state.visible = false;
                    this.trigger("hide");
                    ox.ui.windowManager.trigger("window.hide", this);
                    if (currentWindow === this) {
                        currentWindow = null;
                        document.title = _.noI18n(ox.serverConfig.pageTitle);
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

                var BUSY_SELECTOR = 'input, select, textarea, button',
                    TOGGLE_CLASS = 'toggle-disabled';

                this.busy = function (pct) {
                    // use self instead of this to make busy/idle robust for callback use
                    var blocker;
                    if (self) {
                        blocker = self.nodes.blocker;
                        $('body').focus(); // steal focus
                        self.nodes.main.find(BUSY_SELECTOR)
                            .not(':disabled').attr('disabled', 'disabled').addClass(TOGGLE_CLASS);
                        if (_.isNumber(pct)) {
                            pct = Math.max(0, Math.min(pct, 1));
                            blocker.idle().find('.bar').css('width', (pct * 100) + '%').parent().show();
                            blocker.show();
                        } else {
                            blocker.find('.progress').hide();
                            blocker.busy().show();
                        }
                        self.trigger('busy');
                    }
                    return this;
                };

                this.idle = function (enable) {
                    // use self instead of this to make busy/idle robust for callback use
                    if (self) {
                        self.nodes.blocker.find('.progress').hide().end().idle().hide();
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
                            document.title = gt('%1$s %2$s', _.noI18n(ox.serverConfig.pageTitle), title);
                        }
                        this.trigger('change:title');
                    } else {
                        console.error('window.setTitle(str) exprects string!', str);
                    }
                    return this;
                };

                this.getSearchQuery = function () {
                    return $.trim(this.nodes.search.val());
                };

                this.setSearchQuery = function (q) {
                    this.nodes.search.val(q);
                    return this;
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

                this.addPerspective = function (id) {
                    if (this.nodes[id] === undefined) {
                        var node = $("<div>")
                            .addClass("window-content").hide()
                            .appendTo(this.nodes.body);
                        return (this.nodes[id] = perspectives[id] = node);
                    }
                };

                this.setPerspective = function (id) {
                    if (id !== currentPerspective) {
                        if (perspectives[id] !== undefined) {
                            this.nodes[currentPerspective].hide();
                            this.nodes[currentPerspective = id].show();
                        }
                    }
                    return this;
                };
            };

        // window factory
        return function (options) {

            var opt = $.extend({
                id: "window-" + guid,
                name: "",
                width: 0,
                title: "",
                titleWidth: '300px',
                search: false,
                toolbar: false,
                settings: false,
                chromeless: false
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
                .attr({
                    id: opt.id,
                    "data-window-nr": guid
                })
                .append(
                    $('<div class="window-container-center">')
                    .data({ width: width + unit })
                    .css({ width: width + unit })
                    .append(
                        // blocker
                        win.nodes.blocker = $('<div>').addClass('abs window-blocker').hide()
                            .append($('<div class="progress progress-striped active"><div class="bar" style="width: 0%;"></div></div>').hide()),
                        // window HEAD
                        win.nodes.head = $('<div class="window-head css-table">'),
                        // window BODY
                        win.nodes.body = $('<div class="window-body">')
                    )
                );

            // add default css class
            if (opt.name) {
                win.nodes.outer.addClass(opt.name.replace(/[.\/]/g, '-') + '-window');
            }

            // draw window head
            ext.point(opt.name + '/window-head').invoke('draw', win.nodes);
            ext.point(opt.name + '/window-body').invoke('draw', win.nodes);

            // add event hub
            Events.extend(win);

            // search?
            if (opt.search) {
                // search
                var lastQuery = "",
                    triggerSearch = function (query) {
                        // yeah, waiting for the one who reports this :)
                        if (/^porn$/i.test(query)) {
                            $("body").append(
                                $("<div>")
                                .addClass("abs")
                                .css({
                                    backgroundColor: "black",
                                    zIndex: 65000
                                })
                                .append(
                                    $("<div>")
                                    .addClass("abs").css({
                                        top: "25%",
                                        textAlign: "center",
                                        color: "#aaa",
                                        fontWeight: "bold",
                                        fontSize: "50px",
                                        fontFamily: "'Comic Sans MS', Arial"
                                    })
                                    .html('<span style="color: rgb(230,110,110)">YOU</span> SEARCHED FOR WHAT?')
                                )
                                .append(
                                    $("<div>")
                                    .addClass("abs")
                                    .css({
                                        top: "50%",
                                        width: "670px",
                                        textAlign: "center",
                                        margin: "0 auto 0 auto",
                                        color: "#666"
                                    })
                                    .html(
                                        '<div style="font-size: 26px">WARNING: This website contains explicit adult material.</div>' +
                                        '<div style="font-size: 18px">You may only enter this Website if you are at least 18 years of age, or at least the age of majority in the jurisdiction where you reside or from which you access this Website. If you do not meet these requirements, then you do not have permission to use the Website.</div>'
                                    )
                                )
                                .click(function () {
                                        $(this).remove();
                                    })
                            );
                        } else if (/^use the force$/i.test(query) && currentWindow) {
                            // star wars!
                            currentWindow.nodes.outer.css({
                                webkitTransitionDuration: "2s",
                                webkitTransform: "perspective(500px) rotate3d(1, 0, 0, 45deg)",
                                top: "-150px"
                            });
                            // no search here
                            return;
                        } else if (/^no star wars$/i.test(query) && currentWindow) {
                            // star wars!
                            currentWindow.nodes.outer.css({
                                webkitTransitionDuration: "1s",
                                webkitTransform: "perspective(0px) rotate3d(1, 0, 0, 0deg)",
                                top: ""
                            });
                            // no search here
                            return;
                        }
                        win.trigger("search", query);
                    };

                var searchId = 'search_' + _.now(); // acccessibility

                var setActive = function () {
                    win.search.active = true;
                    win.nodes.search.closest('form').addClass('active-search');
                };

                var setInactive = function () {
                    win.search.active = false;
                    win.nodes.search.val(win.search.query = '');
                    win.nodes.search.closest('form').removeClass('active-search');
                };

                var searchHandler = {
                    keydown: function (e) {
                        e.stopPropagation();
                        if (e.which === 27) {
                            $(this).val('');
                            setInactive();
                            win.trigger("cancel-search", lastQuery = '');
                        }
                    },
                    search: function (e) {
                        e.stopPropagation();
                        if ($(this).val() === "") {
                            $(this).blur();
                            setInactive();
                        }
                    },
                    change: function (e) {
                        e.stopPropagation();
                        win.search.query = $(this).val();
                        // trigger search?
                        if (win.search.query !== '') {
                            setActive();
                            if (win.search.query !== lastQuery) {
                                triggerSearch(lastQuery = win.search.query);
                            }
                        } else if (lastQuery !== "") {
                            setInactive();
                            win.trigger("cancel-search", lastQuery = "");
                        }
                    }
                };

                $('<form class="form-search pull-right">').append(
                    $('<div class="input-append">').append(
                        $('<label>', { 'for': searchId }).append(
                            win.nodes.search = $('<input type="text" class="input-medium search-query">')
                            .attr({
                                tabindex: '1',
                                placeholder: gt('Search') + ' ...',
                                id: searchId
                            })
                            .on(searchHandler)
                            .placeholder()
                        ),
                        $('<button type="submit" class="btn"><i class="icon-search"></i></button>')
                    )
                )
                .on('submit', false)
                .appendTo(win.nodes.controls);
            }

            // toolbar extension point
            if (opt.toolbar === true) {
                // add "create" link
                if (opt.name) {
                    // ToolbarLinks VS ToolbarButtons
                    ext.point(opt.name + '/toolbar').extend(new links.ToolbarLinks({
                        id: 'links',
                        ref: opt.name + '/links/toolbar'
                    }));
                }
            } else {
                // hide toolbar
                win.nodes.head.find('.css-table-cell')
                    .eq(0).removeClass('cell-30').addClass('cell-70').end()
                    .eq(1).hide();
            }

            // fix height/position/appearance
            if (opt.chromeless) {

                win.nodes.head.hide();
                win.nodes.body.css("top", "0px");

            } else {

                // add close handler
                if (opt.close === true) {
                    win.nodes.closeButton.show().on("click", close);
                    win.setQuitOnClose(true);
                }

                // add fullscreen handler
                if (opt.fullscreen === true && win.nodes.fullscreenButton) {
                    win.nodes.fullscreenButton.show().on('click', function () {
                        // Maximize
                        if (BigScreen.enabled) {
                            BigScreen.toggle(win.nodes.outer.get(0));
                        }
                    });
                }

                // set title
                win.setTitle(opt.title);
            }

            // inc
            guid++;

            // return window object
            return win;
        };

    }());

    // simple launch
    ox.launch = function (id, data) {
        var def = $.Deferred();
        if (_.isString(id)) {
            require([id], function (m) {
                m.getApp(data).launch().done(function () {
                    def.resolveWith(this, arguments);
                });
            });
        } else {
            def.resolve({});
        }
        return def;
    };

    return {};

});
