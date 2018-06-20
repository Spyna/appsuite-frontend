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

/* global tinyMCE: true */

define('io.ox/core/tk/contenteditable-editor', [
    'io.ox/core/emoji/util',
    'io.ox/core/capabilities',
    'io.ox/core/extensions',
    'io.ox/core/tk/textproc',
    'io.ox/mail/api',
    'io.ox/mail/util',
    'settings!io.ox/core',
    'settings!io.ox/mail',
    'gettext!io.ox/core',
    'less!io.ox/core/tk/contenteditable-editor'
], function (emoji, capabilities, ext, textproc, mailAPI, mailUtil, settings, mailSettings, gt) {

    'use strict';

    // some gt-calls for translations inside the custom plugins for tinymce
    gt('Drop inline images here');
    gt('Please only drop images here. If you want to send other files, you can send them as attachments.');

    var POINT = 'io.ox/core/tk/contenteditable-editor';

    var INDEX = 0;

    ext.point(POINT + '/setup').extend({
        id: 'default',
        index: INDEX += 100,
        draw: function (ed) {
            ed.on('keydown', function (e) {
                // pressed enter?
                if (e.which === 13) {
                    splitContent(ed, e);
                }
            });

            ext.point('3rd.party/emoji/editor_css').each(function (point) {
                var url = ed.convertURL(require.toUrl(point.css));
                ed.contentCSS.push(url);
            });
        }
    });

    ext.point(POINT + '/setup').extend({
        id: 'emoji',
        index: INDEX += 100,
        draw: function (ed) {
            ext.point('3rd.party/emoji/editor_css').each(function (point) {
                var url = ed.convertURL(require.toUrl(point.css));
                ed.contentCSS.push(url);
            });
        }
    });

    ext.point(POINT + '/setup').extend({
        id: 'list-style-position',
        index: INDEX += 100,
        draw: function (ed) {
            ed.on('NodeChange', function (e) {
                if (e.element.nodeName !== 'LI') return;
                if (e.element.style.textAlign === 'left' || e.element.style.textAlign === '') return;
                $(e.element).css('list-style-position', 'inside');
            });
        }
    });

    ext.point(POINT + '/setup').extend({
        id: 'sanitize',
        index: INDEX += 100,
        draw: function (ed) {
            var sanitizeAttributes = function (e) {
                if (!e.content) return;
                var tmp = document.createElement('DIV');
                tmp.innerHTML = e.content;
                var nodes = tmp.querySelectorAll('*');
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i], ai = 0, attr;
                    while (attr = node.attributes[ai++]) {
                        if (/^on/i.test(attr.name)) { node.removeAttribute(attr.name); }
                        if (attr.name === 'data-toggle') { node.removeAttribute(attr.name); }
                    }
                }
                e.content = tmp.innerHTML;
                tmp = null;
            };
            if (ed.oxContext && ed.oxContext.signature) {
                ed.on('BeforeSetContent', sanitizeAttributes);
            }

            ed.on('PastePreProcess', sanitizeAttributes);
        }
    });

    ext.point(POINT + '/setup').extend({
        id: 'image-remove',
        index: INDEX += 100,
        draw: (function () {
            function getImageIds(content) {
                // content can be just a string when e.g. pasting
                var images = $('<div>' + content + '</div>').find('img');
                return _(images.toArray()).chain().map(function (img) {
                    return $(img).attr('id');
                }).compact().value();
            }
            return function (ed) {
                var oldsIds = [];
                ed.on('BeforeSetContent change Focus Blur', function (e) {
                    // use e.content for BeforeSetContent events
                    var ids = getImageIds(e.content || ed.getContent()),
                        removed = _.difference(oldsIds, ids);
                    removed.forEach(function (id) {
                        var editorElement = $(ed.getElement());
                        editorElement.trigger('removeInlineImage', id);
                    });
                    oldsIds = ids;
                });
            };
        }())
    });

    function splitContent_W3C(ed) {
        // get current range
        var range = ed.selection.getRng();
        // range collapsed?
        if (!range.collapsed) {
            // delete selected content now
            ed.execCommand('Delete', false, null);
            // reselect new range
            range = ed.selection.getRng();
        }
        // do magic
        var container = range.commonAncestorContainer;
        var lastBR = null,
            traverse;
        // helper
        traverse = function (node) {
            var i;
            if (node) {
                if (node.hasChildNodes()) {
                    // skip text nodes
                    for (i = 0; i < node.childNodes.length; i++) {
                        if (node.childNodes[i].nodeType === 1) {
                            // follow this node
                            traverse(node.childNodes[i]);
                            return;
                        } else if (node.childNodes[i].nodeType === 3) {
                            // remove zero width space (good for safari)
                            node.childNodes[i].nodeValue = node.childNodes[i].nodeValue.replace('\u200B', '');
                        }
                    }
                } else if (node.nodeName === 'BR') {
                    // remember node
                    lastBR = node;
                }
            }
        };
        while (container && !/mce-content-body/.test(container.className)) {
            // set range to end of container
            range.setEndAfter(container);
            // get parent node
            var p = container.parentNode;
            // add range content before next sibling (or at the end of the parent node)
            var contents = range.extractContents();
            // BR fix (remove unwanted newline)
            traverse(contents.firstChild);
            // now insert contents
            if ($(contents).text().length > 0) {
                // insert this content only if it includes something visible
                // Actually this allows to split a quote after the very last
                // character without getting empty gray blocks below the split
                p.insertBefore(contents, container.nextSibling);
            }
            // fix ordered lists. Look for subsequent <ol>...</ol><ol>...
            try {
                var ol = $(p).children('ol + ol'), prev, start;
                if (ol.length > 0) {
                    prev = ol.prev();
                    start = prev.children('li').length + 1;
                    ol.attr('start', start);
                }
            } catch (e) {
                if (ox.debug) console.error(e);
            }
            // climb up
            container = p;
        }
        // last BR?
        if (lastBR) {
            try {
                lastBR.parentNode.removeChild(lastBR);
            } catch (e) {
                if (ox.debug) console.error(e);
            }
        }
        // create new elements
        range.insertNode(mailUtil.getDefaultStyle().node.get(0));
    }

    function isInsideBlockquote(range) {
        // get ancestor/parent container
        var container = range.commonAncestorContainer || range.parentElement();
        // loop for blockquote
        var bq = $(container).parents('blockquote').last(),
            is = bq.length > 0;
        //console.debug('inside?', is, bq);
        return is;
    }

    function splitContent(ed, e) {
        // get current range
        var range = ed.selection.getRng();
        // inside blockquote?
        if (!isInsideBlockquote(range)) return;
        if (!range.startContainer) return;
        splitContent_W3C(ed);
        ed.dom.events.cancel(e);
        //focus is lost after content has been split, at least starting with tinyMCE 4.6.6 (4.6.5 didn't)
        ed.focus();
    }

    function lookupTinyMCELanguage() {
        var lookup_lang = ox.language,
            tinymce_langpacks = ['ar', 'ar_SA', 'az', 'be', 'bg_BG', 'bn_BD', 'bs', 'ca', 'cs', 'cy', 'da', 'de', 'de_AT', 'dv', 'el', 'en_CA', 'en_GB', 'es', 'et', 'eu', 'fa', 'fi', 'fo', 'fr_FR', 'gd', 'gl', 'he_IL', 'hr', 'hu_HU', 'hy', 'id', 'is_IS', 'it', 'ja', 'ka_GE', 'kk', 'km_KH', 'ko_KR', 'lb', 'lt', 'lv', 'ml', 'ml_IN', 'mn_MN', 'nb_NO', 'nl', 'pl', 'pt_BR', 'pt_PT', 'ro', 'ru', 'si_LK', 'sk', 'sl_SI', 'sr', 'sv_SE', 'ta', 'ta_IN', 'tg', 'th_TH', 'tr_TR', 'tt', 'ug', 'uk', 'uk_UA', 'vi', 'vi_VN', 'zh_CN', 'zh_TW'],
            tinymce_lang = _.indexOf(tinymce_langpacks, lookup_lang, true);

        // See bug 38381
        if (lookup_lang === 'fr_CA') return 'fr_FR';

        if (tinymce_lang > -1) {
            return tinymce_langpacks[tinymce_lang];
        }
        tinymce_lang = _.indexOf(tinymce_langpacks, lookup_lang.substr(0, 2), true);
        return (tinymce_lang > -1) ? tinymce_langpacks[tinymce_lang] : 'en';
    }

    function Editor(el, opt) {

        var rendered = $.Deferred(), initialized = $.Deferred(), ed;
        var toolbar, editor, editorId = el.data('editorId');
        var defaultStyle = mailUtil.getDefaultStyle();

        el.append(
            el = $('<div class="contenteditable-editor">').attr({
                'data-editor-id': editorId
            }).append(
                toolbar = $('<div class="editable-toolbar">').attr('data-editor-id', editorId),
                editor = $('<div class="editable" tabindex="0" role="textbox" aria-multiline="true">')
                    .attr({ 'aria-label': gt('Rich Text Area. Press ALT-F10 for toolbar') })
                    .css('margin-bottom', '32px')
            )
        );

        opt = _.extend({
            toolbar1: 'undo redo | bold italic | emoji | bullist numlist outdent indent',
            advanced: 'styleselect | fontselect fontsizeselect | forecolor backcolor | link image',
            toolbar2: '',
            toolbar3: '',
            plugins: 'autolink oximage oxpaste oxdrop link paste textcolor emoji lists code',
            theme: 'unobtanium',
            skin: 'lightgray'
        }, opt);

        editor.addClass(opt['class']);

        opt.toolbar1 += ' | ' + opt.advanced;

        // consider custom configurations
        opt.toolbar1 = settings.get('tinyMCE/theme_advanced_buttons1', opt.toolbar1);
        opt.toolbar2 = settings.get('tinyMCE/theme_advanced_buttons2', opt.toolbar2);
        opt.toolbar3 = settings.get('tinyMCE/theme_advanced_buttons3', opt.toolbar3);

        // remove unsupported stuff
        if (!capabilities.has('emoji')) {
            opt.toolbar1 = opt.toolbar1.replace(/( \| )?emoji( \| )?/g, ' | ');
            opt.toolbar2 = opt.toolbar2.replace(/( \| )?emoji( \| )?/g, ' | ');
            opt.toolbar3 = opt.toolbar3.replace(/( \| )?emoji( \| )?/g, ' | ');
            opt.plugins = opt.plugins.replace(/emoji/g, '').trim();
        }

        var fixed_toolbar = '.editable-toolbar[data-editor-id="' + editorId + '"]';

        // remove all toolbars in mobileapp
        if (window.cordova) {
            opt.toolbar = 'false';
            opt.toolbar1 = 'false';
            opt.toolbar2 = 'false';
            opt.toolbar3 = 'false';
            opt.plugins = 'autolink paste';
        }

        var options = {
            script_url: (window.cordova ? ox.localFileRoot : ox.base) + '/apps/3rd.party/tinymce/tinymce.min.js',

            extended_valid_elements: 'blockquote[type]',
            invalid_elements: 'object,iframe,script',

            inline: true,

            fixed_toolbar_container: fixed_toolbar,

            menubar: false,
            statusbar: false,

            skin: opt.skin,

            toolbar1: opt.toolbar1,
            toolbar2: opt.toolbar2,
            toolbar3: opt.toolbar3,

            relative_urls: false,
            remove_script_host: false,

            entity_encoding: 'raw',

            font_formats: mailUtil.getFontFormats(),
            fontsize_formats: '8pt 10pt 11pt 12pt 13pt 14pt 16pt 18pt 24pt 36pt',

            // simpleLineBreaks = true -> false -> enter insert <br>
            // simpleLineBreaks = false -> 'p' -> enter inserts new paragraph
            // this one is stored in mail settings
            forced_root_block: mailSettings.get('simpleLineBreaks', true) ? /* false */ 'p' : 'p',

            forced_root_block_attrs: { 'style': defaultStyle.string, 'class': 'default-style' },

            browser_spellcheck: true,

            plugins: opt.plugins,

            // link plugin settings
            link_title: false,
            target_list: false,
            link_assume_external_targets: true,

            language: lookupTinyMCELanguage(),

            // disable the auto generation of hidden input fields (we don't need them)
            hidden_input: false,

            theme: opt.theme,

            init_instance_callback: function (editor) {
                ed = editor;
                initialized.resolve();
            },

            execcommand_callback: function (editor_id, elm, command) {
                if (command === 'createlink') {
                    _.defer(function () {
                        $(tinyMCE.get(editor_id).getBody()).find('a').attr({
                            target: '_blank',
                            rel: 'noopener'
                        });
                    });
                }
            },
            // post processing (string-based)
            paste_preprocess: textproc.paste_preprocess,
            // post processing (DOM-based)
            paste_postprocess: textproc.paste_postprocess,

            setup: function (ed) {
                if (opt.oxContext) ed.oxContext = opt.oxContext;
                ext.point(POINT + '/setup').invoke('draw', this, ed);
                ed.on('BeforeRenderUI', function () {
                    rendered.resolve();
                    // toolbar is rendere immediatly after the BeforeRenderUI event. So defer should be invoked after the toolbar is rendered
                    _.defer(function () {
                        // Somehow, this span (without a tabindex) is focussable in firefox (see Bug 53258)
                        toolbar.find('span.mce-txt').attr('tabindex', -1);
                    });
                });
            }
        };

        ext.point(POINT + '/options').invoke('config', options, opt.oxContext);

        require(['3rd.party/tinymce/jquery.tinymce.min']).then(function () {
            editor.tinymce(options);
        });

        function trimEnd(str) {
            return String(str || '').replace(/[\s\xA0]+$/g, '');
        }

        var stripDataAttributes = function (content) {
            return content.replace(/<[a-z][^>]*\sdata-mce.*?>/gi, function (match) {
                // replace all data-mce-* attributes which are written with single or double quotes
                return match.replace(/\sdata-mce-\S+=("[^"]*"|'[^']*')/g, '');
            });
        };

        var resizeEditor = _.debounce(function () {
                if (el === null) return;

                var composeFieldsHeight = el.parent().find('.mail-compose-fields').height();

                if (_.device('smartphone') && $('.io-ox-mobile-mail-compose-window').length > 0) {
                    var containerHeight = el.parent().parent().height();
                    editor.css('min-height', containerHeight - composeFieldsHeight - 32);
                    return;
                } else if (_.device('smartphone')) {

                    editor.css('min-height', window.innerHeight - 232); // sum of standard toolbars etc. calculating this does not work here as most elements are not yet drawn and return falsy values
                    return;
                }

                var h = $(window).height(),
                    top = editor.offset().top,
                    bottomMargin = (el.closest('.io-ox-mail-compose-window').hasClass('header-top') ? 39 : 104);

                editor.css('min-height', h - top - bottomMargin + 'px');
                if (opt.css) editor.css(opt.css);

                var t = $(fixed_toolbar + ' > div'),
                    w = $(fixed_toolbar).next().outerWidth();

                if (t.height()) $(fixed_toolbar).css('height', t.outerHeight());
                if (w) $(fixed_toolbar).css('width', w);
                return;
            }, 30),

            set = function (str) {
                var text = emoji.processEmoji(str, function (text, lib) {
                    if (!lib.loaded) return;
                    ed.setContent(text);
                });
                ed.setContent(text);

                // Remove all position: absolute and white-space: nowrap inline styles
                // This is a fix for the infamous EUROPCAR mail bugs
                // Don't change this if you don't know what you are doing
                if (/position:(\s+)?absolute/i.test(str)) {
                    $(ed.getBody()).find('[style*=absolute]').css('position', 'static');
                }
                if (/white-space:(\s+)?nowrap/i.test(str)) {
                    $(ed.getBody()).find('[style*=nowrap]').css('white-space', 'normal');
                }

            },

            clear = function () {
                set('');
            },

            ln2br = function (str) {
                return String(str || '').replace(/\r/g, '')
                    // '\n' is for IE; do not add for signatures
                    .replace(new RegExp('\\n', 'g'), str.indexOf('io-ox-signature') > -1 ? '\n' : '<br>');
            },

            // get editor content
            // trim white-space and clean up pseudo XHTML
            // remove empty paragraphs at the end
            get = function () {
                // remove tinyMCE resizeHandles
                $(ed.getBody()).find('.mce-resizehandle').remove();

                // get raw content
                var content = ed.getContent({ format: 'raw' });
                // convert emojies
                content = emoji.imageTagsToUnified(content);
                // strip data attributes (incl. bogus attribute)
                content = stripDataAttributes(content);
                // clean up
                content = content
                    .replace(/<(\w+)[ ]?\/>/g, '<$1>')
                    .replace(/(<p>(<br>)?<\/p>)+$/, '');

                // remove trailing white-space, line-breaks, and empty paragraphs
                content = content.replace(
                    /(\s|&nbsp;|\0x20|<br\/?>|<p( class="io-ox-signature")>(&nbsp;|\s|<br\/?>)*<\/p>)*$/g, ''
                );

                // remove trailing white-space
                return trimEnd(content);
            };

        //special handling for alternative mode, send HTML to backend and it will create text/plain part of the mail automagically
        this.content_type = opt.model && opt.model.get('preferredEditorMode') === 'alternative' ? 'ALTERNATIVE' : 'text/html';

        // publish internal 'done'
        this.done = function (fn) {
            var self = this;
            return $.when(initialized, rendered).then(function () {
                fn(self);
                return self;
            });
        };

        this.focus = function () {
            if (_.device('ios')) return;
            _.defer(function () {
                if (!ed) return;
                ed.focus();
                ed.execCommand('mceFocus', false, editorId);
            });
        };

        this.ln2br = ln2br;

        this.clear = clear;

        this.getContent = get;

        this.getPlainText = function () {
            return textproc.htmltotext($(ed.getBody()).html());
        };

        this.setContent = set;

        this.setPlainText = function (str) {
            // clean up
            str = trimEnd(str);
            if (!str) return;
            require(['io.ox/mail/detail/content'], function (proc) {
                set(proc.text2html(str));
                ed.undoManager.clear();
            });
        };

        this.paste = function (str) {
            ed.execCommand('mceInsertClipboardContent', false, { content: str });
        };

        this.scrollTop = function (pos) {
            var doc = $(ed.getDoc());
            if (pos === undefined) {
                return doc.scrollTop();
            } else if (pos === 'top') {
                doc.scrollTop(0);
            } else if (pos === 'bottom') {
                doc.scrollTop(doc.get(0).body.scrollHeight);
            }
        };

        this.setCaretPosition = function () {
            $(ed.getDoc()).scrollTop(0);
        };

        this.appendContent = function (str) {
            var content = this.getContent();
            str = (/^<p/i).test(str) ? str : '<p>' + ln2br(str) + '</p>';
            content = content.replace(/^(<p><br><\/p>){2,}/, '').replace(/(<p><br><\/p>)+$/, '') + '<p><br></p>' + str;
            if (/^<blockquote/.test(content)) {
                content = '<p><br></p>' + content;
            }
            this.setContent(content);
        };

        this.prependContent = function (str) {
            var content = this.getContent();
            str = (/^<p/i).test(str) ? str : '<p>' + ln2br(str) + '</p>';
            content = str + '<p><br></p>' + content.replace(/^(<p><br><\/p>)+/, '').replace(/(<p><br><\/p>){2,}$/, '');
            content = '<p><br></p>' + content;
            this.setContent(content);
        };

        this.setContentParts = function (data, type) {
            var content = '';
            // normalise
            data = _.isString(data) ? { content: data } : data;
            // concat content parts
            if (data.content) content += data.content;
            if (type === 'above' && data.cite) content += ('\n\n' + data.cite);
            if (data.quote) content += ('\n\n' + data.quote || '');
            if (type === 'below' && data.cite) content += ('\n\n' + data.cite);
            this.setContent(content);
        };

        // hint: does not detects the cite block
        this.getContentParts = function () {
            var content = this.getContent(),
                index = content.indexOf('<blockquote type="cite">');
            // special case: initially replied/forwarded text mail
            if (content.substring(0, 15) === '<blockquote><p>') index = 0;
            // special case: switching between signatures in such a mail
            if (content.substring(0, 23) === '<p><br></p><blockquote>') index = 0;
            if (index < 0) return { content: content };
            return {
                // content without trailing whitespace
                content: content.substring(0, index).replace(/\s+$/g, ''),
                quote: content.substring(index),
                cite: undefined
            };
        };

        this.insertPrevCite = function (str) {
            var data = this.getContentParts();
            str = (/^<p/i).test(str) ? str : '<p>' + ln2br(str) + '</p>';
            // add cite
            data.cite = str;
            this.setContentParts(data, 'above');
        };

        this.replaceParagraph = function (str, rep) {
            var content = this.getContent(), pos, top;
            str = (/^<p/i).test(str) ? str : '<p>' + ln2br(str) + '</p>';
            // exists?
            if ((pos = content.indexOf(str)) > -1) {
                // replace content
                top = this.scrollTop();
                this.setContent(content.substr(0, pos) + (rep || '') + content.substr(pos + str.length));
                this.scrollTop(top);
                return true;
            }
            return false;
        };

        this.removeContent = function (str) {
            this.replaceContent(str, '');
        };

        // allow jQuery access
        this.find = function (selector) {
            return $(ed.getBody()).find(selector);
        };

        this.children = function (selector) {
            return $(ed.getBody()).children(selector);
        };

        this.replaceContent = function (str, rep) {

            // adopted from tinyMCE's searchreplace plugin
            var range, win = ed.getWin(),
                found = false;

            function replace() {
                ed.selection.setContent(rep || '');
            }

            ed.selection.select(ed.getBody(), true);
            ed.selection.collapse(true);

            if (_.browser.IE) {
                ed.focus();
                range = ed.getDoc().selection.createRange();
                while (range.findText(str, 1, 0)) {
                    range.scrollIntoView();
                    range.select();
                    replace();
                    found = true;
                }
            } else {
                while (win.find(str, 0, 0, false, false, false, false)) {
                    replace();
                    found = true;
                }
            }

            return found;
        };

        this.getMode = function () {
            return 'html';
        };

        // convenience access
        this.tinymce = function () {
            return editor.tinymce ? editor.tinymce() : {};
        };

        this.show = function () {
            el.show();
            // set display to empty sting because of overide 'display' property in css
            $(fixed_toolbar).css('display', '');
            resizeEditor();
            $(window).on('resize.tinymce', resizeEditor);
            $(window).on('orientationchange.tinymce', function () {
                _.delay(resizeEditor, 50);
            });
        };

        this.hide = function () {
            el.hide();
            $(window).off('resize.tinymce orientationchange.tinymce');
        };

        (function () {
            if (_.device('smartphone')) return;
            var scrollPane = opt.scrollpane || opt.app && opt.app.getWindowNode(),
                fixed = false,
                top = 14;

            scrollPane.on('scroll', function () {
                if (scrollPane.scrollTop() - scrollPane.find('.mail-compose-fields').height() > top) {
                    // toolbar leaves viewport
                    if (!fixed) {
                        fixed = true;
                        toolbar.addClass('fixed').css('top', opt.view.$el.parent().offset().top);
                        $(window).trigger('resize.tinymce');
                    }
                    editor.css('margin-top', toolbar.height());
                } else if (fixed) {
                    fixed = false;
                    toolbar.removeClass('fixed').css('top', 0);
                    editor.css('margin-top', 0);
                }
            });
            scrollPane.on('scroll', _.debounce(function () { $('body').click(); }, 1000, true));
        }());

        this.destroy = function () {
            this.hide();
            clearKeepalive();
            // have to unset active editor manually. may be removed for future versions of tinyMCE
            delete tinyMCE.EditorManager.activeEditor;
            tinyMCE.EditorManager.remove(ed);
            ed = undefined;
        };

        var intervals = [];

        function addKeepalive(id) {
            var timeout = Math.round(settings.get('maxUploadIdleTimeout', 200000) * 0.9);
            intervals.push(setInterval(opt.keepalive || mailAPI.keepalive, timeout, id));
        }

        function clearKeepalive() {
            _(intervals).each(clearInterval);
        }

        editor.on('addInlineImage', function (e, id) { addKeepalive(id); });
    }

    return Editor;
});
