/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2016 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Kai Ahrens <kai.ahrens@open-xchange.com>
 */

define('io.ox/core/pdf/pdfdocument', [
    'io.ox/core/pdf/pdfview',
    'pdfjs-dist/build/pdf.combined',
    'settings!io.ox/core'
], function (PDFView, PDFJSCombined, Settings) {

    'use strict';

    var PDFJS = PDFJSCombined.PDFJS;

    // class PDFDocument =======================================================

    /**
     * The model of the Preview application. Stores and provides the HTML
     * representation of the document pages.
     *
     * @constructor
     *
     * @extends BaseModel
     */
    /**
     * @param {String} pdfDocumentURL
     */
    function PDFDocument(pdfConverterURL) {

        var self = this,

            loadDef = $.Deferred(),

            // the resulting PDF.js document after loading
            pdfjsDocument = null,

            // the total page count of the document {Number}
            pageCount = 0,

            // the size of the first page is treated as default page size {width, height}
            defaultPageSize = null,

            // the size of the first page is treated as default page size {[{width, height}, ...]}
            pageSizes = [],

            // whether to enable range requests support
            enableRangeRequests = Settings.get('pdf/enableRangeRequests');

        /**
         * Range request support. If the server supports range requests the PDF will be fetched in chunks.
         */
        PDFJS.disableRange = !enableRangeRequests;

        /**
         * Streaming of PDF file data.
         */
        PDFJS.disableStream = !enableRangeRequests;

        /**
         * Pre-fetching of PDF file data. PDF.js will automatically keep fetching more data even if it isn't needed to display the current page.
         * NOTE: It is also necessary to disable streaming, see above, in order for disabling of pre-fetching to work correctly.
         */
        PDFJS.disableAutoFetch = !enableRangeRequests;

        /**
         * set verbosity level for PDF.js to errors only
         */
        PDFJS.verbosity = PDFJS.VERBOSITY_LEVELS.errors;

        /**
         * Open external links in a new window
         */
        PDFJS.openExternalLinksInNewWindow = true;

        /**
         * Path for image resources, mainly for annotation icons. Include trailing slash.
         */
        PDFJS.imageResourcesPath = ox.base + '/apps/pdfjs-dist/web/images/';

        // ---------------------------------------------------------------------

        function initializePageSize(pageNumber) {
            var def = $.Deferred();

            if (_.isNumber(pageNumber) && (pageNumber > 0) && (pageNumber <= pageCount)) {
                self.getPDFJSPage(pageNumber).then(function (pdfjsPage) {
                    var viewport = pdfjsPage.getViewport(PDFView.getAdjustedZoom(1.0));
                    return def.resolve(PDFView.getNormalizedSize({ width: viewport.width, height: viewport.height }));
                });
            }

            return def.promise();
        }

        // methods ------------------------------------------------------------

        this.destroy = function () {
            if (pdfjsDocument) {
                pdfjsDocument.destroy();
            }
        };

        /**
         * @returns {jQuery.Promise}
         *  The promise of a Deferred object that will be resolved when the
         *  PDF document has been loaded completely.
         */
        this.getLoadPromise = function () {
            return loadDef.promise();
        };

        // ---------------------------------------------------------------------

        /**
         * @returns {PDF.js document}
         *  The promise of a Deferred object that will be resolved when the
         *  PDF document has been loaded completely.
         */
        this.getPDFJSDocument = function () {
            return pdfjsDocument;
        };

        // ---------------------------------------------------------------------

        /**
         * Gets the PDF.js page promise for the specified page
         *
         * @param {Number} pageNumber
         *  The number of the page.
         * @returns {PDF.js promise}
         *  The PDF.js page promise.
         */
        this.getPDFJSPage = function (pageNumber) {
            return pdfjsDocument.getPage(pageNumber);
        };

        // ---------------------------------------------------------------------

        /**
         * Returns the number of pages contained in the document.
         *
         * @returns {Number}
         *  The total number of pages in the document.
         */
        this.getPageCount = function () {
            return pageCount;
        };

        // ---------------------------------------------------------------------

        /**
         * Returns the number of pages contained in the document.
         *
         * @returns {Number}
         *  The total number of pages in the document.
         */
        this.getDefaultPageSize = function () {
            return defaultPageSize;
        };

        // ---------------------------------------------------------------------

        /**
         * Gets the page size in pixels for the specified page or
         * null if pageNumber is outside of page range
         *
         * @param {Number} pageNumber
         *  The number of the page.
         * @returns {width,height}
         *  The size in pixels of the page.
         */
        this.getOriginalPageSize = function (pageNumber) {
            var pageSize = null;

            if ((pageCount > 0) && _.isNumber(pageNumber) && (pageNumber > 0) && (pageNumber <= pageCount)) {
                pageSize = pageSizes[pageNumber - 1];

                /* TODO (KA): reenable to get correct page sizes for all pages =>
                 * ideal solution would be to retrieve and set original page size in first
                 * real rendering of the page; retrieving all page sizes at the
                 * begin will be too slow, so that this feature is currently disabled =>
                 * all pages will have the default/first page size ATM
                if (!pageSize) {
                    initializePageSize(pageNumber).then( function(pageSize) {
                        pageSizes[pageNumber - 1] = pageSize;
                    });
                }
                */
            }

            return (pageSize || defaultPageSize);
        };

        // ---------------------------------------------------------------------

        // convert document to PDF
        PDFJS.getDocument(pdfConverterURL).promise.then(function (document) {
            var error = true;

            if (document) {
                pdfjsDocument = document;
                pageCount = pdfjsDocument.numPages;

                if (pageCount > 0) {
                    error = false;

                    initializePageSize(1).then(function (pageSize) {
                        pageSizes[0] = defaultPageSize = pageSize;
                        return loadDef.resolve(pageCount);
                    });
                }
            }

            if (error) {
                loadDef.resolve({ cause: 'importError' });
            }
        }, function () {
            // In case of an error, extend the given URL with the
            // enctest=pdf flag, so that we get a correct error code
            // even in case of PDF source files, which are not treated
            // by the documentconverter otherwise;
            // The documentconverter will perform an encryption test on
            // a given PDF file and set the password error response accordingly
            var encTestPDFConverterURL = pdfConverterURL + '&enctest=pdf';

            $.get(encTestPDFConverterURL).always(function (data) {
                loadDef.resolve(
                    (_.isObject(data) && _.isString(data.responseText)) ?
                        $.parseJSON(data.responseText) :
                        { cause: 'filterError' });

            });
        });

    } // class PDFDocument

    // exports ================================================================

    return PDFDocument;
});
