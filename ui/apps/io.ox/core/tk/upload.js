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
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 */

define('io.ox/core/tk/upload', [
    'io.ox/core/event',
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
    //      {id: 'action1', label: 'Some cool Action' }, { id: 'action2', label: 'Some other cool action' }
    // ]}
    function DropZone(options) {
        require(['less!io.ox/core/tk/upload']);
        var self = this, highlightedAction, dragLeaveTimer,
            $overlay = $('<div class="abs io-ox-dropzone-multiple-overlay">').on('click', removeOverlay),

            showOverlay = function (e) {
                if (!isFileDND(e) || ($('body > .io-ox-dialog-wrapper').length > 0)) return;
                clearTimeout(dragLeaveTimer);
                $('body').addClass('io-ox-dropzone-active').append($overlay);
                return false;
            },

            removeOverlay = function () {
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
                dragenter: function () {
                    if (highlightedAction) highlightedAction.removeClass('io-ox-dropzone-hover');
                    highlightedAction = $actionNode;
                    $actionNode.addClass('io-ox-dropzone-hover');
                },
                dragleave: function (e) {
                    // IE has no pointer-events: none
                    if (!_.browser.IE) {
                        $actionNode.removeClass('io-ox-dropzone-hover');
                    } else if (!$(e.target).hasClass('dropzone') && !$(e.target).hasClass('dndignore')) {
                        $actionNode.removeClass('io-ox-dropzone-hover');
                    }
                },
                drop: function (e) {

                    e = e.originalEvent || e;
                    var files = e.dataTransfer.files, i;

                    // And the pass them on
                    if (highlightedAction) highlightedAction.removeClass('io-ox-dropzone-hover');

                    // Fix for Bug 26235
                    if (_.browser.Chrome && _.browser.Chrome > 21) {
                        var items = e.dataTransfer.items;
                        for (i = 0; i < items.length; i++) {
                            var entry = items[i].webkitGetAsEntry();
                            if (entry.isDirectory) {
                                notifications.yell('error', gt('Uploading folders is not supported.'));
                                removeOverlay(e);
                                return false;
                            }
                        }
                    }

                    if (options.actions[0].id === 'importEML') {
                        for (i = 0; i < files.length; i++) {
                            var valid_extensions = /(\.eml)$/i;
                            if (!valid_extensions.test(files[i].name)) {
                                notifications.yell('error', gt('Mail was not imported. Only .eml files are supported.'));
                                removeOverlay(e);
                                return false;
                            }
                        }
                    }

                    for (i = 0; i < files.length; i++) {
                        if (options.actions[0].id === 'mailAttachment') {
                            self.trigger('drop', files[i]);
                        } else {
                            self.trigger('drop', action.id, files[i], action);
                        }
                    }
                    // cause it's instanceOf FileList
                    self.trigger('drop-multiple', action, $.makeArray(files));
                    removeOverlay(e);
                    // Prevent regular event handling
                    return false;
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
                dragenter: function () {
                    clearTimeout(dragLeaveTimer);
                    // Prevent regular event handling
                    return false;
                },
                dragover: function (e) {
                    var origEvt = e.originalEvent,
                        effectAllowed;
                    try {
                        effectAllowed = origEvt.dataTransfer.effectAllowed;
                    } catch (e) {
                        if (ox.debug) console.error(e);
                    }
                    origEvt.dataTransfer.dropEffect = effectAllowed === 'move' || effectAllowed === 'linkMove' ? 'move' : 'copy';

                    clearTimeout(dragLeaveTimer);
                    e.preventDefault();
                    // Prevent regular event handling
                    return false;
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
    function DisabledDropZone() {
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
            changed: $.noop,
            progress: function () { return $.when(); },
            type: false
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

        this.offer = function (file, options) {

            var self = this;

            require(['settings!io.ox/core', 'io.ox/core/strings'], function (settings, strings) {
                var properties = settings.get('properties'),
                    newFiles = [].concat(file),
                    validFiles;

                if (properties && delegate.type !== 'importEML') {
                    var totalUploadSize = 0,
                        maxSize = properties.infostoreMaxUploadSize,
                        quota = properties.infostoreQuota;

                    validFiles = _(newFiles).filter(function (f) {
                        var exceedMaximum = maxSize > 0 && f.size > maxSize;
                        if (!exceedMaximum) totalUploadSize += f.size;
                        return !exceedMaximum;
                    });

                    if (quota > 0 && totalUploadSize > quota - properties.infostoreUsage) {
                        notifications.yell('error',
                            gt.format(
                                //#. %1$s quota limit
                                gt.ngettext(
                                    'The file cannot be uploaded because it exceeds the quota limit of %1$s',
                                    'The files cannot be uploaded because they exceed the quota limit of %1$s',
                                    newFiles.length
                                ),
                                strings.fileSize(quota)
                            )
                        );
                        return;
                    }

                    if (validFiles.length < newFiles.length) {
                        if (newFiles.length - validFiles.length === 1) {
                            var f = _.without.apply(_, [newFiles].concat(validFiles))[0];
                            notifications.yell('error',
                                //#. %1$s the filename
                                //#. %2$s the maximum file size
                                gt('The file "%1$s" cannot be uploaded because it exceeds the maximum file size of %2$s', f.name, strings.fileSize(maxSize))
                            );
                        } else if (validFiles.length === 0) {
                            notifications.yell('error',
                                //#. %1$s the maximum file size
                                gt('The files cannot be uploaded because each file exceeds the maximum file size of %1$s', strings.fileSize(maxSize))
                            );
                        } else {
                            notifications.yell('warning',
                                //#. %1$s the maximum file size
                                gt('Some files cannot be uploaded because they exceed the maximum file size of %1$s', strings.fileSize(maxSize))
                            );
                        }
                    }
                }

                _(validFiles || newFiles).each(function (file) {
                    files.push({ file: file, options: options });
                });
                self.queueChanged();
            });
        };

        this.length = 0;

        this.remove = function (index) {
            files.splice(index, 1);

            //if current file is removed, decrement position
            if (index === position) {
                position--;
            }
        };

        this.queueChanged = function () {
            this.length = files.length;
            delegate.changed(files[position], position, files);
            this.trigger('changed', files[position], position, files);
            this.next();
        };

        this.dump = function () {
            console.info('this', this, 'file', files[position], 'position', position, 'files', files);
        };

        this.start = function () {
            // disable autologout -> bug 29389
            ox.autoLogout.stop();
            delegate.start(files[position], position, files);
            this.trigger('start', files[position], position, files);
        };

        this.progress = function () {
            var def = delegate.progress(files[position], position, files);
            this.trigger('progress', def, files[position], position, files);
            return def;
        };

        this.stop = function () {
            // reenable autologout -> bug 29389
            ox.autoLogout.start();
            delegate.stop(files[position], position, files);
            this.trigger('stop', files[position], position, files);
            files = [];
            position = 0;
            processing = false;
        };
    }

    return {

        dnd: {
            // was: Modernizr.draganddrop but that test is gone
            enabled: _.device('!touch'),
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
