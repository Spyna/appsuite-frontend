/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2012
 * Mail: info@open-xchange.com
 *
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */
define('io.ox/mail/autoforward/settings/model',
      ['io.ox/backbone/modelFactory',
       'io.ox/backbone/validation',
       'io.ox/core/api/mailfilter',
       'gettext!io.ox/mail'
       ], function (ModelFactory, Validators, api, gt) {

    'use strict';

    function providePreparedData(attributes) {
        var preparedData = {
                "flags": ["autoforward"],
                "test": {
                    "headers": ["To"],
                    "id": "header",
                    "values": [attributes.userMainEmail],
                    "comparison": "is"
                },
                "actioncmds": [
                    {
                        "to": attributes.forwardmail,
                        "id": "redirect"
                    },
                    {
                        "id": "stop"
                    }
                ],
                "rulename": "autoforward",
                "active": attributes.active ? true : false
            };
        if (attributes.id) {
            preparedData.id = attributes.id;
        }

        return preparedData;
    }

    function buildFactory(ref, api) {
        var factory = new ModelFactory({
            api: api,
            ref: ref,

            update: function (model) {
                if (model.attributes.forwardmail === '') {
                    return api.deleteRule(model.attributes.id);
                } else {
                    return api.update(providePreparedData(model.attributes));
                }
            },
            create: function (model) {
                return api.create(providePreparedData(model.attributes));
            }

        });

        Validators.validationFor(ref, {
            forwardmail: {  format: 'email' },
            active: { format: 'boolean' }
        });
        return factory;

    }

    var fields = {
        headline: gt('Auto Forward'),
        forwardmail: gt('Target mail address'),
        active: gt('active')
    };

    return {
        api: api,
        fields: fields,
        protectedMethods: {
            buildFactory: buildFactory
        }
    };
});

