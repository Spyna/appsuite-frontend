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

define('io.ox/mail/categories/tabs', [
    'io.ox/mail/categories/api',
    'io.ox/mail/api',
    'io.ox/core/yell',
    'io.ox/core/tk/list-dnd',
    'gettext!io.ox/mail'
], function (api, mailAPI, yell, dnd, gt) {

    'use strict';

    var TabView = Backbone.View.extend({

        tagName: 'ul',
        className: 'classic-toolbar categories',

        events: {
            'click .category .link': 'onChangeTab',
            'contextmenu .category': 'onConfigureCategories',
            'dblclick .category': 'onConfigureCategories',
            'selection:drop': 'onMove'
        },

        initialize: function (options) {

            // reference to app props
            this.props = options.props;
            this.collection = api.collection;

            // a11y
            this.$el.attr({ 'role': 'menu', 'aria-label': gt('Inbox categories') });

            // dnd
            dnd.enable({ draggable: true, container: this.$el, selection: this.selection, delegate: true, dropzone: true, dropzoneSelector: '.category' });

            // register events
            this.listenTo(api, 'move', this.openTrainNotification);
            this.listenTo(this.collection, 'update reset change', _.debounce(this.render, 200));
            this.listenTo(this.props, 'change:category_id', this.onCategoryChange);
        },

        render: function () {

            var current = this.props.get('category_id');

            this.$el.empty().append(
                this.collection.map(function (model) {
                    return $('<li class="category">')
                        .append(
                            $('<a href="#" class="link" role="button">').append(
                                $('<div class="category-icon">'),
                                $('<div class="category-name truncate">').text(model.get('name')),
                                $('<div class="category-counter">').append(
                                    $('<span class="counter">').text(model.getCount())
                                )
                            ),
                            $('<div class="category-drop-helper">').text(gt('Drop here!'))
                        )
                        .toggle(model.isEnabled())
                        .toggleClass('selected', model.get('id') === current)
                        .attr({ 'data-id': model.get('id') });
                }),
                $('<li class="free-space" aria-hidden="true">')
            );
            return this;
        },

        onChangeTab: function (e) {
            e.preventDefault();
            var id = $(e.currentTarget).parent().attr('data-id');
            this.props.set('category_id', id);
        },

        onCategoryChange: function (props, id) {
            this.$('.category.selected').removeClass('selected');
            this.$('.category[data-id="' + id + '"]').addClass('selected');
        },

        onConfigureCategories: function (e) {
            e.preventDefault();
            require(['io.ox/mail/categories/edit'], function (dialog) {
                dialog.open();
            });
        },

        onMove: function (e, baton) {

            // prevent execution of copy/move handler
            e.stopPropagation();

            var source = this.props.get('category_id'),
                target = baton.target,
                options = {
                    data: mailAPI.resolve(baton.data),
                    source: source,
                    sourcename: this.collection.get(source).get('name'),
                    target: target,
                    targetname: this.collection.get(target).get('name')
                };

            api.move(options).fail(yell);
        },

        openTrainNotification: function (options) {
            require(['io.ox/mail/categories/train'], function (dialog) {
                dialog.open(options);
            });
        }
    });

    return TabView;
});
