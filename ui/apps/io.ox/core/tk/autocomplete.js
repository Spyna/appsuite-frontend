/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2004-2012 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/tk/autocomplete',
    ['io.ox/core/util',
     'settings!io.ox/contacts',
     'gettext!io.ox/mail'
    ], function (util, settings, gt) {

    'use strict';

    //returns the input elem
    $.fn.autocomplete = function (o) {

        o = $.extend({
            // use Math.max here to make sure we don't get a zero (strange behavior then & look-up is too expensive)
            minLength: Math.max(1, settings.get('search/minimumQueryLength', 3)),
            maxResults: 25,
            delay: 100,
            draw: null,
            blur: $.noop,
            click: $.noop,
            parentSelector: 'body',
            autoselect: false,
            api: null,
            container: $('<div>').addClass('autocomplete-popup'),
            mode: 'participant',

            cbshow: null,

            //get data
            source: function (val) {
                return this.api.search(val).then(function (data) {
                    return o.placement === 'top' ? data.reverse() : data;
                });
            },

            //remove untwanted items
            reduce: function (data) {
                return data;
            },

            name: function (data) {
                return util.unescapeDisplayName(data.display_name);
            },

            // object related unique string
            stringify: function (data) {

                if (data.type === 2 || data.type === 3)
                    return this.name(data.contact);

                var name = this.name(data);
                return name ? '"' + name + '" <' + data.email + '>' : data.email;
            }
        }, o || {});

        var scrollpane = o.container.scrollable();

        var self = $(this),

            // last search
            lastValue = '',
            lastSearch = $.Deferred().resolve(),
            // no-results prefix
            emptyPrefix = '\u0000',
            // current search result index
            index = -1,
            // state
            isOpen = false,

            reposition = _.debounce(function () {
                    //popup stays next to input
                    var left = parseInt(o.container.css('left').replace('px', ''), 10),
                        diff = self.offset().left - o.container.offset().left;
                    o.container.css('left', (left + diff) + 'px');
                }, 100),

            update = function () {
                // get data from current item and update input field
                var data = scrollpane.children().eq(Math.max(0, index)).data(),
                    current = self.val(),
                    changed = false;

                if (data !== undefined) {
                    lastValue = String(o.stringify(data));
                    changed = lastValue !== current;
                    if (changed) self.val(lastValue);
                }

                // if two related Fields are needed
                if (_.isFunction(o.related)) {
                    var relatedField = o.related(),
                        dataHolder = o.dataHolder(),
                        relatedValue = o.stringifyrelated(data);
                    relatedField.val(relatedValue);
                    dataHolder.data(data);
                }

                return changed;
            },

            select = function (i, processData) {
                    processData = typeof processData === 'undefined' ? true : processData;
                    var children;
                    if (i >= 0 && i < (children = scrollpane.children()).length) {
                        children.removeClass('selected').eq(i).addClass('selected').intoViewport(o.container);

                        //TODO: select next one
                        if (o.mode === 'search') {
                            if (scrollpane.children().eq(i).hasClass('unselectable')) {
                                var next = index < i ? i + 1 : i - 1;
                                select(next, processData);
                                return;
                            }
                        }

                        index = i;
                        if (processData) {
                            update();
                        }
                    }
                },

            selectFirst = function () {
                var length = scrollpane.children().length;
                if (o.placement === 'top') {
                    select(length - 1, false);
                } else {
                    select(0, false);
                }
            },

            fnBlur = function () {
                    setTimeout(close, 200);
                },

            blurOff = function () {
                    self.off('blur', fnBlur).focus();
                },

            blurOn = function () {
                    _.defer(function () {
                        self.on('blur', fnBlur).focus();
                    });
                },

            open = function () {
                    if (!isOpen) {
                        // toggle blur handlers
                        self.off('blur', o.blur).on('blur', fnBlur);
                        $(window).on('resize', reposition);
                        // calculate position/dimension and show popup
                        var off = self.offset(),
                            w = self.outerWidth(),
                            h = self.outerHeight();
                        o.container.hide().appendTo(self.closest(o.parentSelector));

                        var parent = self.closest(o.parentSelector).offsetParent(),
                            parentOffset = parent.offset(),
                            myTop = off.top + h - parentOffset.top + parent.scrollTop(),
                            myLeft = off.left - parentOffset.left;

                        o.container.removeClass('top-placement bottom-placement');
                        if (o.placement === 'top') {
                            // top
                            o.container.addClass('top-placement').css({ top: myTop - h - o.container.outerHeight(), left: myLeft + 4, width: w });
                        } else {
                            // bottom
                            o.container.addClass('bottom-placement').css({ top: myTop, left: myLeft + 4, width: w });
                        }

                        o.container.show();
                        if (_.isFunction(o.cbshow)) o.cbshow();

                        window.container = o.container;

                        isOpen = true;
                    }
                },

            close = function () {
                    if (isOpen) {
                        // toggle blur handlers
                        self.on('blur', o.blur).off('blur', fnBlur);
                        //check if input or dropdown has focus otherwise user has clicked somewhere else to close the dropdown. See Bug 32949
                        //body.has(self) is needed to check if the input is still attached (may happen if you close mail compose with opened dropdown for example)
                        if (self.val() && $('body').has(self).length && !self.is(document.activeElement) && !o.container.has(document.activeElement).length) {
                            //focus is outside so this can be handled as a blur
                            self.trigger('blur');
                        }
                        $(window).off('resize', reposition);
                        scrollpane.empty();
                        o.container.detach();
                        isOpen = false;
                        index = -1;
                    }
                },

            create = function (list, query) {
                if (o.mode === 'participant') {
                    _(list.slice(0, o.maxResults)).each(function (data, index) {
                        var node = $('<div class="autocomplete-item">')
                            .data({
                                index: index,
                                contact: data.data,
                                email: data.email,
                                field: data.field || '',
                                phone: data.phone || '',
                                type: data.type,
                                distlistarray: data.data.distribution_list,
                                id: data.data.id,
                                folder_id: data.data.folder_id,
                                image1_url: data.data.image1_url,
                                first_name: data.data.first_name,
                                last_name: data.data.last_name,
                                display_name: data.data.display_name
                            })
                            .on('click mousedown', fnSelectItem);
                        o.draw.call(node, data, query);
                        node.appendTo(scrollpane);
                    });
                } else {
                    var regular, childs;

                    //apply style
                    o.container
                        .addClass('autocomplete-search');
                    scrollpane.addClass('dropdown-menu-inline');

                    //ignore hidden facets
                    list = _(list).filter(function (facet) {
                        return !facet.hidden;
                    });

                    _(list).each(function (facet) {
                        regular = facet.style !== 'simple' && !!facet.name;
                        childs = facet.values && facet.values.length > 0;
                        //facet separator
                        if (facet.name && childs && regular) {
                            $('<div class="autocomplete-item dropdown-header unselectable">')
                                .html(facet.name)
                                .data({
                                    id: facet.id,
                                    label: facet.name,
                                    type: 'group'
                                })
                                // delimiter
                                .appendTo(scrollpane)
                                // kepp open on click
                                .on('mousedown click', fnIgnore);
                        }
                        //values
                        _([].concat(facet.values || facet)).each(function (value) {
                            value.facet = facet.id;
                            var node = $('<div class="autocomplete-item">')
                                .on('click', fnSelectItem);
                            //intend
                            if (regular)
                                node.addClass('indent');
                            o.draw.call(node, value);
                            node.appendTo(scrollpane);
                        });
                    });
                }
            },

            fnSelectItem = function (e) {
                e.data = $(this).data();
                if (o.mode === 'participant')
                    select(e.data.index);
                o.click.call(self.get(0), e);
                close();
            },

            fnIgnore = function () {
                // kepp dropdown open
                // stopPropagation, preventDefault
                return false;
            },

            // handle search result
            cbSearchResult = function (query, data) {
                    // reset scrollpane and show drop-down
                    scrollpane.empty();
                    open();
                    var list = data.list;
                    if (list.length) {
                        o.container.idle();
                        // draw results
                        create.call(self, list, query);
                        // leads to results
                        emptyPrefix = '\u0000';
                        index = -1;
                        // select first element without updating input field
                        if (o.autoselect) selectFirst();
                    } else {
                        // leads to no results if returned data wasn't filtered before (allready participant)
                        emptyPrefix = data.hits ? emptyPrefix : query;
                        close();
                    }
                    //lastSearch will never reject
                    lastSearch.resolve('succeeded', query);
                },

            // adds 'retry'-item to popup
            cbSearchResultFail = function (query) {
                    scrollpane.empty();
                    o.container.idle();
                    var node = $('<div>')
                        .addClass('io-ox-center')
                        .append(
                            // fail container/content
                            $('<div class="io-ox-fail">').append(
                                $.txt(gt('Could not load this list')),
                                $.txt('. '),
                                //link
                                $('<a href="#">').text(gt('Retry'))
                                .on('click', function () {
                                        self.trigger('keyup', { isRetry: true });
                                    }
                                )

                            )
                        );
                    node.appendTo(scrollpane);
                    //lastSearch will will never reject
                    lastSearch.resolve('failed', query);
                },

            autoSelectFirst = function () {
                scrollpane.find('.autocomplete-item:visible:not(.unselectable),' +
                                '.autocomplete-item.default').first().click();
            },

            //waits for finished server call/drawn dropdown
            autoSelectFirstWait = _.debounce(function () {
                /*
                 * EXAMPLE:
                 * 123...t°......4.t¹..t²..t³....
                 * t°: search request ('123')
                 * t¹: search response
                 * t²: enter
                 * t³: search request ('1234')
                */
                lastSearch.done(function (state, query) {
                    if (self.val() !== query) {
                        //t¹
                        autoSelectFirstWait();
                    } else {
                        //else
                        autoSelectFirst();
                    }
                });
            }, o.delay),

            // handle key down (esc/cursor only)
            fnKeyDown = function (e) {

                var selected;

                if (isOpen) {
                    switch (e.which) {
                    case 27: // escape
                        close();
                        break;
                    case 39: // cursor right
                        if (!e.shiftKey && o.mode === 'participant') {
                            // only prevent cursor movement when changing the content
                            // otherwise its not possible to use the cursor keys properly
                            if (update()) e.preventDefault();
                        }
                        break;
                    case 13: // enter

                        // two different behaviors are possible:
                        // 1. use the exact value that is in the input field
                        // 2. use selected item or auto-select first item
                        // we use second approach here - this still allows to add custom mail addresses

                        selected = scrollpane.find('.selected');

                        if (selected.length) {
                            // use selected item
                            selected.trigger('click');
                        } else {
                            // auto-select first item
                            if (o.mode === 'participant') {
                                autoSelectFirst();
                            } else {
                                autoSelectFirstWait();
                            }
                        }

                        // calendar: add string
                        var value = $.trim($(this).val());
                        if (value.length > 0) $(this).trigger('selected', val, (val || '').length >= o.minLength);

                        break;
                    case 9:  // tab
                        if (!e.shiftKey) { // ignore back-tab
                            selected = scrollpane.find('.selected');
                            if (selected.length) {
                                e.preventDefault();
                                selected.trigger('click');
                            } else {
                                if (o.mode === 'participant') $(this).val(val = '');
                                close();
                            }
                        }
                        break;
                    case 38: // cursor up
                        e.preventDefault();
                        if (index > 0) {
                            select(index - 1);
                        }
                        break;
                    case 40: // cursor down
                        e.preventDefault();
                        select(index + 1);
                        break;
                    }
                } else {
                    switch (e.which) {
                    case 27: // escape
                        $(this).val(''); //empty it
                        close();
                        break;
                    /*case 39: // cursor right
                        e.preventDefault();
                        if (!e.shiftKey) {
                            update();
                            close();
                        }
                        break;*/
                    case 13:
                        if (o.mode !== 'participant') {
                            autoSelectFirstWait();
                        }
                        /* falls through */
                    case 9:
                        var val = $.trim($(this).val());
                        if (val.length > 0) {
                            $(this).trigger('selected', val, (val || '').length >= o.minLength);
                        }
                        break;
                    }
                }
            },

            // handle key up (debounced)
            fnKeyUp = _.debounce(function (e, options) {
                //TODO: element destroyed before debounce resolved
                if (!document.body.contains(this)) return;
                this.focus();

                if (e.which === 13) return;
                e.stopPropagation();

                var opt = _.extend({}, (e.data || {}), options || {}),
                    val = $.trim($(this).val());

                if (val.length >= o.minLength && !opt.keepClosed) {
                    //request data?
                    if (opt.isRetry || (val !== lastValue && val.indexOf(emptyPrefix) === -1)) {
                        lastSearch = $.Deferred();
                        lastValue = val;
                        o.container.busy();
                        o.source(val)
                            .then(o.reduce)
                            .then(_.lfo(cbSearchResult, val), cbSearchResultFail);
                    }
                } else {
                    lastValue = val;
                    close();
                }
            }, o.delay);

       /**
        * get the selected item
        *
        * @return {object|boolean} data object or false
        */
        this.getSelectedItem = function () {
            var data = scrollpane.children().eq(Math.max(0, index)).data();
            return index < 0 ? false : data;
        };

        if (_.isFunction(o.source) && _.isFunction(o.draw)) {

            // input loses focus on scrollbar click
            var isModalPopup = o.parentSelector.indexOf('.permissions-dialog') > -1;

            $.each(this, function () {
                // bind fundamental handlers
                $(this)
                    .on('keydown', fnKeyDown)
                    .on('keyup', fnKeyUp)
                    .on('compositionend', fnKeyUp) // for IME support
                    .on('blur', o.blur)
                    .on('blur', fnBlur)
                    .attr({
                        autocapitalize: 'off',
                        autocomplete: 'off', //naming conflict with function
                        autocorrect: 'off'
                    });
            });

            //internet explorer needs this fix too or it closes if you try to scroll
            if (_.device('!desktop') || _.device('ie') || isModalPopup) {
                o.container.on('mousedown', blurOff).on('mouseup', blurOn);
            }
        }

        this.isOpen = function () {
            return isOpen;
        };

        this.open = open;

        return this;
    };

    return {};
});
