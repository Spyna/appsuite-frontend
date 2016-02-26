/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2015 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Christoph Hellweg <christoph.hellweg@open-xchange.com>
 */

define('io.ox/backbone/mini-views/toolbar', ['io.ox/backbone/disposable', 'gettext!io.ox/core'], function (DisposableView, gt) {

    'use strict';

    var Toolbar = DisposableView.extend({

        className: 'classic-toolbar-container',

        events: {
            'mousedown ul.classic-toolbar > li > a': 'onMousedown',
            'keydown ul.classic-toolbar > li > a': 'onKeydown'
        },

        initialize: function (opt) {
            this.options = _.extend({ tabindex: 0 }, opt);
            this.$list = this.createToolbar();
        },

        createToolbar: function () {
            return $('<ul class="classic-toolbar" role="toolbar">')
                //#. screenreader label for main toolbar
                .attr({ 'aria-label': gt('Actions. Use cursor keys to navigate.') })
                .tooltip({
                    animation: false,
                    container: 'body',
                    delay: 2000,
                    placement: 'left',
                    //#. Tooltip for main toolbar
                    title: gt('Use cursor keys to navigate'),
                    trigger: 'focus'
                })
                // make sure it always disappears
                .on('dispose', function () { $(this).tooltip('destroy'); })
                // always avoid clearing the URL hash
                .on('click', 'a', $.preventDefault);
        },

        render: function () {
            this.$el.attr({
                role: 'navigation',
                'aria-label': gt('Inline menu %1$s', this.options.title || '')
            })
            .append(this.$list);
            return this;
        },

        getButtons: function () {
            return this.$el.find('ul.classic-toolbar > li > a');
        },

        disableButtons: function () {
            // remove all event handlers
            this.getButtons().off().tooltip('hide').tooltip('disable');
            return this;
        },

        replaceToolbar: function (toolbar) {
            this.$el.find('ul.classic-toolbar').tooltip('hide').replaceWith(toolbar);
            return this;
        },

        initButtons: function () {
            this.$links = this.getButtons().attr({ role: 'button', tabindex: -1 });
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

                // SPACE
                case 32:
                    e.preventDefault();
                    $(e.currentTarget).click();
                    break;

                // LEFT and UP
                case 37:
                case 38:
                    index -= 1;
                    break;

                // RIGHT
                case 39:
                    index += 1;
                    break;

                // DOWN
                // case 40: don't use down button because of dropdowns

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
