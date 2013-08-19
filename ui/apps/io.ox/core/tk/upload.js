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

    function hasLeftViewport(e) {
        e = e.originalEvent || e;
        if (_.browser.Firefox || _.browser.Safari || _.browser.IE) return true;
        return (e.clientX === 0 && e.clientY === 0);
    }

    function isFileDND(e) {
        // Learned from: http://stackoverflow.com/questions/6848043/how-do-i-detect-a-file-is-being-dragged-rather-than-a-draggable-element-on-my-pa
        return e.originalEvent && e.originalEvent.dataTransfer && (
            !_.browser.Firefox ||
            e.originalEvent.dataTransfer.dropEffect !== 'none'
        ) && (
            _(e.originalEvent.dataTransfer.types).contains('Files') ||
            _(e.originalEvent.dataTransfer.types).contains('application/x-moz-file')
        );
    }

    /**
     * is node flaged as 'ignore'
     * @param  {event} e
     * @return {boolean}
     */
    function ignored(e) {
        //TODO: parent node should stay hovered when entering a ignored child
        //dragleave: reset hover in parent node when re-enter
        //removeOverlay: safari removes all hover nodes
        return (e.target && $(e.target).hasClass('dndignore')) || false;
    }

    // We provide a few events:
    // "dragover" if someone threatens to drop a file into the window
    // "dragend" when she released the file
    // "drop" when she released the file
    // options should contain a list of actions. The action id will be the first parameter to the event handlers
    // { actions: [
    //      {id: 'action1', label: 'Some cool Action'}, {id: 'action2', label: 'Some other cool action'}
    // ]}
    function MultiDropZone(options) {
        require(['less!io.ox/core/tk/upload.less']);
        var self = this, $overlay, nodes = [], nodeGenerator, currentRow, height, showOverlay, highlightedAction, removeOverlay;
        Events.extend(this);

        $overlay = $('<div>').addClass('abs io-ox-dropzone-multiple-overlay');

        showOverlay = function (e) {
            if (!isFileDND(e)) {
                return;
            }
            $overlay.appendTo('body').css({height: '100%'});
            height = 100 / nodes.length;
            height = height + '%';

            _(nodes).each(function ($actionNode) {
                $actionNode.css({height: height});
            });
            return false;
        };

        removeOverlay = function (e) {
            if (!isFileDND(e) || ignored(e)) {
                return;
            }
            $overlay.detach();
            return false; // Prevent regular event handling
        };
        if (options.actions && options.actions.length === 1) {
            nodeGenerator = function () {
                var $actionNode = $('<div>').addClass('row-fluid io-ox-dropzone-action').appendTo($overlay);
                nodes.push($actionNode);
                return $actionNode;
            };
        } else {
            nodeGenerator = function () {
                var $actionTile = $('<div>').appendTo($overlay).addClass('span6 io-ox-dropzone-action').css({height: '100%'});
                if (currentRow) {
                    currentRow.append($actionTile);
                    currentRow = null;
                } else {
                    currentRow = $('<div>').addClass('row-fluid').appendTo($overlay);

                    nodes.push(currentRow);
                    currentRow.append($actionTile);
                }

                return $actionTile;
            };
        }


        _(options.actions || []).each(function (action) {
            var $actionNode = nodeGenerator();
            $actionNode.append($('<div>').html(action.label).center()).on({
                dragenter: function (e) {
                    if (!isFileDND(e)) {
                        return;
                    }

                    self.trigger('dragenter', action.id, action);
                    // make sure it's file oriented
                    e = e.originalEvent || e;

                    //TODO: get date about dragged object
                    if (highlightedAction) {
                        highlightedAction.removeClass('io-ox-dropzone-hover');
                    }
                    $actionNode.addClass('io-ox-dropzone-hover');
                    highlightedAction = $actionNode;
                    return false; // Prevent regular event handling
                },
                dragover: function (e) {
                    if (!isFileDND(e)) {
                        return;
                    }
                    self.trigger('dragover', action.id, action);
                    return false; // Prevent regular event handling
                },
                dragend: function (e) {
                    if (!isFileDND(e)) {
                        return;
                    }
                    self.trigger('dragend', action.id, action);
                    if (highlightedAction) {
                        highlightedAction.removeClass('io-ox-dropzone-hover');
                    }
                    return false; // Prevent regular event handling

                },
                dragleave: function (e) {
                    if (!isFileDND(e) || ignored(e)) {
                        return;
                    }
                    self.trigger('dragleave', action.id, action);
                    $actionNode.removeClass('io-ox-dropzone-hover');
                    return true; // Prevent regular event handling

                },
                drop: function (e) {
                    if (!isFileDND(e)) {
                        return;
                    }

                    e = e.originalEvent || e;
                    var files = e.dataTransfer.files;

                    // And the pass them on
                    if (highlightedAction) {
                        highlightedAction.removeClass('io-ox-dropzone-hover');
                    }

                    $overlay.detach();

                    // Fix for Bug 26235
                    if (_.browser.Chrome && _.browser.Chrome > 21) {
                        var items = e.dataTransfer.items;
                        for (var i = 0; i < items.length; i++) {
                            var entry = items[i].webkitGetAsEntry();
                            if (entry.isDirectory) {
                                notifications.yell('error', gt('Uploading folders is not supported.'));
                                return false;
                            }
                        }
                    }

                    if (options.actions[0].id === 'importEML') {
                        for (var i = 0; i < files.length; i++) {
                            var valid_extensions = /(\.eml)$/i;
                            if (!valid_extensions.test(files[i].name)) {
                                notifications.yell('error', gt('Mail was not imported, only .eml files are supported.'));
                                return false;
                            }
                        }
                    }

                    for (var i = 0, l = files.length; i < l; i++) {
                        self.trigger('drop', action.id, files[i], action);
                    }
                    self.trigger('drop-multiple', action, $.makeArray(files)); // cause it's instanceOf FileList
                    return false; // Prevent regular event handling
                }
            });
        });

        var included = false;
        this.remove = function () {
            if (!included) {
                return;
            }
            included = false;
            $('body').off('dragenter', showOverlay);
            $('body').off('drop', removeOverlay);
        };
        this.include = function () {
            if (included) {
                return;
            }
            included = true;
            $('body').on('dragenter', showOverlay);
            $overlay.on({
                dragenter: function () {
                    return false; // Prevent regular event handling
                },
                dragover: function () {
                    return false; // Prevent regular event handling
                },
                dragend: function (e) {
                    removeOverlay(e);
                    return false; // Prevent regular event handling

                },
                dragleave: function (e) {
                    if (hasLeftViewport(e)) {
                        removeOverlay(e);
                    }
                    return false; // Prevent regular event handling

                },
                drop: function (e) {
                    e.preventDefault();
                    removeOverlay(e);
                    return false;
                }
            });
        };

    }

    // Let's define a DropZone class, where files can be dropped
    // We leave the eyecandy to calling code, but provide a few events
    // "dragover" if someone threatens to drop a file into $node
    // "dragend" when she released the file
    // "drop" when she released the file
    // Calling code can hand over  a node or a jquery expression, if no node is passed, we'll create an overlay for the entire
    // visible screen and handle all eye candy ourselves.
    function DropZone($node) {
        var self = this;
        var globalMode = false;
        var appendOverlay = function (e) {
            if (!isFileDND(e)) {
                return;
            }
            $node.appendTo('body');
            return false;
        };

        if ($node) {
            $node = $($node);
        } else {
            globalMode = true;
            $node = $('<div/>')
                .addClass('abs')
                .css({
                    backgroundColor: '#000',
                    color: 'white',
                    textAlign: 'center',
                    paddingTop: '25%',
                    fontSize: '42pt',
                    opacity: '0.75',
                    zIndex: 65000
                }).text('Just drop the file anywhere...');
        }
        this.enabled = true;
        Events.extend(this);

        // Now let's add the regular event handlers to fulfill our promises
        $node.on({
            dragenter: function (e) {
                if (!isFileDND(e)) {
                    return;
                }
                // We'll just hand this over. A few layers of indirection are always fun
                self.trigger('dragenter');
                return false; // Prevent regular event handling
            },
            dragover: function (e) {
                if (!isFileDND(e)) {
                    return;
                }
                // We'll just hand this over. A few layers of indirection are always fun
                self.trigger('dragover');
                return false; // Prevent regular event handling
            },
            dragend: function (e) {
                if (!isFileDND(e)) {
                    return;
                }
                // We'll just hand this over. A few layers of indirection are always fun
                self.trigger('dragend');
                return false; // Prevent regular event handling

            },
            dragleave: function (e) {
                if (!isFileDND(e)) {
                    return;
                }
                // We'll just hand this over. A few layers of indirection are always fun
                if (globalMode) {
                    $node.detach();
                }
                self.trigger('dragleave');
                return false; // Prevent regular event handling

            },
            drop: function (e) {
                if (!isFileDND(e)) {
                    return;
                }
                if (globalMode) {
                    $node.detach();
                }
                // Finally something useful to do. Let's extract the file objects from the event
                // grab the original event
                e = e.originalEvent || e;
                var files = e.dataTransfer.files;
                // And the pass them on
                for (var i = 0, l = files.length; i < l; i++) {
                    self.trigger('drop', files[i]);
                }
                return false; // Prevent regular event handling
            }
        });

        if (globalMode) {
            var included = false;
            this.remove = function () {
                if (!included) {
                    return;
                }
                included = false;
                $('body').off('dragenter', appendOverlay);
            };
            this.include = function () {
                if (included) {
                    return;
                }
                included = true;
                $('body').on('dragenter', appendOverlay);
            };
        } else {
            this.remove = $.noop;
            this.include = $.noop;
        }

        this.include();
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
            files.push.apply(files, [].concat(file)); // handles both arrays and single objects properly
            this.queueChanged();
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
                if (options.type === 'multiple') {
                    return new MultiDropZone(options);
                } else {
                    return new DropZone(options.node);
                }
            }
        },
        createQueue: function (delegate) {
            return new FileProcessingQueue(delegate);
        }
    };
});
