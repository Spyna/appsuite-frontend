/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 *  2015 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/files/view-options', [
    'io.ox/core/extensions',
    'io.ox/backbone/mini-views/dropdown',
    'io.ox/core/folder/breadcrumb',
    'gettext!io.ox/files'
], function (ext, Dropdown, BreadcrumbView, gt) {

    'use strict';

    //
    // Mark as secondary toolbar
    //

    ext.point('io.ox/files/list-view/toolbar/top').extend({
        id: 'secondary',
        index: 100,
        draw: function () {
            this.addClass('secondary-toolbar');
        }
    });

    //
    // View dropdown
    //

    ext.point('io.ox/files/view-options').extend({
        id: 'sort',
        index: 100,
        draw: function () {
            this.data('view')
                .option('sort', 702, gt('Name'))
                .option('sort',   5, gt('Date'))
                .option('sort', 704, gt('Size'));
        }
    });

    ext.point('io.ox/files/view-options').extend({
        id: 'order',
        index: 200,
        draw: function () {
            this.data('view')
                .divider()
                .option('order', 'asc', gt('Ascending'))
                .option('order', 'desc', gt('Descending'));
        }
    });

    ext.point('io.ox/files/list-view/toolbar/top').extend({
        id: 'dropdown',
        index: 1000,
        draw: function (baton) {

            var dropdown = new Dropdown({
                //#. Sort options drop-down
                label: gt.pgettext('dropdown', 'Sort by'),
                model: baton.app.props,
                caret: true
            });

            ext.point('io.ox/files/view-options').invoke('draw', dropdown.$el, baton);
            this.append(dropdown.render().$el.addClass('grid-options toolbar-item pull-right').on('dblclick', function (e) {
                e.stopPropagation();
            }));
        }
    });

    //
    // Select dropdown
    //

    function changeSelection(e) {

        e.preventDefault();

        var list = e.data.list,
            type = $(this).attr('data-name');

        // need to defer that otherwise the list cannot keep the focus
        _.defer(function () {
            if (type === 'all') {
                list.selection.selectAll();
            } else if (type === 'files') {
                list.selection.selectNone();
                list.selection.selectAll(':not(.file-type-folder)');
            } else if (type === 'none') {
                list.selection.selectNone();
            }
        });
    }

    ext.point('io.ox/files/select/options').extend({
        id: 'default',
        index: 100,
        draw: function (baton) {

            this.data('view')
                .header(gt('Select'))
                .link('all', gt('All'))
                .link('files', gt('All files'))
                .link('none', gt('None'))
                .divider()
                //#. Verb: (to) filter documents by file type
                .header(gt.pgettext('verb', 'Filter'))
                .option('filter', 'pdf', gt('PDFs'))
                .option('filter', 'doc', gt('Documents'))
                .option('filter', 'xls', gt('Spreadsheets'))
                .option('filter', 'ppt', gt('Presentations'))
                .option('filter', 'image', gt('Images'))
                .option('filter', 'audio', gt('Music'))
                .option('filter', 'video', gt('Videos'))
                .option('filter', 'none', gt('None'));

            this.data('view').$ul.on('click', 'a', { list: baton.app.listView }, changeSelection);
        }
    });

    ext.point('io.ox/files/list-view/toolbar/top').extend({
        id: 'select',
        index: 2000,
        draw: function (baton) {

            var dropdown = new Dropdown({
                //#. Sort options drop-down
                label: gt.pgettext('dropdown', 'Select'),
                model: baton.app.props,
                caret: true
            });

            ext.point('io.ox/files/select/options').invoke('draw', dropdown.$el, baton);

            this.append(
                dropdown.render().$el.addClass('grid-options toolbar-item ' + (_.device('smartphone') ? 'pull-left' : 'pull-right'))
            );
        }
    });

    //
    // Breadcrumb
    //

    ext.point('io.ox/files/list-view/toolbar/top').extend({
        id: 'breadcrumb',
        index: 300,
        draw: function (baton) {

            if (_.device('smartphone')) return;

            var view = new BreadcrumbView({ app: baton.app }).render().$el.addClass('toolbar-item'),
                results = $('<div class="toolbar-item">').text(gt('Search results')).hide();

            this.append(view, results);

            baton.app.props.on('change:find-result', function (model, value) {
                view.toggle(!value);
                results.toggle(value);
            });
        }
    });

    //
    // Folder view toggle
    //

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

    ext.point('io.ox/files/list-view/toolbar/bottom').extend({
        id: 'add-accounts',
        index: 100,
        draw: function (baton) {
            require(['io.ox/keychain/api'], function (keychainApi) {
                var toolbar = baton.app.getWindow().nodes.sidepanel,
                    availableServices = _(keychainApi.submodules).filter(function (submodule) {
                        return !submodule.canAdd || submodule.canAdd.apply(this);
                    }),
                    buttonTemplates = {
                        'google': [gt('Add Google Drive account'),'logo-google', 'fa-google'],
                        'dropbox': [gt('Add Dropbox account'),'logo-dropbox', 'fa-dropbox'],
                        'msliveconnect': [gt('Add OneDrive account'),'logo-onedrive', 'fa-windows'],
                        'boxcom': [gt('Add Box.com account'), 'logo-boxcom', 'fa-archive']
                    },
                    buttons = {};

                if (availableServices.length === 0) {
                    return;
                }
                _(availableServices).each(function (service) {
                    if (service.id === 'google' || service.id === 'dropbox' || service.id === 'boxcom' || service.id === 'msliveconnect') {
                        buttonTemplates[service.id].push(service);
                        buttons[service.id] = (buildbutton.apply(this, buttonTemplates[service.id]));
                    }
                });
                if (_.size(buttons) === 0) {
                    return;
                }
                function buildbutton (text, customclass, icon, service) {
                    var node = $('<a href="#" class="toolbar-item" role="button">').addClass(customclass)
                        .append(
                            icon ? [$('<i class="fa ' + icon + '" aria-hidden="true">'), $('<span class="sr-only">').text(text)] : $('<span>').text(text)
                        ).attr({
                            'data-toggle': 'tooltip',
                            'data-placement': 'top',
                            'data-animation': 'false',
                            'data-container': 'body',
                            'title': text
                        }).tooltip();
                    if (service) {
                        node.on('click', function () {
                            var win = window.open(ox.base + '/busy.html', '_blank', 'height=600, width=800, resizable=yes, scrollbars=yes');
                            service.createInteractively(win);
                        });
                    }
                    return node;
                }

                toolbar.addClass('file-storage-toolbar').append(
                    $('<div class="generic-toolbar over-bottom visual-focus">').append(
                        $('<label class=add-acc-label>').text(gt('Add account')),
                        $('<div class="clearfix">').append(
                            buttons.dropbox || '',
                            buttons.google || '',
                            buttons.msliveconnect || '',
                            buttons.boxcom || ''
                            /*buildbutton(gt('Add account'), 'misc-link', 'fa-ellipsis-h').on('click', function () {
                                ox.launch('io.ox/settings/main', { id: 'io.ox/settings/accounts' }).done(function () {
                                    this.setSettingsPane({ id: 'io.ox/settings/accounts' });
                                });
                            })*/
                            )
                        )
                    );
            });
        }
    });

    ext.point('io.ox/files/list-view/toolbar/bottom').extend({
        id: 'toggle-folderview',
        index: 200,
        draw: function (baton) {
            this.append(
                $('<a href="#" class="toolbar-item" tabindex="1">')
                .attr('title', gt('Open folder view'))
                .append($('<i class="fa fa-angle-double-right">'))
                .on('click', { app: baton.app, state: true }, toggleFolderView)
            );

            var side = baton.app.getWindow().nodes.sidepanel;

            side.addClass('bottom-toolbar');
            side.append(
                $('<div class="generic-toolbar bottom visual-focus">').append(
                    $('<a href="#" class="toolbar-item" role="button" tabindex="1">')
                    .append(
                        $('<i class="fa fa-angle-double-left" aria-hidden="true">'),
                        $('<span class="sr-only">').text(gt('Close folder view'))
                    )
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
