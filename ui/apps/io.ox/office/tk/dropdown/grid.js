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
 * @author Daniel Rentz <daniel.rentz@open-xchange.com>
 */

define('io.ox/office/tk/dropdown/grid',
    ['io.ox/office/tk/utils',
     'io.ox/office/tk/control/group',
     'io.ox/office/tk/dropdown/items'
    ], function (Utils, Group, Items) {

    'use strict';

    var // shortcut for the KeyCodes object
        KeyCodes = Utils.KeyCodes;

    // class Grid =============================================================

    /**
     * Extends a Group object with a drop-down button and a drop-down menu
     * containing a grid of items. Extends the DropDown mix-in class with
     * functionality specific to the grid drop-down element.
     *
     * Note: This is a mix-in class supposed to extend an existing instance of
     * the class Group or one of its derived classes. Expects the symbol 'this'
     * to be bound to an instance of Group.
     *
     * @constructor
     *
     * @extends Items
     *
     * @param {Object} [options]
     *  A map of options to control the properties of the grid. Supports all
     *  options of the Items base class. Additionally, the following options
     *  are supported:
     *  @param {Number} [options.itemColumns=10]
     *      The number of columns in the grid layout.
     */
    function Grid(options) {

        var // self reference (the Group instance)
            self = this,

            // number of items per row
            columns = Utils.getIntegerOption(options, 'itemColumns', 10, 1);

        // base constructor ---------------------------------------------------

        Items.call(this, Utils.extendOptions(options, { itemInserter: itemGridInserter }));

        // private methods ----------------------------------------------------

        /**
         * Inserts the passed item button into the grid.
         */
        function itemGridInserter(sectionNode, button, index) {

            var // the table element containing the grid items
                tableNode = null,
                // the last table row
                rowNode = null,
                // the existing item buttons
                buttons = null;

            // create a new table element for the button if required
            tableNode = sectionNode.children('table');
            if (tableNode.length === 0) {
                tableNode = $('<table>').appendTo(sectionNode);
            }

            // create a new table row element for the button if required
            rowNode = tableNode.find('> tbody > tr').last();
            if ((rowNode.length === 0) || (rowNode.children().length === columns)) {
                rowNode = $('<tr>').appendTo(tableNode);
            }

            // insert the new button into the array, and reinsert all buttons into the table
            buttons = tableNode.find(Utils.BUTTON_SELECTOR).get();
            buttons.splice(index, 0, button);
            rowNode.append($('<td>'));
            tableNode.find('> tbody > tr > td').each(function (index) {
                $(this).append(buttons[index]);
            });
        }

        /**
         * Handles key events in the open drop-down grid menu element.
         */
        function gridKeyHandler(event) {

            var // distinguish between event types (ignore keypress events)
                keydown = event.type === 'keydown',
                // all list items (button elements)
                buttons = self.getItems(),
                // index of the focused list item
                index = buttons.index(event.target),
                // relative index change
                relIndex = 0;

            switch (event.keyCode) {
            case KeyCodes.LEFT_ARROW:
                if (keydown) { buttons.eq(index - 1).focus(); }
                return false;
            case KeyCodes.RIGHT_ARROW:
                if (keydown) {
                    if (index + 1 >= buttons.length) { index = -1; }
                    buttons.eq(index + 1).focus();
                }
                return false;
            case KeyCodes.UP_ARROW:
                if (keydown) {
                    if (index <= 0) {
                        self.hideMenu();
                    } else {
                        relIndex = calcRelativeIndex(true);
                        index = ((index + relIndex) < 0) ? index : (index + relIndex);
                        buttons.eq(index).focus();
                    }
                }
                return false;
            case KeyCodes.DOWN_ARROW:
                if (keydown) {
                    relIndex = calcRelativeIndex(false);
                    index = ((index + relIndex) >= buttons.length) ? index : (index + relIndex);
                    buttons.eq(index).focus();
                }
                return false;
            case KeyCodes.HOME:
                if (keydown) { buttons.first().focus(); }
                return false;
            case KeyCodes.END:
                if (keydown) { buttons.last().focus(); }
                return false;
            }
        }

        function calcRelativeIndex(up) {
            var row = $(document.activeElement).parents('tr'), index = 0, cells = 0;

            if (row.length) {
                cells = row[0].cells.length;
                index = up ? -cells : cells;
            }

            return index;
        }

        // initialization -----------------------------------------------------

        // additional formatting for grid layout, register event handlers
        this.getItemGroup().getNode().addClass('grid').on('keydown keypress keyup', gridKeyHandler);

    } // class Grid

    // exports ================================================================

    // derive this class from class Items
    return Items.extend({ constructor: Grid });

});
