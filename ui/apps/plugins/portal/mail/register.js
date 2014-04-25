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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('plugins/portal/mail/register',
    ['io.ox/core/extensions',
     'io.ox/mail/api',
     'io.ox/mail/util',
     'io.ox/core/date',
     'io.ox/core/api/account',
     'io.ox/portal/widgets',
     'gettext!plugins/portal'
    ], function (ext, api, util, date, accountAPI, portalWidgets, gt) {

    'use strict';

    // helper to remember tracked mails
    var trackedMails = [];

    ext.point('io.ox/portal/widget/mail').extend({

        title: gt('Inbox'),

        initialize: function () {
            api.on('update create delete', function () {
                require(['io.ox/portal/main'], function (portal) {//refresh portal
                    var portalApp = portal.getApp(),
                        portalModel = portalApp.getWidgetCollection()._byId.mail_0;

                    if (portalModel) {
                        portalApp.refreshWidget(portalModel, 0);
                    }
                });

            });
        },

        // action: function () {
        //     ox.launch('io.ox/mail/main', { folder: api.getDefaultFolder() });
        // },

        load: function (baton) {
            var LIMIT = _.device('small') ? 5 : 10;
            // we fetch more that we want to show because usually a lot is deleted
            return accountAPI.getUnifiedMailboxName().then(function (mailboxName) {
                var folderName = mailboxName ? mailboxName + '/INBOX' : api.getDefaultFolder(),
                    useCache = !!baton.cache;
                return api.getAll({ folder:  folderName, limit: LIMIT * 5 }, useCache).pipe(function (mails) {
                    // ignore deleted mails
                    mails = _(mails).filter(function (obj) {
                        return !util.isDeleted(obj);
                    });
                    // fetch detailed data for smaller subset
                    return api.getList(mails.slice(0, LIMIT)).done(function (data) {
                        baton.data = data;
                        baton.cache = false;
                    });
                });
            });
        },

        summary: function (baton) {

            if (this.find('.summary').length) return;

            var message = '',
                unread = _(baton.data).reduce(function (sum, obj) {
                    return sum + (util.isUnseen(obj) ? 1 : 0);
                }, 0);

            if (unread === 0) {
                message = gt('You have no unread messages');
            } else if (unread === 1) {
                message = gt('You have 1 unread message');
            } else {
                message = gt('You have %1$d unread messages', unread);
            }

            this.addClass('with-summary show-summary').append(
                $('<div class="summary">').text(message)
            )
            .on('tap', 'h2', function (e) {
                $(e.delegateTarget).toggleClass('show-summary');
            });
        },

        preview: function (baton) {
            var $content = $('<ul class="content list-unstyled">');

            // need debounce here, otherwise we get tons of refresh calls
            var updater = _.debounce(function () {
                require(['io.ox/portal/main'], function (portal) {
                    var portalApp = portal.getApp(),
                        model = portalApp.getWidgetCollection()._byId.mail_0;
                    if (model) {
                        model.get('baton').cache = true;
                        portalApp.refreshWidget(model, 0);
                    }
                });
            }, 10);

            var list = baton.data;

            // unregister all old update handlers in this namespace
            _(trackedMails).each(function (ecid) {
                api.off('update:' + ecid + '.portalTile');
            });
            // reset list
            trackedMails = [];

            if (list && list.length) {
                $content.append(
                    _(list).map(function (mail) {

                        var ecid = _.ecid(mail);
                        // store tracked ecids for unregistering
                        trackedMails.push(ecid);
                        // track updates for the mail
                        api.on('update:' + ecid + '.portalTile', updater);

                        var received = new date.Local(mail.received_date).format(date.DATE);
                        return $('<li class="item" tabindex="1">')
                            .data('item', mail)
                            .append(
                                (function () {
                                    if ((mail.flags & 32) === 0) {
                                        return $('<i class="icon-circle new-item accent">');
                                    }
                                })(),
                                $('<span class="bold">').text(_.noI18n(util.getDisplayName(mail.from[0]))), $.txt(' '),
                                $('<span class="normal">').text(_.noI18n(_.ellipsis(mail.subject, {max: 50}))), $.txt(' '),
                                $('<span class="accent">').text(_.noI18n(received))
                            );
                    })
                );
            } else {
                $content.text(gt('No mails in your inbox'));
            }
            this.append($content);
        },

        draw: function (baton) {
            var popup = this.busy();
            require(['io.ox/mail/view-detail'], function (view) {
                var obj = api.reduce(baton.item);
                api.get(obj).done(function (data) {
                    popup.idle().append(view.draw(data));
                });
            });
        }
    });

    ext.point('io.ox/portal/widget/mail/settings').extend({
        title: gt('Inbox'),
        type: 'mail',
        editable: false,
        unique: true
    });

    ext.point('io.ox/portal/widget/stickymail').extend({

        // helps at reverse lookup
        type: 'mail',

        // called right after initialize. Should return a deferred object when done
        load: function (baton) {
            var props = baton.model.get('props') || {};
            return api.get({ folder: props.folder_id, id: props.id, view: 'text' }).then(
                function success(data) {
                    baton.data = data;
                    api.on('delete', function (event, elements) {
                        if (_(elements).any(function (element) { return (element.id === props.id && element.folder_id === props.folder_id); })) {
                            var widgetCol = portalWidgets.getCollection();
                            widgetCol.remove(baton.model);
                        }
                    });
                },
                function fail(e) {
                    return e.code === 'MSG-0032' ? 'remove' : e;
                }
            );
        },

        preview: function (baton) {
            var data = baton.data,
                received = new date.Local(data.received_date).format(date.DATE),
                content = '',
                source = _(data.attachments).reduce(function (memo, a) {
                    return memo + (a.content_type === 'text/plain' ? a.content : '');
                }, '');
            // escape html
            $('<div>').html(source).contents().each(function () {
                content += $(this).text() + ' ';
            });
            this.append(
                $('<div class="content">').append(
                    $('<div class="item">')
                    .data('item', data)
                    .append(
                        $('<span class="bold">').text(util.getDisplayName(data.from[0])), $.txt(' '),
                        $('<span class="normal">').text(_.ellipsis(data.subject, {max: 100})), $.txt(' '),
                        $('<span class="accent">').text(received), $.txt(' '),
                        $('<span class="gray">').text(_.ellipsis(content, {max: 600}))
                    )
                )
            );
        },

        draw: function (baton) {
            var popup = this.busy();
            require(['io.ox/mail/view-detail'], function (view) {
                var obj = api.reduce(baton.item);
                api.get(obj).done(function (data) {
                    popup.idle().append(view.draw(data));
                });
            });
        }
    });
});
