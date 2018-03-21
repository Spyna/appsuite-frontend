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
 * @author Frank Paczynski <frank.paczynski@open-xchange.com>
 */

define('io.ox/find/view-placeholder', ['io.ox/backbone/disposable'], function (DisposableView) {

    'use strict';

    var PlaceholderView = DisposableView.extend({

        events: {
            'focusin': 'focused',
            'keyup': 'showSpinner'
        },

        initialize: function (options) {
            // field stub already rendered by desktop.js
            this.setElement($('.io-ox-find[data-app="' + options.app.get('parent').id + '"]'));

            // shortcuts
            this.ui = {
                field: this.$el.find('.search-field')
                //action: this.$el.find('.action-show')
            };

            // reuse
            this.options = options;

            this.listenTo(options.app, 'view:disable', this.disable);
            this.listenTo(options.app, 'view:enable', this.enable);
        },

        hideSpinner: function () {
            //this.ui.action.removeClass('io-ox-busy');
        },

        showSpinner: function () {
            //this.ui.action.addClass('io-ox-busy');
        },

        disable: function () {
            this.ui.field.prop('disabled', true);
            //this.ui.action.prop('disabled', true);
            this.ui.field.find('input.token-input.tt-input').removeAttr('tabindex');
        },

        enable: function () {
            this.ui.field.prop('disabled', false);
            //this.ui.action.prop('disabled', false);
            this.ui.field.find('input.token-input.tt-input').attr('tabindex', 0);
        },

        focused: function () {
            this.trigger('launch');
            this.destroy();
        },

        destroy: function () {
            if (this.disposed) return;
            this.hideSpinner();
            this.trigger('destroy');
            this.dispose();
        }
    });

    return PlaceholderView;
});
