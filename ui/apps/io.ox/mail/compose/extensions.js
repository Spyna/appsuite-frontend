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
 */

define('io.ox/mail/compose/extensions', [
    'io.ox/contacts/api',
    'io.ox/mail/sender',
    'io.ox/backbone/mini-views/common',
    'io.ox/backbone/mini-views/dropdown',
    'io.ox/core/extensions',
    'io.ox/core/extPatterns/actions',
    'io.ox/core/tk/tokenfield',
    'io.ox/core/dropzone',
    'io.ox/core/capabilities',
    'io.ox/mail/actions/attachmentQuota',
    'io.ox/core/util',
    'settings!io.ox/mail',
    'gettext!io.ox/mail',
    'io.ox/core/extPatterns/links',
    'settings!io.ox/core',
    'static/3rd.party/jquery-ui.min.js'
], function (contactAPI, sender, mini, Dropdown, ext, actions, Tokenfield, dropzone, capabilities, attachmentQuota, util, settings, gt, links, settingsCore) {

    var POINT = 'io.ox/mail/compose';

    //make strings accessible to translators
    var tokenfieldTranslations = {
        to: gt('To'),
        cc: gt('CC'),
        bcc: gt('BCC'),
        reply_to: /*#. Must not exceed 8 characters. e.g. German would be: "Antworten an", needs to be abbreviated like "Antw. an" as space is very limited */ gt.pgettext('compose', 'Reply to')
    };

    var extensions = {

        header: function (baton) {
            if (!baton.view.app.getWindow()) return;
            var header = $('<div data-extension-id="header">');
            baton.$header = header;
            ext.point(POINT + '/header').invoke('draw', header, baton);
            baton.view.app.getWindow().setHeader(header);
        },

        title: function () {
            this.append(
                $('<h1 class="sr-only">').text(gt('Compose new mail'))
            );
        },

        buttons: {
            discard: function (baton) {
                return (
                    $('<button type="button" class="btn btn-default" data-action="discard" tabindex="1">')
                        .on('click', function () { baton.view.app.quit(); })
                        .text(gt('Discard'))
                        .appendTo(this)
                );
            },
            save: function (baton) {
                this.append($('<button type="button" class="btn btn-default" data-action="save" tabindex="1">')
                    .on('click', function () {
                        if (baton.view.isSaving === true) return false;
                        baton.view.isSaving = true;
                        baton.view.saveDraft().always(function () {
                            baton.view.isSaving = false;
                        });
                    })
                    .text(gt('Save')));
            },
            send: function (baton) {
                this.append($('<button type="button" class="btn btn-primary" data-action="send" tabindex="1">')
                    .on('click', function () { baton.view.send(); })
                    .on('keyup', function (e) {
                        if ((e.keyCode || e.which) === 27) baton.view.focusEditor();
                    })
                    .text(gt('Send')));
            }
        },

        sender: function (baton) {

            function editNames() {
                require(['io.ox/mail/compose/names'], function (names) {
                    names.open();
                });
            }

            var node = $('<div class="row sender" data-extension-id="sender">'),
                render = function () {

                    function renderFrom(array) {
                        if (!array) return;
                        var name = array[0], address = array[1];
                        return [
                            $('<span class="name">').text(name ? name + ' ' : ''),
                            $('<span class="address">').text(name ? '<' + address + '>' : address)
                        ];
                    }

                    var defaultSender = _(baton.model.get('from')).first(),
                        dropdown = new Dropdown({
                            model: baton.model,
                            label: renderFrom(defaultSender),
                            aria: gt('From'),
                            caret: true
                        });

                    sender.drawDropdown().done(function (list) {

                        function toggleNames() {
                            var value = !!settings.get('sendDisplayName', true);
                            settings.set('sendDisplayName', !value).save();
                            baton.model.set('sendDisplayName', !value);
                            ox.trigger('change:customDisplayNames');
                            // stop propagation to keep drop-down open
                            return false;
                        }

                        function redraw() {
                            var from = _(baton.model.get('from')).first();
                            dropdown.$('ul').empty();
                            drawOptions();
                            dropdown.$('.dropdown-label').empty().append(renderFrom(from));
                            // re-focus element otherwise the bootstap a11y closes the drop-down
                            dropdown.$ul.find('[data-name="toggle-display"]').focus();
                        }

                        function applyDisplayName(item) {
                            // consider custom settings
                            var name = item[0], address = item[1];
                            if (!settings.get('sendDisplayName', true)) {
                                name = null;
                            } else if (settings.get(['customDisplayNames', address, 'overwrite'])) {
                                name = settings.get(['customDisplayNames', address, 'name'], '');
                            }
                            return [name, address];
                        }

                        function drawOptions() {

                            if (!list.sortedAddresses.length) return;
                            var options = _(list.sortedAddresses).pluck('option');

                            _(options).each(function (item) {
                                item = applyDisplayName(item);
                                dropdown.option('from', [item], function () {
                                    return renderFrom(item);
                                });
                            });

                            if (_.device('smartphone')) return;

                            // append options to toggle and edit names
                            var state = !!settings.get('sendDisplayName', true);
                            dropdown
                                .divider()
                                .link('toggle-display', state ? gt('Hide names') : gt('Show names'), toggleNames)
                                .link('edit-real-names', gt('Edit names'), editNames);
                        }

                        drawOptions();

                        node.append(
                            $('<label class="maillabel col-xs-1">').text(gt('From')),
                            $('<div class="col-xs-11">').append(
                                dropdown.render().$el.attr({ 'data-dropdown': 'from' })
                            )
                        );

                        ox.on('change:customDisplayNames', function () {
                            // fix current value
                            var from = baton.model.get('from');
                            if (from) baton.model.set('from', [applyDisplayName(from[0])]);
                            // redraw drop-down
                            redraw();
                        });
                        baton.view.listenTo(baton.model, 'change:from', redraw);
                    });
                };

            if (!baton.model.get('from')) {
                baton.model.once('change:from', function () {
                    render();
                });
            } else {
                render();
            }

            this.append(node);
        },

        // TODO: only used by search
        tokenPicture: function (model) {
            // add contact picture
            $(this).prepend(
                contactAPI.pictureHalo(
                    $('<div class="contact-image">'),
                    model.toJSON(),
                    { width: 16, height: 16, scaleType: 'contain' }
                )
            );
        },

        recipientActionLink: function (type) {
            return function () {
                var node = $('<a href="#" tabindex="1" data-action="add" role="checkbox" aria-checked="false">');
                if (type === 'cc') {
                    node.attr({ 'data-type': 'cc', 'aria-label': gt('Show carbon copy input field') }).text(gt('CC'));
                } else {
                    node.attr({ 'data-type': 'bcc', 'aria-label': gt('Show blind carbon copy input field') }).text(gt('BCC'));
                }
                this.append(node);
            };
        },

        recipientActionLinkMobile: function () {
            var node = $('<a href="#" tabindex="1" data-action="add" role="checkbox" aria-checked="false">').append($('<span class="fa fa-angle-right">'));
            this.append(node);
        },

        recipientActions: function () {
            var node = $('<div class="recipient-actions">');
            if (_.device('!smartphone')) {
                ext.point(POINT + '/recipientActionLink').invoke('draw', node);
            } else {
                ext.point(POINT + '/recipientActionLinkMobile').invoke('draw', node);
            }

            this.append(node);
        },

        tokenfield: function (attr) {

            if (attr === 'reply_to' && settings.get('showReplyTo/configurable', false) === false) return;

            function onClickLabel(e) {
                e.preventDefault();
                var attr = e.data.attr, model = e.data.model;
                require(['io.ox/contacts/addressbook/popup'], function (popup) {
                    popup.open(function (result) {
                        var list = model.get(attr) || [];
                        model.set(attr, list.concat(_(result).pluck('array')));
                    });
                });
            }

            return function (baton) {
                var extNode,
                    guid = _.uniqueId('form-control-label-'),
                    value = baton.model.get(attr) || [],
                    // hide tokeninputfields if necessary (empty cc/bcc)
                    cls = 'row' + (/cc$/.test(attr) && !value.length ? ' hidden' : ''),
                    redrawLock = false,
                    tokenfieldView = new Tokenfield({
                        id: guid,
                        className: attr,
                        extPoint: POINT,
                        apiOptions: {
                            contacts: true,
                            distributionlists: true,
                            msisdn: true,
                            emailAutoComplete: true
                        },
                        maxResults: 20,
                        placeholder: tokenfieldTranslations[attr] // for a11y and easy access for custom dev when they want to display placeholders (these are made transparent via less)
                    });

                var node = $('<div class="col-xs-11">').append(
                    tokenfieldView.$el
                );
                if (attr === 'to') {
                    ext.point(POINT + '/recipientActions').invoke('draw', node);
                }

                var title = gt('Click to select contacts');

                this.append(
                    extNode = $('<div data-extension-id="' + attr + '">').addClass(cls).append(
                        $('<div class="maillabel col-xs-1">').append(
                            $('<a href="#" role="button" tabindex="1">')
                            .text(tokenfieldTranslations[attr])
                            .attr({
                                // add aria label since tooltip takes away the title attribute
                                'aria-label': title,
                                'title': title
                            })
                            .on('click', { attr: attr, model: baton.model }, onClickLabel)
                            .tooltip({ animation: false, delay: 0, placement: 'bottom' })
                        ),
                        node
                    )
                );

                tokenfieldView.render().$el.on('tokenfield:createdtoken', function (e) {
                    // extension point for validation etc.
                    ext.point(POINT + '/createtoken').invoke('action', this, _.extend(baton, { event: e }));
                }).on('tokenfield:next', function () {
                    extNode.nextAll().find('input.tt-input,input[name="subject"]').filter(':visible').first().focus();
                });

                // bind mail-model to collection
                tokenfieldView.listenTo(baton.model, 'change:' + attr, function (mailModel, recipients) {
                    if (redrawLock) return;
                    var recArray = _(recipients).map(function (recipient) {
                        var display_name = util.removeQuotes(recipient[0]),
                            email = recipient[1];
                        return {
                            type: 5,
                            display_name: display_name,
                            email1: email,
                            token: { label: display_name, value: email }
                        };
                    });
                    this.collection.reset(recArray);
                });

                // trigger change to fill tokenfield
                baton.model.trigger('change:' + attr, baton.model, baton.model.get(attr));

                tokenfieldView.collection.on('change reset add remove sort', function () {
                    var recipients = this.map(function (model) {
                        var token = model.get('token');
                        var display_name = util.removeQuotes(token.label), email = token.value;
                        return [display_name, email];
                    });
                    redrawLock = true;
                    baton.model.set(attr, recipients);
                    redrawLock = false;
                });
            };
        },

        subject: function (baton) {
            var guid = _.uniqueId('form-control-label-');
            this.append(
                $('<div data-extension-id="subject" class="row subject">').append(
                    $('<label class="maillabel hidden-xs col-sm-1">').text(gt('Subject')).attr({
                        'for': guid
                    }),
                    $('<div class="col-xs-12 col-sm-11">').append(
                        new mini.InputView({ model: baton.model, id: guid, name: 'subject' }).render().$el.attr({ placeholder: gt('Subject') })
                    )
                )
            );
        },

        signature: function (baton) {
            if (_.device('smartphone')) return;
            var self = this;
            baton.view.signaturesLoading = $.Deferred();
            require(['io.ox/core/api/snippets'], function (snippetAPI) {
                snippetAPI.getAll('signature').always(function (signatures) {
                    var oldSignatures = baton.model.get('signatures') || [],
                        allSignatures = _.uniq(signatures.concat(oldSignatures), false, function (o) { return o.id; });
                    baton.model.set('signatures', allSignatures);
                    var sa = _.map(signatures, function (o) {
                        return { 'id': o.id, 'displayName': o.displayname };
                    });

                    if (sa.length >= 1) {
                        _.each(sa, function (item) {
                            self.data('view').option('defaultSignatureId', item.id, item.displayName);
                        });
                    }
                    baton.view.signaturesLoading.resolve(allSignatures);
                });
            });
        },

        signaturemenu: function (baton) {
            if (_.device('smartphone')) return;

            var self = this,
                container = $('<div class="dropdown signatures text-left">');

            function draw() {
                var dropdown = new Dropdown({ model: baton.model, label: gt('Signatures'), caret: true, el: container })
                    .option('defaultSignatureId', '', gt('No signature'));

                ext.point(POINT + '/signatures').invoke('draw', dropdown.$el, baton);
                dropdown.$ul.addClass('pull-right');
                baton.view.signaturesLoading.done(function () {
                    dropdown.divider();
                    dropdown.link('settings', gt('Manage signatures'), function () {
                        var options = { id: 'io.ox/mail/settings/signatures' };
                        ox.launch('io.ox/settings/main', options).done(function () {
                            this.setSettingsPane(options);
                        });
                    });
                    dropdown.$ul.addClass('pull-right');
                    dropdown.render();
                });

                container.empty().append(dropdown.$el);
            }

            require(['io.ox/core/api/snippets'], function (snippetAPI) {
                baton.view.listenTo(snippetAPI, 'refresh.all', draw);
                draw();
            });
            self.append(container);
        },

        optionsmenu: function (baton) {
            var dropdown = new Dropdown({ model: baton.model, label: gt('Options'), caret: true });
            ext.point(POINT + '/menuoptions').invoke('draw', dropdown.$el, baton);

            dropdown.$ul.addClass('pull-right');

            this.append(dropdown.render().$el.addClass('text-left'));
        },

        attachmentPreviewList: function (baton) {
            var $el = this,
                def = $.Deferred();

            require(['io.ox/core/attachments/view'], function (Attachments) {
                var view = new Attachments.List({
                    point: 'io.ox/mail/compose/attachment/header',
                    collection: baton.model.get('attachments'),
                    editable: true,
                    model: baton.model,
                    mode: settings.get('attachments/layout/compose/' + _.display(), 'preview')
                });

                if (settings.get('compose/shareAttachments/enabled', false)) {
                    var ShareModel = Backbone.Model.extend({}),
                        requiredExpiration = settings.get('compose/shareAttachments/requiredExpiration', false);

                    view.settingsModel = new ShareModel({
                        'instruction_language': settingsCore.get('language'),
                        'enable':  false,
                        'autodelete': settings.get('compose/shareAttachments/forceAutoDelete', false)
                    });

                    view.notificationModel = new ShareModel({});
                    view.shareAttachmentsIsActive = function () {
                        if (_.isEmpty(view.getValidModels())) return false;
                        var actualAttachmentSize = 0,
                            threshold = settings.get('compose/shareAttachments/threshold', 0),
                            thresholdExceeded;

                        _.each(baton.model.get('attachments').models, function (model) {
                            actualAttachmentSize = actualAttachmentSize + model.getSize();
                        });

                        thresholdExceeded = threshold === 0 ? false : actualAttachmentSize > threshold;
                        return thresholdExceeded || view.settingsModel.get('enable');
                    };

                    view.toggleShareAttachments = function () {

                        _.each(view.point.keys(), function (id) {
                            if (view.shareAttachmentsIsActive()) {
                                view.settingsModel.set('enable', true);
                                view.point.enable(id);
                                view.$el.addClass('show-share-attachments');
                            } else if (id !== 'renderSwitch') {
                                view.settingsModel.set('enable', false);
                                view.point.disable(id);
                                view.$el.removeClass('show-share-attachments');
                            }
                        });

                        view.$header.empty();
                        this.renderHeader();
                        view.invoke('render');
                    };

                    view.extend({
                        renderSwitch: function (baton) {

                            function drawInlineLinks(node, data, view) {
                                var extension = new links.InlineLinks({
                                    dropdown: false,
                                    ref: 'io.ox/mail/attachment/shareAttachments'
                                });
                                view.shareAttachmentsIsActive();
                                return extension.draw.call(node, ext.Baton({ model: view.settingsModel, data: data, view: view }));
                            }

                            var models = baton.view.getValidModels(), $links = baton.view.$header.find('.links').empty().addClass('shareAttachments');
                            if (models.length >= 1) drawInlineLinks($links, _(models).invoke('toJSON'), baton.view);

                            if (baton.view.shareAttachmentsIsActive()) {
                                $links.find('li').prepend($('<i class="fa fa-check" aria-hidden="true">'));
                            }
                        },
                        renderOptions: function (baton) {
                            var $links = baton.view.$header.find('.links'),
                                defaultMoment = moment(_.now()).add(1, 'M').format('x'),
                                dropdown = new Dropdown({ model: baton.view.settingsModel, label: gt('Expiration'), tagName: 'div', caret: true })
                                .option('expiry_date', moment(_.now()).add(1, 'd').format('x'), gt('1 day'))
                                .option('expiry_date', moment(_.now()).add(1, 'w').format('x'), gt('1 week'))
                                .option('expiry_date', defaultMoment, gt('1 month'))
                                .option('expiry_date', moment(_.now()).add(3, 'M').format('x'), gt('3 months'))
                                .option('expiry_date', moment(_.now()).add(6, 'M').format('x'), gt('6 months'))
                                .option('expiry_date', moment(_.now()).add(1, 'y').format('x'), gt('1 year'));

                            if (baton.view.settingsModel.get('autodelete') || requiredExpiration) {
                                baton.view.settingsModel.set('expiry_date', defaultMoment);
                            } else {
                                dropdown
                                .option('expiry_date', '', gt('none'))
                                .divider()
                                .option('autodelete', true, gt('delete if expired'));
                                baton.view.settingsModel.set('expiry_date', '');
                            }

                            $links.append(dropdown.render().$el);
                        },
                        renderNotifications: function (baton) {
                            var $links = baton.view.$header.find('.links'),
                                dropdown = new Dropdown({ model: baton.view.notificationModel, label: gt('Notification'), tagName: 'div', caret: true })
                                .option('download', true, gt('when the receivers have finished downloading the files'))
                                .option('expired', true, gt('when the link is expired'))
                                .option('visit', true, gt('when the receivers have accessed the files'));

                            // if (!/^en_/.test(settingsCore.get('language'))) dropdown.option('translated', true, gt('translate notifications to english'));

                            $links.append(dropdown.render().$el);
                        },
                        renderPassword: function (baton) {
                            var $links = baton.view.$header.find('.links'),
                                passwordField = new mini.PasswordView({ name: 'password', model: baton.view.settingsModel, placeholder: gt('Password') });

                            $links.append(
                                $('<div class="input-group">').append(
                                    $('<span class="input-group-addon">').append(
                                        new mini.CheckboxView({ name: 'usepassword', model: baton.view.settingsModel }).render().$el
                                    ),
                                    passwordField.render().$el
                                )
                            );

                            if (!baton.view.settingsModel.get('usepassword')) passwordField.$el.attr('disabled', 'disabled');

                            baton.view.settingsModel.on('change:usepassword', function () {
                                if (baton.view.settingsModel.get('usepassword')) {
                                    passwordField.$el.removeAttr('disabled');
                                } else {
                                    passwordField.$el.attr('disabled', 'disabled');
                                }
                            });
                        }
                    });

                    view.listenTo(view.notificationModel, 'change', function () {
                        this.settingsModel.set('notifications', _.allKeys(this.notificationModel.attributes));
                    });

                    view.listenTo(view.settingsModel, 'change', function () {
                        if (this.settingsModel.get('enable')) {
                            baton.model.set('share_attachments', _.omit(this.settingsModel.attributes, 'usepassword'));
                        } else {
                            baton.model.unset('share_attachments');
                        }
                    });

                    view.listenTo(view.settingsModel, 'change:enable', function () {
                        this.toggleShareAttachments();
                    });

                    view.listenTo(view.collection, 'update', function () {
                        this.toggleShareAttachments();
                    });

                }

                // dropzone
                var zone = new dropzone.Inplace({
                    caption: gt('Drop attachments here')
                });

                zone.on({
                    'show': function () {
                        $el.css('minHeight', '100px');
                        $(window).trigger('resize');
                    },
                    'hide': function () {
                        $el.css('minHeight', 0);
                        $(window).trigger('resize');
                    },
                    'drop': function (files) {
                        baton.model.attachFiles(
                            _(files).map(function (file) {
                                return _.extend(file, { group: 'localFile' });
                            })
                        );
                        $(window).trigger('resize');
                    }
                });

                view.listenTo(baton.model, 'change:attachments', function () {
                    view.$list.empty();
                    view.$preview.empty();
                    view.renderList();
                    view.updateScrollControls();
                });

                view.listenToOnce(view.collection, 'add remove reset', _.debounce(function () {
                    if (this.getValidModels().length > 0) {
                        this.$el.addClass('open');
                        if (!this.isListRendered) {
                            this.renderList();
                            view.updateScrollControls();
                        }
                        $(window).trigger('resize');
                    }
                }));

                view.render();
                if (view.getValidModels().length > 0) {
                    view.renderList();
                    view.$el.addClass('open');
                    if (settings.get('compose/shareAttachments/enabled', false)) view.toggleShareAttachments();
                }
                $el.append(
                    zone.render().$el.addClass('abs'),
                    view.$el
                );

                view.$el.on('click', 'li.item', function (e) {

                    var node = $(e.currentTarget), id, data, baton, list;

                    // skip attachments without preview
                    if (!node.attr('data-original')) return;

                    id = node.attr('data-id');
                    data = view.collection.get(id).toJSON();
                    list = view.collection.filter(function (a) {
                        return a.get('disp') === 'attachment';
                    }).map(function (a) {
                        return a.toJSON();
                    });
                    baton = ext.Baton({ startItem: data, data: list });

                    actions.invoke('io.ox/mail/actions/view-attachment', null, baton);
                });

                // needed when adding several contacts via 'send as vcard'
                view.updateScrollControls();

                view.on('change:layout', function (mode) {
                    settings.set('attachments/layout/compose/' + _.display(), mode).save();
                });

                def.resolve(view);
            }, def.reject);

            return def;
        },

        attachment: (function () {
            function addLocalFile(model, e) {
                var self = this,
                    attachmentCollection = model.get('attachments'),
                    accumulatedSize = attachmentCollection.filter(function (m) {
                        var size = m.get('size');
                        return typeof size !== 'undefined';
                    })
                    .map(function (m) { return m.get('size'); })
                    .reduce(function (m, n) { return m + n; }, 0);

                if (attachmentQuota.checkQuota(e.target.files, accumulatedSize)) {
                    //#. %s is a list of filenames separeted by commas
                    //#. it is used by screenreaders to indicate which files are currently added to the list of attachments
                    self.trigger('aria-live-update', gt('Added %s to attachments.', _(e.target.files).map(function (file) { return file.name; }).join(', ')));
                    model.attachFiles(
                        _(e.target.files).map(function (file) {
                            return _.extend(file, { group: 'localFile' });
                        })
                    );
                }
            }

            function openFilePicker(model) {
                var self = this;
                require(['io.ox/files/filepicker'], function (Picker) {
                    new Picker({
                        primaryButtonText: gt('Add'),
                        cancelButtonText: gt('Cancel'),
                        header: gt('Add attachments'),
                        multiselect: true
                    })
                    .done(function (files) {
                        self.trigger('aria-live-update', gt('Added %s to attachments.', _(files).map(function (file) { return file.filename; }).join(', ')));
                        model.attachFiles(
                            _(files).map(function (file) {
                                return _.extend(file, { group: 'file' });
                            })
                        );
                    });
                });
            }

            return function (baton) {
                var fileInput = $('<input type="file" name="file" capture="camera">').css('display', 'none')
                        .on('change', addLocalFile.bind(this, baton.model))
                        // multiple is off on smartphones in favor of camera roll/capture selection
                        .prop('multiple', _.device('!smartphone'));

                if (capabilities.has('infostore')) {
                    var dropdown = new Dropdown({ label: gt('Attachments'), caret: true });
                    this.append(
                        fileInput,
                        dropdown.append(
                            $('<a href="#">').append($.txt(gt('Add local file'))).on('click', function () {
                                //WORKAROUND "bug" in Chromium (no change event triggered when selecting the same file again,
                                //in file picker dialog - other browsers still seem to work)
                                fileInput[0].value = '';
                                fileInput.trigger('click');
                            })
                        )
                        .link('add-file', gt('Add from Drive'), openFilePicker.bind(this, baton.model))
                        .render().$el
                    );
                } else {
                    this.append(
                        // file input
                        fileInput,
                        $('<button type="button" class="btn btn-link">')
                            .text(gt('Attachments'))
                            .on('click', function () {
                                //WORKAROUND "bug" in Chromium (no change event triggered when selecting the same file again,
                                //in file picker dialog - other browsers still seem to work)
                                fileInput[0].value = '';
                                fileInput.trigger('click');
                            })
                    );
                }
            };

        }()),

        body: function () {

            var self = this,
                editorId = _.uniqueId('tmce-'),
                editorToolbarId = _.uniqueId('tmcetoolbar-');

            self.append($('<div class="row">').append($('<div class="col-sm-12">').append(
                $('<div class="editable-toolbar">').attr('id', editorToolbarId),
                $('<div class="editable">').attr('id', editorId).css('min-height', '400px')
            )));
        },

        mailto: function () {
            // register mailto!
            if (settings.get('features/registerProtocolHandler', true)) {
                if (navigator.registerProtocolHandler) {
                    var l = location, $l = l.href.indexOf('#'), url = l.href.substr(0, $l);
                    navigator.registerProtocolHandler(
                        'mailto', url + '#app=' + ox.registry.get('mail-compose') + ':compose&mailto=%s', ox.serverConfig.productNameMail
                    );
                }
            }
        }
    };

    return extensions;
});
