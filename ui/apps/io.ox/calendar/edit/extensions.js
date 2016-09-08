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
 * @author Alexander Quast <alexander.quast@open-xchange.com>
 */

define('io.ox/calendar/edit/extensions', [
    'io.ox/core/extensions',
    'gettext!io.ox/calendar/edit/main',
    'io.ox/calendar/util',
    'io.ox/contacts/util',
    'io.ox/backbone/views',
    'io.ox/backbone/mini-views',
    'io.ox/backbone/mini-views/datepicker',
    'io.ox/core/tk/attachments',
    'io.ox/calendar/edit/recurrence-view',
    'io.ox/calendar/api',
    'io.ox/participants/add',
    'io.ox/participants/views',
    'io.ox/core/capabilities',
    'io.ox/core/folder/picker',
    'io.ox/core/folder/api',
    'settings!io.ox/calendar',
    'settings!io.ox/core',
    'less!io.ox/calendar/style'
], function (ext, gt, calendarUtil, contactUtil, views, mini, DatePicker, attachments, RecurrenceView, api, AddParticipantView, pViews, capabilities, picker, folderAPI, settings, coreSettings) {

    'use strict';

    var point = views.point('io.ox/calendar/edit/section');

    point.basicExtend({
        id: 'header',
        index: 10,
        draw: function (baton) {
            var headerCol = $('<div class="header">');
            ext.point('io.ox/calendar/edit/section/title').invoke('draw', headerCol, baton);
            ext.point('io.ox/calendar/edit/section/buttons').invoke('draw', headerCol, baton);
            baton.app.getWindow().setHeader(headerCol);
        }
    });

    // pane title and button area
    ext.point('io.ox/calendar/edit/section/title').extend({
        index: 100,
        id: 'title',
        draw: function (baton) {
            this.append($('<h1>').addClass('sr-only').text(baton.mode === 'edit' ? gt('Edit appointment') : gt('Create appointment')));
        }
    });

    // buttons
    ext.point('io.ox/calendar/edit/section/buttons').extend({
        index: 100,
        id: 'save',
        draw: function (baton) {
            var oldFolder = baton.model.get('folder_id');
            this.append($('<button type="button" class="btn btn-primary save" data-action="save" >')
                .text(baton.mode === 'edit' ? gt('Save') : gt('Create'))
                .on('click', function () {
                    var save = _.bind(baton.app.onSave || _.noop, baton.app),
                        fail = _.bind(baton.app.onError || _.noop, baton.app),
                        folder = baton.model.get('folder_id');
                    //check if attachments are changed
                    if (baton.attachmentList.attachmentsToDelete.length > 0 || baton.attachmentList.attachmentsToAdd.length > 0) {
                        //temporary indicator so the api knows that attachments needs to be handled even if nothing else changes
                        baton.model.attributes.tempAttachmentIndicator = true;
                    }

                    if (oldFolder !== folder && baton.mode === 'edit') {
                        baton.model.set({ 'folder_id': oldFolder }, { silent: true });
                        //actual moving is done in the app.onSave method, because this method is also called after confirming conflicts, so we don't need duplicated code
                        baton.app.moveAfterSave = folder;
                    }
                    // cleanup temp timezone data from attributes without change events but keep it in the model (previousAttributes might be cleaned in some cases so it's not safe)
                    var timezone = baton.model.get('endTimezone');
                    baton.model.unset('endTimezone', { silent: true });
                    baton.model.endTimezone = timezone;
                    baton.model.save().then(save, fail);
                })
            );

        }
    });

    ext.point('io.ox/calendar/edit/section/buttons').extend({
        index: 200,
        id: 'discard',
        draw: function (baton) {
            this.append($('<button type="button" class="btn btn-default discard" data-action="discard" >')
                .text(gt('Discard'))
                .on('click', function (e) {
                    e.stopPropagation();
                    baton.app.quit();
                })
            );
        }
    });

    ext.point('io.ox/calendar/edit/section/buttons').extend({
        id: 'metrics',
        draw: function () {
            var self = this;
            require(['io.ox/metrics/main'], function (metrics) {
                if (!metrics.isEnabled()) return;
                self.delegate('[data-action]', 'mousedown', function (e) {
                    var node =  $(e.target);
                    metrics.trackEvent({
                        app: 'calendar',
                        target: 'edit/toolbar',
                        type: 'click',
                        action: node.attr('data-action') || node.attr('data-name'),
                        detail: node.attr('data-value')
                    });
                });
            });
        }
    });

    var CalendarSelectionView = mini.AbstractView.extend({
        tagName: 'div',
        className: 'header-right',
        events: {
            'click a': 'onSelect'
        },
        setup: function () {
            this.listenTo(this.model, 'change:folder_id', this.render);
        },
        onSelect: function () {
            var self = this;

            picker({
                button: gt('Select'),
                filter: function (id, model) {
                    return model.id !== 'virtual/all-my-appointments';
                },
                flat: true,
                indent: false,
                module: 'calendar',
                persistent: 'folderpopup',
                root: '1',
                settings: settings,
                title: gt('Select folder'),
                folder: this.model.get('folder_id'),

                done: function (id) {
                    self.model.set('folder_id', id);
                },

                disable: function (data, options) {
                    var create = folderAPI.can('create', data);
                    return !create || (options && /^virtual/.test(options.folder));
                }
            });
        },
        render: function () {
            var link = $('<a href="#">'),
                folderId = this.model.get('folder_id');

            folderAPI.get(folderId).done(function (folder) {
                link.text(folder.display_title || folder.title);
            });

            this.$el.empty().append(
                $('<span>').text(gt('Calendar:')),
                link
            );

            return this;
        }
    });

    ext.point('io.ox/calendar/edit/section/buttons').extend({
        index: 1000,
        id: 'folder-selection',
        draw: function (baton) {
            this.append(
                new CalendarSelectionView({ model: baton.model }).render().$el
            );
        }
    });

    // title
    point.extend({
        id: 'title',
        index: 200,
        render: function () {
            var self = this, input;
            this.$el.append(
                $('<label class="control-label col-xs-12">').append(
                    $.txt(gt('Subject')),
                    input = new mini.InputView({ name: 'title', model: self.model }).render().$el,
                    new mini.ErrorView({ name: 'title', model: self.model }).render().$el
                )
            );
            input.on('keyup', function () {
                // update title on keyup
                self.model.trigger('keyup:title', $(this).val());
            });
        }
    });

    // location input
    point.extend({
        id: 'location',
        index: 300,
        render: function () {
            this.$el.append(
                $('<label class="control-label col-xs-12">').append(
                    $.txt(gt('Location')),
                    new mini.InputView({ name: 'location', model: this.model }).render().$el
                )
            );
        }
    });

    function openTimezoneDialog() {
        var model = this.model;

        require(['io.ox/calendar/edit/timezone-dialog'], function (dialog) {
            dialog.open({ model: model });
        });
    }

    // start date
    point.basicExtend({
        id: 'start-date',
        index: 400,
        draw: function (baton) {
            this.append(
                new DatePicker({
                    model: baton.model,
                    className: 'col-xs-6',
                    display: baton.model.get('full_time') ? 'DATE' : 'DATETIME',
                    attribute: 'start_date',
                    label: gt('Starts on'),
                    timezoneButton: true,
                    timezoneAttribute: 'timezone'
                }).listenTo(baton.model, 'change:full_time', function (model, fulltime) {
                    this.toggleTimeInput(!fulltime);
                }).on('click:timezone', openTimezoneDialog, baton)
                    .on('click:time', function () {
                        var target = this.$el.find('.dropdown-menu.calendaredit'),
                            container = target.scrollParent(),
                            pos = target.offset().top - container.offset().top;

                        if ((pos < 0) || (pos + target.height() > container.height())) {
                            // scroll to Node, leave 16px offset
                            container.scrollTop(container.scrollTop() + pos - 16);
                        }

                    }).render().$el
            );
        }
    });

    // end date
    point.basicExtend({
        id: 'end-date',
        index: 500,
        nextTo: 'start-date',
        draw: function (baton) {
            this.append(
                new DatePicker({
                    model: baton.model,
                    className: 'col-xs-6',
                    display: baton.model.get('full_time') ? 'DATE' : 'DATETIME',
                    attribute: 'end_date',
                    label: gt('Ends on'),
                    timezoneButton: true,
                    timezoneAttribute: 'endTimezone'
                }).listenTo(baton.model, 'change:full_time', function (model, fulltime) {
                    this.toggleTimeInput(!fulltime);
                }).on('click:timezone', openTimezoneDialog, baton)
                    .on('click:time', function () {
                        var target = this.$el.find('.dropdown-menu.calendaredit'),
                            container = target.scrollParent(),
                            pos = target.offset().top - container.offset().top;

                        if ((pos < 0) || (pos + target.height() > container.height())) {
                            // scroll to Node, leave 16px offset
                            container.scrollTop(container.scrollTop() + pos - 16);
                        }

                    }).render().$el
            );
        }
    });

    // timezone hint
    point.extend({
        id: 'timezone-hint',
        index: 550,
        nextTo: 'end-date',
        render: function () {
            var appointmentTimezoneAbbr = moment.tz(this.model.get('timezone')).zoneAbbr(),
                userTimezoneAbbr = moment.tz(coreSettings.get('timezone')).zoneAbbr();

            if (appointmentTimezoneAbbr === userTimezoneAbbr) return;

            this.$el.append($('<div class="col-xs-12 help-block">').text(
                //#. %1$s timezone abbreviation of the appointment
                //#. %2$s default user timezone
                gt('The timezone of this appointment (%1$s) differs from your default timezone (%2$s).', appointmentTimezoneAbbr, userTimezoneAbbr)
            ));
        }
    });

    // full time
    point.extend({
        id: 'full_time',
        index: 600,
        className: 'col-md-6',
        render: function () {
            this.$el.append(
                $('<div>').addClass('checkbox').append(
                    $('<label class="control-label">').append(
                        new mini.CheckboxView({ name: 'full_time', model: this.model }).render().$el,
                        $.txt(gt('All day'))
                    )
                )
            );
        }
    });

    // find free time link
    point.basicExtend({
        id: 'find-free-time-1',
        index: 650,
        nextTo: 'full_time',
        draw: function () {
            this.append(
                $('<div class="hidden-xs col-sm-6 find-free-time"></div>')
            );
        }
    });

    // move recurrence view to collapsible area on mobile devices
    var recurrenceIndex = _.device('smartphone') ? 950 : 650;
    // recurrence
    point.extend(new RecurrenceView({
        id: 'recurrence',
        className: 'col-xs-12 recurrenceview',
        index: recurrenceIndex
    }), {
        rowClass: 'collapsed'
    });

    // note
    point.extend({
        id: 'note',
        index: 700,
        className: 'col-xs-12',
        render: function () {
            var guid = _.uniqueId('form-control-label-');
            this.$el.append(
                $('<label class="control-label">').text(gt('Description')).attr({ for: guid }),
                new mini.TextView({ name: 'note', model: this.model }).render().$el.attr({ id: guid }).addClass('note')
            );
        }
    });

    // separator or toggle
    point.basicExtend({
        id: 'noteSeparator',
        index: 750,
        draw: function (baton) {
            this.append(
                $('<a href="#">')
                    .text(gt('Expand form'))
                    .addClass('btn btn-link actionToggle')
                    .on('click', function (e) {
                        e.preventDefault();
                        if (baton.parentView.collapsed) {
                            $('.row.collapsed', baton.parentView.$el).css('display', '');
                            $(this).text(gt('Expand form'));
                        } else {
                            $('.row.collapsed', baton.parentView.$el).show();
                            $(this).text(gt('Collapse form'));
                        }
                        baton.parentView.collapsed = !baton.parentView.collapsed;
                    })
            );
        }
    });

    // alarms
    point.extend({
        id: 'alarm',
        className: 'col-md-6',
        index: 800,
        render: function () {
            var guid = _.uniqueId('form-control-label-');
            this.$el.append(
                $('<label>').attr({
                    class: 'control-label',
                    for: guid
                }).text(gt('Reminder')), //#. Describes how a appointment is shown in the calendar, values can be "reserved", "temporary", "absent" and "free"
                $('<div>').append(
                    new mini.SelectView({
                        list: _.map(calendarUtil.getReminderOptions(), function (key, val) { return { label: key, value: val }; }),
                        name: 'alarm',
                        model: this.baton.model,
                        id: guid,
                        className: 'form-control'
                    }).render().$el
                )
            );
        }
    }, {
        rowClass: 'collapsed form-spacer'
    });

    // shown as
    point.extend({
        id: 'shown_as',
        className: 'col-md-6',
        index: 900,
        render: function () {
            var guid = _.uniqueId('form-control-label-'),
                options = [
                    { label: gt('Reserved'), value: 1 },
                    { label: gt('Temporary'), value: 2 },
                    { label: gt('Absent'), value: 3 },
                    { label: gt('Free'), value: 4 }
                ];
            this.$el.append(
                $('<label>').attr({
                    class: 'control-label',
                    for: guid
                }).text(gt('Shown as')), //#. Describes how a appointment is shown in the calendar, values can be "reserved", "temporary", "absent" and "free"
                $('<div>').append(
                    new mini.SelectView({
                        list: options,
                        name: 'shown_as',
                        model: this.baton.model,
                        id: guid,
                        className: 'form-control'
                    }).render().$el
                )
            );
        }
    }, {
        nextTo: 'alarm',
        rowClass: 'collapsed form-spacer'
    });

    function changeColorHandler(e) {
        e.data.model.set('color_label', $(this).parent().children(':checked').val());
    }

    //color selection
    point.extend({
        id: 'color',
        index: 1000,
        className: 'col-md-6',
        render: function () {

            if (settings.get('colorScheme') !== 'custom') return;

            var currentColor = parseInt(this.model.get('color_label'), 10) || 0;

            // update color palette: different 'no-color' option for private appointents (white vs. dark grey)
            this.listenTo(this.model, 'change:private_flag', function (model, value) {
                this.$el.find('.no-color').toggleClass('color-label-10', value);
            });

            this.$el.append(
                $('<label class="control-label">').append(
                    $.txt(gt('Color')),
                    $('<div class="custom-color">').append(
                        _.map(_.range(0, 11), function (color_label) {
                            return $('<label>').append(
                                // radio button
                                $('<input type="radio" name="color">')
                                .attr('aria-label', calendarUtil.getColorLabel(color_label))
                                .val(color_label)
                                .prop('checked', color_label === currentColor)
                                .on('change', { model: this.model }, changeColorHandler),
                                // colored box
                                $('<span class="box">')
                                .addClass(color_label > 0 ? 'color-label-' + color_label : 'no-color')
                                .addClass(color_label === 0 && this.model.get('private_flag') ? 'color-label-10' : '')
                            );
                        }, this)
                    )
                )
            );
        }
    }, {
        rowClass: 'collapsed'
    });

    // private checkbox
    point.extend({
        id: 'private_flag',
        index: 1200,
        className: 'col-md-6',
        render: function () {

            // private flag only works in private folders
            var folder_id = this.model.get('folder_id');
            if (!folderAPI.pool.getModel(folder_id).is('private')) return;

            this.$el.append(
                $('<fieldset>').append(
                    $('<legend>').addClass('simple').text(gt('Type')),
                    $('<label class="checkbox-inline control-label">').append(
                        new mini.CheckboxView({ name: 'private_flag', model: this.model }).render().$el,
                        $.txt(gt('Private'))
                    )
                )
            );
        }
    }, {
        nextTo: 'color',
        rowClass: 'collapsed'
    });

    // participants container
    point.basicExtend({
        id: 'participants_list',
        index: 1400,
        rowClass: 'collapsed form-spacer',
        draw: function (baton) {
            this.append(new pViews.UserContainer({
                collection: baton.model.getParticipants(),
                baton: baton
            }).render().$el);
        }
    });

    // add participants view
    point.basicExtend({
        id: 'add-participant',
        index: 1500,
        rowClass: 'collapsed',
        draw: function (baton) {

            var typeahead = new AddParticipantView({
                apiOptions: {
                    contacts: true,
                    users: true,
                    groups: true,
                    resources: true,
                    distributionlists: true
                },
                collection: baton.model.getParticipants(),
                blacklist: settings.get('participantBlacklist') || false,
                scrollIntoView: true
            });

            this.append(typeahead.$el);
            typeahead.render().$el.addClass('col-md-6');
        }
    });

    // email notification
    point.extend({
        id: 'notify',
        index: 1510,
        className: 'col-md-6',
        render: function () {
            this.$el.append(
                $('<label class="checkbox-inline control-label">').append(
                    new mini.CheckboxView({ name: 'notification', model: this.model }).render().$el,
                    $.txt(gt('Notify all participants by email.'))
                )
            );
        }
    }, {
        nextTo: 'add-participant',
        rowClass: 'collapsed'
    });

    // Attachments

    // attachments label
    point.extend({
        id: 'attachments_legend',
        index: 1600,
        className: 'col-md-12',
        render: function () {
            this.$el.append(
                $('<fieldset>').append(
                    $('<legend>').text(gt('Attachments'))
                )
            );
        }
    }, {
        rowClass: 'collapsed form-spacer'
    });

    point.extend(new attachments.EditableAttachmentList({
        id: 'attachment_list',
        registerAs: 'attachmentList',
        className: 'div',
        index: 1700,
        module: 1,
        finishedCallback: function (model, id) {
            var obj = model.attributes;
            //new objects have no id in model yet
            obj.id = id || model.attributes.id;
            obj.folder_id = model.attributes.folder_id || model.attributes.folder;
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
                $inputWrap = attachments.fileUploadWidget({ multi: true }),
                $input = $inputWrap.find('input[type="file"]'),
                changeHandler = function (e) {
                    e.preventDefault();
                    if (_.browser.IE !== 9) {
                        _($input[0].files).each(function (fileData) {
                            baton.attachmentList.addFile(fileData);
                        });
                        //WORKAROUND "bug" in Chromium (no change event triggered when selecting the same file again,
                        //in file picker dialog - other browsers still seem to work)
                        $input[0].value = '';
                        $input.trigger('reset.fileupload');
                    } else if ($input.val()) {
                        //IE
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
                    // look if the quota is exceeded
                    baton.model.on('invalid:quota_exceeded', function (messages) {
                        require(['io.ox/core/yell'], function (yell) {
                            yell('error', messages[0]);
                        });
                    });
                    baton.model.validate();
                    // turn of again to prevent double yells on save
                    baton.model.off('invalid:quota_exceeded');
                };
            $input.on('change', changeHandler);
            $inputWrap.on('change.fileupload', function () {
                //use bubbled event to add fileupload-new again (workaround to add multiple files with IE)
                $(this).find('div[data-provides="fileupload"]').addClass('fileupload-new').removeClass('fileupload-exists');
            });
            $node.append($('<div>').addClass('col-md-12').append($inputWrap));
        }
    });

    point.basicExtend({
        id: 'attachments_upload_metrics',
        draw: function () {
            var self = this;
            require(['io.ox/metrics/main'], function (metrics) {
                if (!metrics.isEnabled()) return;
                self.parent()
                    .find('.file-input')
                    .on('change', function track() {
                        // metrics
                        metrics.trackEvent({
                            app: 'calendar',
                            target: 'edit',
                            type: 'click',
                            action: 'add-attachment'
                        });
                    });
            });
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
    });

    function openFreeBusyView(e) {
        require(['io.ox/calendar/freetime/main'], function (freetime) {
            //#. Applies changes to an existing appointment, used in scheduling view
            freetime.showDialog({ label: gt('Apply changes'), parentModel: e.data.model }).done(function (data) {
                var view = data.view;
                data.dialog.on('save', function () {
                    var appointment = view.createAppointment();

                    if (appointment) {
                        data.dialog.close();
                        e.data.model.set({ full_time: appointment.full_time });
                        e.data.model.set({ start_date: appointment.start_date });
                        var models = [],
                            defs = [];
                        // add to participants collection instead of the model attribute to make sure the edit view is redrawn correctly
                        _(appointment.participants).each(function (data) {
                            //create model
                            var mod = new e.data.model._participants.model(data);
                            models.push(mod);
                            // wait for fetch, then add to collection
                            defs.push(mod.loading);
                        });
                        $.when.apply($, defs).done(function () {
                            // first reset then addUniquely collection might not reraw correctly otherwise in some cases
                            e.data.model._participants.reset([]);
                            e.data.model._participants.addUniquely(models);
                        });
                        // set end_date in a seperate call to avoid the appointment model applyAutoLengthMagic (Bug 27259)
                        e.data.model.set({
                            end_date: appointment.end_date
                        }, { validate: true });
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

    /*function openFreeBusyView(e) {
        var app = e.data.app,
            model = e.data.model,
            start = model.get('start_date'),
            end = model.get('end_date');
        e.preventDefault();

        //when editing a series we are not interested in the past (see Bug 35492)
        if (model.get('recurrence_type') !== 0) {
            start = _.now();
            //prevent end_date before start_date
            if (start > end) {
                //just add an hour
                end = start + 3600000;
            }
        }
        ox.launch('io.ox/calendar/freebusy/main', {
            app: app,
            start_date: start,
            end_date: end,
            folder: model.get('folder_id'),
            participants: model.getParticipants().map(function (p) {
                return p.toJSON();
            }),
            model: model
        });
    }*/

    // link free/busy view
    point.basicExtend({
        id: 'link-free-busy',
        index: 100000,
        draw: function (baton) {
            // because that works
            if (capabilities.has('freebusy !alone')) {
                this.parent().find('.find-free-time').append(
                    $('<button type="button" class="btn btn-link">').text(gt('Find a free time'))
                        .on('click', { app: baton.app, model: baton.model }, openFreeBusyView)
                );
            }
        }
    });

    if (!capabilities.has('infostore')) {
        ext.point('io.ox/calendar/edit/section')
            .disable('attachments_legend')
            .disable('attachments_upload');
    }

    return null;
});
