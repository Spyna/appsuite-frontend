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
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */

define('plugins/portal/quota/register', [
    'io.ox/core/extensions',
    'gettext!plugins/portal',
    'io.ox/core/api/quota',
    'io.ox/core/capabilities',
    'settings!io.ox/core',
    'io.ox/backbone/mini-views/quota',
    'less!plugins/portal/quota/style'
], function (ext, gt, api, capabilities, settings, QuotaView) {

    'use strict';

    var loadTile = function () {
        api.requestFileQuotaUpdates();
        return api.load();
    };

    var availableQuota = function (quota) {

        var fields = [];
        if (settings.get('quotaMode', 'default') === 'unified' || capabilities.has('infostore')) {
            fields.push({
                module: 'file',
                quota: quota.file.quota,
                usage: quota.file.use,
                name: 'memory-file',
                title: settings.get('Mode', 'default') === 'unified' ? gt('Overall quota') : gt('File quota')
            });
        }

        if (settings.get('quotaMode', 'default') === 'default' && capabilities.has('webmail')) {
            fields.push({
                module: 'mail',
                quota: quota.mail.quota,
                usage: quota.mail.use,
                name: 'memory-mail',
                title: gt('Mail quota')
            });
            fields.push({
                module: 'mail',
                quota: quota.mail.countquota,
                usage: quota.mail.countuse,
                quotaField: 'countquota',
                usageField: 'countuse',
                renderUnlimited: false,
                name: 'mailcount',
                title: gt('Mail count quota'),
                sizeFunction: function (name) {
                    return name;
                }
            });
        }

        return _(fields).select(function (q) {
            //must check against undefined otherwise 0 values would lead to not displaying the quota. See Bug 25110
            return (q.quota !== undefined && q.usage !== undefined);
        });
    };

    var drawTile = function (quota) {
        this.append(
            $('<ul class="content no-pointer list-unstyled">').append(
                _(availableQuota(quota)).map(function (q) {
                    return new QuotaView(_.extend({
                        tagName: 'li',
                        className: 'paragraph'
                    }, q)).render().$el;
                })
            )
        );
    };

    var load = function () {
        return $.Deferred().resolve();
    };

    var draw = function () {
        return $.Deferred().resolve();
    };

    ext.point('io.ox/portal/widget/quota').extend({
        title: gt('Quota'),
        load: load,
        draw: draw,
        hideSidePopup: true,
        preview: function () {
            var self = this;
            return loadTile().done(function (quota) {
                drawTile.call(self, quota);
            });
        }
    });

    ext.point('io.ox/portal/widget/quota/settings').extend({
        title: gt('Quota'),
        type: 'quota',
        editable: false,
        unique: true
    });
});
