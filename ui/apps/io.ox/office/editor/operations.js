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
 * @author Ingo Schmidt-Rosbiegal <ingo.schmidt-rosbiegal@open-xchange.com>
 * @author Daniel Rentz <daniel.rentz@open-xchange.com>
 */

define('io.ox/office/editor/operations',
    ['io.ox/office/tk/utils',
     'io.ox/office/editor/dom',
     'io.ox/office/editor/format/stylesheets'
    ], function (Utils, DOM, StyleSheets) {

    'use strict';

    var // the exported module (forward declaration to suppress warnings in private functions)
        Operations = null;

    // private global functions ===============================================

    /**
     * Creates a clone of the passed logical position and appends the index 0.
     * The passed array object will not be changed.
     *
     * @param {Number[]} position
     *  The initial logical position.
     *
     * @returns {Number[]}
     *  A clone of the passed logical position, with the index 0 appended.
     */
    function appendNewIndex(position) {
        position = _.clone(position);
        position.push(0);
        return position;
    }

    /**
     * Creates a clone of the passed logical position and increases the last
     * element of the array by the specified offset. The passed array object
     * will not be changed.
     *
     * @param {Number[]} position
     *  The initial logical position.
     *
     * @param {Number} [offset=1]
     *  The offset that will be added to the last index of the position.
     *
     * @returns {Number[]}
     *  A clone of the passed logical position, with the last index increased.
     */
    function increaseLastIndex(position, offset) {
        position = _.clone(position);
        position[position.length - 1] += (_.isNumber(offset) ? offset : 1);
        return position;
    }

    // static class Operations ================================================

    /**
     * Defines the names of all supported operations and static helper
     * functions to generate operations from DOM structures and selections.
     */
    var Operations = {

        INIT_DOCUMENT: 'initDocument',

        DELETE: 'delete',
        MOVE: 'move',

        TEXT_INSERT: 'insertText',
        TEXT_DELETE: 'deleteText',

        PARA_INSERT: 'insertParagraph',
        PARA_DELETE: 'deleteParagraph',
        PARA_SPLIT: 'splitParagraph',
        PARA_MERGE: 'mergeParagraph',

        TABLE_INSERT: 'insertTable',
        TABLE_DELETE: 'deleteTable',
        CELLRANGE_DELETE: 'deleteCellRange',
        ROWS_DELETE: 'deleteRows',
        COLUMNS_DELETE: 'deleteColumns',
        CELLS_DELETE: 'deleteCells',
        ROW_INSERT: 'insertRow',
        COLUMN_INSERT: 'insertColumn',
        CELL_INSERT: 'insertCell',
        CELL_SPLIT: 'splitCell',
        CELL_MERGE: 'mergeCell',

        INSERT_STYLE: 'insertStylesheet',
        INSERT_THEME: 'insertTheme',
        INSERT_LIST: 'insertList',
        ATTRS_SET: 'setAttributes',

        IMAGE_INSERT: 'insertImage',
        FIELD_INSERT: 'insertField'
        // ATTR_DELETE:  'deleteAttribute'

    };

    // class Operations.Generator =============================================

    /**
     * An instance of this class contains an operations array and provides
     * methods to generate operations for various element nodes.
     *
     * @constructor
     */
    Operations.Generator = function () {

        var // self reference
            self = this,
            // the operations buffer
            operations = [];

        // private methods ----------------------------------------------------

        /**
         * Creates and appends a new operation to the operations array.
         *
         * @param {String} name
         *  The name of the operation.
         *
         * @param {Object} [options]
         *  Additional options that will be stored in the operation.
         *
         * @returns {Object}
         *  Reference to the created operation, for later use.
         */
        function generateOperation(name, options) {
            var operation = _.extend({ name: name }, options);
            operations.push(operation);
            return operation;
        }

        /**
         * Creates and appends a new operation to the operations array. Adds
         * explicit attributes of the specified node to the 'attrs' option of
         * the operation.
         *
         * @param {HTMLElement|jQuery} node
         *  The element node that may contain explicit formatting attributes.
         *  If this object is a jQuery collection, uses the first node it
         *  contains.
         *
         * @param {String} name
         *  The name of the operation.
         *
         * @param {Object} [options]
         *  Additional options that will be stored in the operation.
         *
         * @returns {Object}
         *  Reference to the created operation, for later use.
         */
        function generateOperationWithAttributes(node, name, options) {

            var // explicit attributes of the passed node
                attributes = StyleSheets.getExplicitAttributes(node);

            // add the 'attrs' entry if there are attributes, and push the operation
            if (!_.isEmpty(attributes)) {
                options = _.extend({ attrs: attributes }, options);
            }

            return generateOperation(name, options);
        }

        /**
         * Generates the 'setAttributes' operation needed to set the explicit
         * formatting attributes of the passed element node. If the passed node
         * does not contain any explicit attributes, no operation will be
         * generated.
         *
         * @param {HTMLElement|jQuery} node
         *  The element node whose formatting attributes will be converted to
         *  an operation. If this object is a jQuery collection, uses the first
         *  node it contains.
         *
         * @param {Number[]} position
         *  The logical (start) position of the passed node.
         *
         * @param {Number[]} [endPosition]
         *  The logical end position of the passed node, if the node spans
         *  several logical components (e.g. a text portion).
         */
        function generateSetAttributesOperation(node, position, endPosition) {

            var // explicit attributes of the passed node
                attributes = StyleSheets.getExplicitAttributes(node),
                // the operation options
                options = null;

            // no attributes, no operation
            if (!_.isEmpty(attributes)) {
                options = { start: position, attrs: attributes };
                if (_.isArray(endPosition)) { options.end = endPosition; }
                generateOperation(Operations.ATTRS_SET, options);
            }
        }

        // methods ------------------------------------------------------------

        /**
         * Returns the array of operations that has been generated so far.
         */
        this.getOperations = function () {
            return operations;
        };

        /**
         * Generates all operations needed to recreate the passed paragraph.
         *
         * @param {HTMLParagraphElement|jQuery} paragraph
         *  The paragraph element whose contents will be converted to
         *  operations. If this object is a jQuery collection, uses the first
         *  node it contains.
         *
         * @param {Number[]} position
         *  The logical position of the passed paragraph node. The generated
         *  operations will contain positions starting with this address.
         *
         * @param {Boolean} [initialParagraph]
         *  If set to true, no 'insertParagraph' operation will be generated.
         *  The generated operations will assume that an empty paragraph
         *  element exists at the passed logical position.
         */
        this.generateParagraphOperations = function (paragraph, position, initialParagraph) {

            var // used to merge several text portions into the same operation
                lastOperation = null,
                // formatting ranges for text portions, must be applied after the contents
                attributeRanges = [];

            // operations to create the paragraph element and formatting
            if (initialParagraph !== true) {
                generateOperation(Operations.PARA_INSERT, { position: position });
            }
            generateSetAttributesOperation(paragraph, position);

            // process all spans in the paragraph and create operations
            position = appendNewIndex(position);
            Utils.iterateSelectedDescendantNodes(paragraph, 'span', function (span) {

                var // whether node is a regular text portion
                    isPortionSpan = DOM.isPortionSpan(span),
                    // text contents of a text span
                    text = isPortionSpan ? $(span).text() : '';

                // operation to create a (non-empty) generic text portion
                if (text.length > 0) {
                    // try to merge text portions into the last 'insertText' operation
                    if (lastOperation && (lastOperation.name === Operations.TEXT_INSERT)) {
                        lastOperation.text += text;
                    } else {
                        lastOperation = generateOperation(Operations.TEXT_INSERT, { start: position, text: text });
                    }
                    attributeRanges.push({ node: span, position: position, endPosition: (text.length > 1) ? increaseLastIndex(position, text.length - 1) : null });
                    position = increaseLastIndex(position, text.length);
                }

                // operation to create a text field
                // TODO: field type
                else if (DOM.isFieldSpan(span)) {
                    lastOperation = generateOperation(Operations.FIELD_INSERT, { position: position, representation: text });
                    attributeRanges.push({ node: span, position: position });
                    position = increaseLastIndex(position);
                }

                // operation to create an image (including its attributes)
                else if (DOM.isImageNode(span)) {
                    lastOperation = generateOperationWithAttributes(span, Operations.IMAGE_INSERT, { position: position, imgurl: $(span).data('url') });
                    position = increaseLastIndex(position);
                }

                // TODO: other objects
                else {
                    Utils.warn('Operations.Generator.generateParagraphOperations(): unknown span element');
                }

            }, this, { children: true });

            // Generate 'setAttribute' operations after all contents have been
            // created via 'insertText', 'insertField', etc. Otherwise, these
            // operations would clone the attributes of the last text portion
            // instead of creating a clean text node as expected in this case.
            _(attributeRanges).each(function (range) {
                generateSetAttributesOperation(range.node, range.position, range.endPosition);
            });
        };

        /**
         * Generates all operations needed to recreate the passed table cell.
         *
         * @param {HTMLTableCellElement|jQuery} cell
         *  The table cell element that will be converted to operations. If
         *  this object is a jQuery collection, uses the first node it
         *  contains.
         *
         * @param {Number[]} position
         *  The logical position of the passed table cell. The generated
         *  operations will contain positions starting with this address.
         */
        this.generateTableCellOperations = function (cell, position) {

            // operation to create the table cell element
            generateOperationWithAttributes(cell, Operations.CELL_INSERT, { position: position, count: 1 });

            // generate operations for the contents of the cell
            this.generateContentOperations(cell, position);
        };

        /**
         * Generates all operations needed to recreate the passed table row.
         *
         * @param {HTMLTableRowElement|jQuery} row
         *  The table row element that will be converted to operations. If this
         *  object is a jQuery collection, uses the first node it contains.
         *
         * @param {Number[]} position
         *  The logical position of the passed table row. The generated
         *  operations will contain positions starting with this address.
         */
        this.generateTableRowOperations = function (row, position) {

            // operation to create the table row element
            generateOperationWithAttributes(row, Operations.ROW_INSERT, { position: position, count: 1, insertdefaultcells: false });

            // generate operations for all cells
            position = appendNewIndex(position);
            $(row).children().each(function () {
                self.generateTableCellOperations(this, position);
                position = increaseLastIndex(position);
            });
        };

        /**
         * Generates all operations needed to recreate the passed table.
         *
         * @param {HTMLTableElement|jQuery} table
         *  The table element that will be converted to operations. If this object
         *  is a jQuery collection, uses the first node it contains.
         *
         * @param {Number[]} position
         *  The logical position of the passed table node. The generated operations
         *  will contain positions starting with this address.
         */
        this.generateTableOperations = function (table, position) {

            // operation to create the table element
            generateOperationWithAttributes(table, Operations.TABLE_INSERT, { position: position });

            // generate operations for all rows
            position = appendNewIndex(position);
            $(table).find('> * > tr').each(function () {
                self.generateTableRowOperations(this, position);
                position = increaseLastIndex(position);
            });
        };

        /**
         * Generates all operations needed to recreate the contents of the
         * passed root node. Root nodes are container elements for text
         * paragraphs and other first-level content nodes (e.g. tables).
         * Examples for root nodes are the entire document root node, table
         * cells, or text shapes. Note that the operation to create the root
         * node itself will NOT be generated.
         *
         * @param {HTMLElement|jQuery} node
         *  The element node containing the content nodes that will be
         *  converted to operations. If this object is a jQuery collection,
         *  uses the first node it contains.
         *
         * @param {Number[]} position
         *  The logical position of the passed node. The generated operations
         *  will contain positions starting with this address.
         */
        this.generateContentOperations = function (node, position) {

            var // all root elements will contain an empty paragraph after creation
                initialParagraph = true;

            // iterate all child elements of the root node and create operations
            position = appendNewIndex(position);
            Utils.iterateDescendantNodes(node, function (node) {

                if (DOM.isParagraphNode(node)) {
                    // operations to create a paragraph (first paragraph node exists in every root node)
                    this.generateParagraphOperations(node, position, initialParagraph);
                    initialParagraph = false;
                } else if ($(node).is('table')) {
                    // operations to create a table with its structure and contents
                    this.generateTableOperations(node, position);
                } else {
                    Utils.warn('Operations.Generator.generateContentOperations(): unexpected node "' + Utils.getNodeName(node) + '" at position ' + JSON.stringify(position) + '.');
                    // continue with next child node (do not increase position)
                    return;
                }

                // increase last element of the logical position (returns a clone)
                position = increaseLastIndex(position);

            }, this, { children: true });
        };

    }; // class Operations.Generator

    // exports ================================================================

    return Operations;

});
