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
 * @author Julian Bäume <julian.baeume@open-xchange.com>
 */

define('io.ox/contacts/settings/pane',
       ['settings!io.ox/contacts', 'io.ox/contacts/settings/model',
        'dot!io.ox/contacts/settings/form.html', 'io.ox/core/extensions',
        'gettext!io.ox/contacts/contacts'], function (settings, contactsSettingsModel, tmpl, ext, gt) {

    'use strict';

    var contactsSettings =  settings.createModel(contactsSettingsModel),
        staticStrings =  {
            TITLE_CONTACTS: gt('Address Book'),
            SHOW_ADMIN_CONTACTS: gt('Show contacts from administrator group')
        },
        contactsSettingsView;

    var ContactsSettingsView = Backbone.View.extend({
        tagName: "div",
        _modelBinder: undefined,
        initialize: function (options) {
            // create template
            this._modelBinder = new Backbone.ModelBinder();
        },
        render: function () {
            var self = this;
            self.$el.empty().append(tmpl.render('io.ox/contacts/settings', {
                strings: staticStrings
            }));

            var defaultBindings = Backbone.ModelBinder.createDefaultBindings(self.el, 'data-property');
            self._modelBinder.bind(self.model, self.el, defaultBindings);

            return self;
        }
    });

    ext.point('io.ox/contacts/settings/detail').extend({
        index: 200,
        id: 'contactssettings',
        draw: function (data) {

            contactsSettingsView = new ContactsSettingsView({model: contactsSettings});
            var holder = $('<div>').css('max-width', '800px');
            this.append(holder.append(
                contactsSettingsView.render().el)
            );
        },

        save: function () {
            contactsSettingsView.model.save();
        }
    });

});
