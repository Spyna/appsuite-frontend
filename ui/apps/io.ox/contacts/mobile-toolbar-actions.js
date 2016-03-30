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

define('io.ox/contacts/mobile-toolbar-actions', [
    'io.ox/core/extensions',
    'io.ox/core/extPatterns/links',
    'io.ox/contacts/api',
    'gettext!io.ox/mail'
], function (ext, links, api, gt) {

    'use strict';

    // define links for each page

    var pointListViewActions = ext.point('io.ox/contacts/mobile/toolbar/actions'),
        pointDetailView = ext.point('io.ox/contacts/mobile/toolbar/detailView'),
        pointDetailViewLinks = ext.point('io.ox/contacts/mobile/toolbar/detailView/links'),
        actions = ext.point('io.ox/contacts/mobile/actions'),
        pointListView = ext.point('io.ox/contacts/mobile/toolbar/listView'),
        meta = {
            'create': {
                prio: 'hi',
                mobile: 'hi',
                label: gt('New'),
                icon: 'fa fa-plus',
                drawDisabled: true,
                ref: 'io.ox/contacts/actions/create',
                cssClasses: 'io-ox-action-link mobile-toolbar-action'
            },
            'send': {
                prio: 'hi',
                mobile: 'hi',
                label: gt('Send mail'),
                icon: 'fa fa-envelope-o',
                ref: 'io.ox/contacts/actions/send',
                drawDisabled: true,
                cssClasses: 'io-ox-action-link mobile-toolbar-action'
            },
            'vcard': {
                prio: 'lo',
                mobile: 'lo',
                label: gt('Send as vCard'),
                ref: 'io.ox/contacts/actions/vcard',
                drawDisabled: true
            },
            'invite': {
                prio: 'hi',
                mobile: 'hi',
                label: gt('Invite to appointment'),
                icon: 'fa fa-calendar-o',
                ref: 'io.ox/contacts/actions/invite',
                drawDisabled: true,
                cssClasses: 'io-ox-action-link mobile-toolbar-action'
            },
            'edit': {
                prio: 'hi',
                mobile: 'hi',
                label: gt('Edit'),
                icon: 'fa fa-edit',
                ref: 'io.ox/contacts/actions/update',
                drawDisabled: true,
                cssClasses: 'io-ox-action-link mobile-toolbar-action'

            },
            'delete': {
                prio: 'hi',
                mobile: 'hi',
                label: gt('Delete'),
                drawDisabled: true,
                ref: 'io.ox/contacts/actions/delete'
            },
            'move': {
                mobile: 'lo',
                label: gt('Move'),
                drawDisabled: true,
                ref: 'io.ox/contacts/actions/move'
            },
            'copy': {
                mobile: 'lo',
                label: gt('Copy'),
                drawDisabled: true,
                ref: 'io.ox/contacts/actions/copy'
            }
        };

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

    addAction(pointListViewActions, ['create']);

    pointListView.extend(new links.InlineLinks({
        attributes: {},
        classes: '',
        index: 100,
        id: 'toolbar-links',
        ref: 'io.ox/contacts/mobile/toolbar/actions'
    }));

    addAction(actions, ['vcard', 'delete', 'move', 'copy']);

    pointDetailView.extend(new links.InlineLinks({
        id: 'links',
        index: 100,
        classes: '',
        ref: 'io.ox/contacts/mobile/toolbar/detailView/links'
    }));

    addAction(pointDetailViewLinks, ['edit', 'send', 'invite']);
    pointDetailViewLinks.extend(new links.Dropdown({
        id: 'test',
        index: 900,
        noCaret: true,
        icon: 'fa fa-bars',
        label: gt('Actions'),
        ariaLabel: gt('Actions'),
        ref: 'io.ox/contacts/mobile/actions',
        classes: 'io-ox-action-link mobile-toolbar-action'
    }));

    var updateToolbar = _.debounce(function (contact) {
        var self = this;
        //get full data, needed for require checks for example
        api.get(contact).done(function (data) {
            if (!data) return;
            var baton = ext.Baton({ data: data, app: self });
            // handle updated baton to pageController
            self.pages.getToolbar('detailView').setBaton(baton);
        });
    }, 50);

    // some mediator extensions
    // register update function and introduce toolbar updating
    ext.point('io.ox/contacts/mediator').extend({
        id: 'toolbar-mobile',
        index: 10100,
        setup: function (app) {
            if (_.device('!smartphone')) return;
            app.updateToolbar = updateToolbar;
        }
    });

    ext.point('io.ox/contacts/mediator').extend({
        id: 'update-toolbar-mobile',
        index: 10300,
        setup: function (app) {
            if (!_.device('smartphone')) return;

            // folder change
            app.grid.on('change:ids', function () {
                app.folder.getData().done(function (data) {
                    var baton = ext.Baton({ data: data, app: app });
                    // handle updated baton to pageController
                    app.pages.getToolbar('listView').setBaton(baton);
                });
            });

            //single select
            app.grid.selection.on('select pagechange:detailView', function () {
                //don't override secondary toolbar
                if (app.props.get('checkboxes') === true ) return;

                var data = app.grid.selection.get();
                app.updateToolbar(data[0]);
            });

            function updateSecondaryToolbar(list) {
                if (app.props.get('checkboxes') !== true ) return;
                if (list.length === 0) {
                    // reset to remove old baton
                    app.pages.getSecondaryToolbar('listView')
                        .setBaton(ext.Baton({ data: [], app: app }));
                    return;
                }
                api.getList(list).done(function (data) {
                    if (!data) return;
                    var baton = ext.Baton({ data: data, app: app });
                    // handle updated baton to pageController
                    app.pages.getSecondaryToolbar('listView').setBaton(baton);
                });
            }
            // multiselect
            app.grid.selection.on('change', function (e, list) { updateSecondaryToolbar(list); });
            app.props.on('change:checkboxes', function () { updateSecondaryToolbar(app.grid.selection.get()); });
        }
    });

    ext.point('io.ox/contacts/mediator').extend({
        id: 'change-mode-toolbar-mobile',
        index: 10400,
        setup: function (app) {
            if (!_.device('smartphone')) return;
            // if multiselect is triggered, show secondary toolbar with other options based on selection
            app.props.on('change:checkboxes', function (model, state) {
                app.pages.toggleSecondaryToolbar('listView', state);
            });
        }
    });

});
