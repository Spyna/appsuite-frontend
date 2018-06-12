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

define('io.ox/chat/main', [
    'io.ox/chat/data',
    'io.ox/chat/events',
    'io.ox/backbone/views/window',
    'io.ox/chat/views/empty',
    'io.ox/chat/views/chat',
    'io.ox/chat/views/chatList',
    'io.ox/chat/views/channelList',
    'io.ox/chat/views/history',
    'io.ox/chat/views/fileList',
    'io.ox/chat/views/search',
    'io.ox/chat/views/searchResult',
    'io.ox/contacts/api',
    'io.ox/chat/socket',
    'less!io.ox/chat/style'
], function (data, events, FloatingWindow, EmptyView, ChatView, ChatListView, ChannelList, History, FileList, searchView, SearchResultView, contactsAPI) {

    'use strict';

    var Window = FloatingWindow.View.extend({

        events: function () {
            return _.extend(FloatingWindow.View.prototype.events, {
                'keydown .left-navigation': 'onLeftNavigationKeydown',
                'keydown .overlay': 'onOverlayEvent',
                'click .overlay': 'onOverlayEvent'
            });
        },

        initialize: function () {

            FloatingWindow.View.prototype.initialize.apply(this, arguments);

            this.listenTo(data.chats, 'unseen', function (count) {
                this.setCount(count);
            });

            this.listenTo(events, 'cmd', this.onCommand);
        },

        setCount: function (count) {
            this.model.set('count', count);
        },

        onCommand: function (data) {
            switch (data.cmd) {
                case 'start-chat': this.startChat(data); break;
                case 'start-private-chat': this.startPrivateChat(data); break;
                case 'join-channel': this.joinChannel(data); break;
                case 'show-chat': this.showChat(data.id || data.cid); break;
                case 'show-recent-conversations': this.showRecentConversations(); break;
                case 'show-channels': this.showChannels(); break;
                case 'show-all-files': this.showAllFiles(); break;
                case 'show-file': this.showFile(data); break;
                case 'prev-file': this.moveFile(-1); break;
                case 'next-file': this.moveFile(+1); break;
                case 'close-file': this.closeFile(); break;
                case 'open-chat': this.toggleChat(data.id, true); break;
                case 'close-chat': this.toggleChat(data.id, false); break;
                case 'add-member': this.addMember(data.id); break;
                // no default
            }
        },

        startChat: function () {
            require(['io.ox/contacts/addressbook/popup'], function (picker) {
                picker.open(
                    function callback(items) {
                        var members = _(items).pluck('user_id');
                        data.chats.create({ type: 'group', members: members });
                    },
                    {
                        help: false,
                        build: function () {
                            this.$el.addClass('ox-chat-popup');
                        },
                        useGABOnly: true,
                        title: 'Start new conversation',
                        button: 'Start conversation'
                    }
                );
            });
        },

        startPrivateChat: function (cmd) {
            data.chats.create({ type: 'private', members: [cmd.id] }).done(function (result) {
                this.showChat(result.id);
            }.bind(this));
        },

        joinChannel: function (cmd) {
            data.chats.joinChannel(cmd.id);
            this.showChat(cmd.id);
        },

        showChat: function (id) {
            var view = new ChatView({ room: id });
            this.$rightside.empty().append(view.render().$el);
            view.scrollToBottom();
        },

        showRecentConversations: function () {
            this.$rightside.empty().append(new History().render().$el);
        },

        showChannels: function () {
            this.$rightside.empty().append(new ChannelList().render().$el);
        },

        showAllFiles: function () {
            this.$rightside.empty().append(new FileList().render().$el);
        },

        showFile: function (cmd) {
            renderOverlay().appendTo(this.$body).focus();
            this.updateFile(cmd.index);
        },

        moveFile: function (step) {
            var index = parseInt(this.$('.overlay').attr('data-index'), 10) + step,
                length = data.files.length;
            if (index < 0) index = length - 1; else if (index >= length) index = 0;
            this.updateFile(index);
        },

        updateFile: function (index) {
            this.$('.overlay')
                .attr('data-index', index)
                .find('img').remove().end()
                .append(
                    $('<img>', { alt: '', src: data.files.at(index).getPreviewUrl() })
                );
        },

        closeFile: function () {
            this.$('.overlay').remove();
            this.$el.focus();
        },

        onLeftNavigationKeydown: function (e) {
            if (e.which !== 38 && e.which !== 40) return;
            e.preventDefault();
            var items = this.$('.left-navigation [data-cmd]'),
                index = items.index(document.activeElement) + (e.which === 38 ? -1 : +1);
            index = Math.max(0, Math.min(index, items.length - 1));
            items.eq(index).focus().click();
        },

        onOverlayEvent: function (e) {
            if ((e.type === 'click' && $(e.target).is('.overlay')) || e.which === 27) return this.closeFile();
            if (e.which !== 37 && e.which !== 39) return;
            this.moveFile(e.which === 37 ? -1 : +1);
        },

        toggleChat: function (id, state) {
            var model = data.chats.get(id);
            if (!model) return;
            model.toggle(state);
            if (state) this.showChat(id); else this.$rightside.empty();
        },

        addMember: function (id) {
            var model = data.chats.get(id);
            if (!model) return;
            require(['io.ox/contacts/addressbook/popup'], function (picker) {
                picker.open(
                    function callback(items) {
                        var ids = _(items).pluck('user_id');
                        model.addMembers(ids);
                    },
                    {
                        help: false,
                        build: function () {
                            this.$el.addClass('ox-chat-popup');
                        },
                        useGABOnly: true,
                        title: 'Add members',
                        button: 'Add'
                    }
                );
            });
        }
    });

    data.fetchUsers().done(function () {

        var window = new Window({ title: 'OX Chat' }).render().open(),
            user = data.users.get(data.user_id);

        // start with BAD style and hard-code stuff

        window.$body.addClass('ox-chat').append(
            $('<div class="leftside abs">').append(
                $('<div class="header">').append(
                    contactsAPI.pictureHalo(
                        $('<div class="picture" aria-hidden="true">'), { internal_userid: data.user_id }, { width: 40, height: 40 }
                    ),
                    $('<button type="button" class="btn btn-default btn-circle" data-cmd="start-chat"><i class="fa fa-plus"></i></button>'),
                    $('<i class="fa state online fa-check-circle">'),
                    $('<div class="name">').text(user.getName())
                ),
                new searchView().render().$el,
                $('<div class="left-navigation abs">').append(
                    // search results
                    new SearchResultView().render().$el,
                    // chats
                    new ChatListView({ collection: data.chats }).render().$el,
                    // navigation
                    $('<div class="navigation">').append(
                        $('<button type="button" class="btn-nav" data-cmd="show-recent-conversations">').append(
                            $('<i class="fa fa-clock-o btn-icon">'),
                            $.txt('Recent conversations')
                        ),
                        $('<button type="button" class="btn-nav" data-cmd="show-channels">').append(
                            $('<i class="fa fa-hashtag btn-icon">'),
                            $.txt('All channels')
                        ),
                        $('<button type="button" class="btn-nav" data-cmd="show-all-files">').append(
                            $('<i class="fa fa-paperclip btn-icon">'),
                            $.txt('All files')
                        )
                    )
                )
            ),
            window.$rightside = $('<div class="rightside abs">').append(
                new EmptyView().render().$el
            )
        );
    });

    function renderOverlay() {
        return $('<div class="overlay abs" tabindex="-1">').append(
            $('<button type="button" data-cmd="prev-file"><i class="fa fa-chevron-left" aria-hidden="true"></i></button>'),
            $('<button type="button" data-cmd="next-file"><i class="fa fa-chevron-right" aria-hidden="true"></i></button>'),
            $('<button type="button" data-cmd="close-file"><i class="fa fa-close" aria-hidden="true"></i></button>')
        );
    }

    ox.chat = {
        data: data
    };

});
