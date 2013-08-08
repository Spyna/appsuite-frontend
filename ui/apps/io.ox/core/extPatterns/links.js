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

define("io.ox/core/extPatterns/links",
    ["io.ox/core/extensions",
     "io.ox/core/collection",
     "io.ox/core/extPatterns/actions",
     "gettext!io.ox/core"], function (ext, Collection, actions, gt) {

    "use strict";

    // common extension classes

    var Action = actions.Action;

    var Link = function (options) {

        _.extend(this, options);

        var self = this,
            click = function (e) {
                e.preventDefault();
                var node = $(this),
                    baton = node.data("baton"),
                    ref = node.data("ref");
                baton.e = e;
                actions.invoke(ref, this, baton, e);
            };

        this.draw = this.draw || function (baton) {
            baton = ext.Baton.ensure(baton);
            this.append(
                $("<a>", { href: "#", tabindex: 1, "data-action": self.id })
                .addClass(self.cssClasses || 'io-ox-action-link')
                .attr({
                    'data-prio': self.prio || 'lo',
                    'data-ref': self.ref
                })
                .data({ ref: self.ref, baton: baton })
                .click(click)
                .text(String(self.label))
            );
        };
    };

    var XLink = function (id, options) {
        ext.point(id).extend(new Link(options));
    };

    function actionClick(e) {
        e.preventDefault();
        var extension = e.data.extension, baton = e.data.baton;
        baton.e = e;
        actions.invoke(extension.ref, extension, baton);
    }

    var ActionLink = function (id, extension) {
        extension = extension || {};
        extension = _.extend({
            ref: id + '/' + extension.id,
            draw: function (baton) {
                baton = ext.Baton.ensure(baton);
                this.append(
                    $('<li>').attr('role', 'menuitem').append(
                        $('<a href="#" tabindex="1">').attr('data-action', extension.ref).text(extension.label)
                        .on('click', { baton: baton, extension: extension }, actionClick)
                    )
                );
            }
        }, extension);
        ext.point(id).extend(extension);
    };

    var Button = function (options) {

        _.extend(this, options);

        var self = this,
            tag = options.tagtype ? options.tagtype : 'a',

            click = function (e) {
                e.preventDefault();
                var extension = e.data.extension;
                e.data.baton.e = e;
                actions.invoke(extension.ref, extension, e.data.baton);
            };

        this.draw = function (baton) {
            baton = ext.Baton.ensure(baton);
            var attr = { href: '#', 'class': 'btn', 'data-action': self.id, tabIndex: self.tabIndex };
            if (tag === 'button') attr.type = 'button';
            this.append(
                $('<' + tag + '>', attr)
                .addClass(self.cssClasses)
                .css(self.css || {})
                .on('click', { extension: self, baton: baton }, click)
                .append(_.isString(self.label) ? $.txt(self.label) : $())
                .append(_.isString(self.icon) ? $('<i>').addClass(self.icon) : $())
            );
        };
    };

    var getLinks = function (self, collection, baton, args) {
        return actions.applyCollection(self.ref, collection, baton, args);
    };

    var drawLinks = function (extension, collection, node, baton, args, bootstrapMode) {

        baton = ext.Baton.ensure(baton);
        var nav = $('<nav role="presentation">').appendTo(node);

        // customize
        if (extension.attributes) {
            nav.attr(extension.attributes);
        }
        if (extension.classes) {
            nav.addClass(extension.classes);
        }

        return getLinks(extension, collection, baton, args)
            .always(function (links) {
                // count resolved links
                var count = 0;
                // draw links
                _(links).each(function (link) {
                    if (_.isFunction(link.draw)) {
                        link.draw.call(bootstrapMode ? $('<li>').appendTo(nav) : nav, baton);
                        if (_.isFunction(link.customize)) {
                            link.customize.call(nav.find('a'), baton);
                        }
                        count++;
                    }
                });
                // empty?
                if (count === 0) {
                    nav.addClass('empty');
                }
            })
            .then(function () {
                return nav;
            });
    };

    var ToolbarLinks = function (options) {
        var self = _.extend(this, options);
        this.draw = function (baton) {
            // paint on current node
            var args = $.makeArray(arguments);
            baton = ext.Baton.ensure(baton);
            drawLinks(self, new Collection(baton.data), this, baton, args);
        };

    };

    var ToolbarButtons = function (options) {
        var self = _.extend(this, options);
        this.draw = function (baton) {
            // paint on current node
            var args = $.makeArray(arguments);
            baton = ext.Baton.ensure(baton);
            drawLinks(self, new Collection(baton.data), this, baton, args);
            // add classes to get button style
            this.children('a').addClass('btn btn-primary');
            this.children('.dropdown').children('a').addClass('btn btn-primary');
        };
    };

    var wrapAsListItem = function () {
        return $('<li>').append(this).get(0);
    };

    var InlineLinks = function (options) {

        var extension = _.extend(this, { classes: 'io-ox-inline-links' }, options);

        this.draw = function (baton) {

            baton = ext.Baton.ensure(baton);

            // create & add node first, since the rest is async
            var args = $.makeArray(arguments),
                multiple = _.isArray(baton.data) && baton.data.length > 1;

            drawLinks(extension, new Collection(baton.data), this, baton, args).done(function (nav) {

                // add toggle unless multi-selection
                var all = nav.children(),
                    lo = all.filter('[data-prio="lo"]'),
                    isSmall = _.device('small');

                if (!multiple && (isSmall || (all.length > 5 && lo.length > 1))) {
                    nav.append(
                        $('<span class="io-ox-action-link dropdown">').append(
                            $('<a href="#" data-toggle="dropdown" data-action="more" aria-haspopup="true" tabindex="1">')
                            .append(
                                isSmall ?
                                    [$.txt(gt('Actions')), $('<b class="caret">')] :
                                    [$.txt(gt('More')), $.txt(_.noI18n(' ...')), $('<b class="caret">')]
                            )
                            .on(Modernizr.touch ? 'touchstart' : 'click', function (e) {
                                // fix dropdown position on-the-fly
                                var left = $(this).parent().position().left;
                                $(this).next().attr('class', 'dropdown-menu' + (left < 100 ? '' : ' dropdown-right'));
                            }),
                            $('<ul class="dropdown-menu dropdown-right" role="menu">').append(
                                (isSmall ? all : lo).map(wrapAsListItem)
                            )
                        )
                    );
                }
                all = lo = null;
                if (options.customizeNode) {
                    options.customizeNode(nav);
                }
            });
        };
    };

    var z = 0;
    var drawDropDown = function (options, baton) {
        if (options.zIndex !== undefined) {
            z = options.zIndex;
        }
        var args = $.makeArray(arguments),
            $parent = $('<div>').addClass('dropdown')
                .css({ display: 'inline-block', zIndex: (z = z > 0 ? z - 1 : 11000) })
                .appendTo(this),
            label = options.label || baton.label || '###',
            $toggle = $('<a href="#" data-toggle="dropdown" aria-haspopup="true" tabindex="1">')
                .data('context', baton.data)
                .append(
                    _.isString(label) ? $.txt(label) : label,
                    $('<span>').text(_.noI18n(' ')),
                    $('<b>').addClass('caret')
                )
                .appendTo($parent);

        $toggle.addClass(options.classes);
        $parent.append($.txt(_.noI18n('\u00A0\u00A0 '))); // a bit more space

        // create & add node first, since the rest is async
        var node = $('<ul role="menu">').addClass('dropdown-menu').appendTo($parent);
        if (options.open === 'left') {
            node.addClass("pull-right").css({textAligh: 'left'});
        }
        drawLinks(options, new Collection(baton.data), node, baton, args, true);

        $toggle.dropdown();

        return $parent;
    };

    var DropdownLinks = function (options) {
        var o = _.extend(this, options);
        this.draw = function (baton) {
            baton = ext.Baton.ensure(baton);
            return drawDropDown.call(this, o, baton);
        };
    };

    var Dropdown = function (id, options) {
        var o = options || {};
        o.ref = id + '/' + o.id;
        ext.point(id).extend(
            _.extend({
                ref: o.ref,
                draw: function (baton) {
                    baton = ext.Baton.ensure(baton);
                    drawDropDown.call(this, o, baton);
                }
            }, o)
        );
    };

    var drawButtonGroup = function (options, baton) {
        var args = $.makeArray(arguments),
            $parent = $("<div>").addClass('btn-group')
                .addClass(options.classes)
                .attr('data-toggle', (options.radio ? 'buttons-radio' : ''))
                .appendTo(this);
        // create & add node first, since the rest is async
        var node = $parent;
        drawLinks(options, new Collection(baton.data), node, baton, args, false);
        return $parent;
    };

    var ButtonGroup = function (id, options) {
        var o = options || {};
        o.ref = id + '/' + o.id;
        ext.point(id).extend(
            _.extend({
                ref: o.ref,
                draw: function (baton) {
                    baton = ext.Baton.ensure(baton);
                    drawButtonGroup.call(this, o, baton);
                }
            }, o)
        );
    };

    var ActionGroup = (function () {

        function preventDefault(e) {
            e.preventDefault();
        }

        function draw(extension, baton) {
            var args = $.makeArray(arguments), a, ul, div, title = [];
            this.append(
                div = $('<div class="toolbar-button dropdown">').append(
                    a = $('<a href="#" data-toggle="dropdown" title="" tabindex="1">')
                        .attr('data-ref', extension.ref)
                        .addClass(extension.addClass)
                        .append(extension.icon()),
                    ul = $('<ul class="dropdown-menu dropdown-right-side" role="menu" aria-hidden="true">')
                )
            );
            // get links
            return getLinks(extension, new Collection(baton.data), baton, args).done(function (links) {
                if (links.length > 1) {
                    // call draw method to fill dropdown
                    _(links).chain()
                        .filter(function (x) {
                            return _.isFunction(x.draw);
                        })
                        .each(function (x) {
                            title.push(x.label);
                            x.draw.call(ul, baton);
                        });
                    // set title attribute
                    a.attr('title', extension.label || title.join(', '))
                     .attr('aria-label', extension.label || title.join(', '))
                     .attr('aria-haspopup', true);

                    div.attr('role', 'menu');
                    // add footer label?
                    if (extension.label) {
                        ul.append(
                            $('<li class="dropdown-footer">').attr('role', 'menuitem').text(extension.label)
                        );
                    }
                } else {
                    // disable dropdown
                    a.removeAttr('data-toggle');
                    ul.remove();
                    if (links.length === 1) {
                        // directly link actions
                        a.attr({
                            title: links[0].label || '',
                            'aria-label': links[0].label || '',
                            role: 'menuitem',
                            tabindex: 1
                        })
                        .on('click', { baton: baton, extension: links[0] }, actionClick);
                    } else {
                        a.addClass('disabled').on('click', preventDefault);
                    }
                }
            });
        }

        function icon() {
            return $('<i class="icon-magic">');
        }

        return function ActionGroup(id, extension) {
            extension = extension || {};
            extension = _.extend({
                ref: id + '/' + (extension.id || 'default'),
                icon: icon,
                draw: function (baton) {
                    baton = ext.Baton.ensure(baton);
                    draw.call(this, extension, baton);
                }
            }, extension);
            // register extension
            ext.point(id).extend(extension);
        };

    }());

    return {
        Action: Action,
        Link: Link,
        XLink: XLink, // TODO: consolidate Link/XLink
        Button: Button,
        ActionLink: ActionLink,
        ToolbarButtons: ToolbarButtons,
        ToolbarLinks: ToolbarLinks,
        InlineLinks: InlineLinks,
        DropdownLinks: DropdownLinks,
        Dropdown: Dropdown,
        ButtonGroup: ButtonGroup,
        ActionGroup: ActionGroup
    };
});

