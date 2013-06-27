/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2011
 * Mail: info@open-xchange.com
 *
 * @author Mario Scheliga <mario.scheliga@open-xchange.com>
 */

define('io.ox/calendar/edit/main',
      ['io.ox/calendar/model',
       'io.ox/calendar/api',
       'io.ox/core/extPatterns/dnd',
       'io.ox/calendar/edit/view-main',
       'io.ox/core/notifications',
       'gettext!io.ox/calendar/edit/main',
       'settings!io.ox/calendar',
       'less!io.ox/calendar/edit/style.less'], function (appointmentModel, api, dnd, MainView, notifications, gt, settings) {

    'use strict';

    function createInstance() {

        var app = ox.ui.createApp({name: 'io.ox/calendar/edit', title: 'Edit Appointment', userContent: true }),

        controller = _.extend(app, {

            start: function () {
                if (_.browser.IE === undefined || _.browser.IE > 9) {
                    this.dropZone = new dnd.UploadZone({
                        ref: "io.ox/calendar/edit/dnd/actions"
                    }, this);
                }

                var state = this.getState();

                if ('folder' in state && 'id' in state) {
                    return api.get({ folder: state.folder, id: state.id }).done(function (data) {
                        this.edit(data);
                    });
                }
            },

            stop: function () {
                var self = this,
                    df = new $.Deferred();

                //be gently
                if (self.getDirtyStatus()) {
                    require(['io.ox/core/tk/dialogs'], function (dialogs) {
                        new dialogs.ModalDialog()
                            .text(gt("Do you really want to discard your changes?"))
                            .addPrimaryButton('delete', gt('Discard'))
                            .addButton('cancel', gt('Cancel'))
                            .show()
                            .done(function (action) {
                                if (action === 'delete') {
                                    self.dispose();
                                    df.resolve();
                                } else {
                                    df.reject();
                                }
                            });
                    });
                } else {
                    //just let it go
                    self.dispose();
                    df.resolve();
                }
                return df;
            },
            /*
            * should cleanly remove every outbounding reference
            * of all objects created. this could be a awkward task
            * but better for longtime perf. IE still has a hu
            * :(
            */
            dispose: function () {
                this.view.off('save', _.bind(this.onSave, this));
                this.model.off('change:title');
            },

            // published via calllbacks objects in baton (see below)
            // baton makes its journey through all extensions
            // description field (resource only) uses this function to
            // offer "Copy to description"; the click event lands here
            extendDescription: function (e) {
                // we simply have to look for the textarea
                // this whole thing could be solved differently (more local)
                // but I had no clue how to hook into the
                // 'new forms.InputField({...})' stuff in template.js
                e.preventDefault();
                var textarea = app.view.$el.find('textarea.note');
                textarea.val(textarea.val() + e.data.description);
                notifications.yell('success', gt('Description has been copied'));
            },

            edit: function (data, options) {

                app.cid = 'io.ox/calendar:edit.' + _.cid(data);

                var self = this;
                options = _.extend({}, options);

                function cont(data) {
                    app.model = self.model = appointmentModel.factory.create(data);
                    appointmentModel.applyAutoLengthMagic(self.model);
                    appointmentModel.fullTimeChangeBindings(self.model);
                    appointmentModel.setDefaultParticipants(self.model, {create: false}).done(function () {

                        var baton = { model: self.model, mode: data.id ? 'edit' : 'create', app: self, callbacks: {} };
                        baton.callbacks.extendDescription = app.extendDescription;
                        app.view = self.view = new MainView(baton);

                        //window.busy breaks oldschool upload, iframe needs to be enabled until all files are uploaded
                        if (_.browser.IE === undefined || _.browser.IE > 9) {
                            self.model.on('create:start update:start', function () {
                                self.getWindow().busy();
                            });
                        }

                        self.model.on('backendError', function (response) {
                            try {
                                self.getWindow().idle();
                            } catch (e) {
                                if (response.code === 'UPL-0005') {//uploadsize to big
                                    api.removeFromUploadList(encodeURIComponent(_.cid(this.attributes)));//remove busy animation
                                }
                                notifications.yell('error', response.error);
                            }
                        });

                        self.setTitle(gt('Edit appointment'));

                        // create app window
                        var win = ox.ui.createWindow({
                            name: 'io.ox/calendar/edit',
                            chromeless: true
                        });

                        self.setWindow(win);
                        if (app.dropZone) {
                            win.on('show', function () {
                                app.dropZone.include();
                            });

                            win.on('hide', function () {
                                app.dropZone.remove();
                            });
                        }
                        if (options.action === 'appointment') {
                            // ensure to create a change exception
                            self.model.touch('recurrence_position');
                            self.model.set('recurrence_type', 0, {validate: true});
                        }

                        if (options.action === 'series') {

                            // fields for recurrences
                            var fields = ['recurrence_date_position',
                                'change_exceptions',
                                'delete_exceptions',
                                'recurrence_type',
                                'days',
                                'day_in_month',
                                'month',
                                'interval',
                                'until',
                                'occurrences'];
                            var x = 0;
                            // ensure theses fields will be send to backend to edit the whole series
                            for (; x < fields.length; x++) {
                                self.model.touch(fields[x]);
                            }

                        }
                        // init alarm
                        if (!self.model.get('alarm')) {
                            self.model.set('alarm', -1, {silent: true, validate: true});
                        }

                        self.considerSaved = true;
                        self.model.on('change', function () {
                            self.considerSaved = false;
                        });
                        $(self.getWindow().nodes.main[0]).append(self.view.render().el);
                        self.getWindow().show(_.bind(self.onShowWindow, self));
                    });
                }

                if (data) {
                    // hash support
                    self.setState({ folder: data.folder_id, id: data.id });
                    cont(data);
                }
            },

            considerSaved: false,

            create: function (data) {
                var self = this,
                    data = data || {};

                function cont(data) {
                    app.model = self.model = appointmentModel.factory.create(data);
                    appointmentModel.applyAutoLengthMagic(self.model);
                    appointmentModel.fullTimeChangeBindings(self.model);
                    appointmentModel.setDefaultParticipants(self.model, { create: true }).done(function () {

                        var baton = { model: self.model, app: self, callbacks: {} };
                        baton.callbacks.extendDescription = app.extendDescription;
                        app.view = self.view = new MainView(baton);

                        //window.busy breaks oldschool upload, iframe needs to be enabled until all files are uploaded
                        if (_.browser.IE === undefined || _.browser.IE > 9) {
                            self.model.on('create:start update:start', function () {
                                self.getWindow().busy();
                            });
                        }

                        self.model.on('backendError', function (response) {
                            try {
                                self.getWindow().idle();
                            } catch (e) {
                                if (response.code === 'UPL-0005') {//uploadsize to big
                                    api.removeFromUploadList(encodeURIComponent(_.cid(this.attributes)));//remove busy animation
                                }
                                notifications.yell('error', response.error);
                            }
                        });

                        self.setTitle(gt('Create appointment'));

                        // create app window
                        var win = ox.ui.createWindow({
                            name: 'io.ox/calendar/edit',
                            title: 'Create Appointment',
                            chromeless: true
                        });

                        self.setWindow(win);

                        if (app.dropZone) {
                            win.on('show', function () {
                                app.dropZone.include();
                            });

                            win.on('hide', function () {
                                app.dropZone.remove();
                            });
                        }

                        self.model.set('alarm', settings.get('defaultReminder', 15), {validate: true});
                        if (self.model.get('full_time') === true) {
                            self.model.set('shown_as', settings.get('markFulltimeAppointmentsAsFree', false) ? 4 : 1, {validate: true});
                        }
                        self.considerSaved = true;
                        self.model.on('change', function () {
                            self.considerSaved = false;
                        });

                        $(self.getWindow().nodes.main[0]).append(self.view.render().el);
                        self.getWindow().show(_.bind(self.onShowWindow, self));
                    });
                }

                if (!data.folder_id) {
                    require(['io.ox/core/api/folder']).done(function (api) {
                        data.folder_id = api.getDefaultFolder('calendar');
                        cont(data);
                    });
                } else {
                    cont(data);
                }
            },

            getDirtyStatus : function () {
                if (this.considerSaved) {
                    return false;
                }
                return !_.isEmpty(this.model.changedSinceLoading());
            },

            onShowWindow: function () {
                var self = this;
                if (self.model.get('title')) {
                    self.getWindow().setTitle(self.model.get('title'));
                    self.setTitle(self.model.get('title'));
                }
                self.model.on('change:title', function (model, value, source) {
                    self.getWindow().setTitle(value);
                    self.setTitle(value);
                });
                $(self.getWindow().nodes.main).find('input')[0].focus(); // focus first input element
                $(self.getWindow().nodes.main[0]).addClass('scrollable'); // make window scrollable
            },

            onSave: function () {
                this.considerSaved = true;
                this.getWindow().idle();
                this.quit();
            },

            failSave: function () {
                if (this.model) {
                    var title = this.model.get('title');
                    return {
                        description: gt('Appointment') + (title ? ': ' + title : ''),
                        module: 'io.ox/calendar/edit',
                        point: this.model.attributes
                    };
                }
                return false;
            },

            failRestore: function (point) {
                var df = $.Deferred();
                if (_.isUndefined(point.id)) {
                    this.create(point);
                } else {
                    this.edit(point);
                }
                df.resolve();
                return df;
            }
        });

        controller.setLauncher(_.bind(controller.start, controller));
        controller.setQuit(_.bind(controller.stop, controller));
        return controller;
    }

    return {

        getApp: createInstance,

        reuse: function (type, data) {
            if (type === 'edit') {
                return ox.ui.App.reuse('io.ox/calendar:edit.' + _.cid(data));
            }
        }
    };
});
