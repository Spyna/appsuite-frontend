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
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/files/list/view-detail',
    ['io.ox/core/extensions',
     'io.ox/core/extPatterns/links',
     'io.ox/core/extPatterns/actions',
     'io.ox/core/date',
     'io.ox/files/actions',
     'io.ox/files/api',
     'io.ox/preview/main',
     'io.ox/core/api/user',
     'io.ox/core/api/folder',
     'io.ox/core/tk/attachments',
     'gettext!io.ox/files',
     'less!io.ox/files/style.less'], function (ext, links, actionPerformer, date, actions, filesAPI, preview, userAPI, folderAPI, attachments, gt) {

    'use strict';

    var POINT = 'io.ox/files/details';

    // Inline Actions
    ext.point(POINT).extend(new links.InlineLinks({
        index: 100,
        id: 'inline-links',
        ref: 'io.ox/files/links/inline'
    }));

    // Title
    ext.point(POINT).extend({
        id: 'title',
        index: 200,
        draw: function (baton) {
            this.append(
                $('<div tabindex="1">').addClass('title clear-title')
                .text(gt.noI18n(baton.data.title || baton.data.filename || '\u00A0'))
                .on('dblclick', function () {
                    actionPerformer.invoke('io.ox/files/actions/rename', null, baton);
                })
                .on('keydown', function (e) {
                    if ((e.keyCode || e.which) === 13) { // enter
                        actionPerformer.invoke('io.ox/files/actions/rename', null, baton);
                    }
                })
            );
        }
    });

    // Display locked file information
    ext.point(POINT).extend({
        index: 210,
        id: 'filelock',
        draw: function (baton) {
            if (filesAPI.tracker.isLocked(baton.data)) {
                var div, lockInfo;
                this.append(
                    div = $('<div>').addClass('alert alert-info')
                );
                if (filesAPI.tracker.isLockedByMe(baton.data)) {
                    lockInfo = gt('This file is locked by you');
                } else {
                    lockInfo = gt('This file is locked by %1$s');
                }
                lockInfo.replace(/(%1\$s)|([^%]+)/g, function (a, link, text) {
                    if (link) div.append(userAPI.getLink(baton.data.modified_by));
                    else div.append($.txt(text));
                });
            }
        }
    });

    // Preview
    (function () {

        function parseArguments(file) {
            if (!file.filename) {
                return null;
            }
            return {
                name: file.filename,
                filename: file.filename,
                mimetype: file.file_mimetype,
                size: file.file_size,
                dataURL: filesAPI.getUrl(file, 'bare'),
                version: file.version,
                id: file.id,
                folder_id: file.folder_id
            };
        }

        ext.point(POINT).extend({
            id: 'preview',
            index: 300,
            draw: function (baton) {
                function isEnabled(file) {
                    if (!file.filename) {
                        return false;
                    }
                    return (new preview.Preview(parseArguments(file))).supportsPreview();
                }

                var lastWidth = 0, $previewNode, drawResizedPreview;

                function fnDrawPreview() {
                    var width = $previewNode.innerWidth();
                    if (width > lastWidth) {
                        $previewNode.empty();
                        lastWidth = width; // Must only recalculate once we get bigger
                        var prev = new preview.Preview(parseArguments(baton.data), { width: width, height: 'auto'});
                        prev.appendTo($previewNode);
                    }
                }

                if (isEnabled(baton.data)) {
                    $previewNode = $('<div class="preview">');
                    this.append($previewNode);
                    drawResizedPreview = _.debounce(fnDrawPreview, 300);
                    $(window).on('resize', drawResizedPreview);
                    $previewNode.on('dispose', function () {
                        $(window).off('resize', drawResizedPreview);
                    });
                    _.defer(fnDrawPreview);
                }
            }
        });
    }());

    // Description
    ext.point(POINT).extend({
        id: 'description',
        index: 400,
        draw: function (baton) {
            var text = $.trim(baton.data.description || '');
            if (text !== '') {
                this.append(
                    $('<div class="description">')
                    .text(gt.noI18n(text))
                    .on('dblclick', function () {
                        actionPerformer.invoke('io.ox/files/actions/edit-description', null, baton);
                    })
                );
            }
        }
    });

    ext.point(POINT).extend({
        id: 'breadcrumb',
        index: 500,
        draw: function (baton, app) {
            var folderSet;
            if (app) {
                folderSet = app.folder.set;
            }
            this.append(
                folderAPI.getBreadcrumb(baton.data.folder_id, {
                    exclude: ['9'],
                    handler: folderSet,
                    last: false,
                    prefix: gt('Saved in'),
                    subfolder: false
                })
                .addClass('chromeless')
            );
        }
    });

    // Upload Field
    ext.point(POINT).extend({
        id: 'upload',
        index: 600,
        draw: function (baton) {
            if (baton.openedBy === 'io.ox/mail/write') return;//no uploads in mail preview
            var self = this, file = baton.data;

            var $node,
            $commentArea,
            $comment,
            $uploadButton,
            $input = attachments.fileUploadWidget({
                displayLabel: true,
                displayButton: false,
                displayLabelText: gt('Upload a new version')
            });

            $node = $('<form>').append(
                $('<div>').addClass('row-fluid').append(
                    $('<div class="pull-left">').append(
                        $input
                    ),
                    $uploadButton = $('<button type="button" data-action="upload" tabindex="1">')
                        .addClass('uploadbutton btn btn-primary pull-right').text(gt('Upload file')),
                    $('<div>').addClass('comment').append(
                        $comment = $('<div class="row-fluid">').append(
                            $('<label>').text(gt('Version Comment')),
                            $commentArea = $('<textarea rows="5" tabindex="1"></textarea>')
                        ).hide()
                    )
                )
            ).appendTo(this);

            var resetCommentArea = function () {
                if ($input.find('[data-dismiss="fileupload"]').is(':visible')) {
                    $uploadButton.show().text(gt('Upload new version'));
                    $commentArea.removeClass('disabled').val('');
                    $comment.hide();
                    $uploadButton.hide();
                    //general upload error
                    $uploadButton.removeClass('disabled');
                    $input.closest('form').get(0).reset();
                }
            };

            var uploadFailed = function (e) {
                require(['io.ox/core/notifications']).pipe(function (notifications) {
                    if (e && e.data && e.data.custom) {
                        notifications.yell(e.data.custom.type, e.data.custom.text);
                    }
                });
                resetCommentArea();
            };

            $uploadButton.on('click', function (e) {
                e.preventDefault();
                $(this).addClass('disabled').text(gt('Uploading...'));
                $commentArea.addClass('disabled');

                if (_.browser.IE !== 9) {
                    var files = $input.find('input[type="file"]')[0].files || [];

                    filesAPI.uploadNewVersion({
                        file: _(files).first(),
                        id: file.id,
                        folder: file.folder_id,
                        timestamp: _.now(),
                        json: {version_comment: $commentArea.val()}
                    }).done(resetCommentArea)
                    .fail(uploadFailed);
                } else {
                    $input.find('input[type="file"]').attr('name', 'file');

                    filesAPI.uploadNewVersionOldSchool({
                        form: $node,
                        id: file.id,
                        folder: file.folder_id,
                        timestamp: _.now(),
                        json: {version_comment: $commentArea.val()}
                    }).done(resetCommentArea);
                }
                return false;
            });

            $input.on('change', function () {
                if ($input.find('[data-dismiss="fileupload"]').is(':visible')) {
                    $uploadButton.show();
                    $comment.show();
                    $commentArea.focus();
                }
            }).find('[data-dismiss="fileupload"]').on('click', function (e) {
                e.preventDefault();
                resetCommentArea(e);
            });

        }
    });

    // Version List
    var versionSorter = function (version1, version2) {
        return version2.version - version1.version;
    };

    ext.point(POINT).extend({
        id: 'versions',
        index: 700,
        draw: function (baton, detailView, allVersions) {

            var $content, openedBy = baton.openedBy;

            function drawAllVersions(allVersions) {
                _.chain(allVersions)
                .sort(versionSorter)
                .each(function (version) {
                    var $versionnumber;
                    var $entryRow = $('<tr>')
                            .addClass('version ' + (version.current_version ? 'info' : ''))
                            .append(
                                $versionnumber = $('<td>').append(
                                    $('<span>').text(gt.noI18n(version.version)).addClass('versionLabel')
                                )
                            );


                    var baton = ext.Baton({ data: version, openedBy: openedBy});
                    baton.isCurrent = version.id === baton.data.current_version;
                    ext.point(POINT + '/version').invoke('draw', $entryRow, baton);
                    $content.append($entryRow);
                });
            }

            if (baton.data.number_of_versions >= 1) {

                $content = $('<table class="versiontable table table-striped table-hover table-bordered">').append(
                    $('<thead>').append(
                        $('<tr>').append(
                            $('<th>').text(_.noI18n('#')),
                            $('<th>').text(gt('File'))
                        )
                    )
                );


                // Then let's fetch all versions and update the table accordingly
                if (!allVersions) {
                    filesAPI.versions({ id: baton.data.id }).done(drawAllVersions);
                } else {
                    drawAllVersions(allVersions);
                }

                var $historyDefaultLabel = gt('Show version history') + ' (' + baton.data.number_of_versions + ')',
                    $historyButton = $('<a>', { 'data-action': 'history', 'href': '#', tabindex: 1 }).addClass('noI18n').text($historyDefaultLabel)
                        .on('click', function (e) {
                        e.preventDefault();
                        if ($content.is(':hidden')) {
                            $(this).text(gt('Version history') + ' (' + baton.data.number_of_versions + ')');
                        } else {
                            $(this).text($historyDefaultLabel);
                        }
                        $content.toggle();
                    });

                this.append(
                    $historyButton,
                    $content
                );
            }
        }
    });

    // dropdown
    ext.point(POINT + '/version/dropdown').extend(new links.DropdownLinks({
        index: 10,
        label: '',
        ref: 'io.ox/files/versions/links/inline'
    }));

    // Extensions for the version detail table
    ext.point(POINT + '/version').extend({ index: 10,
        id: 'filename',
        draw: function (baton) {
            baton.label = _.noI18n(baton.data.filename);
            var row;

            this.append(
                row = $('<td>')
            );

            ext.point(POINT + '/version/dropdown').invoke('draw', row, baton);
        }
    });

    // Basic Info Fields
    var bytesToSize = function (bytes) {
        var sizes = ['B', 'KB', 'MB', 'GB', 'TB'], i;
        if (bytes === 0) {
            return 'n/a';
        } else {
            i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
            return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
        }
    };

    ext.point(POINT + '/version').extend({
        id: 'size',
        index: 20,
        draw: function (baton) {
            this.find('td:last').append($('<span class="size pull-left">').text(gt.noI18n(bytesToSize(baton.data.file_size))));
        }
    });

    ext.point(POINT + '/version').extend({
        id: 'created_by',
        index: 40,
        draw: function (baton) {
            this.find('td:last').append($('<span class="pull-right createdby">').append(userAPI.getLink(baton.data.created_by).attr('tabindex', 1)));
        }
    });

    ext.point(POINT + '/version').extend({
        id: 'last_modified',
        index: 30,
        draw: function (baton) {
            var d = new date.Local(baton.data.last_modified);
            this.find('td:last').append($('<span class="pull-right last_modified">').text(gt.noI18n(d.format(date.DATE_TIME))));
        }
    });

    ext.point(POINT + '/version').extend({
        id: 'comment',
        index: 50,
        draw: function (baton) {
            if (baton.data.version_comment !== null &&  baton.data.version_comment !== '') {
                this.find('td:last').append($('<div class="comment">').append($('<span>').addClass('version-comment').text(gt.noI18n(baton.data.version_comment || '\u00A0'))));
            }
        }
    });

    var draw = function (baton, app) {
        if (!baton) return $('<div>');
        baton = ext.Baton.ensure(baton);
        if (app) {//save the appname so the extensions know what opened them (to disable some options for example)
            baton.openedBy = app.getName();
        }
        var node = $.createViewContainer(baton.data, filesAPI);

        node.on('redraw', createRedraw(node)).addClass('file-details view');

        ext.point(POINT).invoke('draw', node, baton, app);

        return node;
    };

    var createRedraw = function (node) {
        return function (e, data) {
            node.replaceWith(draw(data));
        };
    };

    return {
        draw: draw
    };
});
