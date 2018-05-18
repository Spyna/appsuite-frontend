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
 * @author Richard Petersen <richard.petersen@open-xchange.com>
 */

define('io.ox/files/upload/main', [
    'io.ox/files/api',
    'io.ox/core/extensions',
    'io.ox/core/notifications',
    'io.ox/core/tk/upload',
    'gettext!io.ox/files'
], function (filesAPI, ext, notifications, upload, gt) {

    'use strict';

    var limits = [{
            limit: 1000,
            message: function (t) {
                //#. estimated upload duration
                return gt.format(gt.ngettext('%1$d second', '%1$d seconds', t), t);
            }
        },
        {
            limit: 60,
            message: function (t) {
                //#. estimated upload duration
                return gt.format(gt.ngettext('%1$d minute', '%1$d minutes', t), t);
            }
        },
        {
            limit: 60,
            message: function (t) {
                //#. estimated upload duration
                return gt.format(gt.ngettext('%1$d hour', '%1$d hours', t), t);
            }
        },
        {
            limit: 24,
            message: function (t) {
                //#. estimated upload duration
                return gt.format(gt.ngettext('%1$d day', '%1$d days', t), t);
            }
        },
        {
            limit: 7,
            message: function (t) {
                //#. estimated upload duration
                return gt.format(gt.ngettext('%1$d week', '%1$d weeks', t), t);
            }
        }
        ],
        UploadFile = Backbone.Model.extend({
            defaults: {
                file: null,
                progress: 0,
                request: null,
                loaded: 0,
                abort: false
            }
        }),
        UploadCollection = Backbone.Collection.extend({
            model: UploadFile
        });

    function FileUpload() {
        var totalProgress = 0,
            totalSize = 0, //accumulated size of all files
            currentSize = 0, //number of bytes, which are currently uploaded
            startTime, // time stamp, when the first file started uploading
            uploadCollection = new UploadCollection(),
            $el, bottomToolbar, mainView, //some dom nodes needed for the view
            self = this,
            api = filesAPI;

        api.on('add:imp_version', function (title) {
            notifications.yell('info', gt('A new version for "%1$s" has been added.', title));
        });

        this.calculateTotalSíze = function () {
            //update the total size for time estimation
            uploadCollection.each(function (model) {
                totalSize += model.get('file').size;
            });

        };

        this.changed = function (item, position, files) {
            var uploadFiles = files.slice(uploadCollection.length, files.length)
                .map(function (fileContainer) {
                    return new UploadFile({ file: fileContainer.file, progress: 0 });
                });

            //setup initial time, if uploadCollection was empty
            if (uploadCollection.length === 0) {
                startTime = new Date().getTime();
            }
            uploadCollection.add(uploadFiles);

            this.calculateTotalSíze();
        };

        this.progress = function (item, position, files) {
            var model = uploadCollection.at(position),
                request = api.upload(
                    _.extend({ file: item.file }, item.options)
                )
                .progress(function (e) {
                    // update progress
                    var sub = e.loaded / e.total;

                    if (model) {
                        var loaded = model.get('loaded');
                        model.set({ progress: sub, loaded: e.loaded });

                        currentSize += e.loaded - loaded;
                    }

                    totalProgress = (position + sub) / files.length;

                    //update uploaded size for time estimation
                    uploadCollection.trigger('progress', {
                        progress: totalProgress,
                        estimatedTime: getEstimatedTime()
                    });
                })
                .fail(function (e) {
                    model.set({ abort: true });
                    remove(model);

                    if (e && e.data && e.data.custom && e.error !== '0 abort') {
                        notifications.yell(e.data.custom.type, e.data.custom.text);
                    }
                });

            uploadCollection.at(position).set({ request: request });

            return request;
        };

        this.stop = function () {
            var requests = uploadCollection.pluck('request');
            totalSize = 0;
            api.trigger('stop:upload', requests);
            api.trigger('refresh.all');
            totalProgress = 0;
            currentSize = 0;
            // set abort to true to remove all files from uploadview which have not been uploaded yet
            uploadCollection.each(function (model) {
                if (model.get('progress') !== 1) model.set('abort', true);
            });
            uploadCollection.reset();
        };

        this.getTotalProgress = function () {
            return totalProgress;
        };

        function getEstimatedTime() {
            var time = new Date().getTime() - startTime,
                progress = Math.min(1, currentSize / totalSize),
                estimation = time / progress - time || 0,
                counter = 0;

            do {
                estimation = Math.round(estimation / limits[counter].limit);
                counter++;
            } while (counter < limits.length && limits[counter].limit < estimation);

            return (limits[counter - 1].message(estimation)) || 0;
        }
        this.getEstimatedTime = getEstimatedTime;

        this.abort = function (cid) {
            uploadCollection
                .filter(function (model) {
                    return typeof model !== 'undefined' && typeof cid !== 'undefined' && model.cid === cid;
                })
                .forEach(function (model) {
                    var request = model.get('request');
                    if (request === null) {
                        //remove the model from the list
                        model.set({ abort: true });
                        remove(model);
                    } else if (request.state() === 'pending') {
                        //abort the upload process
                        request.abort();
                    }
                });
        };

        this.collection = uploadCollection;
        uploadCollection
            .on('progress', function (baton) {
                var progressWrapper = $('.upload-wrapper'),
                    progressBar = progressWrapper.find('.progress-bar'),
                    progressText = progressWrapper.find('.sr-only'),
                    val = Math.round(baton.progress * 100);

                progressBar
                    .attr({ 'aria-valuenow': val })
                    .css({ 'width': val + '%' });
                progressText.text(
                    //#. %1$s progress of currently uploaded files in percent
                    gt('%1$s completed', val + '%')
                );

                progressWrapper.find('.estimated-time').text(
                    //#. %1$s remaining upload time
                    gt('Remaining time: %1$s', baton.estimatedTime)
                );
            })
            .on('remove', function (model, collection, options) {
                self.create.remove(options.index);
            });

        function remove(model) {
            currentSize -= model.get('loaded');
            totalSize -= model.get('file').size;
            uploadCollection.remove(model);
        }

        this.setWindowNode = function (node) {
            bottomToolbar = node.find('.toolbar.bottom');
            mainView = node.find('.list-view-control');
            if (mainView.length === 0) {
                mainView = node;
            }
        };

        this.setAPI = function (alternativeAPI) {
            api = alternativeAPI;
        };

        this.create = upload.createQueue(this)
            .on('start', function () {
                mainView.addClass('toolbar-bottom-visible');
                $el = $('<div class="upload-wrapper">');
                ext.point('io.ox/files/upload/toolbar').invoke('draw', $el, ext.Baton({ fileupload: this }));
                bottomToolbar.append($el);
            }.bind(this))
            .on('progress', function (e, def, file) {
                $('.upload-wrapper').find('.file-name').text(
                    //#. the name of the file, which is currently uploaded (might be shortended by '...' on missing screen space )
                    gt('Uploading "%1$s"', file.file.name)
                );
            })
            .on('stop', function () {
                mainView.removeClass('toolbar-bottom-visible');
                // if something went wrong before the start (filesize to big etc.) there is no $el
                if ($el) {
                    $el.remove();
                }
            });
        this.update = upload.createQueue(_.extend({}, this, {
            progress: function (item, position, files) {

                var model = uploadCollection.at(position),
                    request = api.versions.upload({
                        file: item.file,
                        id: item.options.id,
                        folder: item.options.folder,
                        timestamp: _.then(),
                        params: item.options.params,
                        version_comment: item.options.version_comment
                    })
                    .progress(function (e) {
                        // update progress
                        var sub = e.loaded / e.total;
                        if (model) {
                            var loaded = model.get('loaded');
                            model.set({ progress: sub, loaded: e.loaded });

                            currentSize += e.loaded - loaded;
                        }

                        totalProgress = (position + sub) / files.length;
                        //update uploaded size for time estimation
                        uploadCollection.trigger('progress', {
                            progress: totalProgress,
                            estimatedTime: getEstimatedTime()
                        });
                    })
                    .fail(function (e) {
                        model.set({ abort: true });
                        remove(model);

                        if (e && e.data && e.data.custom && e.error !== '0 abort') {
                            notifications.yell(e.data.custom.type, e.data.custom.text);
                        }
                    });
                uploadCollection.at(position).set({ request: request });

                return request;
            }
        }))
        .on('start', function () {
            mainView.addClass('toolbar-bottom-visible');
            $el = $('<div class="upload-wrapper">');
            ext.point('io.ox/files/upload/toolbar').invoke('draw', $el, ext.Baton({ fileupload: this }));
            bottomToolbar.append($el);
        }.bind(this))
        .on('progress', function (e, def, file) {
            $('.upload-wrapper').find('.file-name').text(
                //#. the name of the file, which is currently uploaded (might be shortended by '...' on missing screen space )
                gt('Uploading "%1$s"', file.file.name)
            );
        })
        .on('stop', function () {
            mainView.removeClass('toolbar-bottom-visible');
            // if something went wrong before the start (filesize to big etc.) there is no $el
            if ($el) {
                $el.remove();
            }
        });
    }

    /*
     * This extension point adds a toolbar, which displays the upload progess of all files.
     * If several files are loaded this toolbar provides links to open an overview of all currently uploaded files.
     */
    ext.point('io.ox/files/upload/toolbar').extend({
        draw: function (baton) {
            this.append(
                $('<div class="upload-title">').append(
                    $('<div class="estimated-time">'),
                    $('<div class="file-name">')
                ),
                $('<div class="upload-details">').append(
                    $('<a href=#>').text(gt('Details')).click(function (e) {
                        e.preventDefault();

                        require(['io.ox/files/upload/view'], function (uploadView) {
                            uploadView.show();
                        });
                    })
                ),
                $('<div class="upload-cancel">').append(
                    $('<a href=#>').text(gt('Cancel')).click(function (e) {
                        e.preventDefault();
                        baton.fileupload.abort();
                    })
                ),
                $('<div class="progress">').append(
                    $('<div class="progress-bar progress-bar-striped active">')
                    .attr({
                        'role': 'progressbar',
                        'aria-valuenow': '0',
                        'aria-valuemin': '0',
                        'aria-valuemax': '100'
                    })
                    .css({ 'width': '0%' })
                    .append(
                        $('<span class="sr-only">').text(
                            //#. %1$s progress of currently uploaded files in percent
                            gt('%1$s completed', '0%')
                        )
                    )
                )
            );
        }
    });

    return new FileUpload();
});
