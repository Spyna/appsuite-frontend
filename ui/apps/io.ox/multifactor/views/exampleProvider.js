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
 * @author Greg Hill <greg.hill@open-xchange.com>
 */

define('io.ox/multifactor/views/exampleProvider', [
    'io.ox/backbone/views',
    'io.ox/core/extensions',
    'io.ox/backbone/mini-views',
    'io.ox/backbone/views/modal',
    'io.ox/multifactor/views/constants'
], function (views, ext, mini, ModalView, constants) {

    'use strict';

    var POINT = 'multifactor/views/exampleProvider',
        INDEX = 0;

    var dialog;
    var def;

    function open(provider, device, challenge, _def, error) {
        dialog = openModalDialog(provider, device, challenge, error);
        def = _def;
        return dialog;
    }

    function openModalDialog(provider, device, challenge, error) {

        return new ModalView({
            async: true,
            point: POINT,
            title: constants.AuthenticationTitle,
            width: 640,
            enter: 'OK',
            className: constants.AuthDialogClass,
            model: new Backbone.Model({ provider: provider,
                deviceId: device.id,
                challenge: challenge,
                error: error
            })
        })
        .build(function () {
        })
        .addCancelButton()
        .addButton({ label: constants.OKButton, action: 'OK' })
        .addAlternativeButton({ label: constants.LostButton, action: 'lost', className: device.backupDevice ? 'hidden' : 'btn-default' })
        .on('OK', function () {
            var response = $('#verification').val();
            if (response && response !== '') {
                var resp = {
                    response: response,
                    id: device.id,
                    provider: provider
                };
                def.resolve(resp);
            } else {
                def.reject();
            }
            if (dialog) dialog.close();
        })
        .on('cancel', function () {
            def.reject();
        })
        .on('open', function () {
            _.defer(function () {
                $('#verification').focus();
            });
        })
        .on('lost', function () {
            dialog.close();
            require(['io.ox/multifactor/lost'], function (lost) {
                lost(def);
            });
        })
        .open();
    }

    ext.point(POINT).extend(
        {
            index: INDEX += 100,
            id: 'help',
            render: function () {
                var label = $('<p style="multifactor-help">').append('This is an example device only.  This is where additional instructions would be provided.')
                .append('<br>');
                this.$body.append(
                    label
                );
            }
        },
        {
            index: INDEX += 100,
            id: 'header',
            render: function () {
                var label = $('<label for="verification">').append('Please enter the example verification code (0815)')
                .append('<br>');
                this.$body.append(
                    label
                );
            }
        },
        {
            index: INDEX += 100,
            id: 'selection',
            render: function () {
                var input = $('<input type="text" id="verification">');
                var selection = $('<div class="multifactorAuthDiv">')
                .append(input);
                this.$body.append(selection);
            }
        },
        {
            index: INDEX += 100,
            id: 'error',
            render: function (baton) {
                var error = baton.model.get('error');
                if (error && error.text) {
                    var label = $('<label class="multifactorError">').append(error.text);
                    this.$body.append(label);
                }
            }
        }

    );

    return {
        open: open
    };

});
