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
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 * @author Tobias Prinz <tobias.prinz@open-xchange.com>
 */

define('plugins/portal/calendar/register', [
    'io.ox/core/extensions',
    'io.ox/calendar/api',
    'io.ox/core/folder/api',
    'io.ox/calendar/util',
    'gettext!plugins/portal',
    'settings!io.ox/calendar'
], function (ext, api, folderAPI, util, gt, settings) {

    'use strict';

    var EventsView = Backbone.View.extend({

        tagName: 'ul',

        className: 'content list-unstyled',

        initialize: function () {
            this.listenTo(this.collection, 'add remove change reset', this.render);
        },

        render: function () {
            var self = this,
                numOfItems = _.device('smartphone') ? 5 : 10;
            this.$el.empty();
            this.collection
                .chain()
                .filter(function (model) {
                    return model.getTimestamp('startDate') > _.now();
                })
                .first(numOfItems)
                .each(function (model) {
                    var declined = util.getConfirmationStatus(model) === 'DECLINED';
                    if (settings.get('showDeclinedAppointments', false) || !declined) {
                        var timespan = util.getSmartDate(model, true);

                        self.$el.append(
                            $('<li class="item" tabindex="0">')
                            .css('text-decoration', declined ? 'line-through' : 'none')
                            .data('item', model)
                            .append(
                                $('<span class="normal accent">').text(timespan), $.txt('\u00A0'),
                                $('<span class="bold">').text(model.get('summary') || ''), $.txt('\u00A0'),
                                $('<span class="gray">').text(model.get('location') || '')
                            )
                        );
                    }
                })
                .value();

            return this;
        }

    });

    function getRequestParams() {
        return {
            start: moment().startOf('day').valueOf(),
            end: moment().startOf('day').add(1, 'month').valueOf()
        };
    }

    ext.point('io.ox/portal/widget/calendar').extend({

        title: gt('Appointments'),

        initialize: function (baton) {
            baton.collection = api.getCollectionLoader('portal').getCollection(getRequestParams());
        },

        load: function () {
            var def = new $.Deferred();

            api.getCollectionLoader('portal')
                .load(getRequestParams())
                .once('load', function () {
                    def.resolve();
                    this.off('load:fail');
                })
                .once('load:fail', function (error) {
                    def.reject(error);
                    this.off('load');
                });

            return def;
        },

        summary: function (baton) {
            if (this.find('.summary').length) return;

            this.addClass('with-summary show-summary');

            var sum = $('<div>').addClass('summary');

            if (baton.data.length === 0) {
                sum.text(gt('You don\'t have any appointments in the near future.'));
            } else {
                var model = _(baton.data).first();

                sum.append(
                    $('<span class="normal accent">').text(util.getSmartDate(model, true)), $.txt('\u00A0'),
                    $('<span class="bold">').text(model.get('summary') || ''), $.txt('\u00A0'),
                    $('<span class="gray">').text(model.get('location') || '')
                );

                this.on('tap', 'h2', function (e) {
                    $(e.delegateTarget).toggleClass('show-summary');
                });
            }

            this.append(sum);
        },

        preview: function (baton) {
            var collection = baton.collection;

            if (collection.length === 0) {
                this.append(
                    $('<ul class="content list-unstyled">').append(
                        $('<li class="line">')
                        .text(gt('You don\'t have any appointments in the near future.'))
                    )
                );
            } else {
                this.append(new EventsView({
                    collection: collection
                }).render().$el);
            }
        },

        draw: function (baton) {
            var popup = this.busy();
            require(['io.ox/calendar/view-detail'], function (view) {
                var model = baton.item;
                popup.idle().append(view.draw(model, { deeplink: true }));
            });
        },

        post: function (ext) {
            var self = this;
            api.on('refresh.all', function () {
                ext.load().done(_.bind(ext.draw, self));
            });
        }
    });

    ext.point('io.ox/portal/widget/calendar/settings').extend({
        title: gt('Appointments'),
        type: 'calendar',
        editable: false,
        unique: true
    });

});
