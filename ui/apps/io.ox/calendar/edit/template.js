/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2011 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

define('io.ox/calendar/edit/template',
    ['io.ox/core/extensions',
     'gettext!io.ox/calendar/edit/main',
     'io.ox/calendar/util',
     'io.ox/contacts/util',
     'io.ox/backbone/views',
     'io.ox/backbone/forms',
     'io.ox/core/tk/attachments',
     'io.ox/calendar/edit/recurrence-view',
     'io.ox/calendar/api',
     'io.ox/participants/views',
     'settings!io.ox/calendar',
     'io.ox/core/capabilities'
    ], function (ext, gt, calendarUtil, contactUtil, views, forms, attachments, RecurrenceView, api, pViews, settings, capabilities) {

    'use strict';

    var point = views.point('io.ox/calendar/edit/section'),
        collapsed = false;

    // create blacklist
    var blackList = null,
        blackListStr = settings.get('participantBlacklist') || '';

    if (blackListStr) {
        blackList = {};
        _(blackListStr.split(',')).each(function (item) {
            blackList[item.trim()] = true;
        });
    }

    // subpoint for conflicts
    var pointConflicts = point.createSubpoint('conflicts', {
        index: 120,
        id: 'conflicts',
        className: 'additional-info'
    });

    ext.point('io.ox/calendar/edit/section/header').extend({
        draw: function (baton) {
            var row = $('<div class="col-lg-12 header">');
            ext.point('io.ox/calendar/edit/section/title').invoke('draw', row, baton);
            ext.point('io.ox/calendar/edit/section/buttons').invoke('draw', row, baton);
            this.append($('<div class="row">').append(row));
        }
    });

    // pane title and button area
    ext.point('io.ox/calendar/edit/section/title').extend({
        index: 100,
        id: 'title',
        draw: function (baton) {
            this.append($('<h1>').addClass('clear-title title').text(baton.mode === 'edit' ? gt('Edit appointment') : gt('Create appointment')));
        }
    });

    // buttons
    ext.point('io.ox/calendar/edit/section/buttons').extend({
        index: 100,
        id: 'save',
        draw: function (baton) {
            this.append($('<button type="button" class="btn btn-primary save" data-action="save" >')
                .text(baton.mode === 'edit' ? gt('Save') : gt('Create'))
                .on('click', function () {
                    //check if attachments are changed
                    if (baton.attachmentList.attachmentsToDelete.length > 0 || baton.attachmentList.attachmentsToAdd.length > 0) {
                        baton.model.attributes.tempAttachmentIndicator = true;//temporary indicator so the api knows that attachments needs to be handled even if nothing else changes
                    }
                    baton.model.save().then(_.bind(baton.app.onSave, baton.app));
                })
            );

        }
    });

    ext.point('io.ox/calendar/edit/section/buttons').extend({
        index: 200,
        id: 'discard',
        draw: function (baton) {
            this.append($('<button type="button" class="btn btn-default discard" data-action="discard" >').text(gt('Discard'))
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
        tagName: 'div'
    });

    // title
    point.extend(new forms.InputField({
        id: 'title',
        index: 200,
        className: 'col-xs-12',
        labelClassName: 'control-label',
        control: '<input type="text" class="form-control">',
        attribute: 'title',
        label: gt('Subject'),
        changeAppTitleOnKeyUp: true
    }));

    // location input
    point.extend(new forms.InputField({
        id: 'location',
        className: 'col-xs-12',
        labelClassName: 'control-label',
        index: 300,
        control: '<input type="text" class="form-control">',
        attribute: 'location',
        label: gt('Location')
    }));

    // start date
    point.extend(new forms.DatePicker({
        id: 'start-date',
        index: 400,
        className: 'dateinput col-xs-6 col-sm-6 col-md-4',
        labelClassName: 'control-label',
        display: 'DATETIME',
        attribute: 'start_date',
        label: gt('Starts on')
    }));

    // end date
    point.extend(new forms.DatePicker({
        id: 'end-date',
        className: 'dateinput col-xs-6 col-sm-6 col-md-4',
        labelClassName: 'control-label',
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
        draw: function () {
            this.append(
                $('<div class="hidden-xs col-sm-12 col-md-4 find-free-time-top"></div>')
            );
        }
    });

    // full time
    point.extend(new forms.CheckBoxField({
        id: 'full_time',
        className: 'col-xs-12',
        labelClassName: 'control-label',
        label: gt('All day'),
        attribute: 'full_time',
        index: 600
    }));

    // move recurrence view to collapsible area on mobile devices
    var recurrenceIndex = _.device('small') ? 950 : 650;
    // recurrence
    point.extend(new RecurrenceView({
        id: 'recurrence',
        className: 'col-xs-12 recurrenceview',
        index: recurrenceIndex
    }), {
        rowClass: 'collapsed'
    });

    // note
    point.extend(new forms.InputField({
        id: 'note',
        index: 700,
        className: 'col-xs-12',
        labelClassName: 'control-label',
        control: '<textarea class="note form-control">',
        attribute: 'note',
        label: gt('Description')
    }));

    // separator or toggle
    point.basicExtend({
        id: 'noteSeparator',
        index: 750,
        draw: function (baton) {
            if (_.device('small')) {
                this.append(
                    $('<a href="#">')
                        .text(gt('Expand form'))
                        .addClass('btn btn-link actionToggle spacer')
                        .on('click', function (e) {
                            e.preventDefault();
                            $('.row.collapsed', baton.parentView.$el).toggle();
                            if (collapsed) {
                                $(this).text(gt('Expand form')).addClass('spacer');
                            } else {
                                $(this).text(gt('Collapse form')).removeClass('spacer');
                            }
                            collapsed = !collapsed;
                        })
                );
            } else {
                this.append($('<span>&nbsp;</span>'));
            }
        }
    });

    // alarms
    (function () {
        point.extend(new forms.SelectBoxField({
            id: 'alarm',
            index: 800,
            labelClassName: 'control-label',
            className: 'col-md-4',
            attribute: 'alarm',
            label: gt('Reminder'),
            selectOptions: calendarUtil.getReminderOptions()
        }), {
            rowClass: 'collapsed'
        });
    }());

    // shown as
    point.extend(new forms.SelectBoxField({
        id: 'shown_as',
        index: 900,
        className: 'col-md-4',
        attribute: 'shown_as',
        label: //#. Describes how a appointment is shown in the calendar, values can be "reserved", "temporary", "absent" and "free"
               gt('Shown as'),
        labelClassName: 'control-label',
        selectOptions: {
            1: gt('Reserved'),
            2: gt('Temporary'),
            3: gt('Absent'),
            4: gt('Free')
        }
    }), {
        nextTo: 'alarm',
        rowClass: 'collapsed'
    });

    // private?
    point.extend(new forms.CheckBoxField({
        id: 'private_flag',
        labelClassName: 'control-label',
        headerClassName: 'control-label',
        className: 'col-md-4 privateflag',
        header: gt('Type'),
        label: gt('Private'),
        attribute: 'private_flag',
        index: 1000
    }), {
        nextTo: 'shown_as',
        rowClass: 'collapsed'
    });

    // participants label
    point.extend(new forms.SectionLegend({
        id: 'participants_legend',
        className: 'col-md-12 find-free-time',
        label: gt('Participants'),
        index: 1300
    }), {
        rowClass: 'collapsed'
    });

    // participants
    point.basicExtend({
        id: 'participants_list',
        index: 1400,
        rowClass: 'collapsed',
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
        rowClass: 'collapsed',
        draw: function (baton) {
            var pNode,
                guid = _.uniqueId('form-control-label-');
            this.append(
                $('<div class="col-md-6">').append(
                    pNode = $('<div class="input-group">').append(
                        $('<input class="add-participant form-control">').attr({
                            type: 'text',
                            tabindex: 1,
                            id: guid,
                            placeholder: gt('Add participant/resource')
                        }),
                        $('<label class="sr-only">').text(gt('Add participant/resource')).attr('for', guid),
                        $('<span class="input-group-btn">').append(
                            $('<button class="btn btn-default">')
                                .attr({
                                    type: 'button',
                                    tabindex: 1,
                                    'data-action': 'add',
                                    'aria-label': gt('Add participant/resource')
                                })
                                .append($('<i class="fa fa-plus">'))
                        )
                    )
                )
            );

            require(['io.ox/calendar/edit/view-addparticipants'], function (AddParticipantsView) {

                var collection = baton.model.getParticipants(),
                    autocomplete = new AddParticipantsView({ el: pNode, blackList: blackList });

                if (blackList) {
                    collection.each(function (item) {
                        if (item && blackList[item.getEmail()]) {
                            collection.remove(item);
                        }
                    });
                    collection.on('change', function (item) {
                        if (item && blackList[item.getEmail()]) {
                            collection.remove(item);
                        }
                    });
                }
                autocomplete.render();

                //add recipents to baton-data-node; used to filter sugestions list in view
                autocomplete.on('update', function () {
                    var baton = {list: []};
                    collection.each(function (item) {
                        //participant vs. organizer
                        var email = item.get('email1') || item.get('email2');
                        if (email !== null)
                            baton.list.push({email: email, id: item.get('user_id') || item.get('internal_userid') || item.get('id'), type: item.get('type')});
                    });
                    $.data(pNode, 'baton', baton);
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
                        if (blackList && blackList[contactUtil.getMail(data)]) {
                            require('io.ox/core/yell')('warning', gt('This email address cannot be used for appointments'));
                        } else {
                            if (data.type !== 5) {

                                if (data.mark_as_distributionlist) {
                                    _.each(data.distribution_list, function (val) {
                                        if (val.folder_id === 6) {
                                            calendarUtil.getUserIdByInternalId(val.id).done(function (id) {
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
                    }
                });
            });
        }
    });

    point.extend(new forms.CheckBoxField({
        id: 'notify',
        labelClassName: 'control-label',
        className: 'col-md-6',
        label: gt('Notify all participants by email.'),
        attribute: 'notification',
        index: 1510,
        customizeNode: function () {
            this.$el.css({'top': '-12px'});
        }
    }), {
        nextTo: 'add-participant',
        rowClass: 'collapsed'
    });

    // Attachments

    // attachments label
    point.extend(new forms.SectionLegend({
        id: 'attachments_legend',
        className: 'col-md-12',
        label: gt('Attachments'),
        index: 1600
    }), {
        rowClass: 'collapsed'
    });

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
    }), {
        rowClass: 'collapsed'
    });

    point.basicExtend({
        id: 'attachments_upload',
        index: 1800,
        rowClass: 'collapsed',
        draw: function (baton) {
            var guid = _.uniqueId('form-control-label-'),
                $node = $('<form class="attachments-form">').appendTo(this).attr('id', guid),
                $inputWrap = attachments.fileUploadWidget({multi: true}),
                $input = $inputWrap.find('input[type="file"]'),
                changeHandler = function (e) {
                    e.preventDefault();
                    if (_.browser.IE !== 9) {
                        _($input[0].files).each(function (fileData) {
                            baton.attachmentList.addFile(fileData);
                        });
                        $input.trigger('reset.fileupload');
                    } else {
                        //IE
                        if ($input.val()) {
                            var fileData = {
                                name: $input.val().match(/[^\/\\]+$/),
                                size: 0,
                                hiddenField: $input
                            };
                            baton.attachmentList.addFile(fileData);
                            //hide input field with file
                            $input.addClass('add-attachment').hide();
                            //create new input field
                            $input = $('<input>', { type: 'file', name: 'file' })
                                    .on('change', changeHandler)
                                    .appendTo($input.parent());
                        }
                    }
                };
            $input.on('change', changeHandler);
            $inputWrap.on('change.fileupload', function () {
                //use bubbled event to add fileupload-new again (workaround to add multiple files with IE)
                $(this).find('div[data-provides="fileupload"]').addClass('fileupload-new').removeClass('fileupload-exists');
            });
            $node.append($('<div>').addClass('col-md-12').append($inputWrap));
        }
    });

    ext.point('io.ox/calendar/edit/dnd/actions').extend({
        id: 'attachment',
        index: 10,
        label: gt('Drop here to upload a <b class="dndignore">new attachment</b>'),
        multiple: function (files, app) {
            _(files).each(function (fileData) {
                app.view.baton.attachmentList.addFile(fileData);
            });
        }
    }, {
        rowClass: 'collapsed'
    });

    point.basicExtend({
        id: 'dummy_spacer',
        index: 10000,
        rowClass: 'collapsed',
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
            if (capabilities.has('freebusy !alone')) {
                var selector = '.find-free-time-top, .find-free-time legend';
                this.parent().find(selector).append(
                    $('<button type="button" class="btn btn-link pull-right hidden-xs" tabindex="1">').text(gt('Find a free time'))
                        .on('click', { app: baton.app, model: baton.model }, openFreeBusyView)
                );
            }
        }
    });

     // bottom toolbar for mobile only
    ext.point('io.ox/calendar/edit/bottomToolbar').extend({
        id: 'toolbar',
        index: 2500,
        draw: function (baton) {
            // must be on a non overflow container to work with position:fixed
            var node = $(baton.app.attributes.window.nodes.body),
                toolbar;
            node.append(toolbar = $('<div class="app-bottom-toolbar">'));
            ext.point('io.ox/calendar/edit/section/buttons').replace({
                id: 'save',
                index: 200
            }).replace({
                id: 'discard',
                index: 100
            });
            ext.point('io.ox/calendar/edit/section/buttons').enable('save').enable('discard').invoke('draw', toolbar, baton);
        }
    });

    if (!capabilities.has('infostore')) {
        ext.point('io.ox/calendar/edit/section').disable('attachments_legend');
        ext.point('io.ox/calendar/edit/section').disable('attachments_upload');
    }

    return null;
});
