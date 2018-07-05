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
 * @author David Bauer <david.bauer@open-xchange.com>
 */

define('io.ox/files/share/model', [
    'io.ox/files/share/api',
    'io.ox/core/yell',
    'gettext!io.ox/core'
], function (api, yell, gt) {

    'use strict';

    var WizardShare = Backbone.Model.extend({

        defaults: function () {
            return {
                files: [],
                recipients: [],
                message: '',
                edit: false,
                secured: false,
                password: '',
                temporary: false,
                expires: 2,
                url: '',
                is_new: false,
                includeSubfolders: true // see SoftwareChange Request SCR-97: [https://jira.open-xchange.com/browse/SCR-97]
            };
        },

        idAttribute: 'entity',

        initialize: function () {
            this.setOriginal();
        },

        setOriginal: function (data) {
            this.originalAttributes = data || _.clone(this.attributes);
        },

        getChanges: function () {
            var original = this.originalAttributes, changes = {};
            _(this.attributes).each(function (val, id) {
                if (!_.isEqual(val, original[id])) {
                    changes[id] = val;
                }
            });
            // limit to relevant attributes
            return _(changes).pick('expiry_date', 'includeSubfolders', 'password', 'temporary', 'secured');
        },

        hasChanges: function () {
            return !_.isEmpty(this.getChanges());
        },

        getExpiryDate: function () {
            var now = moment();
            switch (this.get('expires')) {
                case 0:
                    return now.add(1, 'day').valueOf();
                case 1:
                    return now.add(1, 'week').valueOf();
                case 2:
                    return now.add(1, 'month').valueOf();
                case 3:
                    return now.add(3, 'months').valueOf();
                case 4:
                    return now.add(6, 'months').valueOf();
                case 5:
                    return now.add(1, 'year').valueOf();
                default:
                    return now.add(1, 'month').valueOf();
            }
        },

        toJSON: function () {

            // default invite data
            var targets = [],
                data = {};

            // collect target data
            _(this.get('files')).each(function (item) {
                var target = {
                    // this model is used by folders from other applications as well
                    module: item.get('module') || 'infostore'
                };
                if (item.isFolder()) {
                    target.folder = item.get('id');
                }
                if (item.isFile()) {
                    target.folder = item.get('folder_id');
                    target.item = item.get('id');
                }
                targets.push(target);
            });

            // special data for `getLink` request
            data = targets[0];

            data.includeSubfolders = this.get('includeSubfolders');

            if (this.get('secured') && this.get('password') !== '') {
                data.password = this.get('password');
            } else {
                data.password = null;
            }

            // collect recipients data
            data.recipients = [];
            _(this.get('recipients')).each(function (recipientModel) {
                // model values might be outdated (token edit) so we act like mail compose
                data.recipients.push([
                    recipientModel.get('token').label || recipientModel.getDisplayName(),
                    recipientModel.get('token').value || recipientModel.getTarget()
                ]);
            });
            if (data.recipients.length === 0) {
                delete data.recipients;
            }

            if (this.get('message') && this.get('message') !== '') {
                data.message = this.get('message');
            }

            // create or update ?
            if (!this.has('url')) return data;

            if (this.get('temporary')) {
                data.expiry_date = this.getExpiryDate();
            } else {
                data.expiry_date = null;
            }

            return data;
        },

        sync: function (action, model) {
            var self = this;
            switch (action) {
                case 'read':
                    return api.getLink(this.toJSON()).then(function (result) {
                        var data = result.data,
                            timestamp = result.timestamp;
                        // see SoftwareChange Request SCR-97: [https://jira.open-xchange.com/browse/SCR-97]
                        //
                        // api call returns e.g.
                        //
                        // data : {
                        //     entity              : 51
                        //     is_new              : true
                        //     includeSubfolders   : false
                        //     url                 : "http://192.168.56.104/ajax/share/00d5202f00d9bd750d5202e0d9bd469e91c3683567561468/1/8/MjUw"
                        // }
                        // SCR-97: BREAKPOINT one line beneath for debugging
                        self.set(_.extend(data, { lastModified: timestamp }), { '_inital': true });

                        //  - Searching for why new data fields like `includeSubfolders` could not be saved persistently finally
                        //    led to `self.setOriginal()` that does not set the original `data` object 3 lines above at all.
                        //  - The fallback of `self.setOriginal` ... `this.originalAttributes = data || _.clone(this.attributes);`
                        //    in this case is misleading for it's false safety.
                        //  - Though it's obvious now, finding this single source of misbehavior has consumed more than 1 day.
                        //
                        // self.setOriginal(data);  // ... and it DOES even work as expected (always triggers a server call, even
                        //                          // though no data got changed), but it is useless due to an entirely corrupted
                        //                          // model ... thus `self.setOriginal();` will remain but the next step has to be
                        //                          // hacking `this.originalAttributes`.
                        //
                        self.setOriginal();

                        if ('includeSubfolders' in data) {
                            self.originalAttributes.includeSubfolders = data.includeSubfolders;
                        }
                        return data.url;
                    }).fail(function (error) {
                        yell(error);
                        self.trigger('error:sync', 'read', error);
                    });
                case 'update':
                case 'create':
                    var changes = self.getChanges(),
                        data = model.toJSON();
                    // set password to null if password protection was revoked
                    if (changes.secured === false) {
                        data.password = null;
                    } else if (!('password' in changes)) {
                        // remove password from data unless it has changed
                        delete data.password;
                    }
                    // update only if there are relevant changes
                    //
                    // SCR-97: BREAKPOINT one line beneath for debugging
                    return (_.isEmpty(changes) ? $.when() : api.updateLink(data, model.get('lastModified')))
                        .done(this.send.bind(this))
                        .fail(function (error) {
                            yell(error);
                            self.trigger('error:sync', 'update', error);
                        });
                // no default
            }
        },

        // SCR-97: BREAKPOINT one line beneath for debugging
        send: function () {
            if (_.isEmpty(this.get('recipients'))) return;
            api.sendLink(this.toJSON()).fail(yell);
        },

        validate: function (attr, options) {
            // special case: bug 53466
            if (options._event === 'change') return;
            if (attr.secured === true && _.isEmpty(attr.password)) {
                return gt('Please set password');
            }
        }
    });

    return {
        WizardShare: WizardShare
    };
});
