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

define("io.ox/mail/write/view-main",
    ["io.ox/core/extensions",
     "io.ox/core/extPatterns/links",
     "io.ox/mail/actions",
     'io.ox/mail/api',
     'io.ox/core/tk/view',
     'io.ox/core/tk/model',
     'io.ox/contacts/api',
     'io.ox/contacts/util',
     'io.ox/mail/util',
     'io.ox/preview/main',
     'io.ox/core/api/user',
     'io.ox/core/capabilities',
     'io.ox/core/tk/dialogs',
     'io.ox/core/tk/autocomplete',
     'io.ox/core/api/autocomplete',
     'io.ox/core/api/account',
     'io.ox/core/api/snippets',
     'io.ox/core/strings',
     'io.ox/core/util',
     'io.ox/core/notifications',
     'io.ox/mail/sender',
     'io.ox/core/tk/attachments',
     'settings!io.ox/mail',
     'gettext!io.ox/mail'
    ], function (ext, links, actions, mailAPI, ViewClass, Model, contactsAPI, contactsUtil, mailUtil, pre, userAPI, capabilities, dialogs, autocomplete, AutocompleteAPI, accountAPI, snippetAPI, strings, util, notifications, sender, attachments, settings, gt) {

    'use strict';

    // extension points

    var POINT = 'io.ox/mail/write';

    ext.point(POINT + '/toolbar').extend(new links.Button({
        id: 'send',
        index: 100,
        label: gt('Send'),
        cssClasses: 'btn btn-primary',
        ref: POINT + '/actions/send',
        tabIndex: '6'
    }));

    ext.point(POINT + '/toolbar').extend(new links.Button({
        id: 'draft',
        index: 200,
        label: gt('Save'), // is "Save as draft" but let's keep it short for small devices
        cssClasses: 'btn',
        ref: POINT + '/actions/draft',
        tabIndex: '6'
    }));

    ext.point(POINT + '/toolbar').extend(new links.Button({
        id: 'discard',
        index: 1000,
        label: gt('Discard'),
        cssClasses: 'btn',
        ref: POINT + '/actions/discard',
        tabIndex: '6'
    }));

    /*
     * extension point for mobile toolbar on the bottom of the page
     */
    ext.point(POINT +  '/bottomToolbar').extend({
        id: 'toolbar',
        index: 100,
        draw: function (ref) {
            var node = $(this.app.attributes.window.nodes.body),
                toolbar = $('<div class="app-bottom-toolbar">');

            // disable the button
            ext.point(POINT + '/toolbar').disable('draft');

            // reorder button
            ext.point(POINT + "/toolbar").replace({id: 'discard', index: 50});

            //invoke other buttons with new container
            ext.point(POINT + '/toolbar').invoke(
                'draw', toolbar, ext.Baton({ app: this.app })
            );

            node.append(toolbar);
            // pass reference around for later use
            ref.buttons = toolbar;
        }

    });

    var contactPictureOptions = { width: 42, height: 42, scaleType: 'contain' };

    var autocompleteAPI = new AutocompleteAPI({ id: 'mailwrite', contacts: true, msisdn: true });

    var View = ViewClass.extend({

        initialize: function (app, model) {
            var self = this;
            this.sections = {};
            this.baton = ext.Baton({
                app: app,
                //files preview
                view: this
            });
        },

        focusSection: function (id) {
            this.sections[id].find('input[type!=hidden], select').eq(0).focus();
        },

        createSection: function (id, label, show, collapsable) {

            if (label) {
                this.sections[id + 'Label'] = $('<div>')
                    .attr('data-section-label', id)
                    .addClass('io-ox-label')
                    .text(label)
                    .prepend(
                        collapsable ?
                            $('<a>', { href: '#', tabindex: '7' })
                            .addClass('collapse').text(gt('Hide'))
                            .on('click', $.preventDefault) :
                            $()
                    );
            } else {
                this.sections[id + 'Label'] = $();
            }

            if (collapsable) {
                this.sections[id + 'Label'].on('click', { id: id }, $.proxy(fnToggleSection, this));
            } else {
                this.sections[id + 'Label'].css('cursor', 'default');
            }

            this.sections[id] = $('<div>').addClass('section').attr('data-section', id);

            if (show === false) {
                this.sections[id + 'Label'].hide();
                this.sections[id].hide();
            }

            return { label: $(this.sections[id + 'Label']), section: this.sections[id] };
        },

        addSection: function (id, label, show, collapsable) {
            this.createSection(id, label, show, collapsable);
            this.scrollpane.append(this.sections[id + 'Label'], this.sections[id]);
            return this.sections[id];
        },

        showSection: function (id, focus) {
            var sec = this.sections[id];
            if (sec) {
                sec.show().trigger('show');
                if (focus !== false) {
                    this.focusSection(id);
                }
            }
        },

        hideSection: function (id, node) {
            this.sections[id + 'Label'].add(this.sections[id]).hide();
            $(node).trigger('hide');
        },

        createLink: function (id, label) {
            return (this.sections[id + 'Link'] = $('<div>'))
                .addClass('section-link')
                .append(
                    $('<a>', { href: '#', tabindex: '7' })
                    .attr('data-section-link', id)
                    .text(label)
                    .on('click', { id: id }, $.proxy(fnToggleSection, this))
                );
        },

        addLink: function (id, label) {
            return this.createLink(id, label).appendTo(this.scrollpane);
        },

        createUpload: (function () {

            var change = function (e) {
                handleFileSelect(e, this);
            };

            return function () {

                var inputOptions = Modernizr.filereader && 'FormData' in window ?
                    { type: 'file', name: 'file_' + (this.fileCount++), multiple: 'multiple', tabindex: '7' } :
                    { type: 'file', name: 'file_' + (this.fileCount++), tabindex: '7' };

                return $('<div class="section-item upload">').append(
                    $('<input>', inputOptions).on('change', $.proxy(change, this))
                );
            };

        }()),

        createField: function (id) {

            var self = this, node = self.app.getWindowNode();

            return $('<div class="fieldset">').append(
                $('<label>', { 'for' : 'writer_field_' + id })
                .addClass('wrapping-label')
                .append(
                    $('<input>', {
                        type: 'text',
                        tabindex: (id === 'to' ? '2' : '7'),
                        id: 'writer_field_' + id
                    })
                    .attr('data-type', id) // not name=id!
                    .addClass('discreet')
                    .autocomplete({
                        api: autocompleteAPI,
                        reduce: function (data) {
                            var hash = {},
                                list;
                            // remove duplicates
                            node.find('input[name=' + id + ']').map(function () {
                                var rcpt = mailUtil.parseRecipient($(this).val())[1];
                                hash[rcpt] = true;
                            });
                            list = _(data).filter(function (o) {
                                return o.email !== '' ? hash[o.email] === undefined : hash[mailUtil.cleanupPhone(o.phone)] === undefined;
                            });

                            //return number of query hits and the filtered list
                            return { list: list, hits: data.length };
                        },
                        stringify: function (data) {
                            var name = contactsUtil.getMailFullName(data),
                                address = data.email || data.phone || '';
                            return name ? '"' + name + '" <' + address + '>' : address;
                        },
                        draw: function (data, query) {
                            drawAutoCompleteItem.call(null, this, data, query);
                        },
                        click: function (e) {
                            copyRecipients.call(self, id, $(this), e);
                        },
                        blur: function (e) {
                            copyRecipients.call(self, id, $(this));
                        }
                    })
                    .on('keyup', function (e) {
                        if (e.which === 13) {
                            copyRecipients.call(self, id, $(this));
                        } else {
                            // look for special prefixes
                            var val = $(this).val();
                            if ((/^to:?\s/i).test(val)) {
                                $(this).val('');
                                self.showSection('to');
                            } else if ((/^cc:?\s/i).test(val)) {
                                $(this).val('');
                                self.showSection('cc');
                            } else if ((/^bcc:?\s/i).test(val)) {
                                $(this).val('');
                                self.showSection('bcc');
                            }
                        }
                    })
                )
            );
        },

        createSenderField: function () {

            var node, select;

            var node = $('<div class="fromselect-wrapper">').append(
               $('<label for="from" class="wrapping-label">').text(gt('From')),
               select = $('<select class="sender-dropdown" name="from" tabindex="7">').css('width', '100%')
            );

            sender.drawOptions(select);

            return node;
        },

        createReplyToField: function () {
            //TODO: once this is mapped to jslob, use settings here (key should be showReplyTo)
            if (settings.get('showReplyTo/configurable', true) !== true) {
                return;
            }
            return $('<div>').addClass('fieldset').append(
                $('<label>', {'for': 'writer_field_replyTo'})
                .addClass('wrapping-label').text(gt('Reply to')),
                $('<input>',
                    {'type' : 'text',
                     'id' : 'writer_field_replyTo',
                     'name' : 'replyTo'
                    })
                .addClass('discreet')
                .autocomplete({
                    source: function (val) {
                        return autocompleteAPI.search(val).then(function (autocomplete_result) {
                            return accountAPI.getAllSenderAddresses().then(function (result) {
                                result = result.filter(function (elem) {
                                    return elem[0].indexOf(val) >= 0 || elem[1].indexOf(val) >= 0;
                                });
                                return { list: result.concat(autocomplete_result), hits: result.length };
                            });
                        });
                    },
                    draw: function (data, query) {
                        drawAutoCompleteItem(this, data, query);
                    },
                    reduce: function (data) {
                        data.list = _(data.list).map(function (elem) {
                            return elem.type === 'contact' ? elem : {data: {}, display_name: elem[0], email: elem[1]};
                        });
                        return data;
                    },
                    stringify: function (data) {
                        return mailUtil.formatSender(data.display_name, data.email);
                    }
                })
            );
        },

        createRecipientList: function (id) {
            return (this.sections[id + 'List'] = $('<div>'))
                .addClass('recipient-list').hide();
        },


       /**
        * appends recipient nodes
        *
        * @param {string} id defines section (f.e. 'cc')
        * @param {array} list contains recipient objects
        * @return {void}
        */
        addRecipients: function (id, list) {

            if (!list || !list.length) return;

            // get current recipients
            var recipients = this.app.getRecipients(id),
                maximum = settings.get('maximumNumberOfRecipients', 0),
                hash = {};

            // too many recipients?
            if (maximum > 0 && (recipients.length + list.length) > maximum) {
                notifications.yell('info',
                    //#. Mail compose. Maximum number of recipients exceeded
                    //#. %1$s = maximum
                    gt('The number of recipients is limited to %1$s recipients per field', maximum)
                );
                return;
            }

            list = getNormalized(list);

            // hash current recipients
            this.app.getWindowNode().find('input[name=' + id + ']').map(function () {
                var rcpt = mailUtil.parseRecipient($(this).val())[1];
                hash[rcpt] = true;
            });

            // ignore doublets and draw remaining
            list = _(list).filter(function (recipient) {
                if (hash[recipient.email] === undefined && hash[mailUtil.cleanupPhone(recipient.phone)] === undefined) {
                    //draw recipient
                    var node = $('<div>'), value;
                    drawContact(id, node, recipient);
                    // add to proper section (to, CC, ...)
                    this.sections[id + 'List'].append(node);
                    // if list itself contains doublets
                    value = recipient.email !== '' ? recipient.email : mailUtil.cleanupPhone(recipient.phone);
                    return hash[value] = true;
                }
            }, this);

            this.sections[id + 'List'].show().trigger('show');
        },

        /**
         * inserts an UNICODE to the textarea which will be replaced by a nice native
         * icon on mobile devices.
         * @param  {[type]} e [description]
         * @return {[type]}   [description]
         */
        onInsertEmoji: function (e) {

            e.preventDefault();

            var recently = {},
                icon = $(e.target).data('icon'),
                content = this.editor.val(),
                caret = parseInt($(this.editor).attr('caretPosition'), 10),
                subjectCaret = parseInt($(this.subject).attr('caretPosition'), 10);

            this.emoji.recent(icon.unicode);

            // string insert
            function insert(index, text, emoji) {
                if (index > 0) {
                    return text.substring(0, index) + emoji + text.substring(index, text.length);
                } else {
                    return emoji + text;
                }
            }

            this.editor
                .val(insert(caret, content, icon.unicode))
                .attr('caretPosition', caret + 2);

            /* disabled emoji input on subject at the moment */

            // insert unicode and increse caret position manually
            /*if (this.editor.attr('emojifocus') === 'true') {
                this.editor
                    .val(insert(caret, content, icon.unicode))
                    .attr('caretPosition', caret + 2);
            } else {
                this.subject
                    .val(insert(subjectCaret, this.subject.val(), icon.unicode))
                    .attr('caretPosition', subjectCaret + 2);
            }*/

        },
        /**
         * needs to be fixed, does not work properly
         * @return {[type]} [description]
         */
        scrollEmoji: function () {
            var self = this,
                top = self.textarea.attr('offsettop') || 0,
                caretPos = self.textarea.textareaHelper('caretPos').top;

            // wait for keyboard to hide
            setTimeout(function () {
                self.app.attributes.window.nodes.main.scrollTop(parseFloat(top + caretPos + 210));
            }, 350);
        },
        /**
         * shows a emoji palette for mobile devices to use
         * with plain text editor
         * @return {[type]} [description]
         */
        showEmojiPalette: function () {
            var self = this;
            return function () {
                var tab = _.device('tablet'),
                    innerContainer = self.rightside.find('.editor-inner-container');
                if (self.emojiview === undefined) {
                    ox.load(['io.ox/core/emoji/view']).done(function (EmojiView) {
                        self.emojiview = new EmojiView({ editor: self.textarea, subject: self.subject, onInsertEmoji: self.onInsertEmoji });
                        var emo = $('<div class="mceEmojiPane">');
                        if (tab) {
                            innerContainer.addClass('textarea-shift');
                        }
                        self.emojiview.setElement(emo);
                        // nasty, but position:fixed elements must be in a non-scrollable container to work
                        // properly on iOS
                        $(self.app.attributes.window.nodes.body).append(self.emojiview.$el);
                        self.emojiview.toggle();
                        self.spacer.show();
                        self.scrollEmoji();

                    });
                } else {
                    self.emojiview.toggle();
                    if (self.emojiview.isOpen) {
                        if (tab) {
                            innerContainer.addClass('textarea-shift');
                        }
                        self.spacer.show();
                        self.scrollEmoji();
                    } else {
                        if (tab) {
                            innerContainer.removeClass('textarea-shift');
                        }
                        self.spacer.hide();
                    }
                }

            };
        },

        render: function () {

            var self = this, app = self.app, buttons = {}, emojiMobileSupport = false;

            if (capabilities.has('emoji') && _.device('!desktop')) {
                emojiMobileSupport = true;
            }

            /*
             * LEFTSIDE
             */

            // side panel
            this.leftside = $('<div class="leftside io-ox-mail-write-sidepanel">');
            this.scrollpane = this.leftside.scrollable();

            // title
            this.scrollpane.append(
                $('<h1 class="title">').text('\u00A0')
            );

            // sections

            // TO
            this.addSection('to').append(
                this.createRecipientList('to'),
                this.createField('to')
                    .find('input').attr('placeholder', gt.format('%1$s ...', gt('To'))).placeholder().end()
            );

            // CC

            this.addLink('cc', gt('Copy (CC) to'));
            this.addSection('cc', gt('Copy (CC) to'), false, true)
                .append(this.createRecipientList('cc'))
                .append(this.createField('cc')
                        .find('input').attr('placeholder', gt.format('%1$s ...', gt('in copy'))).placeholder().end()
                    );


            // BCC

            this.addLink('bcc', gt('Blind copy (BCC) to'));
            this.addSection('bcc', gt('Blind copy (BCC) to'), false, true)
                .append(this.createRecipientList('bcc'))
                .append(this.createField('bcc')
                        .find('input').attr('placeholder', gt.format('%1$s ...', gt('in blind copy'))).placeholder().end()
                    );


            // Attachments
            this.fileCount = 0;
            var uploadSection = this.createSection('attachments', gt('Attachments'), false, true),
                dndInfo =  $('<div class="alert alert-info">').text(gt('You can drag and drop files from your computer here to add as attachment.'));

            //TODO: remove after feature is developed
            ox.efl = 'efl' in ox ? ox.efl : true;
            var $inputWrap = attachments.fileUploadWidget({
                    displayLabel: false,
                    displayButton: true,
                    buttontext: gt('Add Attachment'),
                    buttonicon: 'icon-paper-clip'

                }),
                $input = $inputWrap.find('input[type="file"]'),
                    changeHandler = function (e) {
                        //register rightside node
                        e.preventDefault();
                        if (_.browser.IE !== 9) {
                            var list = [];
                            //fileList to array of files
                            _($input[0].files).each(function (file) {
                                list.push(_.extend(file, {group: 'file'}));
                            });
                            self.baton.fileList.add(list);
                            $input.trigger('reset.fileupload');
                        } else {
                            //IE
                            if ($input.val()) {
                                var fileData = {
                                    name: $input.val().match(/[^\/\\]+$/),
                                    size: 0,
                                    hiddenField: $input
                                };
                                self.baton.attachmentList.addFile(fileData);
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

            this.scrollpane.append(
                $('<form class="oldschool">').append(
                    this.createLink('attachments', gt('Attachments')),
                    uploadSection.label,
                    uploadSection.section.append(
                        (_.device('!touch') && (!_.browser.IE || _.browser.IE > 9) ? dndInfo : ''),
                        ox.efl ? $inputWrap : this.createUpload()
                    )
                )
            );

            ext.point(POINT + '/filelist').invoke();
            //referenced via baton.fileList
            ext.point(POINT + '/filelist').extend(new attachments.EditableFileList({
                id: 'attachment_list',
                className: 'div',
                preview: true,
                index: 300,
                $el: uploadSection.section,
                registerTo: [self, this.baton]
            }, this.baton), {
                rowClass: 'collapsed'
            });
            // add preview side-popup
            if (!!ox.efl)
                new dialogs.SidePopup().delegate(this.sections.attachments, '.attachment-preview', previewAttachment);


            // Signatures
            (function () {
                if (_.device('smartphone')) return;

                self.addLink('signatures', gt('Signatures'));

                var signatureNode = self.addSection('signatures', gt('Signatures'), false, true);

                function fnDrawSignatures() {
                    snippetAPI.getAll('signature').done(function (signatures) {
                        self.signatures = signatures;
                        signatureNode.empty();
                        signatureNode.append(
                            _(signatures.concat(dummySignature))
                            .inject(function (memo, o, index) {
                                var preview = (o.content || '')
                                    // remove subsequent white-space
                                    .replace(/\s\s+/g, ' ')
                                    // remove ASCII art
                                    .replace(/([\-=+*°._!?\/\^]{4,})/g, '');
                                preview = preview.length > 150 ? preview.substr(0, 150) + ' ...' : preview;
                                return memo.add(
                                    $('<div class="section-item pointer">')
                                    .addClass(index >= signatures.length ? 'signature-remove' : '')
                                    .append(
                                        $('<a href="#" tabindex="7">')
                                        .on('click dragstart', $.preventDefault)
                                        .text(o.displayname)
                                    )
                                    .append(
                                        preview.length ?
                                            $('<div class="signature-preview">')
                                            .text(_.noI18n(' ' + preview)) :
                                            $()
                                    )
                                    .on('click', { index: index }, function (e) {
                                        e.preventDefault();
                                        app.setSignature(e);
                                    })
                                );
                            }, $(), self)
                        );
                        if (signatures.length === 0) {
                            self.sections.signaturesLink.hide();
                        } else {
                            self.sections.signaturesLink.show();
                        }

                    });
                }

                fnDrawSignatures();
                snippetAPI.on('refresh.all', fnDrawSignatures);
                signatureNode.on('dispose', function () {
                    snippetAPI.off('refresh.all', fnDrawSignatures);
                });

            }());

            // FROM
            this.addLink('sender', gt('Sender'));
            this.addSection('sender', gt('Sender'), false, true)
                .append(this.createSenderField())
                .append(this.createReplyToField());

            accountAPI.getAllSenderAddresses().done(function (addresses) {
                if (addresses.length <= 1) {
                    self.hideSection('sender');
                    self.sections.senderLink.hide();
                } else {
                    // show section
                    self.showSection('sender');
                }
            });

            // Options
            this.addLink('options', gt('More'));
            this.addSection('options', gt('Options'), false, true).append(
                // Priority
                $('<div>').addClass('section-item')
                .css({ paddingTop: '0.5em', paddingBottom: '0.5em' })
                .append(
                    $('<span>').addClass('group-label').text(gt('Priority'))
                )
                .append(createRadio('priority', '1', gt('High')))
                .append(createRadio('priority', '3', gt('Normal'), true))
                .append(createRadio('priority', '5', gt('Low')))
                .on('change', 'input', function () {
                    var radio = $(this);
                    if (radio.prop('checked')) self.app.setPriority(radio.val());
                }),
                // Attach vCard
                $('<div>').addClass('section-item')
                .css({ paddingTop: '1em', paddingBottom: '1em' })
                .append(createCheckbox('vcard', gt('Attach my vCard')))
            );

            if (!Modernizr.touch) {
                var format = settings.get('messageFormat', 'html');
                this.addSection('format', gt('Text format'), true, false).append(

                    $('<div class="section-item">').append(
                        createRadio('format', 'text', gt('Text'), format === 'text'),
                        createRadio('format', 'html', gt('HTML'), format === 'html' || format === 'alternative')
                    )
                    .css({
                        paddingTop: '1em',
                        paddingBottom: '1em'
                    })
                    .on('change', 'input', function () {
                        var radio = $(this), format = radio.val();
                        app.setFormat(format).done(function () {
                            app.getEditor().focus();
                        });
                    })
                );
            }

            /*
             * EMOJI FOR MOBILE
             */

            this.emojiToggle = function () {
                if (emojiMobileSupport) {
                    this.rightside.addClass('mobile-emoji-shift');
                    return $('<div>').addClass('emoji-icon')
                        .on('click', this.showEmojiPalette());
                } else return $();
            };

            /*
             * RIGHTSIDE
             */

            this.rightside = $('<div class="rightside">');

            // custom toolbar on mobile
            if (_.device('smartphone')) {
                ext.point(POINT + '/bottomToolbar').invoke('draw', this, buttons);
            } else {
                ext.point(POINT + '/toolbar').invoke(
                    'draw', buttons.buttons = $('<div class="inline-buttons top">'), ext.Baton({ app: app })
                );
            }

            /*
             * Editor
             */
            function createEditor() {
                // autogrow function which expands a textarea while typing
                // to prevent overflowing on mobile devices
                var autogrow = function (e) {
                    var input = $(this),
                        scrollHeight = input[0].scrollHeight,
                        clientHeight = input[0].clientHeight,
                        paddingTop, paddingBottom, paddingHeight;


                    if (clientHeight < scrollHeight) {
                        paddingTop = parseFloat(input.css("padding-top"));
                        paddingBottom = parseFloat(input.css("padding-bottom"));
                        paddingHeight = paddingTop + paddingBottom;

                        input.height(scrollHeight - paddingHeight + 15);
                    }
                };

                self.textarea = $('<textarea>')
                    .attr({ name: 'content', tabindex: '4', disabled: 'disabled', caretPosition: '0' })
                    .addClass('text-editor')
                    .addClass(settings.get('useFixedWidthFont') ? 'monospace' : '')
                    .on('keyup click', function (e) {
                        /* disabled emoji input for subject */
                        //$(this).attr('emojiFocus', 'true');
                        //self.subject.attr('emojiFocus', 'false');
                        if (this.selectionStart === undefined) return;
                        $(this).attr({
                            'caretPosition': this.selectionStart,
                            'offsetTop': $(this).offset().top
                        });
                    });


                if (_.device('!smartphone')) {
                    // standard textarea for desktops
                    return $('<div class="abs editor-outer-container">').append(
                        // white background
                        $('<div>').addClass('abs editor-background'),
                        // editor's print margin
                        $('<div>').addClass('abs editor-print-margin'),
                        // inner div
                        $('<div>').addClass('abs editor-inner-container')
                        .css('overflow', 'hidden')
                        .append(self.textarea)
                    );
                } else {
                    // on mobile devices we do not need all the containers and
                    // stuff, just a plain textarea which supports auto-growing on input
                    self.textarea
                        .on('keyup change input paste', autogrow)
                        .on('focus', function () {
                            $(this).attr('emojiFocus', 'true');
                            //self.subject.attr('emojiFocus', 'false');
                            // do we have emoji support
                            if (emojiMobileSupport && self.emojiview && self.emojiview.isOpen) {

                                if (self.emojiview.isOpen) {
                                    self.emojiview.toggle();
                                    self.spacer.hide();
                                } else {
                                    self.emojiview.toggle();
                                    self.spacer.show();
                                    self.scrollEmoji();
                                }
                            }
                        });
                    // textarea only, no container overkill
                    return self.textarea;
                }
            }


            this.rightside.append(
                // buttons
                _.device('!smartphone') ? buttons.buttons: $(),
                // subject field
                $('<div>').css('position', 'relative').append(
                    $('<div>').addClass('subject-wrapper')
                    .append(
                        // subject
                        $.labelize(
                            this.subject = $('<input>')
                            .attr({
                                type: 'text',
                                name: 'subject',
                                tabindex: '3',
                                placeholder: gt('Subject')
                            })
                            /* no padding-right for input fields in IE9
                               -> Bug 27069 - Subject does not scroll properly for long strings in IE9 */
                            .css('width', function () {
                                return _.device('desktop') && _.browser.IE < 10 ? '85%' : null;
                            })
                            .css('padding-right', function () {
                                return _.device('desktop') && _.browser.IE < 10 ? '5px' : null;
                            })
                            .addClass('subject')
                            .val('')
                            .placeholder()
                            .on('keydown', function (e) {
                                if (e.which === 13 || (e.which === 9 && !e.shiftKey)) {
                                    // auto jump to editor on enter/tab
                                    e.preventDefault();
                                    app.getEditor().focus();
                                }
                            })
                            .on('keyup', function () {
                                var title = _.noI18n($.trim($(this).val()));
                                if (title.length > 0) {
                                    app.setTitle(title);
                                } else {
                                    app.setTitle(app.getDefaultWindowTitle());
                                }
                            }),
                            /* disabled emoji input for subject field */
                            /*
                            .on('keyup click', function () {
                                // subject has focus
                                $(this).attr('emojiFocus', 'true');
                                $(self.textarea).attr('emojiFocus', 'false');
                                if (this.selectionStart === undefined) return;
                                $(this).attr({
                                    'caretPosition': this.selectionStart,
                                    'offsetTop': $(this).offset().top
                                });
                            })
                            .on('focus', function () {
                                // do we have emoji support
                                if (emojiMobileSupport && self.emojiview && self.emojiview.isOpen) {

                                    if (self.emojiview.isOpen) {
                                        self.emojiview.toggle();
                                        self.spacer.hide();
                                    } else {
                                        self.emojiview.toggle();
                                        self.spacer.show();
                                    }
                                }
                            }),*/
                            'mail_subject'
                        )
                    ),
                    // append emojitoggle
                    this.emojiToggle(),
                    // priority
                    this.priorityOverlay = $('<div class="priority-overlay">')
                        .attr('title', 'Priority')
                        .append(
                            $('<i class="icon-exclamation">'),
                            $('<i class="icon-exclamation">'),
                            $('<i class="icon-exclamation">')
                        )
                        .on('click', $.proxy(togglePriority, this))
                ),
                // editor container
                createEditor(),
                this.spacer = $('<div class="spacer">').css('height', '205px')
            );
        }
    });

    var dummySignature = { displayname: gt('No signature') };
    var handleFileSelect, addUpload, supportsPreview, previewAttachment, createPreview;

    supportsPreview = function (file) {
        // is not local?
        if (file.message) { // mail
            return new pre.Preview({ mimetype: 'message/rfc822' }).supportsPreview();
        } else if (file.display_name) { // v-card
            return true;
        } else if (file.id && file.folder_id) { // infostore
            return true;
        } else if (file.atmsgref) { // forward mail attachment
            return true;
        } else {
            return window.FileReader && (/^image\/(png|gif|jpe?g|bmp)$/i).test(file.type);
        }
    };

    previewAttachment = function (popup, e, target) {

        e.preventDefault();

        var file = target.data('file'), message = file.message, app = target.data('app'),
            editor = target.data('rightside').find('iframe').contents().find('body'),//get the editor in the iframe
            preview, reader;

        editor.one('click', this.close);//close if editor is selected(causes overlapping)
        // nested message?
        if (message) {
            preview = new pre.Preview({
                    data: { nested_message: message },
                    mimetype: 'message/rfc822'
                }, {
                    width: popup.parent().width(),
                    height: 'auto'
                });
            if (preview.supportsPreview()) {
                preview.appendTo(popup);
                popup.append($('<div>').text(_.noI18n('\u00A0')));
            }
        } else if (file.display_name || file.email1) {
            // if is vCard
            require(['io.ox/contacts/view-detail'], function (view) {
                popup.append(view.draw(file));
            });
        } else if (file.id && file.folder_id) { // infostore
            // if is infostore
            require(['io.ox/files/api'], function (filesAPI) {
                var prev = new pre.Preview({
                    name: file.filename,
                    filename: file.filename,
                    mimetype: file.file_mimetype,
                    size: file.file_size,
                    dataURL: filesAPI.getUrl(file, 'bare'),
                    version: file.version,
                    id: file.id,
                    folder_id: file.folder_id
                }, {
                    width: popup.parent().width(),
                    height: 'auto'
                });
                if (prev.supportsPreview()) {
                    popup.append(
                        $('<h4>').addClass('mail-attachment-preview').text(file.filename)
                    );
                    prev.appendTo(popup);
                    popup.append($('<div>').text('\u00A0'));
                }
            });
        } else if (file.atmsgref) { // forward mail attachment
            var pos = file.atmsgref.lastIndexOf('/');
            file.parent = {
                folder_id: file.atmsgref.substr(0, pos),
                id: file.atmsgref.substr(pos + 1)
            };
            var prev = new pre.Preview({
                data: file,
                filename: file.filename,
                source: 'mail',
                folder_id: file.parent.folder_id,
                id: file.parent.id,
                attached: file.id,
                parent: file.parent,
                mimetype: file.content_type,
                dataURL: mailAPI.getUrl(file, 'view')
            }, {
                width: popup.parent().width(),
                height: 'auto'
            });
            if (prev.supportsPreview()) {
                popup.append(
                    $('<h4>').addClass('mail-attachment-preview').text(file.filename)
                );
                prev.appendTo(popup);
                popup.append($('<div>').text('\u00A0'));
            }

        } else {
            // inject image as data-url
            reader = new FileReader();
            reader.onload = function (e) {
                popup.css({ width: '100%', height: '100%' })
                .append(
                    $('<div>')
                    .css({
                        width: '100%',
                        height: '100%',
                        backgroundImage: 'url(' + e.target.result + ')',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center center',
                        backgroundSize: 'contain'
                    })
                );
                reader = reader.onload = null;
            };
            reader.readAsDataURL(file);
        }
    };

    createPreview = function (file, app, rightside) {//rightside is needed to let the popup check for events in the editor iframe
        return $('<a href="#" class="attachment-preview">').data({file: file, app: app, rightside: rightside }).text(gt('Preview'));
    };

    function round(num, digits) {
        // TODO: add localization (. vs ,)
        digits = digits || 0;
        var pow = Math.pow(10, digits);
        return Math.round(num * pow) / pow;
    }

    handleFileSelect = function (e, view) {
        // look for linked attachments or dropped files
        var target = $(e.currentTarget),
            item = target.prop('attachment') || target.prop('file') || target.prop('nested'),
            list = item ? [item] : e.target.files;

        // IE fallback
        if (!list) {
            var name = target.val();
            list = [{
                filename: name.split(/(\\|\/)/g).pop(),
                size: 0
            }];
        }

        if (list.length) {
            var $section = view.sections.attachments,
                $upload = $section.children().last();

            // loop over all attachments
            _(list).each(function (file) {

                /*
                 * Files, VCard, and Messages are very close here
                 * there's no real separation
                 */

                var icon, name, size, info,
                    isMessage = 'message' in file,
                    isFile = 'size' in file || 'file_size' in file;

                // message?
                if (isMessage) {
                    info = $('<span>').addClass('filesize').text('');
                    icon = $('<i>').addClass('icon-paper-clip');
                    name = file.message.subject || '\u00A0';
                } else if (isFile) {
                    // filesize
                    size = file.size || file.file_size;
                    size = size !== undefined ? gt.format('%1$s\u00A0 ', strings.fileSize(size)) : '';
                    info = $('<span>').addClass('filesize').text(size);
                    icon = $('<i>').addClass('icon-paper-clip');
                    name = file.filename || file.name || '';
                } else {
                    // vcard
                    info = $('<span>').addClass('filesize').text(gt.noI18n('vCard\u00A0'));
                    icon = $('<i>').addClass('icon-list-alt');
                    name = contactsUtil.getFullName(file);
                }

                // draw
                $section.append(
                    $('<div>').addClass('section-item file').append(
                        // icon
                        icon,
                        // filename
                        $('<div class="row-1">').text(_.noI18n(name)),
                        // filesize / preview
                        $('<div class="row-2">').append(
                            info,
                            // preview?
                            supportsPreview(file) ? createPreview(file, view.app, view.rightside) : $(),
                            // nbsp
                            $.txt('\u00A0')
                        ),
                        // remove
                        $('<a href="#" class="remove" tabindex="6">')
                        .attr('title', gt('Remove attachment'))
                        .append(
                            $('<i class="icon-trash">')
                        )
                        .on('click', function (e) {
                            e.preventDefault();
                            //remove upload container and all file 'label divs'
                            $upload.nextUntil('.upload', '.file').remove();
                            $upload.replaceWith('');
                        })
                    )
                );
            });
            // hide current upload field
            $(e.target).closest('.section-item.upload').hide();
        }

        view.sections.attachments.append(
            view.createUpload()
        );
    };

    function fnToggleSection(e) {
        var id = e.data.id,
            target = e.target;
        e.preventDefault();
        if (this.sections[id].is(':visible')) {
            this.hideSection(id, target);
        } else {
            this.showSection(id, target);
        }
    }

    function fnHideSection(e) {
        var id = e.data.id;
        e.preventDefault();
        this.hideSection(id, e.target);
    }

    function fnShowSection(e) {
        var id = e.data.id;
        e.preventDefault();
        this.showSection(id, e.target);
    }

    function togglePriority() {
        var priority = this.app.getPriority();
        // cycle priorities
        if (priority === 3) {
            this.app.setPriority(1);
        } else if (priority === 1) {
            this.app.setPriority(5);
        } else {
            this.app.setPriority(3);
        }
    }

    function copyRecipients(id, node, e) {

        var valBase, list;

        //normalize data
        if (e && e.data.distlistarray !== null) {
            //distribution list
            list = _(e.data.distlistarray).map(function (member) {
                return {
                    full_name: member.display_name,
                    display_name: member.display_name,
                    email: member.mail
                };
            });
        } else if (e && e.data.id) {
            //selected contact list
            list = [ e.data ];
        } else {
            valBase = node.val();
            list = mailUtil.parseRecipients(valBase);
        }

        if (list.length) {
            // add
            this.addRecipients(id, list);
            node.val('').focus();
        } else if ($.trim(node.val()) !== '') {
            // not accepted but has content
            node.attr('disabled', 'disabled')
                .css({ border: '1px solid #a00', backgroundColor: '#fee' })
                .delay(600)
                .queue(function () {
                    node.css({ border: '', backgroundColor: '' })
                        .removeAttr('disabled')
                        .focus()
                        .dequeue();
                });
        }
    }

   /**
    * returns an array of normalized contact objects (display_name, mail, image1_url, folder_id, id)
    * @author <a href="mailto:frank.paczynski@open-xchange.com">Frank Paczynski</a>
    *
    * @param {array|object} list contacts
    * @return {array} array with contact object
    */
    function getNormalized(list) {

        return list.map(function (elem) {

            // parsed object?
            if (_.isArray(elem)) {
                var channel = mailUtil.getChannel ? mailUtil.getChannel(elem[1]) : 'email',
                    custom = {
                        full_name: elem[0],
                        display_name: elem[0]
                    };
                // email or phone property?
                custom[channel] = elem[1];
                elem = custom;
            }

            if (!elem.full_name && elem.contact) {
                elem.full_name = contactsUtil.getMailFullName(elem.contact);
            }

            var obj = {
                full_name: elem.full_name,
                first_name: elem.first_name || '',
                last_name: elem.last_name || '',
                display_name: util.unescapeDisplayName(elem.display_name),
                email: elem.email || elem.mail || '', // distribution lists just have "mail"
                phone: elem.phone || '',
                field: elem.field || '',
                image1_url: elem.image1_url || '',
                folder_id: elem.folder_id || '',
                id: elem.id || ''
            };
            obj.url = contactsUtil.getImage(obj, contactPictureOptions);
            return obj;
        });
    }

    /**
     * mapping for getFieldLabel()
     * @type {object}
     */
    var mapping = {
        telephone_business1: gt('Phone (business)'),
        telephone_business2: gt('Phone (business)'),
        telephone_home1: gt('Phone (private)'),
        telephone_home2: gt('Phone (private)'),
        cellular_telephone1: gt('Mobile'),
        cellular_telephone2: gt('Mobile')
    };

    /**
     * fieldname to fieldlabel
     * @param  {string} field
     * @return {string} label
     */
    function getFieldLabel(field) {
        return mapping[field] || '';
    }

    function drawAutoCompleteItem(node, data, query) {
        var url = contactsUtil.getImage(data.data, contactPictureOptions), labelnode = '';
        //source field label
        if (getFieldLabel(data.field) !== '')
            labelnode = ' <span style="color: #888;">(' + getFieldLabel(data.field) + ')</span>';

        node.addClass('io-ox-mail-write-contact').append(
            $('<div class="contact-image">').css('backgroundImage', 'url(' + url + ')'),
            $('<div class="ellipsis">').text(_.noI18n(data.display_name + '\u00A0')),
            $('<div class="ellipsis email">').html(_.noI18n(data.email) + _.noI18n(data.phone || '') + labelnode)
        );
    }

    // drawAutoCompleteItem and drawContact
    // are slightly different. it's easier just having two functions.

    function drawContact(id, node, data) {

        node.addClass('io-ox-mail-write-contact section-item').append(
            // picture
            contactsAPI.getPicture(data, contactPictureOptions).addClass('contact-image'),
            // hidden field
            $('<input>', { type: 'hidden', name: id, value: serialize(data) }),
            // display name
            contactsAPI.getDisplayName(data, { halo: false, stringify: 'getMailFullName', tagName: 'div' })
                .addClass('recipient-name'),
            // email address
            $('<div>').append(
                data.email ?
                    $('<a href="#" class="halo-link">')
                    .data({ email1: data.email })
                    .text(_.noI18n(String(data.email).toLowerCase())) :
                    $('<span>').text(_.noI18n(data.phone || ''))
            ),
            // remove
            $('<a href="#" class="remove">')
                .attr('title', gt('Remove from recipient list'))
                .append(
                    $('<i class="icon-trash">')
                )
                .on('click', { id: id }, function (e) {
                    e.preventDefault();
                    var list = $(this).parents().find('.recipient-list');
                    $(this).parent().remove();
                    // hide section if empty
                    if (list.children().length === 0) {
                        list.hide();
                    }
                })
        );
    }

    // helper

    function serialize(obj) {
        // display_name might be null!
        return obj.display_name ?
             '"' + obj.display_name.replace(/"/g, '\"') + '" <' + obj.email + (obj.phone || '') + '>' : '<' + obj.email + (obj.phone || '') + '>';
    }

    // function clickRadio(e) {
    //     var node = $(this).parent();
    //     node.prop('selected', !node.prop('selected')).trigger('change'); // selected, not checked!
    // }

    function createRadio(name, value, text, isChecked) {
        var label, radio;
        radio = $('<input>', { type: 'radio', name: name, value: value, tabindex: '7' });
        label = $('<label class="radio">').append(
            radio, $.txt(_.noI18n('\u00A0\u00A0')), text, $.txt(_.noI18n('\u00A0\u00A0\u00A0\u00A0 '))
        );
        if (isChecked) {
            radio.attr('checked', 'checked');
        }
        // if (Modernizr.touch) {
        //     label.on('click', clickRadio);
        // }
        return label;
    }

    // function clickCheckbox(e) {
    //     var node = $(this).parent();
    //     node.prop('selected', !node.prop('selected')).trigger('change'); // selected, not checked!
    // }

    function createCheckbox(name, text, isChecked) {
        var label, box;
        box = $('<input>', { type: 'checkbox', name: name, value: '1', tabindex: '7' });
        label = $('<label class="checkbox">').append(
            box, $.txt(_.noI18n('\u00A0\u00A0')), text, $.txt(_.noI18n('\u00A0\u00A0\u00A0\u00A0 '))
        );
        if (isChecked) {
            box.attr('checked', 'checked');
        }
        // if (Modernizr.touch) {
        //     label.on('click', clickCheckbox);
        // }
        return label;
    }

    return View;
});
