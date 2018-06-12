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

define('io.ox/chat/data', ['io.ox/chat/events', 'io.ox/contacts/api', 'static/3rd.party/socket.io.slim.js'], function (events, api, io) {

    'use strict';

    var user_id = parseInt(_.url.hash('chatUser'), 10) || ox.user_id,
        chatHost = _.url.hash('chatHost') || 'devtank.de';

    var data = {
        // yes, it contains the user_id; just a POC; no auth
        API_ROOT: 'https://' + chatHost + '/api/' + user_id,
        SOCKET: 'https://' + chatHost,
        user_id: user_id
    };

    //
    // User
    //

    var UserModel = Backbone.Model.extend({

        isSystem: function () {
            return this.get('id') === 0;
        },

        isMyself: function () {
            return this.get('id') === data.user_id;
        },

        getName: function () {
            var first = $.trim(this.get('first_name')), last = $.trim(this.get('last_name'));
            if (first && last) return first + ' ' + last;
            return first || last || '\u00a0';
        },

        getState: function () {
            return this.get('state') || 'offline';
        },

        fetchState: function () {
            if (this.has('state')) return;
            $.get({ url: data.API_ROOT + '/users/' + this.get('id') + '/state' })
                .done(function (state) { this.set('state', state); }.bind(this));
        }
    });

    var UserCollection = Backbone.Collection.extend({ model: UserModel });
    data.users = new UserCollection([]);

    data.fetchUsers = function () {
        return api.getAll({ folder: 6, columns: '501,502,524,570' }, false).then(function (result) {
            result = _(result).map(function (item) {
                return {
                    id: item.internal_userid,
                    first_name: item.first_name,
                    last_name: item.last_name,
                    image: !!item['570']
                };
            });
            return data.users.reset(result);
        });
    };

    var MemberCollection = Backbone.Collection.extend({

        model: UserModel,

        initialize: function (models, options) {
            this.roomId = options.roomId;
        },

        url: function () {
            return data.API_ROOT + '/rooms/' + this.roomId + '/members';
        },

        parse: function (array) {
            return _(array).map(function (item) {
                return _.isNumber(item) ? data.users.get(item) : item;
            });
        },

        toArray: function () {
            return this.pluck('id').sort();
        }
    });

    //
    // Message
    //

    var MessageModel = Backbone.Model.extend({

        defaults: function () {
            return { body: '', senderId: data.user_id, sent: +moment(), type: 'text' };
        },

        getBody: function () {
            if (this.isSystem()) return this.getSystemMessage();
            if (this.isImage()) return this.getImage();
            return this.getFormattedBody();
        },

        getFormattedBody: function () {
            return _.escape(this.get('body')).replace(/(https?:\/\/\S+)/g, '<a href="$1" target="_blank">$1</a>');
        },

        getSystemMessage: function () {
            var data = JSON.parse(this.get('body'));
            switch (data.type) {
                case 'joinMember':
                    return _.printf('%1$s joined the conversation', getName(data.member));
                case 'addMember':
                    return _.printf('%1$s added %2$s to the conversation', getName(data.originator), getNames(data.members));
                case 'me':
                    return _.printf('%1$s %2$s', getName(data.originator), data.message);
                case 'text':
                    return data.message;
                default:
                    return _.printf('Unknown system message %1$s', data.type);
            }
        },

        getImage: function () {
            return '<img src="' + this.get('body') + '" alt="">';
        },

        getTime: function () {
            return moment(this.get('sent')).format('LT');
        },

        getTextBody: function () {
            return _.escape(this.get('body'));
        },

        isSystem: function () {
            return this.get('senderId') === 0;
        },

        isMyself: function () {
            return this.get('senderId') === data.user_id;
        },

        isImage: function () {
            return this.get('type') === 'image';
        },

        hasSameSender: function () {
            var index = this.collection.indexOf(this);
            if (index <= 0) return false;
            return this.collection.at(index - 1).get('senderId') === this.get('senderId');
        }
    });

    var MessageCollection = Backbone.Collection.extend({
        model: MessageModel,
        comparator: 'sent',
        initialize: function (models, options) {
            this.roomId = options.roomId;
        },
        url: function () {
            return data.API_ROOT + '/rooms/' + this.roomId + '/messages';
        }
    });

    //
    // Chat
    //

    var ChatModel = Backbone.Model.extend({

        defaults: { open: true, type: 'group', unseen: 0 },

        initialize: function (attr) {
            this.set('modified', +moment());
            this.unset('messages', { silent: true });
            this.members = new MemberCollection(attr.members, { parse: true, roomId: attr.id });
            this.messages = new MessageCollection([], { roomId: attr.id });
            // forward specific events
            this.listenTo(this.members, 'all', function (name) {
                if (/^(add|change|remove)$/.test(name)) this.trigger('member:' + name);
                this.set('members', this.members.toArray());
            });
            this.listenTo(this.messages, 'all', function (name) {
                if (/^(add|change|remove)$/.test(name)) this.trigger('message:' + name);
            });
        },

        getTitle: function () {
            return this.get('title') || _(this.members.reject({ id: data.user_id })).invoke('getName').sort().join('; ');
        },

        getLastMessage: function () {
            var last = this.get('lastMessage');
            return last ? new MessageModel(last).getTextBody() : '\u00a0';
        },

        getLastMessageDate: function () {
            var last = this.get('lastMessage');
            return last ? moment(new MessageModel(last).get('sent')).format('LT') : '\u00a0';
        },

        getFirstMember: function () {
            // return first member that is not current user
            return this.members.reject({ id: data.user_id })[0];
        },

        isOpen: function () {
            return this.get('open');
        },

        isPrivate: function () {
            return this.get('type') === 'private';
        },

        isGroup: function () {
            return this.get('type') === 'group';
        },

        isChannel: function () {
            return this.get('type') === 'channel';
        },

        postMessage: function (attr) {
            this.messages.add(attr).save();
            this.set('modified', +moment());
        },

        addMembers: function (ids) {
            this.members.add(ids, { parse: true });
            return $.post(this.members.url(), { members: ids });
        },

        toggle: function (state) {
            this.set('open', !!state).save({ open: !!state }, { patch: true });
        }
    });

    var ChatCollection = Backbone.Collection.extend({

        model: ChatModel,
        comparator: 'modified',

        url: function () {
            return data.API_ROOT + '/rooms';
        },

        initialize: function () {
            this.on('change:unseen', this.onChangeUnseen);
        },

        create: function (attr) {
            var collection = this,
                data = { open: true, members: attr.members, title: '', type: attr.type || 'group' };
            return $.post(this.url(), data).done(function (data) {
                collection.add(data);
            });
        },

        onChangeUnseen: function () {
            this.trigger('unseen', this.reduce(function (sum, model) {
                return sum + (model.get('unseen') > 0 ? 1 : 0);
            }, 0));
        },

        getOpen: function () {
            return this.filter({ open: true });
        },

        getHistory: function () {
            return this.filter({ open: false, joined: true }).slice(0, 100);
        },

        getChannels: function () {
            return this.filter({ type: 'channel' });
        },

        getChannelsUnjoined: function () {
            return this.filter({ type: 'channel', joined: false });
        },

        fetchUnlessExists: function (roomId) {
            var model = this.get(roomId);
            if (model) return $.when(model);
            return $.get({ url: this.url() + '/' + roomId }).then(this.add.bind(this));
        },

        joinChannel: function (roomId) {
            var model = this.get(roomId);
            if (!model || !model.isChannel()) return;
            model.addMembers([user_id]);
            model.set({ joined: true, open: true });
        }
    });

    data.chats = new ChatCollection();

    //
    // Files
    //

    var FileModel = Backbone.Model.extend({

        getThumbnailUrl: function () {
            return data.API_ROOT + '/files/' + this.get('id') + '/thumbnail';
        },

        getPreviewUrl: function () {
            return data.API_ROOT + '/files/' + this.get('id') + '/thumbnail';
        }
    });


    var FilesCollection = Backbone.Collection.extend({

        model: FileModel,

        url: function () {
            return data.API_ROOT + '/files';
        }
    });

    data.files = new FilesCollection();

    //
    // Helpers
    //

    function getName(id) {
        return getNames([id]);
    }

    function getNames(list) {
        return join(
            _(list)
            .map(function (id) {
                var model = data.users.get(id);
                return '<span class="name">' + (model ? model.getName() : 'Unknown user') + '</span>';
            })
            .sort()
        );
    }

    function join(list) {
        if (list.length <= 2) return list.join(' and ');
        return list.slice(0, -1).join(', ') + ', and ' + list[list.length - 1];
    }

    //
    // Socket support
    //

    var socket = data.socket = io.connect(data.SOCKET, { query: 'userId=' + data.user_id });

    socket.on('alive', function () {
        console.log('Connected socket to server');
    });

    socket.on('message:change', function (roomId, id, changes) {
        var collection = data.chats.get(roomId);
        if (!collection) return;
        var message = collection.messages.get(id);
        if (message) message.set(changes);
    });

    socket.on('message:new', function (roomId, message) {
        // stop typing
        events.trigger('typing:' + roomId, message.senderId, false);
        // fetch room unless it's already known
        data.chats.fetchUnlessExists(roomId).done(function (model) {
            // add new message to room
            model.messages.add(message);
            model.set({ modified: +moment(), unseen: model.get('unseen') + 1 });
        });
    });

    socket.on('user:change:state', function (userId, state) {
        var model = data.users.get(userId);
        if (model) model.set('state', state);
    });

    socket.on('typing', function (roomId, userId, state) {
        events.trigger('typing:' + roomId, userId, state);
    });

    // send heartbeat every minute
    setInterval(function () { socket.emit('heartbeat'); }, 60000);

    return data;
});
