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

define('io.ox/mail/compose/checks', [
    'io.ox/mail/api',
    'io.ox/mail/util',
    'io.ox/backbone/views/modal',
    'settings!io.ox/mail',
    'gettext!io.ox/mail'
], function (mailAPI, util, ModalDialog, settings, gt) {

    function getSender(data) {
        if (!data) return null;
        var replyTo = getReplyTo(data.headers);
        if (replyTo) return replyTo;
        if (_.isEmpty(data.from)) return null;
        return data.from[0];
    }

    function getReplyTo(headers) {
        if (!headers) return null;
        var str = $.trim(headers['Reply-To']);
        if (!str) return null;
        return util.parseRecipient(str);
    }

    function getList(data) {
        if (!data || !data.headers || !_.isString(data.headers['List-Post'])) return '';
        return data.headers['List-Post'].replace(/^.*<mailto:(.+)>.*$/i, '$1').toLowerCase();
    }

    return {

        // a message sent via a mailing list contains special mime headers like "list-owner"
        isMailingList: function (data) {
            if (!data || !data.headers) return false;
            for (var id in data.headers) {
                if (/^list-(id|archive|owner)$/i.test(id)) return true;
            }
            return false;
        },

        // ask the user when replying
        replyToMailingList: function (cid, mode) {

            // check setting
            if (!settings.get('confirmReplyToMailingLists', true)) return $.when(mode);

            // we get the original mail to check its headers
            var original = mailAPI.pool.get('detail').get(cid);
            if (!original) return $.when(mode);

            // early return if it's not a mailing list
            if (!this.isMailingList(original.toJSON())) return $.when(mode);

            // also if we don't have any other sender
            var sender = getSender(original.toJSON());
            if (!sender) return $.when(mode);

            var def = $.Deferred(),
                list = '<b>' + _.escape(getList(original.toJSON())) + '</b>',
                address = '<b>' + _.escape(util.getDisplayName(sender, { showMailAddress: true })) + '</b>';

            new ModalDialog({
                title: gt('Reply to mailing list'),
                easyOut: false,
                description: [
                    //#. %1$d is an email addresses
                    $('<p>').html(list ? gt('This message was sent via the mailing list %1$s.', list) : gt('This message was sent via a mailing list.')),
                    //#. %1$d is an email addresses
                    $('<p>').html(gt('Do you really want to reply all or just %1$s?', address))
                ]
            })
                .addCancelButton({ left: true })
                .addButton({ label: gt('Reply all'), action: 'reply-all' })
                .addButton({ label: gt('Reply to sender'), action: 'reply' })
                .on('reply-all', function () { def.resolve('replyall'); })
                .on('reply', function () { def.resolve('reply'); })
                .on('cancel', function () { def.reject(); })
                .open();

            return def;
        }
    };
});
