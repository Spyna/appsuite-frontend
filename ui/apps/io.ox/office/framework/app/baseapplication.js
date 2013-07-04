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

define('io.ox/office/framework/app/baseapplication',
    ['io.ox/core/extensions',
     'io.ox/files/api',
     'io.ox/office/tk/utils',
     'io.ox/office/tk/io',
     'io.ox/office/framework/app/extensionregistry',
     'settings!io.ox/office',
     'gettext!io.ox/office/main'
    ], function (ext, FilesAPI, Utils, IO, ExtensionRegistry, Settings, gt) {

    'use strict';

    // private static functions ===============================================

    /**
     * Returns the document type from the passed application module name.
     * The document type equals the last directory name of the module name.
     *
     * @param {String} moduleName
     *  The application module name.
     *
     * @returns {String}
     *  The document type of the passed module name.
     */
    function getDocumentType(moduleName) {
        return moduleName.substr(moduleName.lastIndexOf('/') + 1);
    }

    /**
     * Tries to find a running application which is working on a file described
     * in the passed options object.
     *
     * @param {String} moduleName
     *  The application type identifier.
     *
     * @param {Object} [launchOptions]
     *  A map of options that may contain a file descriptor in 'options.file'.
     *  If existing, compares it with the file descriptors of all running
     *  applications with the specified module identifier (returned by their
     *  getFileDescriptor() method).
     *
     * @returns {ox.ui.App}
     *  A running application of the specified type with a matching file
     *  descriptor.
     */
    function getRunningApplication(moduleName, launchOptions) {

        var // get file descriptor from options
            file = Utils.getObjectOption(launchOptions, 'file', null),

            // find running editor application
            runningApps = file ? ox.ui.App.get(moduleName).filter(function (app) {

                var // file descriptor of current running application
                    appFile = app.getFileDescriptor();

                // TODO: check file version too?
                if (file.source) { //mail or task attachment
                    return _.isObject(appFile) &&
                    (file.source === appFile.source) &&
                    (file.id === appFile.id) &&
                    (file.attached === appFile.attached) &&
                    (file.folder_id === appFile.folder_id);
                } else {
                    return _.isObject(appFile) &&
                    (file.id === appFile.id) &&
                    (file.folder_id === appFile.folder_id);
                }

            }) : [];
        if (runningApps.length > 1) {
            Utils.warn('ApplicationLauncher.getRunningApplication(): found multiple applications for the same file.');
        }
        return (runningApps.length > 0) ? runningApps[0] : null;
    }

    /**
     * Creates a new application object of the specified type, and performs
     * basic initialization steps.
     *
     * @param {String} moduleName
     *  The application type identifier.
     *
     * @param {Function} ApplicationClass
     *  The constructor function of the application mix-in class that will
     *  extend the core application object. Receives the passed launch options
     *  as first parameter.
     *
     * @param {Object} [appOptions]
     *  A map of options that control the creation of the ox.ui.App base class.
     *
     * @param {Object} [launchOptions]
     *  A map of options passed to the core launcher (the ox.launch() method)
     *  that determine the actions to perform during application launch.
     *
     * @returns {ox.ui.App}
     *  The new application object.
     */
    function createApplication(moduleName, ApplicationClass, appOptions, launchOptions) {

        var // the icon shown in the top bar launcher
            icon = Utils.getStringOption(appOptions, 'icon', ''),
            // the base application object
            app = ox.ui.createApp({
                name: moduleName,
                userContent: icon.length > 0,
                userContentIcon: icon,
                userContentClass: getDocumentType(moduleName) + '-launcher'
            });

        // mix-in constructor for additional application methods
        ApplicationClass.call(app, appOptions, launchOptions);

        return app;
    }

    // class BaseApplication ==================================================

    /**
     * A mix-in class that defines common public methods for an application
     * that is based on a document file.
     *
     * Triggers the events supported by the base class ox.ui.App, and the
     * following additional events:
     * - 'docs:init': Once during launch, after this application instance has
     *      been constructed completely.
     * - 'docs:import:before': Once during launch before the document described
     *      in the file descriptor will be imported by calling the import
     *      handler function passed to the constructor.
     * - 'docs:import:after': Once during launch, after the document described
     *      in the file descriptor has been imported (successfully or not).
     * - 'docs:import:success': Directly after the event 'docs:import:after',
     *      if the document described in the file descriptor has been imported
     *      successfully.
     * - 'docs:import:error': Directly after the event 'docs:import:after',
     *      if an error occurred while importing the document described in the
     *      file descriptor.
     * - 'docs:destroy': Before the model/view/controller instances of the
     *      application will be destroyed, after all registered before-quit
     *      handlers have been called, and none was rejected, after all
     *      registered quit handlers have been called.
     *
     * @constructor
     *
     * @extends ox.ui.App
     *
     * @param {Function} ModelClass
     *  The constructor function of the document model class. MUST derive from
     *  the class Model. Receives a reference to this application instance.
     *  MUST NOT use the methods BaseApplication.getModel(),
     *  BaseApplication.getView(), or BaseApplication.getController() during
     *  construction. For further initialization depending on valid
     *  model/view/controller instances, the constructor can register an event
     *  handler for the 'docs:init' event of this application.
     *
     * @param {Function} ViewClass
     *  The constructor function of the view class. MUST derive from the class
     *  View. Receives a reference to this application instance. MUST NOT use
     *  the methods BaseApplication.getModel(), BaseApplication.getView(), or
     *  BaseApplication.getController() during construction. For further
     *  initialization depending on valid model/view/controller instances, the
     *  constructor can register an event handler for the 'docs:init' event of
     *  this application.
     *
     * @param {Function} ControllerClass
     *  The constructor function of the controller class. MUST derive from the
     *  class Controller. Receives a reference to this application instance.
     *  MUST NOT use the methods BaseApplication.getModel(),
     *  BaseApplication.getView(), or BaseApplication.getController() during
     *  construction. For further initialization depending on valid
     *  model/view/controller instances, the constructor can register an event
     *  handler for the 'docs:init' event of this application.
     *
     * @param {Function} importHandler
     *  A function that will be called to import the document described in the
     *  file descriptor of this application. Will be called once after
     *  launching the application regularly, or after restoring the application
     *  from a save point after the browser has been opened or the web page has
     *  been reloaded. Will be called in the context of this application. If
     *  called from fail-restore, receives the save point as first parameter.
     *  Must return a Deferred object that will be resolved or rejected after
     *  the document has been loaded.
     *
     * @param {Object} [appOptions]
     *  A map of static application options, that have been passed to the
     *  static method BaseApplication.createLauncher().
     *
     * @param {Object} [launchOptions]
     *  A map of options passed to the core launcher (the ox.launch() method)
     *  that determine the actions to perform during application launch. The
     *  supported options are dependent on the actual application type. The
     *  entire launch options may be missing, e.g. if the application is
     *  restored after a browser refresh. The following standard launch options
     *  are supported:
     *  @param {String} launchOptions.action
     *      Controls how to connect the application to a document file. If the
     *      launch options map is passed at all, this is the only mandatory
     *      launch option.
     *  @param {Object} [launchOptions.file]
     *      The descriptor of the file to be imported, as provided and used by
     *      the Files application.
     *
     * @param {Object} [options]
     *  A map of options to control the behavior of the application. The
     *  following options are supported:
     *  @param {Function} [options.downloadHandler]
     *      A function that will be called before the document will be
     *      downloaded. Will be called in the context of this application. May
     *      return a Deferred object. In this case, the application will wait
     *      until this Deferred object has been resolved or rejected. In the
     *      latter case, the download will be aborted.
     */
    function BaseApplication(ModelClass, ViewClass, ControllerClass, importHandler, appOptions, launchOptions, options) {

        var // self reference
            self = this,

            // file descriptor of the document edited by this application
            file = Utils.getObjectOption(launchOptions, 'file', null),

            // callback before downloading the document
            downloadHandler = Utils.getFunctionOption(options, 'downloadHandler', $.noop),

            // all registered before-quit handlers
            beforeQuitHandlers = [],

            // all registered quit handlers
            quitHandlers = [],

            // all registered fail-save handlers
            failSaveHandlers = [],

            // Deferred object of the current call to Application.quit()
            currentQuitDef = null,

            // the document model instance
            model = null,

            // application view: contains panes, tool bars, etc.
            view = null,

            // the controller instance as single connection point between model and view
            controller = null,

            // browser timeouts for delayed callbacks
            delayTimeouts = [],

            // whether the document is completely imported
            imported = false;

        // private methods ----------------------------------------------------

        /**
         * Updates the application title according to the current file name. If
         * the application does not contain a file descriptor, shows the
         * localized word 'Unnamed' as title.
         *
         * @returns {BaseApplication}
         *  A reference to this application instance.
         */
        function updateTitle() {
            self.setTitle(self.getShortFileName() || gt('Unnamed'));
        }

        /**
         * Moves the entire view into the internal hidden storage node, and
         * shows the busy indicator.
         */
        function beforeImport() {
            view.hide();
            self.getWindow().busy();
        }

        /**
         * Hides the busy indicator, and restores the entire view into.
         */
        function afterImport() {
            view.show();
            self.getWindow().idle();
        }

        /**
         * Imports the document described by the current file descriptor, by
         * calling the import handler passed to the constructor.
         *
         * @param {Object} [point]
         *  The save point, if called from fail-restore.
         *
         * @returns {jQuery.Promise}
         *  The result of the import handler passed to the constructor of this
         *  application.
         */
        function importDocument(point) {

            // notify listeners
            self.trigger('docs:import:before');

            // call the import handler
            return importHandler.call(self, point)
                .always(function () {
                    imported = true;
                    afterImport();
                    self.trigger('docs:import:after');
                })
                .done(function () {
                    self.trigger('docs:import:success');
                })
                .fail(function (result) {
                    var title = Utils.getStringOption(result, 'title', gt('Load Error')),
                        message = Utils.getStringOption(result, 'message', gt('An error occurred while loading the document.')),
                        cause = Utils.getStringOption(result, 'cause', 'unknown');
                    if (cause !== 'timeout') {
                        view.showError(title, message);
                    }
                    Utils.error('BaseApplication.launch(): Importing document "' + self.getFullFileName() + '" failed. Error code: "' + cause + '".');
                    self.trigger('docs:import:error', cause);
                });
        }

        /**
         * Calls all handler functions contained in the passed array, and
         * returns a Deferred object that accumulates the result of all
         * handlers.
         */
        function callHandlers(handlers) {

            var // execute all handlers and store their results in an array
                results = _(handlers).map(function (handler) { return handler.call(self); });

            // accumulate all results into a single Deferred object
            return $.when.apply($, results);
        }

        // public methods -----------------------------------------------------

        /**
         * Returns the document type supported by this application. The
         * document type equals the directory name of the application.
         *
         * @returns {String}
         *  The document type of this application.
         */
        this.getDocumentType = function () {
            return getDocumentType(this.getName());
        };

        /**
         * Returns the document model instance of this application.
         *
         * @returns {DocumentModel}
         *  The document model instance of this application.
         */
        this.getModel = function () {
            return model;
        };

        /**
         * Returns the view instance of this application.
         *
         * @returns {View}
         *  The view instance of this application.
         */
        this.getView = function () {
            return view;
        };

        /**
         * Returns the controller instance of this application.
         *
         * @returns {Controller}
         *  The controller instance of this application.
         */
        this.getController = function () {
            return controller;
        };

        /**
         * Returns the global user settings for all applications of the same
         * type.
         *
         * @param {String} key
         *  The unique key of the user setting.
         *
         * @param defValue
         *  The default value in case the user setting does not exist yet.
         *
         * @returns
         *  The value of the global user setting.
         */
        this.getUserSettingsValue = function (key, defValue) {
            return Settings.get(this.getDocumentType() + '/' + key, defValue);
        };

        /**
         * Changes a global user setting for all applications of the same type.
         *
         * @param {String} key
         *  The unique key of the user setting.
         *
         * @param value
         *  The new value of the user setting.
         *
         * @returns {BaseApplication}
         *  A reference to this application instance.
         */
        this.setUserSettingsValue = function (key, value) {
            Settings.set(this.getDocumentType() + '/' + key, value).save();
            return this;
        };

        // file descriptor ----------------------------------------------------

        /**
         * Returns whether this application contains a valid file descriptor.
         */
        this.hasFileDescriptor = function () {
            return _.isObject(file);
        };

        /**
         * Returns a clone of the file descriptor of the document edited by
         * this application.
         *
         * @returns {Object}
         *  A clone of the current file descriptor.
         */
        this.getFileDescriptor = function () {
            return _.clone(file);
        };

        /**
         * Registers the file descriptor of the new document created by this
         * application. Must not be called if the application already contains
         * a valid file descriptor.
         *
         * @param {Object} newFile
         *  The file descriptor of the new file created by the caller of this
         *  method.
         *
         * @returns {BaseApplication}
         *  A reference to this instance.
         */
        this.registerFileDescriptor = function (newFile) {
            if (_.isObject(file)) {
                Utils.error('BaseApplication.registerFileDescriptor(): file descriptor exists already');
            } else {
                file = newFile;
                FilesAPI.propagate('new', file);
                updateTitle();
            }
            return this;
        };

        /**
         * Updates the current file descriptor of the document edited by this
         * application.
         *
         * @param {Object} fileOptions
         *  A map with some file descriptor properties to be updated.
         *
         * @returns {BaseApplication}
         *  A reference to this instance.
         */
        this.updateFileDescriptor = function (fileOptions) {
            if (_.isObject(file)) {
                _.extend(file, fileOptions);
                FilesAPI.propagate('change', file);
                updateTitle();
            }
            return this;
        };

        /**
         * Returns an object with attributes describing the file currently
         * opened by this application.
         *
         * @param {Object} [options]
         *  A map with options to control the behavior of this method. The
         *  following options are supported:
         *  @param {Boolean} [options.encodeUrl=false]
         *      If set to true, special characters not allowed in URLs will be
         *      encoded.
         *
         * @returns {Object|Null}
         *  An object with file attributes, if existing; otherwise null.
         */
        this.getFileParameters = function (options) {

            var // function to encode a string to be URI conforming if specified
                encodeString = Utils.getBooleanOption(options, 'encodeUrl', false) ? encodeURIComponent : _.identity;

            return file ? {
                id: encodeString(file.id),
                folder_id: encodeString(file.folder_id),
                filename: encodeString(file.filename),
                version: encodeString(file.version),
                source: encodeString(file.source),
                attached: encodeString(file.attached),
                module: encodeString(file.module)
            } : null;
        };

        /**
         * Returns the full file name of the current file, with file extension.
         *
         * @returns {String|Null}
         *  The file name of the current file descriptor; or null, if no file
         *  descriptor exists.
         */
        this.getFullFileName = function () {
            return Utils.getStringOption(file, 'filename', null);
        };

        /**
         * Returns the short file name of the current file (without file
         * extension).
         *
         * @returns {String|Null}
         *  The short file name of the current file descriptor; or null, if no
         *  file descriptor exists.
         */
        this.getShortFileName = function () {
            var fileName = this.getFullFileName();
            return _.isString(fileName) ? ExtensionRegistry.getBaseName(fileName) : null;
        };

        /**
         * Returns the file extension of the current file (without leading
         * period).
         *
         * @returns {String|Null}
         *  The file extension of the current file descriptor; or null, if no
         *  file descriptor exists.
         */
        this.getFileExtension = function () {
            var fileName = this.getFullFileName();
            return _.isString(fileName) ? ExtensionRegistry.getExtension(fileName) : null;
        };

        /**
         * Return whether importing the document has been completed regardless
         * whether it was successful. Will be false before this application
         * triggers the 'docs:import:after' event, and true afterwards.
         *
         * @returns {Boolean}
         *  Whether importing the document has been completed.
         */
        this.isImportFinished = function () {
            return imported;
        };

        /**
         * Checks if application is processing before-quit or quit handlers.
         *
         * @returns {Boolean}
         *  Whether the application is currently processing any before-quit or
         *  quit handlers.
         */
        this.isInQuit = function () {
            return currentQuitDef !== null;
        };

        // server requests ----------------------------------------------------

        /**
         * Sends a request to the server and returns the Promise of a Deferred
         * object waiting for the response. The unique identifier of this
         * application will be added to the request parameters automatically.
         * See method IO.sendRequest() for further details.
         *
         * @param {Object} options
         *  Additional options. See method IO.sendRequest() for details.
         *
         * @returns {jQuery.Promise}
         *  The Promise of the request. See method IO.sendRequest() for
         *  details.
         */
        this.sendRequest = function (options) {

            // build a default map with the application UID, and add the passed options
            options = Utils.extendOptions({
                params: {
                    uid: this.get('uniqueID')
                }
            }, options);

            // send the request
            return IO.sendRequest(options);
        };

        /**
         * Sends a request to the server and returns the Promise of a Deferred
         * object waiting for the response. The unique identifier of this
         * application, and the parameters of the file currently opened by the
         * application will be added to the request parameters automatically.
         * See method IO.sendRequest() for further details.
         *
         * @param {String} module
         *  The name of the server module.
         *
         * @param {Object} options
         *  Additional options. See method IO.sendRequest() for details.
         *
         * @returns {jQuery.Promise}
         *  The Promise of the request. Will be rejected immediately, if this
         *  application is not connected to a document file. See method
         *  IO.sendRequest() for details.
         */
        this.sendFileRequest = function (module, options) {

            // reject immediately if no file is present
            if (!this.hasFileDescriptor()) {
                return $.Deferred().reject();
            }

            // build default options, and add the passed options
            options = Utils.extendOptions({
                module: module,
                params: this.getFileParameters()
            }, options);

            // send the request
            return this.sendRequest(options);
        };

        /**
         * Sends a request to the document filter server module. See method
         * BaseApplication.sendFileRequest() for further details.
         */
        this.sendFilterRequest = function (options) {
            return this.sendFileRequest(BaseApplication.FILTER_MODULE_NAME, options);
        };

        /**
         * Sends a request to the document converter server module. See method
         * BaseApplication.sendFileRequest() for further details.
         */
        this.sendConverterRequest = function (options) {
            return this.sendFileRequest(BaseApplication.CONVERTER_MODULE_NAME, options);
        };

        /**
         * Creates and returns the URL of a server request.
         *
         * @param {String} module
         *  The name of the server module.
         *
         * @param {Object} [options]
         *  Additional parameters inserted into the URL.
         *
         * @returns {String|Undefined}
         *  The final URL of the server request; or undefined, if the
         *  application is not connected to a document file, or the current
         *  session is invalid.
         */
        this.getServerModuleUrl = function (module, options) {

            // return nothing if no file is present
            if (!ox.session || !this.hasFileDescriptor()) {
                return;
            }

            // build a default options map, and add the passed options
            options = Utils.extendOptions(
                { session: ox.session, uid: this.get('uniqueID') },
                this.getFileParameters({ encodeUrl: true }),
                options
            );

            // build and return the resulting URL
            return ox.apiRoot + '/' + module + '?' + _(options).map(function (value, name) { return name + '=' + value; }).join('&');
        };

        /**
         * Creates and returns the URL of server requests used to convert a
         * document file with the document filter module.
         *
         * @param {Object} [options]
         *  Additional parameters inserted into the URL.
         *
         * @returns {String|Undefined}
         *  The final URL of the request to the document filter module; or
         *  undefined, if the application is not connected to a document file,
         *  or the current session is invalid.
         */
        this.getFilterModuleUrl = function (options) {
            return this.getServerModuleUrl(BaseApplication.FILTER_MODULE_NAME, options);
        };

        /**
         * Creates and returns the URL of server requests used to convert a
         * document file with the document converter module.
         *
         * @param {Object} [options]
         *  Additional parameters inserted into the URL.
         *
         * @returns {String|Undefined}
         *  The final URL of the request to the document converter module; or
         *  undefined, if the application is not connected to a document file,
         *  or the current session is invalid.
         */
        this.getConverterModuleUrl = function (options) {
            return this.getServerModuleUrl(BaseApplication.CONVERTER_MODULE_NAME, options);
        };

        /**
         * Creates an <img> element, sets the passed URL, and returns a
         * Deferred object waiting that the image has been loaded. If the
         * browser does not trigger the appropriate events after the specified
         * timeout, the Deferred object will be rejected automatically. If the
         * application has been shut down before the image has been loaded, the
         * pending Deferred object will neither be resolved nor rejected.
         *
         * @param {String} url
         *  The image URL.
         *
         * @param {Number} [timeout=10000]
         *  The time before the Deferred will be rejected without response from
         *  the image node.
         *
         * @returns {jQuery.Promise}
         *  The Promise of a Deferred object that will be resolved with the
         *  image element (as jQuery object), when the 'load' event has been
         *  received from the image node; or rejected, if the 'error' event has
         *  been received from the image, or after the specified timeout delay
         *  without response.
         */
        this.createImageNode = function (url, timeout) {

            var // the result Deferred object
                def = $.Deferred(),
                // the image node
                imgNode = $('<img>', { src: url }),
                // the timer for the 10 seconds timeout
                timer = null;

            function loadHandler() {
                // do not resolve if application is already shutting down
                if (delayTimeouts) { def.resolve(imgNode); }
            }

            function errorHandler() {
                // do not reject if application is already shutting down
                if (delayTimeouts) { def.reject(); }
            }

            // wait that the image is loaded
            imgNode.one({ load: loadHandler, error: errorHandler });

            // timeout if server hangs, or browser fails to send any events because
            // of internal errors (e.g.: SVG parse errors in Internet Explorer)
            timer = this.executeDelayed(function () {
                def.reject();
            }, { delay: _.isNumber(timeout) ? timeout : 10000 });

            return def.always(function () {
                timer.abort();
                imgNode.off({ load: loadHandler, error: errorHandler });
            }).promise();
        };

        // application setup --------------------------------------------------

        /**
         * Registers a quit handler function that will be executed before the
         * application will be closed.
         *
         * @param {Function} beforeQuitHandler
         *  A function that will be called before the application will be
         *  closed. Will be called in the context of this application instance.
         *  May return a Deferred object, which must be resolved or rejected by
         *  the quit handler function. If the Deferred object will be rejected,
         *  the application remains alive.
         *
         * @returns {BaseApplication}
         *  A reference to this application instance.
         */
        this.registerBeforeQuitHandler = function (beforeQuitHandler) {
            beforeQuitHandlers.push(beforeQuitHandler);
            return this;
        };

        /**
         * Registers a quit handler function that will be executed before the
         * application will be destroyed. This may happen if the application
         * has been closed normally, if the user logs out from the entire
         * AppSuite, or before the browser window or browser tab will be closed
         * or refreshed. If the quit handlers return a Deferred object, closing
         * the application, and logging out will be deferred until the Deferred
         * objects have been resolved or rejected.
         *
         * @param {Function} quitHandler
         *  A function that will be called before the application will be
         *  closed. Will be called in the context of this application instance.
         *  May return a Deferred object, which must be resolved or rejected by
         *  the quit handler function.
         *
         * @returns {BaseApplication}
         *  A reference to this application instance.
         */
        this.registerQuitHandler = function (quitHandler) {
            quitHandlers.push(quitHandler);
            return this;
        };

        /**
         * Registers a handler function that will be executed when the
         * application creates a new save point.
         *
         * @param {Function} failSaveHandler
         *  A function that will be called when the application creates a new
         *  save point. Will be called in the context of this application
         *  instance. Must return an object the new save point will be extended
         *  with.
         *
         * @returns {BaseApplication}
         *  A reference to this application instance.
         */
        this.registerFailSaveHandler = function (failSaveHandler) {
            failSaveHandlers.push(failSaveHandler);
            return this;
        };

        /**
         * Registers an event handler for specific events at the passed target
         * object. The event handler will be unregistered automatically when
         * the application has been closed.
         *
         * @param {HTMLElement|Window|jQuery} target
         *  The target object the event handler will be bound to. Can be a DOM
         *  node, the browser window, or a jQuery object containing DOM nodes
         *  and/or the browser window.
         *
         * @param {String} events
         *  The names of the events, as space-separated string.
         *
         * @param {Function} handler
         *  The event handler function that will be bound to the specified
         *  events.
         *
         * @returns {BaseApplication}
         *  A reference to this application instance.
         */
        this.registerEventHandler = function (target, events, handler) {

            // bind event handler to events
            $(target).on(events, handler);

            // unbind event handler when application is closed
            this.on('quit', function () {
                $(target).off(events, handler);
            });

            return this;
        };

        /**
         * Executes all registered quit handlers and returns a Deferred object
         * that will be resolved or rejected according to the results of the
         * handlers.
         *
         * @internal
         *  Not for external use. Only used from the implementation of the
         *  'io.ox/core/logout' extension point.
         */
        this.executeQuitHandlers = function () {
            return callHandlers(quitHandlers);
        };

        // timeouts -----------------------------------------------------------

        /**
         * Invokes the passed callback function once in a browser timeout. If
         * the application will be closed before the callback function has been
         * started, it will not be called anymore.
         *
         * @param {Function} callback
         *  The callback function that will be executed in a browser timeout
         *  after the delay time. Does not receive any parameters.
         *
         * @param {Object} [options]
         *  A map with options controlling the behavior of this method. The
         *  following options are supported:
         *  @param {Object} [options.context]
         *      The context that will be bound to 'this' in the passed callback
         *      function.
         *  @param {Number} [options.delay=0]
         *      The time (in milliseconds) the execution of the passed callback
         *      function will be delayed.
         *
         * @returns {jQuery.Promise}
         *  The Promise of a Deferred object that will be resolved after the
         *  callback function has been executed. If the callback function
         *  returns a simple value or object, the Deferred object will be
         *  resolved with that value. If the callback function returns a
         *  Deferred object or a Promise by itself, its state and result value
         *  will be forwarded to the Promise returned by this method. The
         *  Promise contains an additional method 'abort()' that can be called
         *  before the timeout has been fired to cancel the pending execution
         *  of the callback function. In that case, the Promise will neither be
         *  resolved nor rejected. When the application will be closed, it
         *  aborts all pending callback functions automatically (also, without
         *  resolving the Promise).
         */
        this.executeDelayed = function (callback, options) {

            var // the current browser timeout identifier
                timeout = null,
                // the context for the callback function
                context = Utils.getOption(options, 'context'),
                // the delay time for the next execution of the callback
                delay = Utils.getIntegerOption(options, 'delay', 0, 0),
                // the result Deferred object
                def = $.Deferred(),
                // the Promise of the Deferred object
                promise = def.promise();

            function unregisterTimeout() {
                delayTimeouts = _(delayTimeouts).without(timeout);
                timeout = null;
            }

            // do not call from other unregistered pending timeouts when application closes
            if (delayTimeouts) {

                // create a new browser timeout
                timeout = window.setTimeout(function () {

                    // first, unregister the timeout
                    unregisterTimeout();

                    // execute the callback function, react on its result
                    $.when(callback.call(context))
                    .done(function (result) { def.resolve(result); })
                    .fail(function (result) { def.reject(result); });

                }, delay);

                // register the browser timeout
                delayTimeouts.push(timeout);
            }

            // add an abort() method to the Promise
            promise.abort = function () {
                if (timeout) {
                    window.clearTimeout(timeout);
                    unregisterTimeout();
                    // leave the Deferred object unresolved
                }
            };

            return promise;
        };

        /**
         * Invokes the passed callback function repeatedly in a browser timeout
         * loop. If the application will be closed before the callback function
         * has been started, or while the callback function will be repeated,
         * it will not be called anymore.
         *
         * @param {Function} callback
         *  The callback function that will be invoked repeatedly in a browser
         *  timeout loop after the initial delay time. Does not receive any
         *  parameters. The return value of the function will be used to decide
         *  whether to continue the repeated execution. If the function returns
         *  Utils.BREAK, execution will be stopped. If the function returns a
         *  Deferred object, or the Promise of a Deferred object, looping will
         *  be deferred until the Deferred object is resolved or rejected.
         *  After resolving the Deferred object, the delay time will start, and
         *  the callback will be called again. Otherwise, after the Deferred
         *  object has been rejected, execution will be stopped. All other
         *  return values will be ignored, and the callback loop will continue.
         *
         * @param {Object} [options]
         *  A map with options controlling the behavior of this method. The
         *  following options are supported:
         *  @param {Object} [options.context]
         *      The context that will be bound to 'this' in the passed callback
         *      function.
         *  @param {Number} [options.delay=0]
         *      The time (in milliseconds) the execution of the passed callback
         *      function will be delayed.
         *  @param {Number} [options.repeatDelay=options.delay]
         *      The time (in milliseconds) the repeated execution of the passed
         *      callback function will be delayed. If omitted, the specified
         *      initial delay time (option 'options.delay') will be used.
         *
         * @returns {jQuery.Promise}
         *  The Promise of a Deferred object that will be resolved after the
         *  callback function has been invoked the last time. This Promise
         *  contains an additional method 'abort()' that can be called before
         *  or while the callback loop is executed to stop the loop
         *  immediately. In that case, the Promise will never be resolved. When
         *  the application will be closed, it aborts all running callback
         *  loops automatically (also, without resolving the Promise).
         */
        this.repeatDelayed = function (callback, options) {

            var // the current timeout before invoking the callback
                timer = null,
                // the context for the callback function
                context = Utils.getOption(options, 'context'),
                // the delay time for the next execution of the callback
                delay = Utils.getIntegerOption(options, 'delay', 0, 0),
                // the result Deferred object
                def = $.Deferred();

            // creates and registers a browser timeout that executes the callback
            function createTimer() {

                // create a new browser timeout
                timer = self.executeDelayed(function () {

                    var // the result of the callback
                        result = callback.call(context);

                    if (result === Utils.BREAK) {
                        def.resolve();
                    } else {
                        $.when(result)
                        .done(function () {
                            // do not create a new timeout if execution has been
                            // aborted while the asynchronous code was running
                            if (timer) { createTimer(); }
                        })
                        .fail(function () {
                            def.resolve();
                        });
                    }

                }, Utils.extendOptions(options, { delay: delay }));
            }

            // create initial timer, switch to repetition delay time
            createTimer();
            delay = Utils.getIntegerOption(options, 'repeatDelay', delay, 0);

            // add an abort() method to the Promise
            return _.extend(def.promise(), { abort: function () {
                timer.abort();
                timer = null;
            } });
        };

        /**
         * Invokes the passed callback function repeatedly for small chunks of
         * the passed data array in a browser timeout loop. If the application
         * will be closed before the callback function has been started, or
         * while the callback function will be repeated, it will not be called
         * anymore.
         *
         * @param {Function} callback
         *  The callback function that will be invoked repeatedly in a browser
         *  timeout loop after the initial delay time. Receives the following
         *  parameters:
         *  (1) {Array|jQuery} chunk
         *      The current chunk of the data array passed in the 'dataArray'
         *      method parameter. The actual type  depends on the return type
         *      of the slice() method of the passed data array (e.g., the
         *      slice() method of jQuery collections returns a new jQuery
         *      collection).
         *  (2) {Number} index
         *      The absolute index of the first element of the chunk in the
         *      complete array.
         *  (3) {Array|jQuery} dataArray
         *      The entire data array as passed in the 'dataArray' method
         *      parameter.
         *  The return value of the function will be used to decide whether to
         *  continue the repeated execution to the end of the array. If the
         *  function returns Utils.BREAK, execution will be stopped. If the
         *  function returns a Deferred object, or the Promise of a Deferred
         *  object, looping will be deferred until the Deferred object is
         *  resolved or rejected. After resolving the Deferred object, the
         *  delay time will start, and the callback will be called again for
         *  the chunk in the array. Otherwise, after the Deferred object has
         *  been rejected, execution will be stopped. All other return values
         *  will be ignored, and the callback loop will continue to the end of
         *  the array.
         *
         * @param {Array|jQuery} dataArray
         *  A JavaScript array, or another array-like object that provides an
         *  attribute 'length' and a method 'slice(begin, end)', e.g. a jQuery
         *  collection.
         *
         * @param {Object} [options]
         *  A map with options controlling the behavior of this method. The
         *  following options are supported:
         *  @param {Object} [options.context]
         *      The context that will be bound to 'this' in the passed callback
         *      function.
         *  @param {Number} [options.chunkLength=10]
         *      The number of elements that will be extracted from the passed
         *      data array and will be passed to the callback function.
         *  @param {Number} [options.delay=0]
         *      The time (in milliseconds) the execution of the passed callback
         *      function will be delayed.
         *  @param {Number} [options.repeatDelay=options.delay]
         *      The time (in milliseconds) the repeated execution of the passed
         *      callback function will be delayed. If omitted, the specified
         *      initial delay time (option 'options.delay') will be used.
         *
         * @returns {jQuery.Promise}
         *  The Promise of a Deferred object that will be resolved after all
         *  array elements have been processed successfully; or rejected, if
         *  the callback function returns Utils.BREAK or a rejected Deferred
         *  object. The Promise will be notified about the progress (as a
         *  floating-point value between 0.0 and 1.0). The Promise contains an
         *  additional method 'abort()' that can be called before processing
         *  all array elements has been finished to cancel the entire loop
         *  immediately. In that case, the Promise will neither be resolved nor
         *  rejected. When the application will be closed, it aborts all
         *  running loops automatically (also, without resolving nor rejecting
         *  the Promise).
         */
        this.processArrayDelayed = function (callback, dataArray, options) {

            var // the result Deferred object
                def = $.Deferred(),
                // the timer executing the callback function for the array chunks
                timer = null,
                // the context for the callback function
                context = Utils.getOption(options, 'context'),
                // the length of a single chunk in the array
                chunkLength = Utils.getIntegerOption(options, 'chunkLength', 10, 1),
                // current array index
                index = 0;

            // check passed data array
            if (dataArray.length === 0) {
                return _.extend($.when(), { abort: $.noop });
            }

            // start a background loop, pass the delay times passed to this method
            timer = self.repeatDelayed(function () {

                var // the result of the callback
                    result = null;

                // notify listeners about the progress
                def.notify(index / dataArray.length);

                // execute the callback, return whether to repeat execution
                result = callback.call(context, dataArray.slice(index, index + chunkLength), index, dataArray);

                // immediately break the loop, if Utils.BREAK is returned
                if (result === Utils.BREAK) {
                    def.reject();
                    // stop the loop timer
                    return Utils.BREAK;
                }

                // handle Deferred objects returned by the callback
                return $.when(result)
                .fail(function () {
                    // immediately break the loop, if returned Deferred has been rejected
                    def.reject();
                    // the Deferred returned by $.when(result) is rejected, so the
                    // background loop will be stopped automatically
                })
                .then(function () {
                    // prepare next iteration
                    index += chunkLength;
                    // keep the background loop running inside the array
                    if (index < dataArray.length) { return; }
                    // loop has been finished successfully
                    def.notify(1).resolve();
                    // returning a rejected Deferred stops the loop timer
                    return $.Deferred().reject();
                });

            }, options);

            // extend the promise with an 'abort()' method that aborts the timer
            return _.extend(def.promise(), { abort: function () { timer.abort(); } });
        };

        /**
         * Creates a debounced method that can be called multiple times during
         * the current script execution. The passed callback will be executed
         * once in a browser timeout.
         *
         * @param {Function} directCallback
         *  A function that will be called every time the debounced method has
         *  been called. Receives all parameters that have been passed to the
         *  debounced method.
         *
         * @param {Function} deferredCallback
         *  A function that will be called in a browser timeout after the
         *  debounced method has been called at least once during the execution
         *  of the current script.
         *
         * @param {Object} [options]
         *  A map with options controlling the behavior of the debounced method
         *  created by this method. Supports all options also supported by the
         *  method BaseApplication.executeDelayed(). If a context is specified
         *  with the option 'options.context', it will be used for both
         *  callback functions. Note that the delay time will restart after
         *  each call of the debounced method, causing the execution of the
         *  deferred callback to be postponed until the debounced method has
         *  not been called again during the delay (this is the behavior of the
         *  _.debounce() method). Additionally, supports the following options:
         *  @param {Number} [options.maxDelay]
         *      If specified, a delay time used as a hard limit to execute the
         *      deferred callback after the first call of the debounced method,
         *      even if it has been called repeatedly afterwards and the normal
         *      delay time is still running.
         *
         * @returns {Function}
         *  The debounced method that can be called multiple times, and that
         *  executes the deferred callback function once after execution of the
         *  current script ends. Passes all arguments to the direct callback
         *  function, and returns its result.
         */
        this.createDebouncedMethod = function (directCallback, deferredCallback, options) {

            var // the context for the callback functions
                context = Utils.getOption(options, 'context'),
                // whether to not restart the timer on repeated calls with delay time
                maxDelay = Utils.getIntegerOption(options, 'maxDelay', 0),
                // the current timer used to execute the callback
                debounceTimer = null,
                // timer used for the maxDelay option
                maxTimer = null,
                // first call in this stack frame
                firstCall = true;

            // callback for a delay timer, executing the deferred callback
            function timerCallback() {
                // execute the callback and return its result (for repeated execution)
                return deferredCallback.call(context);
            }

            // aborts and clears all timers
            function clearTimers() {
                if (debounceTimer) { debounceTimer.abort(); }
                if (maxTimer) { maxTimer.abort(); }
                debounceTimer = maxTimer = null;
                firstCall = true;
            }

            // creates the timers that execute the deferred callback
            function createTimers() {

                // abort running timer on first call
                if (firstCall && debounceTimer) {
                    debounceTimer.abort();
                    debounceTimer = null;
                }

                // create a new timeout executing the callback function
                if (!debounceTimer) {
                    debounceTimer = self.executeDelayed(timerCallback, options).done(clearTimers);
                }

                // reset the first-call flag, but set it back in a direct
                // timeout, this helps to prevent recreation of the browser
                // timeout on every call of the debounced method
                firstCall = false;
                _.defer(function () { firstCall = true; });

                // on first call, create a timer for the maximum delay
                if (!maxTimer && (maxDelay > 0)) {
                    maxTimer = self.executeDelayed(timerCallback, Utils.extendOptions(options, { delay: maxDelay })).done(clearTimers);
                }
            }

            // create and return the debounced method
            return function () {

                // create a new timeout executing the callback function
                createTimers();

                // call the direct callback with the passed arguments
                return directCallback.apply(context, _.toArray(arguments));
            };
        };

        // application runtime ------------------------------------------------

        /**
         * Downloads a file from the server, specified by the passed URL. If
         * the passed object is a Deferred object, the method waits for it to
         * resolve to the file URL, but immediately opens a pop-up window in
         * the background to prevent that the browser pop-up blocker will be
         * triggered.
         *
         * @param {String|jQuery.Deferred|jQuery.Promise} fileUrl
         *  The URL of the document. If this parameter is a Deferred object or
         *  a Promise, waits for it to be resolved with the file URL.
         *
         * @returns {jQuery.Promise}
         *  The Promise of a Deferred object that will be resolved if the file
         *  has been downloaded successfully, or rejected otherwise (e.g. when
         *  a pop-up blocker prevents the download).
         */
        this.downloadFile = function (fileUrl) {

            var // the pop-up window used to download the file
                popupWindow = null,
                // the result Deferred object
                def = $.Deferred();

            // synchronous mode: open the file directly in a new window
            if (_.isString(fileUrl)) {
                // browser plug-ins may prevent opening pop-up windows, TODO: show warning?
                return window.open(fileUrl) ? def.resolve(fileUrl) : def.reject();
            }

            // passed Deferred already rejected: do not open pop-up window
            if (fileUrl.state() === 'rejected') {
                // TODO: show warning?
                return def.reject();
            }

            // open pop-up window early to prevent browser pop-up blockers
            popupWindow = window.open('about:blank', '_blank');
            window.focus();

            // browser plug-ins may still prevent opening pop-up windows, TODO: show warning?
            if (!popupWindow) {
                return def.reject();
            }

            // block application window while waiting for the file URL
            view.enterBusy();

            // wait for the result of the Deferred object
            fileUrl
            .always(function () {
                view.leaveBusy();
            })
            .done(function (url) {
                popupWindow.location = url;
                popupWindow.focus();
                def.resolve(url);
            })
            .fail(function () {
                popupWindow.close();
                view.grabFocus();
                def.reject();
            });

            return def.promise();
        };

        /**
         * Downloads the document file currently opened by this application.
         *
         * @param {String} [format='native']
         *  The requested file format. The default format 'native' will return
         *  the document in its native file format.
         *
         * @returns {jQuery.Promise}
         *  The Promise of a Deferred object that will be resolved if the
         *  document file has been downloaded successfully, or rejected
         *  otherwise.
         */
        this.download = function (format) {

            var // call the download handler first
                downloadHandlerResult = downloadHandler.call(self, format);

            return $.when(downloadHandlerResult).then(function () {

                var // the download URL of the document
                    documentUrl = self.getFilterModuleUrl({
                        action: 'getdocument',
                        documentformat: format || 'native',
                        filename: self.getFullFileName(),
                        mimetype: self.getFileDescriptor().file_mimetype || ''
                    });

                return self.downloadFile(documentUrl);
            })
            .promise();
        };

        /**
         * Prints the document file currently opened by this application.
         *
         * @returns {jQuery.Promise}
         *  The Promise of a Deferred object that will be resolved if the
         *  document file has been printed successfully, or rejected otherwise.
         */
        this.print = function () {
            return this.download('pdf');
        };

        /**
         * Creates a new mail message with the current document attached
         *
         */
        this.sendMail = function () {
            var // call the download handler first
                downloadHandlerResult = downloadHandler.call(self);
            $.when(downloadHandlerResult).then(function () {

                var // the file descriptor of the document
                    fileDescriptor = self.getFileDescriptor();
                //fileDescriptor.mailFolder, .mailUID
                require(['io.ox/mail/write/main'], function (m) {
                    m.getApp().launch().done(function () {
                        this.compose().done(function (result) {
                            result.app.addFiles([fileDescriptor]);
                        });
                    });
                });

            });
        };
        /**
         * Will be called automatically from the OX core framework to create
         * and return a save point containing the current state of the
         * application.
         *
         * @attention
         *  This method is an implementation of the public API of ox.ui.App, it
         *  is not intended to be called directly.
         *
         * @returns {Object}
         *  The save point structure containing the application state.
         */
        this.failSave = function () {

            var // create the new save point with basic information
                savePoint = {
                    module: this.getName(),
                    icon: Utils.getStringOption(appOptions, 'icon'),
                    description: this.getFullFileName(),
                    point: { file: _.clone(file) }
                };

            // OX Files inserts reference to application object into file descriptor,
            // remove it to be able to serialize without cyclic references
            delete savePoint.point.file.app;

            // call all fail-save handlers and add their data to the save point
            _(failSaveHandlers).each(function (failSaveHandler) {
                _(savePoint.point).extend(failSaveHandler.call(this));
            }, this);

            return savePoint;
        };

        /**
         * Will be called automatically from the OX core framework to restore
         * the state of the application after a browser refresh.
         *
         * @attention
         *  This method is an implementation of the public API of ox.ui.App, it
         *  is not intended to be called directly.
         *
         * @param {Object} point
         *  The save point containing the application state, as returned by the
         *  last call of the BaseApplication.failSave() method.
         */
        this.failRestore = function (point) {

            // set file descriptor from save point
            file = Utils.getObjectOption(point, 'file', null);

            // check existence of file descriptor, import the document
            if (this.hasFileDescriptor()) {
                importDocument(point);
            }
        };

        // initialization -----------------------------------------------------

        // call all registered launch handlers
        this.setLauncher(function () {

            var // the result Deferred object
                def = $.Deferred(),
                // create the application window
                win = ox.ui.createWindow({
                    name: self.getName(),
                    search: Utils.getBooleanOption(appOptions, 'search', false),
                    chromeless: Utils.getBooleanOption(appOptions, 'chromeless', false)
                });

            // set the window at the application instance
            self.setWindow(win);

            // wait for unload events and execute quit handlers
            self.registerEventHandler(window, 'unload', function () { callHandlers(quitHandlers); });

            // create the MVC instances
            model = new ModelClass(self);
            view = new ViewClass(self);
            controller = new ControllerClass(self);

            // disable global spell checking while this application is active
            win.on({
                show: function () { $('body').attr('spellcheck', false); },
                hide: function () { $('body').removeAttr('spellcheck'); }
            });

            // wait for import handler, kill the application if no file descriptor
            // is present after fail-restore (using absence of the launch option
            // 'action' as indicator for fail-restore)
            if (!_.isObject(launchOptions) || !_.isString(launchOptions.action)) {

                // the 'open' event of the window is triggered once after launch *and* fail-restore
                // TODO: this seems fragile, is there a better way to determine
                // whether a valid fail-restore follows after launching the app?
                win.one('open', function () {
                    def.always(function () {
                        if (!file) {
                            _.defer(function () { self.quit(); });
                        }
                    });
                });
            }

            // call initialization listeners before showing the application
            // window (this is important for fail-restore which will be
            // triggered before the window show callback will be executed)
            self.trigger('docs:init');

            // in order to get the 'open' event of the window at all, it must be shown (also without file)
            win.show(function () {

                // prepare for importing
                beforeImport();

                // Import the document, if launch options have been passed. No launch
                // options are available in fail-restore, this situation will be handled
                // by the failRestore() method above. Always resolve the result Deferred
                // object (expected by the core launcher).
                if (_.isObject(launchOptions)) {
                    importDocument().always(function () { def.resolve(); });
                } else {
                    def.resolve();
                }
            });
        });

        // call all registered quit handlers
        this.setQuit(function () {
            // return existing Deferred if a quit request is already running
            if (currentQuitDef && (currentQuitDef.state() === 'pending')) {
                return currentQuitDef.promise();
            }

            // create the result deferred (rejecting means resume application)
            currentQuitDef = $.Deferred();

            // call all before-quit handlers, rejecting one will resume application
            callHandlers(beforeQuitHandlers)
            .done(function () {

                // execute quit handlers, simply defer without caring about the result
                callHandlers(quitHandlers)
                .always(function () {

                    // cancel all running timeouts
                    _(delayTimeouts).each(function (timeout) {
                        window.clearTimeout(timeout);
                    });
                    // prevent to start new timeouts
                    delayTimeouts = null;

                    // always resolve (really close the application), regardless
                    // of the result of the quit handlers
                    currentQuitDef.resolve();
                });
            })
            .fail(function () {
                currentQuitDef.reject();
            });

            return currentQuitDef.always(function () { currentQuitDef = null; }).promise();
        });

        // prevent usage of these methods in derived classes
        delete this.setLauncher;
        delete this.setQuit;

        // destroy MVC instances after core 'quit' event (after window has been hidden)
        this.on('quit', function () {
            // trigger listeners before destroying the MVC instances
            self.trigger('docs:destroy');
            controller.destroy();
            view.destroy();
            model.destroy();
            model = view = controller = null;
        });

        // set application title to current file name
        updateTitle();

    } // class BaseApplication

    // constants --------------------------------------------------------------

    /**
     * The name of the document filter server module.
     */
    BaseApplication.FILTER_MODULE_NAME = 'oxodocumentfilter';

    /**
     * The name of the document converter server module.
     */
    BaseApplication.CONVERTER_MODULE_NAME = 'oxodocumentconverter';

    // static methods ---------------------------------------------------------

    /**
     * Creates a static launcher that has to be returned by the main module of
     * each application type. The launcher tries to find a running application
     * which is working on a file described in the launch options passed to the
     * launcher. If no such application exists, it creates and returns a new
     * application object.
     *
     * @param {String} moduleName
     *  The application type identifier.
     *
     * @param {Function} ApplicationClass
     *  The constructor function of the application mix-in class that will
     *  extend the core application object. Receives the launch options passed
     *  to the launcher as first parameter.
     *
     * @param {Object} [appOptions]
     *  A map of options that control the creation of the ox.ui.App base class.
     *  The following options are supported:
     *  @param {String} [appOptions.icon]
     *      If specified, the CSS class name of a Bootstrap icon that will be
     *      shown in the top level launcher tab next to the application title.
     *  @param {Boolean} [options.search=false]
     *      Whether the application window will contain and support the global
     *      search tool bar.
     *  @param {Boolean} [options.chromeless=false]
     *      Whether to hide the main window tool bar attached to the left or
     *      bottom border.
     *
     * @returns {Object}
     *  The launcher object expected by the ox.launch() method.
     */
    BaseApplication.createLauncher = function (moduleName, ApplicationClass, appOptions) {

        // executed when a new application will be launched via ox.launch()
        function launchApp(launchOptions) {

            var // try to find a running application
                app = getRunningApplication(moduleName, launchOptions);

            // no running application: create and initialize a new application object
            if (!_.isObject(app)) {
                app = createApplication(moduleName, ApplicationClass, appOptions, launchOptions);
            }

            return app;
        }

        // listen to user logout and notify all running applications
        ext.point('io.ox/core/logout').extend({
            id: moduleName + '/logout',
            logout: function () {
                var deferreds = _(ox.ui.App.get(moduleName)).map(function (app) {
                    return app.executeQuitHandlers();
                });
                return $.when.apply($, deferreds);
            }
        });

        // ox.launch() expects an object with the method getApp()
        return { getApp: launchApp };
    };

    // exports ================================================================

    return _.makeExtendable(BaseApplication);

});
