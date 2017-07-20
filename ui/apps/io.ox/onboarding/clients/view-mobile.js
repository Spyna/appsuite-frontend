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

define('io.ox/onboarding/clients/view-mobile', [
    'io.ox/core/extensions',
    'io.ox/backbone/views/modal',
    'io.ox/onboarding/clients/config',
    'io.ox/onboarding/clients/api',
    'io.ox/core/a11y',
    'gettext!io.ox/core/onboarding'
], function (ext, ModalDialog, config, api, a11y, gt) {

    'use strict';

    var POINT = 'io.ox/onboarding/clients/views/mobile';

    var extensions = {

        scenario: function (scenario, index, list) {
            return [
                // scenario
                $('<article class="scenario">').attr('data-id', scenario.id).append(
                    $('<h2 class="title">').text(scenario.name || ''),
                    $('<p class="description">').text(scenario.description),
                    $('<div class="actions">').append(_.map(scenario.actions, extensions.action))
                ),
                // divider
                index !== list.length - 1 ? $('<hr class="divider">') : $()
            ];
        },

        action: function (action, index) {
            var node = $('<section class="action">').attr('data-action', action.id).attr({ 'data-index': index }),
                type = action.id.split('/')[0];
            ext.point(POINT + '/' + type).invoke('draw', node, action);
            return node;
        },

        // DISPLAY: IMAP, SMTP and EAS

        block: function (action) {
            this.append(
                $('<pre class="config">').append(
                    $('<div>').append(_.map(action.data, function (prop) {
                        var isTitle = !('value' in prop);
                        return $('<div class="property">').addClass(isTitle ? 'title' : '').text(prop.name + (isTitle ? '' : ':'));
                    })),
                    $('<div>').append(_.map(action.data, function (prop) {
                        var isTitle = !('value' in prop);
                        return $('<div class="value">').text(isTitle ? '\xa0' : prop.value).addClass(isTitle ? 'title' : '');
                    }))
                )
            );
        },

        toggle: function () {
            // make content toggleable when 'display' isn't the primary action of a scenario
            if (this.attr('data-index') === '0') return;

            var action =  $('<a href="#" role="button" class="inline-link">'),
                container = $('<div>').append(this.find('.config'));

            a11y.collapse(action, container, { onChange: setLabel });
            function setLabel(state) {
                //#. button: show collapsed content
                if (/(show)/.test(state)) return action.text(gt('Hide details'));
                //#. button: hide collapsable content
                if (/(hide)/.test(state)) return action.text(gt('Show details'));
            }
            this.empty().append(action, container);
        },

        // DOWNLOAD: Profile

        titleDownload: function () {
            this.append($('<h3 class="title">').text(
                gt('Automatic Configuration')
            ));
        },

        descriptionDownload: function (action) {
            this.append(
                $('<p class="description">').text(action.description)
            );
        },

        buttonDownload: function (action) {
            var ref = _.uniqueId('description-');
            this.append($('<button class="btn btn-primary action-call">')
                .attr('aria-describedby', ref)
                .text(gt('Install'))
                .on('click', function (e) {
                    e.preventDefault();
                    var url = api.getUrl(action.scenario, action.id, config.getDevice().id);
                    require(['io.ox/core/download'], function (download) {
                        download.url(url);
                    });
                })
            );
        },

        // LINK: App in a Store

        descriptionLink: (function () {
            return function (action) {
                this.append($('<p class="description">').append(
                    action.description ? action.description + ' ' : '',
                    action.store ? action.store.description : ''
                ));
            };
        })(),

        imageLink: function (action) {
            // defaults
            if (!action.image && !action.imageplaceholder) return;
            this.find('.description').prepend($('<a class="app" target="_blank">').attr('href', action.link).append(
                $('<img class="app-icon action-call" role="button">').attr({
                    'src': action.image || action.imageplaceholder
                })
            ));
        },

        badge: function (action) {
            if (!action.store.image) return;
            this.append(
                $('<a class="store" target="_blank">').attr('href', action.link).append(
                    $('<img class="store-icon action-call" role="button">').attr({
                        'data-detail': action.store.name,
                        'src': action.store.image
                    })
                )
            );
        }
    };

    // supported
    ext.point(POINT + '/display').extend(
        { id: 'block', draw: extensions.block },
        { id: 'toggle', draw: extensions.toggle }
    );
    ext.point(POINT + '/download').extend(
        { id: 'title', draw: extensions.titleDownload },
        { id: 'description', draw: extensions.descriptionDownload },
        { id: 'button', draw: extensions.buttonDownload }
    );
    ext.point(POINT + '/link').extend(
        { id: 'description', draw: extensions.descriptionLink },
        { id: 'imageLink', draw: extensions.imageLink },
        { id: 'badge', draw: extensions.badge }
    );

    // unsupported
    ext.point(POINT + '/email').extend({ draw: $.noop });
    ext.point(POINT + '/sms').extend({ draw: $.noop });

    return {

        extensions: extensions,

        get: function () {
            return new ModalDialog({
                title: gt('Connect this device'),
                point: 'io.ox/onboarding/clients/views/mobile',
                maximize: false
            })
            .extend({
                'layout': function () {
                    this.$el.addClass('client-onboarding mobile');
                },
                'action-close': function () {
                    this.$el.find('.modal-header').append(
                        $('<a href="#" class="modal-action close" data-action="cancel" role="button">')
                            .attr('aria-label', gt('Close'))
                            .append(
                                $('<i class="fa fa-times" aria-hidden="true">').attr('title', gt('Close'))
                            )
                            .on('click', this.close)
                    );
                },
                'content': function () {
                    var scenarios = _.map(config.getScenarios(), function (scenario) {
                        return _.extend(scenario, { actions: config.getActions(scenario.id) });
                    });
                    // mapping function returns array of nodes
                    this.$body.append(_(scenarios).chain().map(extensions.scenario).flatten().value());
                }
            });
        }
    };

});
