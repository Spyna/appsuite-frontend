/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/tk/flag-picker',
    ['io.ox/mail/api',
     'io.ox/core/api/folder',
     'gettext!io.ox/mail'
    ], function (api, folderAPI, gt) {

    'use strict';

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

    var that = {

        appendDropdown: function (node, data) {

            node.after(
                // drop down
                $('<ul class="dropdown-menu" role="menu">')
                .on('click', 'a', { data: data }, that.change)
                .append(
                    _(order).map(function (index, color) { // alternative: api.COLORS for rainbow colors
                        return $('<li>').append(
                            $('<a href="#" tabindex="1" role="menuitem">').append(
                                index > 0 ? $('<span class="flag-example">').addClass('flag_bg_' + index) : $(),
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

        draw: function (node, baton) {

            var data = baton.data,
                color = Math.max(0, data.color_label || 0), // to fix buggy -1
                link;

            node.append(
                $('<div>').append(
                    link = $('<a href="#" tabindex="1">').append(
                        $('<i class="flag-dropdown-icon">')
                        .attr('data-color', color)
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
