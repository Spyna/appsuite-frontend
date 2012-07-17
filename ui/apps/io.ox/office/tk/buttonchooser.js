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

define('io.ox/office/tk/buttonchooser',
    ['io.ox/office/tk/utils',
     'io.ox/office/tk/dropdown'
    ], function (Utils, DropDown) {

    'use strict';

    var // shortcut for the KeyCodes object
        KeyCodes = Utils.KeyCodes,

        // placeholder button for new cells (must contain something to get its correct height)
        placeholder = Utils.createButton(undefined, { label: '\xa0' });

    // class ButtonChooser ====================================================

    /**
     * Creates a container element with a drop-down button shown on top, and a
     * tabular drop-down menu containing button controls.
     *
     * @constructor
     *
     * @extends DropDown
     *
     * @param {String} key
     *  The unique key of the group. This key is shared by all controls
     *  inserted into the drop-down grid of this group.
     *
     * @param {Object} options
     *  A map of options to control the properties of the button chooser.
     *  Supports all options of the DropDown() base class constructor.
     *  Additionally, the following options are supported:
     *  @param {Number} [options.columns=3]
     *      Number of columns used to build the drop-down grid.
     */
    function ButtonChooser(key, options) {

        var // self reference to be used in event handlers
            self = this,

            // the drop-down grid element
            gridNode = $('<table>'),

            // number of rows in the grid
            rows = 0,

            // number of columns in the grid
            columns = Utils.getIntegerOption(options, 'columns', 3, 1),

            // number of buttons inserted into the group
            buttonCount = 0;

        // private methods ----------------------------------------------------

        /**
         * Handles 'menuopen' events and initializes the drop-down menu.
         */
        function menuOpenHandler(event, from) {

            // Work around a Firefox bug which displays the menu too narrow (it
            // restricts the table width to the width of the group element). If
            // this is not a bug but a CSS feature, it needs to be worked
            // around anyway.
            self.getMenuNode().width(99999).width(gridNode.outerWidth(true));

            // move focus to first enabled control, if opened by keyboard
            if ((from === 'key') && !Utils.containsFocusedControl(gridNode)) {
                self.getGridButtons().first().focus();
            }
        }

        /**
         * Handles key events in the open grid element.
         */
        function gridKeyHandler(event) {

            var // distinguish between event types (ignore keypress events)
                keydown = event.type === 'keydown',
                // all buttons in the drop-down grid
                buttons = self.getGridButtons(),
                // index of the focused button
                index = buttons.index(event.target),
                // row index of the focused button
                row = (index >= 0) ? Math.floor(index / columns) : -1,
                // column index of the focused button
                column = (index >= 0) ? (index % columns) : -1;

            function focus(newIndex) {
                newIndex = Math.min(buttonCount - 1, newIndex);
                if ((newIndex >= 0) && (newIndex !== index)) {
                    buttons.eq(newIndex).focus();
                }
            }

            switch (event.keyCode) {
            case KeyCodes.LEFT_ARROW:
                if (keydown && (column > 0)) { focus(index - 1); }
                return false;
            case KeyCodes.UP_ARROW:
                if (keydown) {
                    if (row > 0) { focus(index - columns); } else { self.hideMenu('key'); }
                }
                return false;
            case KeyCodes.RIGHT_ARROW:
                if (keydown && (column + 1 < columns)) { focus(index + 1); }
                return false;
            case KeyCodes.DOWN_ARROW:
                if (keydown && (row + 1 < rows)) { focus(index + columns); }
                return false;
            }
        }

        // base constructor ---------------------------------------------------

        DropDown.call(this, key, options);

        // methods ------------------------------------------------------------

        /**
         * Returns all button elements in the drop-down grid element, as jQuery
         * collection.
         */
        this.getGridButtons = function () {
            return gridNode.find('button' + Utils.ENABLED_SELECTOR);
        };

        /**
         * Adds a new button to the drop-down grid.
         *
         * @param {Object} [options]
         *  A map of options to control the properties of the new button. See
         *  method Utils.createButton() for details.
         *
         * @returns {jQuery}
         *  The new button, as jQuery collection.
         */
        this.createGridButton = function (options) {

            var // button for the button group
                button = Utils.createButton(key, options),
                // table row taking the new button
                tableRow = null,
                // column index for the new button
                column = buttonCount % columns;

            // get/create table row with empty cell from drop-down menu
            if (column === 0) {
                // create a new row in the table, and fill it with dummy buttons
                tableRow = $('<tr>').appendTo(gridNode);
                _(columns).times(function () {
                    tableRow.append($('<td>').append(placeholder.clone()));
                });
                rows += 1;
            } else {
                // select last table row
                tableRow = gridNode.find('tr:last-child');
            }

            // select table cell and replace the dummy button with a new real button
            tableRow.children().eq(column).empty().append(button);
            buttonCount += 1;

            return button;
        };

        // initialization -----------------------------------------------------

        // initialize the drop-down element
        this.getMenuNode().addClass('button-chooser').append(gridNode);

        // register event handlers
        this.on('menuopen', menuOpenHandler);
        gridNode.on('keydown keypress keyup', gridKeyHandler);

    } // class ButtonChooser

    // global initialization ==================================================

    // disable the placeholder button
    Utils.enableControls(placeholder, false);

    // exports ================================================================

    // derive this class from class DropDown
    return DropDown.extend({ constructor: ButtonChooser });

});
