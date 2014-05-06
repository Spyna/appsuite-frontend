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

define('io.ox/core/tk/text-editor', function () {

    'use strict';

    // save jQuery val() - since tinyMCE is a bit too aggressive
    var val = $.original.val;

    function Editor(textarea) {

        textarea = $(textarea);

        if (_.device('tablet && iOS >= 6')) {
            textarea.on('click', function () {
                if (textarea.get(0).selectionStart < 100) {
                    _.defer(function () {
                        window.scrollTo(0, 0);
                        document.body.scrollTop = 0;
                    });
                }
            });
        }

        var def = $.when(),

            trimEnd = function (str) {
                // ensure we have a string
                str = String(str || '');
                // remove white-space at end
                return str.replace(/[\s\xA0]+$/, '');
            },

            trim = function (str) {
                str = trimEnd(str);
                // reduce leading line-feeds
                str = str.replace(/^\n{2,}/, '\n\n');
                // ignore valid white-space pattern at beginning (see Bug 26316)
                if (/^\n{0,2}[ \t\xA0]*\S/.test(str)) return str;
                // remove white-space
                return str.replace(/^[\s\xA0]*\n([\s\xA0]*\S)/, '$1');
            },

            set = function (str) {
                val.call(textarea, trimEnd(str));
            },

            clear = function () {
                val.call(textarea, '');
            },

            get = function () {
                return trim(val.call(textarea));
            };

        this.getMode = function () {
            return 'text';
        };

        // publish internal 'done'
        this.done = function (fn) {
            def.done(fn);
            return def;
        };

        this.focus = function () {
            textarea.focus();
        };

        this.clear = clear;

        this.getContent = get;
        this.getPlainText = get;

        this.setContent = set;
        this.setPlainText = set;

        this.paste = $.noop;

        this.scrollTop = function (pos) {
            if (pos === undefined) {
                return textarea.scrollTop();
            } else if (pos === 'top') {
                textarea.scrollTop(0);
            } else if (pos === 'bottom') {
                textarea.scrollTop(textarea.get(0).scrollHeight);
            }
        };

        this.setCaretPosition = function (pos) {
            var el = textarea.get(0);
            if (el.setSelectionRange) {
                el.focus();
                el.setSelectionRange(pos, pos);
            } else if (el.createTextRange) {
                var range = el.createTextRange();
                range.collapse(true);
                range.moveEnd('character', pos);
                range.moveStart('character', pos);
                range.select();
            }
        };

        this.appendContent = function (str) {
            var content = this.getContent();
            this.setContent(content + '\n\n' + str);
        };

        this.prependContent = function (str) {
            var content = this.getContent();
            this.setContent(str + '\n\n' + content);
        };

        this.replaceParagraph = function (str, rep) {
            var content = this.getContent(), pos, top;
            // exists?
            if ((pos = content.indexOf(str.trim())) > -1) {
                // replace content
                top = this.scrollTop();
                this.setContent(content.substr(0, pos) + (rep || '') + content.substr(pos + str.length));
                this.scrollTop(top);
                return true;
            } else {
                return false;
            }
        };

        var resizeEditorMargin = (function () {
            // trick to force document reflow
            var alt = false;
            return _.debounce(function () {
                //textarea might be destroyed already
                if (!textarea)
                    return;
                var w = Math.max(10, textarea.outerWidth() - 12 - 750);
                textarea.css('paddingRight', w + 'px')
                        .parents('.window-content').find('.editor-print-margin')
                        .css('right', Math.max(0, w - 10) + 'px').show()
                // force reflow
                        .css('display', (alt = !alt) ? 'block' : '');
            }, 100);
        }());

        this.handleShow = function () {
            textarea.prop('disabled', false).idle().show()
                .next().hide();
            textarea.parents('.window-content').find('.mce-tinymce').hide();
            resizeEditorMargin();
            $(window).on('resize', resizeEditorMargin);

        };

        this.handleHide = function () {
            $(window).off('resize', resizeEditorMargin);
        };

        this.getContainer = function () {
            return textarea;
        };

        this.destroy = function () {
            this.handleHide();
            this.setContent('');
            textarea = def = null;
        };
    }

    return Editor;

});
