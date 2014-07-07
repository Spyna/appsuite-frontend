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
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 */

define('plugins/portal/linkedIn/register',
    ['io.ox/core/extensions',
     'io.ox/core/http',
     'io.ox/oauth/proxy',
     'io.ox/core/strings',
     'io.ox/keychain/api',
     'io.ox/core/capabilities',
     'gettext!plugins/portal'
    ], function (ext, http, proxy, strings, keychain, capabilities, gt) {

    'use strict';

    var fnClick,
        gtWithNode,
        displayNameLink;


    fnClick = function (e) {
        var person = e.data;
        e.preventDefault();

        require(['io.ox/linkedIn/view-detail', 'io.ox/core/tk/dialogs'], function (viewer, dialogs) {

            var busy = $('<div>')
                    .css('minHeight', '100px')
                    .busy(),
                node = $('<div>')
                    .append(viewer.draw(person))
                    .append(busy);

            new dialogs.SidePopup(({ modal: true, tabTrap: true}))
                .show(e, function (popup) {
                    popup.append(node);
                });

            return http.GET({
                    module: 'integrations/linkedin/portal',
                    params: {
                        action: 'fullProfile',
                        id: person.id
                    }
                })
                .done(function (completeProfile) {
                    busy.idle();
                    node.empty()
                        .append(viewer.draw(completeProfile));
                });
        });
    };


    gtWithNode = function (gtString, nodes) {
        var arr = gtString.split(/%\d\$[sid]/),
            node = $('<div>');
        //TODO: order
        _(arr).each(function (elem) {
            var replacement = nodes.shift();
            node.append($('<span>').text(elem));
            if (replacement) {
                node.append(replacement);
            }
        });
        return node;
    };


    displayNameLink = function (person) {
        var dname = person.firstName + ' ' + person.lastName;
        return $('<a tabindex="1" href="#" />')
            .text(dname)
            .on('click', person, fnClick);
    };


    ext.point('io.ox/plugins/portal/linkedIn/updates/renderer').extend({
        id: 'CONN',
        draw: function (activity) {
            var deferred = new $.Deferred();

            if (activity.updateType !== 'CONN') return deferred.resolve();

            var $updateEntry = $('<div class="io-ox-portal-linkedin-updates-entry">'),
                $detailEntry = $('<div class="io-ox-portal-linkedin-updates-details">').hide();

            this.append($updateEntry, $detailEntry);

            // Check presence of all variables
            if (activity.updateContent.person.connections) {
                $updateEntry.append(
                    gtWithNode(
                        gt('%1$s is now connected with %2$s'), [displayNameLink(activity.updateContent.person), displayNameLink(activity.updateContent.person.connections.values[0])]
                    )
                );
            }

            return deferred.resolve();
        }
    });


    ext.point('io.ox/plugins/portal/linkedIn/updates/renderer').extend({
        id: 'NCON',
        draw: function (activity) {
            var deferred = new $.Deferred();

            if (activity.updateType !== 'NCON') {
                return deferred.resolve();
            }

            var $newEntry = $('<div class="io-ox-portal-linkedin-new-entry">'),
                $detailEntry = $('<div class="io-ox-portal-linkedin-new-details">').hide();

            this.append($newEntry, $detailEntry);

            // Check presence of all variables
            if (activity.updateContent.person) {
                $newEntry.append(
                    gtWithNode(gt('%1$s is a new contact'), [displayNameLink(activity.updateContent.person)])
                );
            }

            return deferred.resolve();
        }
    });

    var handleError = function (node, baton) {
        var data = baton.data;
        console.error('LinkedIn error occurred', '(' + data.errorCode + ') ' + data.message);
        node.append(
            $('<div class="error bold">').text(gt('LinkedIn reported an error:')),
            $('<div class="errormessage">').text('(' + data.errorCode + ') ' + data.message)
        ).addClass('error-occurred');
        if (data.message.indexOf('authorize') !== -1) {
            var account = keychain.getStandardAccount('linkedin');
            node.append(
                $('<a class="solution">').text(gt('Click to authorize your account again')).on('click', function () {
                    keychain.submodules.linkedin.reauthorize(account).done(function () {
                        console.log(gt('You have reauthorized this %s account.', 'LinkedIn'));
                    }).fail(function () {
                        console.error(gt('Something went wrong reauthorizing the %s account.', 'LinkedIn'));
                    });
                })
            );
        }
        if (data.message.indexOf('Access to messages denied') !== -1) {
            node.append('<br />');
            $('<div class="solution italic">').text(gt('Sorry, we cannot help you here. Your provider needs to obtain a key from LinkedIn with the permission to do read messages.')).appendTo(node);
        }
    };


    ext.point('io.ox/portal/widget/linkedIn').extend({

        title: 'LinkedIn',

        isEnabled: function () {
            return keychain.isEnabled('linkedin');
        },

        requiresSetUp: function () {
            return keychain.isEnabled('linkedin') && !keychain.hasStandardAccount('linkedin');
        },

        performSetUp: function (baton) {
            var win = window.open(ox.base + '/busy.html', '_blank', 'height=400, width=600');
            return keychain.createInteractively('linkedin', win)
                .then(function () {
                    baton.model.node.removeClass('requires-setup');
                    ox.trigger('refresh^');
                });
        },


        load: function (baton) {
            if (capabilities.has('linkedinPlus')) {
                if (!keychain.hasStandardAccount('linkedin'))
                    return $.Deferred().reject({ code: 'OAUTH-0006' });

                return proxy.request({
                    api: 'linkedin',
                    url: 'http://api.linkedin.com/v1/people/~/mailbox:(id,folder,from:(person:(id,first-name,last-name,picture-url,headline)),recipients:(person:(id,first-name,last-name,picture-url,headline)),subject,short-body,last-modified,timestamp,mailbox-item-actions,body)?message-type=message-connections,invitation-request,invitation-reply,inmail-direct-connection&format=json'
                })
                .pipe(function (msgs) {
                    var data = JSON.parse(msgs);
                    if ((data.errorCode >= 0) && data.message) {
                        return (baton.data = data);
                    }
                    return (baton.data = data.values);
                })
                .fail(function (err) {
                    console.log('Nope', err);
                });

            } else {
                return http.GET({
                    module: 'integrations/linkedin/portal',
                    params: { action: 'updates' }
                })
                .then(function (activities) {
                    if (activities.values && activities.values !== 0) {
                        baton.data = activities.values;
                    } else {
                        baton.data = activities;
                    }
                });
            }
        },


        preview: function (baton) {
            var content = $('<ul class="content list-unstyled" tabindex="1" role="button" aria-label="' + gt('Press [enter] to jump to the linkedin stream.') + '">');

            if (capabilities.has('linkedinPlus')) {
                if (baton.data && baton.data.length) {
                    content.addClass('pointer');
                    _(baton.data).each(function (message) {
                        content.append(
                            $('<li class="paragraph">').append(
                                $('<span class="bold">').text(message.from.person.firstName + ' ' + message.from.person.lastName + ': '),
                                $('<span class="normal">').text(message.subject), $.txt(' '),
                                $('<span class="gray">').text(message.body)
                            )
                        );
                    });
                } else if (baton.data && baton.data.errorCode !== undefined) {
                    content.removeClass('pointer');
                    handleError(content, baton);
                } else {
                    this.append(
                        $('<div class="content">').text(gt('You have no new messages'))
                    );
                }

                this.append(content);

            } else {
                var previewData = [];
                for (var i = 0; i < Math.min(3, baton.data.length); i++) {
                    previewData.push(baton.data[i]);
                }
                if (baton.data && baton.data.length) {
                    content.addClass('pointer');

                    _(previewData).each(function (activity) {
                        var renderers = ext.point('io.ox/plugins/portal/linkedIn/updates/renderer');
                        renderers.invoke('draw', content, activity);
                    });
                } else if (baton.data && baton.data.errorCode !== undefined) {
                    content.removeClass('pointer');
                    handleError(content, baton);
                }

                if (content.children().length === 0) {
                    content.text(gt('There were not activities in your network'));
                }

                this.append(content);

            }
        },

        draw: function (baton) {

            var node = $('<div class="portal-feed linkedin-content">');

            if (capabilities.has('linkedinPlus')) {
                node.append(
                    $('<h1>').text(gt('LinkedIn Network Updates'))
                );

                if (baton.data) {
                    node.append(
                        $('<h2 class="linkedin-messages-header">').text(gt('Your messages'))
                    );
                    _(baton.data).each(function (message, index) {
                        node.addClass(index % 2 ? 'odd' : 'even')
                        .append(
                            $('<div class="linkedin-message">').append(
                                $('<span class="linkedin-name">').append(displayNameLink(message.from.person), ': '),
                                $('<span class="linkedin-subject">').html(_.escape(message.subject)),
                                $('<div class="linkedin-body">').html(_.escape(message.body).replace(/\n/g, '<br>'))
                            )
                        );
                    });
                }

                http.GET({
                    module: 'integrations/linkedin/portal',
                    params: { action: 'updates' }
                })
                .done(function (activities) {
                    if (_.isArray(activities.values) && activities.values.length > 0) {
                        node.append(
                            $('<h2 class="linkedin-activities-header">').text(gt('Recent activities'))
                        );
                        _(activities.values).each(function (activity) {
                            ext.point('io.ox/plugins/portal/linkedIn/updates/renderer').invoke('draw', node, activity);
                        });
                    }
                });
                this.append(node);

            } else {
                var profile = $('<div>');
                node.append(profile);

                http.GET({
                    module: 'integrations/linkedin/portal',
                    params: {
                        action: 'fullProfile',
                        id: '~'
                    }
                })
                .done(function (completeProfile) {
                    require(['io.ox/linkedIn/view-detail'], function (viewer) {
                        profile.empty()
                            .append(viewer.draw(completeProfile));
                    });
                });

                if (_.isArray(baton.data) && baton.data.length > 0) {

                    node.append(
                        $('<h2 class="linkedin-activities-header">').text(gt('Recent activities'))
                    );

                    _(baton.data).each(function (activity) {
                        ext.point('portal/linkedIn/updates/renderer').invoke('draw', node, activity);
                    });
                }

                this.append(node);
            }
        },

        drawCreationDialog: function () {
            var $node = $(this);
            $node.append(
                $('<h1>').text('LinkedIn'),
                $('<div class="io-ox-portal-preview centered">').append(
                    $('<div>').text(gt('Add your account'))
                )
            );
        }
    });



    ext.point('io.ox/portal/widget/linkedIn/settings').extend({
        title: gt('LinkedIn'),
        type: 'linkedIn',
        editable: false,
        unique: true
    });
});
