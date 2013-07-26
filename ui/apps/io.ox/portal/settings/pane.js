/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2012
 * Mail: info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/portal/settings/pane',
      ['io.ox/core/extensions',
       'io.ox/core/manifests',
       'io.ox/core/upsell',
       'io.ox/core/tk/dialogs',
       'io.ox/portal/widgets',
       'settings!io.ox/portal',
       'gettext!io.ox/portal',
       'apps/io.ox/core/tk/jquery-ui.min.js',
       'less!io.ox/portal/style.less'], function (ext, manifests, upsell, dialogs, widgets, settings, gt) {

    'use strict';

    var POINT = 'io.ox/portal/settings/detail', pane;

    var availablePlugins = widgets.getAvailablePlugins(),
        collection = widgets.getCollection();

    ext.point(POINT).extend({
        draw: function () {
            var self = this;
            pane = $('<div class="io-ox-portal-settings">').busy();
            self.append(pane);
            widgets.loadAllPlugins().done(function () {
                ext.point(POINT + '/pane').invoke('draw', pane);
                pane.idle();
            });
        }
    });

    ext.point(POINT + '/pane').extend({
        index: 100,
        id: "header",
        draw: function () {
            this.addClass('io-ox-portal-settings').append(
                $('<h1 class="no-margin">').text(gt('Portal settings'))
            );
        }
    });

    function addWidget(e) {

        e.preventDefault();

        var type = $(this).attr('data-type'),
            requires = manifests.manager.getRequirements('plugins/portal/' + type + '/register');

        // upsell check
        if (!upsell.any(requires)) {
            // trigger global upsell event
            upsell.trigger({
                type: 'portal-widget',
                id: type,
                missing: upsell.missing(requires)
            });
        } else {
            // add widget
            widgets.add(type);
            repopulateAddButton();
        }
    }

    function drawAddButton() {
        this.append(
            $('<div class="controls">').append(
                $('<div class="btn-group pull-right">').append(
                    $('<a class="btn btn-primary dropdown-toggle" data-toggle="dropdown" href="#" aria-haspopup="true" tabindex="1">').append(
                        $.txt(gt('Add widget')), $.txt(' '),
                        $('<span class="caret">')
                    ),
                    $('<ul class="dropdown-menu io-ox-portal-settings-dropdown" role="menu">').on('click', 'a:not(.io-ox-action-link)', addWidget)
                )
            )
        );
        repopulateAddButton();
    }

    function repopulateAddButton() {
        $('.io-ox-portal-settings-dropdown').children('[role=presentation]').remove().end().append(
            _(widgets.getAllTypes()).map(function (options) {

                var isUnique = options.unique && widgets.containsType(options.type),
                    isVisible = upsell.visible(options.requires);

                if (isUnique || !isVisible) {
                    return $();
                } else {
                    return $('<li role="presentation">')
                    // add disabld class if requires upsell
                    .addClass(!upsell.has(options.requires) ? 'requires-upsell' : undefined)
                    .append(
                        $('<a>', { href: '#', 'data-type': options.type, role: 'menuitem', tabindex: 1 }).text(options.title)
                    );
                }
            })
        );
    }

    function appendIconText(target, text, type, activeColor) {
        if (type === 'color') {
            if (_.device('small')) {
                return $(target).addClass('widget-color-' + activeColor).append($('<i>').addClass('icon-tint').css('font-size', '20px'));
            } else {
                return target.text(text);
            }
        } else {
            if (_.device('small')) {
                var iconClass = (type === 'edit' ? 'icon-pencil' : 'icon-off');
                return $(target).append($('<i>').addClass(iconClass).css('font-size', '20px'));
            } else {
                return target.text(text);
            }
        }
    }

    ext.point(POINT + '/pane').extend({
        index: 200,
        id: "add",
        draw: drawAddButton
    });

    var drawChangeColor = (function () {

        var colorNames = {
            black:      gt('Black'),
            gray:       gt('Gray'),
            red:        gt('Red'),
            orange:     gt('Orange'),
            lightgreen: gt('Light green'),
            green:      gt('Green'),
            lightblue:  gt('Light blue'),
            blue:       gt('Blue'),
            purple:     gt('Purple'),
            pink:       gt('Pink')
        };

        return function (activeColor) {
            return $('<div class="action dropdown colors">').append(
                    appendIconText($('<a href="#" class="dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" tabindex="1">'), gt('Color'), 'color', activeColor),
                $('<ul class="dropdown-menu" role="menu">').append(
                    _(colorNames).map(function (name, color) {
                        return $('<li>').append(
                            $('<a>', { href: '#', 'data-action': 'change-color', 'data-color': color, 'tabindex': 1, role: 'menuitem' }).append(
                                $('<span class="color-example">').addClass('color-' + color),
                                $.txt(name)
                            )
                            .addClass(color === activeColor ? 'active-color' : undefined)
                        );
                    })
                )
            );
        };
    }());

    ext.point(POINT + '/view').extend({
        id: 'state',
        index: 100,
        draw: function (baton) {
            var data = baton.model.toJSON();
            this[data.enabled ? 'removeClass' : 'addClass']('disabled');
        }
    });

    ext.point(POINT + '/view').extend({
        id: 'drag-handle',
        index: 200,
        draw: function (baton) {
            this
            .addClass('draggable')
            .attr('title', gt('Drag to reorder widget'))
            .append(
                $('<div class="drag-handle"><i class="icon-reorder"/></div>')
            );
        }
    });

    ext.point(POINT + '/view').extend({
        id: 'title',
        index: 300,
        draw: function (baton) {
            var data = baton.model.toJSON();
            this.append(
                // widget title
                $('<div>')
                .addClass('widget-title pull-left widget-color-' + (data.color || 'black') + ' widget-' + data.type)
                .text(widgets.getTitle(data, baton.view.options.title))
            );
        }
    });

    ext.point(POINT + '/view').extend({
        id: 'controls',
        index: 400,
        draw: function (baton) {

            var data = baton.model.toJSON();

            if (data.protectedWidget) {
                // early exit if protected Widget
                this.append("&nbsp;");
                return;
            }

            var $controls = $('<div class="widget-controls">');

            if (data.enabled) {
                // editable?
                if (baton.view.options.editable) {
                    $controls.append(
                        appendIconText($('<a href="#" class="action" data-action="edit" tabindex="1">'), gt('Edit'), 'edit')
                    );
                }
                var $node = drawChangeColor(data.color);
                // Delegate fix for mobile dropdowns.
                // On mobile we need to bind the action directly to the hrefs
                // as the delegate is bound to parent element which is not longer
                // valid
                if (_.device('smartphone')) {
                    $node.find("[data-action='change-color']").on('click', function (e) {
                        baton.view.onChangeColor(e);
                    });
                }
                $controls.append(
                    $node,
                    appendIconText($('<a href="#" class="action" data-action="toggle" tabindex="1">'), gt('Disable'), 'disable')
                );
            } else {
                $controls.append(
                    appendIconText($('<a href="#" class="action" data-action="toggle" tabindex="1">'), gt('Enable'), 'enable')
                );
            }
            $controls.append(
                // close (has float: right)
                $('<a href="#" class="close" data-action="remove" tabindex="1"><i class="icon-trash"/></a>')
            );
            this.append($controls);
        }
    });

    var WidgetSettingsView = Backbone.View.extend({

        tagName: 'li',

        className: "widget-settings-view",

        events: {
            'click [data-action="edit"]': 'onEdit',
            'click [data-action="change-color"]': 'onChangeColor',
            'click [data-action="toggle"]': 'onToggle',
            'click [data-action="remove"]': 'onRemove'
        },

        initialize: function () {
            this.$el.attr('data-widget-id', this.model.get('id'));
            // get explicit state
            var enabled = this.model.get('enabled');
            this.model.set('enabled', !!(enabled === undefined || enabled === true), {validate: true});
            // get default color
            var color = this.model.get('color');
            this.model.set('color', color === undefined || color === 'default' ? 'black' : color, {validate: true});
            // get widget options
            this.options = ext.point('io.ox/portal/widget/' + this.model.get('type') + '/settings').options();
        },

        render: function () {
            var baton = ext.Baton({ model: this.model, view: this });
            ext.point(POINT + '/view').invoke('draw', this.$el.empty(), baton);
            return this;
        },

        edit: function () {
            if (_.isFunction(this.options.edit)) {
                this.options.edit(this.model, this);
            }
        },

        onEdit: function (e) {
            e.preventDefault();
            this.edit();
        },

        onChangeColor: function (e) {
            e.preventDefault();
            var node = $(e.target),
                color = node.attr('data-color') ? node.attr('data-color') : node.parent().attr('data-color');
            this.model.set('color', color);
            this.render();
        },

        onToggle: function (e) {

            e.preventDefault();

            var enabled = this.model.get('enabled'),
                type = this.model.get('type'),
                requires = manifests.manager.getRequirements('plugins/portal/' + type + '/register');

            // upsell check
            if (!enabled && !upsell.any(requires)) {
                // trigger global upsell event
                upsell.trigger({
                    type: 'portal-widget',
                    id: type,
                    missing: upsell.missing(requires)
                });
            } else {
                // toggle widget
                this.model.set('enabled', !enabled, {validate: true});
                this.render();
            }
        },

        removeWidget: function () {
            this.model.collection.remove(this.model);
            this.remove();
        },

        onRemove: function (e) {
            e.preventDefault();
            var self = this, dialog;
            // do we have custom data that might be lost?
            if (!_.isEmpty(this.model.get('props'))) {
                var dialog = new dialogs.ModalDialog()
                .header($("<h4>").text(gt('Delete widget')))
                .append($('<span>').text(gt('Do you really want to delete this widget?')))
                .addPrimaryButton('delete',
                    //#. Really delete portal widget - in contrast to "just disable"
                    gt('Delete')
                )
                .addButton('cancel', gt('Cancel'));
                if (this.model.get('enabled')) {
                    dialog.addAlternativeButton('disable',
                        //#. Just disable portal widget - in contrast to delete
                        gt('Just disable widget')
                    );
                }
                dialog.show().done(function (action) {
                    if (action === 'delete') {
                        self.removeWidget();
                    } else if (action === 'disable') {
                        self.onToggle(e);
                    }
                });
            } else {
                this.removeWidget();
            }
            repopulateAddButton();
        }
    });

    var views = {};

    function createView(model) {
        var id = model.get('id');
        return (views[id] = new WidgetSettingsView({ model: model }));
    }

    ext.point(POINT + '/pane').extend({
        index: 300,
        id: "list",
        draw: function () {

            var list = $('<ol class="widget-list">');

            collection.each(function (model) {
                list.append(createView(model).render().el);
            });

            this.append(list);

            // make sortable
            list.sortable({
                axis: 'y',
                containment: this,
                delay: 150,
                handle: '.drag-handle',
                scroll: true,
                stop: function (e, ui) {
                    widgets.save(list);
                }
            });

            collection.on('change', function () {
                // re-render all views
                _(views).each(function (view) {
                    view.render();
                });
            });

            collection.on('add', function (model) {
                model.set({ candidate: true }, { silent: true, validate: true });
                var view = createView(model).render();
                list.prepend(view.el);
                view.edit();
            });

            collection.on('sort', function () {
                list.empty();
                this.each(function (model) {
                    list.append(createView(model).render().el);
                });
            });
        }
    });

    return {};
});
