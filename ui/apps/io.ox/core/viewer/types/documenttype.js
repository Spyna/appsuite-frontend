/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2015 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Edy Haryono <edy.haryono@open-xchange.com>
 */
define('io.ox/core/viewer/types/documenttype', [
    'io.ox/core/http',
    'io.ox/core/viewer/util',
    'io.ox/office/baseframework/pdf/pdfdocument',
    'gettext!io.ox/core'
], function (CoreHTTP, Util, PDFDocument, gt) {
    /**
     * The document file type. Implements the ViewerType interface.
     *
     * interface ViewerType {
     *    function createSlide(model, modelIndex);
     *    function loadSlide(slideElement);
     * }
     *
     * @constructor
     */
    function DocumentType(model) {

        // the file descriptor object
        var file = model.get('origData'),
            // Input Output object
            IO = {},
            // all pending server requests currently running
            pendingRequests = [],
            // prevent further server requests after the quit handlers have been called
            requestsLocked = false,
            currentApp = ox.ui.App.getCurrentApp();

        //The name of the document converter server module.
        IO.CONVERTER_MODULE_NAME = 'oxodocumentconverter';

        /**
         * Creates and returns the URL of a server request.
         *
         * @param {String} module
         *  The name of the server module.
         *
         * @param {Object} [params]
         *  Additional parameters inserted into the URL.
         *
         * @param {Object} [options]
         *  Optional parameters:
         *  @param {Boolean} [options.currentVersion=false]
         *      If set to true, the version stored in the file descriptor will
         *      NOT be inserted into the generated URL (thus, the server will
         *      always access the current version of the document).
         *
         * @returns {String|Undefined}
         *  The final URL of the server request; or undefined, if the
         *  application is not connected to a document file, or the current
         *  session is invalid.
         */
        function getServerModuleUrl (module, params, options) {
            // return nothing if no file is present
            if (!ox.session || !file) {
                return;
            }

            var // the parameters for the file currently loaded
                fileParams = getFileParameters(Util.extendOptions(options, { encodeUrl: true }));

            // add default parameters (session and UID), and file parameters
            params = _.extend({ session: ox.session, uid: currentApp.get('uniqueID') }, fileParams, params);

            // build and return the resulting URL
            return ox.apiRoot + '/' + module + '?' + _.map(params, function (value, name) { return name + '=' + value; }).join('&');
        }

        /**
         * Returns an object with attributes describing the file currently
         * opened by this application.
         *
         * @param {Object} [options]
         *  Optional parameters:
         *  @param {Boolean} [options.encodeUrl=false]
         *      If set to true, special characters not allowed in URLs will be
         *      encoded.
         *  @param {Boolean} [options.currentVersion=false]
         *      If set to true, the version stored in the file descriptor will
         *      NOT be inserted into the result (thus, the server will always
         *      access the current version of the document).
         *
         * @returns {Object|Null}
         *  An object with file attributes, if existing; otherwise null.
         */
        function getFileParameters (options) {

            var // function to encode a string to be URI conforming if specified
                encodeString = Util.getBooleanOption(options, 'encodeUrl', false) ? encodeURIComponent : _.identity,
                // the resulting file parameters
                parameters = null;

            if (file) {
                parameters = {};

                // add the parameters to the result object, if they exist in the file descriptor
                _.each(['id', 'folder_id', 'filename', 'version', 'source', 'attached', 'module'], function (name) {
                    if (_.isString(file[name])) {
                        parameters[name] = encodeString(file[name]);
                    } else if (_.isNumber(file[name])) {
                        parameters[name] = file[name];
                    }
                });

                // remove the version identifier, if specified
                if (Util.getBooleanOption(options, 'currentVersion', false)) {
                    delete parameters.version;
                }
            }

            return parameters;
        }

        /**
         * Sends a request to the server and returns the Promise of a Deferred
         * object waiting for the response. The unique identifier of this
         * application, and the parameters of the file currently opened by the
         * application will be added to the request parameters automatically.
         * See method IO.sendRequest() for further details.
         *
         * @param {String} module
         *  The name of the server module that will receive the request.
         *
         * @param {Object} [params]
         *  Parameters that will be inserted into the request URL (method GET),
         *  or into the request body (method POST).
         *
         * @param {Object} [options]
         *  Optional parameters. See method IO.sendRequest() for details.
         *
         * @returns {jQuery.Promise}
         *  The Promise of the request. Will be rejected immediately, if this
         *  application is not connected to a document file. See method
         *  IO.sendRequest() for details.
         */
        function sendFileRequest (module, params, options) {

            // reject immediately if no file is present
            if (!file) {
                return $.Deferred().reject();
            }

            // extend parameters with file settings
            params = _.extend({}, params, getFileParameters());

            // send the request
            return sendRequest(module, params, options);
        }

        /**
         * Sends a request to the server and returns the promise of a Deferred
         * object waiting for the response. The unique identifier of this
         * application will be added to the request parameters automatically.
         * See method IO.sendRequest() for further details.
         *
         * @param {String} module
         *  The name of the server module that will receive the request.
         *
         * @param {Object} [params]
         *  Parameters that will be inserted into the request URL (method GET),
         *  or into the request body (method POST).
         *
         * @param {Object} [options]
         *  Optional parameters. See method IO.sendRequest() for details.
         *
         * @returns {jQuery.Promise}
         *  The Promise of the request. See method IO.sendRequest() for
         *  details.
         */
        function sendRequest(module, params, options) {

            var // the AJAX request, as (abortable) jQuery promise
                request = null;

            // do not allow to send server requests after the quit handlers have been called
            if (requestsLocked) {
                return $.Deferred().reject('quit');
            }

            // add the application UID to the request parameters
            params = _.extend({}, params, { uid: currentApp.get('uniqueID') });

            // send the request
            request = IO.sendRequest(module, params, options);

            // store the request internally for automatic abort on application quit
            pendingRequests.push(request);
            request.always(function () {
                pendingRequests = _.without(pendingRequests, request);
            });

            return request;
        }

        /**
         * Sends a request to the server and returns the promise of a Deferred
         * object waiting for the response.
         *
         * @param {String} module
         *  The name of the server module that will receive the request.
         *
         * @param {Object} params
         *  Parameters that will be inserted into the request URL (method GET), or
         *  into the request body (method POST).
         *
         * @param {Object} [options]
         *  Optional parameters:
         *  @param {String} [options.method='GET']
         *      The request method. Must be an upper-case string (for example,
         *      'GET', 'POST', etc.). Defaults to 'GET'.
         *  @param {Function} [options.resultFilter]
         *      A function that will be called if the request returns successfully,
         *      and filters the resulting 'data' object returned by the request.
         *      Receives the 'data' object as first parameter. If this function
         *      returns undefined, the entire request will be rejected. Otherwise,
         *      the request will be resolved with the return value of this function
         *      instead of the complete 'data' object.
         *
         * @returns {jQuery.Promise}
         *  The promise of the request. Will be resolved with the 'data' object
         *  returned by the response, if available; or the valid return value of
         *  the result filter callback function, if specified. Otherwise, the
         *  promise will be rejected. Contains the additional method 'abort()' that
         *  allows to abort the running request which rejects the promise. Calling
         *  this method has no effect, if the request is finished already.
         */
        IO.sendRequest = function (module, params, options) {

            var // extract the request method
                method = Util.getStringOption(options, 'method', 'GET'),
                // extract the result filter callback
                resultFilter = Util.getFunctionOption(options, 'resultFilter'),
                // properties passed to the server request
                requestProps = { module: module, params: params },
                // the Deferred object representing the core AJAX request
                ajaxRequest = null,
                // the Promise returned by this method
                promise = null;

            // send the AJAX request
            ajaxRequest = CoreHTTP[method](requestProps);

            // reject, if the response contains 'hasErrors:true'
            promise = ajaxRequest.then(function (response) {
                return Util.getBooleanOption(response, 'hasErrors', false) ? $.Deferred().reject(response) : response;
            });

            // filter the result of the original request according to the passed filter callback
            if (_.isFunction(resultFilter)) {
                promise = promise.then(IO.createDeferredFilter(resultFilter));
            }

            // add an abort() method, forward invocation to AJAX request
            return _.extend(promise, { abort: function () { ajaxRequest.abort(); } });
        };

        // public methods -----------------------------------------------------

        /**
         * Creates a document slide.
         *
         * @param {Object} model
         *  An OX Viewer Model object.
         *
         * @param {Number} modelIndex
         *  Index of this model object in the collection.
         *
         * @returns {jQuery} slide
         *  the slide jQuery element.
         */
        this.createSlide = function (modelIndex) {
            //console.warn('DocumentType.createSlide()');
            var slide = $('<div class="swiper-slide" tabindex="-1" role="option" aria-selected="false">'),
                pageContainer = $('<div class="document-container">'),
                slidesCount = model.collection.length;

            function createCaption () {
                var caption = $('<div class="viewer-displayer-caption">');

                caption.text(modelIndex + 1 + ' ' + gt('of') + ' ' + slidesCount);
                return caption;
            }

            slide.append(pageContainer, createCaption());
            return slide;
        };

        /**
         * "Loads" a document slide.
         *
         *
         * @param {jQuery} slideElement
         *  the slide jQuery element to be loaded.
         */
        this.loadSlide = function (slideElement) {
            //console.warn('DocumentType.loadSlide()', slideElement);
            //var documentUrl = getServerModuleUrl(IO.CONVERTER_MODULE_NAME, {
            //        action: 'getdocument',
            //        documentformat: 'pdf',
            //        priority: 'instant',
            //        mimetype: file.file_mimetype ? encodeURIComponent(file.file_mimetype) : '',
            //        nocache: _.uniqueId() // needed to trick the browser cache (is not evaluated by the backend)
            //    }),
            //    // the pdf document model
            //    pdfDocument = new PDFDocument(documentUrl),
            //    // begin stateful image conversion for the document on the server
            //    documentImagesPromise = sendFileRequest(IO.CONVERTER_MODULE_NAME, {
            //        action: 'convertdocument',
            //        convert_action: 'beginconvert',
            //        convert_format: 'image'
            //        // convert_format: 'html'
            //    }),
            //    pageContainer = slideElement.find('.document-container');
            //$.when(pdfDocument.getLoadPromise(), documentImagesPromise).then(function (pageCount) {
            //    _.times(pageCount, function (number) {
            //        var page = $('<div class="document-page">').text(number + 1);
            //        pageContainer.append(page);
            //    });
            //});
            if (getServerModuleUrl && sendFileRequest) {}
            var pageContainer = slideElement.find('.document-container');
            // create dummy pages
            if (pageContainer.find('.document-page').length !== 0) { return;}
            _.times(5, function (number) {
                var page = $('<div class="document-page">').text(number + 1);
                pageContainer.append(page);
            });
        };
    }

    return DocumentType;

});
