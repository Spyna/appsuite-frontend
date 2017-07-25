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
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/mail/mailfilter/vacationnotice/view', [
    'io.ox/mail/mailfilter/vacationnotice/model',
    'io.ox/core/api/mailfilter',
    'io.ox/backbone/views',
    'io.ox/core/extensions',
    'io.ox/backbone/mini-views',
    'io.ox/backbone/views/modal',
    'io.ox/core/settings/util',
    'io.ox/core/yell',
    'io.ox/core/api/user',
    'io.ox/contacts/util',
    'settings!io.ox/mail',
    'gettext!io.ox/mail',
    'less!io.ox/mail/mailfilter/vacationnotice/style'
], function (Model, api, views, ext, mini, ModalView, util, yell, userAPI, contactsUtil, settings, gt) {

    'use strict';

    var POINT = 'io.ox/mail/vacation-notice/edit',
        INDEX = 0,
        INDEX_RANGE = 0,
        INDEX_ADV = 0;

    function open() {
        return getData().then(openModalDialog, fail);
    }

    function fail(e) {
        yell('error', e.code === 'MAIL_FILTER-0015' ?
            gt('Unable to load mail filter settings.') :
            gt('Unable to load your vacation notice. Please retry later.')
        );
        throw e;
    }

    function openModalDialog(data) {

        return new ModalView({
            async: true,
            focus: 'input[name="active"]',
            model: data.model,
            point: POINT,
            title: gt('Vacation notice'),
            width: 640
        })
        .inject({
            updateActive: function () {
                var enabled = this.model.get('active');
                this.$body.toggleClass('disabled', !enabled).find(':input').prop('disabled', !enabled);
                this.updateDateRange();
            },
            updateDateRange: function () {
                var enabled = this.model.get('active') && this.model.get('activateTimeFrame');
                this.$('.date-range .form-control').prop('disabled', !enabled);
            },
            getAddresses: function () {
                var name = contactsUtil.getMailFullName(this.data.user).trim();
                return [].concat(
                    // default sender
                    { value: 'default', label: gt('Default sender') },
                    // aliases
                    _(this.data.aliases).map(function (address) {
                        address = name ? name + ' <' + address + '>' : address;
                        return { value: address, label: address };
                    })
                );
            },
            getDurationString: function () {
                var duration = this.model.getDuration();
                return duration > 0 ? gt.ngettextf('%1$d day', '%1$d days', duration) : '';
            },
            getTimeFrameError: function () {
                var error = this.model.validate();
                return (error && error.dateUntil) || '';
            },
            reflectValidity: function () {
                var error = (this.model.validationError || {}).dateUntil;
                this.$('.error-message > .help-block').text(error).parent().toggle(!!error);
                this.$('[name="dateUntil"]').parent().toggleClass('has-error', !!error);
                this.$('.btn-primary[data-action="save"]').prop('disabled', !!error);
            }
        })
        .build(function () {
            this.data = _(data).pick('aliases', 'config', 'user');
            this.$el.addClass('rule-dialog');
        })
        .addCancelButton()
        .addButton({ label: gt('Apply changes'), action: 'save' })
        .on('open', function () {
            this.updateActive();
        })
        .on('save', function () {
            this.model.save().done(this.close).fail(this.idle).fail(yell);
        })
        .open();
    }

    ext.point(POINT).extend(
        //
        // switch
        //
        {
            index: INDEX += 100,
            id: 'switch',
            render: function () {

                this.$header.prepend(
                    new mini.SwitchView({ name: 'active', model: this.model, label: '', size: 'large' })
                        .render().$el.attr('title', gt('Enable or disable vacation notice'))
                );

                this.listenTo(this.model, 'change:active', this.updateActive);
            }
        },
        //
        // Time range
        //
        {
            index: INDEX += 100,
            id: 'range',
            render: function (baton) {
                // supports date?
                if (!_(this.data.config.tests).findWhere({ test: 'currentdate' })) return;
                this.$body.append(
                    baton.branch('range', this, $('<div class="form-group date-range">'))
                );
            }
        }
    );

    ext.point(POINT + '/range').extend(
        //
        // Date range / checkbox
        //
        {
            index: INDEX_RANGE += 100,
            id: 'checkbox',
            render: function (baton) {

                this.listenTo(baton.model, 'change:activateTimeFrame', function () {
                    this.updateDateRange();
                });

                baton.$el.append(
                    util.checkbox('activateTimeFrame', gt('Send vacation notice during this time only'), baton.model)
                );
            }
        },
        //
        // Date range / from & until
        //
        {
            index: INDEX_RANGE += 100,
            id: 'from-util',
            render: function (baton) {

                var labels = { dateFrom: gt('Start'), dateUntil: gt('End') };

                baton.$el.append(
                    $('<div class="row">').append(
                        ['dateFrom', 'dateUntil'].map(function (id) {
                            return $('<div class="col-md-4">').append(
                                $('<label class="control-label">').attr('for', 'vacation_notice_' + id).text(labels[id]),
                                new mini.DateView({ name: id, model: baton.model, id: 'vacation_notice_' + id })
                                    .render().$el
                                    .prop('disabled', !baton.model.get('activateTimeFrame'))
                            );
                        })
                    )
                );

                this.listenTo(this.model, 'change:dateFrom', function (model, value) {
                    var length = (model.get('dateUntil') - model.previous('dateFrom')) || 0;
                    model.set('dateUntil', value + length);
                });
            }
        },
        //
        // Show length indicator
        //
        {
            index: INDEX_RANGE += 100,
            id: 'days',
            render: function (baton) {

                if (_.device('smartphone')) return;

                baton.$el.find('.row:last').append(
                    $('<div class="col-md-4 duration">').text(this.getDurationString())
                );

                baton.$el.append(
                    $('<div class="row error-message has-error">').hide().append(
                        $('<div class="col-md-8 col-md-offset-4 help-block">')
                    )
                );

                this.listenTo(this.model, 'change:dateFrom change:dateUntil change:active change:activateTimeFrame', function () {
                    this.$('.duration').text(this.getDurationString());
                    // trigger internal validation
                    if (this.model.isValid()) this.reflectValidity();
                });

                this.listenTo(this.model, 'invalid', this.reflectValidity);
            }
        }
    );

    ext.point(POINT).extend(
        //
        // Subject
        //
        {
            index: INDEX += 100,
            id: 'subject',
            render: function (baton) {
                this.$body.append(
                    $('<div class="form-group">').append(
                        $('<label for="vacation_notice_subject">').append(gt('Subject')),
                        new mini.InputView({ name: 'subject', model: baton.model, id: 'vacation_notice_subject' }).render().$el
                    )
                );
            }
        },
        //
        // Mail text
        //
        {
            index: INDEX += 100,
            id: 'text',
            render: function (baton) {
                this.$body.append(
                    $('<div class="form-group">').append(
                        $('<label for="vacation_notice_text">').text(gt('Message')),
                        new mini.TextView({ name: 'text', model: baton.model, id: 'vacation_notice_text', rows: 6 }).render().$el
                    )
                );
            }
        },
        //
        // Advanced section
        //
        {
            index: INDEX += 100,
            id: 'advanced',
            render: function (baton) {

                this.$body.append(
                    $('<div>').append(
                        $('<button type="button" class="btn btn-link">')
                        .text('Show advanced options')
                        .on('click', onClick)
                    ),
                    baton.branch('advanced', this, $('<div class="form-group">').hide())
                );

                function onClick() {
                    $(this).parent().next().show().find(':input:first').focus();
                    $(this).remove();
                }
            }
        }
    );

    ext.point(POINT + '/advanced').extend(
        //
        // Days
        //
        {
            index: INDEX_ADV += 100,
            id: 'days',
            render: function (baton) {

                var days = _.range(1, 32).map(function (i) { return { label: i, value: i }; });

                baton.$el.append(
                    $('<div class="form-group row">').append(
                        //#. Context: Vacation notices
                        $('<label for="vacation_notice_days" class="col-md-12">').text(gt('Days between notices to the same sender')),
                        $('<div class="col-md-4">').append(
                            new mini.SelectView({ list: days, name: 'days', model: baton.model, id: 'vacation_notice_days' }).render().$el
                        )
                    )
                );
            }
        },
        //
        // Sender
        //
        {
            index: INDEX_ADV += 100,
            id: 'sender',
            render: function (baton) {

                if (!settings.get('features/setFromInVacationNotice', true)) return;

                baton.$el.append(
                    $('<div class="form-group">').append(
                        $('<label for="from">').text(gt('Send from')),
                        new mini.SelectView({ list: this.getAddresses(), name: 'from', model: this.model, id: 'from' }).render().$el
                    )
                );

                // fix invalid address
                if (!this.$('select[name="from"]').val()) this.$('select[name="from"]').val('default');
            }
        },
        // Aliases
        {
            index: INDEX_ADV += 100,
            id: 'aliases',
            render: function (baton) {

                if (this.data.aliases.length <= 1) return;
                if (!settings.get('features/setAddressesInVacationNotice', true)) return;

                var model = this.model,
                    primaryMail = model.get('primaryMail') || this.data.aliases[0];

                // remove primary mail from aliases
                this.data.aliases.splice(_(this.data.aliases).indexOf(primaryMail), 1);

                baton.$el.append(
                    $('<div class="help-block">').text(
                        gt('The Notice is sent out for messages received by %1$s. You may choose to send it out for other recipient addresses too:', primaryMail)
                    ),
                    _(this.data.aliases).map(function (alias) {
                        return util.checkbox('alias_' + alias, alias, model);
                    }),
                    $('<div>').append(
                        $('<button type="button" class="btn btn-link" data-action="select-all">')
                            .text('Select all')
                            .on('click', { view: this }, onSelectAll)
                    )
                );

                function onSelectAll(e) {
                    var view = e.data.view;
                    _(view.data.aliases).each(function (alias) {
                        view.model.set(alias, true);
                    });
                }
            }
        }
    );

    //
    // Get required data
    //
    function getData() {
        var model = new Model();
        return $.when(userAPI.get(), api.getConfig(), model.fetch()).then(function (user, config) {
            return { model: model, aliases: user.aliases, config: config, user: user };
        });
    }

    return { open: open };

});
