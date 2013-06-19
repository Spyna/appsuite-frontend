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
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

define('io.ox/calendar/edit/template',
    ['io.ox/core/extensions',
     'gettext!io.ox/calendar/edit/main',
     'io.ox/calendar/util',
     'io.ox/core/date',
     'io.ox/backbone/views',
     'io.ox/backbone/forms',
     'io.ox/core/tk/attachments',
     'io.ox/calendar/edit/recurrence-view',
     'io.ox/calendar/api',
     'io.ox/participants/views',
     'io.ox/core/capabilities'
    ], function (ext, gt, util, dateAPI, views, forms, attachments, RecurrenceView, api, pViews, capabilities) {

    'use strict';

    var point = views.point('io.ox/calendar/edit/section');

    // subpoint for conflicts
    var pointConflicts = point.createSubpoint('conflicts', {
        index: 120,
        id: 'conflicts',
        className: 'additional-info'
    });

    ext.point('io.ox/calendar/edit/section/header').extend({
        draw: function (baton) {
            var row = $('<div class="row-fluid header">');
            ext.point('io.ox/calendar/edit/section/title').invoke('draw', row, baton);
            ext.point('io.ox/calendar/edit/section/buttons').invoke('draw', row, baton);
            this.append(row);
        }
    });

    // pane title and button area
    ext.point('io.ox/calendar/edit/section/title').extend({
        index: 100,
        id: 'title',
        draw: function (baton) {
            this.append($('<h1>').addClass('clear-title title').text(gt(baton.mode === 'edit' ? 'Edit appointment' : 'Create appointment')));
        }
    });

    // buttons
    var saveButton, discardButton;
    ext.point('io.ox/calendar/edit/section/buttons').extend({
        index: 100,
        id: 'buttons',
        draw: function (baton) {
            var save, discard;
            this.append(saveButton = $('<button class="btn btn-primary" data-action="save" >')
                .text(baton.mode === 'edit' ? gt("Save") : gt("Create"))
                .css({float: 'right', marginLeft: '13px'})
                .on('click', function () {
                    //check if attachments are changed
                    if (baton.attachmentList.attachmentsToDelete.length > 0 || baton.attachmentList.attachmentsToAdd.length > 0) {
                        baton.model.attributes.tempAttachmentIndicator = true;//temporary indicator so the api knows that attachments needs to be handled even if nothing else changes
                    }
                    baton.model.save().done(function () {
                        baton.app.onSave();
                    });
                })
            );
            this.append(discardButton = $('<button class="btn" data-action="discard" >')
                .text(gt("Discard"))
                .css({float: _.device('small') ? 'left' : 'right'})
                .on('click', function () {
                    baton.app.quit();
                })
            );
        }
    });

    // conflicts
    pointConflicts.extend({
        index: 100,
        id: 'io.ox/calendar/edit/conflicts/main',
        tagName: 'div',
        modelEvents: {
            'conflicts': 'showConflicts'
        },
        showConflicts: function (conflicts) {

            var self = this,
                hardConflict = false;

            saveButton.hide();
            discardButton.hide();
            self.options.app.getWindow().idle();//remove busy animation to prevent blocking

            // look for hard conflicts
            _(conflicts).each(function (conflict) {
                if (conflict.hard_conflict) {
                    hardConflict = true;
                    return;
                }
            });

            require(["io.ox/calendar/conflicts/conflictList"], function (c) {
                self.$el.empty().append(
                    // appointment list
                    c.drawList(conflicts),
                    // hardConflict?
                    hardConflict ?
                        $('<div class="alert alert-info hard-conflict">').text(gt('Conflicts with resources cannot be ignored')) :
                        $(),
                    // buttons
                    $('<div class="buttons">').append(
                        $('<span class="span12">').css('textAlign', 'right').append(
                            // hide/cancel
                            $('<a class="btn">')
                                .text(gt('Hide conflicts'))
                                .on('click', function (e) {
                                    e.preventDefault();
                                    self.$el.empty();
                                    saveButton.show();
                                    discardButton.show();
                                }),
                            // accept/ignore
                            hardConflict ? $() :
                                $('<a class="btn btn-danger">')
                                .css('marginLeft', '1em')
                                .text(gt('Ignore conflicts'))
                                .on('click', function (e) {
                                    e.preventDefault();
                                    self.model.set('ignore_conflicts', true, {validate: true});
                                    saveButton.click();
                                })
                        )
                    )
                );
            });
        }
    });

    // alert error
    point.extend(new forms.ErrorAlert({
        index: 100,
        id: 'error',
        isRelevant: function (response) {
            // don't handle conflicts as error
            if (response.conflicts) {
                return false;
            }
            return true;
        }
    }));

    // title
    point.extend(new forms.InputField({
        id: 'title',
        index: 200,
        className: 'span12',
        labelClassName: 'control-label desc',
        control: '<input type="text" class="span12">',
        attribute: 'title',
        label: gt('Subject'),
        changeAppTitleOnKeyUp: true
    }));

    // location input
    point.extend(new forms.InputField({
        id: 'location',
        className: 'span12',
        labelClassName: 'control-label desc',
        index: 300,
        control: '<input type="text" class="span12">',
        attribute: 'location',
        label: gt('Location')
    }));

    // start date
    point.extend(new forms.DatePicker({
        id: 'start-date',
        index: 400,
        className: 'span4',
        labelClassName: 'control-label desc',
        display: 'DATETIME',
        attribute: 'start_date',
        label: gt('Starts on')
    }));

    // end date
    point.extend(new forms.DatePicker({
        id: 'end-date',
        className: 'span4',
        labelClassName: 'control-label desc',
        display: 'DATETIME',
        index: 500,
        attribute: 'end_date',
        label: gt('Ends on')
    }), {
        nextTo: 'start-date'
    });

    // find free time link
    point.basicExtend({
        id: 'find-free-time-1',
        index: 550,
        nextTo: 'end-date',
        draw: function (baton) {
            if (_.device('!small')) {
                this.append(
                    $('<div class="span4"><label class="find-free-time"></label></div>')
                );
            }
        }
    });

    // full time
    point.extend(new forms.CheckBoxField({
        id: 'full_time',
        className: 'span12',
        labelClassName: 'control-label desc',
        label: gt('All day'),
        attribute: 'full_time',
        index: 600
    }));

    // recurrence
    point.extend(new RecurrenceView({
        id: 'recurrence',
        className: 'span12',
        tabindex: 1,
        index: 650
    }));

    // note
    point.extend(new forms.InputField({
        id: 'note',
        index: 700,
        className: 'span12',
        labelClassName: 'control-label desc',
        control: '<textarea class="note">',
        attribute: 'note',
        label: gt("Description")
    }));

    point.basicExtend({
        id: 'noteSeparator',
        index: 750,
        draw: function () {
            this.append($('<span>&nbsp;</span>'));
        }
    });

    // alarms
    (function () {
        point.extend(new forms.SelectBoxField({
            id: 'alarm',
            index: 800,
            labelClassName: 'control-label desc',
            className: "span4",
            attribute: 'alarm',
            label: gt("Reminder"),
            selectOptions: util.getReminderOptions()
        }));
    }());

    // shown as
    point.extend(new forms.SelectBoxField({
        id: 'shown_as',
        index: 900,
        className: "span4",
        attribute: 'shown_as',
        label: //#. Describes how a appointment is shown in the calendar, values can be "reserved", "temporary", "absent" and "free"
               gt("Shown as"),
        labelClassName: 'control-label desc',
        selectOptions: {
            1: gt('Reserved'),
            2: gt('Temporary'),
            3: gt('Absent'),
            4: gt('Free')
        }
    }), {
        nextTo: 'alarm'
    });

    // private?
    point.extend(new forms.CheckBoxField({
        id: 'private_flag',
        labelClassName: 'control-label desc',
        headerClassName: 'control-label desc',
        className: 'span4',
        header: gt('Type'),
        label: gt('Private'),
        attribute: 'private_flag',
        index: 1000
    }), {
        nextTo: 'shown_as'
    });

    // participants label
    point.extend(new forms.SectionLegend({
        id: 'participants_legend',
        className: 'span12 find-free-time',
        label: gt('Participants'),
        index: 1300
    }));

    // participants
    point.basicExtend({
        id: 'participants_list',
        index: 1400,
        draw: function (baton) {
            this.append(new pViews.UserContainer({
                    collection: baton.model.getParticipants(),
                    baton: baton,
                    sortBy: 'organizer'
                }).render().$el);
        }
    });

    // add participants
    point.basicExtend({
        id: 'add-participant',
        index: 1500,
        draw: function (options) {
            var node = this,
            input;
            node.append(
                    input = $('<div class="input-append span6">').append(
                        $('<input type="text" class="add-participant" tabindex="1">').attr("placeholder", gt("Add participant/resource")),
                        $('<button class="btn" type="button" data-action="add" tabindex="1">')
                            .append($('<i class="icon-plus">'))
                    )
                );

            if (!_.browser.Firefox) { input.addClass('input-append-fix'); }

            require(['io.ox/calendar/edit/view-addparticipants'], function (AddParticipantsView) {

                var collection = options.model.getParticipants();
                var autocomplete = new AddParticipantsView({el: node});
                autocomplete.render();

                //add recipents to baton-data-node; used to filter sugestions list in view
                autocomplete.on('update', function () {
                    var baton = {list: []};
                    collection.any(function (item) {
                        //participant vs. organizer
                        var email = item.get('email1') || item.get('email2');
                        if (email !== null)
                            baton.list.push({email: email, id: item.get('user_id') || item.get('internal_userid') || item.get('id'), type: item.get('type')});
                    });
                    $.data(node, 'baton', baton);
                });

                autocomplete.on('select', function (data) {
                    var alreadyParticipant = false, obj,
                    userId;
                    alreadyParticipant = collection.any(function (item) {
                        if (data.type === 5) {
                            return (item.get('mail') === data.mail && item.get('type') === data.type) || (item.get('mail') === data.email1 && item.get('type') === data.type);
                        } else if (data.type === 1) {
                            return item.get('id') ===  data.internal_userid;
                        } else {
                            return (item.id === data.id && item.get('type') === data.type);
                        }
                    });
                    if (!alreadyParticipant) {
                        if (data.type !== 5) {

                            if (data.mark_as_distributionlist) {
                                _.each(data.distribution_list, function (val) {
                                    var def = $.Deferred();
                                    if (val.folder_id === 6) {
                                        util.getUserIdByInternalId(val.id, def);
                                        def.done(function (id) {
                                            userId = id;
                                            obj = {id: userId, type: 1 };
                                            collection.add(obj);
                                        });
                                    } else {
                                        obj = {type: 5, mail: val.mail, display_name: val.display_name};
                                        collection.add(obj);
                                    }
                                });
                            } else {
                                collection.add(data);
                            }

                        } else {
                            obj = {type: data.type, mail: data.mail || data.email1, display_name: data.display_name, image1_url: data.image1_url || ''};
                            collection.add(obj);
                        }
                    }
                });
            });
        }
    });

    point.extend(new forms.CheckBoxField({
        id: 'notify',
        labelClassName: 'control-label desc',
        //headerClassName: 'control-label desc',
        className: 'span6',
        //header: gt('Notify all participants via e-mail.'),
        label: gt('Notify all participants by E-mail.'),
        attribute: 'notification',
        index: 1510,
        customizeNode: function () {
            this.$el.css("paddingTop", "5px");
        }
    }), {
        nextTo: "add-participant"
    });

    // Attachments

    // attachments label
    point.extend(new forms.SectionLegend({
        id: 'attachments_legend',
        className: 'span12',
        label: gt('Attachments'),
        index: 1600
    }));


    point.extend(new attachments.EditableAttachmentList({
        id: 'attachment_list',
        registerAs: 'attachmentList',
        className: 'div',
        index: 1700,
        module: 1,
        finishedCallback: function (model, id) {
            var obj = {};
            obj.id = model.attributes.id || id;//new objects have no id in model yet
            obj.folder_id = model.attributes.folder_id || model.attributes.folder;
            if (model.attributes.recurrence_position !== null) {
                obj.recurrence_position = model.attributes.recurrence_position;
            }
            api.attachmentCallback(obj);
        }
    }));

    point.basicExtend({
        id: 'attachments_upload',
        index: 1800,
        draw: function (baton) {
            var $node = $('<form>').appendTo(this).attr('id', 'attachmentsForm'),
                $inputWrap = attachments.fileUploadWidget({displayButton: false, multi: true}),
                $input = $inputWrap.find('input[type="file"]')
                    .on('change', function (e) {
                e.preventDefault();
                if (_.browser.IE !== 9) {
                    _($input[0].files).each(function (fileData) {
                        baton.attachmentList.addFile(fileData);
                    });
                    $input.trigger('reset.fileupload');
                } else {
                    if ($input.val()) {
                        var fileData = {
                            name: $input.val().match(/[^\/\\]+$/),
                            size: 0,
                            hiddenField: $input
                        };
                        baton.attachmentList.addFile(fileData);
                        $input.addClass('add-attachment').hide();
                        $input = $('<input>', { type: 'file' }).appendTo($input.parent());
                    }
                }
            });

            $node.append($('<div>').addClass('span12').append($inputWrap));
        }
    });

    ext.point("io.ox/calendar/edit/dnd/actions").extend({
        id: 'attachment',
        index: 10,
        label: gt("Drop here to upload a <b class='dndignore'>new attachment</b>"),
        multiple: function (files, app) {
            _(files).each(function (fileData) {
                app.view.baton.attachmentList.addFile(fileData);
            });
        }
    });

    point.basicExtend({
        id: 'dummy_spacer',
        index: 10000,
        draw: function () {
            this.append('<div>').css('height', '100px');
        }
    });

    function openFreeBusyView(e) {
        var app = e.data.app, model = e.data.model;
        e.preventDefault();
        ox.launch('io.ox/calendar/freebusy/main', {
            app: app,
            start_date: model.get('start_date'),
            end_date: model.get('end_date'),
            folder: model.get('folder_id'),
            participants: model.get('participants'),
            model: model
        });
    }

    // link free/busy view
    point.basicExtend({
        id: 'link-free-busy',
        index: 100000,
        draw: function (baton) {
            // because that works
            if (capabilities.has('freebusy !alone') && _.device('!small')) {
                var selector = 'label.find-free-time, .find-free-time legend';
                this.parent().find(selector).append(
                    $('<a href="#" class="pull-right" tabindex="1">').text(gt('Find a free time'))
                        .on('click', { app: baton.app, model: baton.model }, openFreeBusyView)
                );
            }
        }
    });

    // Disable attachments for specific devices (see boot.js)
    if (!ox.uploadsEnabled || !capabilities.has('infostore')) {
        ext.point("io.ox/calendar/edit/section").disable("attachments_legend");
        ext.point("io.ox/calendar/edit/section").disable("attachments_upload");
    }

    return null;
});
