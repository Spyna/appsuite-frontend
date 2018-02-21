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
 * @author Frank Paczynski <frank.paczynski@open-xchange.com>
 */

define('io.ox/mail/categories/train', [
    'io.ox/mail/categories/api',
    'io.ox/core/yell',
    'gettext!io.ox/mail'
], function (api, yell, gt) {

    'use strict';

    return {

        open: function (options) {

            var addresses = options.data,
                category = options.targetname;

            yell({
                duration: -1,
                message: $('<div class="content category-toast">').append(
                    $('<p>').html(getSuccessMessage(addresses, category)),
                    $('<p>').html(getQuestion(addresses)),
                    $('<button type="button" class="btn btn-default" data-action="move-all">').text(gt('Move all messages')).on('click', function () {
                        api.train(options).fail(yell);
                        yell('close');
                    })
                ),
                type: 'success',
                focus: true
            });
        }
    };

    function getSuccessMessage(addresses, category) {
        return gt.format(
            //#. successfully moved a message via drag&drop to another mail category (tab)
            //#. %1$s represents the name if the target category
            gt.ngettext('Message moved to category "%1$s".', 'Messages moved to category "%1$s".', addresses.length),
            _.escape(category)
        );
    }

    function getQuestion(addresses) {
        var uniquelist = getSenderList(addresses);
        return gt.format(
            // split up strings to support languages with no plural forms
            //#. ask user to move all messages from the same sender to the mail category (tab)
            //#. %1$s represents a email address
            uniquelist.length === 1 ? gt('Do you want to move all messages from %1$s to that category?', uniquelist.length) :
                gt('Do you want to move all messages from selected senders to that category?'),
            '<b>' + _.escape(uniquelist) + '</b>'
        );
    }

    function getSenderList(addresses) {
        return _(addresses)
            .chain()
            .map(function (mail) { return mail.from[0][1]; })
            .uniq()
            .value();
    }
});
