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
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define('io.ox/mail/vacationnotice/settings/view-form', [
    'io.ox/mail/vacationnotice/settings/model',
    'io.ox/backbone/views',
    'io.ox/core/extensions',
    'io.ox/backbone/mini-views',
    'less!io.ox/mail/vacationnotice/settings/style'
], function (model, views, ext, mini) {

    'use strict';

    function createVacationEdit(ref, multiValues) {
        var point = views.point(ref + '/edit/view'),
            VacationEditView = point.createView({
                tagName: 'div',
                className: 'edit-vacation'
            });

        ext.point(ref + '/edit/view').extend({
            index: 50,
            id: 'headline',
            draw: function () {
                this.append($('<div>').append(
                    $('<h1>').text(model.fields.headline)
                ));
            }
        });

        ext.point(ref + '/edit/view').extend({
            index: 150,
            id: ref + '/edit/view/subject',
            draw: function (baton) {
                this.append(
                    $('<div>').addClass('form-group').append(
                        $('<label for="subject">').text(model.fields.subject),
                        new mini.InputView({ name: 'subject', model: baton.model, className: 'form-control', id: 'subject' }).render().$el
                    )
                );
            }
        });

        ext.point(ref + '/edit/view').extend({
            index: 200,
            id: ref + '/edit/view/mailtext',
            draw: function (baton) {
                this.append(
                    $('<div>').addClass('form-group').append(
                        $('<label for="text">').text(model.fields.text),
                        new mini.TextView({ name: 'text', model: baton.model, id: 'text', rows: '12' }).render().$el
                    )
                );
            }
        });

        ext.point(ref + '/edit/view').extend({
            index: 250,
            id: ref + '/edit/view/days',
            draw: function (baton) {
                this.append(
                    $('<div>').addClass('form-horizontal').append(
                        $('<div>').addClass('form-group').append(
                            $('<label>').attr({ 'for': 'days' }).addClass('control-label col-md-offset-2 col-md-8').text(model.fields.days),
                            $('<div>').addClass('col-md-2').append(
                                new mini.SelectView({ list: multiValues.days, name: 'days', model: baton.model, id: 'days', className: 'form-control' }).render().$el
                            )
                        )
                    )
                );
            }
        });

        ext.point(ref + '/edit/view').extend({
            index: 300,
            id: ref + '/edit/view/addresses',
            draw: function (baton) {

                var checkboxes = [];

                _(multiValues.aliases).each(function (alias) {
                    checkboxes.push(
                        $('<div>').addClass('checkbox').append(
                            $('<label>').addClass('control-label blue').text(alias).append(
                                new mini.CheckboxView({ name: alias, model: baton.model }).render().$el
                            )
                        )
                    );
                });

                this.append(
                    $('<fieldset>').append(
                        $('<legend>').addClass('sectiontitle').text(model.fields.headlineAdresses),
                        checkboxes
                    )
                );
            }
        });

        model.api.getConfig().done(function (data) {
            var isAvailable = false;
            _(data.tests).each(function (test) {
                if (test.test === 'currentdate') {
                    isAvailable = true;
                }
            });

            if (isAvailable) {

                // point.extend(new forms.CheckBoxField({
                //     id: ref + '/edit/view/timeframecheckbox',
                //     index: 425,
                //     label: model.fields.activateTimeFrame,
                //     attribute: 'activateTimeFrame',
                //     customizeNode: function () {
                //         var self = this;

                //         this.$el.on('change', function () {
                //             var fields = $('.edit-vacation').find('.input-sm');

                //             if (self.$el.find('input').prop('checked') !== true) {
                //                 fields.prop('disabled', true);
                //             } else {
                //                 fields.prop('disabled', false);
                //             }
                //         });
                //     }
                // }));

                ext.point(ref + '/edit/view').extend({
                    index: 425,
                    id: ref + '/edit/view/timeframecheckbox',
                    draw: function (baton) {
                        this.append(
                            $('<fieldset>').append(
                                $('<div>').addClass('checkbox').append(
                                    $('<label>').addClass('control-label').text(model.fields.activateTimeFrame).append(
                                        new mini.CheckboxView({ name: 'activateTimeFrame', model: baton.model }).render().$el
                                    )
                                )
                            )
                        );
                    }
                });

                ext.point(ref + '/edit/view').extend({
                    index: 450,
                    id: ref + '/edit/view/start_date',
                    draw: function (baton) {
                        this.append(
                            $('<fieldset class="col-md-12 form-group dateFrom">').append(
                                $('<legend class="simple">').text(model.fields.dateFrom),
                                // don't wrap the date control with a label (see bug #27559)
                                new mini.DateView({ name: 'dateFrom', model: baton.model }).render().$el
                            )
                        );
                    }
                });

                ext.point(ref + '/edit/view').extend({
                    index: 500,
                    id: ref + '/edit/view/end_date',
                    draw: function (baton) {
                        this.append(
                            $('<fieldset class="col-md-12 form-group dateUntil">').append(
                                $('<legend class="simple">').text(model.fields.dateUntil),
                                // don't wrap the date control with a label (see bug #27559)
                                new mini.DateView({ name: 'dateUntil', model: baton.model }).render().$el
                            )
                        );
                    }
                });

                // point.extend(new DatePicker({
                //     id: ref + '/edit/view/end_date',
                //     index: 500,
                //     className: 'col-md-2',
                //     labelClassName: 'timeframe-edit-label',
                //     display: 'DATE',
                //     attribute: 'dateUntil',
                //     label: model.fields.dateUntil,
                //     initialStateDisabled: timeFrameState ? false : true
                // }));

            }
        });

        return VacationEditView;
    }

    return {
        protectedMethods: {
            createVacationEdit: createVacationEdit
        }
    };

});
