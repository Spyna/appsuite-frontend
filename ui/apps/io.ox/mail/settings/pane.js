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
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define('io.ox/mail/settings/pane', [
    'io.ox/core/extensions',
    'io.ox/backbone/views/extensible',
    'io.ox/core/capabilities',
    'io.ox/core/settings/util',
    'io.ox/core/notifications',
    'io.ox/mail/mailfilter/vacationnotice/model',
    'io.ox/mail/mailfilter/autoforward/model',
    'settings!io.ox/mail',
    'gettext!io.ox/mail'
], function (ext, ExtensibleView, capabilities, util, notifications, vacationNoticeModel, autoforwardModel, settings, gt) {

    'use strict';

    // not possible to set nested defaults, so do it here
    if (settings.get('features/registerProtocolHandler') === undefined) {
        settings.set('features/registerProtocolHandler', true);
    }

    ext.point('io.ox/mail/settings/detail').extend({
        index: 100,
        id: 'view',
        draw: function () {
            this.append(
                new ExtensibleView({ point: 'io.ox/mail/settings/detail/view', model: settings })
                .inject({
                    // this gets overwritten elsewhere
                    getSoundOptions: function () {
                        return [{ label: gt('Bell'), value: 'bell' }];
                    }
                })
                .build(function () {
                    this.listenTo(settings, 'change', function () {
                        settings.saveAndYell().then(
                            function ok() {
                                // update mail API
                                require(['io.ox/mail/api'], function (mailAPI) {
                                    mailAPI.updateViewSettings();
                                });
                            },
                            function fail() {
                                notifications.yell('error', gt('Could not save settings'));
                            }
                        );
                    });
                })
                .render().$el
            );
        }
    });

    function isConfigurable(id) {
        return settings.isConfigurable(id);
    }

    var INDEX = 0;

    ext.point('io.ox/mail/settings/detail/view').extend(
        //
        // Header
        //
        {
            id: 'header',
            index: INDEX += 100,
            render: function () {
                this.$el.addClass('io-ox-mail-settings').append(
                    util.header(gt.pgettext('app', 'Mail'))
                );
            }
        },
        //
        // Buttons
        //
        {
            id: 'buttons',
            index: INDEX += 100,
            render: function (baton) {
                this.$el.append(
                    baton.branch('buttons', null, $('<div class="form-group buttons">'))
                );
            }
        },
        //
        // Display
        //
        {
            id: 'display',
            index: INDEX += 100,
            render: function () {
                this.$el.append(
                    util.fieldset(
                        //#. the noun, not the verb (e.g. German "Anzeige")
                        gt.pgettext('noun', 'View'),
                        // html
                        util.checkbox('allowHtmlMessages', gt('Allow html formatted emails'), settings),
                        // images
                        util.checkbox('allowHtmlImages', gt('Allow pre-loading of externally linked images'), settings),
                        // emojis
                        util.checkbox('displayEmoticons', gt('Display emoticons as graphics in text emails'), settings),
                        // colored quotes
                        util.checkbox('isColorQuoted', gt('Color quoted lines'), settings),
                        // fixed width
                        util.checkbox('useFixedWidthFont', gt('Use fixed-width font for text mails'), settings),
                        // // beautify plain text
                        // hidden until bug 52294 gets fixed
                        // util.checkbox('beautifyPlainText',
                        //     //#. prettify or beautify
                        //     //#. technically plain text is parsed and turned into HTML to have nicer lists or blockquotes, for example
                        //     gt('Prettify plain text mails'),
                        //     settings
                        // ),
                        // read receipts
                        util.checkbox('sendDispositionNotification', gt('Show requests for read receipts'), settings),
                        // unseen folder
                        settings.get('features/unseenFolder', false) && isConfigurable('unseenMessagesFolder') ?
                            util.checkbox('unseenMessagesFolder', gt('Show folder with all unseen messages'), settings) : []
                    )
                );
            }
        },
        //
        // Sounds
        //
        {
            id: 'sounds',
            index: INDEX += 100,
            render: function () {

                if (_.device('smartphone') || !(capabilities.has('websocket') || ox.debug) || !Modernizr.websockets) return;

                this.$el.append(
                    util.fieldset(
                        //#. Should be "töne" in german, used for notification sounds. Not "geräusch"
                        gt('Notification sounds'),
                        util.checkbox('playSound', gt('Play sound on incoming mail'), settings),
                        util.compactSelect('notificationSoundName', gt('Sound'), settings, this.getSoundOptions())
                            .prop('disabled', !settings.get('playSound'))
                    )
                );

                this.listenTo(settings, 'change:playSound', function (model, value) {
                    this.$('[name="notificationSoundName"]').prop('disabled', !value);
                });
            }
        },
        //
        // Behavior
        //
        {
            id: 'behavior',
            index: INDEX += 100,
            render: function () {

                var contactCollect = !!capabilities.has('collect_email_addresses');

                this.$el.append(
                    util.fieldset(
                        gt('Verhalten'),
                        util.checkbox('removeDeletedPermanently', gt('Permanently remove deleted emails'), settings),
                        contactCollect ? util.checkbox('contactCollectOnMailTransport', gt('Automatically collect contacts in the folder "Collected addresses" while sending'), settings) : [],
                        contactCollect ? util.checkbox('contactCollectOnMailAccess', gt('Automatically collect contacts in the folder "Collected addresses" while reading'), settings) : [],
                        // mailto handler registration
                        util.checkbox('features/registerProtocolHandler', gt('Ask for mailto link registration'), settings)
                        .find('label').css('margin-right', '8px').end()
                        .append(
                            // if supported add register now link
                            navigator.registerProtocolHandler ?
                                $('<a href="#" role="button">').text(gt('Register now')).on('click', function (e) {
                                    e.preventDefault();
                                    var l = location, $l = l.href.indexOf('#'), url = l.href.substr(0, $l);
                                    navigator.registerProtocolHandler(
                                        'mailto', url + '#app=' + ox.registry.get('mail-compose') + ':compose&mailto=%s', ox.serverConfig.productNameMail
                                    );
                                }) : []
                        )
                    )
                );
            }
        }
    );

    //
    // Buttons
    //
    ext.point('io.ox/mail/settings/detail/view/buttons').extend(
        //
        // Vacation notice
        //
        {
            id: 'vacation-notice',
            index: 100,
            render: function () {

                if (!capabilities.has('mailfilter')) return;

                this.append(
                    $('<button type="button" class="btn btn-default" data-action="edit-vacation-notice">')
                    .append(
                        $('<i class="fa fa-toggle-on">').hide(),
                        $.txt(gt('Vacation notice') + ' ...')
                    )
                    .on('click', openDialog)
                );

                // check whether it's active
                var model = new vacationNoticeModel();
                model.fetch().done(updateToggle.bind(this, model));
                ox.on('mail:change:vacation-notice', updateToggle.bind(this));

                function updateToggle(model) {
                    this.find('[data-action="edit-vacation-notice"] .fa-toggle-on').toggle(model.isActive());
                }

                function openDialog() {
                    ox.load(['io.ox/mail/mailfilter/vacationnotice/view']).done(function (view) {
                        view.open();
                    });
                }
            }
        },
        //
        // Auto Forward
        //
        {
            id: 'auto-forward',
            index: 200,
            render: function () {

                if (!capabilities.has('mailfilter')) return;

                this.append(
                    $('<button type="button" class="btn btn-default" data-action="edit-auto-forward">')
                    .append(
                        $('<i class="fa fa-toggle-on">').hide(),
                        $.txt(gt('Auto forward') + ' ...')
                    )
                    .on('click', openDialog)
                );

                // check whether it's active
                var model = new autoforwardModel();
                model.fetch().done(updateToggle.bind(this, model));
                ox.on('mail:change:auto-forward', updateToggle.bind(this));

                function updateToggle(model) {
                    this.find('[data-action="edit-auto-forward"] .fa-toggle-on').toggle(model.isActive());
                }

                function openDialog() {
                    ox.load(['io.ox/mail/mailfilter/autoforward/view']).done(function (view) {
                        view.open();
                    });
                }
            }
        },
        //
        // IMAP subscription
        //
        {
            id: 'imap-subscription',
            index: 300,
            render: function () {

                // we don't really need that on a smartphone (I guess)
                if (_.device('smartphone')) return;

                this.append(
                    $('<button type="button" class="btn btn-default">')
                    .text(gt('Change IMAP subscriptions') + ' ...')
                    .on('click', openDialog)
                );

                function openDialog() {
                    ox.load(['io.ox/core/folder/actions/imap-subscription']).done(function (subscribe) {
                        subscribe();
                    });
                }
            }
        }
    );
});
