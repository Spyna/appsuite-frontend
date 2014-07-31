/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 *  2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/mail/view-options',
    ['io.ox/core/extensions',
     'io.ox/backbone/mini-views/dropdown',
     'io.ox/core/api/account',
     'gettext!io.ox/mail'
    ], function (ext, Dropdown, account, gt) {

    'use strict';

    // no view options on smartphones
    //if (_.device('small')) return;

    ext.point('io.ox/mail/view-options').extend({
        id: 'sort',
        index: 100,
        draw: function (batton) {
            this.data('view')
                .option('sort', 610, gt('Date'))
                .option('sort', 'from-to', account.is('sent|drafts', batton.app.folder.get()) ? gt('To') : gt('From'))
                .option('sort', 651, gt('Unread'))
                .option('sort', 608, gt('Size'))
                .option('sort', 607, gt('Subject'))
                .option('sort', 102, gt('Color'));
        }
    });

    ext.point('io.ox/mail/view-options').extend({
        id: 'order',
        index: 200,
        draw: function () {
            this.data('view')
                .divider()
                .option('order', 'asc', gt('Ascending'))
                .option('order', 'desc', gt('Descending'));
        }
    });

    ext.point('io.ox/mail/view-options').extend({
        id: 'thread',
        index: 300,
        draw: function (baton) {
            // don't add if thread view is disabled server-side
            if (baton.app.settings.get('threadSupport', true) === false) return;
            this.data('view')
                .divider()
                .option('thread', true, gt('Conversations'));
        }
    });

    ext.point('io.ox/mail/list-view/toolbar/top').extend({
        id: 'dropdown',
        index: 1000,
        draw: function (baton) {

            var dropdown = new Dropdown({
                //#. Sort options drop-down
                label: gt.pgettext('dropdown', 'Sort by'),
                model: baton.app.props
            });

            ext.point('io.ox/mail/view-options').invoke('draw', dropdown.$el, baton);
            this.append(dropdown.render().$el.addClass('grid-options toolbar-item pull-right').on('dblclick', function (e) {
                e.stopPropagation();
            }));
        }
    });

    function toggleSelection(e) {
        if (e.type === 'click' || e.keyCode === 32) {
            e.preventDefault();
            var i = $(this).find('i'),
            selection = e.data.baton.app.listView.selection;
            if (i.hasClass('fa-check-square-o')) {
                i.attr('class', 'fa fa-square-o');
                selection.selectNone();
            } else {
                i.attr('class', 'fa fa-check-square-o');
                selection.selectAll();
            }

             e.data.baton.view.listView.on('selection:empty', function () {
                i.removeClass('fa fa-check-square-o');
                i.addClass('fa fa-square-o');
            });
        }
    }

    ext.point('io.ox/mail/list-view/toolbar/top').extend({
        id: 'select-all',
        index: 100,
        draw: function (baton) {
            this.append(
                $('<a href="#" class="toolbar-item select-all" tabindex="1">').append(
                    $('<i class="fa fa-square-o">'),
                    $.txt(gt('Select all'))
                )
                .on('click', { baton: baton }, toggleSelection)
                .on('dblclick', function (e) {
                    e.stopPropagation();
                })
                .on('keydown', { baton: baton }, toggleSelection)
            );
        }
    });

    function toggleFolderView(e) {
        e.preventDefault();
        e.data.app.folderView.toggle(e.data.state);
    }

    function onFolderViewOpen(app) {
        app.getWindow().nodes.main.find('.list-view-control')
            .removeClass('toolbar-bottom-visible');
    }

    function onFolderViewClose(app) {
        app.getWindow().nodes.main.find('.list-view-control')
            .addClass('toolbar-bottom-visible');
    }

    ext.point('io.ox/mail/list-view/toolbar/bottom').extend({
        id: 'toggle-folderview',
        index: 100,
        draw: function (baton) {

            this.append(
                $('<a href="#" class="toolbar-item" tabindex="1">')
                .attr('title', gt('Open folder view'))
                .append($('<i class="fa fa-angle-double-right">'))
                .on('click', { app: baton.app, state: true }, toggleFolderView)
            );

            var side = baton.app.getWindow().nodes.sidepanel;

            side.addClass('bottom-toolbar');
            side.append(
                $('<div class="generic-toolbar bottom visual-focus">').append(
                    $('<a href="#" class="toolbar-item" tabindex="1">')
                    .attr('title', gt('Close folder view'))
                    .append($('<i class="fa fa-angle-double-left">'))
                    .on('click', { app: baton.app, state: false }, toggleFolderView)
                )
            );

            baton.app.on({
                'folderview:open': onFolderViewOpen.bind(null, baton.app),
                'folderview:close': onFolderViewClose.bind(null, baton.app)
            });

            if (baton.app.folderViewIsVisible()) _.defer(onFolderViewOpen, baton.app);
        }
    });
});
