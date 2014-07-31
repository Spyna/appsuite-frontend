/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2012 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
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
     'io.ox/core/extensions',
     'io.ox/core/notifications',
     'gettext!io.ox/mail',
     'io.ox/core/api/account',
     'io.ox/backbone/mini-views',
     'io.ox/core/folder/api'
    ], function (settings, userAPI, capabilities, contactsAPI, mailUtil, mailSettingsModel, ext, notifications, gt, api, mini, folderAPI) {

    'use strict';

    var mailSettings =  settings.createModel(mailSettingsModel),

        mailViewSettings,
        POINT = 'io.ox/mail/settings/detail',
        optionsAllAccounts,
        caps,

        optionsForwardEmailAs = [
            { label: gt('Inline'), value: 'Inline' },
            { label: gt('Attachment'), value: 'Attachment' }
        ],

        optionsFormatAs = [
            { label: gt('HTML'), value: 'html' },
            { label: gt('Plain text'), value: 'text' },
            { label: gt('HTML and plain text'), value: 'alternative' }
        ],

        optionsAutoSave = [
            { label: gt('disabled'), value: 'disabled' },
            { label: gt('1 minute'), value: '1_minute' },
            { label: gt('3 minutes'), value: '3_minutes' },
            { label: gt('5 minutes'), value: '5_minutes' },
            { label: gt('10 minutes'), value: '10_minutes'}
        ];

    var MailSettingsView = Backbone.View.extend({
        tagName: 'div',

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
                optionsAllAccounts = [].concat(addresses, numbers);
                caps = {
                    contactCollect: capabilities.has('collect_email_addresses') ? 'true' : 'false'
                };

                ext.point(POINT + '/pane').invoke('draw', self.$el);

                // hide non-configurable sections
                self.$el.find('[data-property-section]').each(function () {
                    var section = $(this), property = section.attr('data-property-section');
                    if (!settings.isConfigurable(property)) {
                        section.remove();
                    }
                });

            });
            return self;
        }
    });

    ext.point(POINT).extend({
        index: 200,
        id: 'mailsettings',
        draw: function (baton) {
            baton.model = mailSettings;
            this.addClass('io-ox-mail-settings');
            mailViewSettings = new MailSettingsView({model: mailSettings});

            // var holder = $('<div>'),
            //     pane = $('<div class="io-ox-mail-settings">');

            // this.append(holder.append(pane.append(mailViewSettings.render().$el)));

            this.append(mailViewSettings.render().$el);

            if (Modernizr.touch) { // See Bug 24802
                this.find('input[name="messageFormat"]:first').closest('.control-group').hide().prev().hide();
            }

            if (!capabilities.has('emoji')) { // see Bug 25537
                this.find('[name="displayEmoticons"]').parent().parent().hide();
            }
        },

        save: function () {
            mailViewSettings.model.saveAndYell().done(function () {
                //update mailapi
                require(['io.ox/mail/api'], function (mailAPI) {
                    mailAPI.updateViewSettings();
                });
            }).fail(function () {
                notifications.yell('error', gt('Could not save settings'));
            });
        }
    });

    function changeIMAPSubscription() {
        ox.load(['io.ox/core/folder/imap-subscription']).done(function (subscription) {
            subscription.show();
        });
    }

    ext.point(POINT + '/pane').extend({
        index: 100,
        id: 'header',
        draw: function () {
            this.append(
                $('<h1>').text(gt.pgettext('app', 'Mail'))
            );
        }
    });

    ext.point(POINT + '/pane').extend({
        index: 200,
        id: 'common',
        draw: function () {
            var arrayOfElements =  [],
                contactCollectOnMailTransport = $('<div>').addClass('checkbox expertmode').append(
                    $('<label>').text(gt('Automatically collect contacts in the folder "Collected addresses" while sending')).prepend(
                        new mini.CheckboxView({ name: 'contactCollectOnMailTransport', model: mailSettings}).render().$el
                    )
                ),
                contactCollectOnMailAccess = $('<div>').addClass('checkbox expertmode').append(
                    $('<label>').text(gt('Automatically collect contacts in the folder "Collected addresses" while reading')).prepend(
                        new mini.CheckboxView({ name: 'contactCollectOnMailAccess', model: mailSettings}).render().$el
                    )
                );

            if (caps.contactCollect) {
                arrayOfElements.push(contactCollectOnMailTransport, contactCollectOnMailAccess);
            }

            this.append(
                $('<fieldset>').append(
                    $('<legend>').addClass('sectiontitle expertmode').text(gt('Common')),
                    $('<div>').addClass('form-group').append(
                        $('<div>').addClass('checkbox expertmode').append(
                            $('<label>').text(gt('Permanently remove deleted emails')).prepend(
                                new mini.CheckboxView({ name: 'removeDeletedPermanently', model: mailSettings}).render().$el
                            )
                        ),
                        arrayOfElements,
                        $('<div>').addClass('checkbox expertmode').append(
                            $('<label>').text(gt('Use fixed-width font for text mails')).prepend(
                                new mini.CheckboxView({ name: 'useFixedWidthFont', model: mailSettings}).render().$el
                            )
                        )
                    )
                )
            );
        }
    });

    ext.point(POINT + '/pane').extend({
        index: 300,
        id: 'compose',
        draw: function () {
            this.append(
                $('<fieldset>').append(
                    $('<legend>').addClass('sectiontitle').text(gt('Compose')),
                    $('<div>').addClass('controls').append(
                        $('<div>').addClass('checkbox').append(
                            $('<label>').text(gt('Append vCard')).prepend(
                                new mini.CheckboxView({ name: 'appendVcard', model: mailSettings}).render().$el
                            )
                        ),
                        $('<div>').addClass('checkbox').append(
                            $('<label>').text(gt('Insert the original email text to a reply')).prepend(
                                new mini.CheckboxView({ name: 'appendMailTextOnReply', model: mailSettings}).render().$el
                            )
                        )
                    )
                ),
                $('<fieldset>').append(
                    $('<legend>').addClass('sectiontitle').text(gt('Forward emails as')),
                    new mini.RadioView({ list: optionsForwardEmailAs, name: 'forwardMessageAs', model: mailSettings}).render().$el
                ),

                (function () {
                    if (_.device('smartphone || tablet')) return $();
                    return $('<fieldset>').append(
                        $('<legend>').addClass('sectiontitle').text(gt('Format emails as')),
                        new mini.RadioView({ list: optionsFormatAs, name: 'messageFormat', model: mailSettings}).render().$el
                    );
                })(),

                $('<div>').addClass('settings sectiondelimiter'),
                $('<fieldset>').append(
                    $('<div>').addClass('form-group expertmode').append(
                                                                                        //#. It's a label for an inputfield with a number
                        $('<label for="lineWrapAfter">').addClass('control-label').text((gt('Automatically wrap plain text after character:'))),
                        $('<div>').addClass('controls').append(
                            $('<div>').addClass('row').append(
                                $('<div>').addClass('col-md-2').append(
                                    new mini.InputView({ name: 'lineWrapAfter', model: mailSettings, className: 'form-control', id: 'lineWrapAfter' }).render().$el
                                )
                            )
                        )
                    ),
                    $('<div>').addClass('form-group').append(
                        $('<label>').attr({ 'for': 'defaultSendAddress' }).text(gt('Default sender address')),
                        $('<div>').addClass('controls').append(
                            $('<div>').addClass('row').append(
                                $('<div>').addClass('col-lg-4 col-xs-12').append(
                                    new mini.SelectView({ list: optionsAllAccounts, name: 'defaultSendAddress', model: mailSettings, id: 'defaultSendAddress', className: 'form-control' }).render().$el
                                )
                            )
                        )
                    ),
                    $('<div>').addClass('form-group expertmode').append(
                        $('<label>').attr({ 'for': 'autoSaveDraftsAfter' }).addClass('control-label').text(gt('Auto-save email drafts')),
                        $('<div>').addClass('controls').append(
                            $('<div>').addClass('row').append(
                                $('<div>').addClass('col-lg-4 col-xs-12').append(
                                    new mini.SelectView({ list: optionsAutoSave, name: 'autoSaveDraftsAfter', model: mailSettings, id: 'autoSaveDraftsAfter', className: 'form-control' }).render().$el
                                )
                            )
                        )
                    )
                )
            );
        }
    });

    ext.point(POINT + '/pane').extend({
        index: 400,
        id: 'display',
        draw: function () {
            this.append(
                $('<fieldset>').append(
                    $('<legend>').addClass('sectiontitle expertmode').text(gt('Display')),
                    $('<div>').addClass('form-group expertmode').append(
                        $('<div>').addClass('checkbox').append(
                            $('<label>').text(gt('Allow html formatted emails')).prepend(
                                new mini.CheckboxView({ name: 'allowHtmlMessages', model: mailSettings}).render().$el
                            )
                        ),
                        $('<div>').addClass('checkbox').append(
                            $('<label>').text(gt('Allow pre-loading of externally linked images')).prepend(
                                new mini.CheckboxView({ name: 'allowHtmlImages', model: mailSettings}).render().$el
                            )
                        ),
                        $('<div>').addClass('checkbox').append(
                            $('<label>').text(gt('Display emoticons as graphics in text emails')).prepend(
                                new mini.CheckboxView({ name: 'displayEmoticons', model: mailSettings}).render().$el
                            )
                        ),
                        $('<div>').addClass('checkbox').append(
                            $('<label>').text(gt('Color quoted lines')).prepend(
                                new mini.CheckboxView({ name: 'isColorQuoted', model: mailSettings}).render().$el
                            )
                        ),
                        $('<div>').addClass('checkbox').append(
                            $('<label>').text(gt('Ask for return receipt')).prepend(
                                new mini.CheckboxView({ name: 'sendDispositionNotification', model: mailSettings}).render().$el
                            )
                        )
                    )
                )
            );
        }
    });

    ext.point('io.ox/mail/settings/detail').extend({
        index: 500,
        id: 'imap-subscription',
        draw: function () {

            if (_.device('smartphone')) return;

            var container = $('<fieldset>');
            this.append(container );

            folderAPI.multiple(api.getFoldersByType('inbox')).then(function (folders) {

                var subscriptionPossible = _(folders)
                    .chain()
                    .map(function (folder) {
                        return folderAPI.can('subscribe:imap', folder);
                    })
                    .reduce(function (acc, value) {
                        return acc || value; // enough if one of the folders can subscribe
                    }, false)
                    .value();

                if (!subscriptionPossible) return;

                container.append(
                    $('<legend class="sectiontitle">').text(gt('IMAP folder subscription')),
                    $('<div class="sectioncontent">').append(
                        $('<button type="button" class="btn btn-primary" tabindex="1">')
                        .on('click', changeIMAPSubscription)
                        .text(gt('Change subscription'))
                    )
                );
            });
        }
    });

});
