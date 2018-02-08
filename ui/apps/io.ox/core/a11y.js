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
 * @author David Bauer <david.bauer@open-xchange.com>
 */

define('io.ox/core/a11y', [], function () {

    'use strict';

    //
    // Focus management
    //

    // fix for role="button"
    $(document).on('keydown.role.button', 'a[role="button"]', function (e) {
        if (!/32/.test(e.which) || e.which === 13 && e.isDefaultPrevented()) return;
        e.preventDefault();
        $(this).click();
    });

    // focus active app from foldertree on <escape> and focus listview on <enter> and <space>
    $(document).on('keydown.foldertree', '.folder-tree .folder.selected', function (e) {
        if (!/13|32|27/.test(e.which)) return;
        if (!$(e.target).is('li')) return;
        var node = $(e.target).closest('.window-container');
        if (node.hasClass('io-ox-mail-window') || node.hasClass('io-ox-files-window')) return;
        if (/13|32/.test(e.which)) {
            e.preventDefault();
            node.find('.list-item.selectable.selected, .list-item.selectable:first, .vgrid-cell.selectable.selected, .vgrid-cell.selectable:first, .vgrid-scrollpane-container, .rightside, .scrollpane.f6-target').first().visibleFocus();
        }
    });

    // Focus foldertree on <escape> when in list-view or vgrid
    $(document).on('keydown.focusFolderTree', '.list-item, .vgrid-scrollpane-container', function (e) {
        if (!/13|32|27/.test(e.which)) return;
        var node = $(e.target).closest('.window-container');
        if (node.hasClass('io-ox-mail-window') || node.hasClass('io-ox-files-window')) return;
        if (e.which === 27) node.find('.folder-tree .folder.selected').focus();
        if (/13|32/.test(e.which)) node.find('.rightside, .list-item.focusable:first').last().visibleFocus();
    });

    $(document).on('keydown.rightside', '.rightside,.scrollpane.f6-target', function (e) {
        if (e.which !== 27) return;
        var node = $(e.target).closest('.window-container');
        if (node.hasClass('io-ox-mail-window') || node.hasClass('io-ox-files-window')) return;
        node.find('.folder-tree .folder.selected, .list-item.selectable.selected, .vgrid-cell.selectable.selected:first, .vgrid-scrollpane-container').last().focus();
    });

    $(document).on('keydown.bs.dropdown.data-api', 'ul.dropdown-menu[role="menu"]', dropdownTrapFocus);

    $(document).on('keydown.launchers', 'ul[role="menubar"], ul[role="tablist"], ul[role="toolbar"]:not(.classic-toolbar), ul.launchers', menubarKeydown);
    $(document).on('keydown.toolbars', 'ul[role="toolbar"].categories', menubarKeydown);

    // listbox

    $(document).on('blur.listbox', 'ul[role="listbox"].listbox', function () {
        $(this).removeAttr('aria-activedescendant');
    });

    $(document).on('keydown.listbox', 'ul[role="listbox"].listbox', function (e) {
        var node = $(e.target).closest('.window-container'),
            $list = $(this),
            active = $('#' + $list.attr('aria-activedescendant'));

        // ESC
        if (/^27$/.test(e.which)) return node.find('.folder-tree .folder.selected').focus();

        // ENTER/SPACE
        if (/^(13|32)$/.test(e.which)) {
            e.preventDefault();
            return node.find('.list-item.selectable.selected, .list-item.selectable:first, .vgrid-cell.selectable.selected, .vgrid-cell.selectable:first, .vgrid-scrollpane-container, .rightside, .scrollpane.f6-target').first().visibleFocus();
        }

        // BACKSPACE/DELETE
        if (/^(8|46)$/.test(e.which)) {
            var cid = active.attr('data-cid');
            if (cid) $list.trigger('remove', cid);
            return;
        }

        // ARROW KEYS
        if (/^(37|38|39|40)$/.test(e.which)) {
            var li = $list.children(),
                next = (/39|40/.test(e.which)) ? active.next() : active.prev(),
                wrap = (/39|40/.test(e.which)) ? li.first() : li.last();

            if (!next.length) next = wrap;

            next.addClass('focussed').attr('aria-selected', true).trigger('click').siblings().removeClass('focussed').removeAttr('aria-selected');
            return $list.attr('aria-activedescendant', next.attr('id'));
        }
    });

    $(document).on('click.listbox', 'ul[role="listbox"].listbox li', function () {
        $(this).parent().attr('aria-activedescendant', $(this).attr('id'));
    });

    $(document).on('mousedown', '.focusable, .scrollable[tabindex]', function (e) {
        respondToNonKeyboardFocus(e.currentTarget);
    });

    $(document).on('click', '.expandable-toggle', function (e) {
        e.preventDefault();
        var node = $(this).closest('.expandable').toggleClass('open');
        var isOpen = node.hasClass('open');
        if (isOpen) node.trigger('open');
        $(this).attr('aria-expanded', isOpen);
    });

    function respondToNonKeyboardFocus(node) {
        node = $(node);
        if (node.is('.scrollable[tabindex],.listbox[tabindex]')) {
            // IE uses borders because it cannot render box-shadows without leaving artifacts all over the place on scrolling (edge doesn't render the shadows at all if there are scrollbars). IE strikes again...
            if (!_.device('ie')) {
                node.css('box-shadow', 'none').on('blur', removeBoxShadow);
            } else {
                node.css('border-style', 'none').on('blur', removeBorder);
                if (node.hasClass('default-content-padding')) {
                    node.addClass('no-padding-adjustment');
                }
            }
        } else if (node.is('.focusable')) {
            node.css('outline', 0).on('blur', removeOutline);
        }
    }

    function removeOutline() {
        $(this).css('outline', '');
    }

    function removeBoxShadow() {
        $(this).css('box-shadow', '');
    }

    function removeBorder() {
        $(this).css('border-style', '');
        $(this).removeClass('no-padding-adjustment');
    }

    var fnFocus = $.fn.focus;
    $.fn.focus = function () {
        fnFocus.apply(this, arguments);
        if (document.activeElement === this[0]) respondToNonKeyboardFocus(this[0]);
        return this;
    };

    $.fn.visibleFocus = function () {
        return fnFocus.apply(this);
    };

    // Accessibility F6 jump
    // do not focus nodes with negative tabindex, or hidden nodes
    $(document).on('keydown.f6', function (e) {
        var tabindexSelector = 'input, select, textarea, button, .launcher a[href], [tabindex]:visible';

        if (e.which === 117 && (_.device('macos') || e.ctrlKey)) {

            e.preventDefault();

            var items = $('#io-ox-core .f6-target:visible'),
                closest = $(document.activeElement).closest('.f6-target'),
                oldIndex = items.index(closest) || 0,
                newIndex = oldIndex,
                nextItem;

            // find next f6-target that is focusable or contains a focusable node
            do {
                newIndex += (e.shiftKey ? -1 : +1);
                if (newIndex >= items.length) newIndex = 0;
                if (newIndex < 0) newIndex = items.length - 1;
                nextItem = items.eq(newIndex);

                if (nextItem.is(tabindexSelector)) {
                    nextItem.visibleFocus();
                    break;
                }

                nextItem = getTabbable(nextItem).first();
                if (nextItem.length) {
                    nextItem.visibleFocus();
                    break;
                }
            } while (oldIndex !== newIndex);
        }
    });

    //
    // Tab trap
    //

    function getTabbable(el) {
        var skip = {},
            items = $(el).find('input, select, textarea, button, a[href], [tabindex]');
        return items
            // radio groups are special
            .filter(function () {
                // just take care of radio buttons
                if (!$(this).is(':radio')) return true;
                // we only need one radio per group
                var name = $(this).attr('name');
                // always have the active/checked element in the list
                if (this === document.activeElement || $(this).is(':checked')) return (skip[name] = true);
                if (skip[name]) return false;
                var group = items.filter('[name="' + $.escape(name) + '"]:radio');
                // wait for active/checked element?
                if (group.index(document.activeElement) > -1 || group.filter(':checked').length) return false;
                return (skip[name] = true);
            })
            .filter(function () {
                // skip tabbable elements of contenteditables
                return !$(this).closest('[contenteditable="true"]').length;
            })
            .filter('[tabindex!="-1"][disabled!="disabled"]:visible');
    }

    function trapFocus(el, e) {
        var items = getTabbable(el);
        if (!items.length) return;
        var index = items.index(document.activeElement),
            catchFirst = e.shiftKey && index === 0,
            catchLast = index === items.length - 1;
        // only jump in if first or last item; radio groups are a problem otherwise
        if (!catchFirst && !catchLast) return;
        e.preventDefault();
        index += (e.shiftKey) ? -1 : 1;
        index = (index + items.length) % items.length;
        items.eq(index).focus();
    }

    function dropdownTrapFocus(e) {

        var dropdown = $(e.target).closest('ul.dropdown-menu'),
            dropdownLinks = dropdown.find('> li:visible > a'),
            firstLink = dropdownLinks.first(),
            lastLink = dropdownLinks.last(),
            isLastLink = $(e.target).is(lastLink),
            isFirstLink = $(e.target).is(firstLink);

        // do nothing if there is only one link
        if (dropdownLinks.length === 1) return;

        // a11y - trap focus in context menu - prevent tabbing out of context menu
        if ((!e.shiftKey && e.which === 9 && isLastLink) ||
            (e.shiftKey && e.which === 9 && isFirstLink)) {
            return trapFocus(dropdown, e);
        }

        // cursor up (38), page down (34), end (35)
        if (e.which === 38 && isFirstLink || e.which === 34 || e.which === 35) {
            e.stopImmediatePropagation();
            return lastLink.focus();
        }
        // cursor down (40), page up (33), home (36)
        if (e.which === 40 && isLastLink || e.which === 33 || e.which === 36) {
            e.stopImmediatePropagation();
            return firstLink.focus();
        }
        hotkey(e, dropdownLinks);
    }

    function hotkey(e, el) {
        // Typing a character key moves focus to the next node whose title begins with that character
        if (!el.filter(':focus').length) return;
        var nextFocus,
            a = el.map(function () {
                var linkText = $(this).text() || $(this).attr('aria-label');
                if (!linkText) return;
                if (linkText.substring(0, 1).toLowerCase() === String.fromCharCode(e.which).toLowerCase()) return $(this);
            });
        if (!a.length) return; else if (a.length === 1) return a[0].focus();
        _.find(a, function (el, idx) {
            if (el.is(':focus') && (idx >= 0 && idx < a.length - 1)) nextFocus = a[idx + 1];
        });
        (nextFocus || a[0]).focus();
    }

    function cursorHorizontalKeydown(e, el) {
        if (!/^(37|39)$/.test(e.which)) return;
        var idx = el.index(el.filter(':focus'));
        if (e.which === 37) idx--; else idx++;
        if (idx < 0) idx = el.length - 1;
        if (idx === el.length) idx = 0;
        return el.eq(idx).focus();
    }

    function menubarKeydown(e) {
        if (e.which === 9 || e.which === 16 && e.shiftKey) return;
        // space on role="button" is already handled
        if (e.which === 32 && $(e.target).attr('role') !== 'button') $(e.target).click(); // space
        var links = $(e.currentTarget).find('> li:visible > a, > li:visible > button');
        cursorHorizontalKeydown(e, links);
        hotkey(e, links);
    }

    function collapse(action, content, opt) {
        // https://getbootstrap.com/javascript/#collapse
        // https://www.w3.org/TR/wai-aria-practices-1.1/examples/accordion/accordion1.html
        opt = _.extend({ expanded: false }, opt);
        var actionid = _.uniqueId('action'),
            contentid = _.uniqueId('content');
        action.addClass('collapsed')
            .prop('id', actionid)
            .attr({
                'data-target': '#' + contentid,
                'data-toggle': 'collapse',
                'aria-expanded': false,
                'aria-controls': contentid
            });
        content.addClass('collapse')
            .addClass(opt.expanded ? 'in' : '')
            .prop('id', contentid)
            .attr({
                'role': 'region',
                'aria-labelledby': actionid
            })
            .append(content);
        // listeners
        if (!opt.onChange || !_.isFunction(opt.onChange)) return;
        content.on('show.bs.collapse shown.bs.collapse hide.bs.collapse hidden.bs.collapse', function (e) {
            opt.onChange.call(content, e.type);
        });
        // propagate inital state
        opt.onChange.call(content, opt.expanded ? 'show' : 'hide');
    }

    return {
        collapse: collapse,
        dropdownTrapFocus: dropdownTrapFocus,
        getTabbable: getTabbable,
        menubarKeydown: menubarKeydown,
        trapFocus: trapFocus
    };
});
