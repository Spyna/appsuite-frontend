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
 * @author Mario Scheliga <mario.scheliga@open-xchange.com>
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */
/*global
define: true
*/
define('io.ox/core/tk/model', ['io.ox/core/event'], function (Events) {

    'use strict';

    var Error, regEmail, formats, isEqual, updateComputed, Schema, Model;

    /**
     * General local Error class
     */
    Error = function (props, message) {
        this.properties = _.isArray(props) ? props : [props];
        this.message = message;
    };

    /**
     * Formats for validation
     */
    regEmail = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;

    formats = {
        string: function (prop, val, def) {
            // always true!
            return true;
        },
        text: function () {
            return true;
        },
        number: function (prop, val, def) {
            return _.isNumber(val) ||
                new Error(prop, _.printf('%s must be a number', def.i18n || prop));
        },
        array: function (prop, val, def) {
            return _.isArray(val) ||
                new Error(prop, _.printf('%s must be an array', def.i18n || prop));
        },
        boolean: function (prop, val, def) {
            return _.isBoolean(val) ||
                new Error(prop, _.printf('%s must be bool', def.i18n || prop));
        },
        date: function (prop, val, def) {
            return true;
        },
        pastDate: function (prop, val, def) {
            var now = _.now(),
                reformatetValue,
                reg = /((\d{2})|(\d))\.((\d{2})|(\d))\.((\d{4})|(\d{2}))/;
            if (!_.isString(val)) {
                reformatetValue = require('io.ox/core/i18n').date('dd.MM.YYYY', val);
            } else {
                return new Error(prop, _.printf('%s is not a valide date', def.i18n || prop));
            }

            if (!reg.test(reformatetValue) && val !== '') {
                return new Error(prop, _.printf('%s is not a valide date', def.i18n || prop));
            } else  {
                return  now > val || new Error(prop, _.printf('%s must be in the past', def.i18n || prop));
            }

        },
        email: function (prop, val, def) {
            return regEmail.test(val) ||
                new Error(prop, _.printf('%s must be a valid email address', def.i18n || prop));
        },
        url: function (prop, val, def) {
            return true;
        }
    };

    isEqual = function (newValue, previousValue) {
        if (newValue === '' && previousValue === undefined) {
            return true;
        } else {
            return _.isEqual(newValue, previousValue);
        }
    };

    /**
     * Schema class
     */
    Schema = function (definitions) {
        this._definitions = definitions || {};
    };

    Schema.prototype = {

        formats: formats,

        get: function (prop) {
            return this._definitions[prop] || {};
        },

        getDefaults: function () {
            var defaults = {};
            _(this._definitions).each(function (def, prop) {
                if (def.defaultValue !== undefined) {
                    defaults[prop] = def.defaultValue;
                }
            });
            return defaults;
        },

        getMandatories: function () {
            var tmp = [];
            _(this._definitions).each(function (def, prop) {
                if (def.mandatory) {
                    tmp.push(prop);
                }
            });
            return tmp;
        },

        isMandatory: function (key) {
            return !!this.get(key).mandatory;
        },

        getFieldType: function (key) {
            return this.get(key).format;
        },

        getFieldLabel: function (key) {
            return this.get(key).label;
        },

        isTrimmed: function (key) {
            return this.get(key).trim !== false;
        },

        validate: function (prop, value) {
            var def = this.get(prop),
                format = def.format || 'string',
                isEmpty = value === '',
                isNotMandatory = def.mandatory !== true;
            if (isEmpty) {
                return isNotMandatory ||
                    new Error(prop, _.printf('%s is mandatory', def.i18n || prop));
            }
            if (_.isFunction(this.formats[format])) {
                return this.formats[format](prop, value, def);
            }
            // undefined format
            console.error('Unknown format used in model schema', format);
        },

        // can return deferred object / otherwise just instance of Error or nothing
        check: function (data, Error) {
            return $.when();
        }
    };

    /**
     * Model
     */

    // yep, this could be done once upfront but we no longer pay for CPU ticks, so ...
    var triggerTransitives = function (key) {
        _(this._computed).each(function (o, computed) {
            if (_(o.deps).indexOf(key) > -1) {
                var memo = this._memoize[computed],
                    value = this.get(computed);
                if (!_.isEqual(memo, value)) {
                    this.trigger('change:' + computed, computed, value);
                    triggerTransitives.call(this, computed);
                }
            }
        }, this);
    };

    Model = function (options) {
        options = options || {};
        this._data = {};
        this._previous = {};
        this._defaults = this.schema.getDefaults();
        this._memoize = {};
        Events.extend(this);
        // TODO: we ALWAYS need data! do we have any options? I always forget to use key/value here
        this.initialize(options.data || options || {});
    };

    Model.addComputed = function (key, /* optional */ deps, callback) {
        if (!callback) {
            callback = deps;
            deps = [];
        }
        if (key && _.isFunction(callback)) {
            this.prototype._computed[key] = { deps: deps, callback: callback };
        }
        return this;
    };

    Model.prototype = {

        _computed: {},

        schema: new Schema(),

        initialize: function (data) {
            // deep copy to avoid side effects
            this._previous = _.copy(data || {}, true);
            // due to defaultValues, data and previous might differ.
            // however, the model is not dirty
            this._data = _.extend({}, this._defaults, _.copy(data || {}, true));
            // memoize computed properties
            _(this._computed).each(function (o, key) {
                this.get(key);
            }, this);
        },

        isEmpty: function (key) {
            // check if value would appear as empty string in UI
            var value = this._data[key];
            return value === '' || value === undefined || value === null;
        },

        has: function (key) {
            return key in this._data;
        },

        get: function (key) {
            if (key === undefined) {
                // get all values
                return _.copy(this._data, true);
            } else if (this._computed[key] === undefined) {
                // get single value
                return _.copy(this._data[key], true);
            } else {
                // get computed value
                var o = this._computed[key],
                    params = _(o.deps).map(this.get, this),
                    value = o.callback.apply(this, params);
                return (this._memoize[key] = value);
            }
        },

        set: function (key, value) {
            // key?
            if (key === undefined) {
                return;
            }
            // trim?
            if (_.isString(value) && this.schema.isTrimmed(key)) {
                value = $.trim(value);
            }
            // changed?
            if (isEqual(value, this._data[key])) {
                return;
            }
            // validate only if really changed - yes, initial value might conflict with schema
            // but we validate each field again during final consistency checks
            var result = this.schema.validate(key, value);
            if (result !== true) {
                this.trigger('error:invalid', result);
                // yep, we continue here to actually get invalid data
                // we need this for a proper final check during save
            }
            // update
            this._data[key] = value;
            // trigger change event for property and global change
            this.trigger('change:' + key + ' change', key, value);
            // trigger change event for computed properties
            triggerTransitives.call(this, key);
        },

        isDirty: function () {
            // the model is dirty if any property differs from its previous or default value
            var key, value, previous = this._previous, defaults = this._defaults, changed;
            for (key in this._data) {
                value = this._data[key];
                // use 'soft' isEqual for previous, 'hard' isEqual for default values
                changed = !(isEqual(value, previous[key]) || _.isEqual(value, defaults[key]));
                if (changed) {
                    return true;
                }
            }
            return false;
        },

        getChanges: function () {
            var changes = {}, previous = this._previous;
            _(this._data).each(function (value, key) {
                if (!isEqual(value, previous[key])) {
                    changes[key] = _.copy(value, true);
                }
            });
            return changes;
        },

        toString: function () {
            return JSON.stringify(this._data);
        },

        // DEPRECATED
        setData: function (data) {
            console.warn('DEPRECATED: setData - use initialize()');
            this.init(data);
        },

        /* DEPRECATED - get() without any parameter returns all data as well */
        getData: function () {
            console.warn('DEPRECATED: getData - use get()');
            // return deep copy
            return _.copy(this._data, true);
        },


        // DEPRECATED
        getDefinition: function (prop) {
            console.warn('DEPRECATED: getDefinition -> schema.get()');
            return this.schema.get(prop);
        },

        // DEPRECATED
        validate: function (prop, value) {
            console.warn('DEPRECATED: validate -> schema.validate()');
            return this.schema.validate(prop, value);
        },

        // DEPRECATED
        // can return deferred object / otherwise just instance of Error or nothing
        check: function (data, Error) {
            console.warn('DEPRECATED: check -> schema.check()');
            return this.schema.check(data, Error);
        },

        // DEPRECATED
        isMandatory: function (prop) {
            console.warn('DEPRECATED: isMandatory');
            return this.schema.isMandatory(prop);
        },

        // DEPRECATED
        isTrimmed: function (prop) {
            console.warn('DEPRECATED: isTrimmed');
            return this.schema.isTrimmed(prop);
        },

        save: (function () {

            var checkValid = function (valid, value, key) {
                    var result = this.schema.validate(key, value);
                    if (result !== true) {
                        this.trigger('error:invalid', result);
                        return false;
                    } else {
                        return valid;
                    }
                },
                success = function () {
                    // trigger store - expects deferred object
                    var def = $.Deferred().notify(), self = this;
                    this.trigger('save:progress');
                    (this.store(this.get(), this.getChanges()) || $.when())
                        .done(function () {
                            // not yet destroyed?
                            if (self.triggger) {
                                self.initialize(self._data);
                                self.trigger.apply(self, ['save:beforedone'].concat($.makeArray(arguments)));
                                self.trigger.apply(self, ['save:done'].concat($.makeArray(arguments)));
                            }
                            def.resolve.apply(def, arguments);
                        })
                        .fail(function () {
                            if (self.triggger) {
                                self.trigger.apply(self, ['save:beforefail'].concat($.makeArray(arguments)));
                                self.trigger.apply(self, ['save:fail'].concat($.makeArray(arguments)));
                            }
                            def.reject.apply(def, arguments);
                        });
                    return def;
                },
                fail = function (error) {
                    // fail
                    this.trigger('error:inconsistent', error);
                    return error;
                };

            return function () {

                // add mandatory fields to force validation
                _(this.schema.getMandatories()).each(function (key) {
                    if (!(key in this._data)) {
                        this._data[key] = '';
                    }
                }, this);

                // check all properties
                if (!_(this._data).inject(checkValid, true, this)) {
                    return $.Deferred().reject();
                }

                // check consistency
                var consistency = this.schema.check(this._data, Error);

                if (!_.isFunction((consistency || {}).promise)) {
                    consistency = typeof consistency === 'object' ?
                        $.Deferred().reject(consistency) : $.when();
                }

                return consistency.pipe(_.bind(success, this), _.bind(fail, this));
            };
        }()),

        // store method must be replaced by custom handler
        store: function (data, changes) { },

        // destructor
        destroy: function () {
            this.events.destroy();
            this._data = null;
            this._previous = null;
            this._defaults = null;
            this._memoize = null;
        }
    };

    // allow extend()
    _.makeExtendable(Model);

    // publish Schema class
    Model.Schema = Schema;

    return Model;
});
