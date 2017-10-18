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

define('io.ox/mail/view-options', [
    'io.ox/core/extensions',
    'io.ox/backbone/mini-views/dropdown',
    'io.ox/backbone/mini-views/common',
    'io.ox/core/api/account',
    'gettext!io.ox/mail',
    'io.ox/core/commons',
    'io.ox/core/folder/contextmenu',
    'io.ox/backbone/views/search',
    'io.ox/core/api/collection-loader',
    'io.ox/core/http',
    'io.ox/mail/api',
    'settings!io.ox/mail'
], function (ext, Dropdown, mini, account, gt, commons, contextmenu, SearchView, CollectionLoader, http, mailAPI, settings) {

    'use strict';

    //
    // Top
    //
    ext.point('io.ox/mail/list-view/toolbar/top').extend({
        id: 'search',
        index: 100,
        draw: function (baton) {

            var listView = baton.app.listView;

            var collectionLoader = new CollectionLoader({
                module: 'mail',
                mode: 'search',
                getQueryParams: function (params) {

                    var criteria = params.criteria, filters = [], start, end,
                        // special support for main languages (en, de, fr, es)
                        from = criteria.from || criteria.von || criteria.de,
                        to = criteria.to || criteria.an || criteria.a || criteria.para,
                        subject = criteria.subject || criteria.betreff || criteria.sujet || criteria.asunto,
                        year = criteria.year || criteria.y || criteria.jahr || criteria.ano;

                    if (from) filters.push(['=', { field: 'from' }, from]);
                    if (to) filters.push(['or', ['=', { field: 'to' }, to], ['=', { field: 'cc' }, to], ['=', { field: 'bcc' }, to]]);
                    if (subject) filters.push(['=', { field: 'subject' }, subject]);
                    if (year) {
                        start = Date.UTC(year, 0, 1);
                        end = Date.UTC(year, 11, 31);
                        filters.push(['and', ['>', { field: 'received_date' }, String(start)], ['<', { field: 'received_date' }, String(end)]]);
                    }
                    if (criteria.words) {
                        _(criteria.words.split(' ')).each(function (word) {
                            filters.push(['or', ['=', { field: 'content' }, word], ['=', { field: 'subject' }, word]]);
                        });
                    }
                    if (criteria.addresses) {
                        _(criteria.addresses.split(' ')).each(function (address) {
                            filters.push(['or', ['=', { field: 'to' }, address], ['=', { field: 'cc' }, address], ['=', { field: 'bcc' }, address], ['=', { field: 'content' }, address]]);
                        });
                    }
                    if (criteria.attachment === 'true') filters.push(['=', { field: 'content_type' }, 'multipart/mixed']);
                    if (criteria.after) filters.push(['>', { field: 'received_date' }, String(criteria.after)]);
                    if (criteria.before) filters.push(['<', { field: 'received_date' }, String(criteria.before)]);

                    var folder = criteria.folder === 'all' ? mailAPI.allMessagesFolder : baton.app.folder.get();

                    return {
                        action: 'search',
                        folder: folder,
                        columns: '102,600,601,602,603,604,605,606,607,608,610,611,614,652,656,X-Open-Xchange-Share-URL',
                        sort: params.sort || '610',
                        order: params.order || 'desc',
                        timezone: 'utc',
                        data: { filter: ['and'].concat(filters) }
                    };
                },
                fetch: function (params) {
                    return http.wait().then(function () {
                        return http.PUT({
                            module: 'mail',
                            params: _(params).omit('data'),
                            data: params.data
                        });
                    });
                },
                each: function (obj) {
                    mailAPI.pool.add('detail', obj);
                },
                PRIMARY_PAGE_SIZE: 100,
                SECONDARY_PAGE_SIZE: 100
            });

            this.append(
                new SearchView({ point: 'io.ox/mail/search/dropdown' })
                .build(function () {
                    var view = this;
                    baton.app.on('folder:change', function () {
                        view.cancel();
                    });
                    baton.app.folderView.tree.$el.on('click', function () {
                        view.cancel();
                    });
                })
                .on('search', function (criteria) {
                    listView.connect(collectionLoader);
                    listView.model.set({ criteria: criteria, thread: false, sort: 610, order: 'desc' });
                    listView.$el.parent().find('.grid-options [data-name="thread"]').addClass('disabled');
                })
                .on('cancel', function () {
                    var gridOptions = listView.$el.parent().find('.grid-options [data-name="thread"]');
                    if (!gridOptions.hasClass('disabled')) return;
                    listView.connect(mailAPI.collectionLoader);
                    listView.model.unset('criteria');
                    gridOptions.removeClass('disabled');
                })
                .render().$el
            );
        }
    });

    ext.point('io.ox/mail/search/dropdown').extend({
        id: 'default',
        index: 100,
        render: function () {
            this.model.set('folder', 'current');
            this.$dropdown.append(
                this.select('folder', gt('Search in'), [{ value: 'current', label: gt('Current folder') }, { value: 'all', label: gt('All folders') }]),
                this.input('subject', gt('Subject')),
                this.input('from', gt('From')),
                this.input('to', gt('To')),
                //#. Context: mail search. Label for <input>.
                this.input('words', gt('Contains words')),
                this.dateRange(),
                //#. Context: mail search. Label for checbbox.
                this.checkbox('attachment', gt('Has attachments')),
                this.button()
            );
        }
    });

    ext.point('io.ox/mail/view-options').extend({
        id: 'sort',
        index: 100,
        draw: function (baton) {
            this.data('view').listenTo(baton.app, 'folder:change', function () {
                var link = this.$('a[data-value="from-to"]'),
                    textNode = link.contents().last();
                textNode.replaceWith(account.is('sent|drafts', baton.app.folder.get()) ? gt('To') : gt('From'));
            });
            this.data('view')
                .option('sort', 610, gt('Date'), { radio: true })
                .option('sort', 'from-to', account.is('sent|drafts', baton.app.folder.get()) ? gt('To') : gt('From'), { radio: true })
                .option('sort', 651, gt('Unread'), { radio: true })
                .option('sort', 608, gt('Size'), { radio: true })
                .option('sort', 607, gt('Subject'), { radio: true });
            // color flags
            if (settings.get('features/flag/color')) this.data('view').option('sort', 102, gt('Color'), { radio: true });
            // sort by /flagged messages, internal namin is "star"
            //#. Sort by messages which are flagged, "Flag" is used in dropdown
            if (settings.get('features/flag/star')) this.data('view').option('sort', 660, gt('Flag'), { radio: true });
        }
    });

    ext.point('io.ox/mail/view-options').extend({
        id: 'order',
        index: 200,
        draw: function () {
            this.data('view')
                .divider()
                .option('order', 'asc', gt('Ascending'), { radio: true })
                .option('order', 'desc', gt('Descending'), { radio: true });
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

    ext.point('io.ox/mail/list-view/toolbar/bottom').extend({
        id: 'dropdown',
        index: 300,
        draw: function (baton) {

            var app = baton.app, model = app.props;

            var dropdown = new Dropdown({
                caret: true,
                //#. Sort options drop-down
                label: gt.pgettext('dropdown', 'Sort'),
                model: model
            });

            function toggle() {
                var folder = app.folder.get();
                dropdown.$el.toggle(folder !== 'virtual/all-unseen');
            }

            app.on('folder:change', toggle);

            ext.point('io.ox/mail/view-options').invoke('draw', dropdown.$el, baton);
            this.append(dropdown.render().$el.addClass('grid-options toolbar-item pull-right').on('dblclick', function (e) {
                e.stopPropagation();
            }));

            toggle();
        }
    });

    ext.point('io.ox/mail/all-options').extend({
        id: 'default',
        index: 100,
        draw: function (baton) {

            var app = baton.app,
                extensions = contextmenu.extensions,
                node = this.$ul;

            this.header(gt('All messages in this folder'));

            app.folder.getData().done(function (data) {
                var baton = new ext.Baton({ data: data, module: 'mail' });
                ['markFolderSeen', 'moveAllMessages', 'archive', 'divider', 'empty'].forEach(function (id) {
                    extensions[id].call(node, baton);
                });
            });
        }
    });

    ext.point('io.ox/mail/list-view/toolbar/bottom').extend({
        id: 'all',
        index: 200,
        draw: function (baton) {

            var app = baton.app, model = app.props;

            var dropdown = new Dropdown({
                caret: true,
                //#. 'All' options drop-down (lead to 'Delete ALL messages', 'Mark ALL messages as read', etc.)
                label: gt.pgettext('dropdown', 'All'),
                model: model
            });

            ext.point('io.ox/mail/all-options').invoke('draw', dropdown, baton);

            this.append(dropdown.render().$el.addClass('grid-options toolbar-item pull-right margin-auto').on('dblclick', function (e) {
                e.stopPropagation();
            }));

            function toggle() {
                var folder = app.folder.get();
                dropdown.$el.toggle(folder !== 'virtual/all-unseen');
                dropdown.$ul.empty();
                ext.point('io.ox/mail/all-options').invoke('draw', dropdown, baton);

            }

            app.on('folder:change', toggle);
            toggle();
        }
    });

    function toggleFolderView(e) {
        e.preventDefault();
        var state = !!e.data.state;
        e.data.app.folderView.forceOpen = state;
        e.data.app.props.set('folderview', state);
        // keep focus
        var selector = '[data-action="' + (state ? 'close' : 'open') + '-folder-view"]';
        e.data.app.getWindow().nodes.outer.find(selector).focus();
    }

    function onFolderViewOpen(app) {
        app.getWindow().nodes.sidepanel.show();
        app.getWindow().nodes.main.find('.toolbar-item[data-action="open-folder-view"]').hide();
    }

    function onFolderViewClose(app) {
        // hide sidepanel so invisible objects are not tabbable
        app.getWindow().nodes.sidepanel.hide();
        app.getWindow().nodes.main.find('.toolbar-item[data-action="open-folder-view"]').show();
    }

    ext.point('io.ox/mail/list-view/toolbar/bottom').extend({
        id: 'toggle-folderview',
        index: 100,
        draw: function (baton) {

            this.append(
                $('<a href="#" role="button" class="toolbar-item pull-left" data-action="open-folder-view">').attr('aria-label', gt('Open folder view')).append(
                    $('<i class="fa fa-angle-double-right" aria-hidden="true">').attr('title', gt('Open folder view'))
                ).on('click', { app: baton.app, state: true }, toggleFolderView)
            );

            baton.app.on({
                'folderview:open': onFolderViewOpen.bind(null, baton.app),
                'folderview:close': onFolderViewClose.bind(null, baton.app)
            });

            if (baton.app.folderViewIsVisible()) _.defer(onFolderViewOpen, baton.app);
        }
    });

    ext.point('io.ox/mail/sidepanel').extend({
        id: 'toggle-folderview',
        index: 1000,
        draw: function (baton) {
            this.addClass('bottom-toolbar').append(
                $('<div class="generic-toolbar bottom visual-focus">').append(
                    $('<a href="#" role="button" class="toolbar-item" data-action="close-folder-view">').attr('aria-label', gt('Close folder view')).append(
                        $('<i class="fa fa-angle-double-left" aria-hidden="true">').attr('title', gt('Close folder view'))
                    ).on('click', { app: baton.app, state: false }, toggleFolderView)
                )
            );
        }
    });

    ext.point('io.ox/mail/sidepanel').extend({
        id: 'premium-area',
        index: 10000,
        draw: function (baton) {
            this.append(
                commons.addPremiumFeatures(baton.app, {
                    append: false,
                    upsellId: 'folderview/mail/bottom',
                    upsellRequires: 'active_sync'
                })
            );
        }
    });
});
