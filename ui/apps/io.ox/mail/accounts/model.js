/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2012 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 */

define('io.ox/mail/accounts/model',
    ['io.ox/core/extensions',
     'io.ox/keychain/model',
     'io.ox/core/api/account',
     'io.ox/core/api/folder',
     'gettext!io.ox/mail/accounts/settings'
    ], function (ext, keychainModel, AccountAPI, folderAPI, gt) {

    'use strict';

    var AccountModel = keychainModel.Account.extend({

        defaults: {
            //some conditional defaults defined in view-form.render (pop3)
            spam_handler: 'NoSpamHandler'
        },

        validation: {
            name: {
                required: true,
                msg: gt('The account must be named')
            },
            primary_address: [
                {
                    required: true,
                    msg: gt('This field has to be filled')
                }, {
                    fn: _.noI18n('isMailAddress')
                }
            ],
            mail_server: {
                required: true,
                msg: gt('This field has to be filled')
            },
            mail_port: {
                required: true,
                msg: gt('This field has to be filled')
            },
            login: function (value) {
                //for setups without any explicit login name for primary account
                if (this.attributes.id !== 0 && $.trim(value) === '')
                    return gt('This field has to be filled');
            },
            transport_server: {
                required: true,
                msg: gt('This field has to be filled')
            },
            transport_port: {
                required: true,
                msg: gt('This field has to be filled')
            }
        },
        isMailAddress: function (newMailaddress) {
            // var regEmail = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/.test(newMailaddress);

            // var regEmail = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i.test(newMailaddress);

            // Above examples would work partially for most adresses but do not cover all RFCs.
            // We should consider using something like this: https://code.google.com/p/isemail/
            // For now validation checks only if there is an @.

            // See also io.ox/backbone/validation.js

            var regEmail = /\@/.test(newMailaddress);

            if (!regEmail) {
                return gt('This is not a valid email address');
            }
        },

        initialize: function () {

        },

        validationCheck: function (data, options) {

            data = _.extend({
                unified_inbox_enabled: false,
                transport_credentials: false
            }, data);

            data.name = data.personal = data.primary_address;

            return AccountAPI.validate(data, options);
        },

        save: function (obj, defered) {
            var that = this;
            //TODO: refactor, so no deferred object is needed here and API response is
            // returned directly
            if (!defered) {
                defered = $.Deferred();
            }

            if (this.attributes.id !== undefined) {
                var fill_attributes = this.attributes,
                    mods;

                //don’t send passwords if not changed
                if (!fill_attributes.password) { delete fill_attributes.password; }
                if (!fill_attributes.transport_password) { delete fill_attributes.transport_password; }

                mods = _.extend(this.changed, fill_attributes);
                if (this.attributes.id === 0) {//primary mail account only allows editing of display name and unified mail
                    mods = {
                            id: that.attributes.id,
                            personal: that.attributes.personal,
                            unified_inbox_enabled: that.attributes.unified_inbox_enabled
                        };
                }
                return AccountAPI.update(mods).done(function (response) {
                    folderAPI.folderCache.remove('default' + that.attributes.id);
                    return defered.resolve(response);
                }).fail(function (response) {
                    return defered.reject(response);
                });
            } else {
                if (obj) {

                    obj = _.extend({
                        unified_inbox_enabled: false,
                        transport_credentials: false
                    }, obj);

                    obj.name = obj.personal = obj.primary_address;
//                    obj.name = obj.primary_address;

                    this.attributes = obj;
                    this.attributes.spam_handler = 'NoSpamHandler';
                }
                return AccountAPI.create(this.attributes).done(function (response) {
                    return defered.resolve(response);
                }).fail(function (response) {
                    return defered.reject(response);
                });
            }

        },

        destroy: function () {
            AccountAPI.remove([this.attributes.id]);
        }

    });

    return AccountModel;

});
