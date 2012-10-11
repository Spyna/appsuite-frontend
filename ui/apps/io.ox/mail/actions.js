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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */

define('io.ox/mail/actions',
    ['io.ox/core/extensions',
     'io.ox/core/extPatterns/links',
     'io.ox/mail/api',
     'io.ox/mail/util',
     'gettext!io.ox/mail/mail',
     'io.ox/core/config',
     'io.ox/core/notifications',
     'io.ox/contacts/api'], function (ext, links, api, util, gt, config, notifications, contactAPI) {

    'use strict';


    var defaultDraftFolder = config.get('modules.mail.defaultFolder.drafts'),
        Action = links.Action;


    // actions

    new Action('io.ox/mail/actions/compose', {
        id: 'compose',
        action: function (app) {
            require(['io.ox/mail/write/main'], function (m) {
                m.getApp().launch().done(function () {
                    this.compose({ folder_id: app.folder.get() });
                });
            });
        }
    });

    new Action('io.ox/mail/actions/delete', {
        id: 'delete',
        requires: 'toplevel some delete',
        multiple: function (list) {
            api.remove(list);
        }
    });

    new Action('io.ox/mail/actions/reply-all', {
        id: 'reply-all',
        requires: function (e) {
            // other recipients that me?
            return e.collection.has('toplevel', 'one') &&
                util.hasOtherRecipients(e.context) && e.context.folder_id !== defaultDraftFolder;
        },
        action: function (data) {
            require(['io.ox/mail/write/main'], function (m) {
                m.getApp().launch().done(function () {
                    this.replyall(data);
                });
            });
        }
    });

    new Action('io.ox/mail/actions/reply', {
        id: 'reply',
        requires: function (e) {
            return e.collection.has('toplevel', 'one') && e.context.folder_id !== defaultDraftFolder;
        },
        action: function (data) {
            require(['io.ox/mail/write/main'], function (m) {
                m.getApp().launch().done(function () {
                    this.reply(data);
                });
            });
        }
    });

    new Action('io.ox/mail/actions/forward', {
        id: 'forward',
        requires: function (e) {
            return e.collection.has('toplevel', 'some');
        },
        action: function (data) {
            require(['io.ox/mail/write/main'], function (m) {
                m.getApp().launch().done(function () {
                    this.forward(data);
                });
            });
        }
    });

    new Action('io.ox/mail/actions/edit', {
        id: 'edit',
        requires: function (e) {
            return e.collection.has('toplevel', 'one') && e.context.folder_id === defaultDraftFolder;
        },
        action: function (data) {
            require(['io.ox/mail/write/main'], function (m) {
                m.getApp().launch().done(function () {
                    var self = this;
                    this.compose(data).done(function () {
                        self.setMsgRef(data.folder_id + '/' + data.id);
                        self.markClean();
                    });
                });
            });
        }
    });

    new Action('io.ox/mail/actions/source', {
        id: 'source',
        requires: 'toplevel one',
        action: function (data) {
            var getSource = api.getSource(data), textarea;
            require(["io.ox/core/tk/dialogs"], function (dialogs) {
                new dialogs.ModalDialog({ easyOut: true, width: 700 })
                    .addPrimaryButton("close", gt("Close"))
                    .header(
                        $('<h3>').text(gt('Mail source') + ': ' + (data.subject || ''))
                    )
                    .append(
                        textarea = $('<textarea>', { rows: 15, readonly: 'readonly' })
                        .css({ width: '100%', boxSizing: 'border-box', visibility: 'hidden' })
                        .addClass('input-xlarge')
                        .on('keydown', function (e) {
                            if (e.which !== 27) {
                                e.stopPropagation();
                            }
                        })
                    )
                    .show(function () {
                        var self = this.busy();
                        getSource.done(function (src) {
                            textarea.val(src || '').css({ visibility: '',  cursor: 'default' });
                            textarea = getSource = null;
                            self.idle();
                        });
                    });
            });
        }
    });

    new Action('io.ox/mail/actions/move', {
        id: 'move',
        requires: 'toplevel some',
        multiple: function (mail) {
            require(["io.ox/core/tk/dialogs", "io.ox/core/tk/folderviews"], function (dialogs, views) {
                var dialog = new dialogs.ModalDialog({ easyOut: true })
                    .header($('<h3>').text('Move'))
                    .addPrimaryButton("ok", gt("OK"))
                    .addButton("cancel", gt("Cancel"));
                dialog.getBody().css({ height: '250px' });
                var item = _(mail).first(),
                    tree = new views.FolderTree(dialog.getBody(), { type: 'mail' });
                tree.paint();
                dialog.show(function () {
                    tree.selection.set(item.folder_id || item.folder);
                })
                .done(function (action) {
                    if (action === 'ok') {
                        var selectedFolder = tree.selection.get();
                        if (selectedFolder.length === 1) {
                            // move action
                            api.move(mail, selectedFolder[0].id);
                        }
                    }
                    tree.destroy();
                    tree = dialog = null;
                });
            });
        }
    });

    new Action('io.ox/mail/actions/copy', {
        id: 'copy',
        requires: 'toplevel some',
        multiple: function (mail) {
            require(["io.ox/core/tk/dialogs", "io.ox/core/tk/folderviews"], function (dialogs, views) {
                var dialog = new dialogs.ModalDialog({ easyOut: true })
                    .header($('<h3>').text('Copy'))
                    .addPrimaryButton("ok", gt("OK"))
                    .addButton("cancel", gt("Cancel"));
                dialog.getBody().css('maxHeight', '250px');
                var item = _(mail).first(),
                    tree = new views.FolderTree(dialog.getBody(), { type: 'mail' });
                tree.paint();
                dialog.show(function () {
                    tree.selection.set({ id: item.folder_id || item.folder });
                })
                .done(function (action) {
                    if (action === 'ok') {
                        var selectedFolder = tree.selection.get();
                        if (selectedFolder.length === 1) {
                            // move action
                            api.copy(mail, selectedFolder[0].id)
                                .done(function () {
                                    notifications.yell('success', 'Mails have been copied');
                                })
                                .fail(notifications.yell);
                        }
                    }
                    tree.destroy();
                    tree = dialog = null;
                });
            });
        }
    });

    new Action('io.ox/mail/actions/markunread', {
        id: 'markunread',
        requires: function (e) {
            return api.getList(e.context).pipe(function (list) {
                var bool = e.collection.has('toplevel') &&
                    _(list).reduce(function (memo, data) {
                        return memo && (data && (data.flags & api.FLAGS.SEEN) === api.FLAGS.SEEN);
                    }, true);
                return bool;
            });
        },
        multiple: function (list) {
            api.markUnread(list);
        }
    });

    new Action('io.ox/mail/actions/markread', {
        id: 'markread',
        requires: function (e) {
            return api.getList(e.context).pipe(function (list) {
                var bool = e.collection.has('toplevel') &&
                    _(list).reduce(function (memo, data) {
                        return memo || (data && (data.flags & api.FLAGS.SEEN) === 0);
                    }, false);
                return bool;
            });
        },
        multiple: function (list) {
            api.markRead(list);
        }
    });

    new Action('io.ox/mail/actions/preview-attachment', {
        id: 'preview',
        requires: function (e) {
            return require(['io.ox/preview/main'])
                .pipe(function (p) {
                    var list = _.getArray(e.context);
                    // is at least one attachment supported?
                    return e.collection.has('some') && _(list).reduce(function (memo, obj) {
                        return memo || new p.Preview({
                            filename: obj.filename,
                            mimetype: obj.content_type
                        })
                        .supportsPreview();
                    }, false);
                });
        },
        multiple: function (list) {
            // open side popup
            var e = $.Event();
            e.target = this;
            require(['io.ox/core/tk/dialogs', 'io.ox/preview/main'], function (dialogs, p) {
                new dialogs.SidePopup().show(e, function (popup) {
                    _(list).each(function (data, i) {
                        var pre = new p.Preview({
                            data: data,
                            filename: data.filename,
                            mimetype: data.content_type,
                            dataURL: api.getUrl(data, 'view')
                        }, {
                            width: popup.parent().width(),
                            height: 'auto'
                        });
                        if (pre.supportsPreview()) {
                            popup.append(
                                $('<h4>').addClass('mail-attachment-preview').text(data.filename)
                            );
                            pre.appendTo(popup);
                            popup.append($('<div>').text('\u00A0'));
                        }
                    });
                });
            });
        }
    });

    new Action('io.ox/mail/actions/open-attachment', {
        id: 'open',
        requires: 'some',
        multiple: function (list) {
            _(list).each(function (data) {
                var url = api.getUrl(data, 'view');
                window.open(url);
            });
        }
    });

    new Action('io.ox/mail/actions/download-attachment', {
        id: 'download',
        requires: 'some',
        multiple: function (list) {
            var url;
            if (list.length === 1) {
                // download single attachment
                url = api.getUrl(_(list).first(), 'download');
            } else {
                // download zip file
                url = api.getUrl(list, 'zip');
            }
            window.open(url);
        }
    });

    new Action('io.ox/mail/actions/save-attachment', {
        id: 'save',
        requires: 'some',
        multiple: function (list) {
            notifications.yell('info', 'Attachments will be saved!');
            api.saveAttachments(list)
                .done(function (data) {
                    notifications.yell('success', 'Attachments have been saved!');
                })
                .fail(notifications.yell);
        }
    });

    new Action('io.ox/mail/actions/save', {
        id: 'saveEML',
        requires: 'some',
        multiple: function (data) {
            window.open(api.getUrl(data, 'eml'));
        }
    });

    //all actions

    new Action('io.ox/mail/actions/createdistlist', {
        id: 'create-distlist',
        requires: 'some',
        action: function (data) {

            var collectedRecipientsArray = data.to.concat(data.cc).concat(data.from),
                collectedRecipients = [],
                dev = $.Deferred(),
                arrayOfMembers = [],
                currentId = ox.user_id,
                lengthValue,
                contactsFolder = config.get('folder.contacts'),

                createDistlist = function (members) {
                    require(['io.ox/contacts/distrib/main'], function (m) {
                        m.getApp().launch().done(function () {
                            this.create(contactsFolder, {distribution_list: members});
                        });
                    });
                };

            _(collectedRecipientsArray).each(function (single) {
                collectedRecipients.push(single[1]);
            });

            lengthValue = collectedRecipients.length;

            _(collectedRecipients).each(function (mail, index) {
                contactAPI.search(mail).done(function (obj) {

                    var currentObj = (obj[0]) ? {id: obj[0].id, folder_id: obj[0].folder_id, display_name: obj[0].display_name, mail: obj[0].email1, mail_field: 1} : {mail: mail, display_name: mail, mail_field: 0};

                    if (obj[0]) {
                        if (obj[0].internal_userid !== currentId) {
                            arrayOfMembers.push(currentObj);
                        } else {
                            lengthValue = lengthValue - 1;
                        }
                    } else {
                        arrayOfMembers.push(currentObj);
                    }

                    if (arrayOfMembers.length === lengthValue) {
                        dev.resolve();
                    }
                });
            });

            dev.done(function () {
                createDistlist(arrayOfMembers);
            });
        }
    });

    new Action('io.ox/mail/actions/invite', {
        id: 'invite',
        requires: 'some',
        action: function (data) {
            var collectedRecipients = [],
                participantsArray = [],
                currentId = ox.user_id,
                currentFolder = config.get('folder.calendar'),
                collectedRecipientsArray = data.to.concat(data.cc).concat(data.from),
                dev = $.Deferred(),
                lengthValue,

                createCalendarApp = function (participants, notetext) {
                    require(['io.ox/calendar/edit/main'], function (m) {
                        m.getApp().launch().done(function () {
                            var initData = {participants: participants, title: notetext, folder_id: currentFolder};
                            this.create(initData);
//                             to set Dirty
                            this.model.toSync = initData;
                        });
                    });
                };

            _(collectedRecipientsArray).each(function (single) {
                collectedRecipients.push(single[1]);
            });

            lengthValue = collectedRecipients.length;

            _(collectedRecipients).each(function (mail, index) {
                contactAPI.search(mail).done(function (obj) {
                    var currentObj = (obj[0]) ? obj[0] : {email1: mail, display_name: mail},
                        internalUser = {id: currentObj.internal_userid, type: 1},
                        externalUser = {type: 5, display_name: currentObj.display_name, mail: currentObj.email1};

                    if (currentObj.internal_userid !== currentId) {
                        if (currentObj.internal_userid !== undefined && currentObj.internal_userid !== 0) {
                            participantsArray.push(internalUser);
                        } else if (currentObj.internal_userid === 0) {
                            participantsArray.push(externalUser);
                        } else {
                            participantsArray.push(externalUser);
                        }
                    } else {
                        lengthValue = lengthValue - 1;
                    }

                    if (participantsArray.length === lengthValue) {
                        dev.resolve();
                    }
                });
            });

            dev.done(function () {
                createCalendarApp(participantsArray, data.subject);
            });
        }
    });

    new Action('io.ox/mail/actions/reminder', {
        id: 'reminder',
        action: function (data) {
            require(['io.ox/core/tk/dialogs', 'io.ox/tasks/api', 'io.ox/tasks/util'],
                    function (dialogs, taskApi, tasksUtil) {
                        //create popup dialog
                        var popup = new dialogs.ModalDialog()
                            .addPrimaryButton('create', gt('Create reminder'))
                            .addButton('cancel', gt('Cancel'));

                        //Header
                        popup.getHeader()
                            .append($("<h4>")
                                    .text(gt('Remind me')));

                        //fill popup body
                        var popupBody = popup.getBody();

                        popupBody.append($('<div>').text(gt('Subject')));
                        var titleInput = $('<input>', { type: 'text', value: gt('Mail reminder') + ': ' + data.subject, width: '90%' })
                            .focus(function () {
                                    this.select();
                                })
                            .appendTo(popupBody);

                        popupBody.append("<div>" + gt('Note') + "</div>");
                        var noteInput = $('<textarea>', { width: '90%', rows: "5", value: gt('Mail reminder for') + ": " + data.subject + " \n" +
                            gt('From') + ": " + data.from[0][0] + ", " + data.from[0][1] })
                            .focus(function ()
                                    {
                                    this.select();
                                })
                            .appendTo(popupBody);


                        popupBody.append("<div>" + gt('Remind me') + "</div>");
                        var dateSelector = $('<select>', {name: "dateselect"})
                        .appendTo(popupBody);
                        var endDate = new Date();
                        dateSelector.append(tasksUtil.buildDropdownMenu(endDate));


                        //ready for work
                        var def = popup.show();
                        titleInput.focus();
                        def.done(function (action) {

                                if (action === "create")
                                    {

                                    //Calculate the right time
                                    var dates = tasksUtil.computePopupTime(endDate, dateSelector.find(":selected").attr("finderId"));

                                    taskApi.create({title: titleInput.val(),
                                        folder_id: config.get('folder.tasks'),
                                        end_date: dates.endDate.getTime(),
                                        start_date: dates.endDate.getTime(),
                                        alarm: dates.alarmDate.getTime(),
                                        note: noteInput.val(),
                                        status: 1,
                                        recurrence_type: 0,
                                        percent_completed: 0
                                        })
                                        .done(function () {
                                            notifications.yell('success', 'Reminder has been created!');
                                        });
                                }
                            });
                    });

        }
    });

    // toolbar

    ext.point('io.ox/mail/links/toolbar').extend(new links.Button({
        index: 100,
        id: 'compose',
        label: gt('Compose new mail'),
        cssClasses: 'btn btn-primary',
        ref: 'io.ox/mail/actions/compose'
    }));

    // inline links

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: 100,
        prio: 'hi',
        id: 'reply-all',
        label: gt('Reply All'),
        ref: 'io.ox/mail/actions/reply-all'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: 200,
        prio: 'hi',
        id: 'reply',
        label: gt('Reply'),
        ref: 'io.ox/mail/actions/reply'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: 300,
        prio: 'lo',
        id: 'forward',
        label: gt('Forward'),
        ref: 'io.ox/mail/actions/forward'
    }));

    // edit draft
    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: 400,
        prio: 'hi',
        id: 'edit',
        label: gt('Edit'),
        ref: 'io.ox/mail/actions/edit'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: 500,
        prio: 'hi',
        id: 'markunread',
        label: gt('Mark Unread'),
        ref: 'io.ox/mail/actions/markunread'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: 501,
        prio: 'hi',
        id: 'markread',
        label: gt('Mark read'),
        ref: 'io.ox/mail/actions/markread'
    }));

    new Action('io.ox/mail/actions/label', {
        id: 'label',
        requires: 'toplevel some',
        multiple: $.noop
    });

