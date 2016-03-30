/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2016 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Edy Haryono <edy.haryono@open-xchange.com>
 */
define('io.ox/mail/actions/viewer', [
    'io.ox/core/viewer/main'
], function (Viewer) {

    'use strict';

    return function (data) {
        var viewer = new Viewer();
        // disable file details: data unavailbale for mail attachments
        viewer.launch(_.extend({ opt: { disableFolderInfo: true, disableFileDetail: true } }, data));
    };
});
