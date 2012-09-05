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
     'io.ox/office/editor/format/stylesheets'
    ], function (Utils, DOM, LineHeight, StyleSheets) {

    'use strict';

    var // definitions for paragraph attributes
        definitions = {

            alignment: {
                def: 'left',
                set: function (element, value) {
                    element.css('text-align', value);
                },
                preview: function (options, value) {
                    options.css.textAlign = value;
                }
            },

            // Logically, the line height is a paragraph attribute. But technically
            // in CSS, the line height must be set separately at every span element
            // because a relative CSS line-height attribute at the paragraph (e.g.
            // 200%) will not be derived relatively to the spans, but absolutely
            // according to the paragraph's font size. Example: The paragraph has a
            // font size of 12pt and a line-height of 200%, resulting in 24pt. This
            // value will be derived absolutely to a span with a font size of 6pt,
            // resulting in a relative line height of 24pt/6pt = 400% instead of
            // the expected 200%.
            lineheight: {
                def: LineHeight.SINGLE,
                set: function (element, lineHeight) {
                    lineHeight = LineHeight.validateLineHeight(lineHeight);
                    element.children('span').each(function () {
                        LineHeight.setElementLineHeight($(this), lineHeight);
                    });
                }
            }

        };

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

        var // self reference
            self = this;

        // private methods ----------------------------------------------------

        /**
         * Iterates over all paragraph elements covered by the passed DOM
         * ranges and calls the passed iterator function.
         */
        function iterate(ranges, iterator, context) {
            return DOM.iterateAncestorNodesInRanges(ranges, rootNode, 'p', iterator, context);
        }

        // base constructor ---------------------------------------------------

        StyleSheets.call(this, 'paragraph', definitions, documentStyles, iterate, iterate, {
            descendantStyleFamilies: 'character'
        });

        // initialization -----------------------------------------------------

        // TODO: move these default styles to a 'newDocument' operation
        this.addStyleSheet('standard', 'Standard', null, { character: { fontname: 'Open Sans', fontsize: 11 } })
            .addStyleSheet('title', 'Title', 'standard', { paragraph: { alignment: 'center', lineheight: LineHeight.DOUBLE }, character: { fontname: 'Georgia', fontsize: 26, bold: true } })
            .addStyleSheet('subtitle', 'Subtitle', 'standard', { paragraph: { alignment: 'center', lineheight: LineHeight.ONE_HALF }, character: { fontname: 'Georgia', fontsize: 12, italic: true } })
            .addStyleSheet('heading1', 'Heading 1', 'standard', { character: { fontname: 'Georgia', fontsize: 16, bold: true } })
            .addStyleSheet('heading2', 'Heading 2', 'standard', { character: { fontname: 'Georgia', fontsize: 14, bold: true } })
            .addStyleSheet('heading3', 'Heading 3', 'standard', { character: { fontname: 'Georgia', fontsize: 13, bold: true } })
            .addStyleSheet('heading4', 'Heading 4', 'standard', { character: { fontname: 'Georgia', fontsize: 13, bold: true, italic: true } })
            .addStyleSheet('heading5', 'Heading 5', 'standard', { character: { fontname: 'Georgia', fontsize: 12, bold: true } })
            .addStyleSheet('heading6', 'Heading 6', 'standard', { character: { fontname: 'Georgia', fontsize: 12, bold: true, italic: true } });

    } // class ParagraphStyles

    // exports ================================================================

    // derive this class from class StyleSheets
    return StyleSheets.extend({ constructor: ParagraphStyles });

});