//    ext.point('io.ox/mail/links/inline').extend(new links.Link({
//        index: 600,
//        prio: 'lo',
//        id: 'label',
//        ref: 'io.ox/mail/actions/label',
//        draw: function (data) {
//            this.append(
//                $('<span class="dropdown" class="io-ox-inline-links" data-prio="lo">')
//                .append(
//                    // link
//
//                )
//            );
//        }
//    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: 700,
        prio: 'lo',
        id: 'move',
        label: gt('Move'),
        ref: 'io.ox/mail/actions/move'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: 800,
        prio: 'lo',
        id: 'copy',
        label: gt('Copy'),
        ref: 'io.ox/mail/actions/copy'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: 900,
        prio: 'lo',
        id: 'source',
        label: gt('View Source'),
        ref: 'io.ox/mail/actions/source'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: 1000,
        prio: 'hi',
        id: 'delete',
        label: gt('Delete'),
        ref: 'io.ox/mail/actions/delete'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: 1100,
        prio: 'hi',
        id: 'reminder',
        label: gt("Reminder"),
        ref: 'io.ox/mail/actions/reminder'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: 1200,
        prio: 'lo',
        id: 'saveEML',
        label: gt('Save as EML'),
        ref: 'io.ox/mail/actions/save'
    }));

    // Attachments

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'preview',
        index: 100,
        label: gt('Preview'),
        ref: 'io.ox/mail/actions/preview-attachment'
    }));

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'open',
        index: 200,
        label: gt('Open in new tab'),
        ref: 'io.ox/mail/actions/open-attachment'
    }));

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'download',
        index: 300,
        label: gt('Download'),
        ref: 'io.ox/mail/actions/download-attachment'
    }));

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'save',
        index: 400,
        label: gt('Save in file store'),
        ref: 'io.ox/mail/actions/save-attachment'
    }));

    ext.point('io.ox/mail/all/actions').extend(new links.Link({
        id: 'save-as-distlist',
        index: 100,
        label: gt('Save as distribution list'),
        ref: 'io.ox/mail/actions/createdistlist'
    }));

    ext.point('io.ox/mail/all/actions').extend(new links.Link({
        id: 'invite-to-appointment',
        index: 200,
        label: gt('Invite to appointment'),
        ref: 'io.ox/mail/actions/invite'
    }));

    // DND actions

    ext.point('io.ox/mail/dnd/actions').extend({
        id: 'importEML',
        index: 10,
        label: gt('Drop here to import this mail'),
        action: function (file, app) {
            app.queues.importEML.offer(file);
        }
    });

});
