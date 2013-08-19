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
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/portal/main',
    ['io.ox/core/extensions',
     'io.ox/core/api/user',
     'io.ox/core/date',
     'io.ox/core/tk/dialogs',
     'io.ox/portal/widgets',
     'gettext!io.ox/portal',
     'settings!io.ox/portal',
     'less!io.ox/portal/style.less'
    ], function (ext, userAPI, date, dialogs, widgets, gt, settings) {

    'use strict';

    // time-based greeting phrase
    function getGreetingPhrase(name) {
        var hour = new date.Local().getHours();
        // find proper phrase
        if (hour >= 4 && hour <= 11) {
            return gt('Good morning, %s', name);
        } else if (hour >= 18 && hour <= 23) {
            return gt('Good evening, %s', name);
        } else {
            return gt('Hello %s', name);
        }
    }

    function openSettings() {
        require(['io.ox/settings/main'], function (m) {
            m.getApp().launch().done(function () {
                this.getGrid().selection.set({ id: 'io.ox/portal' });
            });
        });
    }

    function setColor(node, model) {
        var color = node.attr('data-color');
        node.removeClass('widget-color-' + color);
        color = model.get('color') || 'black';
        node.addClass('widget-color-' + color).attr('data-color', color);
    }

    // portal header
    ext.point('io.ox/portal/sections').extend({
        id: 'header',
        index: 100,
        draw: function (baton) {
            var $btn = $();
            if (_.device('!small')) {
                // please no button
                $btn = $('<button type="button" class="btn btn-primary pull-right">')
                    .attr('data-action', 'customize')
                    .text(gt('Customize this page'))
                    .on('click', openSettings);
            }
            this.append(
                $('<div class="header">').append(
                    // button
                    $btn,
                    // greeting
                    $('<h1 class="greeting">').append(
                        baton.$.greeting = $('<span class="greeting-phrase">'),
                        $('<span class="signin">').text(
                            //#. Portal. Logged in as user
                            gt('Signed in as %1$s', ox.user)
                        )
                    )
                )
            );
        }
    });

    // widget container
    ext.point('io.ox/portal/sections').extend({
        id: 'widgets',
        index: 200,
        draw: function (baton) {
            this.append(
                baton.$.widgets = $('<ol class="widgets">')
            );
        }
    });

    // widget scaffold
    ext.point('io.ox/portal/widget-scaffold').extend({
        draw: function (baton) {

            this
                .attr({
                    'data-widget-cid': baton.model.cid,
                    'data-widget-id': baton.model.get('id'),
                    'data-widget-type': baton.model.get('type')
                })
                .addClass('widget' + (baton.model.get('inverse') ? ' inverse' : ''))
                .append(
                    // border decoration
                    $('<div>')
                        .addClass('decoration pending')
                        .append(
                            $('<h2>').append(
                                // add remove icon
                                baton.model.get('protectedWidget') ? [] :
                                    $('<a href="#" class="disable-widget"><i class="icon-remove"/></a>')
                                    .attr('title', gt('Disable widget')),
                                // title span
                                $('<span class="title">').text('\u00A0')
                            )
                        )
                );

            setColor(this, baton.model);
        }
    });

    // application object
    var app = ox.ui.createApp({ name: 'io.ox/portal', title: 'Portal' }),
        win,
        scrollPos = window.innerHeight,
        appBaton = ext.Baton({ app: app }),
        sidepopup = new dialogs.SidePopup(),
        collection = widgets.getCollection();

    app.settings = settings;

    collection.on('remove', function (model, e) {
        // remove DOM node
        appBaton.$.widgets.find('[data-widget-cid="' + model.cid + '"]').remove();
        // clean up
        if (model.has('baton')) {
            delete model.get('baton').model;
            model.set('baton', null, {validate: true});
            model.isDeleted = true;
        }
    });

    collection.on('add', function (model) {
        app.drawScaffold(model);
        widgets.loadUsedPlugins().done(function () {
            if (model.has('candidate') !== true) {
                app.drawWidget(model);
            }
        });
    });

    collection.wasElementDeleted = function (model) {
        var needle = model.cid,
            haystack = this.models;
        return !_(haystack).some(function (suspiciousHay) {return suspiciousHay.cid === needle; });
    };

    collection.on('change', function (model, e) {
        if ('enabled' in model.changed) {
            if (model.get('enabled')) {
                app.getWidgetNode(model).show();
                app.drawWidget(model);
            } else {
                app.getWidgetNode(model).hide();
            }
        } else if ('color' in model.changed) {
            setColor(app.getWidgetNode(model), model);
        } else if (this.wasElementDeleted(model)) {
            // element was removed, no need to refresh it.
            return;
        } else if ('unset' in e && 'candidate' in model.changed) {
            // redraw fresh widget
            app.refreshWidget(model);
        } else if ('props' in model.changed && model.drawn) {
            // redraw existing widget due to config change
            app.refreshWidget(model);
        } else {
            app.drawWidget(model);
        }
    });

    collection.on('sort', function () {
        collection.sort({ silent: true });
        // loop over collection for resorting DOM tree
        collection.each(function (model) {
            // just re-append all in proper order
            appBaton.$.widgets.append(app.getWidgetNode(model));
        });
    });

    app.getWidgetCollection = function () {
        return collection;
    };

    app.updateTitle = function () {
        userAPI.getGreeting(ox.user_id).done(function (name) {
            appBaton.$.greeting.text(getGreetingPhrase(name));
        });
    };

    function openSidePopup(popup, e, target) {
        // get widget node
        var node = target.closest('.widget'),
            // get widget cid
            cid = node.attr('data-widget-cid'),
            // get model
            model = collection.get(cid), baton;
        if (model) {
            baton = model.get('baton');
            baton.item = target.data('item');
            // defer to get visual feedback first (e.g. script errors)
            _.defer(function () {
                ext.point('io.ox/portal/widget/' + model.get('type')).invoke('draw', popup.empty(), model.get('baton'));
            });
        }
    }

    app.drawScaffold = function (model) {
        var baton = ext.Baton({ model: model, app: app }),
            node = $('<li>');

        if (_.device('small')) {
            node.css('minHeight', 300);
        }
        model.node = node;
        ext.point('io.ox/portal/widget-scaffold').invoke('draw', node, baton);

        if (model.get('enabled') === false) {
            node.hide();
        } else {
            if (!widgets.visible(model.get('type'))) {
                // hide due to missing capabilites
                node.hide();
                return;
            }
        }

        appBaton.$.widgets.append(node);
    };

    app.getWidgetNode = function (model) {
        return appBaton.$.widgets.find('[data-widget-cid="' + model.cid + '"]');
    };

    function setup(e) {
        var baton = e.data.baton;
        ext.point(baton.point).invoke('performSetUp');
    }

    app.drawDefaultSetup = function (baton) {
        baton.model.node
            .addClass('requires-setup')
            .append(
                $('<div class="content">').text(gt('Click here to add your account'))
                .on('click', { baton: baton }, setup)
            );
    };

    function ensureDeferreds(ret) {
        return ret && ret.promise ? ret : $.when();
    }

    function reduceBool(memo, bool) {
        return memo && bool;
    }

    function runAction(e) {
        ext.point(e.data.baton.point).invoke('action', $(this).closest('.widget'), e.data.baton);
    }

    function loadAndPreview(point, node, baton) {
        var defs = point.invoke('load', node, baton).map(ensureDeferreds).value(),
            decoration = node.find('.decoration');
        return $.when.apply($, defs).done(function () {
                node.find('.content').remove();
                point.invoke('preview', node, baton);
                node.removeClass('error-occurred');
                decoration.removeClass('pending error-occurred');
            })
            .fail(function (e) {
                // special return value?
                if (e === 'remove') {
                    widgets.remove(baton.model);
                    node.remove();
                    return;
                }
                // show error message
                node.find('.content').remove();
                node.append(
                    $('<div class="content error">').append(
                        $('<div>').text(gt('An error occurred.')),
                        $('<div class="italic">').text(_.isString(e.error) ? e.error : ''),
                        $('<br>'),
                        $('<a class="solution">').text(gt('Click to try again.')).on('click', function () {
                            node.find('.decoration').addClass('pending');
                            loadAndPreview(point, node, baton);
                        })
                    )
                );
                point.invoke('error', node, e, baton);
                decoration.removeClass('pending');
            });
    }

    app.drawWidget = function (model, index) {
        var node = model.node,
            load = _.device('small') ? (node.offset().top < scrollPos) : true;

        if (!model.drawn && load) {

            model.drawn = true;
            index = index || 0;

            if (model.get('enabled') === true && !widgets.visible(model.get('type'))) {
                // hide due to missing capabilites
                node.hide();
                return;
            }

            // set/update title
            var baton = ext.Baton({ model: model, point: 'io.ox/portal/widget/' + model.get('type') }),
                point = ext.point(baton.point),
                title = node.find('h2 .title').text(_.noI18n(widgets.getTitle(model.toJSON(), point.prop('title')))),
                requiresSetUp = point.invoke('requiresSetUp').reduce(reduceBool, true).value();
            // remember
            model.set('baton', baton, { validate: true, silent: true });

            // setup?
            if (requiresSetUp) {
                node.find('.decoration').removeClass('pending');
                app.drawDefaultSetup(baton);
            } else {
                // add link?
                if (point.prop('action') !== undefined) {
                    title.addClass('action-link').css('cursor', 'pointer').on('click', { baton: baton }, runAction);
                }
                // simple delay approach
                _.delay(function () {
                    // initialize first
                    point.invoke('initialize', node, baton);
                    // load & preview
                    node.busy();
                    loadAndPreview(point, node, baton).done(function () {
                        node.removeAttr('style');
                    }).always(function () {
                        node.idle();
                    });
                }, (index / 2 >> 0) * 100);
            }
        }
    };

    app.refreshWidget = function (model, index) {

        if (model.drawn) {

            index = index || 0;

            var type = model.get('type'),
                node = model.node,
                delay = (index / 2 >> 0) * 1000,
                baton = model.get('baton'),
                point = ext.point(baton.point);

            _.defer(function () {
                _.delay(function () {
                    node.find('.decoration').addClass('pending');
                    _.delay(function () {
                        loadAndPreview(point, node, baton);
                        node = baton = point = null;
                    }, 300); // CSS Transition delay 0.3s
                }, delay);
            });
        }
    };

    // can be called every 30 seconds
    app.refresh = _.throttle(function () {
        widgets.getEnabled().each(app.refreshWidget);
    }, 30000);

    ox.on('refresh^', function () {
        app.refresh();
    });

    // launcher
    app.setLauncher(function () {

        // get window
        app.setWindow(win = ox.ui.createWindow({
            name: 'io.ox/portal',
            chromeless: true,
            simple: _.device('small')
        }));

        win.nodes.main.addClass('io-ox-portal f6-target').attr('tabindex', '1');

        ext.point('io.ox/portal/sections').invoke('draw', win.nodes.main, appBaton);

        app.updateTitle();
        _.tick(1, 'hour', app.updateTitle);

        win.show(function () {
            // draw scaffolds now for responsiveness
            collection.each(app.drawScaffold);

            widgets.loadUsedPlugins().done(function (cleanCollection) {
                cleanCollection.each(app.drawWidget);
            });

            // add side popup
            sidepopup.delegate(appBaton.$.widgets, '.item, .content.pointer, .action.pointer', openSidePopup);

            // react on 'remove'
            win.nodes.main.on('click', '.disable-widget', function (e) {
                e.preventDefault();
                var id = $(this).closest('.widget').attr('data-widget-id'),
                    model = widgets.getModel(id);
                if (model) {
                    // disable widget
                    model.set('enabled', false, { validate: true });
                }
            });

            // add -webkit-overflow-scroll only for iOS to enable momentum scroll
            // (will cause errors on android chrome)
            // TODO: avoid device specific inline css fixes
            if (_.browser.iOS) {
                win.nodes.main.css('-webkit-overflow-scrolling', 'touch');
            }

            // make sortable, but not for Touch devices
            if (!Modernizr.touch) {
                require(['apps/io.ox/core/tk/jquery-ui.min.js']).done(function () {
                    appBaton.$.widgets.sortable({
                        containment: win.nodes.main,
                        scroll: true,
                        delay: 150,
                        update: function (e, ui) {
                            widgets.save(appBaton.$.widgets);
                        }
                    });
                });
            }
        });

        var lazyLayout = _.debounce(function (e) {
            scrollPos = $(this).scrollTop() + this.innerHeight;
            widgets.loadUsedPlugins().done(function (cleanCollection) {
                cleanCollection.each(app.drawWidget);
            });
        }, 300);

        $(window).on('scrollstop resize', lazyLayout);
    });

    return {
        getApp: app.getInstance
    };
});
