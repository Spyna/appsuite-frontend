/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2015 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Frank Paczynski <frank.paczynski@open-xchange.com>
 */

define('io.ox/onboarding/clients/extensions', [
    'io.ox/backbone/mini-views/common',
    'io.ox/onboarding/clients/api',
    'io.ox/core/yell',
    'io.ox/core/extensions',
    'gettext!io.ox/core/onboarding'
], function (mini, api, yell, ext, gt) {

    'use strict';

    // scenario action views

    var POINT = 'io.ox/onboarding/clients/views';

    function notify(resp) {
        if (_.isObject(resp) && 'error' in resp) return yell(resp);
        return yell('info', resp);
    }

    var ActionsView = Backbone.View.extend({

        events: {
            'click .action>legend': 'accordion',
            'click .toggle-link': 'toggleMode'
        },

        initialize: function (options) {
            _.extend(this, options);
            this.setElement($('<div class="actions">'));
        },

        $toggleMode: $('<a href="#" class="toggle-link">').text('Advanced user?'),

        toggleMode: function (e) {
            e.preventDefault();
            var step = this.$el.closest('.wizard-step'),
                value = step.attr('data-mode'),
                link = this.$el.find('.toggle-link');
            // simple
            if (value === 'advanced') {
                step.attr('data-mode', 'simple');
                link.text(gt('Advanced user?'));
                return this.update();
            }
            // advanced
            step.attr('data-mode', 'advanced');
            link.text(gt('Hide options for advanced user.'));
            // update
            this.update();
        },

        update: function () {
            var list = this.$el.find('.actions-scenario'),
                mode = this.$step.attr('data-mode');
            _.each(list, function (container) {
                container = $(container);
                // advanced: cover (hidden) actions of not selected
                // selections to be ready when users switches scenarios
                var actions = container.find(mode === 'advanced' ? '.action' : '.action:visible');
                if (actions.length <= 1) {
                    return container.addClass('single-action');
                }
                container.removeClass('single-action');
            });
        },

        render: function () {
            var scenarios = this.scenarios,
                config = this.config,
                self = this;
            _.each(scenarios, function (scenario) {
                var list = config.getActions(scenario.id),
                    node = $('<div class="actions-scenario">').attr('data-parent', scenario.id),
                    baton = ext.Baton({ data: list, config: config, model: config.model });
                // draw actions
                _.each(baton.data, function (action) {
                    node.attr('data-value', action.id);
                    ext.point(POINT + '/' + action.id).invoke('draw', node, action, baton);
                });
                // add toggle link
                if (baton.data.length > 1) node.append(self.$toggleMode.clone());
                this.$el.append(node);
                // expand first action
                this.$el.find('.action:first').addClass('expanded');
            }.bind(this));
            // update
            this.update();
            return this;
        },

        accordion: function (e) {
            e.preventDefault();
            var target = $(e.target),
                action = target.closest('.action'),
                container = action.closest('.actions');
            // does not collapse when only action visible
            if (container.find('.action:visible').length <= 1) {
                action.addClass('expanded');
            } else {
                action.toggleClass('expanded');
            }
            action.closest('.scenario-action').find('.action').not(action).removeClass('expanded');
        }

    });

    var DisplayActionView = Backbone.View.extend({

        labels: {
            // card
            'carddav_hostName': gt('hostname'),
            'carddav_login': gt('login'),
            // smtp
            'smtpLogin': gt('SMTP login'),
            'smtpServer': gt('SMTP server'),
            'smtpPort': gt('SMTP port'),
            'smtpSecure': gt('SMTP secure'),
            // imap
            'imapLogin': gt('IMAP login'),
            'imapServer': gt('IMAP server'),
            'imapPort': gt('IMAP port'),
            'imapSecure': gt('IMAP secure')
        },

        initialize: function (action, options) {
            _.extend(this, action);
            this.model = options.baton.model;
            this.config = options.baton.config;
            // root
            this.setElement(
                $('<fieldset class="action form-group">')
                .attr('data-action', action.id)
            );
        },

        render: function () {
            var self = this, form;
            this.$el.empty()
                .append(
                    // title
                    $('<legend class="title section-title">')
                        .append(
                            $('<i class="fa fa-fw fa-chevron-right">'),
                            $('<i class="fa fa-fw fa-chevron-down">'),
                            $.txt(gt('Settings for advanced users'))
                        ),
                    // content
                    $('<span class="content">').append(
                        $('<div class="description">')
                            .text(gt('Setup your profile manually.')),
                        form = $('<div class="data">')
                    )
                );
            // add rows
            var list = Object.keys(this.data).sort();
            _.each(list, function (key) {
                var value = self.data[key],
                    group = $('<div class="row">');
                group.append(
                    $('<label class="control-label display-label col-sm-3">').text(self.labels[key] || key),
                    $('<div class="col-sm-9">').append(
                        $('<input class="form-control" readonly>').val(value)
                            .on('click', function () {
                                $(this).select();
                            })
                    )
                );
                form.append(group);
            });
            return this;
        }
    });

    var NumberActionView = Backbone.View.extend({

        events: {
            'click .btn': '_onClick'
        },

        initialize: function (action, options) {
            _.extend(this, action);
            this.model = options.baton.model;
            this.config = options.baton.config;
            // root
            this.setElement(
                $('<fieldset class="action form-group">')
                .attr('data-action', action.id)
            );
        },

        render: function () {
            var form;
            this.$el.empty()
                .append(
                    // title
                    $('<legend class="title section-title">')
                        .append(
                            $('<i class="fa fa-fw fa-chevron-right">'),
                            $('<i class="fa fa-fw fa-chevron-down">'),
                            $.txt(gt('SMS'))
                        ),
                    $('<span class="content">').append(
                        // description
                        $('<div class="description">')
                            .text(gt('Send me the profile data by SMS.')),
                        // form
                        form = $('<div class="data">'),
                        // action
                        $('<button>')
                            .addClass('btn btn-primary')
                            .text(gt('Send'))
                    )
                );
            var value = this.model.get('number'),
                node = new mini.InputView({ name: 'number', model: this.model }).render()
                        .$el
                        .removeClass('form-control')
                        .addClass('field form-control')
                        .attr('title', this.name)
                        .attr('list', 'addresses')
                        .val(value || '');

            var group = $('<div class="row">');
            group.append(
                $('<label class="control-label col-sm-4">').text(gt('SMS')),
                $('<div class="col-sm-7">').append(
                    node,
                    $('<datalist id="addresses">').append(
                        $('<option>').attr('value', this.config.getUserMobile())
                    )
                )
            );
            if (value) node.val(value);
            form.append(group);
            return this;
        },

        _onClick: function (e) {
            e.preventDefault();
            var scenario = this.config.getScenarioCID(),
                action = this.id,
                data = {
                    number: this.model.get('number')
                };
            // call
            api.execute(scenario, action, data).always(notify);
        }
    });

    var EmailActionView = Backbone.View.extend({

        events: {
            'click .btn': '_onClick'
        },

        initialize: function (action, options) {
            _.extend(this, action);
            this.model = options.baton.model;
            this.config = options.baton.config;
            // root
            this.setElement(
                $('<fieldset class="action form-group">')
                .attr('data-action', action.id)
            );
        },

        render: function () {
            var group;
            this.$el.empty()
                .append(
                    // title
                    $('<legend class="title section-title">')
                        .append(
                            $('<i class="fa fa-fw fa-chevron-right">'),
                            $('<i class="fa fa-fw fa-chevron-down">'),
                            $.txt(gt('Email'))
                        ),
                    $('<span class="content">').append(
                        // description
                        $('<div class="description">')
                            .text(gt('Get your device configured by email.')),
                        // form
                        $('<div class="interaction">').append(
                            $('<form class="form-inline">').append(
                                group = $('<div class="row">')
                            )
                        )
                    )
                );
            var value = this.model.get('email') || this.config.getUserMail(),
                input = new mini.InputView({ name: 'email', model: this.model }).render()
                        .$el
                        .removeClass('form-control')
                        .addClass('field form-control')
                        .attr('title', this.name)
                        .attr('list', 'addresses')
                        .val(value || '');

            group.append(
                $('<label class="control-label">').text(gt('Email')),
                input,
                // action
                $('<button>')
                    .addClass('btn btn-primary')
                    .text(gt('Send'))
            );
            if (value) input.val(value);

            return this;
        },

        _onClick: function (e) {
            e.preventDefault();
            var scenario = this.config.getScenarioCID(),
                action = this.id,
                data = {
                    email: this.model.get('email')
                };
            // call
            api.execute(scenario, action, data).always(notify);
        }
    });

    var DownloadActionView = Backbone.View.extend({

        events: {
            'click .btn': '_onClick'
        },

        initialize: function (action, options) {
            _.extend(this, action);
            this.model = options.baton.model;
            this.config = options.baton.config;
            // root
            this.setElement(
                $('<fieldset class="action form-group">')
                .attr('data-action', action.id)
            );
        },

        render: function () {
            this.$el.empty()
                .append(
                    // title
                    $('<legend class="title section-title">')
                        .append(
                            $('<i class="fa fa-fw fa-chevron-right">'),
                            $('<i class="fa fa-fw fa-chevron-down">'),
                            $.txt(gt('Automatic Configuration'))
                        ),
                    $('<span class="content">').append(
                        // description
                        $('<div class="description">')
                            .text(gt('Automatically configure your device by clicking the button below.')),
                        // action
                        $('<button>')
                            .addClass('btn btn-primary')
                            .text(gt('Configure now'))
                    )
                );
            return this;
        },

        _onClick: function (e) {
            e.preventDefault();
            var url = api.getUrl(this.config.getScenarioCID(), this.id);
            require(['io.ox/core/download'], function (download) {
                download.url(url);
            });
        }
    });
    var AppActionView = Backbone.View.extend({

        events: {
            'click .btn': '_onClick'
        },

        initialize: function (action, options) {
            _.extend(this, action);
            this.model = options.baton.model;
            this.config = options.baton.config;
            // root
            this.setElement(
                $('<fieldset class="action form-group">')
                .attr('data-action', action.id)
            );
            // device specific
            this.device = this.config.getDevice();
            this.link = action[this.device.id].link;
            this.type = action[this.device.id].type;
        },

        getLabel: function () {
            return {
                'appstore': gt('Apple App Store'),
                'playstore': gt('Google Playstore')
            }[this.type];
        },

        render: function () {
            this.$el.empty()
                .append(
                    // title
                    $('<legend class="title section-title">')
                        .append(
                            $('<i class="fa fa-fw fa-chevron-right">'),
                            $('<i class="fa fa-fw fa-chevron-down">'),
                           // $.txt(gt('App for your %1$s', this.device.name))
                            $.txt(this.getLabel())
                        ),
                    $('<span class="content">').append(
                        // description
                        $('<div class="description">')
                            .text(gt('Just open the %1$s', this.getLabel())),
                        // action
                        $('<button>')
                            .addClass('btn btn-primary')
                            .text(gt('Open ', this.getLabel()))
                    )
                );
            return this;
        },

        _onClick: function (e) {
            e.preventDefault();
            window.open(this.link);
        }
    });

    return {
        ActionsView: ActionsView,
        DisplayActionView: DisplayActionView,
        NumberActionView: NumberActionView,
        EmailActionView: EmailActionView,
        DownloadActionView: DownloadActionView,
        AppActionView: AppActionView
    };
});
