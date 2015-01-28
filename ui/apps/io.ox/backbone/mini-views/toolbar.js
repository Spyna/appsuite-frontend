/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2013 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/backbone/mini-views/toolbar', ['gettext!io.ox/core'], function (gt) {

    'use strict';

    var Toolbar = Backbone.View.extend({

        tagName: 'div',

        className: 'classic-toolbar-container',

        events: {
            'mousedown ul.classic-toolbar>li>a': 'onMousedown',
            'keydown ul.classic-toolbar>li>a': 'onKeydown'
        },

        initialize: function (opt) {
            var defaults = {
                tabindex: 0
            };
            this.options = _.extend(defaults, opt);
        },

        render: function () {
            this.$el.attr({
                role: 'navigation',
                title: gt('Inline menu %1$s', this.options.title || '')
            }).append(
                this.$list = $('<ul>').attr({
                    role: 'toolbar',
                    title: gt('Actions')
                }).addClass('classic-toolbar')
            );
            return this;
        },

        initButtons: function () {
            this.$links = this.$el.find('ul.classic-toolbar>li>a').attr({
                role: 'button',
                tabindex: -1
            });
            // set focus to first element
            this.$links.first().attr({
                tabindex: this.options.tabindex
            });
        },

        onMousedown: function (e) {
            this.$links.attr('tabindex', -1);
            $(e.currentTarget).attr('tabindex', this.options.tabindex);
        },

        onKeydown: function (e) {
            // if not space, cursor or modifier key pressed: Do not process
            if (!/(32|37|38|39|40)/.test(e.which) || e.altKey || e.ctrlKey || e.shiftKey) {
                return;
            }

            var index = (this.$links.index($(document.activeElement)) || 0);

            if (index < 0) return;

            switch (e.which) {
                case 32:
                    // SPACE
                    $(e.currentTarget).click();
                    break;
                case 37:
                case 38:
                    index -= 1;
                    break;
                    // LEFT and UP
                case 39:
                // case 40: don't use down button because of dropdowns
                    index += 1;
                    // RIGHT and DOWN
                    break;
                default:
                    break;
            }

            this.$links
                .attr('tabindex', -1)
                .eq(index %= this.$links.length)
                .attr('tabindex', this.options.tabindex)
                .focus();
        }

    });

    return Toolbar;
});
