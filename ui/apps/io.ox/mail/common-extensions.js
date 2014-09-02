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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/mail/common-extensions',
    ['io.ox/core/extensions',
     'io.ox/core/extPatterns/links',
     'io.ox/core/extPatterns/actions',
     'io.ox/core/emoji/util',
     'io.ox/mail/util',
     'io.ox/mail/api',
     'io.ox/core/api/account',
     'io.ox/core/date',
     'io.ox/core/strings',
     'io.ox/core/folder/title',
     'io.ox/core/notifications',
     'io.ox/contacts/api',
     'io.ox/core/api/collection-pool',
     'io.ox/core/tk/flag-picker',
     'io.ox/core/capabilities',
     'settings!io.ox/mail',
     'gettext!io.ox/mail'
    ], function (ext, links, actions, emoji, util, api, account, date, strings, shortTitle, notifications, contactsAPI, Pool, flagPicker, capabilities, settings, gt) {

    'use strict';

    var extensions = {

        a11yLabel: function (baton) {
            var data = baton.data,
                size = api.threads.size(data),
                threadSize = size <= 1 ? '' :  ', ' + gt.format('Thread contains %1$d messages', gt.noI18n(size)),
                fromlist = data.from || [['', '']],
                subject = _.escape($.trim(data.subject)),
                unread = util.isUnseen(data) ? gt('Unread') + ', ' : '',
                a11yLabel = unread + util.getDisplayName(fromlist[0]) + ', ' + subject + ', ' + util.getTime(data.received_date) + threadSize;

            this.attr({
                'aria-hidden': true
            }).parent().attr({
                'aria-label': _.escape(a11yLabel)
            });
        },

        picture: function (baton) {
            var data = baton.data, from = data.from,
                size = _.device('retina') ? 80 : 40;
            this.append(
                contactsAPI.pictureHalo(
                    $('<div class="contact-picture" aria-hidden="true">'),
                    { email: data.picture || (from && from[0] && from[0][1]), width: size, height: size, scaleType: 'cover' }
                )
            );
        },

        date: function (baton, options) {
            var data = baton.data, t = data.received_date, d;
            if (!_.isNumber(t)) return;
            d = new date.Local(t);
            this.append(
                $('<time class="date">')
                .attr('datetime', d.format('yyyy-MM-dd hh:mm'))
                .text(_.noI18n(util.getDateTime(t, options)))
            );
        },

        smartdate: function (baton) {
            extensions.date.call(this, baton, { fulldate: false, smart: true });
        },

        fulldate: function (baton) {
            extensions.date.call(this, baton, { fulldate: true, smart: false });
        },

        from: function (baton) {
            var data = baton.data,
                single = !data.threadSize || data.threadSize === 1,
                field = single && account.is('sent|drafts', data.folder_id) ? 'to' : 'from';
            this.append(
                $('<div class="from">').append(
                    util.getFrom(data, field)
                )
            );
        },

        size: function (baton) {
            var data = baton.data;
            if (!_.isNumber(data.size)) return;
            this.append(
                $('<span class="size">').text(strings.fileSize(data.size, 1))
            );
        },

        unreadClass: function (baton) {
            var isUnseen = util.isUnseen(baton.data);
            this.closest('.list-item').toggleClass('unread', isUnseen);
        },

        deleted: function (baton) {
            this.parent().toggleClass('deleted', util.isDeleted(baton.data));
        },

        flag: function (baton) {

            var color = baton.data.color_label;
            if (color <= 0) return; // 0 and a buggy -1

            this.append(
                $('<i class="flag flag_' + color + ' fa fa-bookmark" aria-hidden="true">')
            );
        },

        threadSize: function (baton) {

            // only consider thread-size if app is in thread-mode
            if (!baton.app || baton.app.props.get('thread') === false) return;

            var size = api.threads.size(baton.data);
            if (size <= 1) return;

            this.append(
                $('<div class="thread-size" aria-hidden="true">').append(
                    $('<span class="number drag-count">').text(_.noI18n(size))
                )
            );
        },

        paperClip: function (baton) {
            if (!baton.data.attachment) return;
            this.append(
                $('<i class="fa fa-paperclip has-attachments" aria-hidden="true">')
            );
        },

        priority: function (baton) {
            var data = baton.data;
            this.append(
                $('<span class="priority" aria-hidden="true">').append(
                    util.getPriority(data)
                )
            );
        },

        unread: function (baton) {
            var isUnseen = util.isUnseen(baton.data);
            if (isUnseen) this.append('<i class="icon-unread fa fa-envelope" aria-hidden="true">');
        },

        answered: function (baton) {
            var data = baton.data,
                cid = _.cid(data),
                thread = api.threads.get(cid),
                isAnswered = util.isAnswered(thread, data);
            if (isAnswered) this.append('<i class="icon-answered fa fa-reply" aria-hidden="true">');
        },

        forwarded: function (baton) {
            var data = baton.data,
                cid = _.cid(data),
                thread = api.threads.get(cid),
                isForwarded = util.isForwarded(thread, data);
            if (isForwarded) this.append('<i class="icon-forwarded fa fa-mail-forward" aria-hidden="true">');
        },

        subject: function (baton) {

            var data = baton.data,
                keepFirstPrefix = baton.data.threadSize === 1,
                subject = util.getSubject(data, keepFirstPrefix),
                node;

            this.append(
                $('<div class="subject">').append(
                    $('<span class="flags">'),
                    node = $('<span class="drag-title">').text(subject)
                )
            );

            emoji.processEmoji(_.escape(subject), function (html) {
                node.html(html);
            });
        },

        // a11y: set title attribute on outer list item
        title: function (baton) {
            var subject = util.getSubject(baton.data);
            this.closest('.list-item').attr('title', subject);
        },

        // used in unified inbox
        account: function (baton) {
            if (!account.isUnifiedFolder(baton.data.folder_id)) return;
            this.append(
                $('<span class="account-name">').text(baton.data.account_name || '')
            );
        },

        recipients: (function () {

            // var drawAllDropDown = function (node, label, data) {
            //     // use extension pattern
            //     new links.Dropdown({
            //         label: label,
            //         classes: 'all-link',
            //         ref: 'io.ox/mail/all/actions'
            //     }).draw.call(node, data);
            // };

            var showAllRecipients = function (e) {
                e.preventDefault();
                $(this).find('.show-all-recipients').remove();
                $(this).children().show();
            };

            return function (baton) {

                var data = baton.data;

                // figure out if 'to' just contains myself - might be a mailing list, for example
                var showCC = data.cc && data.cc.length > 0,
                    showTO = data.to && data.to.length > 0,
                    showBCC = data.bcc && data.bcc.length > 0,
                    show = showTO || showCC || showBCC,
                    container = $('<div class="recipients">');

                if (!show) return;

                if (showTO) {
                    container.append(
                        // TO
                        $('<span class="io-ox-label">').append(
                            $.txt(gt('To')),
                            $.txt(_.noI18n('\u00A0\u00A0'))
                        ),
                        util.serializeList(data, 'to'),
                        $.txt(_.noI18n(' \u00A0 '))
                    );
                }
                if (showCC) {
                    container.append(
                        // CC
                        $('<span class="io-ox-label">').append(
                            $.txt(gt.pgettext('CC', 'Copy')),
                            _.noI18n('\u00A0\u00A0')
                        ),
                        util.serializeList(data, 'cc'),
                        $.txt(_.noI18n(' \u00A0 '))
                    );
                }
                if (showBCC) {
                    container.append(
                        // BCC
                        $('<span class="io-ox-label">').append(
                            $.txt(gt('Bcc')),
                            _.noI18n('\u00A0\u00A0')
                        ),
                        util.serializeList(data, 'bcc'),
                        $.txt(_.noI18n(' \u00A0 '))
                    );
                }

                this.append(container);

                var items = container.find('.person-link');
                if (items.length > 3) {
                    container.children().slice(4).hide();
                    container.append(
                        //#. %1$d - number of other recipients (names will be shown if string is clicked)
                        $('<a href="#" class="show-all-recipients">').text(gt('and %1$d others', items.length - 2))
                    );
                    container.on('click', showAllRecipients);
                }
            };
        }()),

        attachmentList: (function attachmentList() {
            function drawInlineLinks(node, data) {
                var extension = new links.InlineLinks({
                    ref: 'io.ox/mail/attachment/links'
                });
                return extension.draw.call(node, ext.Baton({ data: data }));
            }

            var customAttachmentView,
                renderCustomControls = function (widget) {
                    return widget;
                },
                renderCustomContent = function (widget) {
                    var dd = new links.Dropdown({
                            label: '',
                            noCaret: true,
                            ref: 'io.ox/mail/attachment/links'
                        }).draw.call(widget, ext.Baton({ data: this.model.attributes, $el: widget })),
                        url, contentType;

                    url = api.getUrl(this.model.attributes, 'download');
                    contentType = (this.model.get('content_type') || 'unknown').split(/;/)[0];

                    this.$el.attr({
                        title: this.model.getTitle(),
                        draggable: true,
                        'data-downloadurl': contentType + ':' + this.model.getTitle().replace(/:/g, '') + ':' + ox.abs + url
                    })
                    .on('dragstart', function (e) {
                        $(this).css({ display: 'inline-block' });
                        e.originalEvent.dataTransfer.setData('DownloadURL', this.dataset.downloadurl);
                    });

                    this.renderDefaultContent(dd.find('a[data-toggle="dropdown"]'));
                    return widget;
                };

            return function (baton) {

                if (baton.attachments.length === 0) return $.when();

                var $el = this,
                    def = $.Deferred();

                require(['io.ox/core/tk/attachments'], function (attachments) {
                    _.once(function () {
                        customAttachmentView = attachments.view.Attachment.extend({
                            renderCustomControls: renderCustomControls,
                            renderCustomContent: renderCustomContent
                        });
                        // CustomAttachmentList = attachments.view.AttachmentList.extend({
                        //     renderCustomHeader: function () {
                        //         this.renderDefaultHeader();
                        //         if (this.filteredCollection().length > 1) {
                        //             drawInlineLinks(this.$header, this.filteredCollection().map(function (m) {
                        //                 return m.toJSON();
                        //             }));
                        //         }
                        //         return this.$el;
                        //     }
                        // });
                    })();
                    var list = baton.attachments.map(function (m) {
                            m.group = 'mail';
                            return m;
                        }),
                        collection = new attachments.model.Attachments(list),
                        view = new attachments.view.AttachmentList({
                            collection: collection,
                            el: $el,
                            preview: baton.preview,
                            attachmentView: customAttachmentView
                        });

                    $el.append(view.render().$el);

                    view.renderInlineLinks = function () {
                        var models = this.getValidModels(), $links = this.$header.find('.links');
                        console.log('renderInlineLinks', $links.length, models.length);
                        if (models.length > 1) drawInlineLinks($links, _(models).invoke('toJSON')); else $links.empty();
                    };

                    view.listenTo(view.collection, 'add remove reset', view.renderInlineLinks);
                    view.renderInlineLinks();

                    view.$el.on('click', 'li.item', function (e) {

                        var node = $(e.currentTarget), id, data, baton;

                        // skip attachments without preview
                        if (!node.attr('data-original')) return;

                        id = node.attr('data-id');
                        data = collection.get(id).toJSON();
                        baton = ext.Baton({ startItem: data, data: list });

                        actions.invoke('io.ox/mail/actions/slideshow-attachment', null, baton);
                    });

                    def.resolve(view);
                }, def.reject);

                return def;
            };
        }()),

        flagPicker: function (baton) {
            flagPicker.draw(this, baton);
        },

        unreadToggle: (function () {

            function toggle(e) {
                e.preventDefault();
                var view = e.data.view, data = view.model.toJSON(), node = e.data.node;
                // toggle 'unseen' bit

                if (util.isUnseen(data)) {
                    api.markRead(data);
                    node.attr('aria-label', gt('This E-mail is read, press to mark it as unread.'));
                } else {
                    api.markUnread(data);
                    node.attr('aria-label', gt('This E-mail is unread, press to mark it as read.'));
                }
            }

            return function (baton) {

                if (util.isEmbedded(baton.data)) return;

                var a11y = util.isUnseen(baton.data) ? gt('This E-mail is unread, press to mark it as read.') : gt('This E-mail is read, press to mark it as unread.'),
                    button = $('<a href="#" role="button" class="unread-toggle" tabindex="1" aria-label="' + a11y + '"><i class="fa" aria-hidden="true"/></a>');
                this.append(button.on('click', { view: baton.view, node: button }, toggle)
                );
            };
        }()),

        externalImages: (function () {

            function loadImages(e) {
                e.preventDefault();
                var view = e.data.view;
                view.trigger('load');
                view.$el.find('.external-images').remove();
                // get unmodified mail
                api.getUnmodified(_.cid(view.model.cid)).done(function (data) {
                    view.trigger('load:done');
                    view.model.set(data);
                });
            }

            function draw(model) {

                // nothing to do if message is unchanged
                // or if message is embedded (since we cannot reload it)
                if (model.get('modified') !== 1 || util.isEmbedded(model.toJSON())) {
                    this.find('.external-images').remove();
                    return;
                }

                this.append(
                    $('<div class="notification-item external-images">').append(
                        $('<button type="button" class="btn btn-primary btn-sm" tabindex="1">').text(gt('Show images')),
                        $('<div class="comment">').text(gt('External images have been blocked to protect you against potential spam!'))
                    )
                );
            }

            return function (baton) {
                draw.call(this, baton.model);
                this.on('click', '.external-images', { view: baton.view }, loadImages);
                baton.view.listenTo(baton.model, 'change:modified', draw.bind(this));
            };

        }()),

        phishing: (function () {

            var headers = _(settings.get('phishing/headers', ['phishing-test']));

            function draw(model) {

                // avoid duplicates
                if (this.find('.phishing').length) return;

                _(model.get('headers')).find(function (value, name) {
                    if (headers.contains(name)) {
                        this.append(
                            $('<div class="alert alert-error phishing">')
                            .text(gt('Warning: This message might be a phishing or scam mail'))
                        );
                        return true;
                    }
                }, this);
            }

            return function (baton) {
                draw.call(this, baton.model);
                baton.view.listenTo(baton.model, 'change:headers', draw.bind(this));
            };

        }()),

        dispositionNotification: (function () {

            var skip = {};

            function returnReceipt(e) {
                e.preventDefault();
                var view = e.data.view, obj = _.cid(view.model.cid);
                view.model.set('disp_notification_to', '');
                skip[view.model.cid] = true;
                api.ack({ folder: obj.folder_id, id: obj.id }).done(function () {
                    notifications.yell(
                        'success',
                        //#. read receipt; German "Lesebestätigung"
                        gt('A read receipt has been sent')
                    );
                });
            }

            function cancel(e) {
                e.preventDefault();
                // add to skip hash
                var view = e.data.view;
                skip[view.model.cid] = true;
            }

            function draw(model) {

                this.find('.disposition-notification').remove();

                // skip? (cancaled or already returned)
                if (skip[model.cid]) return;
                // has proper attribute? (only available if message was unseen on fetch)
                if (!model.get('disp_notification_to')) return;
                // user does not ignore this feature?
                if (!settings.get('sendDispositionNotification', false)) return;
                // is not in drafts folder?
                if (account.is('drafts', model.get('folder_id'))) return;

                this.append(
                    $('<div class="alert alert-info disposition-notification">').append(
                        $('<button type="button" class="close" data-dismiss="alert">&times;</button>'),
                        $('<button type="button" class="btn btn-primary btn-sm" tabindex="1">').text(
                            //#. Respond to a read receipt request; German "Lesebestätigung senden"
                            gt('Send a read receipt')
                        ),
                        $('<div class="comment">').text(
                            gt('The sender wants to get notified when you have read this email')
                        )
                    )
                );
            }

            return function (baton) {
                draw.call(this, baton.model);
                this.on('click', '.disposition-notification .btn', { view: baton.view }, returnReceipt);
                this.on('click', '.disposition-notification .close', { view: baton.view }, cancel);
                baton.view.listenTo(baton.model, 'change:disp_notification_to', draw.bind(this));
            };

        }()),
    };

    return extensions;
});
