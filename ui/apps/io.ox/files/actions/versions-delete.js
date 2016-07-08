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

define('io.ox/files/actions/versions-delete', [
    'io.ox/files/api',
    'io.ox/core/tk/dialogs',
    'gettext!io.ox/files'
], function (api, dialogs, gt) {

    'use strict';

    return function (data) {
        new dialogs.ModalDialog()
            .text(gt.pgettext('One file only', 'Do you really want to delete this version?'))
            .addPrimaryButton('delete', gt('Delete version'), 'delete', { 'tabIndex': '1' })
            .addButton('cancel', gt('Cancel'), 'cancel', { 'tabIndex': '1' })
            .on('delete', function () {
                api.versions.remove(data);
            })
            .show();
    };
});
