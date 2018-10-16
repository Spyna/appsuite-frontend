/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2017 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Frank Paczynski <frank.paczynski@open-xchange.com>
 */

define('io.ox/core/export', [
    'io.ox/backbone/views/modal',
    'io.ox/backbone/mini-views/common',
    'io.ox/core/download',
    'gettext!io.ox/core'
], function (ModalDialog, miniViews, download, gt) {

    'use strict';

    function getFormats(module) {
        var list = [];
        switch (module) {
            case 'calendar':
            case 'tasks':
                list.push({ value: 'ical', label: gt('iCalendar') });
                break;
            case 'contacts':
                list.push({ value: 'vcard', label: gt('vCard') });
                list.push({ value: 'csv', label: gt('CSV') });
                break;
            default:
                break;
        }
        return list;
    }

    var references = {
        'calendar': 'ox.appsuite.user.sect.calendar.manage.export.html',
        'contacts': 'ox.appsuite.user.sect.contacts.manage.export.html',
        'tasks':    'ox.appsuite.user.sect.tasks.manage.export.html'
    };

    return {

        /**
        * params:
        * - folder OR
        * - list of { id, folder_id }
        */

        open: function (module, params) {

            return new ModalDialog({
                enter: false,
                maximize: 500,
                point: 'io.ox/core/export',
                title: params.folder ? gt('Export folder') : /*#. export selected items (folders), title of a dialog */gt('Export selected'),
                model: new Backbone.Model(),
                // custom
                module: module,
                params: params,
                help: references[module]
            }).extend({
                'setup': function (baton) {
                    // apply default value
                    baton.formats = getFormats(this.options.module);
                    this.model.set('format', (_.first(baton.formats) || {}).value);
                    // apply visuals
                    this.$el.addClass('export-dialog')
                            .find('.modal-content').css('height', 'auto');
                },
                'single-format': function (baton) {
                    if (baton.formats.length !== 1) return;

                    // informative
                    this.$body.append(
                        $('<p>').append(
                            //#. Warning dialog
                            //#. %1$s is file format for data export
                            gt('Format: %1$s', _.first(baton.formats).label)
                        )
                    );
                },
                'multi-format': function (baton) {
                    if (baton.formats.length < 2) return;
                    var guid = _.uniqueId('form-control-label-');
                    // options
                    this.$body.append(
                        $('<label>').attr('for', guid).append(
                            //#. file format for data export
                            $.txt(gt('Format')),
                            new miniViews.CustomRadioView({
                                id: guid,
                                model: this.model,
                                name: 'format',
                                list: baton.formats
                            }).render().$el
                        )
                    );
                },
                'missing-format': function (baton) {
                    if (baton.formats.length) return;
                    this.$body.append(gt('No export format available'));
                    this.$footer.find('button[data-action="export"]')
                        .attr('disabled', true)
                        .addClass('disabled');
                },
                'distribution-lists': function () {
                    if (this.options.module !== 'contacts') return;

                    // preselect
                    this.model.set('include', true);

                    // hide option in case exclusively distributions lists are selected
                    var singleContacts = _(this.options.params.list).filter(function (obj) { return !obj.mark_as_distributionlist; });
                    if (!this.options.params.folder && !singleContacts.length) return;

                    this.$body.append(
                        new miniViews.CustomCheckboxView({
                            name: 'include',
                            model: this.model,
                            label: gt('Include distribution lists')
                        }).render().$el
                    );

                },
                'inital-focus': function () {
                    this.options.focus = this.$body.find('input').length > 1 ? 'input:first' : '.btn-primary';
                }
            }).on({
                'export': function () {
                    var params = _.extend({}, this.options.params, this.model.toJSON());
                    download.exported(params);
                }
            })
            .addCancelButton()
            .addButton({ label: gt('Export'), action: 'export' })
            .open();
        }
    };
});
