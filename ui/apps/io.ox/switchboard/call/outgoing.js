/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2020 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

define('io.ox/switchboard/call/outgoing', [
    'io.ox/backbone/views/modal',
    'io.ox/switchboard/presence',
    'io.ox/contacts/api',
    'io.ox/switchboard/call/ringtone',
    'gettext!io.ox/switchboard',
    'less!io.ox/switchboard/style'
], function (Modal, presence, contactsAPI, ringtone, gt) {

    'use strict';

    return {
        openDialog: function (call) {
            new Modal({ autoClose: false })
                .inject({
                    renderCallees: function () {
                        var callees = call.getCallees();
                        var $photo = $('<div class="photo">');
                        if (callees.length === 1) {
                            $photo.append(
                                contactsAPI.pictureHalo($('<div class="contact-photo">'), { email: callees[0] }, { width: 80, height: 80 }),
                                presence.getPresenceIcon(callees[0])
                            );
                        } else {
                            $photo.append(
                                $('<div class="contact-photo">').append('<i class="fa fa-group fa-3x" aria-hidden="true">')
                            );
                        }
                        this.$body.empty().append(
                            $photo,
                            $('<div class="name">').append(
                                callees.length === 1 ? call.getCalleeName(callees[0]) : $.txt(gt('Conference call'))
                            ),
                            $('<div class="email">').text(gt.noI18n(callees.join(', ')))
                        );
                    },
                    renderService: function () {
                        return require(['io.ox/switchboard/views/' + call.getType() + '-call'], function (View) {
                            this.conference = new View();
                            this.$body.append(this.conference.render().$el);
                        }.bind(this));
                    },
                    renderButtons: function () {
                        var state = this.conference.model.get('state');
                        this.$footer.empty();
                        switch (state) {
                            case 'unauthorized':
                                this.renderConnectButtons();
                                break;
                            case 'authorized':
                            case 'done':
                                this.renderCallButtons();
                            // no default
                        }
                    },
                    renderConnectButtons: function () {
                        this.$footer.append($('<div class="switchboard-actions">').append(
                            this.createButton('default', 'cancel', 'times', gt('Cancel')),
                            this.createButton('primary', 'connect', 'plug', gt('Connect'))
                        ));
                    },
                    renderCallButtons: function () {
                        this.$footer.append($('<div class="switchboard-actions">').append(
                            this.createButton('default', 'cancel', 'times', gt('Cancel')),
                            this.createButton('success', 'call', 'phone', gt.pgettext('verb', 'Call'))
                        ));
                        this.toggleCallButton();
                        this.$('button[data-action="call"]').focus();
                    },
                    createButton: function (type, action, icon, title) {
                        return $('<button type="button" class="btn btn-link">')
                            .addClass(type && ('btn-' + type))
                            .attr('data-action', action)
                            .append(
                                $('<i class="fa" aria-hidden="true">').addClass('fa-' + icon),
                                $('<div>').text(title)
                            );
                    },
                    toggleCallButton: function () {
                        var url = this.conference.model.get('joinURL');
                        this.getButton('call').prop('disabled', !url);
                    },
                    getButton: function (action) {
                        return this.$('button[data-action="' + action + '"]');
                    }
                })
                .build(function () {
                    this.$header.hide();
                    this.$el.addClass('call-dialog');
                    this.renderCallees();
                    this.renderService().done(function () {
                        this.renderButtons();
                        this.listenTo(this.conference.model, 'change:state', this.renderButtons);
                        this.listenTo(this.conference.model, 'change:joinURL', this.toggleCallButton);
                        this.listenTo(this.conference.model, 'done', this.close);
                    }.bind(this));
                })
                .on('connect', function () {
                    this.conference.trigger('connect');
                })
                .on('call', function () {
                    var url = this.conference.model.get('joinURL');
                    if (!url) return;
                    window.open(url, 'call');
                    call.set('joinURL', url).propagate();
                    ringtone.outgoing.play();
                    this.getButton('cancel').remove();
                    this.getButton('call').replaceWith(
                        this.createButton('danger', 'hangup', 'phone', gt('Hang up'))
                    );
                    call.addToHistory();
                })
                .on('hangup', function () {
                    this.close();
                })
                .on('close', function () {
                    ringtone.outgoing.stop();
                    call.hangup();
                })
                .open();
        }
    };
});
