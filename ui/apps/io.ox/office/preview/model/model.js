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

define('io.ox/office/preview/model/model',
    ['io.ox/office/tk/utils',
     'io.ox/office/framework/model/basemodel'
    ], function (Utils, BaseModel) {

    'use strict';

    // class Cache ============================================================

    /**
     * Caches arbitrary elements and maintains a maximum cache size. Creates
     * new elements on demand via a callback function.
     *
     * @param {Number} cacheSize
     *  The maximum size of the cache.
     *
     * @param {Function} createElementHandler
     *  A callback function that will be called when the cache does not contain
     *  the requested element. Receives the element key as first parameter.
     *  Must return the element that will be stored in this cache.
     *
     * @param {Object} [context]
     *  The context used to call the createElementHandler callback function.
     */
    function Cache(cacheSize, createElementHandler, context) {

        var // cached elements, mapped by key
            elements = {},

            // last used keys, in order of access
            lastKeys = [];

        // methods ------------------------------------------------------------

        /**
         * Clears all elements from this cache.
         *
         * @returns {Cache}
         *  A reference to this instance.
         */
        this.clear = function () {
            elements = {};
            lastKeys = [];
            return this;
        };

        /**
         * Returns the element stored under the specified key. If the element
         * does not exist yet, calls the callback function passed to the
         * constructor, and stores its result in this cache.
         *
         * @param {String|Number} key
         *  The key of the requested element.
         *
         * @returns {Any}
         *  The element that has been already cached, or that has been created
         *  by the callback function passed to the constructor.
         */
        this.getElement = function (key) {

            // execute callback handler for missing elements
            if (!(key in elements)) {
                elements[key] = createElementHandler.call(context, key);
            }

            // update array of last used keys
            lastKeys = _(lastKeys).without(key);
            lastKeys.push(key);
            if (lastKeys.length > cacheSize) {
                delete elements[lastKeys.shift()];
            }

            return elements[key];
        };

    } // class Cache

    // class PreviewModel =====================================================

    /**
     * The model of the Preview application. Stores and provides the HTML
     * representation of the document pages.
     *
     * @constructor
     *
     * @extends BaseModel
     */
    function PreviewModel(app) {

        var // the total page count of the document
            pageCount = 0,

            // the page cache containing Deferred objects with <img> elements
            imageCache = new Cache(100, createImageNode),

            // the page cache containing Deferred objects with SVG mark-up as strings
            svgCache = new Cache(100, loadSvgMarkup);

        // base constructor ---------------------------------------------------

        BaseModel.call(this, app);

        // private methods ----------------------------------------------------

        /**
         * Creates an <img> element containing the SVG mark-up of the specified
         * page.
         *
         * @param {Number} page
         *  The one-based page number.
         *
         * @returns {jQuery.Promise}
         *  The Promise of a Deferred object that will be resolved with the
         *  <img> element as jQuery object.
         */
        function createImageNode(page) {
            return app.createImageNode(app.getPreviewModuleUrl({
                convert_format: 'html',
                convert_action: 'getpage',
                page_number: page,
                returntype: 'file'
            }), 60000);

        }

        /**
         * Loads the SVG mark-up of the specified page.
         *
         * @param {Number} page
         *  The one-based page number.
         *
         * @returns {jQuery.Promise}
         *  The Promise of a Deferred object that will be resolved with the SVG
         *  mark-up.
         */
        function loadSvgMarkup(page) {

            return app.sendPreviewRequest({
                params: {
                    convert_format: 'html',
                    convert_action: 'getpage',
                    page_number: page
                },
                resultFilter: function (data) {
                    // extract SVG mark-up, returning undefined will reject the entire request
                    return Utils.getStringOption(data, 'HTMLPages');
                }
            })
            .promise();
        }

        // methods ------------------------------------------------------------

        /**
         * Sets the number of pages contained in the document and clears the
         * page cache.
         *
         * @param {Number} count
         *  The number of pages in the document currently previewed.
         */
        this.setPageCount = function (count) {
            pageCount = Math.min(10000, count);
            imageCache.clear();
            svgCache.clear();
        };

        /**
         * Returns the number of pages contained in the document.
         *
         * @returns {Number}
         *  The number of pages in the document currently previewed.
         */
        this.getPageCount = function () {
            return pageCount;
        };

        /**
         * Returns the Promise of a Deferred object that will be resolved with
         * the <img> element containing the SVG mark-up of the specified page.
         *
         * @param {Number} page
         *  The one-based index of the requested page.
         *
         * @returns {jQuery.Promise}
         *  The Promise of a Deferred object that will be resolved with the
         *  completed <img> element containing the SVG mark-up of the specified
         *  page (as jQuery object), or rejected on error.
         */
        this.loadPageAsImage = function (page) {
            return imageCache.getElement(page).then(function (imgNode) {
                // clone the cached image on every access
                return app.createImageNode(imgNode.attr('src'), 15000);
            });
        };

        /**
         * Returns the Promise of a Deferred object that will be resolved with
         * the SVG mark-up of the specified page.
         *
         * @param {Number} page
         *  The one-based index of the requested page.
         *
         * @returns {jQuery.Promise}
         *  The Promise of a Deferred object that will be resolved with the
         *  SVG mark-up of the specified page as string, or rejected on error.
         */
        this.loadPageAsSvg = function (page) {
            return svgCache.getElement(page);
        };

    } // class PreviewModel

    // exports ================================================================

    // derive this class from class BaseModel
    return BaseModel.extend({ constructor: PreviewModel });

});
