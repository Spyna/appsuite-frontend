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
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */
/* global blankshield */
define('io.ox/mail/actions', [
    'io.ox/core/extensions',
    'io.ox/core/extPatterns/links',
    'io.ox/mail/api',
    'io.ox/mail/util',
    'io.ox/core/folder/api',
    'io.ox/core/print',
    'io.ox/core/api/account',
    'io.ox/core/notifications',
    'settings!io.ox/mail',
    'gettext!io.ox/mail',
    'io.ox/core/capabilities'
], function (ext, links, api, util, folderAPI, print, account, notifications, settings, gt, capabilities) {

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
        requires: function () {
            return true;
        },
        action: function (baton) {
            ox.registry.call('mail-compose', 'compose', { folder_id: baton.app.folder.get() });
        }
    });

    new Action('io.ox/mail/actions/delete', {
        requires: 'toplevel some delete',
        multiple: function (list) {
            require(['io.ox/mail/actions/delete'], function (action) {
                action.multiple(list);
            });
        }
    });

    new Action('io.ox/mail/actions/inplace-reply', {
        requires: function (e) {
            // desktop only
            if (!_.device('desktop')) return;
            // feature toggle
            if (!settings.get('features/inplaceReply', true)) return;
            // must be top-level
            if (!e.collection.has('toplevel', 'one')) return;
            // get first mail
            var data = e.baton.first();
            // has sender? not a draft mail and not a decrypted mail
            return util.hasFrom(data) && !isDraftMail(data) && !util.isDecrypted(data);
        },
        action: function (baton) {

            var cid = _.cid(baton.data),
                // needs baton view
                view = baton.view,
                // reply to all, so count, to, from, cc and bcc and subtract 1 (you don't sent the mail to yourself)
                numberOfRecipients = _.union(baton.data.to, baton.data.from, baton.data.cc, baton.data.bcc).length - 1,
                // hide inline link
                link = view.$('[data-ref="io.ox/mail/actions/inplace-reply"]').hide();

            require(['io.ox/mail/inplace-reply'], function (InplaceReplyView) {
                view.$('section.body').before(
                    new InplaceReplyView({ tagName: 'section', cid: cid, numberOfRecipients: numberOfRecipients })
                    .on('send', function (cid) {
                        view.$el.closest('.thread-view-control').data('open', cid);
                    })
                    .on('dispose', function () {
                        link.show().focus();
                        view = link = null;
                    })
                    .render()
                    .$el
                );
            });
        }
    });

    function reply(mode) {
        return function (baton) {
            var data = baton.first();
            require(['io.ox/mail/compose/checks'], function (checks) {
                checks.replyToMailingList(_.cid(data), mode, data).then(function (mode) {
                    ox.registry.call('mail-compose', mode, data);
                });
            });
        };
    }

    new Action('io.ox/mail/actions/reply-all', {
        requires: function (e) {
            // must be top-level
            if (!e.collection.has('toplevel', 'some')) return;
            // multiple selection
            if (e.baton.selection && e.baton.selection.length > 1) return;
            // multiple and not a thread?
            if (!e.collection.has('one') && !e.baton.isThread) return;
            // get first mail
            var data = e.baton.first();
            // has sender? and not a draft mail
            return util.hasFrom(data) && !isDraftMail(data);
        },
        action: reply('replyall')
    });

    new Action('io.ox/mail/actions/reply', {
        requires: function (e) {
            // must be top-level
            if (!e.collection.has('toplevel', 'some')) return;
            // multiple selection
            if (e.baton.selection && e.baton.selection.length > 1) return;
            // multiple and not a thread?
            if (!e.collection.has('one') && !e.baton.isThread) return;
            // get first mail
            var data = e.baton.first();
            // has sender? and not a draft mail
            return util.hasFrom(data) && !isDraftMail(data);
        },
        action: reply('reply')
    });

    new Action('io.ox/mail/actions/forward', {
        requires: function (e) {
            return e.collection.has('toplevel', 'some');
        },
        action: function (baton) {

            var data;
            // Only first mail of thread is selected on multiselection, as most commonly users don't want to forward whole threads
            if (baton.selection && baton.selection.length > 1) {
                data = baton.selection.map(function (o) {
                    return _.cid(o.replace(/^thread./, ''));
                });
            } else {
                data = baton.first();
            }

            ox.registry.call('mail-compose', 'forward', data);
        }
    });

    new Action('io.ox/mail/actions/edit', {
        requires: function (e) {
            // must be top-level
            if (!e.collection.has('toplevel')) return;
            // multiple selection
            if (e.baton.selection && e.baton.selection.length > 1) return;
            // multiple and not a thread?
            if (!e.collection.has('one') && !e.baton.isThread) return;
            // get first mail
            var data = e.baton.first();
            // Can't edit encrypted E-mail
            if (data && data.security_info && data.security_info.encrypted) return;
            // must be draft folder
            return data && isDraftMail(data);
        },
        action: function (baton) {

            var data = baton.first(),
                app = _(ox.ui.apps.models).find(function (model) {
                    return model.refId === data.id;
                });

            // reuse open editor
            if (app) return app.launch();

            require(['settings!io.ox/mail'], function (settings) {

                // Open Drafts in HTML mode if content type is html even if text-editor is default
                if (data.content_type === 'text/html' && settings.get('messageFormat', 'html') === 'text') {
                    data.preferredEditorMode = 'html';
                    data.editorMode = 'html';
                }

                ox.registry.call('mail-compose', 'edit', data);
            });
        }
    });

    new Action('io.ox/mail/actions/edit-copy', {
        requires: function (e) {
            // must be top-level
            if (!e.collection.has('toplevel')) return;
            // multiple selection
            if (e.baton.selection && e.baton.selection.length > 1) return;
            // multiple and not a thread?
            if (!e.collection.has('one') && !e.baton.isThread) return;
            // get first mail
            var data = e.baton.first();
            // Can't edit encrypted E-mail
            if (data && data.security_info && data.security_info.encrypted) return;
            // must be draft folder
            return data && isDraftMail(data);
        },
        action: function (baton) {

            var data = baton.first();

            api.copy(data, data.folder_id).done(function (list) {
                api.refresh();
                ox.registry.call('mail-compose', 'edit', list[0]).done(function (window) {
                    var model = window.app.model;
                    //#. If the user selects 'copy of' in the drafts folder, the subject of the email is prefixed with [Copy].
                    //#. Please make sure that this is a prefix in every translation since it will be removed when the mail is sent.
                    //#. %1$s the original subject of the mail
                    model.set('subject', gt('[Copy] %1$s', model.get('subject')));
                });
            });
        }
    });

    new Action('io.ox/mail/actions/source', {
        requires: function (e) {
            // must be at least one message and top-level
            if (!e.collection.has('some') || !e.collection.has('toplevel')) return;
            // multiple selection
            if (e.baton.selection && e.baton.selection.length > 1) return;
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

    new Action('io.ox/mail/actions/filter', {
        capabilities: 'mailfilter',
        requires: function (e) {
            // must be at least one message and top-level
            if (!e.collection.has('some') || !e.collection.has('toplevel')) return;
            // multiple selection
            if (e.baton.selection && e.baton.selection.length > 1) return;
            // multiple and not a thread?
            if (!e.collection.has('one') && !e.baton.isThread) return;
            return true;
        },
        action: function (baton) {
            require(['io.ox/mail/mailfilter/settings/filter'], function (filter) {

                filter.initialize().then(function (data, config, opt) {
                    var factory = opt.model.protectedMethods.buildFactory('io.ox/core/mailfilter/model', opt.api),
                        args = { data: { obj: factory.create(opt.model.protectedMethods.provideEmptyModel()) } },
                        preparedTest = {
                            id: 'allof',
                            tests: [
                                _.copy(opt.filterDefaults.tests.Subject),
                                opt.filterDefaults.tests.address ? _.copy(opt.filterDefaults.tests.address) : _.copy(opt.filterDefaults.tests.From)
                            ]
                        };

                    preparedTest.tests[0].values = [baton.data.subject];
                    preparedTest.tests[1].values = [baton.data.from[0][1]];

                    args.data.obj.set('test', preparedTest);

                    ext.point('io.ox/settings/mailfilter/filter/settings/detail').invoke('draw', undefined, args, config[0]);
                });
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

    new Action('io.ox/mail/actions/flag', {
        requires: function (e) {
            return settings.get('features/flag/star') && e.collection.has('some');
        },
        action: function (baton) {
            api.flag(baton.data);
        }
    });

    new Action('io.ox/mail/actions/archive', {
        capabilities: 'archive_emails',
        requires: function (e) {
            if (!e.collection.has('some', 'delete')) return false;
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
            var list = _.isArray(baton.data) ? baton.data : [baton.data];
            api.archive(list);
        }
    });

    /*
     *  Move and Copy
     */

    function generate(type, label, success) {

        new Action('io.ox/mail/actions/' + type, {
            requires: 'toplevel some' + (type === 'move' ? ' delete' : ''),
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

    new Action('io.ox/mail/actions/mark-unread', {
        requires: function (e) {
            // must be top-level; change seen flag
            if (!e.collection.has('toplevel', 'change:seen')) return false;
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

    new Action('io.ox/mail/actions/mark-read', {
        requires: function (e) {
            // must be top-level; change seen flag
            if (!e.collection.has('toplevel', 'change:seen')) return false;
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
            if (!e.collection.has('toplevel', 'some', 'delete')) return false;
            // is spam?
            return _(e.baton.array()).reduce(function (memo, obj) {
                // already false?
                if (memo === false) return false;
                // is not primary account?
                if (!account.isPrimary(obj.folder_id)) return false;
                // is spam folder?
                if (account.is('spam', obj.folder_id)) return false;
                // is sent folder?
                if (account.is('sent', obj.folder_id)) return false;
                // is drafts folder?
                if (account.is('drafts', obj.folder_id)) return false;
                // is marked as spam already?
                if (util.isSpam(obj)) return false;
                // else
                return true;
            }, true);
        },
        multiple: function (list) {
            api.markSpam(list).done(function (result) {
                var error = _(result).chain().pluck('error').compact().first().value();
                if (error) notifications.yell(error);
            });
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
            api.noSpam(list).done(function (result) {
                var error = _(result).chain().pluck('error').compact().first().value();
                if (error) notifications.yell(error);
            });
        }
    });

    // Attachments

    new Action('io.ox/mail/actions/open-attachment', {
        requires: 'one',
        multiple: function (list) {
            _(list).each(function (data) {
                var url = api.getUrl(data, 'view');
                blankshield.open(url);
            });
        }
    });

    new Action('io.ox/mail/actions/view-attachment', {
        // TODO capabilites check, files filter?
        requires: 'some',
        multiple: function (attachmentList, baton) {
            ox.load(['io.ox/mail/actions/viewer']).done(function (action) {
                var options = { files: attachmentList };
                if (baton.startItem) {
                    options.selection = baton.startItem;
                }
                if (baton.openedBy) {
                    options.openedBy = baton.openedBy;
                }
                action(options);
            });
        }
    });

    new Action('io.ox/mail/actions/download-attachment', {
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
        capabilities: 'infostore',
        requires: 'some',
        multiple: function (list) {
            require(['io.ox/mail/actions/attachmentSave'], function (action) {
                action.multiple(list);
            });
        }
    });

    new Action('io.ox/mail/actions/vcard', {
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
        capabilities: 'calendar',
        requires: function (e) {
            var context = _.isArray(e.context) ? _.first(e.context) : e.context,
                hasRightSuffix = context.filename && !!context.filename.match(/\.ics$/i),
                isCalendarType = context.content_type && !!context.content_type.match(/^text\/calendar/i),
                isAppType = context.content_type && !!context.content_type.match(/^application\/ics/i),
                mail = api.pool.get('detail').get(_.cid(context.mail));
            if (mail.get('imipMail')) return false;
            return hasRightSuffix || isCalendarType || isAppType;
        },
        action: function (baton) {
            require(['io.ox/mail/actions/ical'], function (action) {
                action(baton);
            });
        }
    });

    new Action('io.ox/mail/actions/save', {
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
            require(['io.ox/core/api/user'], function (userAPI) {
                account.getAllSenderAddresses().done(function (senderAddresses) {
                    userAPI.getCurrentUser().done(function (user) {
                        var data = baton.data,
                            toAdresses = data.to.concat(data.cc).concat(data.bcc).concat(data.from),
                            ownAddresses = _.compact([user.get('email1'), user.get('email2'), user.get('email3')]);

                        ownAddresses = ownAddresses.concat(_(senderAddresses).pluck(1));
                        var filtered = _(toAdresses).filter(function (addr) {
                            return ownAddresses.indexOf(addr[1]) < 0;
                        });
                        if (filtered.length === 0) filtered = toAdresses;
                        filtered = _(filtered).uniq(false, function (addr) {
                            return addr[1];
                        });

                        ox.registry.call('mail-compose', 'compose', { folder_id: data.folder_id, to: filtered });
                    });
                });
            });
        }
    });

    new Action('io.ox/mail/actions/createdistlist', {
        capabilities: 'contacts',
        requires: 'some',
        action: function (baton) {
            require(['io.ox/mail/actions/create'], function (action) {
                action.createDistributionList(baton);
            });
        }
    });

    new Action('io.ox/mail/actions/invite', {
        capabilities: 'calendar',
        requires: 'some',
        action: function (baton) {
            require(['io.ox/mail/actions/create'], function (action) {
                action.createAppointment(baton);
            });
        }
    });

    new Action('io.ox/mail/actions/reminder', {
        capabilities: 'tasks',
        requires: 'one toplevel',
        action: function (baton) {
            require(['io.ox/mail/actions/reminder'], function (action) {
                action(baton);
            });
        }
    });

    new Action('io.ox/mail/premium/actions/synchronize', {
        capabilities: 'active_sync',
        requires: function () {
            // use client onboarding here, since it is a setting and not a capability
            return capabilities.has('client-onboarding');
        },
        action: function () {
            require(['io.ox/onboarding/clients/wizard'], function (wizard) {
                wizard.run();
            });
        }
    });

    // inline links
    var INDEX = 0;

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'inplace-reply',
        mobile: 'lo',
        //#. Quick reply to a message; maybe "Direkt antworten" or "Schnell antworten" in German
        label: gt('Quick reply'),
        ref: 'io.ox/mail/actions/inplace-reply',
        section: 'standard'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        id: 'reply',
        mobile: 'lo',
        label: gt('Reply'),
        ref: 'io.ox/mail/actions/reply',
        section: 'standard'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'reply-all',
        mobile: 'lo',
        label: gt('Reply All'),
        ref: 'io.ox/mail/actions/reply-all',
        drawDisabled: true,
        section: 'standard'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'forward',
        mobile: 'lo',
        label: gt('Forward'),
        ref: 'io.ox/mail/actions/forward',
        section: 'standard'
    }));

    // edit draft
    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'edit',
        mobile: 'lo',
        label: gt('Edit'),
        ref: 'io.ox/mail/actions/edit',
        section: 'standard'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'hi',
        id: 'delete',
        mobile: 'lo',
        label: gt('Delete'),
        ref: 'io.ox/mail/actions/delete',
        section: 'standard'
    }));

    new Action('io.ox/mail/actions/label', {
        id: 'label',
        requires: 'toplevel some',
        multiple: $.noop
    });

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        mobile: 'lo',
        id: 'spam',
        label: gt('Mark as spam'),
        ref: 'io.ox/mail/actions/spam',
        section: 'flags'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX + 1,
        prio: 'lo',
        mobile: 'lo',
        id: 'nospam',
        label: gt('Not spam'),
        ref: 'io.ox/mail/actions/nospam',
        section: 'flags'
    }));

    ext.point('io.ox/mail/links/inline').extend(new links.Link({
        index: INDEX += 100,
        prio: 'lo',
        mobile: 'lo',
        id: 'flag',
        //#. Verb: (to) flag messages
        label: gt.pgettext('verb', 'Flag'),
        ref: 'io.ox/mail/actions/flag',
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
        prio: 'lo',
        mobile: 'lo',
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
        id: 'save-as-eml',
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
        mobile: 'none',
        id: 'filter',
        label: gt('Create filter rule'),
        ref: 'io.ox/mail/actions/filter',
        section: 'file-op'
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
        id: 'view_new',
        index: 100,
        mobile: 'high',
        label: gt('View'),
        ref: 'io.ox/mail/actions/view-attachment'
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
        //#. %1$s is usually "Drive" (product name; might be customized)
        label: gt('Save to %1$s', gt.pgettext('app', 'Drive')),
        ref: 'io.ox/mail/actions/save-attachment'
    }));

    // the mighty Viewer 2.0
    ext.point('io.ox/mail/attachment/links').extend(new links.Link({
        id: 'viewer',
        index: 600,
        mobile: 'high',
        label: gt('View attachment'),
        ref: 'io.ox/mail/actions/viewer'
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

    ext.point('io.ox/mail/folderview/premium-area').extend(new links.InlineLinks({
        index: 100,
        id: 'inline-premium-links',
        ref: 'io.ox/mail/links/premium-links',
        classes: 'list-unstyled'
    }));

    ext.point('io.ox/mail/links/premium-links').extend(new links.Link({
        index: 100,
        prio: 'hi',
        id: 'synchronize',
        label: gt('Synchronize with Outlook'),
        ref: 'io.ox/mail/premium/actions/synchronize'
    }));
});
