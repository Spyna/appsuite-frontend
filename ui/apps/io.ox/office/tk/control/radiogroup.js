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

define('io.ox/office/tk/control/radiogroup',
    ['io.ox/office/tk/utils',
     'io.ox/office/tk/control/group',
     'io.ox/office/tk/dropdown/list'
    ], function (Utils, Group, List) {

    'use strict';

    // class RadioGroup =======================================================

    /**
     * Creates a container element used to hold a set of radio buttons.
     *
     * @constructor
     *
     * @extends Group
     * @extends List
     *
     * @param {Object} [options]
     *  A map of options to control the properties of the drop-down button and
     *  menu. Supports all options of the Group base class, and of the List
     *  mix-in class. Additionally, the following options are supported:
     *  @param {String} [options.dropDown=false]
     *      If set to true, a drop-down button will be created, showing a list
     *      with all option buttons when opened. Otherwise, the option buttons
     *      will be inserted directly into this group.
     *  @param {String} [options.updateCaptionMode='all']
     *      Specifies how to update the caption of the drop-down button when a
     *      list item in the drop-down menu has been activated. If set to
     *      'label', only the label text of the list item will be copied. If
     *      set to 'icon', only the icon will be copied. If set to 'none',
     *      nothing will be copied. By default, icon and label of the list item
     *      will be copied.
     *  @param {Function} [options.updateCaptionHandler]
     *      A function that will be called after list item has been activated,
     *      and the caption of the drop-down button has been updated according
     *      to the 'options.updateCaptionMode' option. Receives the button
     *      element of the activated list item (as jQuery object) in the first
     *      parameter. If no list item is active, the parameter will be an
     *      empty jQuery object. Will be called in the context of this radio
     *      group instance.
     */
    function RadioGroup(options) {

        var // self reference
            self = this,

            // which parts of a list item caption will be copied to the menu button
            updateCaptionMode = Utils.getStringOption(options, 'updateCaptionMode', 'all'),

            // custom update handler for the caption of the menu button
            updateCaptionHandler = Utils.getFunctionOption(options, 'updateCaptionHandler');

        // private methods ----------------------------------------------------

        /**
         * Returns all option buttons as jQuery collection.
         */
        function getOptionButtons() {
            return self.hasDropDown ? self.getListItems() : self.getNode().children('button');
        }

        /**
         * Handles events after the group has been enabled or disabled. Enables
         * or disables the Bootstrap tool tips attached to the option buttons.
         */
        function enableHandler(event, enabled) {
            getOptionButtons().tooltip(enabled ? 'enable' : 'disable');
        }

        /**
         * Activates an option button in this radio group.
         *
         * @param value
         *  The value associated to the button to be activated. If set to null,
         *  does not activate any button (ambiguous state).
         */
        function updateHandler(value) {

            var // activate a radio button
                button = Utils.selectOptionButton(getOptionButtons(), value),
                // the options used to set the caption of the drop-down menu button
                captionOptions = options;

            if (self.hasDropDown) {

                // update the caption of the drop-down menu button
                if (updateCaptionMode !== 'none') {
                    if (button.length) {
                        if (updateCaptionMode !== 'label') {
                            captionOptions = Utils.extendOptions(captionOptions, { icon: Utils.getControlIcon(button) });
                        }
                        if (updateCaptionMode !== 'icon') {
                            captionOptions = Utils.extendOptions(captionOptions, { label: Utils.getControlLabel(button) });
                        }
                    }
                    Utils.setControlCaption(self.getMenuButton(), captionOptions);
                }

                // call custom update handler
                if (_.isFunction(updateCaptionHandler)) {
                    updateCaptionHandler.call(self, button);
                }
            }
        }

        /**
         * Click handler for an option button in this radio group. Will
         * activate the clicked button, and return its value.
         *
         * @param {jQuery} button
         *  The clicked button, as jQuery object.
         *
         * @returns
         *  The button value that has been passed to the addButton() method.
         */
        function clickHandler(button) {
            var value = Utils.getControlValue(button);
            updateHandler(value);
            return value;
        }

        // base constructor ---------------------------------------------------

        Group.call(this, options);
        // add drop-down list if specified
        if (Utils.getBooleanOption(options, 'dropDown')) {
            List.call(this, options);
        }

        // methods ------------------------------------------------------------

        /**
         * Removes all option buttons from this control.
         */
        this.clearOptionButtons = function () {
            if (this.hasDropDown) {
                this.clearListItems();
            } else {
                getOptionButtons().remove();
            }
        };

        /**
         * Adds a new option button to this radio group.
         *
         * @param value
         *  The unique value associated to the button. Must not be null or
         *  undefined.
         *
         * @param {Object} [options]
         *  A map of options to control the properties of the new button.
         *  Supports all generic formatting options for buttons (See method
         *  Utils.createButton() for details), except 'options.value' which
         *  will be set to the 'value' parameter passed to this function.
         *  Additionally, the following options are supported:
         *  @param {String} [options.tooltip]
         *      Tool tip text shown when the mouse hovers the button.
         *
         * @returns {jQuery}
         *  The new option button, as jQuery object.
         */
        this.createOptionButton = function (value, options) {

            var // options for the new button, including the passed value
                buttonOptions = Utils.extendOptions(options, { value: value }),
                // the new button
                button = null;

            // insert the button depending on the drop-down mode
            if (this.hasDropDown) {
                button = this.createListItem(buttonOptions);
            } else {
                button = Utils.createButton(buttonOptions);
                this.addFocusableControl(button);
            }

            // add tool tip
            Utils.setControlTooltip(button, Utils.getStringOption(options, 'tooltip'), 'bottom');

            return button;
        };

        // initialization -----------------------------------------------------

        // register event handlers
        this.on('enable', enableHandler)
            .registerUpdateHandler(updateHandler)
            .registerActionHandler(this.hasDropDown ? this.getMenuNode() : this.getNode(), 'click', 'button', clickHandler);

    } // class RadioGroup

    // exports ================================================================

    // derive this class from class Group
    return Group.extend({ constructor: RadioGroup });

});
