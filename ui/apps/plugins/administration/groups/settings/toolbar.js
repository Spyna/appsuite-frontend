/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2015 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('plugins/administration/groups/settings/toolbar', [
    'io.ox/core/extensions',
    'io.ox/core/extPatterns/links',
    'io.ox/backbone/mini-views/toolbar',
    'plugins/administration/groups/settings/edit',
    'io.ox/core/api/group',
    'io.ox/core/tk/dialogs',
    'gettext!io.ox/core'
], function (ext, links, Toolbar, edit, groupAPI, dialogs, gt) {

    'use strict';

    //
    // Actions
    //

    var Action = links.Action;

    new Action('administration/groups/create', {
        requires: function () {
            return true;
        },
        action: function () {
            edit.open();
        }
    });

    new Action('administration/groups/edit', {
        requires: function (e) {
            if (!e.collection.has('one')) return false;
            // not allowed for "All users" (id=0); "Standard group" (id=1) can be edited
            return _(e.context).pluck('id').indexOf(0) === -1;
        },
        action: function (baton) {
            var data = baton.data[0];
            edit.open({ id: data.id });
        }
    });

    new Action('administration/groups/delete', {
        requires: function (e) {
            if (!e.collection.has('one')) return false;
            // not allowed for "All users" (id=0) and "Standard group" (id=0)
            return _(e.context).pluck('id').indexOf(0) === -1 && _(e.context).pluck('id').indexOf(1) === -1;
        },
        action: function (baton) {
            var id = baton.data[0].id, model = groupAPI.getModel(id);
            new dialogs.ModalDialog()
            .text(
                //#. %1$s is the group name
                gt('Do you really want to delete the group "%1$s"? This action cannot be undone!', model.get('display_name'))
            )
            .addPrimaryButton('delete', gt('Delete group'), 'delete', {'tabIndex': '1'})
            .addButton('cancel', gt('Cancel'), 'cancel', {'tabIndex': '1'})
            .on('delete', function () {
                groupAPI.remove(id);
            })
            .show();
        }
    });

    //
    // Toolbar links
    //

    ext.point('administration/groups/toolbar/links').extend(
        new links.Link({
            index: 100,
            prio: 'hi',
            id: 'create',
            label: gt('Create new group'),
            drawDisabled: true,
            ref: 'administration/groups/create'
        }),
        new links.Link({
            index: 200,
            prio: 'hi',
            id: 'edit',
            label: gt('Edit'),
            drawDisabled: true,
            ref: 'administration/groups/edit'
        }),
        new links.Link({
            index: 300,
            prio: 'hi',
            id: 'delete',
            label: gt('Delete'),
            drawDisabled: true,
            ref: 'administration/groups/delete'
        })
    );

    ext.point('administration/groups/toolbar').extend(new links.InlineLinks({
        attributes: {},
        classes: '',
        dropdown: true,
        index: 100,
        id: 'toolbar-links',
        ref: 'administration/groups/toolbar/links'
    }));

    return {
        create: function () {

            var toolbar = new Toolbar({ title: '', tabindex: 1 });

            toolbar.update = function (data) {
                // data is array of strings; convert to objects
                data = _(data).map(function (id) {
                    return { id: parseInt(id, 10) };
                });
                var baton = ext.Baton({ $el: toolbar.$list, data: data || [] }),
                    defs = ext.point('administration/groups/toolbar').invoke('draw', toolbar.$list.empty(), baton);
                $.when.apply($, defs.value()).then(function () {
                    if (toolbar.disposed) return;
                    toolbar.initButtons();
                });
                return this;
            };

            return toolbar;
        }
    };
});
