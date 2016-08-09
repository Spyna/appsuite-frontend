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
 * @author  Tobias Prinz <tobias.prinz@open-xchange.com>
 */

define('plugins/portal/recentfiles/register', [
    'io.ox/core/extensions',
    'io.ox/files/api',
    'io.ox/core/api/user',
    'gettext!plugins/portal',
    'settings!io.ox/core',
    'less!plugins/portal/recentfiles/style'
], function (ext, filesAPI, userAPI, gt, settings) {

    'use strict';

    _(['recentfiles', 'myfiles']).each(function (type) {

        var searchOptions = { includeSubfolders: true, limit: _.device('smartphone') ? 5 : 10, order: 'desc', sort: 5 };

        if (type === 'myfiles') {
            searchOptions.folder = settings.get('folder/infostore');
        }

        var title = type === 'recentfiles' ? gt('Recently changed files') : gt('My latest files');

        ext.point('io.ox/portal/widget/' + type).extend({

            // helps at reverse lookup
            type: 'recentfiles',

            title: title,

            load: function (baton) {
                return filesAPI.search('', searchOptions).then(function (files) {
                    // update baton
                    baton.data = files;
                    // get user ids
                    var userIds = _(files).chain().pluck('modified_by').uniq().value();
                    // map userids back to each file
                    return userAPI.getList(userIds)
                        .done(function (users) {
                            _(files).each(function (file) {
                                file.modified_by = _(users).find(function (user) { return user.id === file.modified_by; });
                            });
                        })
                        .then(function () {
                            return files;
                        });
                });
            },

            summary: function (baton) {

                if (this.find('.summary').length) return;

                var message = '',
                    count = baton.data.length;

                if (count === 0) {
                    message = gt('No files have been changed recently');
                } else if (count === 1) {
                    message = gt('1 file has been changed recently');
                } else {
                    message = gt('%1$d files has been changed recently', count);
                }

                this.addClass('with-summary show-summary').append(
                    $('<div class="summary">').text(message)
                )
                .on('tap', 'h2', function (e) {
                    $(e.delegateTarget).toggleClass('show-summary');
                });
            },

            preview: function (baton) {

                var content = $('<ul class="content recentfiles list-unstyled">').appendTo(this),
                    data = baton.data;

                if (!data || data.length === 0) {
                    content.text(gt('No files have been changed recently'));
                    return;
                }

                content.append(
                    _(data).map(function (file) {
                        var filename = String(file.filename || file.title || '');
                        // create nice filename for long names
                        if (filename.length > 20) {
                            // remove leading & tailing date stufff
                            filename = filename
                                .replace(/^[0-9_\-\.]{5,}(\D)/i, '\u2026$1')
                                .replace(/[0-9_\-\.]{5,}(\.\w+)?$/, '\u2026$1');
                        }
                        return $('<li class="item" tabindex="0">')
                            .data('item', file)
                            .append(
                                $('<b>').text(_.noI18n(filename)), $.txt(' '),
                                $('<span class="gray">').text(
                                    type === 'recentfiles' ?
                                        // show WHO changed it
                                        _.noI18n(file.modified_by.display_name) :
                                        // show WHEN it was changed
                                        moment.utc(file.last_modified).format('l LT')
                                )
                            );
                    })
                );

                // store a copy of all items
                content.data('items', _(data).map(_.cid));

                content.on('click', 'li.item', function (e) {
                    e.stopPropagation();
                    var items = $(e.delegateTarget).data('items'),
                        item = $(e.currentTarget).data('item');
                    require(['io.ox/core/viewer/main'], function (Viewer) {
                        filesAPI.get(item).done(function (data) {
                            var models = filesAPI.resolve(items, false),
                                collection = new Backbone.Collection(models),
                                viewer = new Viewer();
                            baton = new ext.Baton({ data: data, collection: collection });
                            viewer.launch({ selection: baton.data, files: baton.collection.models });
                        });
                    });
                });
            },

            draw: function () {
            }
        });

        // publish
        ext.point('io.ox/portal/widget').extend({ id: type });

        ext.point('io.ox/portal/widget/' + type + '/settings').extend({
            title: title,
            type: type,
            unique: true,
            editable: false
        });
    });
});
