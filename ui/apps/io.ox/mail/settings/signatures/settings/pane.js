define('io.ox/mail/settings/signatures/settings/pane', [
    'io.ox/core/extensions',
    'gettext!io.ox/mail',
    'settings!io.ox/mail',
    'io.ox/core/tk/dialogs',
    'io.ox/core/api/snippets',
    'io.ox/backbone/mini-views',
    'io.ox/core/http',
    'io.ox/core/config',
    'io.ox/mail/settings/model',
    'io.ox/core/notifications',
    'less!io.ox/mail/settings/signatures/style'
], function (ext, gt, settings, dialogs, snippets, mini, http, config, mailSettings, notifications) {

    'use strict';

    /**
     * By updating the last access timestamp the referenced file is prevented from being deleted from both session and disk storage.
     * Needed for inline images
     */
    function keepAlive(id) {
        return http.GET({
            module: 'file',
            params: { action: 'keepalive', id: id }
        });
    }

    ext.point('io.ox/mail/settings/signature-dialog').extend({
        id: 'name',
        index: 100,
        draw: function (baton) {
            this.append(
                $('<div class="form-group">').append(
                    baton.$.name = $('<input type="text" class="form-control">').attr({ 'id': 'signature-name', 'tabindex': 1, 'placeholder': gt('Signature name') })
                )
            );
        }
    });

    ext.point('io.ox/mail/settings/signature-dialog').extend({
        id: 'error',
        index: 200,
        draw: function (baton) {
            this.append(
                baton.$.error = $('<div>').addClass('help-block error')
            );
        }
    });

    ext.point('io.ox/mail/settings/signature-dialog').extend({
        id: 'textarea',
        index: 300,
        draw: function (baton) {
            this.append(
                $('<div class="form-group">').css({
                    'min-height': '266px',
                    height: '266px'
                }).append(
                    baton.$.contentEditable = $('<div>')
                    .attr({
                        'data-editor-id': baton.editorId
                    })
                )
            );

            require(['io.ox/core/tk/contenteditable-editor'], function (Editor) {
                new Editor(baton.$.contentEditable, {
                    toolbar1: 'bold italic | alignleft aligncenter alignright | link | image',
                    advanced: 'fontselect fontsizeselect | forecolor',
                    css: {
                        'min-height': '230px', //overwrite min-height of editor
                        'height': '230px',
                        'overflow-y': 'auto'
                    },
                    class: 'io-ox-signature-edit',
                    keepalive: keepAlive,
                    scrollpane: baton.$.contentEditable
                }).done(function (ed) {
                    baton.editor = ed;
                    baton.editor.show();

                    if (!looksLikeHTML(baton.content)) {
                        // convert to html
                        var str = String(baton.content || '').replace(/[\s\xA0]+$/g, '');

                        baton.content = $('<p>').append(baton.editor.ln2br(str)).prop('outerHTML');
                    }

                    baton.editor.setContent(baton.content);
                });
            });
        }
    });

    ext.point('io.ox/mail/settings/signature-dialog').extend({
        id: 'position',
        index: 400,
        draw: function (baton) {
            this.append(
                $('<div class="form-group">').append(
                    baton.$.insertion = $('<select id="signature-position" class="form-control" tabindex="1">')
                        .append(
                            $('<option value="above">').text(gt('Add signature above quoted text')),
                            $('<option value="below">').text(gt('Add signature below quoted text'))
                        )
                        .val(settings.get('defaultSignaturePosition', 'below'))
                )
            );
        }
    });

    function looksLikeHTML(str) {
        str = str || '';
        return (/<([A-Za-z][A-Za-z0-9]*)\b[^>]*>(.*?)<\/\1>/).test(str);
    }

    function fnEditSignature(evt, signature) {
        if (!signature) {
            signature = {
                id: null,
                name: '',
                signature: ''
            };
        }

        function validateField(field, target) {
            if ($.trim(field.val()) === '') {
                //trim here because backend does not allow names containing only spaces
                field.addClass('error');
                target.text(gt('Please enter a valid name'));
            } else {
                field.removeClass('error');
                target.empty();
            }
        }

        if (_.isString(signature.misc)) { signature.misc = JSON.parse(signature.misc); }

        var popup = new dialogs.ModalDialog({ async: true, tabTrap: false, width: 600, addClass: 'io-ox-signature-dialog' });
        popup.header($('<h4>').text(signature.id === null ? gt('Add signature') : gt('Edit signature')));

        var baton = new ext.Baton({
            editorId: _.uniqueId('editor-'),
            content: signature.content
        });
        ext.point('io.ox/mail/settings/signature-dialog').invoke('draw', popup.getContentNode(), baton);

        popup.addPrimaryButton('save', gt('Save'), 'save', { tabIndex: 1 })
        .addButton('cancel', gt('Cancel'), 'cancel', { tabIndex: 1 })
        .on('save', function () {
            if (baton.$.name.val() !== '') {
                var update = signature.id ? {} : { type: 'signature', module: 'io.ox/mail', displayname: '', content: '', misc: { insertion: 'below', 'content-type': 'text/html' }},
                    editorContent = baton.editor.getContent();

                update.id = signature.id;
                update.misc = { insertion: baton.$.insertion.val(), 'content-type': 'text/html' };

                if (editorContent !== signature.content) update.content = editorContent;
                if (baton.$.name.val() !== signature.displayname) update.displayname = baton.$.name.val();

                popup.busy();

                var def = null;
                if (signature.id) {
                    def = snippets.update(update);
                } else {
                    def = snippets.create(update);
                }
                def.done(function () {
                    snippets.getAll('signature').done(function (sigs) {
                        // set very first signature as default if no other signatures exist
                        if (sigs.length === 1) {
                            settings.set('defaultSignature', sigs[0].id).save();
                        }
                        popup.idle();
                        popup.close();
                    });
                }).fail(function (error) {
                    require(['io.ox/core/notifications'], function (notifications) {
                        notifications.yell(error);
                        popup.idle();
                    });
                });
            } else {
                popup.idle();
                validateField(baton.$.name, baton.$.error);
            }
        })
        .on('close', function () {
            baton.editor.destroy();
        })
        .show();

        baton.$.name.val(signature.displayname);
        baton.$.name.focus();

        if (_.isObject(signature.misc) && signature.misc.insertion) {
            baton.$.insertion.val(signature.misc.insertion);
        }

        _.defer(function () {
            if (signature.displayname) {
                baton.$.contentEditable.select();
            } else {
                baton.$.name.select();
            }
        });

        baton.$.name.on('change', function () {
            validateField(baton.$.name, baton.$.error);
        });
    }

    function fnImportSignatures(evt, signatures) {

        // create modal dialog with a list of old signatures (ox 6)
        var dialog = new dialogs.ModalDialog({ async: true }),
            Model = Backbone.Model.extend({
                defaults: {
                    check: false
                }
            }),
            model = new Model();
        dialog.header($('<h4>').text(gt('Import signatures')))
        .append(
            $('<p class="help-block">').text(gt('You can import existing signatures from the previous product generation.')),
            $('<div>').addClass('checkbox').append(
                $('<label>').text(gt('Delete old signatures after import')).prepend(
                    new mini.CheckboxView({ name: 'check', model: model }).render().$el
                )
            ),
            $('<ul class="io-ox-signature-import">').append(
                _(signatures).map(function (sig) {
                    //replace div and p elements to br's and remove all other tags.
                    var preview = (sig.signature_text || '')
                        .replace(/<(br|\/br|\/p|\/div)>(?!$)/g, '\n')
                        .replace(/<(?:.|\n)*?>/gm, '')
                        .replace(/(\n)+/g, '<br>');

                    // if preview is empty or a single br-tag, do not append a preview
                    if (preview === '' || preview === '<br>') {
                        return '';
                    }

                    return $('<li>').append(
                        $('<div class="signature-name">').text(sig.signature_name),
                        $('<div class="signature-preview">').append(preview)
                    );
                })
            )
        )
        .addPrimaryButton('import', gt('Import'))
        .addButton('cancel', gt('Cancel'));

        // show dialog
        dialog.show();

        dialog.on('import', function () {
            dialog.busy();

            var deferreds = _(signatures).map(function (sig) {
                return snippets.create({
                    type: 'signature',
                    module: 'io.ox/mail',
                    displayname: sig.signature_name,
                    content: sig.signature_text,
                    misc: {
                        insertion: sig.position,
                        'content-type': 'text/html'
                    },
                    meta: {
                        imported: sig
                    }
                }).fail(require('io.ox/core/notifications').yell);
            });

            if (model.get('check')) config.remove('gui.mail.signatures');

            $.when.apply(this, deferreds).then(function success() {
                dialog.close();
                if (model.get('check')) {
                    config.save();
                    evt.target.remove();
                }
            }, function fail() {
                dialog.idle();
            });
        });
    }

    ext.point('io.ox/mail/settings/signatures/settings/detail').extend({
        id: 'header',
        index: 100,
        draw: function () {
            var buttonContainer = $('<div class="btn-group pull-right">').append(
                $('<button type="button" class="btn btn-primary" tabindex="1">').text(gt('Add new signature')).on('click', fnEditSignature)
            );

            this.append(
                $('<div class="io-ox-signature-settings">').append(
                    $('<h1 class="pull-left">').text(gt('Signatures')),
                    !_.device('smartphone') ? buttonContainer : [],
                    $('<div class="clearfix">')
                )
            );

            if (config.get('gui.mail.signatures') && !_.isNull(config.get('gui.mail.signatures')) && config.get('gui.mail.signatures').length > 0) {
                buttonContainer.append(
                    $('<button type="button" class="btn btn-default" tabindex="1">').text(gt('Import signatures')).on('click', function (e) {
                        fnImportSignatures(e, config.get('gui.mail.signatures'));
                        return false;
                    })
                );
            }
        },
        save: function () {
            mailSettings.saveAndYell().done(function () {
                //update mailapi
                require(['io.ox/mail/api'], function (mailAPI) {
                    mailAPI.updateViewSettings();
                });
            }).fail(function () {
                notifications.yell('error', gt('Could not save settings'));
            });
        }
    });

    ext.point('io.ox/mail/settings/signatures/settings/detail').extend({
        id: 'signatures',
        index: 200,
        draw: function (baton) {
            baton.model = mailSettings;

            var $node,
                $list,
                signatures,
                defaultSignatureView,
                defaultReplyForwardView;
            this.append($node = $('<div class="io-ox-signature-settings">'));
            function fnDrawAll() {
                snippets.getAll('signature').then(function (sigs) {
                    signatures = {};
                    $list.empty();
                    //clear views before rendering
                    defaultSignatureView.$el.empty();
                    defaultSignatureView.trigger('appendOption', { value: '', label: gt('No signature'), isDefault: false });
                    defaultReplyForwardView.$el.empty();
                    defaultReplyForwardView.trigger('appendOption', { value: '', label: gt('No signature'), isDefault: false });

                    //hide default signature selection, if there are no signatures
                    $node.children('.form-group').css('display', sigs.length > 0 ? '' : 'none');
                    _(sigs).each(function (signature) {
                        //replace div and p elements to br's and remove all other tags.
                        var content = signature.content
                            .replace(/<(br|\/br|\/p|\/div)>(?!$)/g, '\n')
                            .replace(/<(?:.|\n)*?>/gm, '')
                            .replace(/(\n)+/g, '<br>');

                        signatures[signature.id] = signature;
                        var isDefault = settings.get('defaultSignature') === signature.id,
                            $item = $('<li class="widget-settings-view">')
                                .attr('data-id', signature.id)
                                .append(
                                    $('<div class="selectable deletable-item">')
                                    .append(
                                        $('<span class="list-title pull-left" data-property="displayName">').text(gt.noI18n(signature.displayname)),
                                        $('<div class="widget-controls">').append(
                                            $('<a class="action" tabindex="1" data-action="edit">').text(gt('Edit')).attr({
                                                role: 'button',
                                                'aria-label': gt('%1$s, %2$s', gt.noI18n(signature.displayname), gt('Edit'))
                                            }),
                                            $('<a class="remove">').attr({
                                                'data-action': 'delete',
                                                title: gt('Delete'),
                                                'aria-label': gt('%1$s, %2$s', gt.noI18n(signature.displayname), gt('Delete')),
                                                role: 'button',
                                                tabindex: 1
                                            }).append($('<i class="fa fa-trash-o">'))
                                        ),
                                        // do not add a preview pane with single br-tag or empty string
                                        (content === '<br>' || content === '') ? '' : $('<div class="signature-preview">').click(clickEdit).append(content)
                                    )
                                );

                        if (isDefault) {
                            $item.addClass('default');
                        }
                        $list.append($item);
                        defaultSignatureView.trigger('appendOption', { value: signature.id, label: signature.displayname, isDefault: settings.get('defaultSignature') === signature.id });
                        defaultReplyForwardView.trigger('appendOption', { value: signature.id, label: signature.displayname, isDefault: settings.get('defaultReplyForwardSignature') === signature.id });
                    });
                }, require('io.ox/core/notifications').yell);
            }
            var radioNone, radioCustom, signatureText;
            try {
                if (_.device('smartphone')) {
                    var type = settings.get('mobileSignatureType');
                    if (type !== 'custom') type = 'none';
                    $node.append(
                        $('<div class="form-group">').append(
                            $('<div class="radio">').append(
                                $('<label>').append(
                                    radioNone = $('<input type="radio" name="mobileSignature">')
                                    .prop('checked', type === 'none'),
                                    gt('No signature')
                                )
                                .on('change', radioChange)
                            ),
                            $('<div class="radio">').append(
                                $('<label>').append(
                                    radioCustom = $('<input type="radio" name="mobileSignature">')
                                    .prop('checked', type === 'custom')
                                    .on('change', radioChange),
                                    signatureText = $('<textarea class="form-control col-xs-12" rows="5">')
                                    .val(settings.get('mobileSignature'))
                                    .on('change', textChange)
                                )
                            )
                        )
                    );
                } else {
                    addSignatureList($node);
                }
            } catch (e) {
                console.error(e, e.stack);
            }

            function radioChange() {
                var type = radioCustom.prop('checked') ? 'custom' : 'none';
                baton.model.set('mobileSignatureType', type);
            }

            function textChange() {
                baton.model.set('mobileSignature', signatureText.val());
            }

            function clickEdit(e) {
                if ((e.type === 'click') || (e.which === 13)) {
                    var id = $(this).closest('li').attr('data-id');
                    fnEditSignature(e, signatures[id]);
                    e.preventDefault();
                }
            }

            function addSignatureList($node) {
                var section;

                // Register edit and delete events
                $list = $('<ul class="list-unstyled list-group settings-list">')
                .on('click keydown', 'a[data-action=edit]', function (e) {
                    if ((e.type === 'click') || (e.which === 13)) {
                        var id = $(this).closest('li').attr('data-id');
                        fnEditSignature(e, signatures[id]);
                        e.preventDefault();
                    }
                })
                .on('click keydown', 'a[data-action=delete]', function (e) {
                    if ((e.type === 'click') || (e.which === 13)) {
                        var id = $(this).closest('li').attr('data-id');
                        if (settings.get('defaultSignature') === id) settings.set('defaultSignature', '');
                        if (settings.get('defaultReplyForwardSignature') === id) settings.set('defaultReplyForwardSignature', '');
                        snippets.destroy(id).fail(require('io.ox/core/notifications').yell);
                        e.preventDefault();
                    }
                })
                .appendTo($node);

                defaultSignatureView = new mini.SelectView({ list: [], name: 'defaultSignature', model: baton.model, id: 'defaultSignature', className: 'form-control' })
                .on('appendOption', function (option) {
                    this.$el.append($('<option>').attr({ 'value': option.value }).text(option.label));
                    if (option.isDefault) {
                        this.$el.val(option.value);
                    }
                });

                baton.model.on('change:defaultSignature', function () {
                    var id = baton.model.get('defaultSignature');
                    $list.find('.default').removeClass('default');
                    $list.find('[data-id="' + id + '"]').addClass('default');
                });

                defaultReplyForwardView = new mini.SelectView({ list: [], name: 'defaultReplyForwardSignature', model: baton.model, id: 'defaultReplyForwardSignature', className: 'form-control' })
                .on('appendOption', function (option) {
                    this.$el.append($('<option>').attr({ 'value': option.value }).text(option.label));
                    if (option.isDefault) {
                        this.$el.val(option.value);
                    }
                });

                $node.append(
                    $('<div class="row">').append(
                        $('<div class="form-group col-xs-12 col-md-6">').append(
                            $('<label for="defaultSignature" class="control-label">')
                            .text(gt('Default signature for new messages')),
                            $('<div>').addClass('controls').append(
                                defaultSignatureView.render().$el
                            )
                        ),
                        $('<div class="form-group col-xs-12 col-md-6">').append(
                            $('<label for="defaultSignature" class="control-label">')
                            .text(gt('Default signature for replies or forwardings')),
                            $('<div>').addClass('controls').append(
                                defaultReplyForwardView.render().$el
                            )
                        )
                    )
                );

                //draw signatures
                fnDrawAll();
                snippets.on('refresh.all', fnDrawAll);

                section = null;
            }
        }
    });
});
