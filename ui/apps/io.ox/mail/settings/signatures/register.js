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
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 */

define('io.ox/mail/settings/signatures/register', [
    'io.ox/core/extensions',
    'gettext!io.ox/mail',
    'settings!io.ox/mail',
    'io.ox/core/tk/dialogs',
    'io.ox/core/api/snippets',
    'io.ox/backbone/mini-views',
    'less!io.ox/mail/settings/signatures/style'
], function (ext, gt, settings, dialogs, snippets, mini) {

    'use strict';

    ext.point('io.ox/mail/settings/signature-dialog').extend({
        id: 'name',
        index: 100,
        draw: function (baton) {
            this.append(
                $('<div class="form-group">').append(
                    baton.$.name = $('<input type="text" class="form-control">').attr({ 'id': 'signature-name', 'tabindex': 1, 'placeholder': 'Signature name' })
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
                $('<div class="form-group">').css('min-height', '266px').append(
                    $('<div class="editable-toolbar">').attr('data-editor-id', baton.editorId),
                    baton.$.contentEditable = $('<div class="io-ox-signature-edit editable">')
                    .attr({
                        'data-editor-id': baton.editorId,
                        'tabindex': 1
                    })
                )
            );

            require(['io.ox/core/tk/contenteditable-editor'], function (Editor) {
                var ed;
                (ed = new Editor(baton.$.contentEditable, {
                    toolbar1: 'bold italic | alignleft aligncenter alignright | link',
                    advanced: 'fontselect fontsizeselect | forecolor',
                    css: {
                        'min-height': '230px', //overwrite min-height of editor
                        'height': '230px',
                        'overflow-y': 'auto'
                    }
                })).done(function () {
                    baton.editor = ed;
                    baton.editor.handleShow(true);

                    if (looksLikeHTML(baton.content)) {
                        baton.editor.setContent(baton.content);
                    } else {
                        baton.editor.setPlainText(baton.content);
                    }
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
                        .attr({ 'tabindex': 1 })
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

        var popup = new dialogs.ModalDialog({ async: true, tabTrap: false, width: 600 });
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
                var update = signature.id ? {} : { type: 'signature', module: 'io.ox/mail', displayname: '', content: '', misc: { insertion: 'below' }},
                    editorContent = baton.editor.getContent();

                update.id = signature.id;
                update.misc = { insertion: baton.$.insertion.val() };

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
                }).fail(require('io.ox/core/notifications').yell);

                popup.close();
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

        var popup = new dialogs.SidePopup({
            modal: true,
            tabTrap: true
        })
        .show(evt, function ($pane) {
            $pane.addClass('io-ox-signature-import');
            var $container;
            var $entirePopup = $pane.closest('.io-ox-sidepopup');

            function busy() {
                dialogs.busy($entirePopup);
            }

            function idle() {
                dialogs.idle($entirePopup);
            }

            $container = $('<table>').appendTo($pane);
            _(signatures).each(function (classicSignature, index) {

                var $row = $('<tr>').addClass('sig-row').appendTo($container);
                var preview = (classicSignature.signature_text || '')
                                // remove subsequent white-space
                                .replace(/\s\s+/g, ' ')
                                // reduce special char sequences
                                .replace(/(\W\W\W)\W+/g, '$1 ');

                $row.append(
                    $('<td>').css({ width: '10%', textAlign: 'center' }).append(
                        $('<input type="checkbox">').attr('data-index', index)
                    ),
                    $('<td>').css({ width: '80%', padding: '10px' }).append(
                        classicSignature.signature_name, $('<br>'),
                        $('<div>').text(gt.noI18n(preview)).addClass('classic-sig-preview')
                    )
                );

                var specializedClick = false;
                $row.find(':checkbox').on('click', function () {
                    specializedClick = true;
                });

                $row.on('click', function () {
                    if (specializedClick) {
                        specializedClick = false;
                        return;
                    }
                    var $checkbox = $(this).find(':checkbox');
                    $checkbox.prop('checked', !$checkbox.prop('checked'));
                });
            });

            $pane.append($('<a href="#">').text(gt('Select all')).on('click', function () {
                $container.find(':checkbox').each(function () {
                    if (!$(this).prop('checked')) {
                        $(this).prop('checked', true);
                    }
                });
                return false;
            }));

            $pane.append($('<br>'), $('<br>'), $('<br>'));

            var $button = $('<button type="button" class="btn btn-primary">')
                .text(gt('Import signatures')).appendTo($pane);

            $button.on('click', function () {
                busy();
                var deferreds = [];
                $container.find(':checked').each(function () {
                    var index = $(this).data('index'),
                        classicSignature = signatures[index];

                    deferreds.push(
                        snippets.create({
                            type: 'signature',
                            module: 'io.ox/mail',
                            displayname: classicSignature.signature_name,
                            content: classicSignature.signature_text,
                            misc: {
                                insertion: classicSignature.position
                            },
                            meta: {
                                imported: classicSignature
                            }
                        }).fail(require('io.ox/core/notifications').yell)
                    );
                });

                $.when.apply($, deferreds).always(function () { idle(); popup.close(); });
            });

        });
    }

    ext.point('io.ox/mail/settings/detail/pane').extend({
        id: 'signatures',
        index: 500,
        draw: function (baton) {
            var $node,
                $list,
                signatures,
                defaultSignatureView,
                defaultReplyForwardView;

            this.append($node = $('<fieldset class="io-ox-signature-settings">'));
            function fnDrawAll() {
                snippets.getAll('signature').done(function (sigs) {
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
                        signatures[signature.id] = signature;

                        var $item = $('<li class="widget-settings-view">')
                            .attr('data-id', signature.id)
                            .append(
                                $('<div class="selectable deletable-item">')
                                .append(
                                    $('<span class="list-title pull-left" data-property="displayName">').text(gt.noI18n(signature.displayname)),
                                    $('<div class="widget-controls">').append(
                                        $('<a class="action" tabindex="1" data-action="edit">').text(gt('Edit')),
                                        $('<a class="remove">').attr({
                                            'data-action': 'delete',
                                            title: gt('Delete'),
                                            tabindex: 1
                                        }).append($('<i class="fa fa-trash-o">'))
                                    )
                                )
                            );
                        $list.append($item);
                        defaultSignatureView.trigger('appendOption', { value: signature.id, label: signature.displayname, isDefault: settings.get('defaultSignature') === signature.id });
                        defaultReplyForwardView.trigger('appendOption', { value: signature.id, label: signature.displayname, isDefault: settings.get('defaultReplyForwardSignature') === signature.id });
                    });
                });
            }
            var radioNone, radioCustom, signatureText;
            try {
                if (_.device('smartphone')) {
                    var type = settings.get('mobileSignatureType');
                    if (type !== 'custom') type = 'none';
                    $node.append($('<legend class="sectiontitle">')
                    .text(
                        //#. Section title for the mobile signature
                        gt('Signature')
                    ))
                    .append(
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
                    $node.append($('<legend class="sectiontitle">').text(gt('Signatures')));
                    addSignatureList($node, baton);
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
                        snippets.destroy(id).fail(require('io.ox/core/notifications').yell);
                        e.preventDefault();
                    }
                })
                .appendTo($node);

                // Append "add signature" button
                $node.append(
                    section = $('<div class="sectioncontent btn-toolbar">').append(
                        $('<div class="form-group">').append(
                            $('<button type="button" class="btn btn-primary" tabindex="1">').text(gt('Add new signature')).on('click', fnEditSignature)
                        )
                    )
                );

                defaultSignatureView = new mini.SelectView({ list: [], name: 'defaultSignature', model: baton.model, id: 'defaultSignature', className: 'form-control' })
                .on('appendOption', function (option) {
                    this.$el.append($('<option>').attr({ 'value': option.value }).text(option.label));
                    if (option.isDefault) {
                        this.$el.val(option.value);
                    }
                });

                defaultReplyForwardView = new mini.SelectView({ list: [], name: 'defaultReplyForwardSignature', model: baton.model, id: 'defaultReplyForwardSignature', className: 'form-control' })
                .on('appendOption', function (option) {
                    this.$el.append($('<option>').attr({ 'value': option.value }).text(option.label));
                    if (option.isDefault) {
                        this.$el.val(option.value);
                    }
                });

                $node.append(
                    $('<div class="form-group row">').append(
                        $('<label for="defaultSignature" class="control-label col-xs-12 col-md-8">')
                        .text(gt('Default signature for new messages')),
                        $('<div>').addClass('controls col-xs-12 col-md-4').append(
                            $('<div>').append(
                                $('<div>').append(defaultSignatureView.render().$el)
                            )
                        )
                    ),
                    $('<div class="form-group row">').append(
                        $('<label for="defaultSignature" class="control-label col-xs-12 col-md-8">')
                        .text(gt('Default signature for reply or forward messages')),
                        $('<div>').addClass('controls col-xs-12 col-md-4').append(
                            $('<div>').append(
                                $('<div>').append(defaultReplyForwardView.render().$el)
                            )
                        )
                    )
                );

                //draw signatures
                fnDrawAll();
                snippets.on('refresh.all', fnDrawAll);

                require(['io.ox/core/config'], function (config) {
                    if (config.get('gui.mail.signatures') && !_.isNull(config.get('gui.mail.signatures')) && config.get('gui.mail.signatures').length > 0) {
                        section.append(

                            $('<button type="button" class="btn btn-primary" tabindex="1">').text(gt('Import signatures')).on('click', function (e) {
                                fnImportSignatures(e, config.get('gui.mail.signatures'));
                                return false;
                            })
                        );
                    }
                    section = null;
                });
            }
        }
    });

});
