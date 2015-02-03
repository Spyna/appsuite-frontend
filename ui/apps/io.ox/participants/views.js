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
 */

define('io.ox/participants/views',
    ['io.ox/contacts/api',
     'io.ox/core/util',
     'gettext!io.ox/calendar/edit/main',
     'less!io.ox/participants/participants'
    ], function (api, util, gt) {

    'use strict';

    var ParticipantEntryView = Backbone.View.extend({

        tagName: 'div',

        events: {
            'click .remove': 'onRemove',
            'keydown': 'fnKey'
        },

        render: function () {

            var self = this;

            // we set the class this way because some controller pass an existing node
            this.$el.addClass('participant-wrapper')
                .attr({
                    'data-cid': this.model.cid
                });

            this.nodes = {
                $img: $('<div>'),
                $text: $('<div class="participant-name">'),
                $mail: $('<a class="participant-email">'),
                $extra: $('<a class="extra-decorator">'),
                $removeButton: $('<a href="#" class="remove" role="button" tabindex="1">').append(
                    $('<div class="icon">').append(
                        $('<i class="fa fa-trash-o" aria-hidden="true">'),
                        $('<span class="sr-only">').text(gt('Remove contact') + ' ' + this.model.getDisplayName())
                    )
                )
            };

            this.setDisplayName();
            this.setTypeStyle();
            this.setOrganizer();
            this.setCustomImage();

            if (this.options.closeButton !== false && this.model.get('ui_removable') !== false) {
                this.$el.addClass('removable');
            }

            this.model.on('change', function (model) {
                if (model && model.changed) {
                    self.$el.empty();
                    self.render();
                }
            });

            this.$el.append(
                this.nodes.$img,
                this.nodes.$text,
                $('<div>').append(this.nodes.$mail),
                $('<div>').append(this.nodes.$extra),
                this.nodes.$removeButton
            );

            if (this.options.customize) {
                this.options.customize.call(this);
            }

            return this;
        },

        setDisplayName: function () {
            var name = this.model.getDisplayName();
            //display name: 'email only' participant
            name = name === '...' && this.model.getEmail() !== '' ? this.model.getEmail().split('@')[0] : name;
            util.renderPersonalName({ $el: this.nodes.$text, name: name }, this.model.toJSON());
        },

        setCustomImage: function () {
            var data = this.model.toJSON();
            //fix to work with picture halo (model uses email address as id)
            if (data.type === 5)
                delete data.id;

            api.pictureHalo(
                this.nodes.$img,
                $.extend(data, { width: 54, height: 54, scaleType: 'cover' })
            );
        },

        setOrganizer: function () {

            if (!this.options.baton) return;

            var organizerId = this.options.baton.model.get('organizerId');

            if (this.model.get('id') === organizerId) {
                this.$el.addClass('three-rows');
                this.nodes.$extra.text(gt('Organizer'));
            }
        },

        setRows: function (mail, extra) {
            mail = mail || '';
            this.nodes.$mail.text(gt.noI18n(mail));
            this.nodes.$extra.text(extra || '');
            if (mail && extra) {
                this.$el.addClass('three-rows');
            }
        },

        setImageClass: (function () {

            var types = 'default-image contact-image group-image resource-image resource-image external-user-image group-image'.split(' ');

            return function (type) {
                type = parseInt(type, 10);
                this.nodes.$img.attr('class', 'participant-image ' + (types[type] || ''));
            };

        }()),

        setTypeStyle: function  () {

            var type = this.model.get('type'), mail, data;

            this.setImageClass(type);

            switch (type) {
            case 1:
                mail = this.model.get('field') ? this.model.get(this.model.get('field')) : this.model.getEmail();
                this.setRows(mail, this.model.get('external') ? gt('External contact') : '');
                if (this.options.halo) {
                    this.nodes.$mail
                        .attr({ href: '#', tabindex: '1' })
                        .data({ email1: mail })
                        .addClass('halo-link');
                }
                break;
            case 2:
                this.setRows('', gt('Group'));
                break;
            case 3:
                this.setRows('', gt('Resource'));
                if (this.options.halo) {
                    data = this.model.toJSON();
                    data.callbacks = this.options.callbacks || {};
                    this.nodes.$extra
                        .attr({ href: '#', tabindex: '1' })
                        .data(data)
                        .addClass('pointer halo-resource-link');
                }
                break;
            case 4:
                this.setRows('', gt('Resource group'));
                break;
            case 5:
                mail = this.model.getEmail();
                this.setRows(mail, gt('External contact'));
                if (mail && this.options.halo) {
                    this.nodes.$mail
                        .attr({ href: '#', tabindex: '1' })
                        .data({ email1: mail })
                        .addClass('halo-link');
                }
                break;
            case 6:
                this.setRows('', gt('Distribution list'));
                break;
            }
        },

        fnKey: function (e) {
            // DEL
            if (e.which === 46) this.onRemove(e);
        },

        onRemove: function (e) {

            e.preventDefault();

            var removable = $(e.target).closest('.participant-wrapper.removable');
            if (removable.length) {
                // remove from collection by cid
                var cid = removable.attr('data-cid');
                this.model.collection.remove(this.model.collection.get(cid));
            }
        }
    });

    var UserContainer = Backbone.View.extend({
        tagName: 'div',
        className: 'participantsrow col-xs-12',
        initialize: function (options) {
            options.collection.on('add remove reset', _.bind(this.updateContainer, this));
        },
        render: function () {
            var self = this,
                counter = 1;
            this.nodes = {};

            // bring organizer up
            this.collection.each(function (participant) {
                if (participant.get('id') === self.options.baton.model.get('organizerId')) {
                    // 0 is reserved for the organizer
                    self.nodes[0] = self.createParticipantNode(participant);
                } else {
                    self.nodes[counter] = self.createParticipantNode(participant);
                    counter++;
                }
            });
            var row = $('<div class="row">');
            _(this.nodes).chain().values().each(function (node) {
                row.append(node);
            });
            self.$el.append(row);
            return this;
        },
        createParticipantNode: function (participant) {
            return new ParticipantEntryView({
                model: participant,
                baton: this.options.baton,
                className: 'col-xs-12 col-sm-6',
                halo: true,
                callbacks: this.options.baton.callbacks || {}
            }).render().$el;
        },
        updateContainer: function () {
            this.nodes = {};
            this.$el.empty();
            this.render();
        }
    });

    return {
        ParticipantEntryView: ParticipantEntryView,
        UserContainer: UserContainer
    };
});
