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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */

define('io.ox/mail/actions',
    ['io.ox/core/extensions',
     'io.ox/core/extPatterns/links',
     'io.ox/mail/api',
     'io.ox/mail/util',
     'gettext!io.ox/mail',
     'settings!io.ox/core',
     'io.ox/core/api/folder',
     'io.ox/core/notifications',
     'io.ox/core/print',
     'io.ox/contacts/api',
     'io.ox/core/api/account',
     'io.ox/core/extPatterns/actions',
     'settings!io.ox/mail'
    ], function (ext, links, api, util, gt, coreConfig, folderAPI, notifications, print, contactAPI, account, actions, settings) {

    'use strict';

    var isDraftFolder = function (folder_id) {
            return _.contains(account.getFoldersByType('drafts'), folder_id);
        },
        isDraftMail = function (mail) {
            return isDraftFolder(mail.folder_id) || ((mail.flags & 4) > 0);
        },
        Action = links.Action;

    // actions

    new Action('io.ox/mail/actions/unselect', {
        requires: function (e) {
            return e.collection.has('toplevel', 'multiple');
        },
        multiple: function (list, baton) {
            if (baton.grid) baton.grid.selection.clear();
        }
    });

    new Action('io.ox/mail/actions/compose', {
        id: 'compose',
        action: function (baton) {
            require(['io.ox/mail/write/main'], function (m) {
                m.getApp().launch().done(function () {
                    this.compose({ folder_id: baton.app.folder.get() });
                });
            });
        }
    });

    new Action('io.ox/mail/actions/delete', {
        id: 'delete',
        requires: 'toplevel some delete',
        multiple: function (list) {
            var check = settings.get('removeDeletedPermanently') || _(list).any(function (o) {
                return account.is('trash', o.folder_id);
            });

            var question = gt.ngettext(
                'Do you want to permanently delete this mail?',
                'Do you want to permanently delete these mails?',
                list.length
            );

            if (check) {
                require(['io.ox/core/tk/dialogs'], function (dialogs) {
                    new dialogs.ModalDialog()
                        .append(
                            $('<div>').text(question)
                        )
                        .addPrimaryButton('delete', gt('Delete'))
                        .addButton('cancel', gt('Cancel'))
                        .on('delete', function () {
                            api.remove(list).fail(notifications.yell);
                        })
                        .show();
                });
            } else {
                api.remove(list).done(function () {
                }).fail(function (e) {
                    // mail quota exceeded?
                    if (e.code === 'MSG-0039') {
                        require(['io.ox/core/tk/dialogs'], function (dialogs) {
                            new dialogs.ModalDialog()
                                .header(
                                    $('<h4>').text(gt('Mail quota exceeded'))
                                )
                                .append(
                                    $('<div>').text(gt('Emails cannot be put into trash folder while your mail quota is exceeded.')),
                                    $('<div>').text(question)
                                )
                                .addPrimaryButton('delete', gt('Delete'))
                                .addButton('cancel', gt('Cancel'))
                                .on('delete', function () {
                                    api.remove(list, { force: true });
                                })
                                .show();
                        });
                    } else {
                        notifications.yell(e);
                    }
                });
            }
        }
    });

    new Action('io.ox/mail/actions/reply-all', {
        id: 'reply-all',
        requires: function (e) {
            // other recipients that me?
            return e.collection.has('toplevel', 'one') &&
                util.hasOtherRecipients(e.context) && !isDraftMail(e.context);
        },
        action: function (baton) {
            require(['io.ox/mail/write/main'], function (m) {
                if (m.reuse('replyall', baton.data)) return;
                m.getApp().launch().done(function () {
                    this.replyall(baton.data);
                });
            });
        }
    });

    new Action('io.ox/mail/actions/reply', {
        id: 'reply',
        requires: function (e) {
            return e.collection.has('toplevel', 'one') && util.hasFrom(e.context) && !isDraftMail(e.context);
        },
        action: function (baton) {
            require(['io.ox/mail/write/main'], function (m) {
                if (m.reuse('reply', baton.data)) return;
                m.getApp().launch().done(function () {
                    this.reply(baton.data);
                });
            });
        }
    });

    new Action('io.ox/mail/actions/forward', {
        id: 'forward',
        requires: function (e) {
            return e.collection.has('toplevel', 'some');
        },
        action: function (baton) {
            require(['io.ox/mail/write/main'], function (m) {
                if (m.reuse('forward', baton.data)) return;
                m.getApp().launch().done(function () {
                    this.forward(baton.data);
                });
            });
        }
    });

    new Action('io.ox/mail/actions/edit', {
        id: 'edit',
        requires: function (e) {
            return e.collection.has('toplevel', 'one') && isDraftMail(e.context);
        },
        action: function (baton) {
            require(['io.ox/mail/write/main'], function (m) {
                m.getApp().launch().done(function () {
                    this.edit(baton.data);
                });
            });
        }
    });

    new Action('io.ox/mail/actions/source', {
        id: 'source',
        requires: 'toplevel one',
        action: function (baton) {
            var getSource = api.getSource(baton.data), textarea;
            require(['io.ox/core/tk/dialogs'], function (dialogs) {
                new dialogs.ModalDialog({ width: 700 })
                    .addPrimaryButton('close', gt('Close'))
                    .header(
                        $('<h4>').text(gt('Mail source') + ': ' + (baton.data.subject || ''))
                    )
                    .append(
                        textarea = $('<textarea class="mail-source-view" rows="15" readonly="readonly">')
                        .on('keydown', function (e) {
                            if (e.which !== 27) {
                                e.stopPropagation();
                            }
                        })
                    )
                    .show(function () {
                        var self = this.busy();
                        getSource.done(function (src) {
                            textarea.val(src || '').css({ visibility: 'visible',  cursor: 'default' });
                            textarea = getSource = null;
                            self.idle();
                        });
                    });
            });
        }
    });

    new Action('io.ox/mail/actions/print', {
        requires: function (e) {
            return e.collection.has('some', 'read') && _.device('!small');
        },
        multiple: function (list) {
            print.request('io.ox/mail/print', list);
        }
    });

    /*
     *  Move and Copy
     */

    function generate(type, label, success) {

        new Action('io.ox/mail/actions/' + type, {
            id: type,
            requires: 'toplevel some',
            multiple: function (list, baton) {
                var vGrid = baton.grid || ('app' in baton && baton.app.getGrid());

                require(['io.ox/core/tk/dialogs', 'io.ox/core/tk/folderviews'], function (dialogs, views) {

                    function commit(target) {
                        if (type === 'move' && vGrid) vGrid.busy();
                        api[type](list, target).then(
                            function (resp) {
                                if (resp) {
                                    notifications.yell('error', resp);
                                } else {
                                    notifications.yell('success', list.length > 1 ? success.multi : success.single);
                                }
                                folderAPI.reload(target, list);
                                if (type === 'move' && vGrid) vGrid.idle();
                            },
                            notifications.yell
                        );
                    }

                    if (baton.target) {
                        if (list[0].folder_id !== baton.target) {
                            commit(baton.target);
                        }

                    } else {
                        var dialog = new dialogs.ModalDialog()
                            .header($('<h4>').text(label))
                            .addPrimaryButton('ok', label)
                            .addButton('cancel', gt('Cancel'));
                        dialog.getBody().css({ height: '250px' });
                        var folderId = String(list[0].folder_id),
                            id = settings.get('folderpopup/last') || folderId,
                            tree = new views.FolderTree(dialog.getBody(), {
                                type: 'mail',
                                open: settings.get('folderpopup/open', []),
                                tabindex: 0,
                                toggle: function (open) {
                                    settings.set('folderpopup/open', open).save();
                                },
                                select: function (id) {
                                    settings.set('folderpopup/last', id).save();
                                }
                            });
                        dialog.show(function () {
                            tree.paint().done(function () {
                                tree.select(id).done(function () {
                                    dialog.getBody().focus();
                                });
                            });
                        })
                        .done(function (action) {
                            if (action === 'ok') {
                                var target = _(tree.selection.get()).first();
                                if (target && (type === 'copy' || target !== folderId)) {
                                    commit(target);
                                }
                            }
                            tree.destroy().done(function () {
                                tree = dialog = null;
                            });
                        });
                    }
                });
            }
        });
    }

    generate('move', gt('Move'), { multi: gt('Mails have been moved'), single: gt('Mail has been moved') });
    generate('copy', gt('Copy'), { multi: gt('Mails have been copied'), single: gt('Mail has been copied') });

    new Action('io.ox/mail/actions/markunread', {
        id: 'markunread',
        requires: function (e) {
            var data = e.context;

            if (_.isArray(data)) {
                var read = false;
                //don't use each here because you cannot cancel it if one read mail was found
                for (var i = 0; i < data.length; i++) {
                    if (!api.tracker.isUnseen(data[i])) {
                        read = true;
                        break;
                    }
                }
                return read;
            }
            return e.collection.has('toplevel') && data && (data.flags & api.FLAGS.SEEN) === api.FLAGS.SEEN;
        },
        multiple: function (list) {
            var self = this;
            api.markUnread(list).done(function () {
                $(self).parents('.io-ox-multi-selection').trigger('redraw');
            });
        }
    });

    new Action('io.ox/mail/actions/markread', {
        id: 'markread',
        requires: function (e) {
            var data = e.context;

            if (_.isArray(data)) {
                var unRead = false;
                //don't use each here because you cannot cancel it if one unread mail was found
                for (var i = 0; i < data.length; i++) {
                    if (api.tracker.isUnseen(data[i])) {
                        unRead = true;
                        break;
                    }
                }
                return unRead;
            }
            return e.collection.has('toplevel') && data && (data.flags & api.FLAGS.SEEN) === 0;
        },
        multiple: function (list) {
            var self = this;
            api.markRead(list).done(function () {
                $(self).parents('.io-ox-multi-selection').trigger('redraw');
            });
        }
    });

    // SPAM

    new Action('io.ox/mail/actions/spam', {
        capabilities: 'spam',
        requires: function (e) {
            return e.collection.isLarge() || api.getList(e.context).pipe(function (list) {
                var bool = e.collection.has('toplevel') &&
                    _(list).reduce(function (memo, data) {
                        return memo || (!account.is('spam', data.folder_id) && !util.isSpam(data));
                    }, false);
                return bool;
            });
        },
        multiple: function (list) {
            api.markSpam(list);
        }
    });

    new Action('io.ox/mail/actions/nospam', {
        capabilities: 'spam',
        requires: function (e) {
            return e.collection.isLarge() || api.getList(e.context).pipe(function (list) {
                var bool = e.collection.has('toplevel') &&
                    _(list).reduce(function (memo, data) {
                        return memo || account.is('spam', data.folder_id) || util.isSpam(data);
                    }, false);
                return bool;
            });
        },
        multiple: function (list) {
            api.noSpam(list);
        }
    });

    // Attachments

    new Action('io.ox/mail/actions/preview-attachment', {
        id: 'preview',
        requires: function (e) {
            return require(['io.ox/preview/main']).pipe(function (p) {
                var list = _.getArray(e.context);
                // is at least one attachment supported?
                return e.collection.has('some') && _.device('!smartphone') && _(list).reduce(function (memo, obj) {
                    return memo || new p.Preview({
                        filename: obj.filename,
                        mimetype: obj.content_type
                    })
                    .supportsPreview();
                }, false);
            });
        },
        multiple: function (list, baton) {
            //remove last element from id-list if previewing during compose (forward mail as attachment)
            var adjustFn = list[0].parent.adjustid || '';
            list[0].id = _.isFunction(adjustFn) ? adjustFn(list[0].id) : list[0].id;
            // open side popup
            require(['io.ox/core/tk/dialogs', 'io.ox/preview/main'], function (dialogs, p) {
                new dialogs.SidePopup().show(baton.e, function (popup) {
                    _(list).each(function (data) {
                        var pre = new p.Preview({
                            data: data,
                            filename: data.filename,
                            parent: data.parent,
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

    new Action('io.ox/mail/actions/slideshow-attachment', {
        id: 'slideshow',
        requires: function (e) {
            return e.collection.has('multiple') && _(e.context).reduce(function (memo, obj) {
                return memo || (/\.(gif|bmp|tiff|jpe?g|gmp|png)$/i).test(obj.filename);
            }, false);
        },
        multiple: function (list) {
            require(['io.ox/files/carousel'], function (slideshow) {
                var files = _(list).map(function (file) {
                    return {
                        url: api.getUrl(file, 'view'),
                        filename: file.filename
                    };
                });
                slideshow.init({
                    fullScreen: false,
                    baton: {allIds: files},
                    attachmentMode: true
                });
            });
        }
    });

    new Action('io.ox/mail/actions/download-attachment', {
        id: 'download',
        requires: function (e) {
            return _.device('!ios') && e.collection.has('some');
        },
        multiple: function (list) {

            // download single attachment or zip file
            var url = list.length === 1 ?
                api.getUrl(_(list).first(), 'download') :
                api.getUrl(list, 'zip');

            // download via iframe
            require(['io.ox/core/download'], function (download) {
                download.url(url);
            });
        }
    });

    new Action('io.ox/mail/actions/save-attachment', {
        id: 'save',
        capabilities: 'infostore',
        requires: 'some',
        multiple: function (list) {
            require(['io.ox/mail/actions/attachmentSave'], function (action) {
                action.multiple(list);
            });
        }
    });

    new Action('io.ox/mail/actions/vcard', {
        id: 'vcard',
        capabilities: 'contacts',
        requires: function (e) {
            var context = e.context,
                hasRightSuffix = (/\.vcf$/i).test(context.filename),
                isVCardType = (/^text\/(x-)?vcard/i).test(context.content_type),
                isDirectoryType = (/^text\/directory/i).test(context.content_type);
            return  (hasRightSuffix && isDirectoryType) || isVCardType;
        },
        action: function (baton) {
            var attachment = baton.data;
            require(['io.ox/core/api/conversion']).done(function (conversionAPI) {
                conversionAPI.convert({
                    identifier: 'com.openexchange.mail.vcard',
                    args: [
                        {'com.openexchange.mail.conversion.fullname': attachment.parent.folder_id},
                        {'com.openexchange.mail.conversion.mailid': attachment.parent.id},
                        {'com.openexchange.mail.conversion.sequenceid': attachment.id}
                    ]
                }, {
                    identifier: 'com.openexchange.contact.json',
                    args: []
                })
                .then(
                    function success(data) {

                        if (!_.isArray(data) || data.length === 0) {
                            notifications.yell('error', gt('Failed to add. Maybe the vCard attachment is invalid.'));
                            return;
                        }

                        var contact = data[0], folder = coreConfig.get('folder/contacts');

                        if (contact.mark_as_distributionlist) {
                            // edit distribution list
                            require(['io.ox/contacts/distrib/main'], function (m) {
                                m.getApp(contact).launch().done(function () {
                                    this.create(folder, contact);
                                });
                            });
                        } else {
                            // edit contact
                            require(['io.ox/contacts/edit/main'], function (m) {
                                contact.folder_id = folder;
                                if (m.reuse('edit', contact)) {
                                    return;
                                }
                                m.getApp(contact).launch();
                            });
                        }
                    },
                    function fail(e) {
                        notifications.yell(e);
                    }
                );
            });
        }
    });

    new Action('io.ox/mail/actions/ical', {
        id: 'ical',
        capabilities: 'calendar',
        requires: function (e) {
            var context = e.context,
                hasRightSuffix = context.filename && !!context.filename.match(/\.ics$/i),
                isCalendarType = context.content_type  && !!context.content_type.match(/^text\/calendar/i),
                isAppType = context.content_type  && !!context.content_type.match(/^application\/ics/i);
            return hasRightSuffix || isCalendarType || isAppType;
        },
        action: function (baton) {
            var attachment = baton.data;
            require(['io.ox/core/api/conversion']).done(function (conversionAPI) {
                conversionAPI.convert({
                    identifier: 'com.openexchange.mail.ical',
                    args: [
                        {'com.openexchange.mail.conversion.fullname': attachment.parent.folder_id},
                        {'com.openexchange.mail.conversion.mailid': attachment.parent.id},
                        {'com.openexchange.mail.conversion.sequenceid': attachment.id}
                    ]
                },
                {
                    identifier: 'com.openexchange.ical',
                    args: [
                        {'com.openexchange.groupware.calendar.folder': coreConfig.get('folder/calendar')},
                        {'com.openexchange.groupware.task.folder': coreConfig.get('folder/tasks')}
                    ]
                })
                .done(function () {
                    notifications.yell('success', gt('The appointment has been added to your calendar'));
                })
                .fail(notifications.yell);
            });
        }
    });

    new Action('io.ox/mail/actions/save', {
        id: 'saveEML',
        requires: function (e) {
            // ios cannot handle EML download
            return _.device('!ios') && e.collection.has('some', 'read');
        },
        multiple: function (data) {
            var url;
            if (_(data).first().msgref && _.isObject(_(data).first().parent)) {
                //using msgref reference if previewing during compose (forward previewed mail as attachment)
                url = api.getUrl(data, 'eml:reference');
            } else if (!_.isObject(_(data).first().parent)) {
                url = api.getUrl(data, 'eml');
            } else {
                // adjust attachment id for previewing nested email within compose view
                var adjustFn = _(data).first().parent.adjustid || '';
                _(data).first().id = _.isFunction(adjustFn) ? adjustFn(_(data).first().id) : _(data).first().id;
                // download attachment eml
                url = api.getUrl(_(data).first(), 'download');
            }
            // download via iframe
            require(['io.ox/core/download'], function (download) {
                download.url(url);
            });
        }
    });

    new Action('io.ox/mail/actions/add-to-portal', {
        capabilities: 'portal',
        requires: 'one',
        action: function (baton) {
            require(['io.ox/portal/widgets'], function (widgets) {
                //using baton.data.parent if previewing during compose (forward mail as attachment)
                widgets.add('stickymail', {
                    plugin: 'mail',
                    props: $.extend({
                        id: baton.data.id,
                        folder_id: baton.data.folder_id,
                        title: baton.data.subject
                    }, baton.data.parent || {})
                });
                notifications.yell('success', gt('This mail has been added to the portal'));
            });
        }
    });

    // all actions

    new Action('io.ox/mail/actions/sendmail', {
        requires: 'some',
        action: function (baton) {
            var data = baton.data,
                recipients = data.to.concat(data.cc).concat(data.from);
            require(['io.ox/mail/write/main'], function (m) {
                m.getApp().launch().done(function () {
                    this.compose({ folder_id: data.folder_id, to: recipients });
                });
            });
        }
    });

    new Action('io.ox/mail/actions/createdistlist', {
        id: 'create-distlist',
        capabilities: 'contacts',
        requires: 'some',
        action: function (baton) {

            var data = baton.data,
                collectedRecipients = [].concat(data.to, data.cc, data.from),
                dev = $.Deferred(),
                arrayOfMembers = [],
                currentId = ox.user_id,
                lengthValue,
                contactsFolder = coreConfig.get('folder/contacts'),

                createDistlist = function (members) {
                    require(['io.ox/contacts/distrib/main'], function (m) {
                        m.getApp().launch().done(function () {
                            this.create(contactsFolder, { distribution_list: members });
                        });
                    });
                };

            collectedRecipients = _(collectedRecipients).chain()
                .map(function (obj) {
                    return obj[1];
                })
                .uniq()
                .value();

            // get length now to know when done
            lengthValue = collectedRecipients.length;

            _(collectedRecipients).each(function (mail) {
                contactAPI.search(mail).done(function (results) {

                    var currentObj, result = results[0];

                    if (result) {
                        // found via search
                        currentObj = {
                            id: result.id,
                            folder_id: result.folder_id,
                            display_name: result.display_name,
                            mail: result.email1,
                            mail_field: 1
                        };
                        if (result.internal_userid !== currentId) {
                            arrayOfMembers.push(currentObj);
                        } else {
                            lengthValue = lengthValue - 1;
                        }
                    } else {
                        // manual add
                        currentObj = {
                            display_name: mail,
                            mail: mail,
                            mail_field: 0
                        };
                        arrayOfMembers.push(currentObj);
                    }

                    // done?
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
        capabilities: 'calendar',
        requires: 'some',
        action: function (baton) {
            var data = baton.data,
                collectedRecipients = [],
                participantsArray = [],
                currentId = ox.user_id,
                currentFolder = coreConfig.get('folder/calendar'),
                collectedRecipientsArray = data.to.concat(data.cc).concat(data.from),
                dev = $.Deferred(),
                lengthValue,
                createCalendarApp = function (participants, notetext) {
                    require(['io.ox/calendar/edit/main'], function (m) {
                        m.getApp().launch().done(function () {
                            //remove participants received mail via msisdn
                            participants = _.filter(participants, function (participant) {
                                if (participant.mail)
                                    return util.getChannel(participant.mail, false) !== 'phone';
                                return true;
                            });
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

            _(collectedRecipients).each(function (mail) {
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
        capabilities: 'tasks',
        requires: 'one',
        action: function (baton) {
            var data = baton.data;
            require(['io.ox/core/tk/dialogs', 'io.ox/tasks/api', 'io.ox/tasks/util'], function (dialogs, taskAPI, tasksUtil) {
                //create popup dialog
                var popup = new dialogs.ModalDialog()
                    .addPrimaryButton('create', gt('Create reminder'))
                    .addButton('cancel', gt('Cancel'));

                //Header
                popup.getHeader()
                    .append($('<h4>')
                            .text(gt('Remind me')));

                //fill popup body
                var popupBody = popup.getBody();

                popupBody.append($('<div>').text(gt('Subject')));
                var titleInput = $('<input>', { type: 'text', value: gt('Mail reminder') + ': ' + data.subject, width: '90%' })
                    .focus(function () {
                            this.select();
                        })
                    .appendTo(popupBody);

                popupBody.append('<div>' + gt('Note') + '</div>');
                var noteInput = $('<textarea>', { width: '90%', rows: '5', value: gt('Mail reminder for') + ': ' + data.subject + ' \n' +
                    gt('From') + ': ' + util.formatSender(data.from[0]) })
                    .focus(function () {
                        this.select();
                    })
                    .appendTo(popupBody);

                popupBody.append('<div>' + gt('Remind me') + '</div>');
                var dateSelector = $('<select>', {name: 'dateselect'})
                .appendTo(popupBody);
                var endDate = new Date();
                dateSelector.append(tasksUtil.buildDropdownMenu({time: endDate}));

                //ready for work
                var def = popup.show();
                titleInput.focus();
                def.done(function (action) {
                    if (action === 'create') {

                        //Calculate the right time
                        var dates = tasksUtil.computePopupTime(endDate, dateSelector.val());

                        taskAPI.create({title: titleInput.val(),
                            folder_id: coreConfig.get('folder/tasks'),
                            end_date: dates.endDate.getTime(),
                            start_date: dates.endDate.getTime(),
                            alarm: dates.alarmDate.getTime(),
                            note: noteInput.val(),
                            status: 1,
                            recurrence_type: 0,
                            percent_completed: 0
                        })
                        .done(function () {
                            notifications.yell('success', gt('Reminder has been created'));
                        });
                    }
                });
            });
        }
    });

    // guidance

    new Action('io.ox/mail/actions/guidance', {
        action: function (baton) {
            require(['io.ox/mail/guidance/main']).done(function (guidance) {
                guidance.sidePopup(baton.app, baton.e);
            });
        }
    });

    // toolbar

    new links.ActionGroup('io.ox/mail/links/toolbar', {
        id: 'default',
        index: 100,
        icon: function () {
            return $('<i class="icon-pencil accent-color">');
        }
    });

    new links.ActionLink('io.ox/mail/links/toolbar/default', {
        index: 100,
        id: 'compose',
        label: gt('Compose new mail'),
        ref: 'io.ox/mail/actions/compose'
    });

    new links.ActionGroup('io.ox/mail/links/toolbar', {
        id: 'guidance',
        index: 400,
        icon: function () {
            return $('<i class="icon-question-sign">');
        }
    });

    new links.ActionLink('io.ox/mail/links/toolbar/guidance', {
        label: gt('Guidance'),
        ref: 'io.ox/mail/actions/guidance'
    });

    // inline links

    var INDEX = 0;

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: 10, // should be first
        prio: 'hi',
        id: 'unselect',
        label: gt('Unselect all'),
        ref: 'io.ox/mail/actions/unselect'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'reply',
        label: gt('Reply'),
        ref: 'io.ox/mail/actions/reply'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'reply-all',
        label: gt('Reply All'),
        ref: 'io.ox/mail/actions/reply-all',
        drawDisabled: true
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'forward',
        label: gt('Forward'),
        ref: 'io.ox/mail/actions/forward'
    }));

    // edit draft
    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'edit',
        label: gt('Edit'),
        ref: 'io.ox/mail/actions/edit'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'delete',
        label: gt('Delete'),
        ref: 'io.ox/mail/actions/delete'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'markunread',
        label:
            //#. Translation should be as short a possible
            //#. Instead of "Mark as unread" or "Mark unread" it's just "Unread"
            //#. German, for example, should be "Ungelesen"
            gt('Unread'),
        ref: 'io.ox/mail/actions/markunread'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX + 1,
        prio: 'hi',
        id: 'markread',
        label:
            //#. Translation should be as short a possible
            //#. Instead of "Mark as read" it's just "Mark read"
            //#. German, for example, should be "Gelesen"
            gt('Mark read'),
        ref: 'io.ox/mail/actions/markread'
    }));

    new Action('io.ox/mail/actions/label', {
        id: 'label',
        requires: 'toplevel some',
        multiple: $.noop
    });

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'spam',
        label: gt('Mark as spam'),
        ref: 'io.ox/mail/actions/spam'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX + 1,
        prio: 'hi',
        id: 'nospam',
        label: gt('Not spam'),
        ref: 'io.ox/mail/actions/nospam'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        id: 'move',
        label: gt('Move'),
        ref: 'io.ox/mail/actions/move'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        id: 'copy',
        label: gt('Copy'),
        ref: 'io.ox/mail/actions/copy'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        id: 'source',
        //#. source in terms of source code
        label: gt('View source'),
        ref: 'io.ox/mail/actions/source'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        id: 'print',
        label: gt('Print'),
        ref: 'io.ox/mail/actions/print'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        id: 'reminder',
        label: gt('Reminder'),
        ref: 'io.ox/mail/actions/reminder'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        id: 'add-to-portal',
        label: gt('Add to portal'),
        ref: 'io.ox/mail/actions/add-to-portal'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        id: 'saveEML',
        label: gt('Save as file'),
        ref: 'io.ox/mail/actions/save'
    }));

    // Attachments

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'vcard',
        index: 50,
        label: gt('Add to address book'),
        ref: 'io.ox/mail/actions/vcard'
    }));

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'ical',
        index: 50,
        label: gt('Add to calendar'),
        ref: 'io.ox/mail/actions/ical'
    }));

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'slideshow',
        index: 100,
        label: gt('Slideshow'),
        ref: 'io.ox/mail/actions/slideshow-attachment'
    }));

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'preview',
        index: 200,
        label: gt('Preview'),
        ref: 'io.ox/mail/actions/preview-attachment'
    }));

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'open',
        index: 300,
        label: gt('Open in browser'),
        ref: 'io.ox/mail/actions/open-attachment'
    }));

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'download',
        index: 400,
        label: gt('Download'),
        ref: 'io.ox/mail/actions/download-attachment'
    }));

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'save',
        index: 500,
        label: gt('Save in file store'),
        ref: 'io.ox/mail/actions/save-attachment'
    }));

    ext.point('io.ox/mail/all/actions').extend(new links.Link({
        id: 'sendmail',
        index: 100,
        label: gt('Send new mail'),
        ref: 'io.ox/mail/actions/sendmail'
    }));

    ext.point('io.ox/mail/all/actions').extend(new links.Link({
        id: 'save-as-distlist',
        index: 200,
        label: gt('Save as distribution list'),
        ref: 'io.ox/mail/actions/createdistlist'
    }));

    ext.point('io.ox/mail/all/actions').extend(new links.Link({
        id: 'invite-to-appointment',
        index: 300,
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


    // Mobile multi select extension points
    // action markunread
    ext.point('io.ox/mail/mobileMultiSelect/toolbar').extend({
        id: 'unread',
        index: 10,
        draw: function (data) {
            var selection = data.data,
                allUnread = true;
            // what do we want to do?
            // if all selected mails are unread, show "read" action and vice versa
            for (var i = 0; i < selection.length; i++) {
                if (!api.tracker.isUnseen(selection[i])) {
                    allUnread = false;
                }
            }

            var baton = new ext.Baton({data: data.data});
            $(this).append($('<div class="toolbar-button">')
                .append($('<a href="#">')
                    .append(
                        $('<i>')
                            .addClass((allUnread ? 'icon-envelope' : 'icon-envelope-alt'))
                            .on('click', function (e) {
                                e.preventDefault();
                                e.stopPropagation();
                                actions.invoke('io.ox/mail/actions/' + (allUnread ? 'markread' : 'markunread'), null, baton);
                            })
                    )
                )
            );
        }
    });

    // action delete
    ext.point('io.ox/mail/mobileMultiSelect/toolbar').extend({
        id: 'delete',
        index: 20,
        draw: function (data) {
            var baton = new ext.Baton({data: data.data});
            $(this).append($('<div class="toolbar-button">')
                .append($('<a href="#">')
                    .append(
                        $('<i class="icon-trash">').on('tap', function (e) {
                            e.preventDefault();
                            e.stopPropagation();
                            actions.invoke('io.ox/mail/actions/delete', null, baton);
                        })
                    )
                )
            );
        }
    });
    // action move
    ext.point('io.ox/mail/mobileMultiSelect/toolbar').extend({
        id: 'move',
        index: 30,
        draw: function (data) {
            var baton = new ext.Baton({data: data.data});
            $(this).append($('<div class="toolbar-button">')
                .append($('<a href="#">')
                    .append(
                        $('<i class="icon-signin">').on('tap', function (e) {
                            e.preventDefault();
                            e.stopPropagation();
                            actions.invoke('io.ox/mail/actions/move', null, baton);
                        })
                    )
                )
            );
        }
    });

});
