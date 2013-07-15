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

define('io.ox/office/tk/control/textfield',
    ['io.ox/office/tk/utils',
     'io.ox/office/tk/keycodes',
     'io.ox/office/tk/control/group'
    ], function (Utils, KeyCodes, Group) {

    'use strict';

    var // default validator without any restrictions on the field text
        defaultValidator = null;

    // class TextField ========================================================

    /**
     * Creates a container element used to hold a text input field.
     *
     * @constructor
     *
     * @extends Group
     *
     * @param {Object} [options]
     *  A map of options to control the properties of the text field. Supports
     *  all options of the Group base class, generic caption options (see
     *  Utils.setControlCaption() for details), and all generic formatting
     *  options of input fields (see method Utils.createTextField() for
     *  details). Additionally, the following options are supported:
     *  @param {Boolean} [options.readOnly=false]
     *      If set to true, the text in the text field cannot be edited.
     *  @param {Boolean} [options.select=false]
     *      If set to true, the entire text will be selected after the text
     *      field has been clicked. Note that the text will always be selected
     *      independent from this option, if the text field gets focus via
     *      keyboard navigation.
     *  @param {TextField.Validator} [options.validator]
     *      A text validator that will be used to convert the values from
     *      'update' events to the text representation used in this text field,
     *      to validate the text while typing in the text field, and to convert
     *      the entered text to the value returned by the action handler. If no
     *      validator has been specified, a default validator will be used that
     *      does not perform any conversions.
     */
    function TextField(options) {

        var // self reference
            self = this,

            // create the label node for the caption
            captionLabel = Utils.createLabel(),

            // create the input field control
            fieldNode = Utils.createTextField(options),

            // read-only mode
            readOnly = null,

            // whether to select the entire text on click
            select = Utils.getBooleanOption(options, 'select', false),

            // the validator used to convert and validate values
            validator = Utils.getObjectOption(options, 'validator', defaultValidator),

            // saved state of the text field, used to restore while validating
            validationFieldState = null,

            // initial value of text field when focused, needed for ESCAPE key handling
            initialText = null;

        // base constructor ---------------------------------------------------

        Group.call(this, options);

        // private methods ----------------------------------------------------

        /**
         * Returns the current value and selection of the text field.
         */
        function getFieldState() {
            var state = Utils.getTextFieldSelection(fieldNode);
            state.value = fieldNode.val();
            return state;
        }

        /**
         * Restores the current value and selection of the text field.
         */
        function restoreFieldState(state) {
            fieldNode.val(state.value);
            Utils.setTextFieldSelection(fieldNode, state.start, state.end);
        }

        /**
         * The update handler for this text field.
         */
        function updateHandler(value) {
            fieldNode.val((_.isUndefined(value) || _.isNull(value)) ? '' : validator.valueToText(value));
            validationFieldState = getFieldState();
        }

        /**
         * Returns the current value associated to the text field.
         */
        function resolveValueHandler() {
            var value = readOnly ? null : self.getFieldValue();
            if (!_.isUndefined(value) && !_.isNull(value)) {
                initialText = null;
            }
            return value;
        }

        /**
         * Handles all focus events of the text field.
         */
        function fieldFocusHandler(event) {
            switch (event.type) {
            case 'focus':
                // save current value
                if (!_.isString(initialText)) {
                    initialText = fieldNode.val();
                }
                // select entire text on mouse click when specified via option
                if (select) { fieldNode.select().one('mouseup', false); }
                validationFieldState = getFieldState();
                break;
            case 'focus:key':
                // always select entire text when reaching the field with keyboard
                fieldNode.select().off('mouseup');
                validationFieldState = getFieldState();
                break;
            case 'blur':
                fieldNode.off('mouseup');
                Utils.setTextFieldSelection(fieldNode, 0);
                // Bug 27175: always commit value when losing focus
                if (initialText !== fieldNode.val()) {
                    self.triggerChange(fieldNode, { preserveFocus: true });
                }
                // restore saved value
                if (_.isString(initialText)) {
                    fieldNode.val(initialText);
                    initialText = null;
                }
                break;
            }
        }

        /**
         * Handles keyboard events, especially the cursor keys.
         */
        function fieldKeyHandler(event) {
            if (event.keyCode === KeyCodes.ENTER) {
                if (event.type === 'keyup') { self.triggerChange(fieldNode); }
                return false;
            }
        }

        /**
         * Handles input events triggered when the text changes while typing.
         * Performs live validation with the current validator.
         */
        function fieldInputHandler() {

            var // result of the text field validation
                result = null;

            // do not perform validation if nothing has changed
            if (!_.isEqual(validationFieldState, getFieldState())) {

                // validate the current field text
                result = validator.validate(fieldNode.val());

                // update the text field according to the validation result
                if (result === false) {
                    // false: restore the old field state stored in validationFieldState
                    restoreFieldState(validationFieldState);
                } else if (_.isString(result) && (result !== fieldNode.val())) {
                    // insert the validation result and restore the old selection
                    restoreFieldState(Utils.extendOptions(validationFieldState, { value: result }));
                }

                // trigger 'validated' event to all listeners, pass old field state
                self.trigger('validated', validationFieldState);

                // save current state of the text field
                validationFieldState = getFieldState();
            }
        }

        // methods ------------------------------------------------------------

        /**
         * Returns the text control element, as jQuery object.
         */
        this.getTextFieldNode = function () {
            return fieldNode;
        };

        /**
         * Returns the value represented by the text in the text control.
         */
        this.getFieldValue = function () {
            return validator.textToValue(fieldNode.val());
        };

        /**
         * Returns whether the text field is in read-only mode.
         */
        this.isReadOnly = function () {
            return readOnly;
        };

        /**
         * Enters or leaves the read-only mode.
         *
         * @param {Boolean} [state]
         *  If omitted or set to true, the text field will be set to read-only
         *  mode. Otherwise, the text field will be made editable.
         *
         * @returns {TextField}
         *  A reference to this instance.
         */
        this.setReadOnly = function (state) {

            // validate the new read-only state
            state = _.isUndefined(state) || (state === true);

            if (readOnly !== state) {
                // initialize the text field
                if ((readOnly = state)) {
                    fieldNode
                        .addClass('readonly')
                        .removeClass(Utils.FOCUSABLE_CLASS)
                        .on('mousedown dragover drop contextmenu', function (event) {
                            event.preventDefault();
                            self.trigger('cancel');
                        });
                } else {
                    fieldNode
                        .removeClass('readonly')
                        .addClass(Utils.FOCUSABLE_CLASS)
                        .off('mousedown dragover drop contextmenu');
                }
                // trigger listeners
                this.trigger('readonly', readOnly);
            }
            return this;
        };

        /**
         * Converts the passed value to a text using the current validator.
         */
        this.valueToText = function (value) {
            return validator.valueToText(value);
        };

        /**
         * Converts the passed text to a value using the current validator.
         */
        this.textToValue = function (text) {
            return validator.textToValue(text);
        };

        // initialization -----------------------------------------------------

        // add special marker class used to adjust formatting
        this.getNode().addClass('text-field');

        // first, insert the caption nodes
        Utils.setControlCaption(captionLabel, options);
        if (captionLabel.children().length > 0) {
            this.addChildNodes(captionLabel);
        }

        // insert the text field into this group, and register event handlers
        this.addFocusableControl(fieldNode)
            .registerUpdateHandler(updateHandler)
            .registerChangeHandler(null, { node: fieldNode, valueResolver: resolveValueHandler });

        fieldNode
            .on('focus focus:key blur:key blur', fieldFocusHandler)
            .on('keydown keypress keyup', fieldKeyHandler)
            // Validation while typing. IE9 does not trigger 'input' when deleting
            // characters, use key events as a workaround. This is still not perfect,
            // as it misses cut/delete from context menu, drag&drop, etc.
            .on('input keydown keyup', fieldInputHandler);

        // initialize read-only mode
        this.setReadOnly(Utils.getBooleanOption(options, 'readOnly', false));

    } // class TextField

    // class TextField.Validator ==============================================

    /**
     * Base class for text field validators used to convert between values and
     * field texts, and to validate the text field while editing. Provides a
     * default implementation of all methods that do not restrict editing.
     *
     * @constructor
     */
    TextField.Validator = _.makeExtendable(function () {

        // methods ------------------------------------------------------------

        /**
         * Converts the passed value to a text string to be inserted into a
         * text field. Intended to be overwritten by derived classes. This
         * default implementation returns the passed value, if it is a string,
         * otherwise an empty string.
         *
         * @param {Any} value
         *  The value to be converted to a text.
         *
         * @returns {String}
         *  The text converted from the passed value, or an empty string, if
         *  the passed value cannot be converted to text.
         *
         */
        this.valueToText = function (value) {
            return _.isString(value) ? value : '';
        };

        /**
         * Converts the passed text to a value that will be passed to all event
         * listeners of a text field. Intended to be overwritten by derived
         * classes. This default implementation returns the unmodified text.
         *
         * @param {String} text
         *  The text to be converted to a value.
         *
         * @returns {Any}
         *  The value converted from the passed text. The value null indicates
         *  that the text cannot be converted to a valid value.
         */
        this.textToValue = function (text) {
            return text;
        };

        /**
         * Validates the passed text that has been changed while editing a text
         * field. It is possible to return a new string value that will be
         * inserted into the text field, or a boolean value indicating whether
         * to restore the old state of the text field. Intended to be
         * overwritten by derived classes. This default implementation does not
         * change the text field.
         *
         * @param {String} text
         *  The current contents of the text field to be validated.
         *
         * @returns {String|Boolean}
         *  When returning a string, the text field will be updated to contain
         *  the returned value while restoring its selection (browsers may
         *  destroy the selection when changing the text). When returning the
         *  boolean value false, the previous state of the text field (as it
         *  was after the last validation) will be restored. Otherwise, the
         *  value of the text field is considered to be valid and will not be
         *  modified.
         */
        this.validate = function (text) {
        };

    }); // class TextField.Validator

    // global instance of the default validator
    defaultValidator = new TextField.Validator();

    // class TextField.TextValidator ==========================================

    /**
     * A validator for text fields that restricts the allowed values according
     * to the passed options.
     *
     * @constructor
     *
     * @extends TextField.Validator
     *
     * @param {Object} [options]
     *  A map of options to control the properties of the text validator. The
     *  following options are supported:
     *  @param {Number} [options.maxLength=0x7FFFFFFF]
     *      The maximum number of characters to be inserted into the text
     *      field. All attempts to insert more characters will be rejected.
     */
    TextField.TextValidator = TextField.Validator.extend({ constructor: function (options) {

        var // maximum length
            maxLength = Utils.getIntegerOption(options, 'maxLength', 0x7FFFFFFF, 0, 0x7FFFFFFF);

        // base constructor ---------------------------------------------------

        TextField.Validator.call(this);

        // methods ------------------------------------------------------------

        this.valueToText = function (value) {
            return _.isString(value) ? value.substr(0, maxLength) : '';
        };

        this.validate = function (text) {
            return text.length <= maxLength;
        };

    }}); // class TextField.TextValidator

    // class TextField.NumberValidator ========================================

    /**
     * A validator for text fields that restricts the allowed values to
     * floating-point numbers.
     *
     * @constructor
     *
     * @extends TextField.Validator
     *
     * @param {Object} [options]
     *  A map of options to control the properties of the validator. The
     *  following options are supported:
     *  @param {Number} [options.min]
     *      The minimum value allowed to enter. If omitted, defaults to
     *      -Number.MAX_VALUE.
     *  @param {Number} [options.max]
     *      The maximum value allowed to enter. If omitted, defaults to
     *      Number.MAX_VALUE.
     *  @param {Number} [options.digits=2]
     *      The number of digits after the decimal point. If omitted, defaults
     *      to 2.
     */
    TextField.NumberValidator = TextField.Validator.extend({ constructor: function (options) {

        var // minimum and maximum
            min = Utils.getNumberOption(options, 'min', -Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE),
            max = Utils.getNumberOption(options, 'max', Number.MAX_VALUE, min, Number.MAX_VALUE),
            digits = Utils.getIntegerOption(options, 'digits', 2, 0, 10),
            regex = new RegExp('^' + ((min < 0) ? '-?' : '') + '[0-9]*' + ((digits > 0) ? '([.,][0-9]*)?' : '') + '$');

        // base constructor ---------------------------------------------------

        TextField.Validator.call(this);

        // methods ------------------------------------------------------------

        this.valueToText = function (value) {
            // TODO L10N of decimal separator
            return _.isFinite(value) ? String(Utils.roundDigits(value, digits)) : '';
        };

        this.textToValue = function (text) {
            var value = parseFloat(text.replace(/,/g, '.'));
            return (_.isFinite(value) && (min <= value) && (value <= max)) ? Utils.roundDigits(value, digits) : null;
        };

        this.validate = function (text) {
            return regex.test(text);
        };

    }}); // class TextField.NumberValidator

    // exports ================================================================

    // derive this class from class Group
    return Group.extend({ constructor: TextField });

});
