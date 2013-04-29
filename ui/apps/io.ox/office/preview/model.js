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

define('io.ox/office/preview/model',
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
            svgCache = new Cache(100, loadSvgMarkup),

            // current timer fetching more pages in the background
            fetchPagesTimer = null;

        // base constructor ---------------------------------------------------

        BaseModel.call(this, app);

        // private methods ----------------------------------------------------

        function waitForImageNode(imgNode) {

            var // the result Deferred object
                def = $.Deferred(),
                // the timer for the 10 seconds timeout
                timer = null;

            // wait that the image is loaded
            imgNode.one({
                load: function () { def.resolve(imgNode); },
                error: function () { def.reject(); }
            });

            // timeout if server hangs, or browser fails to parse the SVG (e.g.: IE10 with invalid SVG mark-up)
            timer = app.executeDelayed(function () { def.reject(); }, { delay: 10000 });

            return def.always(function () { timer.abort(); imgNode.off(); }).promise();
        }

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
            var srcUrl = app.getPreviewModuleUrl({ convert_format: 'html', convert_action: 'getpage', page_number: page, returntype: 'file' });
            return waitForImageNode($('<img>', { src: srcUrl }));
        }

        /**
         * Creates an <img> element that shows the same image as the passed
         * image node.
         *
         * @param {HTMLElement|jQuery} imgNode
         *  The original <img> element.
         *
         * @returns {jQuery.Promise}
         *  The Promise of a Deferred object that will be resolved with the
         *  cloned <img> element as jQuery object.
         */
        function cloneImageNode(imgNode) {
            return waitForImageNode($('<img>', { src: $(imgNode).attr('src') }));
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

        /**
         * Fetches more pages from the server and stores them in the specified
         * page cache. Fetches the next five pages and the previous five pages
         * of the specified page, as well as the very last page.
         *
         * @param {Cache} cache
         *  The cache instance to be filled with more pages.
         *
         * @param {Number} page
         *  The one-based index of the page whose siblings will be fetched and
         *  cached.
         */
        function fetchSiblingPages(cache, page) {

            var // all page numbers to be fetched
                fetchPages = [];

            // stop running timer
            if (fetchPagesTimer) { fetchPagesTimer.abort(); }

            // build the array of page numbers to be fetched (start with direct
            // next and previous sibling of the page, then fetch more distant
            // pages.
            _(5).times(function (index) {
                var nextPage = page + index + 1,
                    prevPage = page - index - 1;
                if (nextPage <= pageCount) { fetchPages.push(nextPage); }
                if (prevPage >= 1) { fetchPages.push(prevPage); }
            });

            // finally fetch the first and last page to always keep them in the cache
            if (page > 1) { fetchPages.push(1); }
            if (page < pageCount) { fetchPages.push(pageCount); }

            // start the background task
            fetchPagesTimer = app.processArrayDelayed(function (pages) {
                // The method processArrayDelayed() passes one-element array.
                // Returning a Deferred object causes processArrayDelayed() to
                // wait until it is resolved, or to abort if it is rejected.
                return cache.getElement(pages[0]);
            }, _.unique(fetchPages), { chunkLength: 1 });
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
            pageCount = count;
            imageCache.clear();
            svgCache.clear();
            if (fetchPagesTimer) { fetchPagesTimer.abort(); }
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
         * @param {Object} [options]
         *  A map with options to control the behavior of this method. The
         *  following options are supported:
         *  @param {Boolean} [options.fetchSiblings=false]
         *      If set to true, additional sibling pages will be loaded and
         *      stored in the internal page cache.
         *
         * @returns {jQuery.Promise}
         *  The Promise of a Deferred object that will be resolved with the
         *  completed <img> element containing the SVG mark-up of the specified
         *  page (as jQuery object), or rejected on error.
         */
        this.loadPageAsImage = function (page, options) {
            return imageCache.getElement(page).then(function (imgNode) {
                // start fetching sibling pages into the cache
                if (Utils.getBooleanOption(options, 'fetchSiblings', false)) {
                    fetchSiblingPages(imageCache, page);
                }
                // clone the cached image on every access, wait for the 'load' event of the clone
                return cloneImageNode(imgNode);
            });
        };

        /**
         * Returns the Promise of a Deferred object that will be resolved with
         * the SVG mark-up of the specified page.
         *
         * @param {Number} page
         *  The one-based index of the requested page.
         *
         * @param {Object} [options]
         *  A map with options to control the behavior of this method. The
         *  following options are supported:
         *  @param {Boolean} [options.fetchSiblings=false]
         *      If set to true, additional sibling pages will be loaded and
         *      stored in the internal page cache.
         *
         * @returns {jQuery.Promise}
         *  The Promise of a Deferred object that will be resolved with the
         *  SVG mark-up of the specified page as string, or rejected on error.
         */
        this.loadPageAsSvg = function (page, options) {
            return svgCache.getElement(page).done(function () {
                // start fetching sibling pages into the cache
                if (Utils.getBooleanOption(options, 'fetchSiblings', false)) {
                    fetchSiblingPages(svgCache, page);
                }
            });
        };

    } // class PreviewModel

    // exports ================================================================

    // derive this class from class BaseModel
    return BaseModel.extend({ constructor: PreviewModel });

});
