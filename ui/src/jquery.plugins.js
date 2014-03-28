/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2011 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
*/

(function () {

    'use strict';

    // save some original jQuery methods
    $.original = { val: $.fn.val };

    $.preventDefault = function (e) {
        e.preventDefault();
    };

    $.escape = function (str) {
        // escape !"#$%&'()*+,./:;<=>?@[\]^`{|}~
        // see http://api.jquery.com/category/selectors/
        return String(str).replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
    };

    $.button = function (options) {

        // options
        var opt = $.extend({
            label: '',
            click: $.noop,
            enabled: true,
            data: {},
            css: {},
            primary: false,
            info: false,
            success: false,
            warning: false,
            danger: false,
            inverse: false

            // other options:
            // tabIndex, id, mousedown
        }, options || {});
        // class name
        var className;
        if (opt.purelink === true) {
            className = 'button io-ox-action-link';
        } else {
            className = 'btn' + (!opt.enabled ? ' btn-disabled' : '') + (opt.primary ? ' btn-primary' : '') + (opt.info ? ' btn-info' : '') + (opt.success ? ' btn-success' : '') + (opt.warning ? ' btn-warning' : '') + (opt.danger ? ' btn-danger' : '') + (opt.inverse ? ' btn-inverse' : '');

        }

        // create text node
        var text;
        if (opt.label.nodeType === 3) {
            // is text node!
            text = opt.label;
        } else {
            text = document.createTextNode(opt.label);
        }

        // create button
        var button;
        if (opt.purelink === true) {
            button = $('<a>').addClass(className).append(text);
        } else {
            button = $('<button>').addClass(className).append(
                $('<span>').append(text)
            );
        }
        button.on('click', opt.data, opt.click);

        // add id?
        if (opt.id !== undefined) {
            button.attr('id', opt.id);
        }

        button.attr('data-action', opt.dataaction || opt.data.action);

        // add tabindex?
        if (opt.tabIndex !== undefined) {
            button.attr('tabindex', opt.tabIndex);
        }

        return button;
    };

    $.fn.busy = function (empty) {
        return this.each(function () {
            var self = $(this);
            clearTimeout(self.data('busy-timeout'));
            self.data('busy-timeout', setTimeout(function () {
                self.addClass('io-ox-busy');
                if (empty) self.empty();
            }, 200));
        });
    };

    $.fn.idle = function () {
        return this.each(function () {
            var self = $(this);
            clearTimeout(self.data('busy-timeout'));
            self.removeClass('io-ox-busy');
        });
    };

    $.fn.intoViewport = function (node) {

        if (!node || this.length === 0) {
            return this;
        }

        try {

            // get pane
            var pane = $(node),
                // get visible area
                y1 = pane.scrollTop(),
                y2 = 0,
                // get top position
                top = this.offset().top + y1 - pane.offset().top,
                h = 0, left = 0;
            // out of visible area?
            if (top < y1) {
                // scroll up!
                top = top < 50 ? 0 : top;
                pane.scrollTop(top);
            } else {
                // scroll down!
                y2 = y1 + pane.height();
                h = this.outerHeight();
                if (top + h > y2) {
                    pane.scrollTop(y1 + top + h - y2);
                }
            }
            // custom offset?
            left = this.data('offset-left');
            if (left !== undefined) pane.scrollLeft(left);

        } catch (e) {
            // IE sometimes crashes
            // even Chrome might get in trouble during ultra fast scrolling
            console.error('$.fn.intoViewport', this, e);
        }

        return this;
    };

    // center content via good old stupid table stuff
    $.fn.center = function () {
        // probably does not run in IE properly
        return this.wrap($('<div>').addClass('io-ox-center')).parent();
    };

    $.txt = function (str) {
        return document.createTextNode(str !== undefined ? str : '');
    };

    $.fn.scrollable = function () {
        return $('<div>').addClass('scrollable-pane').appendTo(this.addClass('scrollable'));
    };

    $.labelize = (function () {

        var guid = 1;

        return function (node, id) {
            if (node.attr('id')) {
                id = node.attr('id');
            } else {
                id = (id || 'field') + '_' + (guid++);
            }
            return $('<label>', { 'for': id }).addClass('wrapping-label').append(node.attr('id', id));
        };
    }());

    $.alert = function (o) {
        o = _.extend({
            title: false,
            message: false,
            classes: 'alert-danger',
            dismissable: false
        }, o);
        return $('<div class="alert fade in">')
            .addClass(o.classes)
            .addClass(o.dismissable ? 'alert-dismissable' : '')
                .append(
                    o.dismissable ? $('<button type="button" class="close" data-dismiss="alert" aria-hidden="true">').html('&times;') : $(),
                    o.title ? $('<h4 class="alert-heading">').text(o.title) : $(),
                    o.message ? $('<p>').text(o.message) : $()
                );
    };

}());
