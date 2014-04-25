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
 * @author Martin Holzhauer <martin.holzhauer@open-xchange.com>
 */

define('io.ox/mail/write/main',
    ['io.ox/mail/api',
     'io.ox/mail/util',
     'io.ox/core/extensions',
     'io.ox/contacts/api',
     'io.ox/contacts/util',
     'io.ox/core/api/user',
     'io.ox/core/api/account',
     'io.ox/core/tk/upload',
     'io.ox/mail/model',
     'io.ox/mail/write/view-main',
     'io.ox/emoji/main',
     'io.ox/core/notifications',
     'io.ox/mail/sender',
     'settings!io.ox/mail',
     'settings!io.ox/core',
     'gettext!io.ox/mail',
     'less!io.ox/mail/style',
     'less!io.ox/mail/write/style'
    ], function (mailAPI, mailUtil, ext, contactsAPI, contactsUtil, userAPI, accountAPI, upload, MailModel, WriteView, emoji, notifications, sender, settings, coreSettings, gt) {

    'use strict';

    var ACTIONS = 'io.ox/mail/write/actions';

    // actions (define outside of multi-instance app)
    ext.point(ACTIONS + '/send').extend({
        action: function (baton) {
            baton.app.send();
        }
    });

    // actions (define outside of multi-instance app)
    ext.point(ACTIONS + '/draft').extend({
        action: function (baton) {
            var self = this;
            self.busy();
            baton.app.saveDraft()
                .done(function () {
                    self.idle();
                });
        }
    });

    ext.point(ACTIONS + '/discard').extend({
        action: function (baton) {
            baton.app.quit();
        }
    });

    var UUID = 1,
        blocked = {},
        timerScale = {
            minute: 60000, //60s
            minutes: 60000
        },
        convertAllToUnified = emoji.converterFor({
            from: 'all',
            to: 'unified'
        });

    function stopAutoSave(app) {
        if (app.autosave) {
            window.clearTimeout(app.autosave.timer);
        }
    }

    function initAutoSaveAsDraft(app) {

        var timeout = settings.get('autoSaveDraftsAfter', false),
            scale, delay, timer;

        if (!timeout) return;

        timeout = timeout.split('_');
        scale = timerScale[timeout[1]];
        timeout = timeout[0];

        if (!timeout || !scale) return; // settings not parsable

        stopAutoSave(app);

        delay = function () {
            app.autosave.timer = _.delay(timer, timeout * scale);
        };

        timer = function () {
            // only auto-save if something changed (see Bug #26927)
            if (app.dirty()) {
                app.saveDraft().done(function (data) {
                    app.refId = data.id;
                });
            } else {
                delay();
            }
        };

        app.autosave = {};
        delay();
    }

    function attachmentsExceedQouta(mail) {
        var allAttachmentsSizes = [].concat(mail.files).concat(mail.data.attachments)
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
    }

    function prepareMailForSending(mail) {
        // get flat ids for data.infostore_ids
        if (mail.data.infostore_ids) {
            mail.data.infostore_ids = _(mail.data.infostore_ids).pluck('id');
        }
        // get flat cids for data.contacts_ids
        if (mail.data.contacts_ids) {
            mail.data.contacts_ids = _(mail.data.contacts_ids).map(function (o) { return _.pick(o, 'folder_id', 'id'); });
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
    }

    // multi instance pattern
    function createInstance() {

        var app, win,
            editor,
            editorHash = {},
            currentSignature = '',
            editorMode,
            messageFormat = settings.get('messageFormat', 'html'),
            composeMode,
            prioActive = false,
            view,
            model,
            previous;

        // don’t force text on phantomjs, because phantomjs reports as a touch device
        // see https://github.com/ariya/phantomjs/issues/10375
        if (!_.device('phantomjs') && Modernizr.touch) messageFormat = 'text'; // See Bug 24802

        function blockReuse(sendtype) {
            blocked[sendtype] = (blocked[sendtype] || 0) + 1;
        }

        function unblockReuse(sendtype) {
            blocked[sendtype] = (blocked[sendtype] || 0) - 1;
            if (blocked[sendtype] <= 0)
                delete blocked[sendtype];
        }

        function getDefaultEditorMode() {
            return messageFormat === 'text' ? 'text' : 'html';
        }

        function getEditorMode(mode) {
            return mode === 'text' ? 'text' : 'html';
        }

        function getContentType(mode) {
            if (mode === 'text') {
                return 'text/plain';
            } else {
                return messageFormat === 'html' ? 'text/html' : 'alternative';
            }
        }

        app = ox.ui.createApp({
            name: 'io.ox/mail/write',
            title: gt('Compose'),
            userContent: true,
            closable: true
        });

        model = new MailModel();
        view = new WriteView({ model: model, app: app });

        view.ID = 'YEAH #' + (UUID++);

        app.getView = function () {
            return view;
        };

        window.newmailapp = function () { return app; };

        app.getMobileSignature = function () {
            var value = settings.get('mobileSignature');
            if (value === undefined) {
                value =
                    //#. %s is the product name
                    gt('Sent from %s via mobile', ox.serverConfig.productName);
            }
            return value;
        };

        view.signatures = _.device('smartphone') ? [{ id: 0, content: app.getMobileSignature() }] : [];

        app.getSignatures = function () {
            return view.signatures;
        };

        app.isSignature = function (text) {
            var isHTML = !!this.getEditor().find;
            return mailUtil.signatures.is(text, this.getSignatures(), isHTML);
        };

        /**
         * @param  {string} text (signature content)
         * @return {string} html string
         */
        var getParagraph = function (text) {
            //use div for html cause innerHTML for p tags with nested tags fail
            var node = (/(<([^>]+)>)/ig).test(text) ? $('<div>') : $('<p>');
            node.addClass('io-ox-signature')
                .append(app.getEditor().ln2br(text));
            return $('<div>').append(node).html();
        };

        app.setSignature = function (obj) {
            var index = obj.data.index,
                signature, text,
                ed = this.getEditor(),
                isHTML = !!ed.find;

            // remove current signature from editor
            if (isHTML) {
                ed.find('.io-ox-signature').each(function () {
                    var node = $(this),
                        text = node.html()
                            //remove added image urls(tiny adds them automatically)
                            .replace(/ data-mce-src="[^"]+"\s?/, '');

                    if (app.isSignature(text)) {
                        // remove entire node
                        node.remove();
                    } else {
                        // was modified so remove class
                        node.removeClass('io-ox-signature');
                    }
                });
            } else {
                if (currentSignature) {
                    ed.replaceParagraph(currentSignature, '');
                    currentSignature = '';
                }
            }

            // add signature?
            if (index < view.signatures.length) {
                signature = view.signatures[index];
                text = mailUtil.signatures.cleanAdd(signature.content, isHTML);
                if (_.isString(signature.misc)) { signature.misc = JSON.parse(signature.misc); }
                if (isHTML) {
                    text = getParagraph(text);
                    if (signature.misc && signature.misc.insertion === 'below') {
                        ed.appendContent(text);
                        ed.scrollTop('bottom');
                    } else {
                        ed.prependContent(text);
                        ed.scrollTop('top');
                    }
                } else {
                    if (signature.misc && signature.misc.insertion === 'below') {
                        ed.appendContent(text);
                        ed.scrollTop('bottom');
                    } else {
                        ed.prependContent(text);
                        ed.scrollTop('top');
                    }
                }
                currentSignature = text;
            }

            addBlankLine(signature);

            ed.focus();
        };

        function focus(name) {
            app.getWindowNode().find('input[name="' + name + '"], input[data-type="' + name + '"]').focus().select();
        }

        // launcher
        app.setLauncher(function () {

            win = ox.ui.createWindow({
                name: 'io.ox/mail/write',
                chromeless: true
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
                    $('<input>', { type: 'hidden', name: 'headers', value: '' }),
                    view.leftside,
                    view.rightside
                )
            );

            if (_.browser.IE === undefined || _.browser.IE > 9) {
                var dropZone = upload.dnd.createDropZone({'type': 'single', actions: [{id: 'mailAttachment', label: gt('Drop the file anywhere to add attachment')}]});
                dropZone.on('drop', function (e, file) {
                    view.fileList.add(_.extend(file, { group: 'file' }));
                    view.showSection('attachments');
                });
            }
            win.on('show', function () {
                if (app.getEditor()) {
                    app.getEditor().handleShow();
                }
                if (dropZone) {dropZone.include(); }
            });

            win.on('hide', function () {
                if (app && app.getEditor()) {
                    app.getEditor().handleHide();
                }
                if (dropZone) { dropZone.remove(); }
            });

            _.defer(initAutoSaveAsDraft, app);
        });

        /**
         * Setters
         */
        app.setFormat = (function () {

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
                view.textarea.prop('disabled', true).busy();
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
                mode = getEditorMode(mode);
                return (mode === editorMode ?
                    $.when() :
                    changeMode(mode || editorMode).done(function () {
                        editorMode = mode || editorMode;
                    })
                );
            });
        }());

        app.setSubject = function (str) {
            view.subject.val(str || '');
        };

        app.setRawBody = function (str) {
            app.getEditor().setContent(str);
        };

        app.getFrom = function () {
            var select = view.leftside.find('.sender-dropdown');
            return sender.get(select);
        };

        app.setFrom = function (data) {
            var folder_id = 'folder_id' in data ? data.folder_id : 'default0/INBOX',
                select = view.leftside.find('.sender-dropdown'),
                filteredAccountId;

            // from is already set in the mail, prefer this
            if (data.from && data.from.length === 1) {
                sender.set(select, data.from[0]);
                return;
            }

            filteredAccountId = accountAPI.isUnified(data.account_id) ? accountAPI.parseAccountId(data.msgref) : data.account_id;

            accountAPI.getPrimaryAddressFromFolder(filteredAccountId || folder_id).done(function (from) {
                sender.set(select, from);
            });
        };

        // this is different to $.trim, as it preserves white-space in the first line
        function trimContent(str) {
            // remove white-space at beginning except in first-line
            str = String(str || '').replace(/^[\s\xA0]*\n([\s\xA0]*\S)/, '$1');
            // remove white-space at end
            return str.replace(/[\s\uFEFF\xA0]+$/, '');
        }

        var addBlankLine = function (signature) {
            var content = editor.getContent(),
                blankline = editorMode === 'html' ? '<p><br></p>' : '',
                pos = signature ? signature.misc && signature.misc.insertion || 'below' : 'below';
            //required only in html mode with 'above' pos (and if it's not set already)
            if (!(content === '' && pos === 'below' && editorMode === 'text') && content.indexOf(blankline) !== 0) {
                app.getEditor().prependContent(blankline);
            }
        };

        app.setBody = function (str) {
            var content = trimContent(str),
                dsID, ds;
            //get default signature
            dsID = _.device('smartphone') ?
                (settings.get('mobileSignatureType') === 'custom' ? 0 : 1) :
                settings.get('defaultSignature');
            ds = _.find(view.signatures, function (o, i) {
                    o.index = i;
                    return o.id === dsID;
                });
            //set content
            app.getEditor().setContent(content);
            //fix misc property and set signature
            if (ds) {
                ds.misc = _.isString(ds.misc) ? JSON.parse(ds.misc) : ds.misc;
                app.setSignature(({ data: ds}));
            }
        };

        app.getRecipients = function (id) {

            // get raw list
            var list = _(view.form.find('input[name=' + id + ']')).map(function (node) {
                var recipient = mailUtil.parseRecipient($(node).val()),
                    typesuffix = mailUtil.getChannel(recipient[1]) === 'email' ? '' : mailUtil.getChannelSuffixes().msisdn;
                return ['"' + recipient[0] + '"', recipient[1], typesuffix];
            });

            return list;
        };

        app.getTo = function () {
            return app.getRecipients('to');
        };

        app.setTo = function (list) {
            view.addRecipients('to', list || []);
        };

        app.getCC = function () {
            return app.getRecipients('cc');
        };

        app.setCC = function (list) {
            view.addRecipients('cc', list || []);
            if (list && list.length) {
                view.showSection('cc', false);
            }
        };

        app.getBCC = function () {
            return app.getRecipients('bcc');
        };

        app.setBCC = function (list) {
            view.addRecipients('bcc', list || []);
            if (list && list.length) {
                view.showSection('bcc', false);
            }
        };

        app.setReplyTo = function (value) {
            if (settings.get('showReplyTo/configurable', false) === false) return;
            view.form.find('input#writer_field_replyTo').val(value);
        };

        app.setAttachments = function (data) {
            // look for real attachments
            var items = _.chain(data.attachments || [])
                        .filter(function (attachment) {
                            //only real attachments
                            return attachment.disp === 'attachment';
                        })
                        .map(function (attachment) {
                            // add as linked attachment
                            if (data.msgref) {
                                attachment.atmsgref = data.msgref;
                            }
                            attachment.type = attachment.filename && attachment.filename.split('.').length > 1  ? attachment.filename.split('.').pop() : 'file';
                            attachment.group = 'attachment';
                            return attachment;
                        })
                        .value();
            //add to file list and show section
            if (items.length) {
                view.fileList.add(items);
            }
        };

        app.setNestedMessages = function (data) {
            var list = data.nested_msgs, parent, items;
            //fixes preview: mail compose save of an forwarded mail with previewable attachment
            if (data.folder_id && data.id) {
                parent = {
                    folder_id: data.folder_id,
                    id: data.id
                };
            }
            items = _(list || []).map(function (obj) {
                return _.extend(obj, { content_type: 'message/rfc822', parent: parent, group: 'nested'});
            });
            if (items.length) {
                view.fileList.add(items);
            }
        };

        app.addFiles = function (list, group) {
            var items;
            items = _.map(list || [], function (obj) {
                return $.extend(obj, {group: group || 'file'});
            });
            if (items.length && view.fileList) {
                view.fileList.add(items);
            }
        };

        app.getPriority = function () {
            var high = view.form.find('input[name=priority][value=1]'),
                low = view.form.find('input[name=priority][value=5]');
            if (high.prop('checked')) return 1;
            if (low.prop('checked')) return 5;
            return 3;
        };

        app.setPriority = function (prio) {
            // be robust
            prio = parseInt(prio, 10) || 3;
            prio = prio < 3 ? 1 : prio;
            prio = prio > 3 ? 5 : prio;
            // set
            view.form.find('input[name=priority][value=' + prio + ']').prop('checked', true);
            // high or low priority?
            if (prio === 1) {
                view.priorityOverlay.attr('class', 'priority-overlay high');
            } else if (prio === 3) {
                view.priorityOverlay.attr('class', 'priority-overlay');
                if (prioActive) {
                    prioActive = false;
                    view.priorityOverlay.addClass('normal');
                } else {
                    prioActive = true;
                }
            } else if (prio === 5) {
                view.priorityOverlay.attr('class', 'priority-overlay low');
            }
        };

        app.setAttachVCard = function (bool) {
            // set
            view.form.find('input[name=vcard]').prop('checked', !!bool);
        };

        app.setMsgRef = function (ref) {
            view.form.find('input[name=msgref]').val(ref || '');
        };

        app.setSendType = function (type) {
            view.form.find('input[name=sendtype]').val(type || mailAPI.SENDTYPE.NORMAL);
        };

        /**
         * store headers data in form
         * @param {object} header key/value pairs
         * @returns {undefined}
         */
        app.setHeaders = function (headers) {
            view.form.find('input[name=headers]').val(JSON.stringify(headers) || '{}');
        };

        var windowTitles = {
            compose: gt('Compose new mail'),
            replyall: gt('Reply all'),
            reply: gt('Reply'),
            forward: gt('Forward')
        };

        app.getDefaultWindowTitle = function () {
            return windowTitles[composeMode || 'compose'];
        };

        app.dirty = function (flag) {
            if (flag === true) {
                previous = null; // always dirty this way
                return this;
            } else if (flag === false) {
                previous = app.getMail();
                return this;
            } else {
                return !_.isEqual(previous, app.getMail());
            }
        };

        app.setMail = function (mail) {
            // be robust
            mail = mail || {};
            mail.data = mail.data || {};
            mail.mode = mail.mode || 'compose';
            mail.format = mail.format || getDefaultEditorMode();
            mail.initial = mail.initial || false;

            //config settings
            mail.data.vcard = mail.data.vcard || settings.get('appendVcard');

            // Allow extensions to have a go at the data
            ext.point('io.ox/mail/write/initializers/before').invoke('modify', app, new ext.Baton({mail: mail, app: this}));

            // call setters
            var data = mail.data;

            this.setFrom(data);
            this.setSubject(convertAllToUnified(data.subject));
            this.setTo(data.to);
            this.setCC(data.cc);
            this.setBCC(data.bcc);
            this.setReplyTo(data.headers && data.headers['Reply-To']);
            this.setAttachments(data);
            this.setNestedMessages(data);
            this.setPriority(data.priority || 3);
            this.setAttachVCard(data.vcard !== undefined ? data.vcard : settings.get('vcard', false));
            this.setMsgRef(data.msgref);
            this.setSendType(data.sendtype);
            this.setHeaders(data.headers);
            // add files (from file storage)
            this.addFiles(data.infostore_ids, 'infostore');
            // add files (from contacts)
            this.addFiles(data.contacts_ids, 'vcard');
            // app title
            composeMode = mail.mode;
            var title = app.getDefaultWindowTitle();
            win.nodes.main.find('h1.title').text(title);
            title = data.subject ? _.noI18n(data.subject) : title;
            app.setTitle(title);
            // set signature
            currentSignature = mail.signature || '';
            // set format
            return app.setFormat(mail.format).done(function () {
                // set body
                // attachments: could contain separate html and text content
                var attachments = data.attachments ? (_.isArray(data.attachments) ? data.attachments : data.attachments[mail.format] || []) : (undefined),
                    content = attachments && attachments.length ? (attachments[0].content || '') : '';
                if (mail.format === 'text') {
                    content = _.unescapeHTML(content.replace(/<br\s*\/?>/g, '\n'));
                }
                // image URL fix
                if (editorMode === 'html') {
                    content = content.replace(/(<img[^>]+src=")\/ajax/g, '$1' + ox.apiRoot);
                }
                // convert different emoji encodings to unified
                content = convertAllToUnified(content);
                if (mail.replaceBody !== 'no') {
                    app[mail.initial ? 'setBody' : 'setRawBody'](content);
                }
                ext.point('io.ox/mail/write/initializers/after').invoke('modify', app, new ext.Baton({mail: mail, app: app}));
                // remember this state for dirty check
                previous = app.getMail();
            });
        };

        app.failSave = function () {
            var mail = app.getMail();
            delete mail.files;
            return {
                module: 'io.ox/mail/write',
                description: gt('Mail') + ': ' + (mail.data.subject || gt('No subject')),
                point: mail
            };
        };

        app.failRestore = function (point) {
            var def = $.Deferred();
            win.busy().show(function () {
                _.url.hash('app', 'io.ox/mail/write:' + point.mode);
                app.setMail(point).done(function () {
                    app.dirty(true);
                    win.idle();
                    app.getEditor().focus();
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
            if (settings.get('features/registerProtocolHandler', true)) {
                // only for browsers != firefox due to a bug in firefox
                // https://bugzilla.mozilla.org/show_bug.cgi?id=440620
                // maybe this will be fixed in the future by mozilla
                if (navigator.registerProtocolHandler && !_.browser.Firefox) {
                    var l = location, $l = l.href.indexOf('#'), url = l.href.substr(0, $l);
                    navigator.registerProtocolHandler(
                        'mailto', url + '#app=io.ox/mail/write:compose&mailto=%s', ox.serverConfig.productNameMail
                    );
                }
            }

            var mailto, tmp, params, def = $.Deferred();
            // triggerd by mailto?
            if (data === undefined && (mailto = _.url.hash('mailto'))) {
                tmp = mailto.split(/\?/, 2);
                params = _.deserialize(tmp[1]);
                // Bug: 31345
                for (var key in params) {
                    params[key.toLowerCase()] = params[key];
                }
                tmp = tmp[0].split(/\:/, 2);
                // save data
                data = {
                    to: mailUtil.parseRecipients(tmp[1]) || [['', tmp[1]]],
                    subject: params.subject,
                    attachments: [{ content: params.body || '' }]
                };
                // clear hash
                _.url.hash('mailto', null);
            }

            _.url.hash('app', 'io.ox/mail/write:compose');

            win.busy().show(function () {
                app.setMail({ data: data, mode: 'compose', initial: true })
                .done(function () {
                    // set data again, to use correct sender field
                    // fixes a timing problem because select field is not fully
                    // drawn, when setMail is called
                    app.setFrom(data || {});
                    // set to idle now; otherwise firefox doesn't set the focus
                    win.idle();
                    if (mailto) {
                        app.getEditor().focus();
                    } else if (data && data.to) {
                        focus('subject');
                    } else {
                        focus('to');
                    }
                    def.resolve({app: app});
                })
                .fail(function (e) {
                    notifications.yell(e);
                    app.dirty(false).quit();
                    def.reject();
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

                app.cid = 'io.ox/mail:' + type + '.' + _.cid(obj);

                function cont(obj) {
                    win.busy().show(function () {
                        mailAPI[type](obj, getDefaultEditorMode())
                        .done(function (data) {
                            data.sendtype = mailAPI.SENDTYPE.REPLY;
                            app.setMail({ data: data, mode: type, initial: true })
                            .done(function () {
                                var ed = app.getEditor();
                                ed.setCaretPosition(0);
                                win.idle();
                                ed.focus();
                                view.scrollpane.scrollTop(0);
                                def.resolve({app: app});
                                if (_.device('smartphone')) {
                                    // trigger keyup to resize the textarea
                                    view.textarea.trigger('keyup');
                                    // Keyboard can not be triggered on Mobile Safari
                                    // needs user action
                                    if (_.device('ios')) {
                                        view.textarea.trigger('blur');
                                    }
                                }
                            });
                        })
                        .fail(function (e) {
                            notifications.yell(e);
                            app.dirty(false).quit();
                            def.reject();
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

            app.cid = 'io.ox/mail:forward.' + _.cid(obj);

            win.busy().show(function () {
                mailAPI.forward(obj, getDefaultEditorMode())
                .done(function (data) {
                    data.sendtype = mailAPI.SENDTYPE.FORWARD;
                    app.setMail({ data: data, mode: 'forward', initial: true })
                    .done(function () {
                        var ed = app.getEditor();
                        ed.setCaretPosition(0);
                        win.idle();
                        focus('to');
                        def.resolve();
                        if (_.device('smartphone')) {
                            // trigger keyup to resize the textarea
                            view.textarea.trigger('keyup');
                        }
                    });
                })
                .fail(function (e) {
                    notifications.yell(e);
                    app.dirty(false).quit();
                    def.reject();
                });
            });
            return def;
        };

        // edit draft
        app.edit = function (data) {

            var def = $.Deferred();

            _.url.hash('app', 'io.ox/mail/write:compose'); // yep, edit is same as compose

            app.cid = 'io.ox/mail:edit.' + _.cid(data); // here, for reuse it's edit!
            data.msgref = data.folder_id + '/' + data.id;

            function getMail(data) {
                if (data.content_type === 'text/html' && messageFormat === 'text') {
                    if (settings.get('allowHtmlMessages', true) === true) {
                        // we are editing a message with html format, keep it
                        data.format = 'html';
                        view.form.find('input[name=format][value=text]').prop('checked', false);
                        view.form.find('input[name=format][value=html]').prop('checked', true);
                        return $.Deferred().resolve(data);
                    } else {
                        // convert to plain text
                        var options = _.extend({ view: 'text', edit: '1' }, mailAPI.reduce(data));
                        return mailAPI.get(options, false);
                    }
                }
                else if (data.content_type !== 'text/html' &&
                    messageFormat === 'text' &&
                    settings.get('allowHtmlMessages', true) === true
                ) {
                    // for plain-text editing we need a fresh mail if allowHtmlMessages is turned on
                    var options = _.extend({ view: 'text', edit: '1' }, mailAPI.reduce(data));
                    return mailAPI.get(options, false);
                }
                else {
                    return $.Deferred().resolve(data);
                }
            }

            win.busy().show(function () {
                // get fresh plain textt mail
                getMail(data).then(
                    function success(data) {
                        data.sendtype = mailAPI.SENDTYPE.EDIT_DRAFT;
                        app.setMail({ data: data, mode: 'compose', initial: false, format: data.format })
                        .done(function () {
                            app.setFrom(data || {});
                            win.idle();
                            app.getEditor().focus();
                            def.resolve();
                        });
                    },
                    function fail() {
                        notifications.yell('error', gt('An error occurred. Please try again.'));
                        app.dirty(false).quit();
                        def.reject();
                    }
                );
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
                headers,
                attachments,
                mail,
                files = [],
                fileList = view.baton.fileList,
                parse = function (list) {
                    return _(mailUtil.parseRecipients([].concat(list).join(', ')))
                        .map(function (recipient) {
                            var typesuffix = mailUtil.getChannel(recipient[1]) === 'email' ? '' : mailUtil.getChannelSuffixes().msisdn;
                            return ['"' + recipient[0] + '"', recipient[1], typesuffix];
                        });
                },
                replyTo = parse(data.replyTo)[0] || [];

            data.from = this.getFrom();

            // get content
            if (editorMode === 'html') {
                attachments = {
                    content: (app.getEditor() ? app.getEditor().getContent() : '')
                };
            } else {
                attachments = {
                    content: (app.getEditor() ? app.getEditor().getContent() : ''),
                    raw: true
                };
            }

            // remove trailing white-space, line-breaks, and empty paragraphs
            attachments.content = attachments.content.replace(
                /(\s|&nbsp;|\0x20|<br\/?>|<p( class="io-ox-signature")>(&nbsp;|\s|<br\/?>)*<\/p>)*$/g, ''
            );

            attachments.content_type = getContentType(editorMode);

            // might fail
            try {
                headers = JSON.parse(data.headers);
            } catch (e) {
                headers = {};
            }

            mail = {
                from: [data.from] || [],
                to: parse(data.to),
                cc: parse(data.cc),
                bcc: parse(data.bcc),
                headers: headers,
                reply_to: mailUtil.formatSender(replyTo),
                subject: String(data.subject),
                priority: parseInt(data.priority, 10) || 3,
                vcard: parseInt(data.vcard, 10) || 0,
                attachments: [attachments],
                nested_msgs: []
            };
            // add disp_notification_to?
            if (data.disp_notification_to) mail.disp_notification_to = true;
            // add msgref?
            if (data.msgref) mail.msgref = data.msgref;
            // sendtype
            mail.sendtype = data.sendtype || mailAPI.SENDTYPE.NORMAL;

            // get files
            //attachments
            mail.attachments = mail.attachments.concat(fileList.get('attachment'));
            //nested message (usually multiple mail forward)
            mail.nested_msgs = mail.nested_msgs.concat(fileList.get('nested'));
            //referenced contacts (vcards)
            mail.contacts_ids = (mail.contacts_ids || []).concat(fileList.get('vcard'));
            //referenced inforstore files
            mail.infostore_ids = (mail.infostore_ids || []).concat(fileList.get('infostore'));
            //local files
            files = files.concat(fileList.get('file'));

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
            var convert = emoji.converterFor({to: emoji.sendEncoding()});

            blockReuse(mail.data.sendtype);
            prepareMailForSending(mail);

            if (mail.data.sendtype === mailAPI.SENDTYPE.EDIT_DRAFT) {
                mail.data.sendtype = mailAPI.SENDTYPE.DRAFT;
            }

            //convert to target emoji send encoding
            if (convert && emoji.sendEncoding() !== 'unified') {
                //convert to send encoding (NOOP, if target encoding is 'unified')
                mail.data.subject = convert(mail.data.subject);
                mail.data.attachments[0].content = convert(mail.data.attachments[0].content, mail.format);
            }

            // fix inline images
            mail.data.attachments[0].content = mail.data.attachments[0].content
                    .replace(new RegExp('(<img[^>]+src=")' + ox.abs + ox.apiRoot), '$1/ajax')
                    .replace(new RegExp('(<img[^>]+src=")' + ox.apiRoot, 'g'), '$1/ajax')
                    .replace(/on(mousedown|contextmenu)="return false;"\s?/g, '')
                    .replace(/data-mce-src="[^"]+"\s?/, '');

            function cont() {
                // start being busy
                win.busy();
                // close window now (!= quit / might be reopened)
                win.preQuit();

                if (attachmentsExceedQouta(mail)) {
                    notifications.yell({
                        type: 'info',
                        message: gt(
                            'One or more attached files exceed the size limit per email. ' +
                            'Therefore, the files are not sent as attachments but kept on the server. ' +
                            'The email you have sent just contains links to download these files.'
                        ),
                        duration: 30000
                    });
                }

                // send!
                mailAPI.send(mail.data, mail.files, view.form.find('.oldschool'))
                .always(function (result) {

                    if (result.error && !result.warnings) {
                        win.idle().show();
                        notifications.yell(result); // TODO: check if backend just says "A severe error occurred"
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
                    var isReply = mail.data.sendtype === mailAPI.SENDTYPE.REPLY,
                        isForward = mail.data.sendtype === mailAPI.SENDTYPE.FORWARD,
                        sep = mailAPI.separator,
                        base, folder, id, msgrefs, ids;

                    if (isReply || isForward) {
                        //single vs. multiple
                        if (mail.data.msgref) {
                            msgrefs = [ mail.data.msgref ];
                        } else {
                            msgrefs = _.chain(mail.data.attachments)
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
                    app.dirty(false);
                    app.quit();
                })
                .always(function (result) {
                    unblockReuse(mail.data.sendtype);
                    def.resolve(result);
                });
            }

            // ask for empty to,cc,bcc and/or empty subject
            var noRecipient = _.isEmpty(mail.data.to) && _.isEmpty(mail.data.cc) && _.isEmpty(mail.data.bcc);
            if ($.trim(mail.data.subject) === '' || noRecipient) {
                if (noRecipient) {
                    notifications.yell('error', gt('Mail has no recipient.'));
                    focus('to');
                    def.reject();
                } else if ($.trim(mail.data.subject) === '') {
                    // show dialog
                    require(['io.ox/core/tk/dialogs'], function (dialogs) {
                        new dialogs.ModalDialog()
                            .text(gt('Mail has empty subject. Send it anyway?'))
                            .addPrimaryButton('send', gt('Yes, send without subject'), 'send', {tabIndex: '1'})
                            .addButton('subject', gt('Add subject'), 'subject', {tabIndex: '1'})
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
                }

            } else {
                cont();
            }

            return def;
        };

        app.saveDraft = function () {

            // get mail
            var mail = this.getMail(),
                def = new $.Deferred(),
                old_vcard_flag;

            prepareMailForSending(mail);

            if (mail.data.sendtype !== mailAPI.SENDTYPE.EDIT_DRAFT) {
                mail.data.sendtype = mailAPI.SENDTYPE.DRAFT;
            }

            if (_(mail.data.flags).isUndefined()) {
                mail.data.flags = mailAPI.FLAGS.DRAFT;
            } else if (mail.data.flags & 4 === 0) {
                mail.data.flags += mailAPI.FLAGS.DRAFT;
            }

            // never append vcard when saving as draft
            // backend will append vcard for every send operation (which save as draft is)
            old_vcard_flag = mail.data.vcard;
            delete mail.data.vcard;

            mailAPI.send(mail.data, mail.files, view.form.find('.oldschool'))
                .always(function (result) {
                    if (result.error) {
                        notifications.yell(result);
                        def.reject(result);
                    } else {
                        app.setMsgRef(result.data);
                        app.dirty(false);
                        notifications.yell('success', gt('Mail saved as draft'));
                        def.resolve(result);
                    }
                });

            _.defer(initAutoSaveAsDraft, this);

            return def.then(function (result) {
                var base = _(result.data.split(mailAPI.separator)),
                    id = base.last(),
                    folder = base.without(id).join(mailAPI.separator);
                return mailAPI.get({ folder_id: folder, id: id, edit: '1' });
            })
            .then(function (draftMail) {
                //using draftMail.attachments[0].content_type instead of draftMail.content_type because if there are attachments this becomes multipart/mixed and you cannot get the right type
                var format = draftMail.attachments[0].content_type === 'text/plain' ? 'text' : 'html',
                    def = $.Deferred();

                view.form.find('.section-item.file').remove();
                $(_.initial(view.form.find(':input[name][type=file]'))).remove();
                view.baton.fileList.clear();
                draftMail.sendtype = mailAPI.SENDTYPE.EDIT_DRAFT;
                draftMail.vcard = old_vcard_flag;
                app.setMail({ data: draftMail, mode: mail.mode, initial: false, replaceBody: 'no', format: format})
                    .then(function () {
                        def.resolve(draftMail);
                    });
                return def;
            });
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
                // mark as not dirty
                app.dirty(false);
                // clean up editors
                for (var id in editorHash) {
                    editorHash[id].destroy();
                }
                // clear timer for autosave
                stopAutoSave(app);
                // clear all private vars
                app = win = editor = currentSignature = editorHash = null;
            };

            if (app.dirty()) {
                require(['io.ox/core/tk/dialogs'], function (dialogs) {
                    new dialogs.ModalDialog()
                        .text(gt('Do you really want to discard this mail?'))
                        .addPrimaryButton('delete', gt('Discard'), 'delete', {tabIndex: '1'})
                        .addAlternativeButton('savedraft', gt('Save as draft'), 'savedraft', {tabIndex: '1'})
                        .addButton('cancel', gt('Cancel'), 'cancel', {tabIndex: '1'})
                        .show()
                        .done(function (action) {
                            if (action === 'delete') {
                                clean(); // clean before resolve, otherwise tinymce gets half-destroyed (ugly timing)
                                def.resolve();
                            } else if (action === 'savedraft') {
                                app.saveDraft().done(function () {
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

        getApp: createInstance,

        reuse: function (type, data) {
            //disable reuse if at least one app is sending (depends on type)
            var unblocked = function (sendtype) {
                    return blocked[sendtype] === undefined || blocked[sendtype] <= 0;
                };
            if (type === 'reply' && unblocked(mailAPI.SENDTYPE.REPLY)) {
                return ox.ui.App.reuse('io.ox/mail:reply.' + _.cid(data));
            }
            if (type === 'replyall' && unblocked(mailAPI.SENDTYPE.REPLY)) {
                return ox.ui.App.reuse('io.ox/mail:replyall.' + _.cid(data));
            }
            if (type === 'forward' && unblocked(mailAPI.SENDTYPE.FORWARD)) {
                return ox.ui.App.reuse('io.ox/mail:forward.' + _.cid(data));
            }
            if (type === 'edit' && unblocked(mailAPI.SENDTYPE.DRAFT)) {
                return ox.ui.App.reuse('io.ox/mail:edit.' + _.cid(data));
            }
        }
    };

});
