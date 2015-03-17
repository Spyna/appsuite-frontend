/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/folder/selection', [], function () {

    'use strict';

    function Selection(view) {

        this.view = view;

        this.view.$el
            .on('click contextmenu', '.selectable', $.proxy(this.onClick, this))
            .on('keydown', '.selectable', $.proxy(this.onKeydown, this));

        this.view.$el.addClass('dropzone')
            .attr('data-dropzones', '.selectable')
            .on('drop', function (e, baton) {
                baton.dropType = view.module;
                view.selection.trigger('selection:drop', baton);
            });
    }

    _.extend(Selection.prototype, {

        byId: function (id, items) {
            items = items || this.getItems();
            // use first, we might have duplicates
            return items.filter('[data-id="' + $.escape(id) + '"]').first();
        },

        get: function (attribute) {
            return this.view.$el.find('.selectable.selected').attr(attribute || 'data-id');
        },

        set: function (id) {
            var items = this.getItems(),
                node = this.byId(id),
                index = items.index(node);
            // not found?
            if (index === -1) return;
            // check if already selected to avoid event loops.
            // just checking hasClass('selected') doesn't work.
            // we use get() to support duplicates!
            if (this.get() === id) return;
            // go!
            this.resetSelected(items);
            this.pick(index, items, { focus: false });
        },

        // returns true if successful
        preselect: function (id) {
            return this.check(this.byId(id)).length > 0;
        },

        scrollIntoView: function (id) {
            var node = this.byId(id);
            if (node.length) node[0].scrollIntoView(false);
        },

        onClick: function (e) {

            // ignore native checkbox
            if ($(e.target).is(':checkbox')) return;

            // avoid double selections
            if (e.isDefaultPrevented()) return; else e.preventDefault();

            if (e.type === 'contextmenu') e.stopPropagation();

            var items = this.getItems(),
                current = $(e.currentTarget),
                index = items.index(current) || 0;

            // trigger action event
            this.view.trigger('selection:action', items, index);
            // do nothing if already selected
            if (current.hasClass('selected')) return;

            this.resetTabIndex(items, items.eq(index));
            this.resetSelected(items);
            this.pick(index, items);
        },

        onKeydown: function (e) {
            // bubbling?
            if (!$(e.target).hasClass('selectable')) return;
            // cursor up/down
            switch (e.which) {
            case 38:
            case 40:
                this.onCursorUpDown(e);
                break;
            }
        },

        onCursorUpDown: function (e) {

            var items = this.getItems().filter(':visible'),
                current = $(document.activeElement),
                up = e.which === 38,
                index = (items.index(current) || 0) + (up ? -1 : +1);

            if (index >= items.length || index < 0) return;

            // avoid duplicates and unwanted scrolling
            if (e.isDefaultPrevented()) return; else e.preventDefault();

            // sort?
            if (e.altKey && current.parent().parent().attr('data-sortable') === 'true') {
                return this.move(current, up);
            }

            this.resetTabIndex(items, items.eq(index));
            this.resetSelected(items);
            this.pick(index, items);
        },

        move: function (item, up) {
            // move element
            if (up) item.insertBefore(item.prev()); else item.insertAfter(item.next());
            // refocus
            item.focus();
            // get folder and ids
            var folder = item.parent().parent().attr('data-id'),
                ids = _(item.parent().children('.selectable')).map(function (node) {
                    return $(node).attr('data-id');
                });
            // trigger proper event
            this.view.trigger('sort sort:' + folder, ids);
        },

        pick: function (index, items) {
            var node = this.focus(index, items);
            this.check(node);
            this.triggerChange(items);
        },

        resetSelected: function (items) {
            items.filter('.selected').removeClass('selected').attr('aria-selected', false);
        },

        resetTabIndex: function (items, skip) {
            items = items.filter('[tabindex="1"]');
            items.not(skip).attr('tabindex', '-1');
        },

        focus: function (index, items) {
            items = items || this.getItems();
            var node = items.eq(index).attr('tabindex', '1').focus();
            // workaround for chrome's CSS bug:
            // styles of "selected" class are not applied if focus triggers scrolling.
            // idea taken from http://forrst.com/posts/jQuery_redraw-BGv
            if (_.device('chrome')) node.hide(0, function () { $(this).css('display', ''); });
            return node;
        },

        check: function (nodes) {
            return nodes.addClass('selected').attr({ 'aria-selected': true, tabindex: 1 });
        },

        // TODO: isn't this basically the same as resetSelected?
        uncheck: function (nodes) {
            nodes.removeClass('selected').attr({ 'aria-selected': false, tabindex: '-1' });
        },

        getItems: function () {
            return this.view.$el.find('.selectable');
        },

        triggerChange: _.debounce(function (items) {
            var item = (items || this.getItems()).filter('.selected').first(), id = item.attr('data-id'),
                isVirtual = /^virtual/.test(id);
            // trigger change event on view
            this.view.trigger(isVirtual ? 'virtual' : 'change', id, item);
        }, 300)
    });

    return Selection;
});
