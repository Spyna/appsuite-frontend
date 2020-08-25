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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/dropzone', [], function () {

    'use strict';

    var EVENTS = 'dragenter dragover dragleave drop';

    // iframe overlay during dnd
    var toggleDndMask = _.throttle(function (state) {
        var active = $('html').hasClass('dndmask-enabled');

        if (active === state) return;

        $('html').toggleClass('dndmask-enabled', state);
        if (!state) return $('.dndmask').remove();

        $('iframe:visible').each(function () {
            var id = _.uniqueId('overlay-'),
                iframe = $(this)
                    .attr('data-overlay', id)
                    .before(
                        // overlay
                        $('<div id="' + id + '" class="dndmask">')
                            .on(EVENTS, function (e) {
                                var event = $.Event(e.type, { 'offsetX': e.offsetX, 'offsetY': e.offsetY });
                                $('body', iframe.contents()).trigger(event);
                            })
                    );
        });
    }, 100);
    ox.on('drag:start', _.partial(toggleDndMask, true));
    ox.on('drag:stop', _.partial(toggleDndMask, false));

    // Backbone Dropzone
    var InplaceDropzone = Backbone.View.extend({

        className: 'inplace-dropzone',

        events: {
            'drop': 'onDrop',
            'dragenter .dropzone-overlay': 'onDragenter',
            'dragover .dropzone-overlay': 'onDragover',
            'dragleave .dropzone-overlay': 'onDragleave'
        },

        onLeave: function (e) {
            if (!this.leaving) return;
            ox.trigger('drag:stop', this.cid);
            this.hide(e);
        },

        onDrag: function (e) {
            if (!this.$el.parent().is(':visible')) return;
            if (!this.isSupported()) return;
            switch (e.type) {
                case 'dragenter':
                case 'dragover':
                    ox.trigger('drag:start', this.cid);
                    this.stop(e);
                    this.leaving = false;
                    if (!this.checked) this.checked = true; else return;
                    if (!this.isValid(e)) return;
                    if (!this.visible) this.show();
                    return false;
                case 'dragleave':
                    this.leaving = true;
                    clearTimeout(this.timeout);
                    this.timeout = setTimeout(this.onLeave.bind(this), 100, e);
                    break;
                case 'drop':
                    ox.trigger('drag:stop', this.cid);
                    this.stop(e);
                    this.hide();
                    return false;
                // no default
            }
        },

        isSupported: _.constant(true),

        stop: function (e) {
            e.preventDefault();
            e.stopPropagation();
        },

        show: function () {
            // show dropzone
            this.visible = true;
            this.$el.show();
            this.trigger('show');
            $(window).trigger('resize');
        },

        hide: function () {
            // hide dropzone
            this.visible = this.checked = false;
            this.$el.hide().removeClass('dragover');
            this.trigger('hide');
        },

        initialize: function (options) {
            this.options = options;
            this.checked = false;
            this.visible = false;
            this.leaving = false;
            this.timeout = -1;
            this.eventTarget = options.eventTarget;

            this.onDrag = this.onDrag.bind(this);
            $(document).on(EVENTS, this.onDrag);
            // firefox does not fire dragleave correct when leaving the window.
            // it also does not fire mouseevents while dragging (so mouseout does not work either)
            // use mouseenter to remove the dropzones when eintering the window wiand nothing is dragged
            if (_.device('firefox')) {
                this.onMouseenter = this.onMouseenter.bind(this);
                $(document).on('mouseenter', this.onMouseenter);
            }

            if (this.eventTarget) {
                // check if event target is inside a different document (e.g. iframe)
                this.eventTargetDocument = this.eventTarget.prop('nodeName') === '#document' ? this.eventTarget.get(0) : this.eventTarget.prop('ownerDocument');
                if (this.eventTargetDocument !== document) $(this.eventTargetDocument).on(EVENTS, this.onDrag);

                this.onDrop = this.onDrop.bind(this);
                this.onDragenter = this.onDragenter.bind(this);
                this.onDragover = this.onDragover.bind(this);
                this.onDragleave = this.onDragleave.bind(this);
                this.eventTarget
                    .on('drop', this.onDrop)
                    .on('dragenter', this.onDragenter)
                    .on('dragover', this.onDragover)
                    .on('dragleave', this.onDragleave);
            }

            this.$el.on('dispose', function (e) { this.dispose(e); }.bind(this));
        },

        isValid: function (e) {
            if (!_.isFunction(this.isEnabled)) return this.isFile(e);
            return this.isEnabled(e) && this.isFile(e);
        },

        // overwrite for custom checks
        isEnabled: true,

        isFile: function (e) {
            var dt = e.originalEvent.dataTransfer;
            return _(dt.types).contains('Files') || _(dt.types).contains('application/x-moz-file');
        },

        getFilesFromWebkitDataTransferItems: function (dataTransfer) {
            function traverseFileTreePromise(item, path) {
                var def = new $.Deferred();

                if (item.isFile) {
                    item.file(function (file) {
                        files.push({
                            file: file,
                            fullPath: item.fullPath,
                            preventFileUpload: false
                        });
                        def.resolve(file);
                    });
                } else if (item.isDirectory) {
                    var dirReader = item.createReader();
                    dirReader.readEntries(function (entries) {
                        var entriesPromises = [];

                        if (entries.length === 0) { // Folder is empty
                            var dummyFile = new File([''], '__ommit__.txt'); // TODO: Remove this hack
                            var fullPath = item.fullPath + '/' + dummyFile.name; //save full path
                            dummyFile.filepath = fullPath;

                            files.push({
                                file: dummyFile,
                                fullPath: fullPath,
                                preventFileUpload: true
                            });
                            def.resolve(dummyFile);
                        } else {
                            entries.forEach(function (entr) {
                                entriesPromises.push(traverseFileTreePromise(entr, path + item.name + '/'));
                            });
                        }

                        $.when.apply($, entriesPromises).then(function () {
                            def.resolve(_.toArray(arguments));
                        }, function (error) {
                            def.reject(error);
                        });
                    });
                }

                return def;
            }

            var files = [];
            var finalDef = new $.Deferred();
            var entriesPromises = [];
            var length = dataTransfer.items.length;

            for (var i = 0; i < length; i++) {
                var it = dataTransfer.items[i];
                entriesPromises.push(traverseFileTreePromise(it.webkitGetAsEntry(), ''));
            }

            $.when.apply($, entriesPromises)
                .then(function () {
                    finalDef.resolve(files);
                });

            return finalDef;
        },

        // Deprecated function look : getFilesFromWebkitDataTransferItems
        getFiles: function (e) {
            var dt = e.originalEvent.dataTransfer;
            var length = dt.items.length;
            var FileEntryArr = [];
            var files = [];
            var def = new $.Deferred();

            var handleFile = function (entry) {
                entry.file(function (file) {
                    var fileObj = {
                        file: file,
                        fullPath: entry.fullPath
                    };

                    files.push(fileObj);
                    if (files.length === FileEntryArr.length) {
                        def.resolve(files);
                    }
                });
                FileEntryArr.push(entry);
            };

            var deepDiveDir = function (entry) {
                var reader = entry.createReader();
                reader.readEntries(function (entries) {
                    entries.forEach(function (dir) {
                        if (dir.isFile) {
                            handleFile(dir);
                        } else {
                            deepDiveDir(dir);
                        }
                    });
                });
            };

            for (var i = 0; i < length; i++) {
                var entry = null;
                if (dt.items[i].webkitGetAsEntry) {
                    entry = dt.items[i].webkitGetAsEntry();
                } else if (dt.items[i].getAsEntry) {
                    entry = dt.items[i].getAsEntry();
                }

                if (!entry) {
                    return;
                }

                if (entry.isFile) {
                    handleFile(entry);
                } else if (entry.isDirectory) {
                    deepDiveDir(entry);
                }
            }

            return def;
        },

        onDragenter: function (e) {
            // highlight dropzone
            $(e.currentTarget).parent().addClass('dragover');
        },

        onDragover: function (e) {
            // takes care of drop effect
            e.originalEvent.dataTransfer.dropEffect = 'copy';
        },

        onDragleave: function (e) {
            // remove highlight
            $(e.currentTarget).parent().removeClass('dragover');
        },

        // firefox only. Firefox has the strange behavior of only triggering this when no file is dragged
        // so it can be used to clear the dropzones (firefox does not trigger the dragleave event on window leave)
        onMouseenter: function (e) {
            if (!this.visible) return;
            var from = e.relatedTarget || e.toElement;
            if (!from) {
                _.delay(function () {
                    this.leaving = true;
                    clearTimeout(this.timeout);
                    this.onLeave(e);
                }.bind(this), 50);
            }
        },

        // while we can ignore document's drop event, we need this one
        // to detect that a file was dropped over the dropzone
        onDrop: function (event) {
            var self = this;
            var dataTransfer = event.originalEvent.dataTransfer;

            this.getFilesFromWebkitDataTransferItems(dataTransfer).then(function (fileObjArray) {
                self.trigger(fileObjArray.length > 0 ? 'drop' : 'invalid', fileObjArray, event);
            });
        },

        render: function () {

            this.$el.hide().append(
                $('<div class="abs dropzone-caption">').text(this.options.caption || ''),
                $('<div class="abs dropzone-dragover"><i class="fa fa-check" aria-hidden="true"></i></div>'),
                $('<div class="abs dropzone-overlay">')
            );

            return this;
        },

        dispose: function () {
            this.stopListening();
            $(document).off(EVENTS, this.onDrag);
            if (_.device('firefox')) {
                $(document).off('mouseenter', this.onMouseenter);
            }
            if (this.eventTarget) {
                if (this.eventTargetDocument !== document) $(this.eventTargetDocument).off(EVENTS, this.onDrag);

                this.eventTarget
                    .off('drop', this.onDrop)
                    .off('dragenter', this.onDragenter)
                    .off('dragover', this.onDragover)
                    .off('dragleave', this.onDragleave);
            }
        }
    });

    // avoid any native drop
    $(document).on('dragover drop', false);

    return {
        Inplace: InplaceDropzone
    };
});
