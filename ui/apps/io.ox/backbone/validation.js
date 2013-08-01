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
 */
define("io.ox/backbone/validation", ["io.ox/core/extensions", 'gettext!io.ox/backbone/validation'], function (ext, gt) {
    "use strict";

    // var regEmail = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;

    var regEmail = /\@\S/; // See also io.ox/mail/accounts/model.js
    
    var emptycheck  = function (value) {
        return (_.isUndefined(value) || value === null || value === '');
    };

    var formats = {
        string: function (val) {
            // always true!
            return true;
        },
        text: function () {
            return true;
        },
        number: function (val) {
            var isValid = (emptycheck(val)) || //empty value is valid (if not, add the mandatory flag)
                          (!isNaN(parseFloat(val, 10)) &&  //check if its a number
                          (parseFloat(val, 10).toString().length === val.toString().length));//check if parseFloat did not cut the value (1ad2 would be made to 1 without error)
            return isValid ||
                'Please enter a valid number';
        },
        array: function (val) {
            return _.isArray(val) ||
                'Please enter a valid array';
        },
        boolean: function (val) {
            return _.isBoolean(val) ||
                'Please enter a bool';
        },
        date: function (val) {
            // val: timestamp
            // tasks allows null values to remove a date. Calendar must have start and end date
            // calendar fields use val = undefined if they are empty so this should work correctly for both systems
            if (val !== null && !_.isNumber(val) || val > 253402214400008) {
                return gt('Please enter a valid date');
            }
            return true;
        },
        pastDate: function (val) {
            if (_.isString(val)) {
                if (val !== '') {
                    return gt('Please enter a valid date');
                }
            }
            return _.now() > val || gt('Please enter a date in the past');
        },
        email: function (val) {
            var result = (regEmail.test(val) || val === '');
            return result || gt('Please enter a valid email address');

        },
        url: function (val) {
            return true;
        },
        object: function (val) {
            return _.isObject(val) ||
                gt('Please enter a valid object');
        }
    };

    ext.point("io.ox/backbone/validation/formats").invoke('customize', formats, formats);

    ext.point("io.ox/backbone/validation/formats").on('extended', function (extension) {
        extension.invoke('customize', formats, formats);
    });

    return {
        validationFor: function (modelNamespace, validationDefinitions) {
            var validationNamespace = modelNamespace + (/\/$/.test(modelNamespace) ? 'validation' : '/validation');


            // We'll register validation extensions according to the validationDefinitions
            _(validationDefinitions).each(function (definition, attribute) {
                ext.point(validationNamespace + '/' + attribute).extend({
                    id: definition.id || attribute,
                    validate: function (value, errors, attributes) {
                        var analysis = [];

                        if (definition.format && formats[definition.format]) {
                            var retval = formats[definition.format].call(errors, value);
                            if (retval !== true) {
                                analysis.push(retval);
                            }
                        }

                        if (definition.fn) {
                            var messages = definition.fn.apply(errors, value, errors, attributes, attribute);
                            if (messages) {
                                if (_.isArray(messages)) {
                                    _(messages).each(function (message) {
                                        analysis.push(message);
                                    });
                                } else {
                                    analysis.push(messages);
                                }
                            }
                        }
                        return analysis;
                    }
                });

                if (definition.mandatory) {
                    ext.point(validationNamespace + "/save").extend({
                        id: attribute + "-is-mandatory",
                        validate: function (attributes, errors) {
                            var value = attributes[attribute];

                            if (emptycheck(value)) {
                                errors.add(attribute, gt('Please enter a value'));
                            }
                        }
                    });
                }
            });

        },
        formats: formats
    };
});
