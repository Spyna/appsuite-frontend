/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2013 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/mail/write/inplace/inplace',
    ['io.ox/mail/api',
     'io.ox/core/api/account',
     'io.ox/core/tk/dialogs',
     'io.ox/core/notifications',
     'io.ox/core/util',
     'io.ox/backbone/mini-views/abstract',
     'gettext!io.ox/mail',
     'less!io.ox/mail/write/inplace/inplace.less'
    ], function (api, accountAPI, dialogs, notifications, util, AbstractView, gt) {

    'use strict';

    var InplaceView = AbstractView.extend({

        setup: function (options) {
            this.mail = options.mail;
            this.listenTo(this.model, 'change', this.renderContent, this);
        },

        onSend: function () {

            var model = this.model, content = this.$el.find('.editor').val();

            // get sender address
            accountAPI.getPrimaryAddressFromFolder(this.model.get('account_id') || this.mail.folder_id).done(function (from) {
                var data = {
                    attachments: [{ content: content, content_type: 'text/plain', raw: true }],
                    from: [from],
                    to: model.get('to'),
                    cc: model.get('cc'),
                    headers: model.get('headers'),
                    subject: model.get('subject'),
                    priority: 3,
                    vcard: 0,
                    msgref: model.get('msgref'),
                    sendtype: '1'
                };
                api.send(data).fail(notifications.yell);
            });
        },

        renderContent: function () {
            // subject
            if (this.model.get('subject') !== undefined) {
                this.$el.find('.subject').text(
                    $.trim(this.model.get('subject')) || '\u00A0'
                );
            }
            // recipients
            var list = [].concat(this.model.get('to'), this.model.get('cc'));
            if (list.length) {
                this.$el.find('.recipients').text(
                    gt('To') + ': ' +
                    _(list).map(function (recipient) {
                        return recipient[0] ? util.unescapeDisplayName(recipient[0]) : recipient[1];
                    })
                    .join('\u00A0\u2022 ') // &bull;
                );
            }
        },

        render: function () {

            this.$el.addClass('inplace-reply').append(
                $('<h4 class="subject">').text('\u00A0'),
                $('<p class="recipients">').text('\u00A0'),
                $('<textarea rows="5" class="editor input-xxlarge">').attr('placeholder', gt('Your answer'))
            );

            this.renderContent();

            return this;
        }
    });

    return {

        reply: function (options) {

            if (!_.isObject(options)) return;
            if (!_.isObject(options.mail)) return;

            var dialog = new dialogs.ModalDialog({ easyOut: false, width: 572, container: options.container || $('body') }); // 572 fits input-xxlarge

            // show dialog instantly
            var model = new Backbone.Model({ subject: undefined, to: [], cc: [] }),
                view = new InplaceView({ model: model, mail: options.mail, el: dialog.getContentNode() });

            dialog.append(view.render().$el)
                .addAlternativeButton('cancel', gt('Discard'))
                .addPrimaryButton('send', gt('Send'), 'send', { classes: 'pull-right' })
                .on('send', function () { view.onSend(); })
                .show(function () {
                    this.find('.btn-primary').prop('disabled', true);
                    this.find('.editor').focus();
                });

            // fetch reply data
            api.replyall(api.reduce(options.mail)).then(
                function success(data) {
                    dialog.getPopup().find('.btn-primary').prop('disabled', false);
                    model.set(data);
                },
                function fail(e) {
                    notifications.yell(e);
                    dialog.close();
                }
            );
        }
    };
});
