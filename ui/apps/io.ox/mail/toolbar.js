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

define('io.ox/mail/toolbar', [
    'io.ox/core/extensions',
    'io.ox/core/extPatterns/links',
    'io.ox/core/extPatterns/actions',
    'io.ox/core/tk/flag-picker',
    'io.ox/mail/api',
    'io.ox/core/capabilities',
    'io.ox/backbone/mini-views/dropdown',
    'io.ox/backbone/mini-views/toolbar',
    'settings!io.ox/core',
    'settings!io.ox/mail',
    'gettext!io.ox/mail',
    'io.ox/mail/actions',
    'less!io.ox/mail/style',
    'io.ox/mail/folderview-extensions'
], function (ext, links, actions, flagPicker, api, capabilities, Dropdown, Toolbar, settings, mailsettings, gt) {

    'use strict';

    // define links for classic toolbar
    var point = ext.point('io.ox/mail/classic-toolbar/links');

    var meta = {
        //
        // --- HI ----
        //
        'compose': {
            prio: 'hi',
            mobile: 'hi',
            label: gt('Compose'),
            title: gt('Compose new email'),
            drawDisabled: true,
            ref: 'io.ox/mail/actions/compose'
        },
        'edit': {
            prio: 'hi',
            mobile: 'lo',
            label: gt('Edit draft'),
            ref: 'io.ox/mail/actions/edit'
        },
        'reply': {
            prio: 'hi',
            mobile: 'lo',
            icon: 'fa fa-reply',
            label: gt('Reply to sender'),
            drawDisabled: true,
            ref: 'io.ox/mail/actions/reply'
        },
        'reply-all': {
            prio: 'hi',
            mobile: 'lo',
            icon: 'fa fa-reply-all',
            label: gt('Reply to all recipients'),
            drawDisabled: true,
            ref: 'io.ox/mail/actions/reply-all'
        },
        'forward': {
            prio: 'hi',
            mobile: 'lo',
            icon: 'fa fa-mail-forward',
            label: gt('Forward'),
            drawDisabled: true,
            ref: 'io.ox/mail/actions/forward'
        },
        'delete': {
            prio: 'hi',
            mobile: 'lo',
            icon: 'fa fa-trash-o',
            label: gt('Delete'),
            drawDisabled: true,
            ref: 'io.ox/mail/actions/delete'
        },
        'spam': {
            prio: 'hi',
            mobile: 'lo',
            icon: 'fa fa-ban',
            label: gt('Mark as spam'),
            ref: 'io.ox/mail/actions/spam'
        },
        'nospam': {
            prio: 'hi',
            mobile: 'lo',
            icon: 'fa fa-thumbs-up',
            label: gt('Not spam'),
            ref: 'io.ox/mail/actions/nospam'
        },
        'category': {
            prio: 'hi',
            mobile: 'none',
            icon: 'fa fa-folder-open-o',
            label: gt('Set category'),
            ref: 'io.ox/mail/actions/category',
            customize: function (baton) {
                require(['io.ox/mail/categories/picker'], function (picker) {
                    picker(this, { props: baton.app.props, data: baton.data });
                }.bind(this));
            }
        },
        'color': {
            prio: 'hi',
            mobile: 'none',
            icon: 'fa fa-bookmark-o',
            label: gt('Set color'),
            ref: 'io.ox/mail/actions/color',
            customize: function (baton) {
                flagPicker.attach(this, { data: baton.data });
            }
        },
        'archive': {
            prio: 'hi',
            mobile: 'lo',
            icon: 'fa fa-archive',
            //#. Verb: (to) archive messages
            label: gt.pgettext('verb', 'Archive'),
            ref: 'io.ox/mail/actions/archive'
        },
        //
        // --- LO ----
        //
        'mark-read': {
            prio: 'lo',
            mobile: 'lo',
            label: gt('Mark as read'),
            ref: 'io.ox/mail/actions/mark-read',
            section: 'flags'
        },
        'mark-unread': {
            prio: 'lo',
            mobile: 'lo',
            label: gt('Mark as unread'),
            ref: 'io.ox/mail/actions/mark-unread',
            section: 'flags'
        },
        'move': {
            prio: 'lo',
            mobile: 'lo',
            label: gt('Move'),
            ref: 'io.ox/mail/actions/move',
            section: 'file-op'
        },
        'copy': {
            prio: 'lo',
            mobile: 'lo',
            label: gt('Copy'),
            ref: 'io.ox/mail/actions/copy',
            section: 'file-op'
        },
        'print': {
            prio: 'lo',
            mobile: 'lo',
            label: gt('Print'),
            ref: 'io.ox/mail/actions/print',
            section: 'export'
        },
        'save-as-eml': {
            prio: 'lo',
            mobile: 'lo',
            label: gt('Save as file'),
            ref: 'io.ox/mail/actions/save',
            section: 'export'
        },
        'source': {
            prio: 'lo',
            mobile: 'none',
            //#. source in terms of source code
            label: gt('View source'),
            ref: 'io.ox/mail/actions/source',
            section: 'export'
        },
        'reminder': {
            prio: 'lo',
            mobile: 'none',
            label: gt('Reminder'),
            ref: 'io.ox/mail/actions/reminder',
            section: 'keep'
        },
        'add-to-portal': {
            prio: 'lo',
            mobile: 'none',
            label: gt('Add to portal'),
            ref: 'io.ox/mail/actions/add-to-portal',
            section: 'keep'
        }
    };

    // local dummy action

    new actions.Action('io.ox/mail/actions/category', {
        capabilities: 'mail_categories',
        requires: function (e) {
            return e.collection.has('some') && e.baton.app.props.get('categories');
        },
        action: $.noop
    });

    new actions.Action('io.ox/mail/actions/color', {
        requires: 'some',
        action: $.noop
    });

    // transform into extensions

    var index = 0;

    _(meta).each(function (extension, id) {
        extension.id = id;
        extension.index = (index += 100);
        point.extend(new links.Link(extension));
    });

    ext.point('io.ox/mail/classic-toolbar').extend(new links.InlineLinks({
        attributes: {},
        classes: '',
        // always use drop-down
        dropdown: true,
        index: 200,
        id: 'toolbar-links',
        ref: 'io.ox/mail/classic-toolbar/links'
    }));

    // local mediator
    function updateContactPicture() {
        // disposed?
        if (!this.model) return;
        // only show this option if preview pane is right (vertical/compact)
        var li = this.$el.find('[data-name="contactPictures"]').parent(),
            layout = this.model.get('layout');
        if (layout === 'vertical' || layout === 'compact') li.show(); else li.hide();
    }

    function statistics(app, e) {
        e.preventDefault();
        require(['io.ox/mail/statistics']).done(function (statistics) {
            statistics.open(app);
        });
    }

    function allAttachments(app, e) {
        e.preventDefault();
        var attachmentView = settings.get('folder/mailattachments', {});
        ox.launch('io.ox/files/main', { folder: attachmentView.all }).done(function () {
            this.folder.set(attachmentView.all);
        });
    }

    function onConfigureCategories(props) {
        require(['io.ox/mail/categories/edit'], function (dialog) {
            dialog.open(props);
        });
    }

    // view dropdown
    ext.point('io.ox/mail/classic-toolbar').extend({
        id: 'view-dropdown',
        index: 10000,
        draw: function (baton) {

            if (_.device('smartphone')) return;

            //#. View is used as a noun in the toolbar. Clicking the button opens a popup with options related to the View
            var dropdown = new Dropdown({ caret: true, model: baton.app.props, label: gt('View'), tagName: 'li' })
            .header(gt('Layout'))
            .option('layout', 'vertical', gt('Vertical'), { radio: true });
            // offer compact view only on desktop
            if (_.device('desktop')) dropdown.option('layout', 'compact', gt('Compact'), { radio: true });
            dropdown.option('layout', 'horizontal', gt('Horizontal'), { radio: true })
            .option('layout', 'list', gt('List'), { radio: true })
            .divider();

            // feature: tabbed inbox
            if (capabilities.has('mail_categories') && !_.device('smartphone')) {
                dropdown
                .header(gt('Inbox'))
                .option('categories', true, gt('Use categories'))
                 //#. term is followed by a space and three dots (' …')
                 //#. the dots refer to the term 'Categories' right above this dropdown entry
                 //#. so user reads it as 'Configure Categories'
                .link('categories-config', gt('Configure') + ' …', _.bind(onConfigureCategories, this, baton.app.props), { icon: true })
                .divider();
            }

            dropdown
            .header(gt('Options'))
            .option('folderview', true, gt('Folder view'))
            .option('checkboxes', true, gt('Checkboxes'))
            .option('contactPictures', true, gt('Contact pictures'))
            .option('exactDates', true, gt('Exact dates'))
            .option('alwaysShowSize', true, gt('Message size'))
            .divider()
            .link('statistics', gt('Statistics'), statistics.bind(null, baton.app))
            .listenTo(baton.app.props, 'change:layout', updateContactPicture);

            if (settings.get('folder/mailattachments', {}).all) {
                dropdown.link('attachments', gt('All attachments'), allAttachments.bind(null, baton.app));
            }

            this.append(
                dropdown.render().$el.addClass('pull-right').attr('data-dropdown', 'view')
            );

            updateContactPicture.call(dropdown);
        }
    });

    // classic toolbar
    ext.point('io.ox/mail/mediator').extend({
        id: 'toolbar',
        index: 10000,
        setup: function (app) {

            if (_.device('smartphone')) return;

            var toolbarView = new Toolbar({ title: app.getTitle() });

            app.getWindow().nodes.body.addClass('classic-toolbar-visible').prepend(
                toolbarView.render().$el
            );

            function updateCallback($toolbar) {
                toolbarView.replaceToolbar($toolbar).initButtons();
            }

            app.updateToolbar = _.debounce(function (selection) {
                if (!selection) return;
                var isThread = this.isThreaded();
                // resolve thread
                var list = api.resolve(selection, isThread);
                // extract single object if length === 1
                list = list.length === 1 ? list[0] : list;
                // disable visible buttons
                toolbarView.disableButtons();
                // draw toolbar
                var $toolbar = toolbarView.createToolbar(),
                    baton = ext.Baton({ $el: $toolbar, data: list, isThread: isThread, selection: selection, app: this }),
                    ret = ext.point('io.ox/mail/classic-toolbar').invoke('draw', $toolbar, baton);
                $.when.apply($, ret.value()).done(_.lfo(updateCallback, $toolbar));
            }, 10);
        }
    });

    ext.point('io.ox/mail/mediator').extend({
        id: 'update-toolbar',
        index: 10200,
        setup: function (app) {
            if (_.device('smartphone')) return;
            app.updateToolbar();
            // update toolbar on selection change as well as any model change (seen/unseen flag)
            app.listView.on('selection:change change', function () {
                app.updateToolbar(app.listView.selection.get());
            });
        }
    });
});
