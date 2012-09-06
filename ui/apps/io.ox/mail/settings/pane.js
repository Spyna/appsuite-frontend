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
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define('io.ox/mail/settings/pane',
       ['settings!io.ox/mail', 'io.ox/mail/settings/model',
        'dot!io.ox/mail/settings/form.html', 'io.ox/core/extensions',
        'gettext!io.ox/mail/mail', 'io.ox/core/api/account'], function (settings, mailSettingsModel, tmpl, ext, gt, api) {

    'use strict';



    var mailSettings =  settings.createModel(mailSettingsModel),
        staticStrings =  {
            TITLE_MAIL: gt('Mail'),
            TITLE_COMMON: gt('Common'),
            PERMANENT_REMOVE_MAILS: gt('Permanently remove deleted E-Mails?'),
            COLLECT_CONTACTS_SENDING: gt('Automatically collect contacts in the folder "Collected addresses" while sending?'),
            COLLECT_CONTACTS_READING: gt('Automatically collect contacts in the folder "Collected addresses" while reading?'),
            TITLE_COMPOSE: gt('Compose'),
            APPEND_VCARD: gt('Append vcard'),
            INSERT_ORG_TO_REPLY: gt('Insert the original E-Mail text to a reply'),
            FORWARD_EMAIL_AS: gt('Forward E-Mails as:'),
            INLINE: gt('Inline'),
            ATTACHEMENT: gt('Attachment'),
            FORMAT_AS: gt('Format E-Mails as:'),
            HTML: gt('HTML'),
            PLAIN: gt('Plain text'),
            HTML_AND_PLAIN: gt('HTML and Plain text'),
            LINEWRAP: gt('Line wrap when sending text mails after: '),
            CHARACTERS: gt(' characters'),
            DEFAULT_SENDER: gt('Default sender address:'),
            AUTO_SAVE: gt('Auto-save Email drafts?'),
            TITLE_DISPLAY: gt('Display'),
            ALLOW_HTML: gt('Allow html formatted E-Mails'),
            BLOCK_PRE: gt('Block pre-loading of externally linked images'),
            DISPLAY_EMOTICONS: gt('Display emoticons as graphics in text E-Mails'),
            COLOR_QUOTED: gt('Color quoted lines')
        },
        optionsAutoSave = [gt('disabled'), gt('1_minute'), gt('3_minutes'), gt('5_minutes'), gt('10_minutes')],
        mailViewSettings;


    api.all().done(function (array) {
        var itemList = [];
        _.each(array, function (key, value) {
            itemList.push(key.primary_address);
        });


        var MailSettingsView = Backbone.View.extend({
            tagName: "div",
            _modelBinder: undefined,
            initialize: function (options) {
                // create template
                this._modelBinder = new Backbone.ModelBinder();

            },
            render: function () {
                var self = this;
                self.$el.empty().append(tmpl.render('io.ox/mail/settings', {
                    strings: staticStrings,
                    optionsAutoSaveMinutes: optionsAutoSave,
                    optionsAllAccountes: itemList
                }));

                var defaultBindings = Backbone.ModelBinder.createDefaultBindings(self.el, 'data-property');
                self._modelBinder.bind(self.model, self.el, defaultBindings);

                return self;
            }
        });

        ext.point('io.ox/mail/settings/detail').extend({
            index: 200,
            id: 'mailsettings',
            draw: function (data) {

                mailViewSettings = new MailSettingsView({model: mailSettings});
                var holder = $('<div>').css('max-width', '800px');
                this.append(holder.append(
                    mailViewSettings.render().el)
                );
            },

            save: function () {
                mailViewSettings.model.save();
            }
        });


    });







});
