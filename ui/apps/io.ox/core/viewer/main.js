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
 * @author Mario Schroeder <mario.schroeder@open-xchange.com>
 * @author Edy Haryono <edy.haryono@open-xchange.com>
 */

define('io.ox/core/viewer/main', [
    'io.ox/core/extensions',
    'io.ox/core/capabilities',
    'gettext!io.ox/core',
    'io.ox/core/viewer/util'
], function (ext, Capabilities, gt, Util) {

    'use strict';

    /**
     * The OX Viewer component
     *
     * @constructor
     */
    var Viewer = function () {

        /**
         * Launches the OX Viewer.
         *
         * @param {Object} data
         *  @param {Object[]} data.files
         *  an array of plain file objects or FilesAPI file models, which should to be displayed in the Viewer
         *  @param {Object} [data.selection]
         *  a selected file, as a plain object. This is optional. The Viewer will start with the first file
         *  in the data.files Array if this parameter is omitted.
         *  @param {jQuery} [data.container]
         *  a container element where the viewer element should be appended to. Defaults to #io-ox-core element.
         *  @param {String} [data.standalone = false]
         *  whether viewer should be launched in standalone mode.
         *  @param {Boolean} [data.app]
         *  a reference to an app object, from which this viewer is launched.
         *  @param {Object} [data.opt]
         *  a reference to an an options object that can be accessed in all subviews
         *  @param {String} [data.folder]
         *  if you want to open all files in the folder with the current file selected you can pass a single file and a folder. the file will be selected first
         */
        this.launch = function (data) {

            Util.startPerformanceTimer();

            if (!data) return console.error('Core.Viewer.main.launch(): no data supplied');
            if (!hasFiles() && !hasFolder()) return console.error('Core.Viewer.main.launch(): no files to preview.');

            var self = this,
                el = $('<div class="io-ox-viewer abs">'),
                container = data.container || $('#io-ox-core'),
                printOverlay = $('<div class="viewer-print-overlay">').append(
                    $('<div class="print-content">').append(
                        $('<span>').text(gt('Sorry, there is no preview available.')),
                        $('<span>').text(gt('To print this file, please use "Print as PDF" in the viewer.'))
                    )
                ).attr('aria-hidden', true),
                siblings;

            container.append(el);
            el.append(printOverlay);

            siblings = el.siblings().each(function () {
                var $this = $(this);
                $this.data('ox-restore-aria-hidden', el.attr('aria-hidden'));
            }).attr('aria-hidden', true);

            function hasFolder() {
                // Bug 50839 - Viewer opens arbitrary document -> don't expand folder for sharing
                return (!_.isEmpty(data.folder) && (data.folder !== '10'));
            }

            function hasFiles() {
                return (_.isArray(data.files) && (data.files.length > 0));
            }

            function cont() {

                Util.logPerformanceTimer('launchContStart');

                // whether the files to display are shared
                function isSharing() {
                    // check if the user is guest or anonymous guest
                    if (Capabilities.has('guest')) { return true; }
                    // check for sharing folder
                    if (data.folder === '10') { return true; }
                    if (self.fileCollection.first() && self.fileCollection.first().get('folder_id') === '10') { return true; }

                    return false;
                }

                // resolve dependencies now for an instant response
                require(['io.ox/core/viewer/backbone', 'io.ox/core/viewer/views/mainview'], function (backbone, MainView) {
                    // create file collection and populate it with file models
                    self.fileCollection = new backbone.Collection();
                    self.fileCollection.reset(data.fileList, { parse: true });
                    // set the index of the selected file (Drive only)
                    if (data.selection) {
                        self.fileCollection.setStartIndex(data.selection);
                    } else if (hasFolder() && hasFiles()) {
                        // workaround to set correct start file for deep linking, #58378
                        self.fileCollection.setStartIndex(data.files[0]);
                    }
                    // create main view and append main view to core
                    self.mainView = new MainView({ collection: self.fileCollection, el: el, app: data.app, standalone: data.standalone, opt: data.opt || {}, openedBy: data.openedBy, isSharing: isSharing() });

                    self.mainView.on('dispose', close);

                });
            }

            // Cleanup, remove hidden attributes
            function close() {

                Util.savePerformanceTimer(data);

                siblings.removeAttr('aria-hidden').each(function () {
                    var el = $(this);
                    if (el.data('ox-restore-aria-hidden')) el.attr('aria-hidden', el.data('ox-restore-aria-hidden'));
                    el.removeData('ox-restore-aria-hidden');
                });
                // remove id form URL hash (see bug 43410)
                // use-case: viewer was opened via deep-link; a page-reload might surprise the user
                // but don't remove the id from an OX Presenter URL
                if (_.url.hash('app') !== 'io.ox/office/presenter') {
                    _.url.hash('id', null);
                }

                if (data.restoreFocus && _.isFunction(data.restoreFocus.focus)) {
                    data.restoreFocus.focus();
                }

                if (!self.mainView) {
                    $(el).remove();  // Aborted Guard Authentication. Remove element since the MainView hasn't been initialized and won't remove it on dispose.
                }
            }

            function getFileListFromFiles() {
                return $.when([].concat(data.files));
            }

            function getFileListFromFolder() {
                return require(['io.ox/files/api']).then(function (FilesAPI) {
                    return FilesAPI.getAll(data.folder).then(function success(files) {
                        function getter(item) {
                            return this.get(_.cid(item));
                        }
                        // the viewer has listeners that work directly on the model
                        // so we need to get the pool models instead of creating own models
                        return _.map(files, getter, FilesAPI.pool.get('detail'));
                    });
                });
            }

            // fix for #58378
            (hasFolder() ? getFileListFromFolder() : getFileListFromFiles()).then(function (fileList) {
                // add file list to baton data
                data.fileList = fileList;
                // Call extension point for any required performs, e.g. Guard authentication
                return ext.point('io.ox/core/viewer/main').cascade(this, new ext.Baton({ data: data }));

            }).then(cont, close);

        };
    };

    return Viewer;
});
