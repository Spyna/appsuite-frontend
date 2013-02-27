/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2013 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/upsell',
    ['io.ox/core/capabilities',
     'settings!io.ox/core',
     'gettext!io.ox/core'], function (capabilities, settings, gt) {

    'use strict';

    function showUpgradeDialog() {
        require(['io.ox/core/tk/dialogs'], function (dialogs) {
            new dialogs.ModalDialog({ easyOut: true })
                .build(function () {
                    this.getHeader().append(
                        $('<h4>').text(gt('Upgrade required'))
                    );
                    this.getContentNode().append(
                        $.txt(gt('This feature is not available. In order to use it, you need to upgrade your account now.')),
                        $.txt(' '),
                        $.txt(gt('The first 90 days are free.'))
                    );
                    this.addPrimaryButton('upgrade', gt('Get free upgrade'));
                    this.addButton('cancel', gt('Cancel'));
                })
                .setUnderlayStyle({
                    opacity: 0.70,
                    backgroundColor: '#08C'
                })
                .on('upgrade', function () {
                    ox.trigger('upsell:upgrade');
                })
                .on('show', function () {
                    ox.off('upsell:requires-upgrade', showUpgradeDialog);
                })
                .on('close', function () {
                    ox.on('upsell:requires-upgrade', showUpgradeDialog);
                })
                .show();
        });
    }

    function upgrade() {
        // needs no translation; just for demo purposes
        alert('User decided to upgrade! (global event: upsell:upgrade)');
    }

    // local copy for speed
    var enabled = settings.get('upsell/enabled') || {},
        capabilityCache = {},
        enabledCache = {};

    var that = {

        // convenience functions
        trigger: function () {
            ox.trigger('upsell:requires-upgrade');
        },

        // simple click handler
        click: function (e) {
            e.preventDefault();
            that.trigger();
        },

        // find one set of capabilities that matches
        any: function (array) {
            return _(array).reduce(function (memo, c) {
                return memo || c === undefined || that.has(c);
            }, false);
        },

        // bypass for convenience
        has: function (string) {
            if (!string) return true;
            // check cache
            if (string in capabilityCache) return capabilityCache[string];
            // lookup
            return (capabilityCache[string] = capabilities.has(string));
        },

        // checks if something should be visible depending on required capabilites
        // true if any item matches requires capabilites
        // true if any item does not match its requirements but is enabled for upsell
        // this function is used for any inline link, for example, to decide whether or not showing it
        visible: function (array) {
            if (!array) return true;
            return _([].concat(array)).reduce(function (memo, capability) {
                return memo || capability === undefined || that.enabled(capability) || that.has(capability);
            }, false);
        },

        // checks if upsell is enabled for a set of capabilities
        // true if at least one set matches
        enabled: (function () {

            function lookup(memo, capability) {
                return memo && capability in enabled;
            }

            // checks if upsell is enabled for a single capability or
            // multiple space-separated capabilities; example: isEnabled('infostore');
            function isEnabled(string) {
                if (!_.isString(string)) return false;
                // check cache
                if (string in enabledCache) return enabledCache[string];
                // lookup
                return (enabledCache[string] = _(string.split(' ')).reduce(lookup, true));
            }

            function reduce(memo, capability) {
                return memo || isEnabled(capability);
            }

            return function (array) {
                if (!array) return true;
                return _([].concat(array)).reduce(reduce, false);
            };

        }()),

        captureRequiresUpgrade: function () {
            ox.on('upsell:requires-upgrade', showUpgradeDialog);
            that.captureRequiresUpgrade = $.noop;
        },

        captureUpgrade: function () {
            ox.on('upsell:upgrade', upgrade);
            that.captureUpgrade = $.noop;
        },

        useDefaults: function () {
            that.captureRequiresUpgrade();
            that.captureUpgrade();
        },

        // helpful if something goes wrong
        debug: function () {
            console.debug('enabled', enabled, 'capabilityCache', capabilityCache, 'enabledCache', enabledCache);
        },

        // just for demo purposes
        demo: function () {
            var e = enabled, c = capabilityCache;
            e.portal = e.webmail = e.contacts = e.calendar = e.infostore = e.tasks = true;
            c.portal = c.webmail = c.contacts = true;
            c.calendar = c.infostore = c.tasks = false;
            console.debug('Disabled inline actions regarding calendar, tasks, and files; enabled upsell instead');
            that.useDefaults();
            require(['io.ox/portal/widgets'], function (widgets) {
                widgets.addPlugin('plugins/portal/upsell/register');
                widgets.add('upsell', { color: 'gray', inverse: true });
                console.debug('Added upsell widget to portal');
            });
        }
    };

    (function () {

        var hash = _.url.hash('demo') || '';
        if (hash.indexOf('upsell') > -1) {
            that.demo();
        }

    }());

    return that;

});
