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
   ['settings!io.ox/mail',
    'io.ox/core/api/user',
    'io.ox/core/capabilities',
    'io.ox/contacts/api',
    'io.ox/mail/util',
    'io.ox/mail/settings/model',
    'dot!io.ox/mail/settings/form.html',
    'io.ox/core/extensions',
    'io.ox/core/notifications',
    'gettext!io.ox/mail',
    'io.ox/core/api/account'], function (settings, userAPI, capabilities, contactsAPI, mailUtil, mailSettingsModel, tmpl, ext, notifications, gt, api) {

    'use strict';

    var mailSettings =  settings.createModel(mailSettingsModel),

        staticStrings =  {
            TITLE_MAIL: gt.pgettext('app', 'Mail'),
            TITLE_COMMON: gt('Common'),
            PERMANENT_REMOVE_MAILS: gt('Permanently remove deleted E-Mails'),
            COLLECT_CONTACTS_SENDING: gt('Automatically collect contacts in the folder "Collected addresses" while sending'),
            COLLECT_CONTACTS_READING: gt('Automatically collect contacts in the folder "Collected addresses" while reading'),
            USE_FIXED_WIDTH_FONT: gt('Use fixed-width font for text mails'),
            TITLE_COMPOSE: gt('Compose'),
            APPEND_VCARD: gt('Append vcard'),
            INSERT_ORG_TO_REPLY: gt('Insert the original E-Mail text to a reply'),
            FORWARD_EMAIL_AS: gt('Forward E-Mails as:'),
            INLINE: gt('Inline'),
            ATTACHEMENT: gt('Attachment'),
            FORMAT_AS: gt('Format E-Mails as:'),
            HTML: gt('HTML'),
            PLAIN: gt('Plain text'),
            HTML_AND_PLAIN: gt('HTML and plain text'),
            LINEWRAP: gt('Line wrap when sending text mails after: '),
            CHARACTERS: gt(' characters'),
            DEFAULT_SENDER: gt('Default sender address:'),
            AUTO_SAVE: gt('Auto-save Email drafts'),
            TITLE_DISPLAY: gt('Display'),
            ALLOW_HTML: gt('Allow html formatted E-Mails'),
            ALLOW_PRE: gt('Allow pre-loading of externally linked images'),
            DISPLAY_EMOTICONS: gt('Display emoticons as graphics in text E-Mails'),
            COLOR_QUOTED: gt('Color quoted lines'),

            TITLE_THREADVIEW: gt('Thread view'),
            THREADVIEW_INBOX: gt('Enabled for inbox only'),
            THREADVIEW_ON: gt('Enabled for all mail folders'),
            THREADVIEW_OFF: gt('Disabled')
        },

        optionsAutoSave = [{label: gt('disabled'), value: 'disabled'},
                           {label: gt('1 minute'), value: '1_minute'},
                           {label: gt('3 minutes'), value: '3_minutes'},
                           {label: gt('5 minutes'), value: '5_minutes'},
                           {label: gt('10 minutes'), value: '10_minutes'}],
        mailViewSettings;

    var MailSettingsView = Backbone.View.extend({
        tagName: "div",
        _modelBinder: undefined,
        initialize: function (options) {
            // create template
            this._modelBinder = new Backbone.ModelBinder();
        },
        render: function () {
            var self = this, accounts, msisdns;
            /* TODO: only the default account (id: 0) can have multiple aliases for now
             * all other accounts can only have one address (the primary address)
             * So the option is only for the default account, for now. This should
             * be changed in the future. If more (e.g. external) addresses are shown
             * here, server _will_ respond with an error, when these are selected.
             *
             * THIS COMMENT IS IMPORTANT, DON’T REMOVE
             */
            accounts = api.getSenderAddresses(0).then(function (addresses) {
                return _.map(addresses, function (address) {
                    //use value also as label
                    return {value: address[1], label: address[1]};
                });
            });

            //get msisdn numbers
            msisdns = !capabilities.has('msisdn') ? [] : userAPI.get({id: ox.user_id}).then(function (data) {
                return _(contactsAPI.getMapping('msisdn', 'names'))
                        .chain()
                        .map(function (field) {
                            if (data[field]) {
                                return {
                                    label: data[field],
                                    value: mailUtil.cleanupPhone(data[field]) + mailUtil.getChannelSuffixes().msisdn
                                };
                            }
                        })
                        .compact()
                        .value();
            });

            new $.when(accounts, msisdns).then(function (addresses, numbers) {
                self.$el.empty().append(
                    tmpl.render('io.ox/mail/settings', {
                        strings: staticStrings,
                        optionsAutoSaveMinutes: optionsAutoSave,
                        optionsAllAccounts: [].concat(addresses, numbers)
                    })
                );
                var defaultBindings = Backbone.ModelBinder.createDefaultBindings(self.el, 'data-property');
                self._modelBinder.bind(self.model, self.el, defaultBindings);
            });
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
            if (Modernizr.touch) { // See Bug 24802
                holder.find('input[name="messageFormat"]:first').closest('.control-group').hide().prev().hide();
            }
        },

        save: function () {
            mailViewSettings.model.save().done(function () {
                //update mailapi
                require(['io.ox/mail/api'], function (mailApi) {
                    mailApi.updateViewSettings();
                });
            }).fail(function () {
                notifications.yell('error', gt('Could not save settings'));
            });
        }
    });

});
