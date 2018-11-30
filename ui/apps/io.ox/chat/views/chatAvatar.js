/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2017 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/chat/views/chatAvatar', [
    'io.ox/backbone/views/disposable',
    'io.ox/chat/views/avatar',
    'io.ox/chat/views/state'
], function (DisposableView, AvatarView, StateView) {

    'use strict';

    var ChatAvatarView = DisposableView.extend({

        className: 'chat-avatar',

        render: function () {
            this.$el.attr('aria-hidden', true);
            switch (this.model.get('type')) {
                case 'private': this.renderPrivateChat(); break;
                case 'group': this.renderGroupChat(); break;
                case 'channel': this.renderChannel(); break;
                // no default
            }
            return this;
        },

        renderPrivateChat: function () {
            var model = this.model.getFirstMember();
            this.$el.append(
                new AvatarView({ model: model }).render().$el,
                new StateView({ model: model }).render().$el
            );
        },

        renderGroupChat: function () {
            this.$el.append('<i class="fa fa-group">');
        },

        renderChannel: function () {
            this.$el.append('<i class="fa fa-hashtag">');
        }
    });

    return ChatAvatarView;
});
