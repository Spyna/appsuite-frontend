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
 * @author Richard Petersen <richard.petersen@open-xchange.com>
 */

define('io.ox/mail/compose/config', [
    'settings!io.ox/mail',
    'io.ox/mail/compose/signatures'
], function (settings, signatureUtil) {

    'use strict';

    console.log(settings);

    return Backbone.Model.extend({

        defaults: function () {
            return {
                // enable auto-remove on "discard"
                autoDiscard: true,
                autosavedAsDraft: false,
                // Autodismiss confirmation dialog
                autoDismiss: false,
                preferredEditorMode: _.device('smartphone') ? 'html' : settings.get('messageFormat', 'html'),
                editorMode: _.device('smartphone') ? 'html' : settings.get('messageFormat', 'html'),
                sendDisplayName: !!settings.get('sendDisplayName', true)
            };
        },

        initialize: function () {
            // TODO:
            // setInitialSignature
            // getDefaultSignature
            // getSignatureById
            // getSignatures
            _.extend(this, signatureUtil.model, this);

            // map 'alternative' to editor
            if (this.get('preferredEditorMode') === 'alternative') {
                this.set('editorMode', 'html', { silent: true });
                if (this.get('content_type') === 'text/plain') {
                    this.set('editorMode', 'text', { silent: true });
                }
            }
        },

        dirty: function (/*flag*/) {
            // TODO
            // var previous = !_.isEqual(this._shadowAttributes, this.getCopy()),
            //     current;
            // // sync mail editor content to model
            // this.trigger('needsync');
            // if (flag === true) {
            //     // always dirty this way
            //     this._shadowAttributes = {};
            // } else if (flag === false) {
            //     this.updateShadow();
            // }
            // current = !_.isEqual(this._shadowAttributes, this.getCopy());
            // if (!current && previous) {
            //     // model changed to not dirty force next restorepoint save to have up to date data
            //     this.forceNextFailSave = true;
            // }
            // previous = null;
            // return current;
        }

    });

});
