/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) 2004-2012 Open-Xchange, Inc.
 * Mail: info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/tk/autocomplete',
    ['gettext!io.ox/mail',
     'io.ox/core/util'], function (gt, util) {

    'use strict';

    var popup = $('<div>').addClass('autocomplete-popup'),
        scrollpane = popup.scrollable();

    //returns the input elem
    $.fn.autocomplete = function (o) {

        o = $.extend({
                minLength: 1,
                maxResults: 25,
                delay: 100,
                collection: null,
                draw: null,
                blur: $.noop,
                click: $.noop,
                parentSelector: 'body',
                autoselect: false,
                api: null,
                node: null,

                //get data
                source: function (val) {
                    return this.api.search(val).pipe(function (data) {
                        return o.placement === 'top' ? data.reverse() : data;
                    });
                },

                //remove untwanted items
                reduce: function (data) {
                    return data;
                },

                //object related unique string
                stringify: function (data) {

                    if (data.type === 'resource' || data.type === 'group')
                        return util.unescapeDisplayName(data.data.display_name);

                    return data.display_name ? '"' + util.unescapeDisplayName(data.display_name) + '" <' + data.email + '>' : data.email;
                }
            }, o || {});


        var self = $(this),

            // last search
            lastValue = '',
            // no-results prefix
            emptyPrefix = "\u0000",
            // current search result index
            index = -1,
            // state
            isOpen = false,

            update = function () {
                // get data from current item and update input field
                var data = scrollpane.children().eq(Math.max(0, index)).data('data');
                lastValue = data !== undefined ? o.stringify(data) + '' : lastValue;
                self.val(lastValue);

                // if two related Fields are needed
                if (_.isFunction(o.related)) {
                    var relatedField = o.related(),
                        dataHolder = o.dataHolder(),
                        relatedValue = o.stringifyrelated(data);
                    relatedField.val(relatedValue);
                    dataHolder.data(data);
                }
            },

            select = function (i, processData) {
                    processData = typeof processData === 'undefined' ? true : processData;
                    var children;
                    if (i >= 0 && i < (children = scrollpane.children()).length) {
                        children.removeClass('selected').eq(i).addClass('selected').intoViewport(popup);
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


            fnBlur = function (e) {
                    setTimeout(close, 200);
                },

            blurOff = function (e) {
                    self.off('blur', fnBlur).focus();
                },

            blurOn = function (e) {
                    _.defer(function () {
                        self.on('blur', fnBlur).focus();
                    });
                },

            open = function () {
                    if (!isOpen) {
                        // toggle blur handlers
                        self.off('blur', o.blur).on('blur', fnBlur);
                        // calculate position/dimension and show popup
                        var off = self.offset(),
                            w = self.outerWidth(),
                            h = self.outerHeight();

                        popup.hide().appendTo(self.closest(o.parentSelector));

                        var parent = self.closest(o.parentSelector).offsetParent(),
                            parentOffset = parent.offset(),
                            myTop = off.top + h - parentOffset.top + parent.scrollTop(),
                            myLeft = off.left - parentOffset.left;

                        popup.removeClass('top-placement bottom-placement');
                        if (o.placement === 'top') {
                            // top
                            popup.addClass('top-placement').css({ top: myTop - h - popup.outerHeight(), left: myLeft + 4, width: w });
                        } else {
                            // bottom
                            popup.addClass('bottom-placement').css({ top: myTop, left: myLeft + 4, width: w });
                        }

                        popup.show();

                        window.popup = popup;

                        isOpen = true;
                    }
                },

            close = function () {
                    if (isOpen) {
                        // toggle blur handlers
                        self.on('blur', o.blur).off('blur', fnBlur);
                        scrollpane.empty();
                        popup.detach();
                        isOpen = false;
                        index = -1;
                    }
                },

            fnSelectItem = function (e) {
                    select(e.data.index);
                    o.click.call(self.get(0), e);
                    close();
                },

            // handle search result
            cbSearchResult = function (query, data) {
                    var list = data.list;
                    if (list.length) {
                        // draw results
                        popup.idle();
                        _(list.slice(0, o.maxResults)).each(function (data, index) {
                            var node = $('<div>')
                                .addClass('autocomplete-item')
                                .data('data', data)
                                .on('click', { index: index, contact: data.contact, email: data.email, field: data.field || '', phone: data.phone || '', distlistarray: data.data.distribution_list, id: data.data.id, folder_id: data.data.folder_id, image1_url: data.data.image1_url, display_name: data.data.display_name }, fnSelectItem);
                            o.draw.call(node, data, query);
                            node.appendTo(scrollpane);
                        });
                        // leads to results
                        emptyPrefix = "\u0000";
                        index = -1;
                        //select first element without updating input field
                        if (o.autoselect) {
                            selectFirst();
                        }
                    } else {
                        // leads to no results if returned data wasn't filtered before (allready participant)
                        emptyPrefix = data.hits ? emptyPrefix : query;
                        close();
                    }
                },

            // adds 'retry'-item to popup
            cbSearchResultFail = function (query) {
                    popup.idle();
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
                },

            // handle key down (esc/cursor only)
            fnKeyDown = function (e) {
                // e.stopPropagation();
                if (isOpen) {
                    switch (e.which) {
                    case 27: // escape
                        close();
                        break;
                    case 39: // cursor right
                        e.preventDefault();
                        if (!e.shiftKey) {
                            update();
                        }
                        break;
                    case 13: // enter
                        scrollpane.find('.selected').trigger('click');

                        //calendar: add string
                        var val = $.trim($(this).val());
                        if (val.length > 0) {
                            $(this).trigger('selected', val);
                        }
                        break;
                    case 9:  // tab
                        e.preventDefault();
                        if (!e.shiftKey) { // ignore back-tab
                            update();
                            $(this).trigger('selected', scrollpane.children().eq(Math.max(0, index)).data('data'));
                            close();
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
                    case 9:
                        var val = $.trim($(this).val());
                        if (val.length > 0) {
                            $(this).trigger('selected', val);
                        }
                        break;
                    }
                }
            },

            // handle key up (debounced)
            fnKeyUp = _.debounce(function (e, isRetry) {
                e.stopPropagation();
                var val = $.trim($(this).val());
                isRetry = isRetry || false;
                if (val.length >= o.minLength) {
                    if (isRetry || (val !== lastValue && val.indexOf(emptyPrefix) === -1)) {
                        lastValue = val;
                        scrollpane.empty();
                        popup.busy();
                        open();
                        o.source(val)
                            .pipe(o.reduce)
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
            var data = scrollpane.children().eq(Math.max(0, index)).data('data');
            return index < 0 ? false : data;
        };

        if (_.isFunction(o.source) && _.isFunction(o.draw)) {

            $.each(this, function () {
                // bind fundamental handlers
                $(this)
                    .on('keydown', fnKeyDown)
                    .on('keyup', fnKeyUp)
                    .on('blur', o.blur)
                    .on('blur', fnBlur)
                    .attr({
                        autocapitalize: 'off',
                        autocomplete: 'off', //naming conflict with function
                        autocorrect: 'off'
                    });
            });

            popup.on('mousedown', blurOff).on('mouseup', blurOn);
        }

        return this;
    };

    return {};
});
