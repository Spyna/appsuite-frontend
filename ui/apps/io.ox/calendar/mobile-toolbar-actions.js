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
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

define('io.ox/calendar/mobile-toolbar-actions', [
    'io.ox/core/extensions',
    'io.ox/core/extPatterns/links',
    'io.ox/calendar/api',
    'io.ox/calendar/util',
    'gettext!io.ox/calendar'
], function (ext, links, api, util, gt) {

    'use strict';

    // define links for each page

    var pMonth = ext.point('io.ox/calendar/mobile/toolbar/month'),
        // actually a single day as we use week:day
        pWeek = ext.point('io.ox/calendar/mobile/toolbar/week'),
        pList = ext.point('io.ox/calendar/mobile/toolbar/list'),
        pListMulti = ext.point('io.ox/calendar/mobile/toolbar/list/multiselect'),
        multiInlineActions = ext.point('io.ox/calendar/mobile/toolbar/list/multiselectactions'),
        pDetail = ext.point('io.ox/calendar/mobile/toolbar/detailView'),
        meta = {
            'create': {
                prio: 'hi',
                mobile: 'hi',
                label: gt('Create'),
                icon: 'fa fa-plus',
                drawDisabled: true,
                ref: 'io.ox/calendar/detail/actions/create',
                cssClasses: 'io-ox-action-link mobile-toolbar-action'
            },
            'listView': {
                prio: 'hi',
                mobile: 'hi',
                label: gt('Listview'),
                icon: 'fa fa-list',
                drawDisabled: true,
                ref: 'io.ox/calendar/actions/switch-to-list-view',
                cssClasses: 'io-ox-action-link mobile-toolbar-action'
            },
            'calendarView': {
                prio: 'hi',
                mobile: 'hi',
                label: gt('Calendar view'),
                icon: 'fa fa-table',
                drawDisabled: true,
                ref: 'io.ox/calendar/actions/switch-to-month-view',
                cssClasses: 'io-ox-action-link mobile-toolbar-action'
            },
            'next': {
                prio: 'hi',
                mobile: 'hi',
                label: gt('Show next month'),
                icon: 'fa fa-chevron-right',
                drawDisabled: true,
                ref: 'io.ox/calendar/actions/showNext',
                cssClasses: 'io-ox-action-link mobile-toolbar-action'

            },
            'prev': {
                prio: 'hi',
                mobile: 'hi',
                label: gt('Show previous month'),
                icon: 'fa fa-chevron-left',
                drawDisabled: true,
                ref: 'io.ox/calendar/actions/showPrevious',
                cssClasses: 'io-ox-action-link mobile-toolbar-action'
            },
            'today': {
                prio: 'hi',
                mobile: 'hi',
                label: gt('Today'),
                drawDisabled: true,
                ref: 'io.ox/calendar/actions/showToday',
                cssClasses: 'io-ox-action-link mobile-toolbar-action text-button'
            },
            'move': {
                prio: 'hi',
                mobile: 'hi',
                label: gt('Move'),
                icon: 'fa fa-sign-in',
                drawDisabled: true,
                ref: 'io.ox/calendar/detail/actions/move',
                cssClasses: 'io-ox-action-link mobile-toolbar-action'
            },
            'delete': {
                prio: 'hi',
                mobile: 'hi',
                label: gt('Delete'),
                icon: 'fa fa-trash-o',
                drawDisabled: true,
                ref: 'io.ox/calendar/detail/actions/delete',
                cssClasses: 'io-ox-action-link mobile-toolbar-action'
            },
            'export': {
                prio: 'hi',
                mobile: 'hi',
                label: gt('Export'),
                //icon: 'fa fa-trash-o',
                drawDisabled: true,
                ref: 'io.ox/calendar/detail/actions/export',
                cssClasses: 'io-ox-action-link mobile-toolbar-action'
            }
        };

    // helper for extending
    function addAction(point, ids) {
        var index = 0;
        _(ids).each(function (id) {
            var extension = meta[id];
            extension.id = id;
            extension.index = (index += 100);
            point.extend(new links.Link(extension));
        });
        index = 0;
    }
    // add default actions to toolbar which might be extended by 3rd party apps
    pDetail.extend(new links.Dropdown({
        index: 100,
        label: $('<span>').text(
            //.# Will be used as button label in the toolbar, allowing the user to peform actions for the current appointment
            gt('Actions')
        ),
        // don't draw the caret icon beside menu link
        noCaret: true,
        drawDisabled: true,
        ref: 'io.ox/calendar/links/inline'
    }));

    // add other actions
    addAction(pMonth, ['create', 'listView', 'prev', 'today', 'next']);
    addAction(pWeek, ['create', 'listView', 'prev', 'today', 'next']);
    addAction(pList, ['calendarView']);
    addAction(multiInlineActions, ['move', 'delete']);

    // have to use inline actions to process actions the right way
    pListMulti.extend(new links.InlineLinks({
        attributes: {},
        classes: '',
        index: 100,
        id: 'toolbar-links',
        ref: 'io.ox/calendar/mobile/toolbar/list/multiselectactions'
    }));

    var updateToolbar = _.debounce(function (list) {
        if (!list) return;
        // extract single object if length === 1
        list = list.length === 1 ? list[0] : list;
        // draw toolbar
        var baton = ext.Baton({ data: list, app: this });
        this.pages.getToolbar('month').setBaton(baton);
        this.pages.getToolbar('week:day').setBaton(baton);
        this.pages.getToolbar('list').setBaton(baton);
        this.pages.getSecondaryToolbar('list').setBaton(baton);

    }, 10);

    function prepareUpdateToolbar(app) {
        var list = app.pages.getCurrentPage().name === 'list' ? app.listView.selection.get() : {};
        list = _(list).map(function (item) {
            if (_.isString(item)) item = _.extend(util.cid(item), { flags: app.listView.selection.getNode(item).attr('data-flags') || '' });
            return item;
        });
        app.updateToolbar(list);
    }

    // some mediator extensions
    // register update function and introduce toolbar updating
    ext.point('io.ox/calendar/mediator').extend({
        id: 'toolbar-mobile',
        index: 10100,
        setup: function (app) {
            if (_.device('!smartphone')) return;
            app.updateToolbar = updateToolbar;
        }
    });

    ext.point('io.ox/calendar/mediator').extend({
        id: 'update-toolbar-mobile',
        index: 10300,
        setup: function (app) {
            if (_.device('!smartphone')) return;
            app.updateToolbar();
            // update toolbar on selection change
            app.listView.on('selection:change', function () {
                prepareUpdateToolbar(app);
            });
            // folder change
            app.on('folder:change', function () {
                prepareUpdateToolbar(app);
            });
            app.getWindow().on('change:perspective change:initialPerspective', function () {
                _.defer(prepareUpdateToolbar, app);
            });
        }
    });

    ext.point('io.ox/calendar/mediator').extend({
        id: 'change-mode-toolbar-mobile',
        index: 10400,
        setup: function (app) {
            if (!_.device('smartphone')) return;
            // if multiselect is triggered, show secondary toolbar with other options based on selection
            app.props.on('change:checkboxes', function (model, state) {
                app.pages.toggleSecondaryToolbar('list', state);
            });
        }
    });

});
