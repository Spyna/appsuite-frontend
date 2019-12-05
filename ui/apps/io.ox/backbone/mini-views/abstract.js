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

define('io.ox/backbone/mini-views/abstract', [], function () {

    'use strict';

    //
    // Abstract view. Takes care of dispose.
    //

    var AbstractView = Backbone.View.extend({

        initialize: function (options) {
            var o = this.options = options || {};
            // defaults
            if (o.validate === undefined) o.validate = true;
            // use id if id is given and no name
            if (o.id && !o.name) o.name = o.id;
            // register for 'dispose' event (using inline function to make this testable via spyOn)
            this.$el.on('dispose', function (e) { this.dispose(e); }.bind(this));
            // make all views accessible via DOM; gets garbage-collected on remove
            this.$el.data('view', this);
            // has model and a name?
            if (this.model && o.name) {
                this.name = o.name;
                this.listenTo(this.model, 'valid:' + o.name, this.valid);
                this.listenTo(this.model, 'invalid:' + o.name, this.invalid);
            }
            // call custom setup
            if (this.setup) this.setup(o);
        },

        valid: function () {
            this.$el.trigger('valid');
        },

        invalid: function (message, errors) {
            this.$el.trigger('invalid', [message, errors]);
        },

        dispose: function () {
            this.stopListening();
            this.model = null;
        }
    });

    return AbstractView;
});
