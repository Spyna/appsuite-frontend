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

define('io.ox/mail/actions', [
    'io.ox/core/extensions',
    'io.ox/core/extPatterns/links',
    'io.ox/mail/api',
    'io.ox/mail/util',
    'gettext!io.ox/mail',
    'io.ox/core/folder/api',
    'io.ox/core/print',
    'io.ox/core/api/account'
], function (ext, links, api, util, gt, folderAPI, print, account) {

    'use strict';

    var isDraftFolder = function (folder_id) {
            return _.contains(account.getFoldersByType('drafts'), folder_id);
        },
        isDraftMail = function (mail) {
            return isDraftFolder(mail.folder_id) || ((mail.flags & 4) > 0);
        },
        Action = links.Action;

    // actions

    new Action('io.ox/mail/actions/compose', {
        id: 'compose',
        requires: function () {
            return true;
        },
        action: function (baton) {
            ox.registry.call('mail-compose', 'compose', { folder_id: baton.app.folder.get() });
        }
    });

    new Action('io.ox/mail/actions/delete', {
        id: 'delete',
        requires: 'toplevel some delete',
        multiple: function (list) {
            require(['io.ox/mail/actions/delete'], function (action) {
                action.multiple(list);
            });
        }
    });

    new Action('io.ox/mail/actions/reply-all', {
        id: 'reply-all',
        requires: function (e) {
            // must be top-level
            if (!e.collection.has('toplevel', 'some')) return;
            // multiple and not a thread?
            if (!e.collection.has('one') && !e.baton.isThread) return;
            // get first mail
            var data = e.baton.first();
            // other recipients that me? and not a draft mail
            return util.hasOtherRecipients(data) && !isDraftMail(data);
        },
        action: function (baton) {
            ox.registry.call('mail-compose', 'replyall', baton.first());
        }
    });

    new Action('io.ox/mail/actions/reply', {
        id: 'reply',
        requires: function (e) {
            // must be top-level
            if (!e.collection.has('toplevel', 'some')) return;
            // multiple and not a thread?
            if (!e.collection.has('one') && !e.baton.isThread) return;
            // get first mail
            var data = e.baton.first();
            // has sender? and not a draft mail
            return util.hasFrom(data) && !isDraftMail(data);
        },
        action: function (baton) {
            ox.registry.call('mail-compose', 'reply', baton.first());
        }
    });

    new Action('io.ox/mail/actions/forward', {
        id: 'forward',
        requires: function (e) {
            return e.collection.has('toplevel', 'some');
        },
        action: function (baton) {
            ox.registry.call('mail-compose', 'forward', baton.isThread ? baton.first() : baton.data);
        }
    });

    new Action('io.ox/mail/actions/edit', {
        id: 'edit',
        requires: function (e) {
            // must be top-level
            if (!e.collection.has('toplevel')) return;
            // multiple and not a thread?
            if (!e.collection.has('one') && !e.baton.isThread) return;
            // get first mail
            var data = e.baton.first();
            // must be draft folder
            return data && isDraftMail(data);
        },
        action: function (baton) {
            var data = baton.first(),
                check = false;
            _.each(ox.ui.apps.models, function (app) {
                if (app.refId === data.id) {
                    check = true;
                    app.launch();
                }
            });
            if (check === true) return;

            ox.registry.call('mail-compose', 'edit', data);
        }
    });

    new Action('io.ox/mail/actions/source', {
        id: 'source',
        requires: function (e) {
            // must be at least one message and top-level
            if (!e.collection.has('some') || !e.collection.has('toplevel')) return;
            // multiple and not a thread?
            if (!e.collection.has('one') && !e.baton.isThread) return;
            // get first mail
            return true;
        },
        action: function (baton) {
            require(['io.ox/mail/actions/source'], function (action) {
                action(baton);
            });
        }
    });

    new Action('io.ox/mail/actions/print', {
        requires: function (e) {
            // not on smartphones
            if (_.device('smartphone')) return false;
            // need some and either read access or being embedded
            return e.collection.has('some') && (e.collection.has('read') || !e.collection.has('toplevel'));
        },
        multiple: function (list) {
            print.request('io.ox/mail/print', list);
        }
    });

    new Action('io.ox/mail/actions/archive', {
        requires: function (e) {
            if (!e.collection.has('some')) return false;

            return _(e.baton.array()).reduce(function (memo, obj) {
                // already false?
                if (memo === false) return false;
                // is not primary account?
                if (!account.isPrimary(obj.folder_id)) return false;
                // is unified folder (may be external)
                if (account.isUnifiedFolder(obj.folder_id)) return false;
                // is in a subfolder of archive?
                if (account.is('archive', obj.folder_id)) return false;
                // else
                return true;
            }, true);
        },
        action: function (baton) {
            var list = _.isArray(baton.data) ? baton.data : [ baton.data ];

            api.archive(list);
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
                require(['io.ox/mail/actions/copyMove'], function (action) {
                    action.multiple({
                        list: list,
                        baton: baton,
                        type: type,
                        label: label,
                        success: success
                    });
                });
            }
        });
    }

    generate('move', gt('Move'), { multiple: gt('Mails have been moved'), single: gt('Mail has been moved') });
    generate('copy', gt('Copy'), { multiple: gt('Mails have been copied'), single: gt('Mail has been copied') });

    new Action('io.ox/mail/actions/markunread', {
        id: 'markunread',
        requires: function (e) {
            // must be top-level
            if (!e.collection.has('toplevel')) return;
            // partiallySeen? has at least one email that's seen?
            return _(e.baton.array()).reduce(function (memo, obj) {
                return memo || !util.isUnseen(obj);
            }, false);
        },
        multiple: function (list) {
            // we don't process sent items
            list = folderAPI.ignoreSentItems(list);
            api.markUnread(list);
        }
    });

    new Action('io.ox/mail/actions/markread', {
        id: 'markread',
        requires: function (e) {
            // must be top-level
            if (!e.collection.has('toplevel')) return;
            // partiallyUnseen? has at least one email that's seen?
            return _(e.baton.array()).reduce(function (memo, obj) {
                return memo || util.isUnseen(obj);
            }, false);
        },
        multiple: function (list) {
            // we don't process sent items
            list = folderAPI.ignoreSentItems(list);
            api.markRead(list);
        }
    });

    // SPAM

    new Action('io.ox/mail/actions/spam', {
        capabilities: 'spam',
        requires: function (e) {
            // must be top-level
            if (!e.collection.has('toplevel', 'some')) return false;
            // is spam?
            return _(e.baton.array()).reduce(function (memo, obj) {
                // already false?
                if (memo === false) return false;
                // is not primary account?
                if (!account.isPrimary(obj.folder_id)) return false;
                // is spam folder?
                if (account.is('spam', obj.folder_id)) return false;
                // is marked as spam already?
                if (util.isSpam(obj)) return false;
                // else
                return true;
            }, true);
        },
        multiple: function (list) {
            api.markSpam(list);
        }
    });

    new Action('io.ox/mail/actions/nospam', {
        capabilities: 'spam',
        requires: function (e) {
            // must be top-level
            if (!e.collection.has('toplevel', 'some')) return false;
            // is spam?
            return _(e.baton.array()).reduce(function (memo, obj) {
                // already false?
                if (memo === false) return false;
                // is not primary account?
                if (!account.isPrimary(obj.folder_id)) return false;
                // else
                return account.is('spam', obj.folder_id) || util.isSpam(obj);
            }, true);
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
                        // fixes 'audio/mp3; name="Metallica - 01 - Enter Sandman.mp3"''
                        mimetype: String(obj.content_type || '').split(';')[0],
                        attachment: true
                    })
                    .supportsPreview();
                }, false);
            });
        },
        multiple: function (list, baton) {
            require(['io.ox/mail/actions/previewAttachment'], function (action) {
                action.multiple(list, baton);
            });
        }
    });

    new Action('io.ox/mail/actions/open-attachment', {
        id: 'open',
        requires: 'one',
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
        multiple: function (list, baton) {
            require(['io.ox/mail/actions/slideshowAttachment'], function (action) {
                action.multiple(list, baton);
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
            if (!e.collection.has('one')) {
                return false;
            }
            var context = e.context,
                hasRightSuffix = (/\.vcf$/i).test(context.filename),
                isVCardType = (/^text\/(x-)?vcard/i).test(context.content_type),
                isDirectoryType = (/^text\/directory/i).test(context.content_type);
            return (hasRightSuffix && isDirectoryType) || isVCardType;
        },
        action: function (baton) {
            require(['io.ox/mail/actions/vcard'], function (action) {
                action(baton);
            });
        }
    });

    new Action('io.ox/mail/actions/ical', {
        id: 'ical',
        capabilities: 'calendar',
        requires: function (e) {
            var context = _.isArray(e.context) ? _.first(e.context) : e.context,
                hasRightSuffix = context.filename && !!context.filename.match(/\.ics$/i),
                isCalendarType = context.content_type  && !!context.content_type.match(/^text\/calendar/i),
                isAppType = context.content_type  && !!context.content_type.match(/^application\/ics/i);
            return hasRightSuffix || isCalendarType || isAppType;
        },
        action: function (baton) {
            require(['io.ox/mail/actions/ical'], function (action) {
                action(baton);
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
            require(['io.ox/mail/actions/save'], function (action) {
                action.multiple(data);
            });
        }
    });

    new Action('io.ox/mail/actions/add-to-portal', {
        capabilities: 'portal',
        requires: 'one toplevel',
        action: function (baton) {
            require(['io.ox/mail/actions/addToPortal'], function (action) {
                action(baton);
            });
        }
    });

    // all actions

    new Action('io.ox/mail/actions/sendmail', {
        requires: 'some',
        action: function (baton) {
            var data = baton.data;
            ox.registry.call('mail-compose', 'compose', { folder_id: data.folder_id, to: data.to.concat(data.cc).concat(data.from) });
        }
    });

    new Action('io.ox/mail/actions/createdistlist', {
        id: 'create-distlist',
        capabilities: 'contacts',
        requires: 'some',
        action: function (baton) {
            require(['io.ox/mail/actions/createdistlist'], function (action) {
                action(baton);
            });
        }
    });

    new Action('io.ox/mail/actions/invite', {
        id: 'invite',
        capabilities: 'calendar',
        requires: 'some',
        action: function (baton) {
            require(['io.ox/mail/actions/invite'], function (action) {
                action(baton);
            });
        }
    });

    new Action('io.ox/mail/actions/reminder', {
        id: 'reminder',
        capabilities: 'tasks',
        requires: 'one toplevel',
        action: function (baton) {
            require(['io.ox/mail/actions/reminder'], function (action) {
                action(baton);
            });
        }
    });

    // inline links
    var INDEX = 0;

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'reply',
        mobile: 'hi',
        label: gt('Reply'),
        ref: 'io.ox/mail/actions/reply',
        section: 'standard'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'reply-all',
        mobile: 'hi',
        label: gt('Reply All'),
        ref: 'io.ox/mail/actions/reply-all',
        drawDisabled: true,
        section: 'standard'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'forward',
        mobile: 'hi',
        label: gt('Forward'),
        ref: 'io.ox/mail/actions/forward',
        section: 'standard'
    }));

    // edit draft
    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'edit',
        mobile: 'hi',
        label: gt('Edit'),
        ref: 'io.ox/mail/actions/edit',
        section: 'standard'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'delete',
        mobile: 'hi',
        label: gt('Delete'),
        ref: 'io.ox/mail/actions/delete',
        section: 'standard'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        mobile: 'hi',
        id: 'markunread',
        label:
            //#. Translation should be as short a possible
            //#. Instead of "Mark as unread" it's just "Mark unread"
            //#. German, for example, should be just "Ungelesen"
            gt('Mark unread'),
        ref: 'io.ox/mail/actions/markunread',
        section: 'flags'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX + 1,
        prio: 'hi',
        mobile: 'hi',
        id: 'markread',
        label:
            //#. Translation should be as short a possible
            //#. Instead of "Mark as read" it's just "Mark read"
            //#. German, for example, should be just "Gelesen"
            gt('Mark read'),
        ref: 'io.ox/mail/actions/markread',
        section: 'flags'
    }));

    new Action('io.ox/mail/actions/label', {
        id: 'label',
        requires: 'toplevel some',
        multiple: $.noop
    });

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        mobile: 'hi',
        id: 'spam',
        label: gt('Mark as spam'),
        ref: 'io.ox/mail/actions/spam',
        section: 'flags'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX + 1,
        prio: 'hi',
        mobile: 'hi',
        id: 'nospam',
        label: gt('Not spam'),
        ref: 'io.ox/mail/actions/nospam',
        section: 'flags'
    }));

    // recipients

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        id: 'sendmail',
        index: INDEX += 100,
        prio: 'lo',
        label: gt('Send new mail'),
        ref: 'io.ox/mail/actions/sendmail',
        section: 'recipients'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        id: 'invite-to-appointment',
        index: INDEX += 100,
        prio: 'lo',
        label: gt('Invite to appointment'),
        ref: 'io.ox/mail/actions/invite',
        section: 'recipients'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        id: 'save-as-distlist',
        index: INDEX += 100,
        prio: 'lo',
        label: gt('Save as distribution list'),
        ref: 'io.ox/mail/actions/createdistlist',
        section: 'recipients'
    }));

    // file op

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        mobile: 'lo',
        id: 'move',
        label: gt('Move'),
        ref: 'io.ox/mail/actions/move',
        section: 'file-op'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        mobile: 'lo',
        id: 'copy',
        label: gt('Copy'),
        ref: 'io.ox/mail/actions/copy',
        section: 'file-op'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        mobile: 'hi',
        id: 'archive',
        //#. Verb: (to) archive messages
        label: gt.pgettext('verb', 'Archive'),
        ref: 'io.ox/mail/actions/archive',
        section: 'file-op'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        mobile: 'none',
        id: 'print',
        label: gt('Print'),
        ref: 'io.ox/mail/actions/print',
        section: 'export'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        mobile: 'none',
        id: 'saveEML',
        label: gt('Save as file'),
        ref: 'io.ox/mail/actions/save',
        section: 'export'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        mobile: 'none',
        id: 'source',
        //#. source in terms of source code
        label: gt('View source'),
        ref: 'io.ox/mail/actions/source',
        section: 'export'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        mobile: 'lo',
        id: 'reminder',
        label: gt('Reminder'),
        ref: 'io.ox/mail/actions/reminder',
        section: 'keep'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        mobile: 'none',
        id: 'add-to-portal',
        label: gt('Add to portal'),
        ref: 'io.ox/mail/actions/add-to-portal',
        section: 'keep'
    }));

    // Attachments

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'vcard',
        mobile: 'high',
        index: 50,
        label: gt('Add to address book'),
        ref: 'io.ox/mail/actions/vcard'
    }));

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'ical',
        mobile: 'high',
        index: 50,
        label: gt('Add to calendar'),
        ref: 'io.ox/mail/actions/ical'
    }));

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'slideshow',
        index: 100,
        mobile: 'high',
        label: gt('Slideshow'),
        ref: 'io.ox/mail/actions/slideshow-attachment'
    }));

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'preview',
        index: 200,
        mobile: 'high',
        label: gt('Preview'),
        ref: 'io.ox/mail/actions/preview-attachment'
    }));

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'open',
        index: 300,
        mobile: 'high',
        label: gt('Open in browser'),
        ref: 'io.ox/mail/actions/open-attachment'
    }));

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'download',
        index: 400,
        mobile: 'high',
        label: gt('Download'),
        ref: 'io.ox/mail/actions/download-attachment'
    }));

    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'save',
        index: 500,
        mobile: 'high',
        label: gt('Save to Drive'),
        ref: 'io.ox/mail/actions/save-attachment'
    }));

    // DND actions

    ext.point('io.ox/mail/dnd/actions').extend({
        id: 'importEML',
        index: 10,
        label: gt('Drop here to import this mail'),
        action: function (file, app) {
            app.queues.importEML.offer(file, { folder: app.folder.get() });
        }
    });
});
