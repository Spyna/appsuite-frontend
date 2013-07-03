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

define('io.ox/office/preview/controller',
    ['io.ox/office/tk/utils',
     'io.ox/office/framework/app/basecontroller'
    ], function (Utils, BaseController) {

    'use strict';

    var // shortcut for the KeyCodes object
        KeyCodes = Utils.KeyCodes;

    // class PreviewController ================================================

    /**
     * The controller of the OX Preview application.
     *
     * @constructor
     *
     * @extends BaseController
     *
     * @param {PreviewApplication} app
     *  The OX Preview application that has created this controller instance.
     */
    function PreviewController(app) {

        var // the model instance
            model = null,

            // the view instance
            view = null,

            // all the little controller items
            items = {

                // view -------------------------------------------------------

                // toggle the main side pane
                'app/view/sidepane': {
                    get: function () { app.getView().isSidePaneVisible(); },
                    set: function (state) { app.getView().toggleSidePane(state); }
                },

                // pages ------------------------------------------------------

                'document/valid': {
                    enable: function () { return model.getPageCount() > 0; }
                },

                'pages/first': {
                    parent: 'document/valid',
                    enable: function () { return view.getPage() > 1; },
                    set: function () { view.showPage('first'); },
                    shortcut: { keyCode: KeyCodes.HOME, altKey: null, ctrlKey: null, metaKey: null }
                },

                'pages/previous': {
                    parent: 'document/valid',
                    enable: function () { return view.getPage() > 1; },
                    set: function () { view.showPage('previous'); },
                    shortcut: { keyCode: KeyCodes.PAGE_UP, altOrMetaKey: true }
                },

                'pages/next': {
                    parent: 'document/valid',
                    enable: function () { return view.getPage() < model.getPageCount(); },
                    set: function () { view.showPage('next'); },
                    shortcut: { keyCode: KeyCodes.PAGE_DOWN, altOrMetaKey: true }
                },

                'pages/last': {
                    parent: 'document/valid',
                    enable: function () { return view.getPage() < model.getPageCount(); },
                    set: function () { view.showPage('last'); },
                    shortcut: { keyCode: KeyCodes.END, altKey: null, ctrlKey: null, metaKey: null }
                },

                'pages/current': {
                    parent: 'document/valid',
                    get: function () { return view.getPage(); },
                    set: function (page) { view.showPage(page); }
                },

                // zoom -------------------------------------------------------

                'zoom/dec': {
                    parent: 'document/valid',
                    enable: function () { return view.getZoomFactor() > view.getMinZoomFactor(); },
                    set: function () { view.decreaseZoomLevel(); },
                    shortcut: { charCode: '-' }
                },

                'zoom/inc': {
                    parent: 'document/valid',
                    enable: function () { return view.getZoomFactor() < view.getMaxZoomFactor(); },
                    set: function () { view.increaseZoomLevel(); },
                    shortcut: { charCode: '+' }
                },

                'zoom/type': {
                    parent: 'document/valid',
                    get: function () { return view.getZoomType(); },
                    set: function (zoomType) { view.setZoomType(zoomType); }
                }

            };

        // base constructor ---------------------------------------------------

        BaseController.call(this, app, { updateDelay: 20, updateMaxDelay: 200 });

        // initialization -----------------------------------------------------

        // register item definitions
        this.registerDefinitions(items);

        // initialization after construction
        app.on('docs:init', function () {
            // model and view are not available at construction time
            model = app.getModel();
            view = app.getView();
        });

    } // class PreviewController

    // exports ================================================================

    // derive this class from class BaseController
    return BaseController.extend({ constructor: PreviewController });

});
