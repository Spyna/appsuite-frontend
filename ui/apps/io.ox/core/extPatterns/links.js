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
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/extPatterns/links',
    ['io.ox/core/extensions',
     'io.ox/core/collection',
     'io.ox/core/extPatterns/actions',
     'gettext!io.ox/core'
    ], function (ext, Collection, actions, gt) {

    'use strict';

    // common extension classes

    var Action = actions.Action;

    var Link = function (options) {

        _.extend(this, options);

        var self = this,
            click = function (e) {
                e.preventDefault();
                var node = $(this),
                    baton = node.data('baton'),
                    ref = node.data('ref');
                baton.e = e;
                node.tooltip('hide');
                actions.invoke(ref, this, baton, e);
            },
            drawDefault = function () {
                var prio = _.device('small') ? self.mobile : self.prio;
                var a = $('<a>', { href: '#', tabindex: 1, 'data-action': self.id })
                    .addClass(self.cssClasses || 'io-ox-action-link')
                    .attr({
                        'role': 'menuitem',
                        'title': self.title || self.label || '',
                        'data-section': self.section || 'default',
                        'data-prio': _.device('small') ? (self.mobile || 'none') : (self.prio || 'lo'),
                        'data-ref': self.ref
                    });
                // icons are prefered over labels
                a.append(
                    (self.icon && prio === 'hi' && $('<i>').addClass(self.icon)) ||
                    (self.label && $.txt(self.label)) ||
                    $()
                );
                // has icon?
                if (self.icon) a.addClass('no-underline');
                // use tooltip?
                if ((self.icon && self.label) || self.title) {
                    a.attr({
                        'data-toggle': 'tooltip',
                        'data-placement': 'bottom',
                        'data-animation': 'false',
                        'data-container': 'body'
                    })
                    .tooltip()
                    .on('dispose', function () {
                        $(this).tooltip('hide');
                    });
                }
                return a;
            };

        this.draw = this.draw || function (baton) {

            baton = ext.Baton.ensure(baton);
            var link = drawDefault();

            this.append(
                link.data({ ref: self.ref, baton: baton }).click(click)
            );

            // call customize? (call after append; must be self - not this)
            if (self.customize) self.customize.call(link, baton);
        };

        if (this.drawDisabled === true) {
            this.drawDisabled = function (baton) {
                var link = drawDefault();
                this.append(
                    link
                    .tooltip('destroy')
                    .addClass('disabled')
                    .attr({
                        'aria-disabled': true
                        // may be, tabindex should be set to 0, to 'hide'
                        // the link during keyboard navigation. Anyway,
                        // IMHO a menu should be as static as possible to support
                        // users to 'learn' the navigation
                    })
                    .removeAttr('href')
                );
                // call customize? (call after append; must be self - not this)
                if (self.customize) self.customize.call(link, baton);
            };
        }
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
                    $('<li>').append(
                        $('<a href="#" tabindex="1">').attr({
                            'data-action': extension.ref,
                            'role': 'menuitem'
                        }).text(extension.label)
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
                if (node.hasClass('io-ox-busy')) {
                    return false;
                }
                e.preventDefault();
                var extension = e.data.extension;
                e.data.baton.e = e;
                actions.invoke(extension.ref, extension, e.data.baton);
            },
            node;

        this.draw = function (baton) {
            baton = ext.Baton.ensure(baton);
            var attr = { href: '#', 'class': 'btn btn-default', 'data-action': self.id, tabIndex: self.tabIndex };
            if (tag === 'button') attr.type = 'button';
            this.append(
                node = $('<' + tag + '>', attr)
                .addClass(self.cssClasses)
                .css(self.css || {})
                .on('click', { extension: self, baton: baton }, click)
                .append(_.isString(self.label) ? $.txt(self.label) : $())
                .append(_.isString(self.icon) ? $('<i>').addClass(self.icon) : $())
            );
        };

        this.busy = function () {
            node.busy();
        };

        this.idle = function () {
            node.idle();
        };
    };

    var getLinks = function (self, collection, baton, args) {
        return actions.applyCollection(self.ref, collection, baton, args);
    };

    var drawLinks = function (extension, collection, node, baton, args, bootstrapMode) {

        baton = ext.Baton.ensure(baton);

        var nav = baton.$el ||
            $('<ul class="list-unstyled" role="menubar">')
            .addClass(extension.classes || '')
            .attr(extension.attributes || {})
            .appendTo(node);

        return getLinks(extension, collection, baton, args)
            .always(function (items) {
                // count resolved items
                var count = 0;
                // draw items
                _(items).each(function (item) {
                    var link = item.link;
                    if (item.state === false) {
                        if (_.isFunction(link.drawDisabled) && !_.device('small')) {
                            link.drawDisabled.call(bootstrapMode ? $('<li>').appendTo(nav) : nav, baton);
                            count++;
                        }
                    }
                    else if (_.isFunction(link.draw)) {
                        link.draw.call(bootstrapMode ? $('<li>').appendTo(nav) : nav, baton);
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

    var drawInlineButtonGroup = function (extension, collection, node, baton, args, bootstrapMode) {
        baton = ext.Baton.ensure(baton);
        var group = $('<div class="btn-group">'),
            nav = $('<nav role="presentation">').append(group).appendTo(node);

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
                _(links).each(function (item) {
                    var link = item.link;
                    if (item.state === false) {
                        if (_.isFunction(link.drawDisabled)) {
                            link.drawDisabled.call(bootstrapMode ? $('<li>').appendTo(group) : group, baton);
                            count++;
                        }
                    }
                    else if (_.isFunction(link.draw)) {
                        link.draw.call(bootstrapMode ? $('<li>').appendTo(group) : group, baton);
                        count++;
                    }
                });
                // empty?
                if (count === 0) {
                    group.addClass('empty');
                }
            })
            .then(function () {
                return group;
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

    /**
     * @param {object}  options
     * @param {boolean} options.forcelimit force usage of 'more...'
     * @param {string} add options.title for better accessibility (add context to 'Inline menu')
     */
    var InlineLinks = function (options) {

        var extension = _.extend(this, {
            classes: 'io-ox-inline-links',
            attributes: {
                //#. %1$s inline menu title for better accessibility
                'aria-label': gt('Inline menu %1$s', options.title || '')
            }
        }, options);

        this.draw = function (baton) {

            baton = ext.Baton.ensure(baton);

            // create & add node first, since the rest is async
            var args = $.makeArray(arguments),
                multiple = _.isArray(baton.data) && baton.data.length > 1;

            drawLinks(extension, new Collection(baton.data), this, baton, args, true).done(function (nav) {

                // add toggle unless multi-selection
                var all = nav.children(),
                    lo = all.children().filter('[data-prio="lo"]').parent(),
                    isSmall = _.device('small');

                // remove unimportant links on smartphone (prio='none')
                if (isSmall) all.children().filter('[data-prio="none"]').parent().remove();

                if ((!multiple || options.forcelimit) && (isSmall || all.length > 5) && lo.length > 1) {
                    nav.append(
                        $('<li class="dropdown">').append(
                            $('<a class="actionlink">')
                            .attr({
                                'href': '#',
                                'data-toggle': 'dropdown',
                                'data-action': 'more',
                                'aria-haspopup': 'true',
                                'tabindex': '1',
                                'role': 'menuitem'
                            })
                            .append(
                                $.txt(isSmall ? gt('Actions') : gt('More')),
                                $('<i class="fa fa-caret-down">')
                            )
                            .on(Modernizr.touch ? 'touchstart' : 'click', function () {
                                // fix dropdown position on-the-fly
                                var left = $(this).parent().position().left;
                                $(this).next().attr('class', 'dropdown-menu' + (left < 100 ? '' : ' pull-right'));
                            }),
                            $('<ul class="dropdown-menu pull-right">')
                            .attr({
                                'role': 'menu',
                                'aria-label': isSmall ? gt('Actions') : gt('More')
                            })
                            .append(function () {
                                // loop over all items and visually group by "section"
                                var items = [], currentSection = '';
                                lo.each(function () {
                                    var node = $(this), section = node.find('a').attr('data-section');
                                    // add divider?
                                    if (currentSection !== '' && currentSection !== section) {
                                        items.push($('<li class="divider" role="presentation">'));
                                    }
                                    currentSection = section;
                                    // add item
                                    items.push(node);
                                });
                                return items;
                            })
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

    var InlineButtonGroup = function (options) {
        var extension = _.extend(this, { classes: 'io-ox-inline-buttongroup' }, options);
        this.draw = function (baton) {
            baton = ext.Baton.ensure(baton);
            drawInlineButtonGroup(extension, new Collection(baton.data), this, baton, $.makeArray(arguments))
                .done(function (group) {
                    if (options.customizeNode) {
                        options.customizeNode(group);
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
            node = $('<div>').addClass('dropdown')
                .css('display', 'inline-block')
                .appendTo(this),
            label = options.label || baton.label || '###',
            $toggle = $('<a href="#" data-toggle="dropdown" aria-haspopup="true" tabindex="1">')
                .data('context', baton.data)
                .append(
                    _.isString(label) ? $.txt(label) : label,
                    $('<span>').text(_.noI18n(' ')),
                    $('<b>').addClass('caret')
                )
                .appendTo(node);

        if (options.zIndex !== undefined) {
            node.css('zIndex', (z = z > 0 ? z - 1 : 11000));
        }

        // TODO remove this whole 'inline-js-spacing' solution
        // better use CSS :after to insert spaces
        // dont' do this crap on mobile, textnode can not be styled or overwritten later...
        if (_.device('!smartphone')) {
            node.append($.txt(_.noI18n('\u00A0\u00A0 '))); // a bit more space
        }

        // create & add node first, since the rest is async
        options.classes += ' dropdown-menu';
        if (options.open === 'left') {
            options.classes += ' pull-right';
        } else {
            $toggle.on(Modernizr.touch ? 'touchstart' : 'click', function () {
                // fix dropdown position on-the-fly
                node.find('ul.dropdown-menu').addClass(node.position().left < 100 ? '' : 'dropdown-right');
            });
        }

        // defer drawing of drop-down options since they're not visible immediately
        setTimeout(function () {
            drawLinks(options, new Collection(baton.data), node, baton, args, true);
        }, 100);

        $toggle.dropdown();

        return node;
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
            $parent = $('<div>').addClass('btn-group')
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
                div = $('<li class="toolbar-button dropdown">').append(
                    a = $('<a href="#" data-toggle="dropdown" title="" tabindex="1">')
                        .attr('data-ref', extension.ref)
                        .addClass(extension.addClass)
                        .append(extension.icon()),
                    ul = $('<ul class="dropdown-menu dropdown-right-side" role="menu">')
                )
            );
            // get links
            return getLinks(extension, new Collection(baton.data), baton, args)
                .then(function (items) {
                    // filter out disabled items
                    return _.chain(items).filter(function (o) { return o.state; }).pluck('link').value();
                })
                .done(function (links) {
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
                        a.attr({
                            'title': extension.label || title.join(', '),
                            'aria-label': extension.label || title.join(', '),
                            'role': 'menuitem',
                            'aria-haspopup': true
                        });

                        div.attr('role', 'menu');
                        // add footer label?
                        if (extension.label) {
                            ul.append(
                                $('<li class="dropdown-footer">').text(extension.label)
                            );
                        }
                    } else {
                        // disable dropdown
                        a.removeAttr('data-toggle');
                        ul.remove();
                        if (links.length === 1) {
                            // directly link actions
                            a.attr({
                                'title': links[0].label || '',
                                'aria-label': links[0].label || '',
                                'role': 'menuitem',
                                'tabindex': 1,
                                // add tooltip
                                'data-animation': 'false',
                                'data-placement': 'right',
                                'data-container': 'body'
                            })
                            .tooltip()
                            .on('click', { baton: baton, extension: links[0] }, actionClick);
                        } else {
                            a.addClass('disabled').on('click', preventDefault);
                        }
                    }
                });
        }

        function icon() {
            return $('<i class="fa fa-magic">');
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
        InlineButtonGroup: InlineButtonGroup,
        DropdownLinks: DropdownLinks,
        Dropdown: Dropdown,
        ButtonGroup: ButtonGroup,
        ActionGroup: ActionGroup
    };
});
