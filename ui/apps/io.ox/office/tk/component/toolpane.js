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

define('io.ox/office/tk/component/toolpane',
    ['io.ox/office/tk/utils',
     'io.ox/office/tk/component/toolbar'
    ], function (Utils, ToolBar) {

    'use strict';

    var // shortcut for the KeyCodes object
        KeyCodes = Utils.KeyCodes;

    // class ToolPane =========================================================

    /**
     * Represents a container element with multiple tool bars where one tool
     * bar is visible at a time. Tool bars can be selected with a tab control
     * shown above the visible tool bar.
     *
     * @param {ox.ui.Window} appWindow
     *  The application window object.
     *
     * @param {Controller} controller
     *  The application controller.
     *
     * @param {String} key
     *  The controller key used to change the visible tool bar. Will be bound
     *  to the tab control shown above the visible tool bar.
     */
    function ToolPane(appWindow, controller, key) {

        var // self reference
            self = this,

            // the container element representing the tool pane
            node = $('<div>').addClass('io-ox-pane top toolpane'),

            // the top-level tab bar to select tool bars
            tabBar = new ToolBar(appWindow),

            // the tab buttons to select the tool bars
            radioGroup = tabBar.addRadioGroup(key),

            // all registered tool bars, mapped by tool bar key
            toolBars = {},

            // identifiers of all registered tool bars, in registration order
            toolBarIds = [],

            // identifier of the tool bar currently visible
            visibleToolBarId = '';

        // private methods ----------------------------------------------------

        /**
         * Activates the tool bar with the specified identifier.
         */
        function showToolBar(id) {
            if (id in toolBars) {
                if (visibleToolBarId in toolBars) {
                    toolBars[visibleToolBarId].hide();
                }
                visibleToolBarId = id;
                toolBars[id].show();
            }
        }

        /**
         * Handles keyboard events in the tool pane.
         */
        function toolPaneKeyHandler(event) {

            var // distinguish between event types (ignore keypress events)
                keydown = event.type === 'keydown',
                // index of the visible tool bar
                index = _(toolBarIds).indexOf(visibleToolBarId);

            if (event.keyCode === KeyCodes.F7) {
                if (keydown) {
                    index = event.shiftKey ? (index - 1) : (index + 1);
                    index = Math.min(Math.max(index, 0), toolBarIds.length - 1);
                    self.showToolBar(toolBarIds[index]);
                    self.grabFocus();
                }
                return false;
            }
        }

        // methods ------------------------------------------------------------

        /**
         * Returns the root element containing this tool pane as jQuery object.
         */
        this.getNode = function () {
            return node;
        };

        /**
         * Creates a new tool bar object and registers it at the tab bar.
         *
         * @param {String} id
         *  The unique identifier of the new tool bar.
         *
         * @param {Object} [options]
         *  A map of options to control the properties of the new tab in the
         *  tab bar representing the tool bar. Supports all options for buttons
         *  in radio groups (see method RadioGroup.addButton() for details).
         *
         * @returns {ToolBar}
         *  The new tool bar object.
         */
        this.createToolBar = function (id, options) {

            var // create a new tool bar object, and store it in the map
                toolBar = toolBars[id] = new ToolBar(appWindow);

            // add a tool bar tab, add the tool bar to the pane, and register it at the controller
            toolBarIds.push(id);
            node.append(toolBar.getNode());
            radioGroup.addButton(id, options);
            controller.registerViewComponent(toolBar);
            if (toolBarIds.length > 1) {
                toolBar.hide();
            } else {
                visibleToolBarId = id;
            }

            return toolBar;
        };

        /**
         * Returns the identifier of the tool bar currently visible.
         */
        this.getVisibleToolBarId = function () {
            return visibleToolBarId;
        };

        /**
         * Activates the tool bar with the specified identifier.
         *
         * @param {String} id
         *  The identifier of the tool bar to be shown.
         *
         * @returns {ToolPane}
         *  A reference to this tool pane.
         */
        this.showToolBar = function (id) {
            controller.change(key, id);
            return this;
        };

        /**
         * Returns whether this tool pane contains the control that is
         * currently focused. Searches in the visible tool bar and in the tool
         * bar tabs.
         */
        this.hasFocus = function () {
            return tabBar.hasFocus() || ((visibleToolBarId in toolBars) && toolBars[visibleToolBarId].hasFocus());
        };

        /**
         * Sets the focus to the visible tool bar.
         */
        this.grabFocus = function () {
            if (visibleToolBarId in toolBars) {
                toolBars[visibleToolBarId].grabFocus();
            }
            return this;
        };

        /**
         * Triggers a 'refresh' event at all registered tool bars.
         */
        this.refresh = function () {
            _(toolBars).invoke('trigger', 'refresh');
        };

        this.destroy = function () {
            tabBar.destroy();
            _(toolBars).invoke('destroy');
            tabBar = radioGroup = toolBars = null;
        };

        // initialization -----------------------------------------------------

        // insert the tool bar selector and a separator line into the tool pane
        tabBar.getNode().addClass('tabs').appendTo(appWindow.nodes.head);

        // prepare the controller
        controller
            // add item definition for the tab bar
            .addDefinition(key, { get: function () { return visibleToolBarId; }, set: showToolBar })
            // register the tab bar at the controller
            .registerViewComponent(tabBar);

        // change visible tool bar with keyboard
        node.on('keydown keypress keyup', toolPaneKeyHandler);

    } // class ToolPane

    // exports ================================================================

    return ToolPane;

});
