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
 * @author Ingo Schmidt-Rosbiegal <ingo.schmidt-rosbiegal@open-xchange.com>
 */

define('io.ox/office/editor/format/drawingstyles',
    ['io.ox/office/tk/utils',
     'io.ox/office/editor/dom',
     'io.ox/office/editor/drawingResize',
     'io.ox/office/editor/format/stylesheets'
    ], function (Utils, DOM, DrawingResize, StyleSheets) {

    'use strict';

    var // definitions for common drawing attributes
        DEFINITIONS = {

            /**
             * Width of the drawing, as number in 1/100 of millimeters.
             */
            width: {
                def: 0,
                format: function (element, width) {
                    element.width(Utils.convertHmmToLength(width, 'px', 0));
                }
            },

            /**
             * Height of the drawing, as number in 1/100 of millimeters.
             */
            height: {
                def: 0,
                format: function (element, height) {
                    element.height(Utils.convertHmmToLength(height, 'px', 0));
                }
            },

            /**
             * Margin from top border of the drawing to text contents, in 1/100
             * of millimeters.
             */
            marginTop: { def: 0 },

            /**
             * Margin from bottom border of the drawing to text contents, in
             * 1/100 of millimeters.
             */
            marginBottom: { def: 0 },

            /**
             * Margin from left border of the drawing to text contents, in 1/100
             * of millimeters.
             */
            marginLeft: { def: 0 },

            /**
             * Margin from right border of the drawing to text contents, in
             * 1/100 of millimeters.
             */
            marginRight: { def: 0 },

            /**
             * If set to true, the drawing is rendered as inline element ('as
             * character'), otherwise it is anchored relative to another
             * element (page, paragraph, table cell, ...).
             */
            inline: { def: true },

            anchorHorBase: { def: 'margin' },

            anchorHorAlign: { def: 'left' },

            anchorHorOffset: { def: 0 },

            anchorVertBase: { def: 'margin' },

            anchorVertAlign: { def: 'top' },

            anchorVertOffset: { def: 0 },

            /**
             * Specifies how text floats around the drawing.
             * - 'none': Text does not float around the drawing.
             * - 'square': Text floats around the bounding box of the drawing.
             * - 'tight': Text aligns to the left/right outline of the drawing.
             * - 'through': Text aligns to the entire outline of the drawing.
             * - 'topAndBottom': Text floats above and below the drawing only.
             */
            textWrapMode: { def: 'none' },

            /**
             * Specifies on which side text floats around the drawing. Effective
             * only if the attribute 'textWrapMode' is either 'square',
             * 'tight', or 'through'.
             * - 'both': Text floats at the left and right side.
             * - 'left': Text floats at the left side of the drawing only.
             * - 'right': Text floats at the right side of the drawing only.
             * - 'largest': Text floats at the larger side of the drawing only.
             */
            textWrapSide: { def: 'both' },

            /**
             * Image Data. The string contains either base64 image data, or svg.
             * If base64 encoded image data is used, the string begins with "data:"
             * otherwise if svg is used it begins with "<svg"
             */
            replacementData: {
                def: '',
                scope: 'element'
            },

            // Image specific attributes

            /**
             * URL pointing to the image data. If the image was embedded in the
             * document archive, the URL will be relativ to the document (image specific style).
             */
            imageUrl: {
                def: '',
                scope: 'element'
            },

            /**
             * Image data (image specific style).
             */
            imageData: {
                def: '',
                scope: 'element'
            },

            /**
             * Amount of left part of the image cropped outside the object
             * border, in percent (image specific style).
             */
            cropLeft: { def: 0 },

            /**
             * Amount of right part of the image cropped outside the object
             * border, in percent (image specific style).
             */
            cropRight: { def: 0 },

            /**
             * Amount of top part of the image cropped outside the object
             * border, in percent (image specific style).
             */
            cropTop: { def: 0 },

            /**
             * Amount of bottom part of the image cropped outside the object
             * border, in percent (image specific style).
             */
            cropBottom: { def: 0 }

        },

        // predefined drawing attributes for floating modes used in GUI
        FLOAT_MODE_ATTRIBUTES = {
            inline:       { inline: true },
            leftFloated:  { inline: false, anchorHorBase: 'column', anchorHorAlign: 'left', textWrapMode: 'square', textWrapSide: 'right' },
            rightFloated: { inline: false, anchorHorBase: 'column', anchorHorAlign: 'right', textWrapMode: 'square', textWrapSide: 'left' },
            noneFloated:  { inline: false, anchorHorBase: 'column', anchorHorAlign: 'center', textWrapMode: 'none' }
        },

        // values for the 'textWrapMode' attribute allowing to wrap the text around the drawing
        WRAPPED_TEXT_VALUES = _(['square', 'tight', 'through']);

    // private global functions ===============================================

    /**
     * Returns whether the passed 'textWrapMode' attribute allows to wrap the
     * text around the drawing.
     */
    function isTextWrapped(textWrapMode) {
        return WRAPPED_TEXT_VALUES.contains(textWrapMode);
    }

    /**
     * Tries to find a preceding text span for the passed drawing. Leading
     * floating drawings in a paragraph do not have a preceding text span; in
     * this case, the first text span following the drawing will be returned.
     */
    function findRelatedTextSpan(drawing) {
        var span = null;

        // the closest preceding text span
        if (drawing[0].previousSibling) {
            span = Utils.findPreviousSiblingNode(drawing, function () { return DOM.isTextSpan(this); });
        }

        // no preceding span found: find following span
        if (!span) {
            span = Utils.findNextSiblingNode(drawing, function () { return DOM.isTextSpan(this); });
        }

        return span;
    }

    /**
     * Calculates the offset and size of the bitmap in an image object for one
     * dimension (either horizontally or vertically), according to the passed
     * cropping settings.
     *
     * @param {Number} objectSize
     *  With/height of the object node, in 1/100 of millimeters.
     *
     * @param {Number} leadingCrop
     *  The leading cropping value (left/top), in percent.
     *
     * @param {Number} trailingCrop
     *  The trailing cropping value (right/bottom), in percent.
     *
     * @returns {Object}
     *  An object containing 'offset' and 'size' CSS attributes specifying how
     *  to format the bitmap (in pixels with 'px' unit name).
     */
    function calculateBitmapSettings(objectSize, leadingCrop, trailingCrop) {

        var // sum of leading and trailing cropping (must not exceed a specific amount)
            totalCrop = leadingCrop + trailingCrop,
            // resulting settings for the bitmap
            size = 0, offset = 0;

        // do not crop more than 90% of the bitmap
        if (totalCrop > 90) {
            leadingCrop *= (90 / totalCrop);
            trailingCrop *= (90 / totalCrop);
        }

        // bitmap size and offset, according to object size and cropping
        size = objectSize * 100 / (100 - leadingCrop - trailingCrop);
        offset = (size * leadingCrop) / 100;

        // convert to CSS pixels
        return {
            offset: Utils.convertHmmToCssLength(-offset, 'px', 0),
            size: Utils.convertHmmToCssLength(size, 'px', 0)
        };
    }

    /**
     * Will be called for every drawing node whose attributes have been changed.
     * Repositions and reformats the drawing according to the passed attributes.
     *
     * @param {jQuery} drawing
     *  The drawing node whose attributes have been changed, as jQuery object.
     *
     * @param {Object} mergedAttributes
     *  A map of attribute maps (name/value pairs), keyed by attribute family,
     *  containing the effective attribute values merged from style sheets and
     *  explicit attributes.
     */
    function updateDrawingFormatting(drawing, mergedAttributes) {

        var // the drawing attributes of the passed attribute map
            drawingAttributes = mergedAttributes.drawing,
            // the paragraph element containing the drawing node
            paragraph = drawing.parent(),
            // total width of the paragraph, in 1/100 mm
            paraWidth = Utils.convertLengthToHmm(paragraph.width(), 'px'),
            // preceding node used for vertical offset
            verticalOffsetNode = drawing.prev(DOM.OFFSET_NODE_SELECTOR),
            // current drawing width, in 1/100 mm
            drawingWidth = Utils.convertLengthToHmm(drawing.width(), 'px'),
            // current drawing height, in 1/100 mm
            drawingHeight = Utils.convertLengthToHmm(drawing.height(), 'px'),
            // offset from top/left/right margin of paragraph element, in 1/100 mm
            topOffset = 0, leftOffset = 0, rightOffset = 0,
            // margins to be applied at the drawing
            topMargin = 0, bottomMargin = 0, leftMargin = 0, rightMargin = 0,
            // text wrapping side (left/right/none)
            wrapMode = 'none',
            // type of the drawing: 'image', ...
            type = drawing.data('type'),
            // the content node inside the drawing
            contentNode = DOM.getDrawingContentNode(drawing),
            // image data string. if base64 image, string starts with 'data:'
            base64String = 'data:',
            // image data string. if svg image, string starts with '<svg'
            svgString = '<svg';

        // position

        if (drawingAttributes.inline) {

            // switch from floating to inline mode
            if (!drawing.hasClass('inline')) {

                // remove leading node used for positioning
                verticalOffsetNode.remove();

                // TODO: Word uses fixed predefined margins in inline mode, we too?
                drawing.removeClass('float left right').addClass('inline').css('margin', '0 1mm');
                // ignore other attributes in inline mode

                // repaint the selection, convert it to a non-moveable selection
                DrawingResize.repaintDrawingSelection(drawing);
            }

        } else {

            // switch from inline to floating mode
            if (!drawing.hasClass('float')) {
                drawing.removeClass('inline').addClass('float');
                // repaint the selection, convert it to a moveable selection
                DrawingResize.repaintDrawingSelection(drawing);
            }

            // calculate top offset (only if drawing is anchored to paragraph)
            if (drawingAttributes.anchorVertBase === 'paragraph') {
                if (drawingAttributes.anchorVertAlign === 'offset') {
                    topOffset = Math.max(drawingAttributes.anchorVertOffset, 0);
                } else {
                    // TODO: automatic alignment (top/bottom/center/...)
                    topOffset = 0;
                }
            }

            // calculate top/bottom drawing margins
            topMargin = Utils.minMax(drawingAttributes.marginTop, 0, topOffset);
            bottomMargin = Math.max(drawingAttributes.marginBottom, 0);

            // add or remove leading offset node used for positioning
            // TODO: support for multiple drawings (also overlapping) per side
            topOffset -= topMargin;
            if (topOffset < 700) {
                // offset less than 7mm: expand top margin to top of paragraph,
                // otherwise the first text line overwrites the drawing
                topMargin += topOffset;
                // remove offset node
                verticalOffsetNode.remove();
            } else {
                // create offset node if not existing yet
                if (verticalOffsetNode.length === 0) {
                    verticalOffsetNode = $('<div>', { contenteditable: false }).addClass('float offset').width(1).insertBefore(drawing);
                }
                // set height of the offset node
                verticalOffsetNode.height(Utils.convertHmmToLength(topOffset, 'px', 0));
            }

            // calculate left/right offset (only if drawing is anchored to column)
            if (drawingAttributes.anchorHorBase === 'column') {
                switch (drawingAttributes.anchorHorAlign) {
                case 'center':
                    leftOffset = (paraWidth - drawingWidth) / 2;
                    break;
                case 'right':
                    leftOffset = paraWidth - drawingWidth;
                    break;
                case 'offset':
                    leftOffset = drawingAttributes.anchorHorOffset;
                    break;
                default:
                    leftOffset = 0;
                }
            } else {
                // TODO: other anchor bases (page/character/margins/...)
                leftOffset = 0;
            }
            rightOffset = paraWidth - leftOffset - drawingWidth;

            // determine text wrapping side
            if (isTextWrapped(drawingAttributes.textWrapMode)) {
                switch (drawingAttributes.textWrapSide) {
                case 'left':
                    wrapMode = 'left';
                    break;
                case 'right':
                    wrapMode = 'right';
                    break;
                case 'both':
                case 'largest':
                    // no support for 'wrap both sides' in CSS, default to 'largest'
                    wrapMode = (leftOffset > rightOffset) ? 'left' : 'right';
                    break;
                default:
                    Utils.warn('updateDrawingFormatting(): invalid text wrap side: ' + drawingAttributes.textWrapSide);
                    wrapMode = 'none';
                }
            } else {
                // text does not float beside drawing
                wrapMode = 'none';
            }

            // calculate left/right drawing margins
            switch (wrapMode) {

            case 'left':
                // drawing floats at right paragraph margin
                rightMargin = rightOffset;
                leftMargin = Math.max(drawingAttributes.marginLeft, 0);
                // if there is less than 6mm space available for text, occupy all space (no wrapping)
                if (leftOffset - leftMargin < 600) { leftMargin = Math.max(leftOffset, 0); }
                break;

            case 'right':
                // drawing floats at left paragraph margin
                leftMargin = leftOffset;
                rightMargin = Math.max(drawingAttributes.marginRight, 0);
                // if there is less than 6mm space available for text, occupy all space (no wrapping)
                if (rightOffset - rightMargin < 600) { rightMargin = Math.max(rightOffset, 0); }
                break;

            default:
                // no wrapping: will be modeled by left-floated with large CSS margins
                wrapMode = 'right';
                leftMargin = leftOffset;
                rightMargin = Math.max(rightOffset, 0);
            }

            // set text wrap mode to drawing and offset node
            drawing.add(verticalOffsetNode).removeClass('left right').addClass((wrapMode === 'left') ? 'right' : 'left');

            // apply CSS formatting to drawing node
            drawing.css({
                marginTop: Utils.convertHmmToCssLength(topMargin, 'px', 0),
                marginBottom: Utils.convertHmmToCssLength(bottomMargin, 'px', 0),
                marginLeft: Utils.convertHmmToCssLength(leftMargin, 'px', 0),
                marginRight: Utils.convertHmmToCssLength(rightMargin, 'px', 0)
            });
        }

        // using replacement data, if available (valid for all drawing types)
        if (drawingAttributes.replacementData && drawingAttributes.replacementData.length) {
            if (drawingAttributes.replacementData.indexOf(base64String) === 0) {
                imageNode = $('<img>', { src: drawingAttributes.replacementData });
                contentNode.append(imageNode);
            } else if (drawingAttributes.replacementData.indexOf(svgString) === 0) {
                contentNode[0].appendChild($(drawingAttributes.replacementData));
            }
        }

        // some attributes are specific to the drawing type
        if (type === 'image') {

            var // horizontal offset/size of the bitmap, as CSS attributes
                horizontalSettings = null,
                // vertical offset/size of the bitmap, as CSS attributes
                verticalSettings = null,
                // the image node inside the drawing node
                imageNode = contentNode.find('img'),
                // the source data or url for the image
                imgSrc = null,
                // an <img> node can be used for urls or image sources starting with 'data:'
                useImageNode = false,
                // an <svg> node can be used directly for image sources starting with '<svg'
                useSvgNode = false;

            if (imageNode.length === 0) {
                // inserting the image
                if (drawingAttributes.imageData && drawingAttributes.imageData.length) {
                    imgSrc = drawingAttributes.imageData;
                    if (imgSrc.indexOf(base64String) === 0) {
                        useImageNode = true;
                    } else if (imgSrc.indexOf(svgString) === 0) {
                        useSvgNode = true;
                    }
                } else {
                    imgSrc = drawing.data('absoluteURL');
                    useImageNode = true;
                }

                if (useImageNode) {
                    imageNode = $('<img>', { src: imgSrc });
                    contentNode.append(imageNode);
                } else if (useSvgNode) {
                    contentNode[0].appendChild($(imgSrc));
                }
            }

            if ((drawingWidth > 0) && (drawingHeight > 0)) {
                horizontalSettings = calculateBitmapSettings(drawingWidth, drawingAttributes.cropLeft, drawingAttributes.cropRight);
                verticalSettings = calculateBitmapSettings(drawingHeight, drawingAttributes.cropTop, drawingAttributes.cropBottom);

                // set CSS formatting at the <img> element
                imageNode.css({
                    left: horizontalSettings.offset,
                    top: verticalSettings.offset,
                    width: horizontalSettings.size,
                    height: verticalSettings.size
                });
            }
        }
    }

    // class DrawingStyles =====================================================

    /**
     * Contains the style sheets for drawing formatting attributes. The CSS
     * formatting will be read from and written to drawing elements of any type.
     *
     * @constructor
     *
     * @extends StyleSheets
     *
     * @param {DocumentStyles} documentStyles
     *  Collection with the style containers of all style families.
     */
    function DrawingStyles(rootNode, documentStyles) {

        // base constructor ---------------------------------------------------

        StyleSheets.call(this, documentStyles, { updateHandler: updateDrawingFormatting });

    } // class ImageStyles

    // static methods ---------------------------------------------------------

    /**
     * Returns the drawing attributes that are needed to represent the passed
     * GUI floating mode.
     *
     * @param {String} floatMode
     *  The GUI floating mode.
     *
     * @returns {Object}
     *  A map with drawing attributes, as name/value pairs.
     */
    DrawingStyles.getAttributesFromFloatMode = function (floatMode) {
        return (floatMode in FLOAT_MODE_ATTRIBUTES) ? FLOAT_MODE_ATTRIBUTES[floatMode] : {};
    };

    /**
     * Returns the drawing attributes that are needed to represent the passed
     * floating mode as used in the GUI.
     *
     * @param {Object} attributes
     *  A map with drawing attributes, as name/value pairs.
     *
     * @returns {String}
     *  The GUI floating mode.
     */
    DrawingStyles.getFloatModeFromAttributes = function (attributes) {

        // inline mode overrules floating attributes
        if (attributes.inline) {
            return 'inline';
        }

        // only paragraph anchor supported
        if ((attributes.anchorHorBase !== 'column') || (attributes.anchorVertBase !== 'paragraph')) {
            return null;
        }

        // floating mode depends on text wrapping side
        if (isTextWrapped(attributes.textWrapMode)) {
            switch (attributes.textWrapSide) {
            case 'left':
                return 'rightFloated';
            case 'right':
                return 'leftFloated';
            default:
                return null;
            }
        }
        return 'noneFloated';
    };

    // exports ================================================================

    // derive this class from class StyleSheets
    return StyleSheets.extend(DrawingStyles, 'drawing', DEFINITIONS);

});
