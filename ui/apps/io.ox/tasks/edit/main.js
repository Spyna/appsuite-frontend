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
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */

define("io.ox/tasks/edit/main", ['gettext!io.ox/tasks',
                                 'io.ox/core/extensions',
                                 'io.ox/tasks/model',
                                 'io.ox/tasks/edit/view',
                                 'less!io.ox/tasks/edit/style.css'],
                                 function (gt, ext, model, view) {

    "use strict";

    function createApp() {
        // application object
        var app = ox.ui.createApp({ name: 'io.ox/tasks/edit', title: "Edit task" }),
            // app window
            win,
            //app
            self,
            //headline
            headline,
            //state
            taskState,
            //Model View
            taskModel,
            taskView;

        //edit or new
        app.edit = false;

        app.STATES = {
            'CLEAN': 1,
            'DIRTY': 2
        };
        app.getState = function () {
            return taskState;
        };

        app.markDirty = function () {
            taskState = app.STATES.DIRTY;
        };

        app.markClean = function () {
            taskState = app.STATES.CLEAN;
        };

        // launcher
        app.setLauncher(function (taskData) {
            self = this;
            self.markDirty();
            // get window
            win = ox.ui.createWindow({
                name: 'io.ox/tasks/edit',
                title: gt("Edit task"),
                toolbar: false,
                close: true
            });

            win.addClass('io-ox-tasks-edit-main');
            app.setWindow(win);
            win.nodes.main.addClass("scrollable");
            //ModelView
            if (taskData) {
                this.edit = true;
                model.factory.realm('edit').retain().get(taskData).done(function (task) {
                    taskModel = task;
                    taskModel.getParticipants();
                    taskView = view.getView(taskModel, win.nodes.main, app);
                });
            } else {
                taskModel = model.factory.create();
                taskView = view.getView(taskModel, win.nodes.main, app);
            }
            
            win.on('show', function () {
                if (taskView) {
                    taskView.dropZone.include();
                }
            });

            win.on('hide', function () {
                if (taskView) {
                    taskView.dropZone.remove();
                }
            });
            //ready for show
            win.show();
        });
        
        // Popup on close
        app.setQuit(function () {
            var def = $.Deferred();
            var clean = function () {
                // clear private vars
                taskView.trigger('dispose');
                app = win = taskModel = taskView = null;
            };

            if (app.getState() === app.STATES.DIRTY) {
                require(["io.ox/core/tk/dialogs"], function (dialogs) {
                    new dialogs.ModalDialog()
                        .text(gt("Do you really want to discard your changes?"))
                        .addPrimaryButton("delete", gt('Discard changes'))
                        .addButton("cancel", gt('Cancel'))
                        .show()
                        .done(function (action) {
                            if (action === 'delete') {
                                clean(); // clean before resolve, otherwise tinymce gets half-destroyed (ugly timing)
                                def.resolve();
                            } else {
                                def.reject();
                            }
                        });
                });
            } else {
                if (app.edit) {
                    require(['io.ox/tasks/api'], function (api) {
                        api.trigger("update:" + taskModel.attributes.folder_id + '.' + taskModel.attributes.id);
                        clean();
                        def.resolve();
                    });
                } else {
                    clean();
                    def.resolve();
                }
            }

            return def;
        });
        return app;
    }

    return {
        getApp: createApp
    };
});
