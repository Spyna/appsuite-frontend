/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2017 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Richard Petersen <richard.petersen@open-xchange.com>
 */
define('io.ox/contacts/actions/print', [
    'io.ox/core/extensions',
    'io.ox/backbone/mini-views',
    'gettext!io.ox/contacts',
    'io.ox/core/print',
    'settings!io.ox/contacts'
], function (ext, mini, gt, print, settings) {

    'use strict';

    var map = {
        'simple': 'io.ox/contacts/print',
        'details': 'io.ox/contacts/print-details'
    };

    ext.point('io.ox/contacts/actions/print/dialog').extend({
        id: 'preview',
        index: 100,
        render: function (baton) {
            var $preview, def = new $.Deferred();
            this.$body.addClass('row').append(
                $('<div class="col-xs-offset-1 col-xs-6">').append(
                    $preview = $('<iframe tabindex="-1">')
                    .attr({
                        title: gt('Print preview'),
                        src: ox.base + '/print.html'
                    }).on('load', def.resolve)
                ),
                $('<div class="col-xs-5">').append(
                    new mini.CustomRadioView({
                        model: this.model,
                        name: 'list-type',
                        list: [{
                            value: 'simple',
                            label: gt('Phone list')
                        }, {
                            value: 'details',
                            //#. the user selects, whether to print a simple phonelist or a detailed contact list.
                            label: gt.pgettext('contact-print-dialog', 'Details')
                        }]
                    }).render().$el
                )
            );

            // add scaling info to body of iframe, as soon as iframe has been loaded
            def.done(function () {
                $preview.contents().find('body').addClass('scaled-preview');
            });

            this.listenTo(this.model, 'change:list-type', function () {
                var printFile = map[this.model.get('list-type')] || 'io.ox/contacts/print';
                $.when(require([printFile]), def).done(function (print) {
                    var options = print.getOptions(baton.view.options.list),
                        template = $preview.contents().find(options.selector).html(),
                        body = $preview.contents().find('body');
                    $.when.apply($,
                        _.chain(options.selection)
                        .map(function getCID(obj) {
                            return _.isString(obj) ? obj : _.cid(obj);
                        })
                        .uniq()
                        .map(function getData(cid, index) {
                            return options.get(_.cid(cid)).then(function (obj) {
                                return options.process ? options.process(obj, index, options) : obj;
                            });
                        })
                        .value()
                    )
                    .done(function () {
                        var args = _.chain(arguments).toArray(), all = args.value().length;
                        if (options.filter) args = args.filter(options.filter);
                        if (options.sortBy) args = args.sortBy(options.sortBy);
                        // stop chaining
                        args = args.value();

                        body.find('.print-wrapper').remove();
                        body.prepend($('<div class="print-wrapper">' + $.trim(_.template(template)({
                            data: args,
                            i18n: options.i18n,
                            length: args.length,
                            filtered: all - args.length
                        })) + '</div>'));
                        // remove notes in preview
                        body.find('.note').remove();
                    });
                });
            });
        }
    });

    return {
        multiple: function (list) {
            require(['io.ox/backbone/views/modal'], function (ModalDialogView) {
                new ModalDialogView({
                    model: new Backbone.Model({ 'list-type': settings.get('contactsPrintLayout') }),
                    title: gt('Select print layout'),
                    point: 'io.ox/contacts/actions/print/dialog',
                    list: _(list).first(40)
                })
                .build(function () {
                    this.$el.addClass('io-ox-contact-print-dialog');
                })
                .addCancelButton()
                .addButton({ label: gt('Print'), action: 'print' })
                .on('print', function () {
                    var printFile = map[this.model.get('list-type')] || 'io.ox/contacts/print';
                    print.request(printFile, list);
                    if (this.model.get('list-type') !== settings.get('contactsPrintLayout')) {
                        settings.set('contactsPrintLayout', this.model.get('list-type')).save();
                    }
                })
                .on('open', function () {
                    // trigger a change list on open to set the initial content of the iframe
                    // must be triggered, when the iframe is already in the dom
                    this.model.trigger('change:list-type');
                })
                .open();
            });
        }
    };

});
