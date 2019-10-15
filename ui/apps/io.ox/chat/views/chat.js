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

define('io.ox/chat/views/chat', [
    'io.ox/backbone/views/disposable',
    'io.ox/chat/views/avatar',
    'io.ox/chat/views/chatAvatar',
    'io.ox/chat/views/chatMember',
    'io.ox/chat/events',
    'io.ox/chat/data'
], function (DisposableView, Avatar, ChatAvatar, ChatMember, events, data) {

    'use strict';

    var MESSAGE_LIMIT = 20;

    var ChatView = DisposableView.extend({

        className: 'chat',

        events: {
            'keydown textarea': 'onEditorKeydown',
            'input textarea': 'onEditorInput',
            'click .file-upload-btn': 'onTriggerFileupload',
            'change .file-upload-input': 'onFileupload'
        },

        initialize: function (options) {

            this.room = options.room;
            this.model = data.chats.get(this.room);

            this.listenTo(this.model, {
                'change:title': this.onChangeTitle
            });

            this.listenTo(this.model.messages, {
                'add': this.onAdd,
                'remove': this.onRemove,
                'change:body': this.onChangeBody,
                'change:fileId': this.onChangeBody,
                'change:time': this.onChangeTime,
                'change:delivery': this.onChangeDelivery
            });

            this.model.messages.fetch();

            // tracking typing
            this.typing = {
                $el: $('<div class="typing">'),
                timer: {},
                show: function (userId) {
                    var model = data.users.get(userId);
                    if (!model || model.isMyself()) return;
                    this.reset(userId);
                    var $span = this.span(userId);
                    if (!$span.length) this.add(userId, model.getName());
                    this.timer[userId] = setTimeout(this.hide.bind(this), 5000, userId);
                },
                span: function (userId) {
                    return this.$el.find('[data-user-id="' + userId + '"]');
                },
                reset: function (userId) {
                    if (!this.timer[userId]) return;
                    window.clearTimeout(this.timer[userId]);
                    delete this.timer[userId];
                },
                add: function (userId, name) {
                    this.$el.append($('<div class="name">').attr('data-user-id', userId).text(name + ' is typing'));
                },
                hide: function (userId) {
                    this.reset(userId);
                    this.span(userId).remove();
                },
                toggle: function (userId, state) {
                    if (state) this.show(userId); else this.hide(userId);
                }
            };

            this.listenTo(events, 'typing:' + this.model.id, function (userId, state) {
                this.typing.toggle(userId, state);
            });

            this.$messages = $();
            this.$editor = $();
        },

        render: function () {
            this.$el.append(
                $('<div class="header abs">').append(
                    $('<button type="button" class="btn btn-default" data-cmd="close-chat"><i class="fa fa-chevron-left" aria-hidden="true"></i></button>'),
                    new ChatAvatar({ model: this.model }).render().$el,
                    this.model.isPrivate() ?
                        // private chat
                        this.renderTitle().addClass('flex-grow') :
                        // groups / channels
                        $('<div class="flex-grow">').append(
                            this.renderTitle().addClass('small-line'),
                            new ChatMember({ collection: this.model.members }).render().$el
                        ),
                    $('<button type="button" class="btn btn-default btn-circle pull-right file-upload-btn">')
                        .append('<i class="fa fa-paperclip" aria-hidden="true">'),
                    $('<input type="file" class="file-upload-input hidden">'),
                    // burger menu (pull-right just to have the popup right aligned)
                    $('<div class="dropdown pull-right">').append(
                        $('<button type="button" class="btn btn-default btn-circle dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">')
                        .append('<i class="fa fa-bars" aria-hidden="true">'),
                        this.renderDropdown()
                    )
                ),
                $('<div class="scrollpane abs">').append(
                    $('<div class="conversation">').append(
                        this.$messages = $('<div class="messages">').append(
                            this.model.messages.last(MESSAGE_LIMIT).map(this.renderMessage, this)
                        ),
                        this.typing.$el
                    )
                ),
                $('<div class="controls abs">').append(
                    this.$editor = $('<textarea class="form-control" placeholder="Enter message here">')
                )
            );

            return this;
        },

        renderDropdown: function () {

            var $ul = $('<ul class="dropdown-menu">');

            function renderItem(text, data) {
                return $('<li>').append(
                    $('<a href="#" role="button">').attr(data).text(text)
                );
            }

            // add member
            if (this.model.isGroup()) {
                $ul.append(renderItem('Add member', { 'data-cmd': 'add-member', 'data-id': this.model.id }));
            }

            // unsubscribe
            $ul.append(renderItem('Close chat', { 'data-cmd': 'unsubscribe-chat', 'data-id': this.model.id }));

            return $ul;
        },

        renderTitle: function () {
            return $('<h2 class="title">').append(this.model.getTitle() || '\u00a0');
        },

        renderMessage: function (model) {
            var delivery = model.get('delivery'),
                userDelivery = delivery.find(function (d) {
                    return d.userId.toString() === data.user_id.toString();
                });
            // mark message as seen as soon as it is rendered
            if (userDelivery && userDelivery.state !== 'seen') model.updateDelivery('seen');
            return $('<div class="message">')
                // here we use cid instead of id, since the id might be unknown
                .attr('data-cid', model.cid)
                .addClass(model.isSystem() ? 'system' : model.get('type'))
                .toggleClass('myself', model.isMyself())
                .append(
                    // sender avatar & name
                    this.renderSender(model),
                    // message boby
                    $('<div class="body">').addClass().html(model.getBody()),
                    // time
                    $('<div class="time">').text(model.getTime()),
                    // delivery state
                    $('<div class="fa delivery">').addClass(model.get('state'))
                );
        },

        renderSender: function (model) {
            if (model.isSystem() || model.isMyself() || model.hasSameSender()) return $();
            var user = data.users.get(model.get('senderId'));
            return [new Avatar({ model: user }).render().$el, $('<div class="sender">').text(user.getName())];
        },

        scrollToBottom: function () {
            this.$('.scrollpane').scrollTop(0xFFFF);
            this.model.set('unreadCount', 0);
        },

        onEditorKeydown: function (e) {
            if (e.which !== 13) return;
            e.preventDefault();
            this.onPostMessage(this.$editor.val());
            this.$editor.val('').focus();
        },

        onEditorInput: function () {
            var state = this.$editor.val() !== '';
            data.socket.emit('typing', { roomId: this.model.id, state: state });
        },

        onTriggerFileupload: function () {
            this.$('.file-upload-input').trigger('click');
        },

        onFileupload: function () {
            var $input = this.$('.file-upload-input');
            this.model.postMessage({ body: '' }, $input[0].files[0]);
            $input.val('');
        },

        onPostMessage: function (body) {
            this.model.postMessage({ body: body });
        },

        onChangeTitle: function (model) {
            this.$('.title').text(model.getTitle() || '\u00a0');
        },

        onAdd: _.debounce(function (model, collection, options) {
            // render
            this.$messages.append(
                options.changes.added.map(this.renderMessage.bind(this))
            );
            // too many messages?
            var children = this.$messages.children();
            if (children.length > MESSAGE_LIMIT) children.slice(0, children.length - MESSAGE_LIMIT).remove();
            // proper scroll position
            this.scrollToBottom();
        }, 1),

        getMessageNode: function (model, selector) {
            return this.$('.message[data-cid="' + model.cid + '"] ' + (selector || ''));
        },

        onRemove: function (model) {
            this.getMessageNode(model).remove();
        },

        onChangeBody: function (model) {
            var $message = this.getMessageNode(model);
            var $body = $message.find('.body');
            $message
                .removeClass('system text image file audio')
                .addClass(model.isSystem() ? 'system' : model.get('type'));
            $body.html(model.getBody());
        },

        onChangeTime: function (model) {
            this.getMessageNode(model, '.time').text(model.getTime());
        },

        onChangeDelivery: function (model) {
            this.getMessageNode(model, '.delivery').attr('class', 'fa delivery ' + model.get('state'));
        }
    });

    return ChatView;
});
