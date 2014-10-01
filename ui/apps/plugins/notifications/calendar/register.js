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
 * @author Mario Scheliga <mario.scheliga@open-xchange.com>
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('plugins/notifications/calendar/register',
    ['io.ox/calendar/api',
     'io.ox/core/api/reminder',
     'io.ox/core/extensions',
     'gettext!plugins/notifications'
    ], function (calAPI, reminderAPI, ext, gt) {

    'use strict';

    ext.point('io.ox/core/notifications/invites/header').extend({
        draw: function () {
            this.append(
                $('<legend class="section-title">').text(gt('Appointment invitations'))
                    .append($('<button type="button" class="btn btn-link clear-button fa fa-times refocus">')
                        .attr({ tabindex: 1,
                            'aria-label': gt('Press to hide all appointment invitations.'),
                            'data-action': 'clear',
                            'focus-id': 'calendar-invite-clear'})),
                $('<div class="notifications">')
            );
        }
    });

    ext.point('io.ox/core/notifications/reminder/header').extend({
        draw: function () {
            this.append(
                $('<legend class="section-title">').text(gt('Appointment reminders'))
                    .append($('<button type="button" class="btn btn-link clear-button fa fa-times refocus">')
                        .attr({ tabindex: 1,
                            'aria-label': gt('Press to hide all appointment reminders.'),
                            'data-action': 'clear',
                            'focus-id': 'calendar-reminder-notification-clear'})),
                $('<div class="reminder">')
            );
        }
    });

    ext.point('io.ox/core/notifications/invites/item').extend({
        draw: function (baton) {
            var model = baton.model;
            this.attr({
                role: 'listitem',
                'data-cid': model.get('cid'),
                'focus-id': 'calendar-invite-' + model.get('cid'),
                'tabindex': 1,
                            //#. %1$s Appointment title
                            //#. %2$s Appointment date
                            //#. %3$s Appointment time
                            //#. %4$s Appointment location
                            //#. %5$s Appointment Organizer
                            //#, c-format
                'aria-label': gt('Appointment invitation. %1$s %2$s %3$s %4$s %5$s. Press [enter] to open',
                        _.noI18n(model.get('title')), _.noI18n(model.get('date')),
                        _.noI18n(model.get('time')), _.noI18n(model.get('location')) || '',
                        _.noI18n(model.get('organizer')))
            }).append(
                $('<div class="time">').text(model.get('time')),
                $('<div class="date">').text(model.get('date')),
                $('<div class="title">').text(model.get('title')),
                $('<div class="location">').text(model.get('location')),
                $('<div class="organizer">').text(model.get('organizer')),
                $('<div class="actions">').append(
                    $('<button type="button" tabindex="1" class="refocus btn btn-default" data-action="accept_decline">')
                        .attr('focus-id', 'calendar-invite-' + model.get('cid') + '-accept-decline')
                        .css('margin-right', '14px')
                        .text(gt('Accept / Decline')),
                    $('<button type="button" tabindex="1" class="refocus btn btn-success" data-action="accept">')
                        .attr({'title': gt('Accept invitation'),
                               'aria-label': gt('Accept invitation'),
                               'focus-id': 'calendar-invite-' + model.get('cid') + '-accept'})
                        .append('<i class="fa fa-check">')
                )
            );
        }
    });

    ext.point('io.ox/core/notifications/reminder/item').extend({
        draw: function (baton) {
            //build selectoptions
            var minutes = [5, 10, 15, 45],
                options = [],
                self = this;
            for (var i = 0; i < minutes.length; i++) {
                options.push([minutes[i], gt.format(gt.npgettext('in', 'in %d minute', 'in %d minutes', minutes[i]), minutes[i])]);
            }
            require(['io.ox/core/tk/reminder-util'], function (reminderUtil) {
                reminderUtil.draw(self, baton.model, options);
            });
        }
    });

    var InviteView = Backbone.View.extend({

        className: 'item refocus',

        events: {
            'click': 'onClickItem',
            'keydown': 'onClickItem',
            'click [data-action="accept_decline"]': 'onClickChangeStatus',
            'click [data-action="accept"]': 'onClickAccept'
        },

        render: function () {
            var baton = ext.Baton({ model: this.model, view: this });
            ext.point('io.ox/core/notifications/invites/item').invoke('draw', this.$el, baton);
            return this;
        },

        onClickItem: function (e) {
            if ($(e.target).is('a') || $(e.target).is('i') || $(e.target).is('button')) {
                //ignore chevron and dropdownlinks
                return;
            }
            if ((e.type !== 'click') && (e.which !== 13)) { return; }
            var obj = this.model.get('data'),
                overlay = $('#io-ox-notifications-overlay'),
                sidepopup = overlay.prop('sidepopup'),
                lastFocus = e.target,
                cid = String(overlay.find('[data-cid]').data('cid'));
            // toggle?
            if (sidepopup && cid === _.cid(obj)) {
                sidepopup.close();
            } else {
                // fetch proper appointment first
                calAPI.get(obj).done(function (data) {
                    require(['io.ox/core/tk/dialogs', 'io.ox/calendar/view-detail'], function (dialogs, view) {
                        // open SidePopup without array
                        new dialogs.SidePopup({ arrow: false, side: 'right' })
                            .setTarget(overlay.empty())
                            .on('close', function () {
                                if (_.device('smartphone') && overlay.children().length > 0) {
                                    overlay.addClass('active');
                                } else if (_.device('smartphone')) {
                                    overlay.removeClass('active');
                                    $('[data-app-name="io.ox/portal"]').removeClass('notifications-open');
                                }
                                //restore focus
                                $(lastFocus).focus();
                            })
                            .show(e, function (popup) {
                                popup.append(view.draw(data));
                                if (_.device('smartphone')) {
                                    $('#io-ox-notifications').removeClass('active');
                                }
                            });
                    });
                });
            }
        },

        onClickAccept: function (e) {
            e.stopPropagation();
            var o = calAPI.reduce(this.model.get('data')),
                appointmentData = this.model.attributes;
                require(['io.ox/core/folder/api', 'settings!io.ox/calendar'], function (folderAPI, settings) {
                    folderAPI.get(o.folder).done(function (folder) {
                    o.data = {
                        alarm: parseInt(settings.get('defaultReminder', 15), 10), // default reminder
                        confirmmessage: '',
                        confirmation: 1
                    };
                    // add current user id in shared or public folder
                    if (folderAPI.is('shared', folder)) {
                        o.data.id = folder.created_by;
                    }
                    calAPI.checkConflicts(appointmentData).done(function (conflicts) {
                        if (conflicts.length === 0) {
                            calAPI.confirm(o);
                        } else {
                            ox.load(['io.ox/calendar/conflicts/conflictList', 'io.ox/core/tk/dialogs']).done(function (conflictView, dialogs) {
                                var dialog = new dialogs.ModalDialog()
                                    .header(conflictView.drawHeader());

                                dialog.append(conflictView.drawList(conflicts, dialog).addClass('additional-info'));
                                dialog.addDangerButton('ignore', gt('Ignore conflicts'), 'ignore', {tabIndex: '1'});

                                dialog.addButton('cancel', gt('Cancel'), 'cancel', {tabIndex: '1'})
                                    .show()
                                    .done(function (action) {
                                        if (action === 'cancel') {
                                            return;
                                        }
                                        if (action === 'ignore') {
                                            calAPI.confirm(o);
                                        }
                                    });
                            });
                        }
                    });
                });
            });
        },

        onClickChangeStatus: function (e) {
            // stopPropagation could be prevented by another markup structure
            e.stopPropagation();
            var self = this;
            require(['io.ox/calendar/acceptdeny']).done(function (acceptdeny) {
                acceptdeny(self.model.get('data')).done(function (status) {
                    debugger;
                    if (status !== 'cancel') {
                        self.collection.remove(self.model);
                    }
                });
            });
        }
    });

    var ReminderView = Backbone.View.extend({

        className: 'item',

        events: {
            'click': 'onClickItem',
            'keydown': 'onClickItem',
            'change [data-action="reminder"]': 'onClickReminder',
            'click [data-action="reminder"]': 'onClickReminder',
            'click [data-action="ok"]': 'onClickOk'
        },

        render: function () {
            var baton = ext.Baton({ model: this.model, view: this });
            ext.point('io.ox/core/notifications/reminder/item').invoke('draw', this.$el, baton);
            $('.dropdown-menu', this.$el).on('click', 'a', $.proxy(this.onClickReminder, this));
            return this;
        },

        onClickItem: function (e) {
            if ($(e.target).is('a') || $(e.target).is('i') || $(e.target).is('button')) {
                //ignore chevron and dropdownlinks
                return;
            }
            if ((e.type !== 'click') && (e.which !== 13)) { return; }
            var obj = this.model.get('remdata'),
                overlay = $('#io-ox-notifications-overlay'),
                sidepopup = overlay.prop('sidepopup'),
                lastFocus = e.target,
                cid = String(overlay.find('[data-cid]').data('cid'));
            obj = {id: obj.target_id, folder: obj.folder};
            // toggle?
            if (sidepopup && cid === _.cid(obj)) {
                sidepopup.close();
            } else {
                var data = this.model.get('caldata');
                require(['io.ox/core/tk/dialogs', 'io.ox/calendar/view-detail'], function (dialogs, view) {
                    // open SidePopup without array
                    new dialogs.SidePopup({ arrow: false, side: 'right' })
                        .setTarget(overlay.empty())
                        .on('close', function () {
                            if (_.device('smartphone') && overlay.children().length > 0) {
                                overlay.addClass('active');
                            } else if (_.device('smartphone')) {
                                overlay.removeClass('active');
                                $('[data-app-name="io.ox/portal"]').removeClass('notifications-open');
                            }
                            //restore focus
                            $(lastFocus).focus();
                        })
                        .show(e, function (popup) {
                            popup.append(view.draw(data));
                            if (_.device('smartphone')) {
                                $('#io-ox-notifications').removeClass('active');
                            }
                        });
                });
            }
        },

        onClickReminder: function (e) {
            e.stopPropagation();
            var self = this,
                min = $(e.target).data('value') || $(e.target).val(),
                reminder = self.model;
            if (min !== '0') {//0 means 'pick a time here' was selected. Do nothing.
                self.collection.remove(self.model);
                self.collection.hidden.push(self.model.get('cid'));
                setTimeout(function () {
                    //get updated data
                    calAPI.get(reminder.get('caldata')).done(function (calObj) {
                        if (!calObj.alarm) {//alarmtime was removed in the meantime, so no reminder to add
                            require(['io.ox/calendar/util'], function (util) {
                                self.collection.hidden = _.without(self.collection.hidden, reminder.get('cid'));
                                //fill in new data
                                reminder.set('caldata', calObj);
                                reminder.set('title', calObj.title);
                                reminder.set('location', calObj.location);
                                reminder.set('time', util.getTimeInterval(calObj));
                                self.collection.add(reminder);
                            });
                        }
                    });

                }, min * 60000);
            }
        },

        onClickOk: function (e) {
            // stopPropagation could be prevented by another markup structure
            e.stopPropagation();
            var self = this;
            reminderAPI.deleteReminder(self.model.get('remdata').id).done(function () {
                self.collection.remove(self.model);
            });
        }
    });

    var InviteNotificationsView = Backbone.View.extend({

        tagName: 'li',
        className: 'notifications',
        id: 'io-ox-notifications-calendar',

        events: {
            'keydown [data-action="clear"]': 'clearItems',
            'click [data-action="clear"]': 'clearItems'
        },

        render: function () {

            this.$el.empty();
            if (this.collection.length) {
                var baton = ext.Baton({ view: this });
                ext.point('io.ox/core/notifications/invites/header').invoke('draw', this.$el, baton);

                this.collection.each(function (model) {
                    this.$el.append(
                        new InviteView({ model: model, collection: this.collection }).render().$el
                    );
                }, this);
            }
            return this;
        },

        clearItems: function (e) {
            if ((e.type === 'keydown') && (e.which !== 13)) { return; }
            //hide all items from view
            this.collection.each(function (item) {
                hiddenCalInvitationItems[_.ecid(item.attributes.data)] = true;
            });
            this.collection.reset();
        }
    });

    var ReminderNotificationsView = Backbone.View.extend({

        tagName: 'li',
        className: 'notifications',
        id: 'io-ox-notifications-calendar-reminder',

        events: {
            'keydown [data-action="clear"]': 'clearItems',
            'click [data-action="clear"]': 'clearItems'
        },

        initialize: function () {
            this.collection.hidden = [];
        },

        render: function () {

            this.$el.empty();
            if (this.collection.length) {
                var baton = ext.Baton({ view: this });
                ext.point('io.ox/core/notifications/reminder/header').invoke('draw', this.$el, baton);

                this.collection.each(function (model) {
                    this.$el.append(
                        new ReminderView({ model: model, collection: this.collection }).render().$el
                    );
                }, this);
            }
            return this;
        },

        clearItems: function (e) {
            if ((e.type === 'keydown') && (e.which !== 13)) { return; }
            //hide all items from view
            this.collection.each(function (item) {
                hiddenCalReminderItems[_.ecid(item.attributes)] = true;
            });
            this.collection.reset();
        }
    });

    var hiddenCalInvitationItems = {},
        hiddenCalReminderItems = {};

    ext.point('io.ox/core/notifications/register').extend({
        id: 'appointmentReminder',
        index: 100,
        register: function (controller) {
            var ReminderNotifications = controller.get('io.ox/calendarreminder', ReminderNotificationsView);
            ReminderNotifications.collection.hidden = [];

            function removeReminders(e, reminders) {
                //make sure we have an array
                reminders = reminders ? [].concat(reminders) : [];
                _(reminders).each(function (reminder) {
                    for (var i = 0; ReminderNotifications.collection.length > i; i++) {
                        var model = ReminderNotifications.collection.models[i];
                        if (model.attributes.caldata.id === reminder.id && model.attributes.caldata.folder_id === (reminder.folder || reminder.folder_id)) {
                            ReminderNotifications.collection.remove(model);
                        }
                    }
                });
            }

            reminderAPI
                .on('remove:reminder', removeReminders)
                .on('add:calendar:reminder', function (e, reminder) {

                    var counter = reminder.length,
                        now = _.now();

                    _(reminder).each(function (remObj) {
                        //test if this invites are hidden
                        if (hiddenCalReminderItems[_.ecid(remObj)]) {
                            counter--;

                            if (counter === 0) {
                                //all data processed. Update Collection
                                ReminderNotifications.collection.trigger('add');
                            }
                        } else {
                            var obj = {
                                id: remObj.target_id,
                                folder: remObj.folder,
                                recurrence_position: remObj.recurrence_position
                            };
                            calAPI.get(obj).done(function (data) {
                                require(['io.ox/calendar/util'], function (util) {

                                    var inObj = {
                                        cid: _.cid(remObj),
                                        title: data.title,
                                        location: data.location,
                                        time: util.getTimeInterval(data),
                                        date: util.getDateInterval(data),
                                        remdata: remObj,
                                        caldata: data
                                    };

                                    // ignore appointments that are over
                                    var isOver = data.end_date < now;

                                    if (!isOver) {
                                        _(ReminderNotifications.collection.models).each(function (reminderModel) {//remove outdated versions of the model
                                            if (reminderModel.get('cid') === inObj.cid) {
                                                ReminderNotifications.collection.remove(reminderModel);
                                            }
                                        });

                                        // do not add user suppressed ('remind me later') reminders
                                        if (ReminderNotifications.collection.hidden.length === 0 || _.indexOf(ReminderNotifications.collection.hidden, _.cid(remObj)) === -1) {
                                            ReminderNotifications.collection.add(new Backbone.Model(inObj));
                                        }
                                    }

                                    counter--;

                                    if (counter === 0) {
                                        //all data processed. Update Collection
                                        ReminderNotifications.collection.trigger('add');
                                    }
                                });
                            });
                        }
                    });
                });
            calAPI.on('delete:appointment', removeReminders)
                  .on('delete:appointment', function () {
                        reminderAPI.getReminders();
                    })
                  .on('mark:invite:confirmed', function (e, obj) {
                        if (obj.data.confirmation === 2) {//remove reminders for declined appointments
                            removeReminders(e, obj);
                        }
                    });
            reminderAPI.getReminders();
        }
    });

    ext.point('io.ox/core/notifications/register').extend({
        id: 'appointmentInvitations',
        index: 300,
        register: function (controller) {
            var InviteNotifications = controller.get('io.ox/calendar', InviteNotificationsView);

            calAPI
                .on('new-invites', function (e, invites) {
                    var tmp = [];
                    if (invites.length > 0) {
                        require(['io.ox/calendar/util', 'io.ox/core/api/user'], function (util, userAPI) {
                            $.when.apply($,
                                _(invites).map(function (invite) {
                                    //test if this invites are hidden
                                    if (hiddenCalInvitationItems[_.ecid(invite)]) {
                                        return undefined;
                                    }
                                    var inObj = {
                                        cid: _.cid(invite),
                                        title: invite.title,
                                        location: invite.location || '',
                                        date: util.getDateInterval(invite),
                                        time: util.getTimeInterval(invite),
                                        data: invite
                                    };
                                    // TODO: ignore organizerId until we know better
                                    var def = $.Deferred();
                                    userAPI.get({ id: invite.organizerId || invite.created_by })
                                        .done(function (user) {
                                            inObj.organizer = user.display_name;
                                            tmp.push(inObj);
                                            def.resolve();
                                        })
                                        .fail(function () {
                                            // no organizer
                                            inObj.organizer = invite.organizer || false;
                                            tmp.push(inObj);
                                            def.resolve();
                                        });
                                    return def;
                                })
                            )
                            .done(function () {
                                InviteNotifications.collection.reset(tmp);
                            });
                        });
                    } else {
                        InviteNotifications.collection.reset(tmp);
                    }

                })
                .on('mark:invite:confirmed', removeInvites)
                .on('delete:appointment', removeInvites)
                .getInvites();

            function removeInvites(e, invites) {
              //make sure we have an array
                invites = invites ? [].concat(invites) : [];
                _(invites).each(function (invite) {
                    for (var i = 0; InviteNotifications.collection.length > i; i++) {
                        var model = InviteNotifications.collection.models[i];
                        if (model.attributes.data.id === invite.id && model.attributes.data.folder_id === (invite.folder || invite.folder_id)) {
                            InviteNotifications.collection.remove(model);
                        }
                    }
                });
            }
        }
    });

    return true;
});
