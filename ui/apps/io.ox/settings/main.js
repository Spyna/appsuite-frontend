/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2012 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Mario Scheliga <mario.scheliga@open-xchange.com>
 */

define('io.ox/settings/main',
    ['io.ox/core/tk/vgrid',
     'io.ox/core/api/apps',
     'io.ox/core/extensions',
     'io.ox/core/tk/forms',
     'io.ox/core/tk/view',
     'io.ox/core/commons',
     'gettext!io.ox/core',
     'settings!io.ox/settings/configjump',
     'settings!io.ox/core',
     'io.ox/core/settings/errorlog/settings/pane',
     'io.ox/core/settings/downloads/pane',
     'less!io.ox/settings/style'
    ], function (VGrid, appsAPI, ext, forms, View, commons, gt, configJumpSettings, advancedModeSettings) {

    'use strict';

    var tmpl = {
        main: {
            build: function () {
                var title;
                this.addClass('application')
                    .append(
                        title = $('<div>')
                            .addClass('title')
                    );
                if (_.device('smartphone')) {
                    title.css('margin', '4px 0'); // must use inline styles because vgrid's height calculon-o-mat does not respect any css values bound via classes for its calculation..
                    title.prepend($('<i class="fa fa-chevron-right pull-right">'));
                }
                return { title: title };
            },
            set: function (data, fields) {
                var title = gt.pgettext('app', data.title);
                this.attr({
                    'aria-label': title
                });
                //clean template
                fields.title.empty();
                fields.title.append($.txt(
                        title === data.title ? gt(data.title) : title
                    )
                );
            }
        },
        label: {
            build: function () {
                this.addClass('settings-label');
            },
            set: function (data) {
                this.text(data.group || '');
            }
        }
        // might be good to introduce real groups!
        // requiresLabel: function (i, data, current) {
        //     if (!data) { return false; }
        //     return data.group !== current ? data.group : false;
        // }
    };

    // application object
    var app = ox.ui.createApp({ name: 'io.ox/settings' }),
        // app window
        win,
        // grid
        grid,
        // nodes
        left,
        right,
        expertmode = advancedModeSettings.get('settings/advancedMode', false),
        currentSelection = null,
        previousSelection = null;

    function updateExpertMode() {
        var nodes = $('.expertmode');
        if (expertmode) {
            nodes.show();
        } else {
            nodes.hide();
        }
    }

    app.setLauncher(function (options) {

        app.setWindow(win = ox.ui.createWindow({
            name: 'io.ox/settings',
            title: 'Settings',
            chromeless: true
        }));

        var changeStatus = false,

            saveSettings = function (triggeredBy) {

            switch (triggeredBy) {
            case 'changeMain':
                if (currentSelection !== null && currentSelection.lazySaveSettings !== true) {
                    var settingsID = currentSelection.id + '/settings';
                    ext.point(settingsID + '/detail').invoke('save');
                } else if (currentSelection !== null && currentSelection.lazySaveSettings === true) {
                    changeStatus = true;
                }
                break;
            case 'changeGrid':
                if (previousSelection !== null && previousSelection.lazySaveSettings === true && changeStatus === true) {
                    var settingsID = previousSelection.id + '/settings';
                    ext.point(settingsID + '/detail').invoke('save');
                    changeStatus = false;
                }
                break;
            case 'changeGridMobile':
                if (currentSelection.lazySaveSettings === true && changeStatus === true) {
                    var settingsID = currentSelection.id + '/settings';
                    ext.point(settingsID + '/detail').invoke('save');
                    changeStatus = false;
                }
                break;
            case 'hide':
            case 'logout':
                if (currentSelection !== null && currentSelection.lazySaveSettings === true && changeStatus === true) {
                    var settingsID = currentSelection.id + '/settings',
                        defs = ext.point(settingsID + '/detail').invoke('save').compact().value();
                    changeStatus = false;
                    return $.when.apply($, defs);
                }
                break;
            default:
                var settingsID = currentSelection.id + '/settings';
                ext.point(settingsID + '/detail').invoke('save');
            }

            return $.when();
        };

        win.addClass('io-ox-settings-main');

        var vsplit = commons.vsplit(win.nodes.main, app);
        left = vsplit.left.addClass('leftside border-right');
        right = vsplit.right.addClass('default-content-padding settings-detail-pane f6-target').attr('tabindex', 1).scrollable();

        grid = new VGrid(left, { multiple: false, draggable: false, showToggle: false, showCheckbox: false,  toolbarPlacement: 'bottom', selectSmart: _.device('!smartphone') });

        // disable the Deserializer
        grid.setDeserialize(function (cid) {
            return cid;
        });

        grid.addTemplate(tmpl.main);
        grid.addLabelTemplate(tmpl.label);

        //grid.requiresLabel = tmpl.requiresLabel;

        // Create extensions for the apps
        var appsInitialized = appsAPI.getInstalled().done(function (installed) {
            var apps = _.filter(installed, function (item) {
                return item.settings;
            });
            var index = 200;

            _(apps).each(function (app) {
                ext.point('io.ox/settings/pane').extend(_.extend({}, {
                    title: app.description,
                    ref: app.id,
                    index: index
                }, app));
                index += 100;

            });
        });

        // Create extensions for the config jump pages
        _(configJumpSettings.get()).chain().keys().each(function (id) {
            var declaration = configJumpSettings.get(id);
            if (declaration.requires) {
                if (!require('io.ox/core/capabilities').has(declaration.requires)) {
                    return;
                }
            }
            ext.point('io.ox/settings/pane').extend(_.extend({
                id: id,
                title: gt(declaration.title || ''),
                ref: 'io.ox/configjump/' + id,
                loadSettingPane: false
            }, declaration));

            ext.point('io.ox/configjump/' + id + '/settings/detail').extend({
                id: 'iframe',
                index: 100,
                draw: function () {
                    var $node = this;
                    $node.css({height: '100%'});
                    var fillUpURL = $.Deferred();

                    if (declaration.url.indexOf('[token]') > 0) {
                        // Grab token
                        $node.busy();
                        require(['io.ox/core/http'], function (http) {
                            http.GET({
                                module: 'token',
                                params: {
                                    action: 'acquireToken'
                                }
                            }).done(function (resp) {
                                fillUpURL.resolve(declaration.url.replace('[token]', resp.token));
                            }).fail(require('io.ox/core/notifications').yell);
                        });
                    } else {
                        fillUpURL.resolve(declaration.url);
                    }

                    fillUpURL.done(function (url) {
                        $node.idle();
                        $node.append($('<iframe>', { src: url, frameborder: 0 }).css({
                            width: '100%',
                            minHeight: '90%'
                        }));
                    });
                }
            });
        });

        ext.point('io.ox/settings/pane').extend({
            title: gt('Basic settings'),
            index: 50,
            id: 'io.ox/core'
        });

        ext.point('io.ox/settings/pane').extend({
            title: gt('Mail and Social Accounts'),
            index: 600,
            id: 'io.ox/settings/accounts'
        });

        var getAllSettingsPanes = function () {
            var def = $.Deferred();
            appsInitialized.done(function () {

                def.resolve(_.filter(ext.point('io.ox/settings/pane').list(), function (point) {
                    if (expertmode) {
                        return true;
                    } else if (!point.advancedMode) {
                        return true;
                    }
                }));
            });

            appsInitialized.fail(def.reject);

            return def;
        };

        grid.setAllRequest(getAllSettingsPanes);

        var showSettingsEnabled = true;
        var showSettings = function (baton) {

            if (!showSettingsEnabled) return;

            baton = ext.Baton.ensure(baton);
            baton.grid = grid;

            var data = baton.data,
                settingsPath = data.pane || ((data.ref || data.id) + '/settings/pane'),
                extPointPart = data.pane || ((data.ref || data.id) + '/settings/detail');

            right.empty().busy();
            if (data.loadSettingPane || _.isUndefined(data.loadSettingPane)) {
                return require([settingsPath], function () {
                    right.empty().idle(); // again, since require makes this async
                    ext.point(extPointPart).invoke('draw', right, baton);
                    updateExpertMode();
                });
            } else {
                return require(['io.ox/contacts/settings/pane', 'io.ox/mail/vacationnotice/settings/filter', 'io.ox/mail/autoforward/settings/filter'], function () {
                    right.empty().idle(); // again, since require makes this async
                    ext.point(extPointPart).invoke('draw', right, baton);
                    updateExpertMode();
                });
            }
        };

        // trigger auto save
        grid.selection.on('change', function (e, selection) {
            if (selection.length === 1) {
                previousSelection = currentSelection;
                currentSelection = selection[0];
            }
        });

        grid.selection.on('change', function () {
            saveSettings('changeGrid');
        });

        if (_.device('small')) {
            grid.selection.on('changeMobile', function () {
                saveSettings('changeGridMobile');
            });
        }

        // trigger auto save on any change

        win.nodes.main.on('change', function () {
            saveSettings('changeMain');
        });
        win.on('hide', function () {
            saveSettings('hide');
        });

        // listen for logout event
        ext.point('io.ox/core/logout').extend({
            id: 'saveSettings',
            logout: function () {
                return saveSettings('logout');
            }
        });

        commons.wireGridAndSelectionChange(grid, 'io.ox/settings', showSettings, right);
        commons.wireGridAndWindow(grid, win);

        app.setSettingsPane = function (options) {
            if (options && options.id) {
                return getAllSettingsPanes().done(function (apps) {
                    var obj = _(apps).find(function (obj) { return obj.id === options.id; }),
                        baton = new ext.Baton({ data: obj, options: options || {} });
                    if (obj) {
                        showSettingsEnabled = false;
                        grid.selection.set([obj]);
                        showSettingsEnabled = true;
                        showSettings(baton);
                    }
                });
            } else {
                return $.when();
            }
        };


        ext.point('settings/vgrid/toolbar').extend({
            id: 'info',
            index: 200,
            draw: function () {

                var buildCheckbox = function () {
                    var checkbox = $('<input type="checkbox">')
                    .on('change', function () {

                        expertmode = checkbox.prop('checked');
                        advancedModeSettings.set('settings/advancedMode', expertmode).save();
                        grid.setAllRequest(getAllSettingsPanes);
                        grid.paint();
                        updateExpertMode();

                    }).addClass('input-xlarge');
                    checkbox.prop('checked', expertmode);
                    return checkbox;
                };

                this.append(
                    $('<div>').addClass('advanced-mode').append(
                        $('<div>').addClass('checkbox').append(
                            $('<label>').addClass('control-label').text(gt('Advanced Mode')).prepend(
                                buildCheckbox()
                            )
                        )
                    )
                );
            }
        });

        ext.point('settings/vgrid/toolbar').invoke('draw', grid.getToolbar());

        // go!
        win.show(function () {
            grid.paint().done(function () {
                app.setSettingsPane(options);
            });
        });
    });

    return {
        getApp: app.getInstance
    };
});
