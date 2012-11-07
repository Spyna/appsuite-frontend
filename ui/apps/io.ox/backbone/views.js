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
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 */
define('io.ox/backbone/views', ['io.ox/core/extensions', 'io.ox/core/event'], function (ext, Events) {
    "use strict";

    var views;

    function attributeDefinitions(observeDefinition) {

        if (_.isString(observeDefinition)) {
            return attributeDefinitions(observeDefinition.split(/\s+/));
        }

        return _(observeDefinition).map(function (attributeDefinition) {

            if (_.isObject(attributeDefinition)) {
                return attributeDefinition;
            }

            var canonicalName = "";
            var forceUpcase = true;
            for (var i = 0, length = attributeDefinition.length; i < length; i++) {
                var c = attributeDefinition.charAt(i);

                if (c === '-' || c === '_') {
                    forceUpcase = true;
                } else {
                    if (forceUpcase) {
                        c = c.toUpperCase();
                        forceUpcase = false;
                    }

                    canonicalName = canonicalName + c;
                }
            }

            return {
                canonicalName: canonicalName,
                attributeName: attributeDefinition
            };

        });

    }

    function createViewClass(options, extOptions) {
        extOptions = extOptions || {};
        var id = options.id;
        delete options.id;


        // A few overridable default implementations
        options.initialize = options.initialize || function () {
            var self = this;
            if (this.update) {
                self.observeModel('change', function () {
                    self.update();
                });
            }
            if (this.modelInvalid) {
                self.observeModel('invalid', function () {
                    self.modelInvalid();
                });
            }

            if (this.modelValid) {
                self.observeModel('invalid', function () {
                    self.modelValid();
                });
            }

            if (options.modelEvents) {
                _(options.modelEvents).each(function (methodNames, evt) {
                    _(methodNames.split(" ")).each(function (methodName) {
                        self.observeModel(evt, function () {
                            self[methodName].apply(self, $.makeArray(arguments));
                        });
                    });
                });
            }
            if (options.observe) {
                _(attributeDefinitions(options.observe)).each(function (definition) {
                    if (self['on' + definition.canonicalName + 'Change']) {
                        self.observeModel('change:' + definition.attributeName, function () {
                            self['on' + definition.canonicalName + 'Change'].call(self);
                        });
                    }
                    if (self['on' + definition.canonicalName + 'Invalid']) {
                        self.observeModel('invalid:' + definition.attributeName, function () {
                            self['on' + definition.canonicalName + 'Invalid'].call(self);
                        });
                    }

                    if (self['on' + definition.canonicalName + 'Valid']) {
                        self.observeModel('valid:' + definition.attributeName, function () {
                            self['on' + definition.canonicalName + 'Valid'].call(self);
                        });
                    }
                });
            }

            this.$el.attr({
                'data-extension-id': extOptions.id || id,
                'data-extension-point': options.ref || '',
                'data-composite-id': (this.model && this.model.getCompositeId) ? this.model.getCompositeId() : ''
            });

            this.baton = ext.Baton(this.options);

            if (options.init) {
                options.init.apply(this, $.makeArray(arguments));
            }

            if (options.customizeNode) {
                this.customizeNode();
            }

        };

        options.close = options.close || function () {
            this.$el.remove();
            this.$el.trigger('dispose'); // Can't hurt
        };

        options.observeModel = options.observeModel || function (evt, handler, context) {
            var self = this;
            this.model.on(evt, handler, context);
            this.$el.on('dispose', function () {
                self.model.off(evt, handler);
            });
        };

        var ViewClass = Backbone.View.extend(options);

        ViewClass.extId = id;

        return ViewClass;
    }

    function buildExtension(ViewClass, options, extOptions) {
        extOptions = extOptions || {};

        return _.extend({}, {
            id: ViewClass.extId,
            index: options.index,
            draw: function (baton) {
                var view = new ViewClass(baton);
                if (options.registerAs) {
                    baton[options.registerAs] = view;
                }
                view.render();
                this.append(view.$el);
            }
        }, extOptions);
    }

    function ViewExtensionPoint(name) {

        this.basicExtend = function (extension) {
            ext.point(name).extend(extension);
            return this;
        };

        this.extend = function (options, extOptions) {
            var ViewClass = createViewClass(_.extend({}, options, {ref: name}), extOptions);

            extOptions = extOptions || {};

            this.basicExtend(buildExtension(ViewClass, options, extOptions));

            return this;
        };

        this.createSubpoint = function (subpath, options, extOptions) {
            var point = views.point(name + "/" + subpath),
                ViewClass = point.createView(options);
            var id = options.id || name + "/" + subpath;

            if (options.id) {
                delete options.id;
            }
            extOptions = extOptions || {};
            this.basicExtend(_.extend({}, {
                id: id,
                index: options.index,
                draw: function (options) {
                    var view = new ViewClass(options);
                    view.render();
                    this.append(view.$el);
                }
            }, extOptions));

            return point;

        };

        this.createView = function (options) {
            options = options || {};

            var id = options.id || '';
            delete options.id;

            options.render = options.render || function () {
                this.point.invoke.apply(this.point, ['draw', this.$el].concat(this.extensionOptions ? this.extensionOptions() : [this.baton]));
                return this;
            };

            options.initialize = options.initialize || function () {
                Events.extend(this);
                this.baton = ext.Baton(_.extend({}, this.options, {parentView: this}));
                if (this.init) {
                    this.init.apply(this, $.makeArray(arguments));
                }
                var self = this;
                function redraw() {
                    self.$el.empty();
                    self.render();
                }
                this.point.on("extended", redraw);
                self.$el.on('dispose', function () {
                    self.point.off('extended', redraw);
                });
            };

            options.point = options.point || ext.point(name);

            return Backbone.View.extend(options);
        };


    }
    function AttributeView(options) {
        _.extend(this, {

            render: function () {
                var self = this;
                var first = true;

                _([this.attribute]).chain().flatten().each(function (attribute) {
                    var value = self.model.get(attribute);
                    if (self.transform && self.transform[attribute]) {
                        value = self.transform[attribute](value);
                    } else if (self.transform) {
                        value = self.transform(value);
                    }
                    if (!first) {
                        self.$el.append($.txt(", "));
                    }

                    if (self.model.isSet(attribute)) {
                        self.$el.append($.txt(_.noI18n(value)));
                    } else if (self.initialValue) {
                        self.$el.append($.txt(self.initialValue));
                    }

                    first = false;
                });

            },

            updateNode: function () {
                this.$el.empty();
                this.render();
            }

        });

        var self = this;
        this.modelEvents = {};

        _([options.attribute]).chain().flatten().each(function (attribute) {
            self.modelEvents['change:' + attribute] = 'updateNode';
        });

        _.extend(this, options);
    }

    views = {

        point: function (name) {
            return new ViewExtensionPoint(name);
        },
        AttributeView: AttributeView,
        ext: ext,
        createViewClass: createViewClass,
        buildExtension: buildExtension
    };

    return views;

});