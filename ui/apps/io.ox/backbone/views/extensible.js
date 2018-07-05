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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/backbone/views/extensible', ['io.ox/backbone/views/disposable', 'io.ox/core/extensions'], function (DisposableView, ext) {

    'use strict';

    // hash to "close" a view
    var closed = {};

    //
    // Extensible view.
    //

    var ExtensibleView = DisposableView.extend({

        // we use the constructor here not to collide with initialize()
        constructor: function (options) {
            // add central extension point
            this.options = options || {};
            this.point = ext.point(this.point || this.options.point);
            // the original constructor will call initialize()
            DisposableView.prototype.constructor.apply(this, arguments);
            // simplify debugging
            this.$el.attr('data-point', this.options.point);
        },

        // convenience function to add multiple extensions
        // needs some logic to avoid redefinitions
        extend: function (extensions) {
            // check if the point has been closed
            if (closed[this.point.id]) return this;
            // show warning if using extend with empty point.id
            // if you do that in modal dialogs it will bind to almost every modal dialog
            // be sure this is what you want
            if (ox.debug && !this.point.id) {
                console.warn('Using extend on extensible view without point.id. Be sure this is what you want. Function will be called in every extensible view without point.id (most modal dialogs for example)');
            }
            var index = 100;
            _(extensions).each(function (fn, id) {
                this.point.extend({ id: id, index: index, render: fn });
                index += 100;
            }, this);
            return this;
        },

        invoke: function (type) {
            var baton = new ext.Baton({ view: this, model: this.model });
            this.point.invoke(type || 'render', this, baton);
            // close for further calls of extend
            closed[this.point.id] = true;
            return this;
        },

        // inject function to dialog instance
        inject: function (functions) {
            return _.extend(this, functions);
        },

        build: function (fn) {
            fn.call(this);
            return this;
        },

        render: function () {
            return this.invoke('render');
        }
    });

    return ExtensibleView;
});
