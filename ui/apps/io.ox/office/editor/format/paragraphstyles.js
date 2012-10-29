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

define('io.ox/office/editor/format/paragraphstyles',
    ['io.ox/office/tk/utils',
     'io.ox/office/editor/dom',
     'io.ox/office/editor/format/lineheight',
     'io.ox/office/editor/format/stylesheets',
     'io.ox/office/editor/format/color'
    ], function (Utils, DOM, LineHeight, StyleSheets, Color) {

    'use strict';

    var // definitions for paragraph attributes
        DEFINITIONS = {

            alignment: {
                def: 'left',
                set: function (element, value) {
                    element.css('text-align', value);
                },
                preview: function (options, value) {
                    options.css.textAlign = value;
                }
            },

            fillcolor: {
                def: Color.AUTO, // auto for paragraph fill resolves to 'transparent'
                set: function (element, color) {
                    element.css('background-color', this.getCssColor(color, 'fill'));
                }
            },

            /**
             * Line height relative to font settings. The CSS attribute
             * 'line-height' must be set separately at every descendant text
             * span because a relative line height (e.g. 200%) would not be
             * derived from the paragraph relatively to the spans, but
             * absolutely according to the paragraph's font size. Example: The
             * paragraph has a font size of 12pt and a line-height of 200%,
             * resulting in 24pt. This value will be derived absolutely to a
             * span with a font size of 6pt, resulting in a relative line
             * height of 24pt/6pt = 400% instead of the expected 200%.
             */
            lineheight: { def: LineHeight.SINGLE },

            ilvl: { def: -1 },

            numId: { def: -1 },

            outlinelvl: { def: 9 },

            tabstops: { def: [] }

        };

    // global private functions ===============================================

    /**
     * Will be called for every paragraph whose character attributes have been
     * changed.
     *
     * @param {jQuery} paragraph
     *  The paragraph node whose attributes have been changed, as jQuery
     *  object.
     *
     * @param {Object} attributes
     *  A map of all attributes (name/value pairs), containing the
     *  effective attribute values merged from style sheets and explicit
     *  attributes.
     */
    function updateParagraphFormatting(paragraph, attributes) {

        var // the character styles/formatter
            characterStyles = this.getDocumentStyles().getStyleSheets('character');

        // Always update character formatting of all child nodes which may
        // depend on paragraph settings, e.g. automatic text color which
        // depends on the paragraph fill color.
        return Utils.iterateDescendantNodes(paragraph, function (node) {
            characterStyles.updateElementFormatting(node);
        }, undefined, { children: true });
    }

    // class ParagraphStyles ==================================================

    /**
     * Contains the style sheets for paragraph formatting attributes. The CSS
     * formatting will be read from and written to paragraph <p> elements.
     *
     * @constructor
     *
     * @extends StyleSheets
     *
     * @param {HTMLElement|jQuery} rootNode
     *  The root node containing all elements formatted by the style sheets of
     *  this container. If this object is a jQuery collection, uses the first
     *  node it contains.
     *
     * @param {DocumentStyles} documentStyles
     *  Collection with the style containers of all style families.
     */
    function ParagraphStyles(rootNode, documentStyles) {

        // base constructor ---------------------------------------------------

        StyleSheets.call(this, documentStyles, 'paragraph', DOM.PARAGRAPH_NODE_SELECTOR, DEFINITIONS);

        // methods ------------------------------------------------------------

        /**
         * Iterates over all paragraph elements covered by the passed DOM
         * ranges for read-only access and calls the passed iterator function.
         */
        this.iterateReadOnly = function (ranges, iterator, context) {
            // DOM.iterateAncestorNodesInRanges() passes the current element to
            // the passed iterator function exactly as expected
            return DOM.iterateAncestorNodesInRanges(ranges, rootNode, DOM.PARAGRAPH_NODE_SELECTOR, iterator, context);
        };

        // initialization -----------------------------------------------------

        this.registerUpdateHandler(updateParagraphFormatting);

    } // class ParagraphStyles

    // exports ================================================================

    // derive this class from class StyleSheets
    return StyleSheets.extend({ constructor: ParagraphStyles });

});
