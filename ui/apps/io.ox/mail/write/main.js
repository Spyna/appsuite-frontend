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
 * @author Martin Holzhauer <martin.holzhauer@open-xchange.com>
 */

define('io.ox/mail/write/main',
    ['io.ox/mail/api',
     'io.ox/mail/util',
     'io.ox/core/extensions',
     'io.ox/core/config',
     'io.ox/contacts/api',
     'io.ox/contacts/util',
     'io.ox/core/api/user',
     'io.ox/core/api/account',
     'io.ox/core/tk/upload',
     'io.ox/mail/model',
     'io.ox/mail/write/view-main',
     'io.ox/core/notifications',
     'settings!io.ox/mail',
     'gettext!io.ox/mail',
     'less!io.ox/mail/style.css',
     'less!io.ox/mail/write/style.css'], function (mailAPI, mailUtil, ext, config, contactsAPI, contactsUtil, userAPI, accountAPI, upload, MailModel, WriteView, notifications, settings, gt) {

    'use strict';

    // actions (define outside of multi-instance app)
    ext.point('io.ox/mail/write/actions/send').extend({
        id: 'send',
        action: function (app) {
            app.send();
        }
    });

    // actions (define outside of multi-instance app)
    ext.point('io.ox/mail/write/actions/draft').extend({
        id: 'send',
        action: function (app) {
            app.saveDraft().done(function (data) {
                app.setMsgRef(data.data);
            }).fail(function (e) {

            });
        }
    });

    ext.point('io.ox/mail/write/actions/proofread').extend({
        id: 'proofread',
        action: function (app) {
            app.proofread();
        }
    });

    // links
//    ext.point('io.ox/mail/write/links/toolbar').extend(new ext.Link({
//        index: 200,
//        id: 'proofread',
//        label: 'Proofread',
//        ref: 'io.ox/mail/write/actions/proofread'
//    }));

    var UUID = 1;

    // multi instance pattern
    function createInstance() {

        var app, win,
            editor,
            editorHash = {},
            currentSignature = '',
            editorMode,
            defaultEditorMode = settings.get('messageFormat'),
            mailState,
            composeMode,
            view,
            model;

        app = ox.ui.createApp({
            name: 'io.ox/mail/write',
            title: 'Compose'
        });

        model = new MailModel();
        view = new WriteView({ model: model, app: app });

        view.ID = 'YEAH #' + (UUID++);

        app.getView = function () {
            return view;
        };

        window.newmailapp = function () { return app; };

        app.STATES = {
            'CLEAN': 1,
            'DIRTY': 2
        };

        mailState = app.STATES.CLEAN;

        app.getState = function () {
            return mailState;
        };

        app.markDirty = function () {
            mailState = app.STATES.DIRTY;
        };

        app.markClean = function () {
            mailState = app.STATES.CLEAN;
        };

        view.signatures = _(config.get('gui.mail.signatures', [])).map(function (obj) {
            obj.signature_name = _.noI18n(obj.signature_name);
            return obj;
        });

        app.setSignature = function (e) {

            var index = e.data.index,
                signature, text,
                ed = this.getEditor(),
                isHTML = !!ed.removeBySelector;

            // remove current signature from editor
            if (isHTML) {
                ed.removeBySelector('.io-ox-signature');
            } else {
                if (currentSignature) {
                    ed.replaceParagraph(currentSignature, '');
                    currentSignature = '';
                }
            }

            // add signature?
            if (index < view.signatures.length) {
                signature = view.signatures[index];
                text = $.trim(signature.signature_text);
                if (isHTML) {
                    ed.appendContent('<p class="io-ox-signature">' + ed.ln2br(text) + '</p>');
                } else {
                    ed.appendContent(text);
                }
                currentSignature = text;
                ed.scrollTop('bottom');
            }

            ed.focus();
        };

        function focus(name) {
            app.getWindowNode().find('input[name="' + name + '"], input[data-type="' + name + '"]').focus().select();
        }

        // launcher
        app.setLauncher(function () {

            win = ox.ui.createWindow({
                name: 'io.ox/mail/write',
                title: '',
                toolbar: true,
                close: true
            });

            // due to tinyMCE's iframe
            win.detachable = false;

            app.setWindow(win);
            view.render();

            // add panels to windows
            win.nodes.main
            .addClass('io-ox-mail-write')
            .append(
                view.form = $('<form>', {
                    name: 'compose',
                    method: 'post',
                    enctype: 'multipart/form-data'
                })
                .addClass('form-inline')
                .append(
                    $('<input>', { type: 'hidden', name: 'msgref', value: '' }),
                    $('<input>', { type: 'hidden', name: 'sendtype', value: mailAPI.SENDTYPE.NORMAL }),
                    view.main,
                    view.scrollpane
                )
            );

            var dropZone = upload.dnd.createDropZone({'type': 'single'});
            dropZone.on('drop', function (e, file) {
                view.form.find('input[type=file]').last()
                    .prop('file', file)
                    .trigger('change');
                view.showSection('attachments');
            });

            win.on('show', function () {
                if (app.getEditor()) {
                    app.getEditor().handleShow();
                }
                dropZone.include();
            });

            win.on('hide', function () {
                if (app && app.getEditor()) {
                    app.getEditor().handleHide();
                }
                dropZone.remove();
            });
        });

        /**
         * Setters
         */
        app.setFormat = (function () {

            app.markDirty();

            function load(mode, content) {
                var editorSrc = 'io.ox/core/tk/' + (mode === 'html' ? 'html-editor' : 'text-editor');
                return require([editorSrc]).pipe(function (Editor) {
                    return (editorHash[mode] = new Editor(view.textarea))
                        .done(function () {
                            app.setEditor(editorHash[mode]);
                            app.getEditor().setPlainText(content);
                            app.getEditor().handleShow();
                        });
                });
            }

            function reuse(mode, content) {
                app.setEditor(editorHash[mode]);
                app.getEditor().setPlainText(content);
                app.getEditor().handleShow();
                return $.when();
            }

            function changeMode(mode) {
                // be busy
                view.textarea.attr('disabled', 'disabled').busy();
                if (app.getEditor()) {
                    var content = app.getEditor().getPlainText();
                    app.getEditor().clear();
                    app.getEditor().handleHide();
                    if (app.getEditor().tinymce) {
                        // changing from HTML to TEXT
                        if (!editorHash.text) {
                            // load TEXT editor for the first time
                            return load('text', content);
                        } else {
                            // reuse TEXT editor
                            return reuse('text', content);
                        }
                    } else {
                        // changing from TEXT to HTML
                        if (!editorHash.html) {
                            // load HTML editor for the first time
                            return load('html', content);
                        } else {
                            // reuse HTML editor
                            return reuse('html', content);
                        }
                    }
                } else {
                    // initial editor
                    return load(mode);
                }
            }

            return _.queued(function (mode) {
                // change?
                return (mode === editorMode ?
                    $.when() :
                    changeMode(mode || editorMode).done(function () {
                        editorMode = mode || editorMode;
                    })
                );
            });
        }());

        app.setSubject = function (str) {
            app.markDirty();
            view.subject.val(str || '');
        };

        app.setRawBody = function (str) {
            app.markDirty();
            app.getEditor().setContent(str);
        };

        app.getPrimaryAddressFromFolder = function (data) {

            var folder_id = 'folder_id' in data ? data.folder_id : 'default0/INBOX',
                accountID = mailAPI.getAccountIDFromFolder(folder_id);

            return accountAPI.get(accountID).pipe(function (data) {
                return [data.personal || '', data.primary_address];
            });
        };

        app.getFrom = function () {
            return (view.sidepanel.find('.fromselect-wrapper select').val() || '')
                .split(/\|/).reverse();
        };

        app.setFrom = function (data) {
            return this.getPrimaryAddressFromFolder(data).done(function (from) {
                var value = from[1] + '|' + (from[0] || from[1]);
                view.sidepanel.find('select').val(value);
            });
        };

        app.setBody = function (str) {
            app.markDirty();
            // get default signature
            var ds = _(view.signatures)
                    .find(function (o) {
                        return o.signature_default === true;
                    }),
                signature = ds ? $.trim(ds.signature_text) : '',
                pos = ds ? ds.position : 'below',
                content = $.trim(str);
            // set signature?
            if (ds) {
                // remember as current signature
                currentSignature = signature;
                // yep
                if (editorMode === 'html') {
                    // prepare signature for html
                    signature = '<p>' + signature.replace(/\n/g, '<br>') + '</p>';
                    // text/html
                    content = '<p></p>' + (pos === 'above' ? signature + content : content + signature);
                } else {
                    // text/plain
                    content = pos === 'above' ?
                        '\n\n' + signature + (content !== '' ? '\n\n' + content : '') :
                        '\n\n' + (content !== '' ? content + '\n\n' : '') + signature;
                }
            } else {
                // no signature
                content = content !== '' ? (editorMode === 'html' ? '<p></p>' : '\n\n') + content : '';
            }
            app.getEditor().setContent(content);
        };

        app.setTo = function (list) {
            view.addRecipients('to', list || []);
        };

        app.setCC = function (list) {
            view.addRecipients('cc', list || []);
            if (list && list.length) {
                view.showSection('cc', false);
            }
        };

        app.setBCC = function (list) {
            view.addRecipients('bcc', list || []);
            if (list && list.length) {
                view.showSection('bcc', false);
            }
        };

        app.setAttachments = function (list) {
            app.markDirty();
            // look for real attachments
            var found = false;
            _(list || []).each(function (attachment) {
                if (attachment.disp === 'attachment') {
                    // add as linked attachment
                    attachment.type = 'file';
                    found = true;
                    view.form.find('input[type=file]').last()
                        .prop('attachment', attachment)
                        .trigger('change');
                }
            });
            if (found) {
                view.showSection('attachments');
            }
        };

        app.setNestedMessages = function (list) {
            app.markDirty();
            var found = false;
            _(list || []).each(function (obj) {
                found = true;
                view.form.find('input[type=file]').last()
                    .prop('nested', { message: obj, name: obj.subject, content_type: 'message/rfc822' })
                    .trigger('change');
            });
            if (found) {
                view.showSection('attachments');
            }
        };

        app.addFiles = function (list) {
            app.markDirty();
            var found = false;
            _(list || []).each(function (obj) {
                found = true;
                view.form.find('input[type=file]').last()
                    .prop('file', obj)
                    .trigger('change');
            });
            if (found) {
                view.showSection('attachments');
            }
        };

        app.setPriority = function (prio) {
            app.markDirty();
            // be robust
            prio = parseInt(prio, 10) || 3;
            prio = prio < 3 ? 1 : prio;
            prio = prio > 3 ? 5 : prio;
            // set
            view.form.find('input[name=priority][value=' + prio + ']')
                .prop('checked', true);
            // high priority?
            if (prio === 1) {
                view.priorityOverlay.addClass('high');
            }
        };

        app.setAttachVCard = function (bool) {
            app.markDirty();
            // set
            view.form.find('input[name=vcard]').prop('checked', !!bool);
        };

        app.setDeliveryReceipt = function (bool) {
            app.markDirty();
            // set
            view.form.find('input[name=receipt]').prop('checked', !!bool);
        };

        app.setMsgRef = function (ref) {
            app.markDirty();
            view.form.find('input[name=msgref]').val(ref || '');
        };

        app.setSendType = function (type) {
            app.markDirty();
            view.form.find('input[name=sendtype]').val(type || mailAPI.SENDTYPE.NORMAL);
        };

        var windowTitles = {
            compose: gt('Compose new mail'),
            replyall: gt('Reply all'),
            reply: gt('Reply'),
            forward: gt('Forward')
        };

        app.setMail = function (mail) {
            // be robust
            mail = mail || {};
            mail.data = mail.data || {};
            mail.mode = mail.mode || 'compose';
            mail.format = mail.format || defaultEditorMode || 'text';
            mail.initial = mail.initial || false;

            //config settings
            mail.data.vcard = settings.get('appendVcard');

            // call setters
            var data = mail.data;

            this.setFrom(data);
            this.setSubject(data.subject);
            this.setTo(data.to);
            this.setCC(data.cc);
            this.setBCC(data.bcc);
            this.setAttachments(data.attachments);
            this.setNestedMessages(data.nested_msgs);
            this.setPriority(data.priority || 3);
            this.setAttachVCard(data.vcard !== undefined ? data.vcard : config.get('mail.vcard', false));
            this.setDeliveryReceipt(data.disp_notification_to !== undefined ? data.disp_notification_to : false);
            this.setMsgRef(data.msgref);
            this.setSendType(data.sendtype);
            // add files (from file storage)
            this.addFiles(data.infostore_ids);
            // apply mode
            var title = data.subject ? _.noI18n(data.subject) : windowTitles[composeMode = mail.mode];
            win.setTitle(title);
            app.setTitle(title);
            // set signature
            currentSignature = mail.signature || '';
            // set format
            return app.setFormat(mail.format)
                .done(function () {
                    // set body
                    var content = data.attachments && data.attachments.length ? data.attachments[0].content : '';
                    if (mail.format === 'text') {
                        content = content.replace(/<br>\n?/g, '\n');
                    }
                    // image URL fix
                    if (editorMode === 'html') {
                        content = content.replace(/(<img[^>]+src=")\/ajax/g, '$1' + ox.apiRoot);
                    }
                    app[mail.initial ? 'setBody' : 'setRawBody'](content);
                });
        };

        app.failSave = function () {
            var mail = app.getMail();
            delete mail.files;
            return {
                module: 'io.ox/mail/write',
                point: mail
            };
        };

        app.failRestore = function (point) {
            var def = $.Deferred();
            win.busy().show(function () {
                _.url.hash('app', 'io.ox/mail/write:' + point.mode);
                app.setMail(point).done(function () {
                    app.getEditor().focus();
                    win.idle();
                    def.resolve();
                });
            });
            return def;
        };

        /**
         * Compose new mail
         */
        app.compose = function (data) {

            // register mailto!
            if (navigator.registerProtocolHandler) {
                var l = location, $l = l.href.indexOf('#'), url = l.href.substr(0, $l);
                navigator.registerProtocolHandler(
                    'mailto', url + '#app=io.ox/mail/write:compose&mailto=%s', ox.serverConfig.productNameMail
                );
            }

            var mailto, tmp, params, def = $.Deferred();

            // triggerd by mailto?
            if (data === undefined && (mailto = _.url.hash('mailto'))) {
                tmp = mailto.split(/\?/, 2);
                params = _.deserialize(tmp[1]);
                tmp = tmp[0].split(/\:/, 2);
                // save data
                data = {
                    to: [['', tmp[1]]],
                    subject: params.subject,
                    attachments: [{ content: params.body }]
                };
                // clear hash
                _.url.hash('mailto', null);
            }

            _.url.hash('app', 'io.ox/mail/write:compose');

            win.busy().show(function () {
                app.setMail({ data: data, mode: 'compose', initial: true })
                .done(function () {
                    if (mailto) {
                        app.getEditor().focus();
                    } else if (data && data.to) {
                        focus('subject');
                    } else {
                        focus('to');
                    }
                    win.idle();
                    def.resolve();
                });
            });

            return def;
        };

        /**
         * Reply (all)
         */
        function reply(type) {

            return function (obj) {

                var def = $.Deferred();
                _.url.hash('app', 'io.ox/mail/write:' + type);

                function cont(obj) {
                    win.busy().show(function () {
                        mailAPI[type](obj, defaultEditorMode || 'text')
                        .done(function (data) {
                            data.sendtype = mailAPI.SENDTYPE.REPLY;
                            app.setMail({ data: data, mode: type, initial: true })
                            .done(function () {
                                app.getEditor().focus();
                                view.scrollpane.scrollTop(0);
                                win.idle();
                                def.resolve();
                            });
                        });
                    });
                }

                if (obj === undefined) {
                    cont({ folder: _.url.hash('folder'), id: _.url.hash('id') });
                } else {
                    cont(obj);
                }

                return def;
            };
        }

        app.replyall = reply('replyall');
        app.reply = reply('reply');

        /**
         * Forward
         */
        app.forward = function (obj) {

            var def = $.Deferred();
            _.url.hash('app', 'io.ox/mail/write:forward');

            win.busy().show(function () {
                mailAPI.forward(obj, defaultEditorMode || 'text')
                .done(function (data) {
                    data.sendtype = mailAPI.SENDTYPE.FORWARD;
                    app.setMail({ data: data, mode: 'forward', initial: true })
                    .done(function () {
                        focus('to');
                        win.idle();
                        def.resolve();
                    });
                });
            });
            return def;
        };

        /**
         * Get mail
         */
        app.getMail = function () {
            var // get relevant fields
                fields = view.form
                    .find(':input[name]')
                    .filter('textarea, [type=text], [type=hidden], [type=radio]:checked, [type=checkbox]:checked'),
                // get raw data
                data = _(fields).inject(function (obj, field) {
                    var key = field.name, pre = obj[key], val = $(field).val();
                    if (pre !== undefined) {
                        // make array or push to array
                        (_.isArray(pre) ? pre : (obj[key] = [pre])).push(val);
                    } else {
                        obj[key] = val;
                    }
                    return obj;
                }, {}),
                content,
                mail,
                files = [],
                parse = function (list) {
                    return _(mailUtil.parseRecipients([].concat(list).join(', ')))
                        .map(function (recipient) {
                            return ['"' + recipient[0] + '"', recipient[1]];
                        });
                };

            data.from = this.getFrom();

            // get content
            if (editorMode === 'html') {
                content = {
                    content_type: 'text/html',
                    content: (app.getEditor() ? app.getEditor().getContent() : '')
                        // reverse img fix
                        .replace(/(<img[^>]+src=")(\/ox7\/)?api\//g, '$1/ajax/')
                };
            } else {
                content = {
                    content_type: 'text/plain',
                    content: (app.getEditor() ? app.getEditor().getContent() : '')
                        .replace(/</g, '&lt;') // escape <
                        .replace(/\n/g, '<br>\n') // escape line-breaks
                };
            }
            // transform raw data

            mail = {
                from: [data.from] || [],
                to: parse(data.to),
                cc: parse(data.cc),
                bcc: parse(data.bcc),
                subject: data.subject + '',
                priority: parseInt(data.priority, 10) || 3,
                vcard: parseInt(data.vcard, 10) || 0,
                attachments: [content],
                nested_msgs: []
            };
            // delivery receipt (add only if true)
            if (parseInt(data.receipt, 10)) {
                mail.disp_notification_to = true;
            }
            // add msgref?
            if (data.msgref) {
                mail.msgref = data.msgref;
            }
            // sendtype
            mail.sendtype = data.sendtype || mailAPI.SENDTYPE.NORMAL;
            // get files
            view.form.find(':input[name][type=file]')
                .each(function () {
                    // link to existing attachments (e.g. in forwards)
                    var attachment = $(this).prop('attachment'),
                        // get file via property (DND) or files array and add to list
                        file = $(this).prop('file'),
                        // get nested messages
                        nested = $(this).prop('nested');
                    if (attachment) {
                        // add linked attachment
                        mail.attachments.push(attachment);
                    } else if (nested) {
                        // add nested message (usually multiple mail forward)
                        mail.nested_msgs.push(nested.message);
                    } else if (file instanceof window.File) {
                        // add dropped file
                        files.push(file);
                    } else if (file && 'id' in file) {
                        // infostore id
                        (mail.infostore_ids = (mail.infostore_ids || [])).push(file);
                    } else if (this.files && this.files.length) {
                        // process normal upload
                        _(this.files).each(function (file) {
                            files.push(file);
                        });
                    }
                });
            // return data, file references, mode, format
            return {
                data: mail,
                mode: composeMode,
                format: editorMode,
                signature: currentSignature,
                files: files
            };
        };

        /**
         * Send mail
         */
        app.send = function () {
            // get mail
            var mail = this.getMail(), def = $.Deferred();
            // get flat ids for data.infostore_ids
            if (mail.data.infostore_ids) {
                mail.data.infostore_ids = _(mail.data.infostore_ids).pluck('id');
            }
            // move nested messages into attachment array
            _(mail.data.nested_msgs).each(function (obj) {
                mail.data.attachments.push({
                    id: mail.data.attachments.length + 1,
                    filemname: obj.subject,
                    content_type: 'message/rfc822',
                    msgref: obj.msgref
                });
            });
            delete mail.data.nested_msgs;

            function cont() {
                // close window now (!= quit / might be reopened)
                app.markClean();
                win.busy().preQuit();
                // send!
                mailAPI.send(mail.data, mail.files)
                    .always(function (result) {
                        if (result.error) {
                            console.error(result);
                            win.idle().show();
                            // TODO: check if backend just says "A severe error occured"
                            notifications.yell(result);
                        } else {
                            notifications.yell('success', 'Mail has been sent');
                            app.quit();
                        }
                        def.resolve(result);
                    });
            }

            // ask for empty subject
            if ($.trim(mail.data.subject) === '') {
                // show dialog
                require(["io.ox/core/tk/dialogs"], function (dialogs) {
                    new dialogs.ModalDialog()
                        .text(gt("Mail has empty subject. Send it anyway?"))
                        .addPrimaryButton("send", gt('Yes, send without subject'))
                        .addButton("subject", gt('Add subject'))
                        .show(function () {
                            def.notify('empty subject');
                        })
                        .done(function (action) {
                            if (action === 'send') {
                                cont();
                            } else {
                                focus('subject');
                                def.reject();
                            }
                        });
                });
            } else {
                cont();
            }

            return def;
        };

        app.saveDraft = function () {
            // get mail
            var mail = this.getMail(),
                def = new $.Deferred();
            // send!
            mail.data.sendtype = mailAPI.SENDTYPE.DRAFT;

            if (_(mail.data.flags).isUndefined()) {
                mail.data.flags = mailAPI.FLAGS.DRAFT;
            } else if (mail.data.flags & 4 === 0) {
                mail.data.flags += mailAPI.FLAGS.DRAFT;
            }

            mailAPI.send(mail.data, mail.files)
                .always(function (result) {
                    if (result.error) {
                        notifications.yell(result);
                        def.reject(result);
                    } else {
                        notifications.yell('success', gt('Mail saved as draft'));
                        app.markClean();
                        def.resolve(result);
                    }
                });

            return def;
        };

        /**
         * Get editor
         */
        app.getEditor = function () {
            return editor;
        };

        app.setEditor = function (e) {
            editor = e;
        };

        // destroy
        app.setQuit(function () {

            var def = $.Deferred();

            var clean = function () {
                // clean up editors
                for (var id in editorHash) {
                    editorHash[id].destroy();
                }
                // clear all private vars
                app = win = editor = currentSignature = editorHash = null;
            };

            if (app.getState() === app.STATES.DIRTY) {
                require(["io.ox/core/tk/dialogs"], function (dialogs) {
                    new dialogs.ModalDialog()
                        .text(gt("Do you really want to cancel editing this mail?"))
                        .addPrimaryButton("delete", gt('Lose changes'))
                        .addAlternativeButton('savedraft', gt('Save as draft'))
                        .addButton("cancel", gt('Cancel'))
                        .show()
                        .done(function (action) {
                            if (action === 'delete') {
                                clean(); // clean before resolve, otherwise tinymce gets half-destroyed (ugly timing)
                                def.resolve();
                            } else if (action === 'savedraft') {
                                app.saveDraft().done(function (mail) {
                                    clean();
                                    def.resolve();
                                }).fail(function (e) {
                                    def.reject(e);
                                });
                            } else {
                                def.reject();
                            }
                        });
                });
            } else {
                clean();
                def.resolve();
            }

            return def;
        });

        return app;
    }

    return {
        getApp: createInstance
    };

});


