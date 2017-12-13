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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/mail/common-extensions', [
    'io.ox/core/extensions',
    'io.ox/core/extPatterns/links',
    'io.ox/core/extPatterns/actions',
    'io.ox/core/emoji/util',
    'io.ox/mail/util',
    'io.ox/mail/api',
    'io.ox/core/api/account',
    'io.ox/core/strings',
    'io.ox/core/folder/api',
    'io.ox/core/folder/title',
    'io.ox/core/notifications',
    'io.ox/contacts/api',
    'io.ox/core/api/user',
    'io.ox/core/api/collection-pool',
    'io.ox/core/tk/flag-picker',
    'io.ox/core/capabilities',
    'settings!io.ox/mail',
    'io.ox/core/attachments/view',
    'gettext!io.ox/mail'
], function (ext, links, actions, emoji, util, api, account, strings, folderAPI, shortTitle, notifications, contactsAPI, userAPI, Pool, flagPicker, capabilities, settings, attachment, gt) {

    'use strict';

    // little helper
    function isSearchResult(baton) {
        return !!baton.app && !!baton.app.props.get('find-result');
    }

    function pictureHalo(node, data) {
        // user should be in cache from rampup data
        // use userapi if possible, otherwise webmail users don't see their own contact picture (missing gab)
        var address = _.isArray(data) ? data && data[0] && data[0][1] : data;
        userAPI.get({ id: ox.user_id }).then(function (user) {
            var mailAdresses = _.compact([user.email1, user.email2, user.email3]),
                useUserApi = _(mailAdresses).contains(address) && user.number_of_images > 0;
            contactsAPI.pictureHalo(
                node,
                (useUserApi ? { id: ox.user_id } : { email: address }),
                { width: 40, height: 40, effect: 'fadeIn', api: (useUserApi ? 'user' : 'contact') }
            );
        });
    }

    var extensions = {

        a11yLabel: function (baton) {

            var data = baton.data,
                size = api.threads.size(data),
                fromlist = data.from || [['', '']],
                parts = [],
                a11yLabel;

            if (util.isUnseen(data)) parts.push(gt('Unread'));
            if (util.isFlagged(data)) parts.push(gt('Flagged'));
            if (baton.data.color_label && settings.get('features/flag/color')) parts.push(flagPicker.colorName(baton.data.color_label));
            parts.push(util.getDisplayName(fromlist[0]), data.subject, util.getTime(data.received_date));
            if (size > 1) parts.push(gt.format('Thread contains %1$d messages', size));
            if (data.attachment) parts.push(gt('has attachments'));

            a11yLabel = parts.join(', ') + '.';

            this.attr({
                'aria-hidden': true
            })
            .parent().attr({
                // escape that a bit; firefox has a severe XSS issue (see bug 31065)
                'aria-label': a11yLabel.replace(/["<]/g, function (match) {
                    if (match === '"') return '&quot';
                    if (match === '<') return '&lt;';
                    return match;
                })
            });
        },

        picture: function (baton) {
            // show picture of sender or first recipient
            // special cases:
            // - show picture of first recipient in "Sent items" and "Drafts"
            // - exception: always show sender in threaded messages
            var data = baton.data,
                size = api.threads.size(data),
                single = size <= 1,
                addresses = single && !isSearchResult(baton) && account.is('sent|drafts', data.folder_id) ? data.to : data.from,
                node = $('<div class="contact-picture" aria-hidden="true">');

            this.append(node);

            if (isSearchResult(baton) && data.picture) return pictureHalo(node, data.picture);
            pictureHalo(node, addresses);
        },

        senderPicture: function (baton) {
            // shows picture of sender see Bug 41023
            var addresses = baton.data.from,
                node = $('<div class="contact-picture" aria-hidden="true">');

            this.append(node);
            pictureHalo(node, addresses);
        },

        date: function (baton, options) {
            var data = baton.data, t = data.received_date;
            options = _.extend({
                fulldate: baton.app && baton.app.props.get('exactDates'),
                smart: !(baton.app && baton.app.props.get('exactDates'))
            }, options);
            if (!_.isNumber(t)) return;
            this.append(
                $('<time class="date gray">')
                .attr('datetime', moment(t).toISOString())
                .text(util.getDateTime(t, options))
            );
        },

        smartdate: function (baton) {
            extensions.date.call(this, baton, { fulldate: false, smart: true });
        },

        fulldate: function (baton) {
            extensions.date.call(this, baton, { fulldate: true, smart: false });
        },

        from: function (baton) {
            var opt = { folder: baton.data.folder_id, field: 'from', showDisplayName: true };
            // push options through fromPipeline
            _.each(extensions.fromPipeline, function (fn) { fn.call(this, baton, opt); });
            this.append(
                $('<div class="from">').attr('title', opt.mailAddress).append(
                    $('<span class="flags">'),
                    util.getFrom(baton.data, _.pick(opt, 'field', 'reorderDisplayName', 'showDisplayName', 'unescapeDisplayName'))
                )
            );
        },

        fromDetail: function (baton) {

            var $el = $('<div class="from">'),
                data = baton.data,
                from = data.from || [],
                length = from.length;

            // from is special as we need to consider the "sender" header
            // plus making the mail address visible (see bug 56407)

            _(from).each(function (item, i) {

                var email = String(item[1] || '').toLowerCase(),
                    name = util.getDisplayName(item);
                if (!email) return;

                $el.append(
                    $('<a href="#" role="button" class="halo-link person-link person-from ellipsis">')
                        .data({ email: email, email1: email })
                        .text(name)
                );

                if (name !== email) {
                    $el.append($('<span class="address">').text('<' + email + '>'));
                }

                // save space on mobile by showing address only for suspicious mails
                if (_.device('smartphone') && name.indexOf('@') > -1) $el.addClass('show-address');

                if (i < length - 1) $el.append('<span class="delimiter">,</span>');
            });

            this.append($el);
        },

        fromPipeline: {
            // field: from vs. to
            field: function (baton, opt) {
                if (baton.data.threadSize > 1) return;
                if (account.is('sent|drafts', opt.folder)) opt.field = 'to';
            },
            // field: from vs. to
            fieldSearch: function (baton, opt) {
                if (!isSearchResult(baton)) return;
                var app = baton.app && baton.app.get('find');
                opt.field = app && account.is('sent|drafts', app.getFolderFacetValue()) ? 'to' : 'from';
            },
            // showDisplayName, reorderDisplayName and unescapeDisplayName
            displayName: function (baton, opt) {
                opt.reorderDisplayName = opt.unescapeDisplayName = (baton.options.sort !== 'from-to');
                if (baton.options.sort !== 'from-to') return;
                // get folder data to check capabilities:
                // if bit 4096 is set, the server sorts by display name; if unset, it sorts by local part.
                var capabilities = folderAPI.pool.getModel(opt.folder).get('capabilities') || 0;
                opt.showDisplayName = !!(capabilities & 4096);
            },
            // mailAddress
            address: function (baton, opt) {
                opt.mailAddress = util.getFrom(baton.data, { field: opt.field, showDisplayName: false }).text();
            }
        },

        size: function (baton) {
            //show size if option is enabled or sorting by size
            if (baton.app && (baton.app.props.get('sort') !== 608 && !baton.app.props.get('alwaysShowSize'))) return;

            var data = baton.data;
            if (!_.isNumber(data.size)) return;
            var size = util.threadFileSize(data.thread || [data]);
            this.append(
                $('<span class="size">').text(strings.fileSize(size, 1))
            );
        },

        unreadClass: function (baton) {
            var isUnseen = util.isUnseen(baton.data);
            this.closest('.list-item').toggleClass('unread', isUnseen);
        },

        deleted: function (baton) {
            this.parent().toggleClass('deleted', util.isDeleted(baton.data));
        },

        colorflag: function (baton) {
            if (!settings.get('features/flag/color')) return;
            var color = baton.data.color_label,
                icon = 'fa-bookmark';
            // 0 and a buggy -1
            if (color <= 0) return;
            // show bookmark with outline only, if thread color does not coincide with most recent mail
            var isThreaded = baton.app && baton.app.isThreaded();
            if ((isThreaded || baton.options.threaded) &&
                baton.data.thread &&
                color !== baton.data.thread[0].color_label) {
                icon = 'fa-bookmark-o';
                color = 0;
            }
            this.append(
                $('<i class="color-flag fa" aria-hidden="true">')
                    .addClass(icon)
                    .addClass(color > 0 ? 'flag_' + color : 'multiple-colors')
            );
        },

        flag: function (baton) {
            if (!settings.get('features/flag/star') || !util.isFlagged(baton.data)) return;
            this.append($('<span class="flag">').append(
                extensions.flagIcon.call(this).attr('title', gt('Flagged'))
            ));
        },

        flagIcon: function () {
            // icon is set via css
            return $('<i class="fa" aria-hidden="true">');
        },

        // list view
        flaggedClass: function (baton) {
            if (!settings.get('features/flag/star')) return;
            this.closest('.list-item').toggleClass('flagged', util.isFlagged(baton.data));
        },

        flagToggle: (function () {

            function makeAccessible(data, index, node) {
                var label = util.isFlagged(data) ? gt('Flagged') : gt('Not flagged');
                $(node).attr({ 'aria-label': label, 'aria-pressed': util.isFlagged(data) })
                       .find('.fa').attr('title', label);
            }

            function toggle(e) {
                e.preventDefault();
                var data = e.data.model.toJSON();
                // toggle 'flagged' bit
                if (util.isFlagged(data)) api.flag(data, false); else api.flag(data, true);
                $(this).each(_.partial(makeAccessible, data));
            }

            return function (baton) {
                if (!settings.get('features/flag/star') || util.isEmbedded(baton.data)) return;
                var self = this;
                folderAPI.get(baton.data.folder_id).done(function (data) {
                    // see if the user is allowed to modify the flag status - always allows for unified folder
                    if (!folderAPI.can('write', data) || folderAPI.is('unifiedfolder', data)) return;
                    self.append(
                        $('<a href="#" role="button" class="flag io-ox-action-link" data-action="flag">')
                        .append(extensions.flagIcon.call(this))
                        .each(_.partial(makeAccessible, baton.data))
                        .on('click', { model: baton.view.model }, toggle)
                    );
                });
            };
        }()),

        threadSize: function (baton) {
            // only consider thread-size if app is in thread-mode
            var isThreaded = baton.app && baton.app.isThreaded();
            // seems that threaded option is used for tests only
            if (!isThreaded && !baton.options.threaded) return;

            var size = api.threads.size(baton.data);
            if (size <= 1) return;

            this.append(
                $('<div class="thread-size" aria-hidden="true">').append(
                    $('<span class="number drag-count">').text(size)
                )
            );
        },

        paperClip: function (baton) {
            if (!baton.data.attachment) return;
            this.append(
                $('<i class="fa fa-paperclip has-attachments" aria-hidden="true">')
            );
        },

        sharedAttachement: function (baton) {
            if (!baton.model || !_.has(baton.model.get('headers'), 'X-Open-Xchange-Share-URL')) return;
            this.append(
                $('<i class="fa fa-cloud-download is-shared-attachement" aria-hidden="true">')
            );
        },

        pgp: {
            encrypted: function (baton) {
                //simple check for encrypted mail
                if (!/^multipart\/encrypted/.test(baton.data.content_type) &&
                        !(baton.model.get('security') && baton.model.get('security').decrypted)) return;

                this.append(
                    $('<i class="fa fa-lock encrypted" aria-hidden="true">')
                );
            },
            signed: function (baton) {
                //simple check for signed mail
                if (!/^multipart\/signed/.test(baton.data.content_type) &&
                    !(baton.model.get('security') && baton.model.get('security').signatures)) return;

                this.append(
                    $('<i class="fa fa-pencil-square-o signed" aria-hidden="true">')
                );
            }
        },

        priority: function (baton) {
            var node = util.getPriority(baton.data);
            if (!node.length) return;
            this.append(
                $('<span class="priority" aria-hidden="true">').append(node)
            );
        },

        envelope: function () {
            return $('<i class="fa seen-unseen-indicator" aria-hidden="true">').appendTo(this);
        },

        unread: function (baton) {
            var isUnseen = util.isUnseen(baton.data);
            if (isUnseen) extensions.envelope.call(this).attr('title', gt('Unread'));
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
                keepPrefix = baton.data.threadSize === 1,
                subject = util.getSubject(data, keepPrefix),
                node;

            this.append(
                $('<div class="subject">').append(
                    $('<span class="flags">'),
                    node = $('<span class="drag-title gray">').text(subject)
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

        //#. empty message for list view
        empty: function () { this.text(gt('Empty')); },

        // add orignal folder as label to search result items
        folder: function (baton) {
            // missing data
            if (!baton.data.original_folder_id) return;
            var isUnseenFolder = baton.app && baton.app.folder && baton.app.folder.get() === 'virtual/all-unseen';
            // apply only for search results and for unseen folder
            if (!isSearchResult(baton) && !isUnseenFolder) return;
            this.append($('<span class="original-folder">').append(folderAPI.getTextNode(baton.data.original_folder_id)));
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
                $(this).parent().children().show();
                $(this).hide();
            };

            return function (baton) {

                var data = baton.data;

                // figure out if 'to' just contains myself - might be a mailing list, for example
                var showCC = data.cc && data.cc.length > 0,
                    showTO = data.to && data.to.length > 0,
                    showBCC = data.bcc && data.bcc.length > 0,
                    show = showTO || showCC || showBCC,
                    container = $('<div class="recipients">');

                if (!show) {
                    // fix broken layout when mail has only 'to' and 'attachments'
                    this.append(container.append($.txt('\u00A0')));
                    return;
                }

                if (showTO) {
                    container.append(
                        // TO
                        $('<span class="io-ox-label">').append(
                            $.txt(gt('To')),
                            $.txt('\u00A0\u00A0')
                        ),
                        util.serializeList(data, 'to'),
                        $.txt(' \u00A0 ')
                    );
                }
                if (showCC) {
                    container.append(
                        // CC
                        $('<span class="io-ox-label">').append(
                            $.txt(gt.pgettext('CC', 'Copy')),
                            '\u00A0\u00A0'
                        ),
                        util.serializeList(data, 'cc'),
                        $.txt(' \u00A0 ')
                    );
                }
                if (showBCC) {
                    container.append(
                        // BCC
                        $('<span class="io-ox-label">').append(
                            $.txt(gt('Blind copy')),
                            '\u00A0\u00A0'
                        ),
                        util.serializeList(data, 'bcc'),
                        $.txt(' \u00A0 ')
                    );
                }

                this.append(container);

                var items = container.find('.person-link');
                if (items.length > 3) {
                    container.children().slice(4).hide();
                    container.append(
                        //#. %1$d - number of other recipients (names will be shown if string is clicked)
                        $('<a role="button" href="#" class="show-all-recipients">').text(gt('and %1$d others', items.length - 2))
                        .on('click', showAllRecipients)
                    );
                }
            };
        }()),

        attachmentList: (function attachmentList() {

            function drawInlineLinks(node, data) {
                var extension = new links.InlineLinks({
                    dropdown: false,
                    ref: 'io.ox/mail/attachment/links'
                });
                return extension.draw.call(node, ext.Baton({ data: data }));
            }

            var CustomAttachmentView,
                renderContent = function () {

                    var node = this.$('.file'),
                        data = this.model.toJSON(),
                        url, contentType;

                    new links.Dropdown({
                        label: this.model.getShortTitle(),
                        noCaret: true,
                        ref: 'io.ox/mail/attachment/links'
                    })
                    .draw.call(node, ext.Baton({ context: this.model.collection.toJSON(), data: data, $el: node }));

                    url = api.getUrl(data, 'download');
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
                };

            return function (baton) {

                if (baton.attachments.length === 0) return $.when();
                // ensure there's a model when reading headers
                var headers = baton.model ? baton.model.get('headers') : baton.data.headers || {};
                // hide attachments for our own share invitations
                if (headers['X-Open-Xchange-Share-Type']) this.hide();

                var $el = this;

                _.once(function () {
                    CustomAttachmentView = attachment.View.extend({
                        renderContent: renderContent
                    });
                })();

                var list = baton.attachments.map(function (m) {
                        m.group = 'mail';
                        return m;
                    }),
                    collection = new attachment.Collection(list),
                    view = new attachment.List({
                        AttachmentView: CustomAttachmentView,
                        collection: collection,
                        el: $el,
                        mode: settings.get('attachments/layout/detail/' + _.display(), 'list')
                    });

                $el.append(view.render().$el);

                view.renderInlineLinks = function () {
                    var models = this.getValidModels(), $links = this.$header.find('.links').empty();
                    if (models.length >= 1) drawInlineLinks($links, _(models).invoke('toJSON'));
                };

                view.listenTo(view.collection, 'add remove reset', view.renderInlineLinks);
                view.renderInlineLinks();

                view.$el.on('click', 'li.item', function (e) {
                    var node = $(e.currentTarget),
                        clickTarget = $(e.target), id, data, baton;

                    // skip if click was on the dropdown
                    if (!clickTarget.attr('data-original')) return;

                    // skip attachments without preview
                    if (!node.attr('data-original')) return;

                    id = node.attr('data-id');
                    data = collection.get(id).toJSON();
                    baton = ext.Baton({ startItem: data, data: list, restoreFocus: clickTarget });

                    actions.invoke('io.ox/mail/actions/view-attachment', null, baton);
                });

                view.on('change:layout', function (mode) {
                    settings.set('attachments/layout/detail/' + _.display(), mode).save();
                });

                return view;
            };
        }()),

        flagPicker: function (baton) {
            if (!settings.get('features/flag/color')) return;
            flagPicker.draw(this, baton);
        },

        unreadToggle: (function () {

            function makeAccessible(data, index, node) {
                var label = util.isUnseen(data) ? gt('Unread') : gt('Read');
                $(node).attr({ 'aria-label': label, 'aria-pressed': util.isUnseen(data) })
                       .find('.fa').attr('title', label);
            }

            function toggle(e) {
                e.preventDefault();
                var data = e.data.model.toJSON();
                // toggle 'unseen' bit
                if (util.isUnseen(data)) api.markRead(data); else api.markUnread(data);
                $(this).each(_.partial(makeAccessible, data));
            }

            return function (baton) {

                if (util.isEmbedded(baton.data)) return;
                var self = this;
                folderAPI.get(baton.data.folder_id).done(function (data) {
                    // see if the user is allowed to modify the read/unread status
                    // always allows for unifeid folder
                    var showUnreadToggle = folderAPI.can('write', data) || folderAPI.is('unifiedfolder', data);
                    if (!showUnreadToggle) return;
                    self.append(
                        $('<a href="#" role="button" class="unread-toggle io-ox-action-link" data-action="unread-toggle">')
                        .append('<i class="fa" aria-hidden="true">')
                        .each(_.partial(makeAccessible, baton.data))
                        .on('click', { model: baton.view.model }, toggle)
                    );
                });
            };
        }()),

        externalImages: (function () {

            function loadImages(e) {
                e.preventDefault();
                var view = e.data.view;
                view.trigger('load');
                view.$el.find('.external-images').remove();
                // get unmodified mail
                api.getUnmodified(view.model.pick('id', 'folder', 'folder_id', 'parent')).done(function (data) {
                    view.trigger('load:done');
                    view.model.set(data);
                });
                return false;
            }

            function draw(model) {

                // nothing to do if message is unchanged
                if (model.get('modified') !== 1) return this.find('.external-images').remove();

                this.append(
                    $('<div class="notification-item external-images">').append(
                        $('<button type="button" class="btn btn-default btn-sm">').text(gt('Show images')),
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

        plainTextFallback: (function () {

            function draw(model) {
                // avoid duplicates
                if (this.find('.warnings').length) return;

                if (model.get('warnings')) {

                    this.append(
                        $('<div class="alert alert-error warnings">')
                        .text(model.get('warnings').error)
                    );
                }
            }

            return function (baton) {
                draw.call(this, baton.model);
                baton.view.listenTo(baton.model, 'change:warnings', draw.bind(this));
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
                        $('<button type="button" class="btn btn-primary btn-sm">').text(
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
        }())
    };

    return extensions;
});
