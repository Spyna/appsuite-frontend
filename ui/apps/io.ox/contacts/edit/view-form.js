/**
 * All content on this website (including text, images, source code and any
 * other original works), unless otherwise noted, is licensed under a Creative
 * Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2011 Mail: info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define('io.ox/contacts/edit/view-form', [
    'io.ox/contacts/model',
    'io.ox/backbone/views',
    'io.ox/backbone/forms',
    'io.ox/core/extPatterns/actions',
    'io.ox/core/extPatterns/links',
    'io.ox/contacts/widgets/pictureUpload',
    'io.ox/core/tk/attachments',
    'io.ox/contacts/api',
    'io.ox/contacts/util',
    'gettext!io.ox/contacts',
    'io.ox/core/capabilities',
    'io.ox/core/extensions',
    'io.ox/core/date',
    'io.ox/backbone/mini-views',
    'io.ox/backbone/mini-views/attachments',
    'less!io.ox/contacts/edit/style.less'
], function (model, views, forms, actions, links, PictureUpload, attachments, api, util, gt, capabilities, ext, date, mini, attachmentViews) {

    "use strict";

    var meta = {
        sections: {
            personal: ['title', 'first_name', 'last_name', /*'display_name',*/ // yep, end-users don't understand it
                         'second_name', 'suffix', 'nickname', 'birthday',
                         'marital_status', 'number_of_children', 'spouse_name',
                         'anniversary', 'url'],
            job: ['profession', 'position', 'department', 'company', 'room_number',
                    'employee_type', 'number_of_employees', 'sales_volume', 'tax_id',
                    'commercial_register', 'branches', 'business_category', 'info',
                    'manager_name', 'assistant_name'],
            messaging: ['email1', 'email2', 'email3', 'instant_messenger1', 'instant_messenger2'],
            phone:  ['cellular_telephone1', 'cellular_telephone2',
                      'telephone_business1', 'telephone_business2',
                      'telephone_home1', 'telephone_home2',
                      'telephone_company', 'telephone_other',
                      'fax_business', 'fax_home', 'fax_other',
                      'telephone_car', 'telephone_isdn', 'telephone_pager',
                      'telephone_primary', 'telephone_radio',
                      'telephone_telex', 'telephone_ttytdd',
                      'telephone_ip', 'telephone_assistant', 'telephone_callback'],
            home_address: ['street_home', 'postal_code_home', 'city_home',
                           'state_home', 'country_home'],
            business_address: ['street_business', 'postal_code_business',
                               'city_business', 'state_business',
                               'country_business'],
            other_address: ['street_other', 'postal_code_other', 'city_other',
                            'state_other', 'country_other'],

            comment: ['note'],
            private_flag: ['private_flag'],

            userfields: ['userfield01', 'userfield02', 'userfield03', 'userfield04', 'userfield05',
                        'userfield06', 'userfield07', 'userfield08', 'userfield09', 'userfield10',
                        'userfield11', 'userfield12', 'userfield13', 'userfield14', 'userfield15',
                        'userfield16', 'userfield17', 'userfield18', 'userfield19', 'userfield20'],
            attachments: ['attachments_list']
        },

        rare: ['nickname', 'marital_status', 'number_of_children', 'spouse_name', 'anniversary',
               // phones
               'telephone_company', 'fax_other',
               'telephone_car', 'telephone_isdn', 'telephone_pager', 'telephone_primary',
               'telephone_radio', 'telephone_telex', 'telephone_ttytdd', 'telephone_assistant',
               'telephone_callback', 'telephone_ip',
               // job
               'number_of_employees', 'sales_volume', 'tax_id', 'commercial_register', 'branches',
               'business_category', 'info', 'manager_name', 'assistant_name', 'employee_type',
               // optional
               'userfield04', 'userfield05',
               'userfield06', 'userfield07', 'userfield08', 'userfield09', 'userfield10',
               'userfield11', 'userfield12', 'userfield13', 'userfield14', 'userfield15',
               'userfield16', 'userfield17', 'userfield18', 'userfield19', 'userfield20'
               ],

        alwaysVisible: [
            'title', 'first_name', 'last_name', 'birthday',
            'position', 'department', 'company',
            'email1', 'email2', 'instant_messenger1',
            'cellular_telephone1', 'telephone_home1',
            'street_home', 'postal_code_home', 'city_home', 'state_home', 'country_home',
            'private_flag', 'note',
            'attachments_list'
        ],

        input_type: {
            'email1': 'email',
            'email2': 'email',
            'email3': 'email'
        },

        i18n: {
            personal: gt('Personal information'),
            messaging: gt('Messaging'),
            phone: gt('Phone & fax numbers'),
            home_address: gt('Home address'),
            business_address: gt('Business address'),
            other_address: gt('Other address'),
            job: gt('Job description'),
            comment: gt('Comment'),
            userfields: gt('User fields'),
            private_flag: gt('Private'),
            attachments: gt('Attachments')
        }
    };

    // Remove attachment handling when infostore is not present
    if (!capabilities.has('infostore')) {
        delete meta.sections.attachments;
        delete meta.i18n.attachments;
    }

    _.each(['home', 'business', 'other'], function (type) {
        var fields = meta.sections[type + '_address'];
        meta.sections[type + '_address'] = _.compact(_.aprintf(
            //#. Format of addresses
            //#. %1$s is the street
            //#. %2$s is the postal code
            //#. %3$s is the city
            //#. %4$s is the state
            //#. %5$s is the country
            gt('%1$s\n%2$s %3$s\n%4$s\n%5$s'),
            function (i) { return fields[i]; }, $.noop)
        );
    });

    function createContactEdit(ref) {

        if (ref === 'io.ox/core/user') { // Remove attachment handling if view is used with user data instead of contact data
            delete meta.sections.attachments;
            delete meta.i18n.attachments;
        }

        var point = views.point(ref + '/edit'),

            ContactEditView = point.createView({
                tagName: 'div',
                className: 'edit-contact compact container-fluid default-content-padding'
            });

        point.extend(new PictureUpload({
            id: ref + '/edit/picture',
            index: 100,
            customizeNode: function () {
                this.$el
                    .css({ display: 'inline-block' })
                    .addClass("contact-picture-upload f6-target");
            }
        }));

        // Save
        point.basicExtend(new links.Button({
            id: "save",
            index: 110,
            label: gt("Save"),
            ref: ref + "/actions/edit/save",
            cssClasses: "btn btn-primary control f6-target",
            tabIndex: 2,
            tagtype: "button"
        }));

        if (_.device('small')) {
            point.basicExtend({
                id: "break",
                after: 'save',
                draw: function () {
                    this.append($('<br>'));
                }
            });
        }

        point.basicExtend(new links.Button({
            id: "discard",
            index: 120,
            label: gt("Discard"),
            ref: ref + "/actions/edit/discard",
            cssClasses: "btn control",
            tabIndex: 3,
            tagtype: "button"
        }));

        function toggle(e) {

            e.preventDefault();

            var node = $(this).closest('.edit-contact');

            // update "has-content" class
            node.find('.field input').each(function () {
                var input = $(this),
                    field = input.closest('.field'),
                    hasContent = $.trim(input.val()) !== '';
                field.toggleClass('has-content', hasContent);
            });

            node.toggleClass('compact');

            var isCompact = node.hasClass('compact'),
                label = isCompact ? gt('Extended view') : gt('Compact view'),
                icon = isCompact ? 'icon-expand-alt' : 'icon-collapse-alt';

            node.find('.toggle-compact')
                .find('i').attr('class', icon).end()
                .find('a').text(label);
        }

        var FullnameView = mini.AbstractView.extend({
            tagName: 'h1',
            className: 'name',
            setup: function (options) {
                this.listenTo(this.model, 'change:first_name change:last_name change:title', this.render);
            },
            render: function () {
                this.$el.text(util.getFullName(this.model.toJSON()) || '\u00A0');
                return this;
            }
        });

        var JobView = mini.AbstractView.extend({
            tagName: 'h2',
            className: 'job',
            setup: function (options) {
                this.listenTo(this.model, 'change:position change:department change:company', this.render);
            },
            render: function () {
                this.$el.text(util.getJob(this.model.toJSON()) || '\u00A0');
                return this;
            }
        });

        point.basicExtend({
            id: 'summary',
            index: 150,
            draw: function (baton) {

                this.append(
                    new FullnameView({ model: baton.model }).render().$el,
                    new JobView({ model: baton.model }).render().$el,
                    $('<nav class="toggle-compact">').append(
                        $('<a href="#" tabindex="1">').click(toggle).text(gt('Extended view')),
                        $.txt(' '),
                        $('<i class="icon-expand-alt">')
                    )
                    //$('<div class="clear">')
                );
            }
        });

        point.basicExtend({
            id: 'final',
            index: 'last',
            draw: function (baton) {
                this.append(
                    $('<nav class="toggle-compact clear">').append(
                        $('<a href="#" tabindex="1">').click(toggle).text(gt('Extended view')),
                        $.txt(' '),
                        $('<i class="icon-expand-alt">')
                    )
                );
            }
        });

        // attachment Drag & Drop
        views.ext.point('io.ox/contacts/edit/dnd/actions').extend({
            id: 'attachment',
            index: 100,
            label: gt('Drop here to upload a <b class="dndignore">new attachment</b>'),
            multiple: function (files, view) {
                // get attachmentList view
                var attachmentList = view.baton.parentView.$el.find('.attachment-list').data('view');
                _(files).each(function (fileData) {
                    attachmentList.addFile(fileData);
                });
            }
        });

        // Edit Actions
        new actions.Action(ref + '/actions/edit/save', {
            id: 'save',
            action: function (baton) {

                // check if attachments are changed
                var view = baton.parentView.$el.find('.attachment-list').data('view');
                if (view && view.isDirty()) {
                    // set temporary indicator so the api knows that attachments needs to be handled even if nothing else changes
                    view.model.set('tempAttachmentIndicator', true);
                }

                baton.parentView.trigger('save:start');

                baton.model.save().then(
                    function success() {
                        baton.parentView.trigger('save:success');
                    },
                    function fail(e) {
                        baton.parentView.trigger('save:fail', e);
                    }
                );
            }
        });

        new actions.Action(ref + '/actions/edit/discard', {
            id: 'discard',
            action: function (options, baton) {
                if (ref === 'io.ox/core/user') {
                    //invoked by sidepopup (portal); uses event of hidden sidebar-close button
                    $('.io-ox-sidepopup').find('[data-action="close"]').trigger('click');
                }
                else
                    options.parentView.$el.find('[data-action="discard"]').trigger('controller:quit');
            }
        });

        new actions.Action(ref + '/actions/edit/reset-image', {
            id: 'imagereset',
            action: function (baton) {
                baton.model.set("image1", '', { validate: true });
                var imageUrl =  ox.base + '/apps/themes/default/dummypicture.png';
                baton.parentView.$el.find('.picture-uploader').css('background-image', 'url(' + imageUrl + ')');
            }
        });

        function drawDefault(options, model) {
            this.append(
                $('<label class="input">').append(
                    $.txt(options.label), $('<br>'),
                    new mini.InputView({ name: options.field, model: model }).render().$el
                )
            );
        }

        function drawTextarea(options, model) {
            this.append(
                $('<label>').append(
                    new mini.TextView({ name: options.field, model: model }).render().$el
                )
            );
        }

        function drawDate(options, model) {
            this.append(
                $('<label class="input">').append(
                    $.txt(options.label), $('<br>'),
                    new mini.DateView({ name: options.field, model: model }).render().$el
                )
            );
        }

        function drawCheckbox(options, model) {
            this.append(
                $('<label class="checkbox">').append(
                    new mini.CheckboxView({ name: options.field, model: model }).render().$el,
                    $.txt(' '),
                    $.txt(options.label)
                )
            );
        }

        function propagateAttachmentChange(model) {
            var folder_id = model.get('folder_id'), id = model.get('id');
            return api.get({ id: id, folder: folder_id }, false)
                .then(function (data) {
                    return $.when(
                        api.caches.get.add(data),
                        api.caches.all.grepRemove(folder_id + api.DELIM),
                        api.caches.list.remove({ id: id, folder: folder_id }),
                        api.clearFetchCache()
                    )
                    .done(function () {
                        // to make the detailview remove the busy animation:
                        api.removeFromUploadList(encodeURIComponent(_.cid(data)));
                        api.trigger('refresh.list');
                    });
                });
        }

        function drawAttachments(options, model, baton) {
            this.append(
                baton.$.form = $('<form>').append(
                    new attachmentViews.ListView({
                        model: model,
                        module: 7,
                        changeCallback: propagateAttachmentChange
                    }).render().$el,
                    new attachmentViews.UploadView({ model: model }).render().$el
                )
            );
        }

        var index = 400,
            draw = {
                birthday: drawDate,
                anniversary: drawDate,
                note: drawTextarea,
                private_flag: drawCheckbox,
                attachments_list: drawAttachments
            };

        // loop over all sections (personal, messaging, phone etc.)
        // to get list of relevant fields per section
        _(meta.sections).each(function (fields, id) {

            // create new "block" extension
            ext.point(ref + '/edit').extend({
                id: id,
                index: index += 100,
                draw: function (baton) {

                    // a block has a fixed width and floats left
                    var block = $('<div class="block">')
                        .attr('data-id', id)
                        .append($('<legend>').text(meta.i18n[id]));

                    if (id === 'attachments') block.addClass('double-block');

                    // draw fields inside block
                    ext.point(ref + '/edit/' + id).invoke('draw', block, baton);

                    // only add if block contains at least one paragraph with content
                    if (block.children('p.has-content, p.always').length > 0) {
                        this.append(block);
                    }
                }
            });

            // create extensions for each field
            _(fields).each(function (field, index) {

                ext.point(ref + '/edit/' + id).extend({
                    id: field,
                    index: 100 + index * 100,
                    draw: function (baton) {

                        var value = baton.model.get(field),
                            isAlwaysVisible = _(meta.alwaysVisible).indexOf(field) > -1,
                            isRare = _(meta.rare).indexOf(field) > -1,
                            hasContent = !!value,
                            paragraph,
                            options = {
                                index: index,
                                field: field,
                                label: model.fields[field],
                                value: value
                            };

                        paragraph = $('<p>')
                            .attr('data-field', field)
                            .addClass(
                                'field' +
                                (isAlwaysVisible ? ' always' : '') +
                                (hasContent ? ' has-content' : '') +
                                (isRare ? ' rare' : '')
                            );

                        // call requires "draw" method
                        (draw[field] || drawDefault).call(paragraph, options, baton.model, baton);

                        this.append(paragraph);
                    }
                });
            });
        });

        return ContactEditView;
    }

    var ContactEditView = createContactEdit('io.ox/contacts');

    return {
        ContactEditView: ContactEditView,
        protectedMethods: {
            createContactEdit: createContactEdit
        }
    };

});
