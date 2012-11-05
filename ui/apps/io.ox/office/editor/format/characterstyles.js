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

define('io.ox/office/editor/format/characterstyles',
    ['io.ox/office/tk/utils',
     'io.ox/office/tk/fonts',
     'io.ox/office/editor/dom',
     'io.ox/office/editor/format/lineheight',
     'io.ox/office/editor/format/stylesheets',
     'io.ox/office/editor/format/color'
    ], function (Utils, Fonts, DOM, LineHeight, StyleSheets, Color) {

    'use strict';

    var // definitions for character attributes
        DEFINITIONS = {

            fontname: {
                def: 'sans-serif',
                format: function (element, fontName) {
                    element.css('font-family', Fonts.getCssFontFamily(fontName));
                },
                preview: function (options, fontName) {
                    options.labelCss.fontFamily = Fonts.getCssFontFamily(fontName);
                }
            },

            fontsize: {
                def: 12,
                format: function (element, fontSize) {
                    element.css('font-size', fontSize + 'pt');
                },
                preview: function (options, fontSize) {
                    options.labelCss.fontSize = Utils.minMax(fontSize, 8, 24) + 'pt';
                }
            },

            bold: {
                def: false,
                format: function (element, state) {
                    element.css('font-weight', state ? 'bold' : 'normal');
                },
                preview: function (options, state) {
                    options.labelCss.fontWeight = state ? 'bold' : 'normal';
                }
            },

            italic: {
                def: false,
                format: function (element, state) {
                    element.css('font-style', state ? 'italic' : 'normal');
                },
                preview: function (options, state) {
                    options.labelCss.fontStyle = state ? 'italic' : 'normal';
                }
            },

            underline: {
                def: false,
                format: function (element, state) {
                    var value = element.css('text-decoration');
                    element.css('text-decoration', Utils.toggleToken(value, 'underline', state, 'none'));
                },
                preview: function (options, state) {
                    var value = options.labelCss.textDecoration || '';
                    options.labelCss.textDecoration = Utils.toggleToken(value, 'underline', state, 'none');
                }
            },

            color: {
                def: Color.AUTO,
                // color will be set in update handler, depending on fill colors
                preview: function (options, color) {
                    options.labelCss.color = this.getCssColor(color, 'text');
                }
            },

            fillcolor: {
                def: Color.AUTO,
                format: function (element, color) {
                    element.css('background-color', this.getCssColor(color, 'fill'));
                }
            },

            // special attributes

            highlight: {
                def: false,
                format: function (element, state) {
                    element.toggleClass('highlight', state);
                },
                special: true
            }

        };

    // class CharacterStyles ==================================================

    /**
     * Contains the style sheets for character formatting attributes. The CSS
     * formatting will be written to text span elements contained somewhere in
     * the paragraph elements.
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
    function CharacterStyles(rootNode, documentStyles) {

        var // self reference
            self = this;

        // private methods ----------------------------------------------------

        /**
         * Will be called for every text span whose character attributes have
         * been changed.
         *
         * @param {jQuery} node
         *  The text span whose character attributes have been changed, as
         *  jQuery object.
         *
         * @param {Object} attributes
         *  A map of all attributes (name/value pairs), containing the
         *  effective attribute values merged from style sheets and explicit
         *  attributes.
         */
        function updateCharacterFormatting(textSpan, attributes) {

            var // the parent paragraph of the node (may be a grandparent)
                paragraph = $(textSpan).closest(DOM.PARAGRAPH_NODE_SELECTOR),
                // the current theme
                theme = self.getDocumentStyles().getCurrentTheme(),
                // the paragraph style container
                paragraphStyles = self.getDocumentStyles().getStyleSheets('paragraph'),
                // the merged attributes of the paragraph
                paragraphAttributes = paragraphStyles.getElementAttributes(paragraph);

            // calculate text color (automatic color depends on fill colors)
            Color.setElementTextColor(textSpan, theme, attributes, paragraphAttributes);

            // update calculated line height due to changed font settings
            LineHeight.updateElementLineHeight(textSpan, paragraphAttributes.lineheight);

            var listLabel = $(paragraph).children(DOM.LIST_LABEL_NODE_SELECTOR);
            if (listLabel.length) {
                listLabel.children('span').css('font-size', attributes.fontsize + 'pt');
            }
        }

        // base constructor ---------------------------------------------------

        StyleSheets.call(this, documentStyles, 'character', DEFINITIONS);

        // initialization -----------------------------------------------------

        this.registerUpdateHandler(updateCharacterFormatting);
        this.registerParentStyleFamily('paragraph', function (span) { return span.closest(DOM.PARAGRAPH_NODE_SELECTOR); });

    } // class CharacterStyles

    // static methods ---------------------------------------------------------

    /**
     * Tries to merge the passed text span with its next or previous sibling
     * text span. To be able to merge two text spans, they must contain equal
     * formatting attributes. If merging was successful, the sibling span will
     * be removed from the DOM.
     *
     * @param {HTMLElement|jQuery} node
     *  The DOM node to be merged with its sibling text span. If this object is
     *  a jQuery object, uses the first DOM node it contains.
     *
     * @param {Boolean} next
     *  If set to true, will try to merge with the next span, otherwise with
     *  the previous text span.
     */
    CharacterStyles.mergeSiblingTextSpans = function (node, next) {

        var // the sibling text span, depending on the passed direction
            sibling = null,
            // text in the passed and in the sibling node
            text = null, siblingText = null;

        // passed node and sibling node, as DOM nodes
        node = Utils.getDomNode(node);
        sibling = node[next ? 'nextSibling' : 'previousSibling'];

        // both nodes must be text spans with the same attributes
        if (DOM.isTextSpan(node) && DOM.isTextSpan(sibling) && StyleSheets.hasEqualElementAttributes(node, sibling)) {

            // add text of the sibling text node to the passed text node
            text = node.firstChild.nodeValue;
            siblingText = sibling.firstChild.nodeValue;
            node.firstChild.nodeValue = next ? (text + siblingText) : (siblingText + text);

            // remove the entire sibling span element
            $(sibling).remove();
        }
    };

    // exports ================================================================

    // derive this class from class StyleSheets
    return StyleSheets.extend({ constructor: CharacterStyles });

});
