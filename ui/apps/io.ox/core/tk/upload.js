/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2011
 * Mail: info@open-xchange.com
 *
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 */

define('io.ox/core/tk/upload',
    ['io.ox/core/event',
     'io.ox/core/notifications',
     'gettext!io.ox/core'
    ], function (Events, notifications, gt) {

    'use strict';

    function isFileDND(e) {
        // Learned from: http://stackoverflow.com/questions/6848043/how-do-i-detect-a-file-is-being-dragged-rather-than-a-draggable-element-on-my-pa
        return e.originalEvent && e.originalEvent.dataTransfer && (
            !_.browser.Firefox ||
            e.type === 'dragleave' ? e.originalEvent.dataTransfer.dropEffect === 'none' : e.originalEvent.dataTransfer.dropEffect !== 'none'
        ) && (
            _(e.originalEvent.dataTransfer.types).contains('Files') ||
            _(e.originalEvent.dataTransfer.types).contains('application/x-moz-file')
        );
    }

    // options should contain a list of actions. The action id will be the first parameter to the event handlers
    // { actions: [
    //      {id: 'action1', label: 'Some cool Action'}, {id: 'action2', label: 'Some other cool action'}
    // ]}
    function DropZone(options) {
        require(['less!io.ox/core/tk/upload.less']);
        var self = this,  height, highlightedAction, dragLeaveTimer,
            $overlay = $('<div class="abs io-ox-dropzone-multiple-overlay">').on('click', removeOverlay),

            showOverlay = function (e) {
                if (!isFileDND(e) || ($('body > .io-ox-dialog-wrapper').length > 0)) return;
                clearTimeout(dragLeaveTimer);
                $('body').addClass('io-ox-dropzone-active').append($overlay);
                return false;
            },

            removeOverlay = function (e) {
                $('body').removeClass('io-ox-dropzone-active');
                $overlay.detach();
                return false;
            },

            nodeGenerator = function () {
                var $actionTile = $('<div class="io-ox-dropzone-action">');
                $overlay.append($actionTile);
                return $actionTile;
            };

        Events.extend(this);

        _(options.actions || []).each(function (action) {
            var $actionNode = nodeGenerator();
            $actionNode.append($('<div class="dropzone">').on({
                dragenter: function (e) {
                    if (highlightedAction) highlightedAction.removeClass('io-ox-dropzone-hover');
                    highlightedAction = $actionNode;
                    $actionNode.addClass('io-ox-dropzone-hover');
                },
                dragleave: function (e) {
                    // IE has no pointer-events: none
                    if (!_.browser.IE) {
                        $actionNode.removeClass('io-ox-dropzone-hover');
                    } else {
                        if (!$(e.target).hasClass('dropzone') && !$(e.target).hasClass('dndignore')) {
                            $actionNode.removeClass('io-ox-dropzone-hover');
                        }
                    }
                },
                drop: function (e) {

                    e = e.originalEvent || e;
                    var files = e.dataTransfer.files;

                    // And the pass them on
                    if (highlightedAction) highlightedAction.removeClass('io-ox-dropzone-hover');

                    // Fix for Bug 26235
                    if (_.browser.Chrome && _.browser.Chrome > 21) {
                        var items = e.dataTransfer.items;
                        for (var i = 0; i < items.length; i++) {
                            var entry = items[i].webkitGetAsEntry();
                            if (entry.isDirectory) {
                                notifications.yell('error', gt('Uploading folders is not supported.'));
                                removeOverlay(e);
                                return false;
                            }
                        }
                    }

                    if (options.actions[0].id === 'importEML') {
                        for (var i = 0; i < files.length; i++) {
                            var valid_extensions = /(\.eml)$/i;
                            if (!valid_extensions.test(files[i].name)) {
                                notifications.yell('error', gt('Mail was not imported, only .eml files are supported.'));
                                removeOverlay(e);
                                return false;
                            }
                        }
                    }

                    for (var i = 0, l = files.length; i < l; i++) {
                        if (options.actions[0].id === 'mailAttachment') {
                            self.trigger('drop', files[i]);
                        } else {
                            self.trigger('drop', action.id, files[i], action);
                        }
                    }
                    self.trigger('drop-multiple', action, $.makeArray(files)); // cause it's instanceOf FileList
                    removeOverlay(e);
                    return false; // Prevent regular event handling
                }
            }).append($('<span class="dndignore">').html(action.label)));
        });

        var included = false;

        this.remove = function () {
            if (!included) return;
            included = false;
            $(document).off('dragenter', showOverlay)
                       .off('drop', removeOverlay);
            $overlay.off('dragenter dragover dragend dragleave drop');
        };
        this.include = function () {
            if (included) return;
            included = true;
            $(document).on('dragenter', showOverlay);
            $overlay.on({
                dragenter: function (e) {
                    clearTimeout(dragLeaveTimer);
                    return false; // Prevent regular event handling
                },
                dragover: function (e) {
                    clearTimeout(dragLeaveTimer);
                    e.preventDefault();
                    return false; // Prevent regular event handling
                },
                dragleave: function (e) {
                    dragLeaveTimer = setTimeout(function () {
                        removeOverlay(e);
                    }, 200);
                    e.stopPropagation();
                },
                drop: function (e) {
                    e.preventDefault();
                    removeOverlay(e);
                    return false;
                }
            });
        };

    }

    // And this is the duck type compatible version for browsers which don't support
    // the File API. You can define this DropZone but will never hear back.
    function DisabledDropZone($node) {
        this.enabled = false;
        this.bind = $.noop;
        this.unbind = $.noop;
        this.remove = $.noop;
        this.include = $.noop;
        // Maybe add some more
    }

    // Next we'll need a file upload queue
    // This will simply store files and drain the queue by uploading one file after another
    // Events:
    // "start" - When a file is being uploaded.
    // "stop" - When an upload is through.
    // If the delegate implements "start" and "stop" methods, those will be called as well
    // The delegate must implement a "progress" method, that is called to really process the file. It is expected to return
    // a promise or deferred, to tell us when we are done with a file
    function FileProcessingQueue(delegate) {

        if (!delegate) {
            console.warn('No delegate supplied to file processing queue.');
        } else if (!delegate.progress) {
            console.warn('The delegate to a queue should implement a "progress" method!');
        }

        delegate = _.extend({
            start: $.noop,
            stop: $.noop,
            progress: function (file) { return $.when(); }
        }, delegate || {});

        Events.extend(this);

        var files = [],
            position = 0,
            processing = false;

        this.next = function () {
            if (processing) {
                return;
            }
            // done?
            if (files.length === 0 || files.length <= position) {
                return this.stop();
            }
            processing = true;
            var self = this;
            // start?
            if (position === 0) {
                this.start();
            }
            // progress! (using always() here to keep things going even on error)
            this.progress().always(function () {
                processing = false;
                position++;
                self.queueChanged();
            });
        };

        this.offer = function (file) {
            var maxFileSize, fileTitle, proceed = true, self = this;

            files.push.apply(files, [].concat(file)); // handles both arrays and single objects properly
            require(['settings!io.ox/core', 'io.ox/core/strings'], function (settings, strings) {
                var properties = settings.get('properties');
                if (properties) {
                    var total = 0,
                        maxSize = properties.maxUploadSize * 10; // Very interesting value from backend here?! (Bytes / 10)
                    _.each(files, function (f) {
                        fileTitle = f.name;
                        total += f.size;
                        if (f.size > maxSize) {
                            proceed = false;
                            notifications.yell('error', gt('The file "%1$s" cannot be uploaded because it exceeds the maximum file size of %2$s', fileTitle, strings.fileSize(maxSize)));
                            self.stop();
                            return;
                        }
                        if (properties.quota !== -1) {
                            if (total > properties.quota - properties.usage) {
                                proceed = false;
                                notifications.yell('error', gt('The file "%1$s" cannot be uploaded because it exceeds the quota limit of %2$s', fileTitle, strings.fileSize(properties.quota)));
                                self.stop();
                                return;
                            }
                        }
                    });
                }
                if (proceed) self.queueChanged();
            });
        };

        this.length = 0;

        this.queueChanged = function () {
            this.length = files.length;
            this.trigger('changed', this);
            this.next();
        };

        this.dump = function () {
            console.info('this', this, 'file', files[position], 'position', position, 'files', files);
        };

        this.start = function () {
            delegate.start(files[position], position, files);
            this.trigger('start', files[position], position, files);
        };

        this.progress = function () {
            var def = delegate.progress(files[position], position, files);
            this.trigger('progress', def, files[position], position, files);
            return def;
        };

        this.stop = function () {
            delegate.stop(files[position], position, files);
            this.trigger('stop', files[position], position, files);
            files = [];
            position = 0;
            processing = false;
        };
    }

    return {
        dnd : {
            enabled: Modernizr.draganddrop,
            createDropZone: function (options) {
                options = options || {};
                if (!this.enabled) {
                    return new DisabledDropZone(options.node);
                }
                return new DropZone(options);
            }
        },
        createQueue: function (delegate) {
            return new FileProcessingQueue(delegate);
        }
    };
});
