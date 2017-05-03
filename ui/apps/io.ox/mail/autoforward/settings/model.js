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
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */
define('io.ox/mail/autoforward/settings/model', [
    'io.ox/backbone/modelFactory',
    'io.ox/backbone/validation',
    'io.ox/core/api/mailfilter',
    'io.ox/settings/util',
    'gettext!io.ox/mail'
], function (ModelFactory, Validators, api, settingsUtil, gt) {

    'use strict';

    function providePreparedData(attributes) {
        if (!attributes.forwardmail) {
            return {};
        }
        var preparedData = {
            'rulename': 'autoforward',

            'position': attributes.position,

            'test': {
                'id': 'true'
            },
            'actioncmds': [{
                'id': 'redirect',
                'to': attributes.forwardmail
            }],
            'flags': ['autoforward'],
            'active': !!attributes.active
        };
        if (attributes.keep) {
            preparedData.actioncmds[0].copy = true;
        }

        if (!attributes.processSub) {
            preparedData.actioncmds.push({ id: 'stop' });
        }

        //first rule gets 0
        if (!_.isUndefined(attributes.id) && !_.isNull(attributes.id)) {
            preparedData.id = attributes.id;
        }

        return preparedData;

    }

    function buildFactory(ref, api) {
        var factory = new ModelFactory({
            api: api,
            ref: ref,
            model: {
                idAttribute: 'id'
            },
            update: function (model) {
                //make the active element lose focus to get the changes of the field a user was editing
                $(document.activeElement).blur();
                if (model.attributes.forwardmail === '') {
                    return settingsUtil.yellOnReject(
                        api.deleteRule(model.attributes.id)
                    );
                }
                return settingsUtil.yellOnReject(
                    api.update(providePreparedData(model.attributes))
                );
            },
            create: function (model) {
                //make the active element lose focus to get the changes of the field a user was editing
                $(document.activeElement).blur();

                return settingsUtil.yellOnReject(
                    api.create(providePreparedData(model.attributes))
                );
            }

        });

        return factory;

    }

    var fields = {
        headline: gt('Auto Forward'),
        forwardmail: gt('Forward all incoming emails to this address'),
        active: gt('Enable'),
        keep: gt('Keep a copy of the message'),
        processSub: gt('Process subsequent rules')
    };

    return {
        api: api,
        fields: fields,
        protectedMethods: {
            buildFactory: buildFactory
        }
    };
});
