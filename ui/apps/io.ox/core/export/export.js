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
 * @author Frank Paczynski <frank.paczynski@open-xchange.com>
 */

define('io.ox/core/export/export', [
    'io.ox/core/extensions',
    'io.ox/core/tk/dialogs',
    'io.ox/core/api/export',
    'io.ox/core/folder/api',
    'io.ox/core/notifications',
    'io.ox/formats/vcard',
    'gettext!io.ox/core'
], function (ext, dialogs, api, folderAPI, notifications, vcard, gt) {

    'use strict';

    /**
     * @description header: title
     */
    ext.point('io.ox/core/export/export/title').extend({
        id: 'default',
        draw: function () {
            this.append(
                $('<h4>').text(gt('Export folder'))
            );
        }
    });

    /**
     * @description body: select
     */
    ext.point('io.ox/core/export/export/select').extend({
        id: 'default',
        index: 100,
        draw: function (baton) {

            this.append(
                $('<div class="form-group">').append(
                    $('<label for="export-format">').text(gt('Format')),
                    baton.$.select = $('<select id="export-format" class="form-control">')
                        .attr('aria-label', gt('select format'))
                )
            );

            // add options
            ext.point('io.ox/core/export/export/format').invoke('draw', baton.$.select, baton);
        }
    });

    function toggle(format) {
        var checkbox = this.find('.include_distribution_lists input');
        if (format === 'csv') {
            checkbox.prop('checked', 'checked');
        } else {
            checkbox.prop('checked', null);
        }
    }

    ext.point('io.ox/core/export/export/select').extend({
        id: 'checkbox',
        index: 200,
        draw: function (baton) {

            if (baton.module !== 'contacts') return;
            var guid = _.uniqueId('form-control-label-');
            this.append(
                $('<div class="form-group">').append(
                    // checkbox
                    $('<label class="checkbox include_distribution_lists">').attr('for', guid).append(
                        baton.$.include = $('<input type="checkbox" name="include_distribution_lists" checked="checked">').attr('id', guid),
                        $.txt(gt('Include distribution lists'))
                    )
                )
            );

            this.find('select').on('change', function () {
                toggle.call($(this).closest('.modal-body'), $(this).val());
            });

            toggle.call(this, this.find('select').val());
        }
    });

    /**
     * @description footer: buttons
     */
    ext.point('io.ox/core/export/export/buttons').extend({
        id: 'default',
        draw: function () {
            this.addPrimaryButton('export', gt('Export'), 'export')
                .addButton('cancel', gt('Cancel'), 'cancel');
        }
    });

    /**
     * @description format: csv
     */
    ext.point('io.ox/core/export/export/format').extend({
        id: 'csv',
        index: 100,
        draw: function (baton) {
            if (baton.module === 'contacts') this.append($('<option value="csv">CSV</option>'));
        }
    });

    /**
     * @description format: vcard
     */
    ext.point('io.ox/core/export/export/format').extend({
        id: 'vcard',
        index: 200,
        draw: function (baton) {
            if (baton.module === 'contacts') this.append($('<option value="vcard">vCard</option>'));
        }
    });

    /**
     * @description format: ical
     */
    ext.point('io.ox/core/export/export/format').extend({
        id: 'ical',
        index: 400,
        draw: function (baton) {
            if (baton.module === 'calendar' || baton.module === 'tasks') this.append($('<option value="ical">iCalendar</option>'));
        }
    });

    return {
        show: function (module, id) {
            var folder = String(id),
                dialog = new dialogs.ModalDialog({ width: 500 }),
                baton = new ext.Baton({ module: module, folder: folder });
            // get folder and build dialog
            folderAPI.get(folder).done(function () {
                dialog
                    .build(function () {
                        //header
                        ext.point('io.ox/core/export/export/title').invoke('draw', this.getHeader(), baton);
                        //body
                        ext.point('io.ox/core/export/export/select').invoke('draw', this.getContentNode(), baton);
                        //buttons
                        ext.point('io.ox/core/export/export/buttons').invoke('draw', this, baton);
                        //apply style
                        this.getPopup().addClass('export-dialog');
                    })
                    .show(function () {
                        //focus
                        this.find('select').focus();
                    })
                    .done(function (action) {
                        if (action === 'export') {
                            var format = baton.$.select.val() || '',
                                include = (baton.$.include || $()).prop('checked') || false,
                                options = $.extend({ include: include }, baton.options);

                            require(['io.ox/core/download'], function (download) {
                                download.url(api.getURL(format, baton.folder, options));
                            });
                        } else {
                            dialog = null;
                        }
                    });
            });
        }
    };

});
