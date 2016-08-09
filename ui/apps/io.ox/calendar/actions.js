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

define('io.ox/calendar/actions', [
    'io.ox/core/extensions',
    'io.ox/core/extPatterns/links',
    'io.ox/calendar/api',
    'io.ox/calendar/util',
    'io.ox/core/extPatterns/actions',
    'io.ox/core/print',
    'gettext!io.ox/calendar'
], function (ext, links, api, util, actions, print, gt) {

    'use strict';

    var Action = links.Action;

    // Actions
    new Action('io.ox/calendar/actions/switch-to-list-view', {
        requires: true,
        action: function (baton) {
            ox.ui.Perspective.show(baton.app, 'list');
        }
    });

    new Action('io.ox/calendar/actions/switch-to-month-view', {
        requires: function () {
            return true;
        },
        action: function (baton) {
            ox.ui.Perspective.show(baton.app, 'month');
        }
    });

    new Action('io.ox/calendar/actions/switch-to-fullweek-view', {
        requires: function () {
            return _.device('!smartphone');
        },
        action: function (baton) {
            ox.ui.Perspective.show(baton.app, 'week:week');
        }
    });

    new Action('io.ox/calendar/actions/switch-to-week-view', {
        requires: function () {
            return _.device('!smartphone');
        },
        action: function (baton) {
            ox.ui.Perspective.show(baton.app, 'week:workweek');
        }
    });

    new Action('io.ox/calendar/actions/switch-to-day-view', {
        requires: true,
        action: function (baton) {
            ox.ui.Perspective.show(baton.app, 'week:day');
        }
    });

    new Action('io.ox/calendar/detail/actions/sendmail', {
        capabilities: 'webmail',
        action: function (baton) {
            util.resolveParticipants(baton.data).done(function (recipients) {
                recipients = _(recipients)
                    .chain()
                    .filter(function (rec) {
                        // don't add myself
                        // don't add if mail address is missing (yep, edge-case)
                        return rec.id !== ox.user_id && !!rec.mail;
                    })
                    .map(function (rec) {
                        return [rec.display_name, rec.mail];
                    })
                    .value();
                ox.registry.call('mail-compose', 'compose', { to: recipients, subject: baton.data.title });
            });
        }
    });

    new Action('io.ox/calendar/detail/actions/invite', {
        capabilities: 'calendar',
        action: function (baton) {
            ox.load(['io.ox/calendar/actions/invite']).done(function (action) {
                action(baton);
            });
        }
    });

    new Action('io.ox/calendar/detail/actions/save-as-distlist', {
        capabilities: 'contacts',
        action: function (baton) {
            util.resolveParticipants(baton.data).done(function (distlist) {
                ox.load(['io.ox/contacts/distrib/main', 'settings!io.ox/core']).done(function (m, coreSettings) {
                    m.getApp().launch().done(function () {
                        this.create(coreSettings.get('folder/contacts'), { distribution_list: distlist });
                        // trigger an empty remove just to get rid of unnecessary values in contacts
                        if (!_.isEmpty(distlist)) this.view.baton.member.trigger('remove', {}, this.view.baton.member);
                    });
                });
            });
        }
    });

    new Action('io.ox/calendar/detail/actions/edit', {
        requires: function (e) {
            var exists = e.baton && e.baton.data ? e.baton.data.id !== undefined : true,
                allowed = e.collection.has('one', 'modify');
            if (allowed) {
                // if you have no permission to edit you don't have a folder id (see calendar/freebusy response)
                if (!e.baton.data.folder_id) {
                    // you need to have a folder id to edit
                    allowed = false;
                }
            }
            return util.isBossyAppointmentHandling({ app: e.baton.data }).then(function (isBossy) {
                return allowed && exists && isBossy;
            });
        },
        action: function (baton) {
            ox.load(['io.ox/calendar/actions/edit']).done(function (action) {
                action(baton);
            });
        }
    });

    new Action('io.ox/calendar/detail/actions/delete', {
        requires: function (e) {
            return util.isBossyAppointmentHandling({ app: e.baton.data }).then(function (isBossy) {
                return e.collection.has('delete') && isBossy;
            });
        },
        multiple: function (list) {
            ox.load(['io.ox/calendar/actions/delete']).done(function (action) {
                action(list);
            });
        }
    });

    new Action('io.ox/calendar/detail/actions/create', {
        requires: function (e) {
            return e.baton.app.folder.can('create');
        },
        action: function (baton, obj) {
            ox.load(['io.ox/calendar/actions/create']).done(function (action) {
                action(baton, obj);
            });
        }
    });

    new Action('io.ox/calendar/detail/actions/changestatus', {
        requires: function (e) {

            function cont(app) {
                return util.isBossyAppointmentHandling({ app: e.baton.data, invert: true }).then(function (isBossy) {
                    var iamUser = false;
                    if (app.users) {
                        for (var i = 0; i < app.users.length; i++) {
                            if (app.users[i].id === ox.user_id) {
                                iamUser = true;
                            }
                        }
                    }
                    return e.collection.has('one') && iamUser && isBossy;
                });
            }

            var app = e.baton.data;
            // incomplete
            if (app.id && !app.users) {
                return api.get(app).then(cont);
            }
            return cont(app);
        },
        action: function (baton) {
            // load & call
            ox.load(['io.ox/calendar/actions/acceptdeny']).done(function (action) {
                action(baton.data);
            });
        }
    });

    new Action('io.ox/calendar/detail/actions/follow-up', {
        requires: function (e) {
            return e.collection.has('create', 'read');
        },
        action: function (baton) {
            // load & call
            ox.load(['io.ox/calendar/actions/follow-up']).done(function (action) {
                action(baton.data);
            });
        }
    });

    new Action('io.ox/calendar/detail/actions/print-appointment', {
        capabilities: 'calendar-printing',
        requires: function (e) {
            return e.collection.has('some', 'read') && _.device('!smartphone');
        },
        multiple: function (list) {
            if (list.length > 1) {
                require(['io.ox/core/tk/dialogs'], function (dialogs) {
                    var dialog = new dialogs.ModalDialog()
                        .append($('<h4>').text(gt('Do you want the appointments printed in detail or as a compact list?')));

                    //#. answer Button to 'Do you want the appointments printed in detail or as a compact list?'
                    dialog.addPrimaryButton('detailed', gt('Detailed'), 'detailed');
                    //#. answer Button to 'Do you want the appointments printed in detail or as a compact list?'
                    dialog.addButton('compact', gt('Compact'), 'compact');

                    dialog.addButton('cancel', gt('Cancel'), 'cancel')
                        .show()
                        .done(function (action) {
                            if (action === 'detailed') {
                                print.request('io.ox/calendar/print', list);
                            } else if (action === 'compact') {
                                print.request('io.ox/calendar/print-compact', list);
                            }
                        });
                });
                return;
            }
            print.request('io.ox/calendar/print', list);
        }
    });

    new Action('io.ox/calendar/detail/actions/print-appointment-disabled', {
        requires: 'one',
        capabilities: 'calendar-printing',
        action: function (baton) {
            var options = { template: 'print.appointment.tmpl' },
                POS = 'recurrence_position';
            if (baton.data[POS]) options[POS] = baton.data[POS];
            print.open('calendar', baton.data, options);
        }
    });

    new Action('io.ox/calendar/detail/actions/print', {
        capabilities: 'calendar-printing',
        requires: function (e) {
            var win = e.baton.window;
            if (_.device('!smartphone') && win && win.getPerspective) {
                var pers = win.getPerspective();
                return pers && pers.print;
            }
            return false;
        },
        action: function (baton) {
            var win = baton.app.getWindow(),
                pers = win.getPerspective();
            if (pers.print) {
                pers.print();
            }
        }
    });

    new Action('io.ox/calendar/detail/actions/move', {
        requires: function (e) {
            return util.isBossyAppointmentHandling({ app: e.baton.data }).then(function (isBossy) {
                var isSeries = e.baton.data.recurrence_type > 0;
                return e.collection.has('some', 'delete') && isBossy && !isSeries;
            });
        },
        multiple: function (list, baton) {

            var vgrid = baton.grid || (baton.app && baton.app.getGrid());

            ox.load(['io.ox/core/folder/actions/move', 'settings!io.ox/calendar']).done(function (move, settings) {
                move.item({
                    api: api,
                    button: gt('Move'),
                    filter: function (id, model) {
                        return model.id !== 'virtual/all-my-appointments';
                    },
                    flat: true,
                    indent: false,
                    list: list,
                    module: 'calendar',
                    root: '1',
                    settings: settings,
                    success: {
                        single: 'Appointment has been moved',
                        multiple: 'Appointments have been moved'
                    },
                    target: baton.target,
                    title: gt('Move'),
                    type: 'move',
                    vgrid: vgrid
                });
            });
        }
    });

    new Action('io.ox/calendar/actions/today', {
        requires: function (baton) {
            var p = baton.baton.app.getWindow().getPerspective();

            return !!p && (p.name === 'month' || p.name === 'week');
        },
        action: function (baton) {
            var p = baton.app.getWindow().getPerspective();

            if (p.view && p.view.setStartDate) {
                p.view.setStartDate();
                p.view.trigger('onRefresh');
            } else if (p.gotoMonth) {
                p.gotoMonth('today');
            }
        }
    });

    /*new Action('io.ox/calendar/actions/freebusy', {
        capabilities: 'freebusy !alone !guest',
        requires: function () {
            return _.device('!smartphone');
        },
        action: function (baton) {
            require(['io.ox/calendar/freetime/main'], function (freetime) {
                var perspective = baton.app.getWindow().getPerspective(),
                    now = _.now(),
                    startDate = perspective && perspective.name !== 'month' && perspective.getStartDate ? perspective.getStartDate() : now,
                    layout = perspective ? perspective.app.props.get('layout') : '';

                // see if the current day is in the displayed week.
                if (startDate < now && layout.indexOf('week:') === 0) {
                    // calculate end of week/workweek
                    var max = startDate + 86400000 * (layout === 'week:workweek' ? 5 : 7);
                    if (now < max) {
                        startDate = now;
                    }
                }

                freetime.showDialog({ startDate: startDate, participants: [{ id: ox.user_id, type: 1 }] }).done(function (data) {
                    var view = data.view;
                    data.dialog.on('save', function () {
                        var appointment = view.createAppointment();

                        if (appointment) {
                            data.dialog.close();
                            appointment.folder = baton.app.folder.get();
                            ox.load(['io.ox/calendar/edit/main']).done(function (edit) {
                                edit.getApp().launch().done(function () {
                                    this.create(appointment);
                                });
                            });
                        } else {
                            data.dialog.idle();
                            require(['io.ox/core/yell'], function (yell) {
                                yell('info', gt('Please select a time for the appointment'));
                            });
                        }
                    });
                });
            });
        }
    });*/

    new Action('io.ox/calendar/actions/freebusy', {
        capabilities: 'freebusy !alone !guest',
        requires: function () {
            return _.device('!smartphone');
        },
        action: function (baton) {
            var perspective = baton.app.getWindow().getPerspective(),
                start_date = perspective && perspective.getStartDate ? perspective.getStartDate() : _.now();
            ox.launch('io.ox/calendar/freebusy/main', {
                baton: baton,
                folder: baton.app.folder.get(),
                participants: [{ id: ox.user_id, type: 1 }],
                start_date: start_date
            });
        }
    });

    // Actions mobile
    new Action('io.ox/calendar/actions/dayview/showNext', {
        requires: true,
        action: function (baton) {
            var p = baton.app.getWindow().getPerspective();
            if (!p) return;
            p.view.setStartDate('next');
            p.view.trigger('onRefresh');
        }
    });

    new Action('io.ox/calendar/actions/dayview/showPrevious', {
        requires: true,
        action: function (baton) {
            var p = baton.app.getWindow().getPerspective();
            if (!p) return;
            p.view.setStartDate('prev');
            p.view.trigger('onRefresh');
        }
    });

    new Action('io.ox/calendar/actions/dayview/showToday', {
        requires: true,
        action: function (baton) {
            var p = baton.app.getWindow().getPerspective();
            if (!p) return;
            p.view.setStartDate();
            p.view.trigger('onRefresh');
        }
    });

    new Action('io.ox/calendar/actions/month/showToday', {
        requires: true,
        action: function (baton) {
            var p = baton.app.getWindow().getPerspective();
            if (!p) return;
            p.gotoMonth('today');
        }
    });

    new Action('io.ox/calendar/premium/actions/share', {
        capabilities: 'caldav client-onboarding',
        requires: function () {
            return _.device('!smartphone');
        },
        action: function () {
            require(['io.ox/onboarding/clients/wizard'], function (wizard) {
                wizard.run();
            });
        }
    });

    // Mobile multi select extension points
    // delete appointment(s)
    ext.point('io.ox/calendar/mobileMultiSelect/toolbar').extend({
        id: 'delete',
        index: 10,
        draw: function (data) {
            var baton = new ext.Baton({ data: data.data });
            $(this).append($('<div class="toolbar-button">')
                .append($('<a href="#">')
                    .append(
                        $('<i class="fa fa-trash-o" aria-hidden="true">')
                            .on('click', { grid: data.grid }, function (e) {
                                e.preventDefault();
                                e.stopPropagation();
                                actions.invoke('io.ox/calendar/detail/actions/delete', null, baton);
                                e.data.grid.selection.clear();
                            })
                    )
                )
            );
        }
    });

    // move appointment(s)
    ext.point('io.ox/calendar/mobileMultiSelect/toolbar').extend({
        id: 'move',
        index: 20,
        draw: function (data) {
            var baton = new ext.Baton({ data: data.data });
            $(this).append($('<div class="toolbar-button">')
                .append($('<a href="#">')
                    .append(
                        $('<i class="fa fa-sign-in" aria-hidden="true">')
                            .on('click', { grid: data.grid }, function (e) {
                                e.preventDefault();
                                e.stopPropagation();
                                actions.invoke('io.ox/calendar/detail/actions/move', null, baton);
                                // need to clear the selection after aciton is invoked
                                e.data.grid.selection.clear();
                            })
                    )
                )
            );
        }
    });

    // FIXME: should only be visible if rights are ok
    ext.point('io.ox/calendar/detail/actions').extend(new links.InlineLinks({
        index: 100,
        id: 'inline-links',
        ref: 'io.ox/calendar/links/inline'
    }));

    ext.point('io.ox/calendar/links/inline').extend(new links.Link({
        index: 100,
        prio: 'hi',
        mobile: 'lo',
        id: 'edit',
        label: gt('Edit'),
        ref: 'io.ox/calendar/detail/actions/edit'
    }));

    ext.point('io.ox/calendar/links/inline').extend(new links.Link({
        index: 200,
        prio: 'hi',
        mobile: 'hi',
        id: 'changestatus',
        label: gt('Change status'),
        ref: 'io.ox/calendar/detail/actions/changestatus'
    }));

    ext.point('io.ox/calendar/links/inline').extend(new links.Link({
        index: 300,
        prio: 'hi',
        mobile: 'lo',
        id: 'follow-up',
        //#. Calendar: Create follow-up appointment. Maybe "Folgetermin" in German.
        label: gt('Follow-up'),
        ref: 'io.ox/calendar/detail/actions/follow-up'
    }));

    ext.point('io.ox/calendar/links/inline').extend(new links.Link({
        index: 400,
        prio: 'hi',
        mobile: 'lo',
        id: 'delete',
        label: gt('Delete'),
        ref: 'io.ox/calendar/detail/actions/delete'
    }));

    ext.point('io.ox/calendar/links/inline').extend(new links.Link({
        index: 500,
        prio: 'lo',
        mobile: 'lo',
        id: 'move',
        label: gt('Move'),
        drawDisabled: true,
        ref: 'io.ox/calendar/detail/actions/move'
    }));

    ext.point('io.ox/calendar/links/inline').extend(new links.Link({
        index: 600,
        prio: 'lo',
        id: 'print',
        label: gt('Print'),
        ref: 'io.ox/calendar/detail/actions/print-appointment'
    }));

    ext.point('io.ox/calendar/detail/actions-participantrelated').extend(new links.InlineLinks({
        index: 100,
        id: 'inline-links-participant',
        ref: 'io.ox/calendar/links/inline-participants',
        classes: 'io-ox-inline-links embedded'
    }));

    ext.point('io.ox/calendar/links/inline-participants').extend(new links.Link({
        index: 100,
        prio: 'hi',
        mobile: 'lo',
        id: 'send mail',
        label: gt('Send mail to all participants'),
        ref: 'io.ox/calendar/detail/actions/sendmail'
    }));

    ext.point('io.ox/calendar/links/inline-participants').extend(new links.Link({
        index: 200,
        prio: 'hi',
        mobile: 'lo',
        id: 'invite',
        label: gt('Invite to new appointment'),
        ref: 'io.ox/calendar/detail/actions/invite'
    }));

    ext.point('io.ox/calendar/links/inline-participants').extend(new links.Link({
        index: 300,
        prio: 'hi',
        mobile: 'lo',
        id: 'save as distlist',
        label: gt('Save as distribution list'),
        ref: 'io.ox/calendar/detail/actions/save-as-distlist'
    }));

    ext.point('io.ox/calendar/folderview/premium-area').extend(new links.InlineLinks({
        index: 100,
        id: 'inline-premium-links',
        ref: 'io.ox/calendar/links/premium-links',
        classes: 'list-unstyled'
    }));

    ext.point('io.ox/calendar/links/premium-links').extend(new links.Link({
        index: 100,
        prio: 'hi',
        id: 'share-calendar',
        label: gt('Synchronize calendar'),
        ref: 'io.ox/calendar/premium/actions/share'
    }));
});
