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
 * @author Daniel Rentz <daniel.rentz@open-xchange.com>
 */

define('io.ox/office/tk/controller', ['io.ox/office/tk/utils'], function (Utils) {

    'use strict';

    // class Controller =======================================================

    /**
     * A controller contains a collection of items, consisting of unique key
     * and value, and providing arbitrary getter and setter methods for their
     * values.
     *
     * @constructor
     *
     * @param {Object} definitions
     *  A map of key/definition pairs. Each attribute in this map defines an
     *  item, keyed by its name. See method Controller.addDefinitions() for
     *  details.
     *
     * @param {Function} [defaultDoneHandler]
     *  A function that will run when an item setter function has been executed
     *  after a 'change' event and the item does not define its own done
     *  handler, or if a view component triggers a 'cancel' event. Will be
     *  executed in the context of this controller.
     */
    function Controller(app, definitions, defaultDoneHandler) {

        var // self reference
            self = this,

            // deferred methods that will be executed in a browser timeout
            deferredMethods = new Utils.DeferredMethods(this),

            // definitions for all items, mapped by item key
            items = {},

            // registered view components
            components = [],

            // cached item values during a complex update
            resultCache = {};

        // class Item ---------------------------------------------------------

        function Item(key, definition) {

            var // self reference
                self = this,
                // global enabled state of the item
                enabled = true,
                // parent item whose value/state is needed to resolve the own value/state
                parentKey = Utils.getStringOption(definition, 'parent'),
                // handler for enabled state
                enableHandler = Utils.getFunctionOption(definition, 'enable', _.identity),
                // handler for value getter
                getHandler = Utils.getFunctionOption(definition, 'get', _.identity),
                // handler for value setter
                setHandler = Utils.getFunctionOption(definition, 'set', $.noop),
                // done handler
                doneHandler = Utils.getFunctionOption(definition, 'done', defaultDoneHandler);

            function getAndCacheResult(type, handler, parentValue) {

                var // get or create a result object in the cache
                    result = resultCache[key] || (resultCache[key] = {});

                // if the required value does not exist yet, resolve it via the passed handler
                if (!(type in result)) {
                    result[type] = handler.call(self, parentValue);
                }
                return result[type];
            }

            /**
             * Returns whether this item is effectively enabled, by looking at
             * the own state, and by asking the enable handler of the item.
             */
            this.isEnabled = function () {
                var parentEnabled = enabled && ((parentKey in items) ? items[parentKey].isEnabled() : true);
                return enabled && getAndCacheResult('enable', enableHandler, parentEnabled);
            };

            /**
             * Enables or disables this item, and updates all registered view
             * components.
             *
             * @param {Boolean} [state=true]
             *  If omitted or set to true, the item will be enabled. Otherwise,
             *  the item will be disabled.
             *
             * @returns {Item}
             *  A reference to this item.
             */
            this.enable = function (state) {
                enabled = _.isUndefined(state) || (state === true);
                _(components).invoke('enable', key, this.isEnabled());
                return this;
            };

            /**
             * Returns the current value of this item.
             */
            this.get = function () {
                var parentValue = (parentKey in items) ? items[parentKey].get() : undefined;
                return getAndCacheResult('value', getHandler, parentValue);
            };

            /**
             * Updates the controls associated to this item in all view
             * components.
             *
             * @param [defaultValue]
             *  The default value if the value getter returns undefined.
             *
             * @returns {Item}
             *  A reference to this item.
             */
            this.update = function (defaultValue) {
                var value = this.get();
                value = _.isUndefined(value) ? defaultValue : value;
                _(components).invoke('enable', key, this.isEnabled());
                _(components).invoke('update', key, value);
                return this;
            };

            /**
             * Executes the setter function of this item (passing in the new
             * value), and the done handler, and updates all registered view
             * components.
             *
             * @param value
             *  The new value of the item.
             *
             * @returns {Item}
             *  A reference to this item.
             */
            this.change = function (value) {
                if (this.isEnabled()) {
                    setHandler.call(self, value);
                    this.update(value);
                }
                doneHandler.call(self);
                return this;
            };

        } // class Item

        // private methods ----------------------------------------------------

        /**
         * Clears all cached item results.
         */
        function clearResultCache() {
            resultCache = {};
        }

        /**
         * Returns all items matching the passed key selector in a map.
         *
         * @param {String|RegExp|String[]|RegExp[]|Null} [keys]
         *  The keys of the items to be included into the result, as
         *  space-separated string, or as regular expression, or as array of
         *  strings or regular expressions (also mixed). Strings have to match
         *  the keys exactly. If omitted, all registered items will be
         *  returned. If set to null, an empty map will be returned.
         *
         * @returns {Object}
         *  A map of all items with matching keys, mapped by their keys.
         */
        function selectItems(keys) {

            var // result collection
                matchingItems = {};

            // return all items, if parameter is missing
            if (_.isUndefined(keys)) {
                return items;
            }

            // convert passed parameter to array
            keys =
                _.isString(keys) ? keys.split(/\s+/) :  // string: space-separated list to array
                _.isRegExp(keys) ? [keys] :             // regular expression: one-element array
                _.isArray(keys) ? keys :                // array: nothing to do
                [];                                     // default: select nothing

            // pick items by string key or by regular expression
            _(keys).each(function (key) {
                if (_.isString(key) && (key in items)) {
                    matchingItems[key] = items[key];
                } else if (_.isRegExp(key)) {
                    _(items).each(function (item, itemKey) {
                        if (key.test(itemKey)) { matchingItems[itemKey] = item; }
                    });
                }
            });

            return matchingItems;
        }

        /**
         * The event handler function that will listen to 'change' and 'cancel'
         * events in all registered view components.
         */
        function componentEventHandler(event, key, value) {
            if (event.type === 'change') {
                if (key in items) {
                    clearResultCache();
                    items[key].change(value);
                } else {
                    defaultDoneHandler.call(self);
                }
            } else if (event.type === 'cancel') {
                defaultDoneHandler.call(self);
            }
        }

        // methods ------------------------------------------------------------

        /**
         * Adds the definition for a new item to this controller.
         *
         * @param {String} key
         *  The key of the new item.
         *
         * @param {Object} definition
         *  A map with callback functions defining the behavior of the item.
         *  All callback functions will be executed in the context of the Item
         *  class instance. The following attributes are supported:
         *  @param {String} [definition.parent]
         *      The name of an item that will be used to calculate intermediate
         *      results for the getter function and enabler function (see
         *      below). The key feature of parent items is that if a controller
         *      enables or updates multiple items at once, the getter or
         *      enabler of the same parent item registered at multiple items
         *      will be executed exactly once before the first item getter or
         *      enabler is called, and its result will be cached and passed to
         *      all item getters or enablers that are using this parent item.
         *  @param {Function} [definition.enable]
         *      Predicate function returning true if the item is enabled, and
         *      false otherwise. If a parent item has been specified (see
         *      above), the cached return value of its enabler function will be
         *      passed to this function. This means that the enabler function
         *      of parent items may return other values then booleans, if the
         *      enablers of items using the parent item will calculate a
         *      boolean value from that result. Defaults to a function that
         *      returns always true; or, if a parent item has been registered,
         *      that returns its cached value.
         *  @param {Function} [definition.get]
         *      Getter function returning the current value of the item. Can be
         *      omitted for one-way action items (actions without a return
         *      value). If a parent item has been specified (see above), the
         *      cached return value of its getter will be passed to this
         *      getter. May return null to indicate an ambiguous state. May
         *      return undefined to indicate that calculating the value is not
         *      applicable, not possible, not implemented, etc. In the case of
         *      an undefined return value, the current state of the controls in
         *      the view components will not be changed. Defaults to a function
         *      that returns undefined; or, if a parent item has been
         *      registered, that returns its cached value directly.
         *  @param {Function} [definition.set]
         *      Setter function changing the value of an item to the first
         *      parameter of the setter. Can be omitted for read-only items.
         *      Defaults to an empty function.
         *  @param {Function} [definition.done]
         *      A function that will be executed after the setter function has
         *      returned. If specified, overrides the default done handler
         *      passed to the constructor of this controller.
         *
         * @returns {Controller}
         *  A reference to this controller instance.
         */
        this.addDefinition = function (key, definition) {
            if (_.isString(key) && key && _.isObject(definition)) {
                items[key] = new Item(key, definition);
            }
            return this;
        };

        /**
         * Adds definitions for multiple items to this controller.
         *
         * @param {Object} definitions
         *  A map of key/definition pairs for all new items. Each item will be
         *  defined by calling the method Controller.addDefinition().
         *
         * @returns {Controller}
         *  A reference to this controller instance.
         */
        this.addDefinitions = function (definitions) {
            _(definitions).each(function (definition, key) { this.addDefinition(key, definition); }, this);
            return this;
        };

        /**
         * Registers a view component (e.g. a tool bar) that contains form
         * controls used to display item values and trigger item actions.
         *
         * @param {Component} component
         *  The view component to be registered. Must trigger 'change' events
         *  passing the item key and value as parameters, if a control has been
         *  activated in the user interface, or 'cancel' events to return to
         *  the application without doing anything. Must support the method
         *  enable() taking an item key and state parameter. Must support the
         *  method update() taking the key and value of an item.
         *
         * @returns {Controller}
         *  A reference to this controller instance.
         */
        this.registerViewComponent = function (component) {
            if (!_(components).contains(component)) {
                components.push(component);
                component.on('change cancel', componentEventHandler);
            }
            return this;
        };

        /**
         * Unregisters a view component that has been registered with the
         * method Controller.registerViewComponent().
         *
         * @param {Component} component
         *  A view component that has been registered with the method
         *  Controller.registerViewComponent() before.
         *
         * @returns {Controller}
         *  A reference to this controller instance.
         */
        this.unregisterViewComponent = function (component) {
            if (_(components).contains(component)) {
                component.off('change cancel', componentEventHandler);
                components = _(components).without(component);
            }
            return this;
        };

        /**
         * Enables or disables the specified items, and updates all registered
         * view components.
         *
         * @param {String|RegExp|Null} [keys]
         *  The keys of the items to be enabled or disabled, as space-separated
         *  string, or as regular expression. Strings have to match the keys
         *  exactly. If omitted, all items will be enabled or disabled. If set
         *  to null, no item will be enabled or disabled.
         *
         * @param {Boolean} [state=true]
         *  If omitted or set to true, the items will be enabled. Otherwise,
         *  the items will be disabled.
         *
         * @returns {Controller}
         *  A reference to this controller.
         */
        this.enable = function (keys, state) {
            clearResultCache();
            _(selectItems(keys)).invoke('enable', state);
            return this;
        };

        /**
         * Disables the specified items, and updates all registered view
         * components. Shortcut for Controller.enable(keys, false).
         *
         * @param {String|RegExp|Null} [keys]
         *  The keys of the items to be disabled, as space-separated string, or
         *  as regular expression. Strings have to match the keys exactly. If
         *  omitted, all items will be disabled. If set to null, no item will
         *  be disabled.
         *
         * @returns {Controller}
         *  A reference to this controller.
         */
        this.disable = function (keys) {
            return this.enable(keys, false);
        };

        /**
         * Updates the values of the specified items, and updates all
         * registered view components.
         *
         * @param {String|RegExp|Null} [keys]
         *  The keys of the items to be updated, as space-separated string,
         *  or as regular expression. Strings have to match the keys
         *  exactly. If omitted, all items will be updated. If set to null,
         *  no item will be updated.
         *
         * @returns {Controller}
         *  A reference to this controller.
         */
        this.update = (function () {

            var // pending controller keys to be updated
                pendingKeys = [];

            // direct callback: called every time when Controller.update() has been called
            function registerKeys(keys) {
                // update the array of pending keys
                if (_.isUndefined(keys)) {
                    pendingKeys = undefined;
                } else if (_.isArray(pendingKeys) && (_.isString(keys) || _.isRegExp(keys))) {
                    pendingKeys.push(keys);
                }
                return self;
            }

            // deferred callback: called once, after current script ends
            function updateComponents() {
                clearResultCache();
                _(selectItems(pendingKeys)).invoke('update');
                pendingKeys = [];
            }

            // create and return the deferred Controller.update() method
            return deferredMethods.createMethod(registerKeys, updateComponents);
        }()); // Controller.update()

        /**
         * Returns the current value of the specified item.
         *
         * @param {String} key
         *  The key of the item.
         *
         * @returns
         *  The current value of the item, or undefined, if the item does not
         *  exist.
         */
        this.get = function (key) {
            clearResultCache();
            return (key in items) ? items[key].get() : undefined;
        };

        /**
         * Triggers a change event manually. Executes the setter function of
         * the item associated to the specified key, passing in the new value.
         *
         * @param {String} key
         *  The key of the item to be changed.
         *
         * @param value
         *  The new value of the item.
         *
         * @returns {Controller}
         *  A reference to this controller.
         */
        this.change = function (key, value) {
            componentEventHandler({ type: 'change' }, key, value);
            return this;
        };

        /**
         * Triggers a cancel event manually. Executes the default done handler
         * of this controller.
         *
         * @returns {Controller}
         *  A reference to this controller.
         */
        this.cancel = this.done = function () {
            componentEventHandler({ type: 'cancel' });
            return this;
        };

        /**
         * Removes this controller from all event sources.
         */
        this.destroy = function () {
            deferredMethods.destroy();
            // unregister from view components
            _(components).invoke('off', 'change cancel', componentEventHandler);
            deferredMethods = items = components = null;
        };

        // initialization -----------------------------------------------------

        defaultDoneHandler = _.isFunction(defaultDoneHandler) ? defaultDoneHandler : $.noop;

        this.addDefinitions({
            'app/quit': {
                // quit in a timeout, otherwise destructor breaks this controller while running
                set: function () { window.setTimeout(function () { app.quit(); }, 0); }
            }
        });

        this.addDefinitions(definitions);

    } // class Controller

    // exports ================================================================

    return _.makeExtendable(Controller);

});
