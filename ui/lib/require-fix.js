// Override nextTick to enable collection of dependencies for concatenation.
(function () {
    var waiting = 0, finalCallback = null;
    require.nextTick = function (fn, finalCb) {
        if (finalCb) finalCallback = finalCb;
        if (!fn && waiting) return;
        waiting++;
        setTimeout(function () {
            if (fn) fn();
            if (--waiting || !finalCallback) return;
            var cb = finalCallback;
            finalCallback = null;
            cb();
        }, 4);
    };
    _.each(require.s.contexts, function(context) {
        context.nextTick = require.nextTick;
    });
}());

// init require.js
require({
    // inject version
    baseUrl: ox.base + "/apps",
    // use 15 seconds as base or hash param to tweak the timeout
    waitSeconds: document.cookie.indexOf('selenium=true') != -1 ? (60 * 10) : (_.url.hash('waitSeconds') || 15)
});

// jQuery AMD fix
define('jquery', function () { return $; });

/**
 * Asynchronous define (has same signature than define)
 * Callback must return deferred object.
 */
define.async = (function () {

    var getLoader = function (name, deps, callback) {
            return function (n, req, onLoad, config) {
                // resolve module dependencies
                req(deps, function () {
                    // get module (must return deferred object)
                    var def = callback.apply(null, arguments);
                    if (def && def.done) {
                        def.done(onLoad);
                    } else {
                        console.error('Module "' + name + '" does not return a deferred object!');
                    }
                    name = deps = callback = null;
                });
            };
        };

    return function (name, deps, callback) {
        // use loader plugin to defer module definition
        var wrapper = null;
        if (ox.manifests) {
            wrapper = ox.manifests.wrapperFor(name, deps, callback);
        } else {
            wrapper = {
                dependencies: deps,
                definitionFunction: callback
            };
        }
        if (wrapper.after && wrapper.after.length) {
            (function () {
                var definitionFunction = wrapper.definitionFunction;
                wrapper.definitionFunction = function () {
                    var def = definitionFunction.apply(window, arguments);
                    var allLoaded = $.Deferred();

                    def.done(function (module) {
                        require(wrapper.after).done(function () {
                            allLoaded.resolve(module);
                        });
                    }).fail(allLoaded.reject);

                    return allLoaded;
                };
            }());
        }
        define(name + ':init', { load: getLoader(name, wrapper.dependencies, wrapper.definitionFunction) });
        // define real module - will wait for promise
        define(name, [name + ':init!'], _.identity);
    };
}());

/**
* module definitions can be extended by plugins
**/
(function () {

    var originalDefine = define;

    window.define = function () {
        if (!ox.manifests) {
            return originalDefine.apply(this, arguments);
        }
        // Is this a define statement we understand?
        if (_.isString(arguments[0])) {
            var name = arguments[0];
            // FIXME
            if (name === "io.ox/core/notifications") {
                return originalDefine.apply(this, arguments);
            }
            var dependencies = arguments[1];
            var definitionFunction = $.noop;
            if (_.isFunction(dependencies)) {
                definitionFunction = dependencies;
                dependencies = [];
            } else if (arguments.length > 2) {
                definitionFunction = arguments[2];
            }
            // already defined?
            if (!requirejs.defined(name)) {
                var wrapper = ox.manifests.wrapperFor(name, dependencies, definitionFunction);
                if (wrapper.after && wrapper.after.length) {
                    originalDefine(name + ":init", {load: function (name, req, onLoad, config) {
                        req(wrapper.dependencies, function () {
                            // get module (must return deferred object)
                            var module = wrapper.definitionFunction.apply(null, arguments);
                            require(wrapper.after).done(function () {
                                onLoad(module);
                            });
                        });
                    }});

                    return originalDefine(name, [name + ':init!'], _.identity);
                }
                return originalDefine(name, wrapper.dependencies, wrapper.definitionFunction);
            } else {
                return;
            }
        }

        // Just delegate everything else
        return originalDefine.apply(this, arguments);
    };

    $.extend(window.define, originalDefine);

})();
