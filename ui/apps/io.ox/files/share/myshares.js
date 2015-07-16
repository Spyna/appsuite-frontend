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
 * @author Christoph Hellweg <christoph.hellweg@open-xchange.com>
 */

 define('io.ox/files/share/myshares', [
    'io.ox/core/extensions',
    'io.ox/backbone/disposable',
    'io.ox/files/share/model',
    'io.ox/files/share/api',
    'io.ox/core/folder/breadcrumb',
    'io.ox/backbone/mini-views/dropdown',
    'gettext!io.ox/files',
    'less!io.ox/files/share/style'
], function (ext, DisposableView, sModel, api, BreadcrumbView, Dropdown, gt) {

    'use strict';

    var INDEX = 0,
        POINT = 'io.ox/files/share/myshares';

    /*
     * extension point share type
     */
    ext.point(POINT + '/fields').extend({
        id: 'header',
        index: INDEX += 100,
        draw: function (baton) {
            var dropdown = new Dropdown({ model: baton.model, label: gt('Sort by') })
                .option('sort', 'nameUp', gt('Name up'))
                .option('sort', 'nameDown', gt('Name down'))
                .option('sort', 'dateUp', gt('Date up'))
                .option('sort', 'dateDown', gt('Date down'));
            this.append(
                $('<fieldset>').append(
                    $('<legend>').text(gt('My shares')),
                    dropdown.render().$el,
                    baton.view.$ul
                )
            );
        }
    });

    /*
     * extension point share icon
     */
    ext.point(POINT + '/share').extend({
        id: 'icon',
        index: INDEX += 100,
        draw: function (baton) {
            this.append(
                $('<div class="icon">').append(
                    $('<i class="fa fa-' + (baton.view.model.isFolder() ? 'folder' : 'file') + '">')
                )
            );
        }
    });

    /*
     * extension point share info
     */
    ext.point(POINT + '/share').extend({
        id: 'info',
        index: INDEX += 100,
        draw: function (baton) {
            var model = baton.view.model,
                breadcrumb = new BreadcrumbView({ folder: model.get('target').folder, exclude: ['9'], notail: true });

            breadcrumb.handler = function (id) {
                // launch files and set/change folder
                ox.launch('io.ox/files/main', { folder: id }).done(function () {
                    this.folder.set(id);
                });
            };

            this.append(
                $('<div class="info">').append(
                    $('<div class="filename">').text(model.isFolder() ? 'Foldername' : 'Filename'),
                    breadcrumb.render().$el,
                    $('<div class="url">').text(model.get('share_url'))
                )
            );
        }
    });

    /*
     * extension point share date
     */
    ext.point(POINT + '/share').extend({
        id: 'date',
        index: INDEX += 100,
        draw: function (baton) {
            var created = moment(baton.view.model.get('created'));
            this.append(
                $('<time class="date">')
                    .attr('datetime', created.toISOString())
                    .text(_.noI18n(created.format('L')))
            );
        }
    });

    /*
     * extension point share actions
     */
    ext.point(POINT + '/share').extend({
        id: 'actions',
        index: INDEX += 100,
        draw: function () {
            this.append(
                $('<div class="actions">').append(
                    $('<a href="#" class="toggleUrl">').append(
                        $('<span class="sr-only">').text(gt('show link')),
                        $('<i class="fa fa-external-link" aria-hidden="true">')
                    ),
                    $('<a href="#" class="edit">').append(
                        $('<span class="sr-only">').text(gt('edit share')),
                        $('<i class="fa fa-gear" aria-hidden="true">')
                    ),
                    $('<a href="#" class="remove">').append(
                        $('<span class="sr-only">').text(gt('remove share')),
                        $('<i class="fa fa-trash" aria-hidden="true">')
                    )
                )
            );
        }
    });

    /*
     * simple share view
     */
    var SharesView = DisposableView.extend({

        tagName: 'li',

        className: 'share-view',

        events: {
            'click .actions .toggleUrl': 'toggleUrl',
            'click .actions .remove': 'onRemove',
            'click .actions .edit': 'onEdit',
            'keydown': 'fnKey'
        },

        initialize: function () {

            this.baton = ext.Baton({
                view: this
            });

            this.listenTo(this.model, 'change', function (model) {
                if (model && model.changed) {
                    this.$el.empty();
                    this.render();
                }
            });

            this.listenTo(this.model, 'remove', function () {
                this.remove();
            });

        },

        render: function () {
            var wrapper = $('<div class="share-wrapper">');

            this.$el.append(wrapper);

            // draw all extensionpoints
            ext.point(POINT + '/share').invoke('draw', wrapper, this.baton);

            return this;
        },

        fnKey: function (e) {
            // del or backspace
            if (e.which === 46 || e.which === 8) this.onRemove(e);
        },

        onRemove: function (e) {
            e.preventDefault();
            this.model.destroy();
        },

        onEdit: function (e) {
            e.preventDefault();
            console.log('edit', this.model);
        },

        toggleUrl: function (e) {
            e.preventDefault();
            this.$el.find('.url').toggle();
        }

    });

    /*
     * main sharing view
     */
    var MySharesView = DisposableView.extend({

        tagName: 'div',

        className: 'abs myshares-view',

        initialize: function (options) {

            this.options = _.extend({ module: 'files' }, options);

            this.baton = ext.Baton({
                view: this,
                model: new Backbone.Model()
            });

            this.$ul = $('<ul class="list-unstyled">');

            this.collection = new sModel.Shares();

            this.listenTo(this.collection, 'reset sort', this.updateShares);

            this.listenTo(ox, 'refresh^', this.getShares);

            this.listenTo(this.baton.model, 'change:sort', this.sortBy);

        },

        render: function () {

            // draw all extensionpoints
            ext.point(POINT + '/fields').invoke('draw', this.$el, this.baton);

            this.getShares();

            return this;

        },

        getShares: function () {
            var self = this;
            return api.all().then(function (data) {
                self.collection.reset(data);
            });
        },

        sortBy: function (model, by) {
            switch (by) {
                case 'dateUp':
                    this.collection.comparator = function (share) {
                        return share.get('created');
                    };
                    break;
                case 'dateDown':
                    this.collection.comparator = function (share) {
                        return -share.get('created');
                    };
                    break;
                case 'nameUp':
                    this.collection.comparator = function (share) {
                        return share.get('created');
                    };
                    break;
                case 'nameDown':
                    this.collection.comparator = function (share) {
                        return -share.get('created');
                    };
                    break;
                default:
            }
            this.collection.sort();
        },

        updateShares: function () {
            var self = this;
            this.$ul.empty();
            this.collection.each(function (share) {
                self.$ul.append(
                    new SharesView({
                        model: share
                    }).render().$el
                );
            });
        }

    });

    return MySharesView;
});
