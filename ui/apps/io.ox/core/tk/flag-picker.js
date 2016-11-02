/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2016 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/tk/flag-picker', [
    'io.ox/mail/api',
    'io.ox/core/folder/api',
    'gettext!io.ox/mail',
    'less!io.ox/core/tk/flag-picker'
], function (api, folderAPI, gt) {

    'use strict';

    // appends a listener for dropdowns to center them in scrollpane.
    // move this code to another file if this should be used globally.
    (function () {

        if (_.device('smartphone')) return;

        function handler() {

            var $this = $(this),
                $parent = $this.parent(),
                $ul = $('ul', $parent).first(),
                $zIndex = $parent.parents('[style*="z-index"]'),
                transformOffset = $parent.closest('[style*="translate3d"]').offset() || { top: 0, left: 0 },
                margin = 8,
                $scrollContainer = $parent.closest('.ios .io-ox-sidepopup-pane, .ios .io-ox-dialog-popup');

            $scrollContainer.css('-webkit-overflow-scrolling', 'auto');

            function computeBounds() {

                var positions = { top: 'auto', right: 'auto', bottom: 'auto', left: 'auto' },
                    offset = $this.offset(),
                    width = $this.width(),
                    height = $this.height(),
                    dropdownWidth = $ul.outerWidth(),
                    dropdownHeight = $ul.outerHeight(),
                    availableWidth = $(window).width(),
                    // don't overlap topbar
                    availableHeight = $(window).height() - $('#io-ox-topbar').height();

                // check potential positions
                if ((offset.top + height + dropdownHeight) < availableHeight) {
                    // enough room below
                    positions.top = offset.top + height;
                    // right aligned?
                    if ($parent.hasClass('pull-right') || (offset.left + dropdownWidth + margin) > availableWidth) {
                        positions.left = offset.left + width - dropdownWidth;
                    }
                } else {
                    // same top position
                    positions.top = offset.top;
                    // left or right?
                    if ((offset.left + width + dropdownWidth + margin) < availableWidth) {
                        // enough room on right side
                        positions.left = offset.left + width + margin;
                    } else {
                        // position of left side
                        positions.left = offset.left - dropdownWidth - margin;
                    }
                    // hits bottom?
                    if (positions.top + dropdownHeight > availableHeight - margin) {
                        // apply bottom limit
                        positions.bottom = margin;
                        // enough room above?
                        if ((dropdownHeight + 2 * margin) < availableHeight) {
                            positions.top = 'auto';
                        } else {
                            // again don't overlap the topbar or the dropdown is hidden underneath it
                            positions.top = margin + $('#io-ox-topbar').height();
                        }
                    }
                }

                $ul.css(positions);
            }

            function reset() {
                $zIndex.each(function () {
                    var z = $(this);
                    z.css('z-index', z.data('oldIndex'));
                    z.removeData('oldIndex');
                });
                $parent.removeClass('smart-dropdown-container');
                $parent.find('.abs').remove();
                $ul.css({ top: '', left: '', bottom: '', right: '' });
                $parent.off('ready', computeBounds);
                $scrollContainer.css('-webkit-overflow-scrolling', '');
            }

            if (!$parent.hasClass('open')) return;

            computeBounds();

            $zIndex.each(function () {
                var z = $(this);
                //prevent accidentally overwriting of old z Index
                if (z.data('oldIndex') === undefined) {
                    z.data('oldIndex', z.css('z-index'));
                }
                z.css('z-index', 10000);
            });

            $parent
                .on('ready', computeBounds)
                .one('hidden.bs.dropdown', reset)
                .addClass('smart-dropdown-container')
                .append(
                    $('<div class="abs overlay">')
                        .css({
                            left: -transformOffset.left,
                            right: transformOffset.left
                        })
                        .on('mousewheel touchmove', false)
                        .on('click', function () {
                            $parent.removeClass('open');
                            reset();
                            return false;
                        })
                );
        }

        $(document).on('shown.bs.dropdown', function (e, arg) {
            if (!$(arg.relatedTarget).hasClass('smart-dropdown')) return;
            return handler.call(arg.relatedTarget, e);
        });

        $(document).on('click', '.smart-dropdown', handler);

    }());

    var colorNames = {
        NONE:       gt('None'),
        RED:        gt('Red'),
        BLUE:       gt('Blue'),
        GREEN:      gt('Green'),
        GRAY:       gt('Gray'),
        PURPLE:     gt('Purple'),
        LIGHTGREEN: gt('Light green'),
        ORANGE:     gt('Orange'),
        PINK:       gt('Pink'),
        LIGHTBLUE:  gt('Light blue'),
        YELLOW:     gt('Yellow')
    };

    var order = {
        NONE:        0,
        RED:         1,
        BLUE:        2,
        GREEN:       3,
        GRAY:        4,
        PURPLE:      5,
        LIGHTGREEN:  6,
        ORANGE:      7,
        PINK:        8,
        LIGHTBLUE:   9,
        YELLOW:     10
    };

    var colorLabelIconEmpty = 'fa fa-bookmark-o',
        colorLabelIcon = 'fa fa-bookmark';

    var preParsed = {
        div: $('<div>'),
        list: $('<ul class="dropdown-menu" role="menu">'),
        listItem: $('<li>'),
        menuItemLink: $('<a href="#" role="menuitem">'),
        flag: $('<span class="flag-example">'),
        setColorLink: $('<a href="#">').attr('aria-label', gt('Set color')),
        dropdownIcon: $('<i class="flag-dropdown-icon" aria-hidden="true">').attr('title', gt('Set color'))
    };

    var that = {

        appendDropdown: function (node, data) {
            node.after(
                // drop down
                preParsed.list.clone()
                .on('click', 'a', { data: data }, that.change)
                .append(
                    _(order).map(function (index, color) {
                        // alternative: api.COLORS for rainbow colors
                        return preParsed.listItem.clone().append(
                            preParsed.menuItemLink.clone().append(
                                index > 0 ? preParsed.flag.clone().addClass('flag_bg_' + index) : $(),
                                $.txt(colorNames[color])
                            )
                            .attr('data-color', index)
                        );
                    })
                )

            );

            node.addClass('dropdown-toggle').attr({
                'aria-haspopup': 'true',
                'data-toggle': 'dropdown',
                'role': 'button'
            });

            node.parent().addClass('dropdown flag-picker');
        },

        draw: function (node, baton, overlay) {

            var data = baton.data,
                // to fix buggy -1
                color = Math.max(0, data.color_label || 0),
                link;

            node.append(
                preParsed.div.clone().append(
                    link = preParsed.setColorLink.clone()
                    .addClass(overlay ? 'smart-dropdown' : '')
                    .append(
                        preParsed.dropdownIcon.clone().attr({
                            'data-color': color,
                            'title': gt('Set color')
                        })
                        .addClass('flag_' + color + ' ' + (color ? colorLabelIcon : colorLabelIconEmpty))
                    )
                )
            );

            this.appendDropdown(link, data);

            // listen for change event
            if (baton.view) baton.view.listenTo(baton.model, 'change:color_label', this.update);
        },

        change: function (e) {

            e.preventDefault();

            var data = e.data.data,
                color = $(e.currentTarget).attr('data-color') || '0',
                node = $(this).closest('.flag-picker');

            data = folderAPI.ignoreSentItems(data);
            api.changeColor(data, color);

            node.find('.dropdown-toggle').focus();
        },

        update: function (model) {
            // set proper icon class
            var color = Math.max(0, model.get('color_label') || 0);
            var className = 'flag-dropdown-icon ';
            className += color === 0 ? colorLabelIconEmpty : colorLabelIcon;
            className += ' flag_' + color;
            this.$el.find('.flag-dropdown-icon').attr({ 'class': className, 'data-color': color });
        },

        // attach flag-picker behavior on existing node
        attach: function (node, options) {
            this.appendDropdown(node, options.data);
        }
    };

    return that;
});
