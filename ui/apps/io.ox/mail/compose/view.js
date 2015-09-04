/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author David Bauer <david.bauer@open-xchange.com>
 */

define('io.ox/mail/compose/view', [
    'io.ox/mail/compose/extensions',
    'io.ox/backbone/mini-views/dropdown',
    'io.ox/core/extensions',
    'io.ox/mail/api',
    'io.ox/mail/util',
    'io.ox/core/tk/textproc',
    'settings!io.ox/mail',
    'settings!io.ox/core',
    'io.ox/core/notifications',
    'io.ox/core/api/snippets',
    'io.ox/core/api/account',
    'gettext!io.ox/mail',
    'io.ox/mail/actions/attachmentEmpty',
    'less!io.ox/mail/style',
    'less!io.ox/mail/compose/style'
], function (extensions, Dropdown, ext, mailAPI, mailUtil, textproc, settings, coreSettings, notifications, snippetAPI, accountAPI, gt, attachmentEmpty) {

    'use strict';

    var INDEX = 0,
        POINT = 'io.ox/mail/compose';

    ext.point(POINT + '/buttons').extend({
        index: 100,
        id: 'send',
        draw: extensions.buttons.send
    });

    ext.point(POINT + '/buttons').extend({
        index: 200,
        id: 'save',
        draw: extensions.buttons.save
    });

    ext.point(POINT + '/buttons').extend({
        index: 300,
        id: 'discard',
        draw: extensions.buttons.discard
    });

    ext.point(POINT + '/mailto').extend({
        id: 'mailto',
        index: 100,
        setup: extensions.mailto
    });

    ext.point(POINT + '/header').extend({
        index: 100,
        id: 'title',
        draw: extensions.title
    });

    ext.point(POINT + '/header').extend({
        index: 200,
        id: 'buttons',
        draw: function (baton) {
            ext.point(POINT + '/buttons').invoke('draw', this, baton);
        }
    });

    ext.point(POINT + '/fields').extend({
        id: 'header',
        index: INDEX += 100,
        draw: extensions.header
    });

    ext.point(POINT + '/fields').extend({
        id: 'sender',
        index: INDEX += 100,
        draw: extensions.sender
    });

    ext.point(POINT + '/fields').extend({
        id: 'to',
        index: INDEX += 100,
        draw: extensions.tokenfield('To')
    });

    ext.point(POINT + '/fields').extend({
        id: 'cc',
        index: INDEX += 100,
        draw: extensions.tokenfield('CC')
    });

    ext.point(POINT + '/fields').extend({
        id: 'bcc',
        index: INDEX += 100,
        draw: extensions.tokenfield('BCC')
    });

    ext.point(POINT + '/fields').extend({
        id: 'subject',
        index: INDEX += 100,
        draw: extensions.subject
    });

    ext.point(POINT + '/recipientActionLink').extend({
        id: 'cc',
        index: 100,
        draw: extensions.recipientActionLink('cc')
    });

    ext.point(POINT + '/recipientActionLink').extend({
        id: 'bcc',
        index: 200,
        draw: extensions.recipientActionLink('bcc')
    });

    ext.point(POINT + '/recipientActionLinkMobile').extend({
        id: 'mobile',
        index: 100,
        draw: extensions.recipientActionLinkMobile
    });

    ext.point(POINT + '/recipientActions').extend({
        id: 'recipientActions',
        index: 100,
        draw: extensions.recipientActions
    });

    ext.point(POINT + '/menu').extend({
        id: 'signatures',
        index: 100,
        draw: extensions.signaturemenu
    });

    ext.point(POINT + '/signatures').extend({
        id: 'signature',
        index: 100,
        draw: extensions.signature
    });

    ext.point(POINT + '/menu').extend({
        id: 'options',
        index: 200,
        draw: extensions.optionsmenu
    });

    ext.point(POINT + '/editors').extend({
        id: 'plain-text',
        lable: gt('Plain Text'),
        mode: 'text'
    });

    ext.point(POINT + '/editors').extend({
        id: 'tinymce',
        lable: gt('HTML'),
        mode: 'html'
    });

    ext.point(POINT + '/menuoptions').extend({
        id: 'editor',
        index: 100,
        draw: function () {
            if (_.device('smartphone')) return;
            var menu = this.data('view')
                .header(gt('Editor'));

            ext.point(POINT + '/editors').each(function (point) {
                if (!point.mode && !point.lable) return;
                menu.option('editorMode', point.mode, point.lable, gt('Editor'));
            });
        }
    });

    ext.point(POINT + '/menuoptions').extend({
        id: 'priority',
        index: 200,
        draw: function () {
            this.data('view')
                .header(gt('Priority'))
                .option('priority', 0, gt('High'), gt('Priority'))
                .option('priority', 3, gt('Normal'), gt('Priority'))
                .option('priority', 5, gt('Low'), gt('Priority'));
        }
    });

    ext.point(POINT + '/menuoptions').extend({
        id: 'options',
        index: 300,
        draw: function () {
            this.data('view')
                .header(gt('Options'))
                .option('vcard', 1, gt('Attach Vcard'), gt('Options'))
                .option('disp_notification_to', true, gt('Request read receipt'), gt('Options'));
        }
    });

    ext.point(POINT + '/composetoolbar').extend({
        id: 'add_attachments',
        index: 100,
        draw: function (baton) {
            var node = $('<div data-extension-id="add_attachments" class="col-xs-4 col-md-5 col-md-offset-1">');
            extensions.attachment.call(node, baton);
            this.append(node);
        }
    });

    ext.point(POINT + '/composetoolbar').extend({
        id: 'menus',
        index: 200,
        draw: function (baton) {
            var node = $('<div class="pull-right text-right">');

            ext.point(POINT + '/menu').invoke('draw', node, baton);

            this.append(
                $('<div data-extension-id="composetoolbar-menu" class="col-xs-8 col-md-6">').append(node)
            );
        }
    });

    ext.point(POINT + '/fields').extend({
        id: 'composetoolbar',
        index: INDEX += 100,
        draw: function (baton) {
            var node = $('<div data-extension-id="composetoolbar" class="row composetoolbar">');
            ext.point(POINT + '/composetoolbar').invoke('draw', node, baton);
            this.append(node);
        },
        redraw: function (baton) {
            var node = this.find('.row.composetoolbar');
            ext.point(POINT + '/composetoolbar').invoke('redraw', node, baton);
        }
    });

    ext.point(POINT + '/fields').extend({
        id: 'attachments',
        index: INDEX += 100,
        draw: function (baton) {
            var node = $('<div data-extension-id="attachments" class="row attachments">');
            ext.point(POINT + '/attachments').invoke('draw', node, baton);
            this.append(node);
        }
    });

    ext.point(POINT + '/attachments').extend({
        id: 'attachmentPreview',
        index: 100,
        draw: function (baton) {
            var node = $('<div data-extension-id="attachmentPreview" class="col-xs-12">');
            extensions.attachmentPreviewList.call(node, baton);
            node.appendTo(this);
        }
    });

    // disable attachmentList by default
    ext.point(POINT + '/attachments').disable('attachmentList');

    var MailComposeView = Backbone.View.extend({

        className: 'io-ox-mail-compose container',

        events: {
            'click [data-action="add"]': 'toggleTokenfield',
            'keyup [data-extension-id="subject"] input': 'setSubject'
        },

        initialize: function (options) {
            this.app = options.app;
            this.editorHash = {};
            this.autosave = {};
            this.intervals = [];
            this.blocked = [];
            this.messageFormat = options.messageFormat || settings.get('messageFormat', 'html');

            // Open Drafts in HTML mode if content type is html even if text-editor is default
            if (this.model.get('mode') === 'edit' && this.model.get('content_type') === 'text/html' && settings.get('messageFormat', 'html') === 'text') {
                this.messageFormat = 'html';
            }
            this.editor = null;
            this.composeMode = 'compose';
            this.editorId = _.uniqueId('editor-');
            this.contentEditable = $('<div class="editable">').attr({
                'data-editor-id': this.editorId,
                'tabindex': 1
            }).css('margin-bottom', '32px');
            this.textarea = $('<textarea class="plain-text">').attr({
                'data-editor-id': this.editorId,
                'tabindex': 1
            }).addClass(settings.get('useFixedWidthFont') ? 'monospace' : '');

            this.baton = ext.Baton({
                model: this.model,
                view: this
            });

            this.contentEditable.on('addInlineImage', function (e, id) { this.addKeepalive(id); }.bind(this));

            // register for 'dispose' event (using inline function to make this testable via spyOn)
            this.$el.on('dispose', function (e) { this.dispose(e); }.bind(this));

            this.listenTo(this.model, 'keyup:subject change:subject',   this.setTitle);
            this.listenTo(this.model, 'change:editorMode',              this.toggleEditorMode);
            this.listenTo(this.model, 'change:defaultSignatureId',      this.setSelectedSignature);
            this.listenTo(this.model, 'change:signatures',              this.updateSelectedSignature);
            this.listenTo(this.model, 'needsync',                       this.syncMail);

            var mailto, params;
            // triggered by mailto?
            if (mailto = _.url.hash('mailto')) {

                var parseRecipients = function (recipients) {
                    return recipients.split(',').map(function (recipient) {
                        var parts = _.compact(
                            recipient.replace(/^("([^"]*)"|([^<>]*))?\s*(<(\s*(.*?)\s*)>)?/, '$2//$3//$5').split('//')
                        ).map(function (str) { return str.trim(); });
                        return (parts.length === 1) ? [parts[0], parts[0]] : parts;
                    });
                };
                // remove 'mailto:'' prefix and split at '?''
                var tmp = mailto.replace(/^mailto:/, '').split(/\?/, 2);
                var to = unescape(tmp[0]), params = _.deserialize(tmp[1]);
                // see Bug 31345 - [L3] Case sensitivity issue with Richmail while rendering Mailto: link parameters
                for (var key in params) params[key.toLowerCase()] = params[key];
                // save data
                if (to) {           this.model.set('to',  parseRecipients(to),          { silent: true }); }
                if (params.cc) {    this.model.set('cc',  parseRecipients(params.cc),   { silent: true }); }
                if (params.bcc) {   this.model.set('bcc', parseRecipients(params.bcc),  { silent: true }); }

                this.setSubject(params.subject || '');
                this.model.setContent(params.body || '');
                // clear hash
                _.url.hash('mailto', null);
            }

            ext.point(POINT + '/mailto').invoke('setup');
        },

        markupQuotes: function (text) {
            var lines = String(text || '').split(/<br\s?\/?>/i),
                quoting = false,
                regQuoted = /^&gt;( |$)/i,
                i = 0, $i = lines.length, tmp = [], line;
            for (text = ''; i < $i; i++) {
                line = lines[i];
                if (!regQuoted.test(line)) {
                    if (!quoting) {
                        text += line + '<br>';
                    } else {
                        tmp = $.trim(tmp.join('\n')).replace(/\n/g, '<br>');
                        text = text.replace(/<br>$/, '') + '<blockquote type="cite"><p>' + tmp + '</p></blockquote>' + line;
                        quoting = false;
                    }
                } else {
                    if (quoting) {
                        tmp.push(line.replace(regQuoted, ''));
                    } else {
                        quoting = true;
                        tmp = [line.replace(regQuoted, '')];
                    }
                }
            }
            text = text.replace(/<br>$/, '');
            if (text === '' && tmp.length) {
                tmp = $.trim(tmp.join('\n')).replace(/\n/g, '<br>');
                text = text.replace(/<br>$/, '') + '<blockquote type="cite"><p>' + tmp + '</p></blockquote>' + line;
            }
            return text;
        },

        fetchMail: function (obj) {
            // Empty compose (early exit)
            if (obj.mode === 'compose') return $.when();

            // keep attachments (mail body) for restored reply
            if (obj.restored) return $.when();

            var self = this,
                mode = obj.mode;

            delete obj.mode;

            if (obj.initial === false) {
                obj.attachments = new Backbone.Collection(_.clone(obj.attachments));
                this.model.set(obj);
                obj = null;
                return $.when();
            } else if (mode === 'forward' && !obj.id) {
                obj = _(obj).map(function (o) {
                    return _.pick(o, 'id', 'folder_id', 'csid');
                });
            } else {
                obj = _.pick(obj, 'id', 'folder_id', 'csid', 'content_type');
            }

            // use CSS sanitizing and size limit (large than detail view)
            obj.embedded = true;
            obj.max_size = settings.get('maxSize/compose', 1024 * 512);

            return mailAPI[mode](obj, this.messageFormat).then(function (data) {
                if (mode !== 'edit') {
                    data.sendtype = mode === 'forward' ? mailAPI.SENDTYPE.FORWARD : mailAPI.SENDTYPE.REPLY;
                } else {
                    data.sendtype = mailAPI.SENDTYPE.EDIT_DRAFT;
                }
                data.mode = mode;
                var attachments = _.clone(data.attachments);
                delete data.attachments;
                if (!_.isEmpty(data.from)) {
                    accountAPI.getAllSenderAddresses().then(function (a) {
                        if (_.isEmpty(a)) return;
                        data.from = a.filter(function (from) { return from[1] === data.from[0][1]; });
                    });
                }
                if (mode === 'forward') {
                    // move nested messages into attachment array
                    _(data.nested_msgs).each(function (obj) {
                        attachments.push({
                            id: obj.id,
                            filename: obj.subject,
                            content_type: 'message/rfc822',
                            msgref: obj.msgref
                        });
                    });
                    delete data.nested_msgs;
                }
                self.model.set(data);

                var attachmentCollection = self.model.get('attachments');
                attachmentCollection.reset(attachments);
                var content = attachmentCollection.at(0).get('content'),
                    content_type = attachmentCollection.at(0).get('content_type');

                // Force text edit mode when alternative editorMode and text/plain mail
                if (mode === 'edit' && self.model.get('editorMode') === 'alternative' && content_type === 'text/plain') {
                    self.model.set('editorMode', 'text', { silent: true });
                }

                if (content_type === 'text/plain' && self.model.get('editorMode') === 'html') {
                    var hasBlockquotes = content.match(/(&gt; )+/g);
                    if (hasBlockquotes) {
                        $.each(hasBlockquotes.sort().reverse()[0].match(/&gt; /g), function () {
                            content = self.markupQuotes(content);
                        });
                    }
                    attachmentCollection.at(0).set('content_type', 'text/html');
                }
                if (content_type === 'text/plain' && self.model.get('editorMode') === 'text' && mode === 'edit') {
                    content = textproc.htmltotext(content);
                }
                attachmentCollection.at(0).set('content', content);
                self.model.unset('attachments');
                self.model.set('attachments', attachmentCollection);
                obj = data = attachmentCollection = null;
            });
        },

        setSubject: function (e) {
            var value = e.target ? $(e.target).val() : e;
            // A11y: focus mailbody on enter in subject field
            if (e.which && e.which === 13) {
                this.editor.focus();
            }
            this.model.set('subject', value, { silent: true }).trigger('keyup:subject', value);
        },

        setTitle: function () {
            this.app.setTitle(this.model.get('subject') || gt('Compose'));
        },

        parseMsgref: function (msgref) {
            var base = _(msgref.toString().split(mailAPI.separator)),
                id = base.last(),
                folder = base.without(id).join(mailAPI.separator);
            return { folder_id: folder, id: id };
        },

        saveDraft: function () {
            var win = this.app.getWindow();
            win.busy();
            // get mail
            var self = this,
                mail = this.model.getMailForDraft(),
                def = new $.Deferred(),
                old_vcard_flag;

            // never append vcard when saving as draft
            // backend will append vcard for every send operation (which save as draft is)
            old_vcard_flag = mail.vcard;
            delete mail.vcard;

            return attachmentEmpty.emptinessCheck(mail.files).then(function () {
                return self.waitForPendingImages();
            }).then(function () {
                mail.attachments[0].content = self.model.getMail().attachments[0].content;

                return mailAPI.send(mail, mail.files);
            }).then(function (result) {
                var opt = self.parseMsgref(result.data);
                if (mail.attachments[0].content_type == 'text/plain') opt.view = 'raw';

                return $.when(
                    result,
                    mailAPI.get(opt)
                );
            }, function (result) {
                if (result.error) {
                    notifications.yell(result);
                    return def.reject(result);
                }
            }).then(function (result, data) {
                // Replace inline images in contenteditable with links from draft response
                if (self.model.get('editorMode') === 'html') {
                    $(data.attachments[0].content).find('img:not(.emoji)').each(function (index, el) {
                        $('img:not(.emoji):eq(' + index + ')', self.contentEditable).attr('src', $(el).attr('src'));
                    });
                }
                self.model.set('msgref', result.data, { silent: true });
                self.model.dirty(false);
                notifications.yell('success', gt('Mail saved as draft'));
                return result;
            }).always(function () {
                win.idle();
            });
        },

        autoSaveDraft: function () {

            var def = new $.Deferred(),
                self = this,
                mail = this.model.getMailForAutosave();

            mailAPI.autosave(mail).always(function (result) {
                if (result.error) {
                    notifications.yell(result);
                    def.reject(result);
                } else {
                    if (mail.sendtype === mailAPI.SENDTYPE.EDIT_DRAFT) {
                        self.model.set('msgref', result, { silent: true });
                    }

                    var saved = self.model.get('infostore_ids_saved');
                    self.model.set('infostore_ids_saved', [].concat(saved, mail.infostore_ids || []));
                    notifications.yell('success', gt('Mail saved as draft'));
                    def.resolve(result);
                }
            });

            this.initAutoSaveAsDraft();

            return def;
        },

        stopAutoSave: function () {
            if (this.autosave) {
                window.clearTimeout(this.autosave.timer);
            }
        },

        initAutoSaveAsDraft: function () {

            var timeout = settings.get('autoSaveDraftsAfter', false),
                timerScale = {
                    //60s
                    minute: 60000,
                    minutes: 60000
                },
                scale,
                delay,
                timer,
                self = this;

            if (!timeout) return;

            timeout = timeout.split('_');
            scale = timerScale[timeout[1]];
            timeout = timeout[0];

            // settings not parsable
            if (!timeout || !scale) return;

            this.stopAutoSave();

            delay = function () {
                self.autosave.timer = _.delay(timer, timeout * scale);
            };

            timer = function () {
                // only auto-save if something changed (see Bug #26927)
                if (self.model.dirty()) {
                    self.autoSaveDraft();
                } else {
                    delay();
                }
            };

            this.autosave = {};
            delay();
        },

        addKeepalive: function (id) {
            var timeout = Math.round(settings.get('maxUploadIdleTimeout', 200000) * 0.9);
            this.intervals.push(setInterval(mailAPI.keepalive, timeout, id));
        },

        clearKeepalive: function () {
            _(this.intervals).each(clearInterval);
        },

        clean: function () {
            // mark as not dirty
            this.model.dirty(false);
            // clean up editors
            for (var id in this.editorHash) {
                this.editorHash[id].destroy();
            }
            // clear timer for autosave
            this.stopAutoSave();
        },

        dispose: function () {
            this.clearKeepalive();
            this.stopListening();
            this.model = null;
        },

        discard: function () {
            var self = this,
                def = $.Deferred();

            if (this.model.dirty()) {
                require(['io.ox/core/tk/dialogs'], function (dialogs) {
                    //button texts may become quite large in some languages (e. g. french, see Bug 35581)
                    //add some extra space
                    //TODO maybe we could use a more dynamical approach
                    new dialogs.ModalDialog({ width: 550, container: _.device('smartphone') ? self.$el.closest('.window-container-center') : $('#io-ox-core') })
                        .text(gt('Do you really want to discard your message?'))
                        //#. "Discard message" appears in combination with "Cancel" (this action)
                        //#. Translation should be distinguishable for the user
                        .addPrimaryButton('delete', gt.pgettext('dialog', 'Discard message'), 'delete', { tabIndex: 1 })
                        .addAlternativeButton('savedraft', gt('Save as draft'), 'savedraft', { tabIndex: 1 })
                        .addButton('cancel', gt('Cancel'), 'cancel', { tabIndex: 1 })
                        .show()
                        .done(function (action) {
                            if (action === 'delete') {
                                // clean before resolve, otherwise tinymce gets half-destroyed (ugly timing)
                                self.clean();
                                def.resolve();
                            } else if (action === 'savedraft') {
                                self.saveDraft().always(function () {
                                    self.clean();
                                }).done(def.resolve).fail(def.reject);
                            } else {
                                def.reject();
                            }
                        });
                });
            } else {
                this.clean();
                def.resolve();
            }

            return def;
        },

        waitForPendingImages: function () {
            if (!window.tinymce || !window.tinymce.activeEditor || !window.tinymce.activeEditor.plugins.oximage) return $.Deferred().resolve();

            var ids = $('img[data-pending="true"]', window.tinymce.activeEditor.getElement()).map(function () {
                    return $(this).attr('id');
                }),
                deferreds = window.tinymce.activeEditor.plugins.oximage.getPendingDeferreds(ids);

            return $.when.apply(this, deferreds);
        },

        send: function () {

            // track click on send button
            require(['io.ox/metrics/main'], function (metrics) {
                metrics.trackEvent({
                    app: 'mail',
                    target: 'compose/toolbar',
                    type: 'click',
                    action: 'send'
                });
            });

            // get mail
            var self = this,
                mail = this.model.getMail(),
                def = $.Deferred();

            // force correct content-type
            if (mail.attachments[0].content_type === 'text/plain' && this.model.get('editorMode') === 'html') {
                mail.attachments[0].content_type = 'text/html';
            }

            this.blockReuse(mail.sendtype);

            function cont() {
                var win = self.app.getWindow();
                // start being busy
                if (win) {
                    win.busy();
                    // close window now (!= quit / might be reopened)
                    win.preQuit();
                }
                /*if (self.attachmentsExceedQouta(mail)) {
                    notifications.yell({
                        type: 'info',
                        message: gt(
                            'One or more attached files exceed the size limit per email. ' +
                            'Therefore, the files are not sent as attachments but kept on the server. ' +
                            'The email you have sent just contains links to download these files.'
                        ),
                        duration: 30000
                    });
                }*/

                if (mail.sendtype === mailAPI.SENDTYPE.EDIT_DRAFT) {
                    mail.sendtype = mailAPI.SENDTYPE.DRAFT;
                }

                self.waitForPendingImages().then(function () {
                    // use actual content since the image urls could have changed
                    mail.attachments[0].content = self.model.getMail().attachments[0].content;

                    // send!
                    mailAPI.send(mail, mail.files)
                    .always(function (result) {

                        if (result.error && !result.warnings) {
                            if (win) { win.idle().show(); }
                            self.app.launch();
                            // TODO: check if backend just says "A severe error occurred"
                            notifications.yell(result);
                            return;
                        }

                        if (result.warnings) {
                            notifications.yell('warning', result.warnings.error);
                        } else {
                            // success - some want to be notified, other's not
                            if (settings.get('features/notifyOnSent', false)) {
                                notifications.yell('success', gt('The email has been sent'));
                            }
                        }

                        // update base mail
                        var isReply = mail.sendtype === mailAPI.SENDTYPE.REPLY,
                            isForward = mail.sendtype === mailAPI.SENDTYPE.FORWARD,
                            sep = mailAPI.separator,
                            base, folder, id, msgrefs, ids;

                        if (isReply || isForward) {
                            //single vs. multiple
                            if (mail.msgref) {
                                msgrefs = [ mail.msgref ];
                            } else {
                                msgrefs = _.chain(mail.attachments)
                                    .filter(function (attachment) {
                                        return attachment.content_type === 'message/rfc822';
                                    })
                                    .map(function (attachment) { return attachment.msgref; })
                                    .value();
                            }
                            //prepare
                            ids = _.map(msgrefs, function (obj) {
                                base = _(obj.split(sep));
                                folder = base.initial().join(sep);
                                id = base.last();
                                return { folder_id: folder, id: id };
                            });
                            // update cache
                            mailAPI.getList(ids).pipe(function (data) {
                                // update answered/forwarded flag
                                if (isReply || isForward) {
                                    var len = data.length;
                                    for (var i = 0; i < len; i++) {
                                        if (isReply) data[i].flags |= 1;
                                        if (isForward) data[i].flags |= 256;
                                    }
                                }
                                $.when(mailAPI.caches.list.merge(data), mailAPI.caches.get.merge(data))
                                .done(function () {
                                    mailAPI.trigger('refresh.list');
                                });
                            });
                        }

                        //remove sync listener
                        //causes problems with inline images that are already deleted on the backend (see Bug 32599)
                        self.stopListening(self.model, 'needsync', self.syncMail);
                        self.model.dirty(false);
                        self.app.quit();
                    })
                    .always(function (result) {
                        self.unblockReuse(mail.sendtype);
                        def.resolve(result);
                    });
                }, function (error) {
                    if (win) { win.idle().show(); }

                    self.app.launch();
                    notifications.yell(error);

                    self.unblockReuse(mail.sendtype);
                    def.resolve(error);
                });
            }

            // ask for empty to,cc,bcc and/or empty subject
            var noRecipient = _.isEmpty(mail.to) && _.isEmpty(mail.cc) && _.isEmpty(mail.bcc);
            if (noRecipient) {
                notifications.yell('error', gt('Mail has no recipient.'));
                self.$el.find('.tokenfield:first .token-input').focus();
                def.reject();
            } else if ($.trim(mail.subject) === '') {
                // show dialog
                require(['io.ox/core/tk/dialogs'], function (dialogs) {
                    new dialogs.ModalDialog({ focus: false })
                        .text(gt('Mail has empty subject. Send it anyway?'))
                        .addPrimaryButton('send', gt('Yes, send without subject'), 'send', { tabIndex: 1 })
                        .addButton('subject', gt('Add subject'), 'subject', { tabIndex: 1 })
                        .show(function () {
                            def.notify('empty subject');
                        })
                        .done(function (action) {
                            if (action === 'send') {
                                attachmentEmpty.emptinessCheck(mail.files).done(function () {
                                    cont();
                                });
                            } else {
                                self.$el.find('input[name="subject"]').focus();
                                def.reject();
                            }
                        });
                });
            } else {
                attachmentEmpty.emptinessCheck(mail.files).done(function () {
                    cont();
                });
            }

            return def;
        },

        attachmentsExceedQuota: function (mail) {

            var allAttachmentsSizes = [].concat(mail.files).concat(mail.attachments)
                    .map(function (m) {
                        return m.size || 0;
                    }),
                quota = coreSettings.get('properties/attachmentQuota', 0),
                accumulatedSize = allAttachmentsSizes
                    .reduce(function (acc, size) {
                        return acc + size;
                    }, 0),
                singleFileExceedsQuota = allAttachmentsSizes
                    .reduce(function (acc, size) {
                        var quotaPerFile = coreSettings.get('properties/attachmentQuotaPerFile', 0);
                        return acc || (quotaPerFile > 0 && size > quotaPerFile);
                    }, false);

            return singleFileExceedsQuota || (quota > 0 && accumulatedSize > quota);
        },

        toggleTokenfield: function (e) {
            var isString = typeof e === 'string',
                type = isString ? e : $(e.target).attr('data-type');

            if (_.device('smartphone')) {
                if (!isString) e.preventDefault();
                var input = this.$el.find('[data-extension-id="cc"], [data-extension-id="bcc"]');
                if (input.hasClass('hidden')) {
                    input.removeClass('hidden');
                    this.$el.find('[data-action="add"] span').removeClass('fa-angle-right').addClass('fa-angle-down');
                } else {
                    if (_.isEmpty(this.model.attributes.cc) && _.isEmpty(this.model.attributes.bcc)) {
                        this.model.set('cc', []);
                        this.model.set('bcc', []);
                        input.addClass('hidden');
                        this.$el.find('[data-action="add"] span').removeClass('fa-angle-down').addClass('fa-angle-right');
                    }
                }
                return input;
            }

            var button = this.$el.find('[data-type="' + type + '"]'),
                input = this.$el.find('[data-extension-id="' + type + '"]');
            if (!isString) e.preventDefault();
            if (input.hasClass('hidden') || isString) {
                input.removeClass('hidden');
                button.addClass('active').attr('aria-checked', true);
            } else if (!this.model.has(type) || _.isEmpty(this.model.get(type))) {
                //We don't want to close it automatically! Bug: 35730
                this.model.set(type, []);
                input.addClass('hidden');
                $(window).trigger('resize.tinymce');
                button.removeClass('active').attr('aria-checked', false);
            }
            return input;
        },

        loadEditor: function (content) {
            var self = this;

            return ox.manifests.loadPluginsFor('io.ox/mail/compose/editor/' + this.model.get('editorMode')).then(function (Editor) {
                return (self.editorHash[self.model.get('editorMode')] = new Editor(self.model.get('editorMode') === 'text' ? self.textarea : self.contentEditable))
                    .done(function () {
                        self.editor = self.editorHash[self.model.get('editorMode')];
                        return $.when(self.editor.setPlainText(content)).done(function () {
                            self.editor.handleShow(true);
                            self.setSelectedSignature();
                            if (self.model.get('mode') !== 'compose') {
                                self.editor.focus();
                            }
                            if (self.model.get('editorMode') !== 'text') {
                                self.editor.resetUndo();
                            }
                        });
                    });
            });
        },

        reuseEditor: function (content) {
            var self = this;
            this.editor = this.editorHash[this.model.get('editorMode')];
            return $.when(this.editor.setPlainText(content)).done(function () {
                self.editor.handleShow(true);
                self.setSelectedSignature();
            });
        },

        getEditor: function () {
            var def = $.Deferred();
            if (this.editor) {
                def.resolve(this.editor);
            } else {
                return this.loadEditor();
            }
            return def;
        },

        toggleEditorMode: function () {
            var self = this;
            // be busy
            this.contentEditable.busy();
            this.textarea.prop('disabled', true).busy();

            if (this.editor) {
                this.removeSignature();

                var content = this.editor.getPlainText(),
                    self = this;
                this.editor.clear();
                this.editor.handleHide();

                // load TEXT/HTML editor for the first time or reuse TEXT/HTML editor
                var loaded = (!this.editorHash[this.model.get('editorMode')] ? this.loadEditor(content) : this.reuseEditor(content));

                return loaded.done(function () {
                    //update the content type of the mail
                    //FIXME: may be, do this somewhere else? in the model?
                    self.model.setMailContentType(self.editor.content_type);
                });

            } else {
                // initial editor
                return this.loadEditor();
            }
        },

        syncMail: function () {
            if (this.editor) {
                this.model.setContent(this.editor.getContent());
            }
        },

        setBody: function (content) {
            if (this.model.get('initial')) {
                // remove white-space at beginning except in first-line
                content = String(content || '').replace(/^[\s\xA0]*\n([\s\xA0]*\S)/, '$1');
                // remove white-space at end
                content = content.replace(/[\s\uFEFF\xA0]+$/, '');
            }

            if (this.model.get('mode') !== 'compose') {
                // Remove extranous <br>
                content = content.replace(/\n<br>&nbsp;$/, '\n');
            }

            this.editor.setContent(content);

            if (this.model.get('initial')) {
                this.setSelectedSignature();
                this.prependNewLine();
            }
        },

        updateSelectedSignature: function () {
            var currentSignature = this.model.get('signature');

            if (!currentSignature) return;

            var changedSignature = _(this.model.get('signatures')).find({ id: String(currentSignature.id) });

            if (currentSignature.content !== changedSignature.content) {
                var isHTML = !!this.editor.find;

                if (isHTML) {
                    this.editor.find('.io-ox-signature').each(function () {

                        var node = $(this),
                            text = node.text(),
                            changed = $('<div>').html(changedSignature.content).text().replace(/\s+/g, '') !== text.replace(/\s+/g, '');

                        if (changed) node.empty().append($(changedSignature.content));
                    });
                } else {
                    var currentContent = mailUtil.signatures.cleanAdd(currentSignature.content, false),
                        changedContent = mailUtil.signatures.cleanAdd(changedSignature.content, false);

                    this.editor.replaceParagraph(currentContent, changedContent);
                }

                this.model.set('signature', changedSignature);
            }
        },

        setSelectedSignature: function (model, id) {
            if (!model) model = this.model.get('defaultSignatureId');

            if (_.isString(model)) id = model;

            var signatures = this.model.get('signatures');

            this.model.set('signature', _(signatures).where({ id: String(id) })[0]);

            var prevSignature = _(signatures).where({ id: _.isObject(model) ? model.previous('defaultSignatureId') : '' })[0];

            if (prevSignature) this.removeSignature(prevSignature);

            if (this.model.get('signature')) {
                var ds = this.model.get('signature');
                ds.misc = _.isString(ds.misc) ? JSON.parse(ds.misc) : ds.misc;
                this.setSignature(ds);
            }
        },

        removeSignature: function (signature) {

            if (!signature) {
                if (!this.model.get('signature')) return;
                signature = this.model.get('signature');
            }

            var self = this,
                isHTML = !!this.editor.find,
                currentSignature = mailUtil.signatures.cleanAdd(signature.content, isHTML);

            // remove current signature from editor
            if (isHTML) {
                this.editor.find('.io-ox-signature').each(function () {

                    var node = $(this),
                        text = node.text(),
                        unchanged = _(self.model.get('signatures')).find(function (signature) {
                            return $('<div>').html(signature.content).text().replace(/\s+/g, '') === text.replace(/\s+/g, '');
                        });

                    // remove entire block unless it seems edited
                    if (unchanged) node.remove(); else node.removeClass('io-ox-signature');
                });
            } else {
                if (currentSignature) {
                    this.editor.replaceParagraph(currentSignature, '');
                }
            }
        },

        isSignature: function (text) {
            var isHTML = !!this.editor.find;
            return mailUtil.signatures.is(text, this.model.get('signatures'), isHTML);
        },

        setSignature: function (signature) {
            var text,
                isHTML = !!this.editor.find;

            // add signature?
            if (this.model.get('signatures').length > 0) {
                text = mailUtil.signatures.cleanAdd(signature.content, isHTML);
                if (isHTML) text = this.getParagraph(text);
                if (_.isString(signature.misc)) { signature.misc = JSON.parse(signature.misc); }
                if (signature.misc && signature.misc.insertion === 'below') {
                    this.editor.appendContent(text);
                    this.editor.scrollTop('bottom');
                } else {
                    this.editor.prependContent(text);
                    this.editor.scrollTop('top');
                }
            }
        },

        getParagraph: function (text) {
            //use div for html cause innerHTML for p tags with nested tags fail
            var node = (/(<([^>]+)>)/ig).test(text) ? $('<div>') : $('<p>');
            node.addClass('io-ox-signature')
                .append(this.editor.ln2br(text));
            return $('<div>').append(node).html();
        },

        prependNewLine: function () {
            var content = this.editor.getContent().replace(/^\n+/, '').replace(/^(<p><br><\/p>)+/, ''),
                nl = this.model.get('editorMode') === 'html' ? '<p><br></p>' : '\n';
            this.editor.setContent(nl + content);
        },

        setMail: function () {
            var self = this;

            this.model.setInitialMailContentType();

            return this.toggleEditorMode().then(function () {
                return self.signaturesLoading;
            }).done(function () {
                var mode = self.model.get('mode');
                // set focus in compose and forward mode to recipient tokenfield
                if (/(compose|forward)/.test(mode)) {
                    if (_.device('!ios')) self.$el.find('.tokenfield:first .token-input').focus();
                } else {
                    self.editor.focus();
                }
                if (mode === 'replyall' && !_.isEmpty(self.model.get('cc'))) {
                    self.toggleTokenfield('cc');
                }
                self.setBody(self.model.getContent());
                self.model.dirty(false);
            });
        },

        blockReuse: function (sendtype) {
            this.blocked[sendtype] = (this.blocked[sendtype] || 0) + 1;
        },

        unblockReuse: function (sendtype) {
            this.blocked[sendtype] = (this.blocked[sendtype] || 0) - 1;
            if (this.blocked[sendtype] <= 0)
                delete this.blocked[sendtype];
        },

        handleScrollbars: function () {
            if (_.device('smartphone')) return;
            var self = this,
                scrollPane = this.app.getWindowNode(),
                toolbar = this.mcetoolbar,
                editor = this.contentEditable,
                fixed = false,
                top = 14;

            scrollPane.on('scroll', function () {
                if (self.model.get('editorMode') === 'text') return;
                if (scrollPane.scrollTop() - scrollPane.find('.mail-compose-fields').height() > top) {
                    // toolbar leaves viewport
                    if (!fixed) {
                        fixed = true;
                        toolbar.addClass('fixed').css('top', self.$el.parent().offset().top);
                        $(window).trigger('resize.tinymce');
                    }
                    editor.css('margin-top', toolbar.height());
                } else if (fixed) {
                    fixed = false;
                    toolbar.removeClass('fixed').css('top', 0);
                    editor.css('margin-top', 0);
                }
            });
        },

        render: function () {
            var self = this;

            var node = $('<div class="mail-compose-fields">');

            // draw all extensionpoints
            ext.point(POINT + '/fields').invoke('draw', node, this.baton);

            this.$el.append(node);

            // add subject to app title
            this.setTitle();

            // add view specific event handling to tokenfields
            this.$el.find('input.tokenfield').each(function () {
                // get original input field from token plugin
                var input = $(this).data('bs.tokenfield').$input;
                input.on({
                    // IME support (e.g. for Japanese)
                    compositionstart: function () {
                        $(this).attr('data-ime', 'active');
                    },
                    compositionend: function () {
                        $(this).attr('data-ime', 'inactive');
                    },
                    keydown: function (e) {
                        if (e.which === 13 && $(this).attr('data-ime') !== 'active') {
                            // clear tokenfield input
                            $(this).val('');
                        }
                    },
                    // shortcuts (to/cc/bcc)
                    keyup: function (e) {
                        if (e.which === 13) return;
                        if (_.device('smartphone')) return;
                        // look for special prefixes
                        var val = $(this).val();
                        if ((/^to:?\s/i).test(val)) {
                            $(this).typeahead('val', '');
                        } else if ((/^cc:?\s/i).test(val)) {
                            $(this).typeahead('val', '');
                            self.toggleTokenfield('cc').find('.token-input').focus();
                        } else if ((/^bcc:?\s/i).test(val)) {
                            $(this).typeahead('val', '');
                            self.toggleTokenfield('bcc').find('.token-input').focus();
                        }
                    }
                });
            });

            this.$el.append(
                $('<div class="mail-compose-contenteditable-fields">').append(
                    this.mcetoolbar = $('<div class="editable-toolbar">').attr('data-editor-id', this.editorId),
                    this.contentEditable
                ),
                this.textarea
            );

            this.handleScrollbars();

            this.initAutoSaveAsDraft();

            return this;
        }

    });

    return MailComposeView;
});
