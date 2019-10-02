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

/* global blankshield */

define('io.ox/mail/detail/view', [
    'io.ox/backbone/disposable',
    'io.ox/mail/common-extensions',
    'io.ox/core/extensions',
    'io.ox/mail/api',
    'io.ox/mail/util',
    'io.ox/core/api/collection-pool',
    'io.ox/mail/detail/content',
    'io.ox/core/extPatterns/links',
    'io.ox/core/a11y',
    'gettext!io.ox/mail',
    'less!io.ox/mail/detail/content',
    'less!io.ox/mail/detail/style',
    'less!io.ox/mail/style',
    'io.ox/mail/actions'
], function (DisposableView, extensions, ext, api, util, Pool, content, links, a11y, gt, contentStyle) {

    'use strict';

    var INDEX = 0;

    ext.point('io.ox/mail/detail').extend({
        id: 'unread-class',
        index: INDEX += 100,
        draw: extensions.unreadClass
    });

    ext.point('io.ox/mail/detail').extend({
        id: 'flagged-class',
        index: INDEX += 100,
        draw: extensions.flaggedClass
    });

    ext.point('io.ox/mail/detail').extend({
        id: 'subject',
        index: INDEX += 100,
        draw: function (baton) {

            var subject = util.getSubject(baton.data);

            this.append(
                $('<h1 class="subject">').text(subject)
            );
        }
    });

    ext.point('io.ox/mail/detail').extend({
        id: 'header',
        index: INDEX += 100,
        draw: function (baton) {
            var header = $('<header class="detail-view-header">');
            ext.point('io.ox/mail/detail/header').invoke('draw', header, baton);
            this.append(header);
        }
    });

    var INDEX_header = 0;

    ext.point('io.ox/mail/detail/header').extend({
        id: 'threadcontrol',
        index: INDEX_header += 100,
        draw: function (baton) {
            var data = baton.data,
                subject = util.getSubject(data),
                title = util.hasFrom(data) ?
                    //#. %1$s: Mail sender
                    //#. %2$s: Mail subject
                    gt('Email from %1$s: %2$s', util.getDisplayName(data.from[0]), subject) : subject;
            this.append(
                $('<h2 class="toggle-mail-body">').append(
                    $('<button type="button" class="toggle-mail-body-btn">')
                        .attr('aria-expanded', baton.view.$el.hasClass('expanded'))
                        .append(
                            $('<span class="sr-only">').text(title)
                        )
                )
            );
        }
    });


    ext.point('io.ox/mail/detail/header').extend({
        id: 'picture',
        index: INDEX_header += 100,
        draw: extensions.senderPicture
    });

    ext.point('io.ox/mail/detail/header').extend({
        id: 'drag-support',
        index: INDEX_header += 100,
        draw: function (baton) {
            this.find('.contact-picture').attr({
                'data-drag-data': _.cid(baton.data),
                'data-drag-message': util.getSubject(baton.data)
            });
        }
    });

    /* move the actions menu to the top in sidepanel on smartphones */
    var extPoint = _.device('smartphone') ? 'io.ox/mail/detail' : 'io.ox/mail/detail/header/row5';

    ext.point(extPoint).extend(new links.InlineLinks({
        id: 'actions',
        index: _.device('smartphone') ? 50 : INDEX_header += 100,
        classes: _.device('smartphone') ? '' : 'actions',
        label: gt('Actions'),
        ariaLabel: gt('Actions'),
        icon: _.device('smartphone') ? undefined : 'fa fa-bars',
        noCaret: true,
        // lfo breaks thread toolbars under certan conditions see ( bug 50939)
        noLfo: true,
        ref: 'io.ox/mail/links/inline',
        smart: true
    }));

    //
    // Header
    //
    ext.point('io.ox/mail/detail/header').extend(
        {
            id: 'unread-toggle',
            index: INDEX_header += 100,
            draw: extensions.unreadToggle
        },
        {
            id: 'paper-clip',
            index: INDEX_header += 100,
            draw: extensions.paperClip
        },
        {
            id: 'rows',
            index: INDEX_header += 100,
            draw: function (baton) {
                for (var i = 1, node; i <= 5; i++) {
                    node = $('<div class="detail-view-row row-' + i + ' clearfix">');
                    ext.point('io.ox/mail/detail/header/row' + i).invoke('draw', node, baton);
                    this.append(node);
                }
            }
        }
    );

    //
    // Row 1
    //
    ext.point('io.ox/mail/detail/header/row1').extend(
        {
            // from is last one in the list for proper ellipsis effect
            id: 'from',
            index: INDEX_header += 100,
            draw: extensions.fromDetail
        },
        {
            id: 'priority',
            index: INDEX_header += 100,
            draw: extensions.priority
        },
        {
            id: 'security',
            index: INDEX_header += 100,
            draw: extensions.security
        },
        {
            id: 'date',
            index: INDEX_header += 100,
            draw: extensions.fulldate
        },
        {
            id: 'flag-toggle',
            index: INDEX_header += 100,
            draw: extensions.flagToggle
        },
        {
            id: 'color-picker',
            index: INDEX_header += 100,
            draw: extensions.flagPicker
        }
    );

    //
    // Row 2
    //
    ext.point('io.ox/mail/detail/header/row2').extend(
        {
            id: 'sender',
            index: 100,
            draw: function (baton) {
                ext.point('io.ox/mail/detail/header/sender').invoke('draw', this, baton);
            }
        }
    );

    ext.point('io.ox/mail/detail/header/sender').extend({
        id: 'default',
        index: 100,
        draw: function (baton) {
            var data = baton.data, from = data.from || [],
                status = util.authenticity('via', data);

            if (status && baton.data.authenticity && baton.data.authenticity.domain_mismatch && baton.data.authenticity.from_domain) {
                this.append(
                    $('<div class="sender">').append(
                        $('<span class="io-ox-label">').append(
                            //#. Works as a label for a sender address. Like "Sent via". If you have no good translation, use "Sender".
                            $.txt(gt('Via')),
                            $.txt('\u00A0\u00A0')
                        ),
                        $('<span class="address">').text(baton.data.authenticity.from_domain)
                    )
                );
            }

            // add 'on behalf of'?
            if (!('headers' in data)) return;
            if (!('Sender' in data.headers)) return;

            var sender = util.parseRecipients(data.headers.Sender);
            if (from[0] && from[0][1] === sender[0][1]) return;

            this.append(
                $('<div class="sender">').append(
                    $('<span class="io-ox-label">').append(
                        //#. Works as a label for a sender address. Like "Sent via". If you have no good translation, use "Sender".
                        $.txt(gt('Via')),
                        $.txt('\u00A0\u00A0')
                    ),
                    $('<span class="address">').text((sender[0][0] || '') + ' <' + sender[0][1] + '>')
                )
            );
        }
    });

    //
    // Row 3
    //
    ext.point('io.ox/mail/detail/header/row3').extend(
        {
            id: 'recipients',
            index: 100,
            draw: function (baton) {
                ext.point('io.ox/mail/detail/header/recipients').invoke('draw', this, baton);
            }
        }
    );

    ext.point('io.ox/mail/detail/header/recipients').extend({
        id: 'default',
        index: 100,
        draw: extensions.recipients
    });

    //
    // Row 4
    //
    ext.point('io.ox/mail/detail/header/row4').extend(
        {
            id: 'different-subject',
            index: 100,
            draw: function (baton) {
                var data = baton.data, baseSubject, threadSubject, mailSubject;

                // no thread?
                if (data.threadSize === 1) return;

                // identical subject?
                baseSubject = api.threads.subject(data);
                threadSubject = util.getSubject(baseSubject, false);
                mailSubject = util.getSubject(data, false);
                if (baseSubject === '' || threadSubject === mailSubject) return;

                this.append(
                    $('<span class="io-ox-label">').text(gt('Subject') + '\u00a0 '),
                    $('<span class="different-subject">').text(mailSubject)
                );
            }
        }
    );

    ext.point('io.ox/mail/detail').extend({
        id: 'notifications',
        index: INDEX += 100,
        draw: function (baton) {
            var section = $('<section class="notifications">');
            ext.point('io.ox/mail/detail/notifications').invoke('draw', section, baton);
            this.append(section);
        }
    });

    ext.point('io.ox/mail/detail').extend({
        id: 'warnings',
        index: INDEX += 100,
        draw: function (baton) {
            var section = $('<section class="warnings">');
            ext.point('io.ox/mail/detail/warnings').invoke('draw', section, baton);
            this.append(section);
        }
    });

    ext.point('io.ox/mail/detail/warnings').extend({
        id: 'plaintextfallback',
        index: 100,
        draw: extensions.plainTextFallback
    });

    var INDEX_notifications = 0;


    ext.point('io.ox/mail/detail/notifications').extend({
        id: 'phishing',
        index: INDEX_notifications += 100,
        draw: extensions.phishing
    });

    ext.point('io.ox/mail/detail/notifications').extend({
        id: 'authenticity',
        index: INDEX_notifications += 100,
        draw: extensions.authenticity
    });

    ext.point('io.ox/mail/detail/notifications').extend({
        id: 'disposition-notification',
        index: INDEX_notifications += 100,
        draw: extensions.dispositionNotification
    });

    ext.point('io.ox/mail/detail/notifications').extend({
        id: 'external-images',
        index: INDEX_notifications += 100,
        draw: extensions.externalImages
    });

    ext.point('io.ox/mail/detail/notifications').extend({
        id: 'disabled-links',
        index: INDEX_notifications += 100,
        draw: extensions.disabledLinks
    });

    ext.point('io.ox/mail/detail').extend({
        id: 'error',
        index: INDEX += 100,
        draw: function () {
            this.append($('<section class="error">').hide());
        }
    });


    ext.point('io.ox/mail/detail').extend({
        id: 'body',
        index: INDEX += 100,
        draw: function () {
            this.append(
                $('<section class="attachments">'),
                // must have tabindex=-1, otherwise tabindex inside Shadow DOM doesn't work
                $('<section class="body user-select-text focusable" tabindex="-1">')
            );
        }
    });

    ext.point('io.ox/mail/detail/body').extend({
        id: 'iframe',
        index: 100,
        draw: function (baton) {
            // "//:0" does not work for src as IE 11 goes crazy when loading the frame
            var iframe = $('<iframe src="" class="mail-detail-frame">').attr('title', gt('Email content')).on('load', function () {
                iframe.contents().on('click', 'a[rel="noopener"], area[target="_blank"]', function (e) {
                    if (_.device('noopener')) return;
                    e.preventDefault();
                    blankshield.open($(this).attr('href'));
                });
            });
            ext.point('io.ox/mail/detail/body/iframe').invoke('draw', iframe, baton);
            this.idle().append(iframe);
        }
    });

    ext.point('io.ox/mail/detail/body').extend({
        id: 'content-flags',
        index: 200,
        draw: function (baton) {
            if (!baton.content) return;
            var $content = $(baton.content);
            this.closest('article')
                .toggleClass('content-links', !!$content.find('a').length);
        }
    });

    ext.point('io.ox/mail/detail/body/iframe').extend({
        id: 'content',
        index: 100,
        draw: function (baton) {

            var contentData = content.get(baton.data, {}, baton.flow),
                $content = $(contentData.content),
                resizing = 0,
                forwardEvent = function (e) {
                    // forward events in iframe to parent window, set iframe as target, so closest selectors etc work as expected (needed in sidepopups for example)
                    e.target = this[0];
                    this.trigger(e);
                }.bind(this);

            baton.content = contentData.content;

            // wrap plain text in body node, so we can treat plain text mails and html mails the same (replace vs append)
            if (contentData.isText) {
                $content = $('<body>').append($content);
            }

            // inject content and listen to resize event
            this.on('load', function () {
                // e.g. iOS is too fast, i.e. load is triggered before adding to the DOM
                _.defer(function () {

                    // This should be replaced with language detection in the future (https://github.com/wooorm/franc)
                    var html = $(this.contentDocument).find('html');
                    if (!html.attr('lang')) html.attr('lang', $('html').attr('lang'));
                    // trigger click or keydown on iframe node to forward events properly -> to close none smart dropdowns correctly or jump to the listview on esc
                    html.on('keydown click', forwardEvent);

                    if (_.device('ios && smartphone')) html.addClass('ios smartphone');

                    $(this.contentDocument).find('head').append('<style>' + contentStyle + '</style>');
                    $(this.contentDocument).find('body').replaceWith($content);

                    $(this.contentWindow)
                        .on('complete toggle-blockquote', { iframe: $(this) }, onImmediateResize)
                        .on('resize', { iframe: $(this) }, onWindowResize)
                        .on('dragover drop', false)
                        .trigger('resize');
                }.bind(this));
            });

            // simple helper to enable resizing on
            // browser resize events
            function onBrowserResize() {
                resizing = 0;
            }

            function onImmediateResize(e) {
                // scrollHeight consdiers paddings, border, and margins
                // set height for iframe and its parent
                e.data.iframe.parent().addBack().height(this.document.body.scrollHeight);
            }

            function onWindowResize(e) {
                // avoid event-based recursion
                if (resizing <= 0) resizing = 2; else return;
                // revert outer size to support shrinking
                e.data.iframe.height('');
                onImmediateResize.call(this, e);
                // we need to wait until allowing further resize events
                // setTimeout is bad because we don't know how long to wait exactly
                // requestAnimationFrame seems to be the proper tool
                // we will have two events so we use a countdown to track this
                this.requestAnimationFrame(function () { resizing--; });
            }

            // track images since they can change dimensions
            $content.find('img').on('load error', function () {
                $(this).off().trigger('complete');
            });

            // react on browser resize
            $(window).on('resize', onBrowserResize);

            // remove event handlers on dispose
            this.on('dispose', function () {
                $(window).off('resize', onBrowserResize);
                $(this.contentWindow).off();
            });
        }
    });

    ext.point('io.ox/mail/detail/body/iframe').extend({
        id: 'events',
        index: 200,
        draw: function () {
            this.on('load', function () {
                // e.g. iOS is too fast, i.e. load is triggered before adding to the DOM
                _.defer(function () {
                    var html = $(this.contentDocument).find('html'),
                        targets = '.mailto-link, .deep-link-tasks, .deep-link-contacts, .deep-link-calendar, .deep-link-files, .deep-link-app';
                    // forward deep link clicks from iframe scope to document-wide handlers
                    html.on('click', targets, function (e) {
                        ox.trigger('click:deep-link-mail', e, this);
                    });
                }.bind(this));
            });
        }
    });

    ext.point('io.ox/mail/detail/body/iframe').extend({
        id: 'max-size',
        index: 1200,
        after: 'content',
        draw: function (baton) {

            this.on('load', function () {
                // e.g. iOS is too fast, i.e. load is triggered before adding to the DOM
                _.defer(function () {

                    var isTruncated = _(baton.data.attachments).some(function (attachment) { return attachment.truncated; });
                    if (!isTruncated) return;

                    var url = 'api/mail?' + $.param({
                        action: 'get',
                        view: 'document',
                        forceImages: true,
                        folder: baton.data.folder_id,
                        id: baton.data.id,
                        session: ox.session
                    });

                    $(this.contentDocument)
                        .find('body .mail-detail-content')
                        .append(
                            $('<div class="max-size-warning">').append(
                                $.txt(gt('This message has been truncated due to size limitations.')), $.txt(' '),
                                $('<a role="button" target="_blank">').attr('href', url).text(
                                    // external images shown?
                                    baton.model.get('modified') !== 1 ?
                                        gt('Show entire message') :
                                        gt('Show entire message including all external images')
                                )
                            )
                        );
                }.bind(this));
            });
        }
    });


    ext.point('io.ox/mail/detail/attachments').extend({
        id: 'attachment-list',
        index: 200,
        draw: function (baton) {
            if (baton.attachments.length === 0) return;
            // reuse existing view, to not duplicate event listeners
            if (baton.view.attachmentView) {
                baton.view.attachmentView.$header.empty();
                this.append(baton.view.attachmentView.render());
                baton.view.attachmentView.renderInlineLinks();
            } else {
                baton.view.attachmentView = extensions.attachmentList.call(this, baton);
                baton.view.listenTo(baton.view.attachmentView, 'dispose', function () {
                    delete baton.view.attachmentView;
                });
            }
        }
    });


    var pool = Pool.create('mail');

    var View = DisposableView.extend({

        className: 'list-item mail-item mail-detail f6-target focusable',

        events: {
            'keydown': 'onToggle',
            'click .detail-view-header': 'onToggle',
            'click .toggle-mail-body-btn': 'onToggle',
            'click a[data-action="retry"]': 'onRetry'
        },

        onChangeFlags: function () {
            // update unread state
            this.$el.toggleClass('unread', util.isUnseen(this.model.get('flags')));
            this.$el.toggleClass('flagged', util.isFlagged(this.model.get('flags')));
        },

        onChangeAttachments: function () {
            if (this.model.changed.attachments && _.isEqual(this.model.previous('attachments'), this.model.get('attachments'))) return;

            var data = this.model.toJSON(),
                baton = ext.Baton({
                    view: this,
                    model: this.model,
                    data: data,
                    attachments: util.getAttachments(data)
                }),
                node = this.$el.find('section.attachments').empty();
            ext.point('io.ox/mail/detail/attachments').invoke('draw', node, baton);
            // global event for tracking purposes
            ox.trigger('mail:detail:attachments:render', this);

            if (this.model.previous('attachments') &&
                this.model.get('attachments') &&
                this.model.previous('attachments')[0].content !== this.model.get('attachments')[0].content) this.onChangeContent();
        },

        onChangeSecurity: function () {
            if (_.device('small')) return;  // Need to redraw action links on desktop only
            var data = this.model.toJSON(),
                baton = ext.Baton({
                    view: this,
                    model: this.model,
                    data: data,
                    attachments: util.getAttachments(data)
                }),
                node = this.$el.find('header.detail-view-header').empty();
            ext.point('io.ox/mail/detail/header').invoke('draw', node, baton);
        },

        getEmptyBodyNode: function () {
            return this.$el.find('section.body').empty();
        },

        onChangeSubject: function () {
            var subject = this.$el.find('h1.subject');
            subject.text(util.getSubject(this.model.get('subject')));
            return subject;
        },

        onChangeContent: function () {
            var data = this.model.toJSON(),
                baton = ext.Baton({
                    view: this,
                    model: this.model,
                    data: data,
                    attachments: util.getAttachments(data)
                }),
                body = this.$el.find('section.body'),
                node = this.getEmptyBodyNode(),
                view = this;
            baton.disable(this.options.disable);
            // set outer height & clear content
            body.css('min-height', this.model.get('visualHeight') || null);
            // draw
            _.delay(function () {
                ext.point('io.ox/mail/detail/body').invoke('draw', node, baton);
                // global event for tracking purposes
                ox.trigger('mail:detail:body:render', view);
                view.trigger('mail:detail:body:render', view);
                body = node = view = null;
            }, 20);
        },

        onChangeRecipients: _.debounce(function () {
            var data = this.model.toJSON(),
                baton = ext.Baton({ data: data, model: this.model, view: this }),
                node = this.$('.recipients').empty();
            ext.point('io.ox/mail/detail/header/recipients').invoke('draw', node, baton);
        }, 10),

        onToggle: function (e) {

            if (e.type === 'keydown' && e.which !== 13 && e.which !== 32) return;

            // ignore click on/inside <a> tags
            // this is required even if a-tags are tabbable elements since some links are removed from dom on click
            if ($(e.target).closest('a').length) return;

            if (!$(e.currentTarget).hasClass('toggle-mail-body-btn')) {
                // ignore clicks on tabbable elements
                var tabbable = a11y.getTabbable(this.$el);
                if (tabbable.index(e.target) >= 0) return;
                if (tabbable.find($(e.target)).length) return;
            }

            // ignore click on dropdowns
            if ($(e.target).hasClass('dropdown-menu')) return;

            // ignore clicks on overlays
            if ($(e.target).hasClass('overlay')) return;

            // don't toggle single messages unless it's collapsed
            if (this.$el.siblings().length === 0 && this.$el.hasClass('expanded')) return;

            // fix collapsed blockquotes
            this.$el.find('.collapsed-blockquote').hide();
            this.$el.find('.blockquote-toggle').show();

            this.toggle();
        },

        onRetry: function (e) {
            e.preventDefault();
            this.$('section.error').hide();
            this.$('section.body').show();
            this.toggle(true);
        },

        onUnseen: function () {
            var data = this.model.toJSON();

            // check if this mail was manually set to unread previously so we don't remove the unread state when not intended (only relevant for list perspective as the detailview is already drawn in other perspectives) see Bug 61525
            if (this.model.cid === api.setToUnread) {
                return;
            }
            if (util.isToplevel(data)) api.markRead(data);
        },

        onLoad: function (data) {

            // since this function is a callback we have to check this.model
            // as an indicator whether this view has been destroyed meanwhile
            if (this.model === null) return;

            // merge data (API updates the model in most cases, but we need this for nested mails)
            if (data) this.model.set(data);

            var unseen = this.model.get('unseen') || util.isUnseen(this.model.get('flags'));

            // done
            this.$el.find('section.body').removeClass('loading');
            this.trigger('load:done');
            // draw
            // nested mails do not have a subject before loading, so trigger change as well
            this.onChangeSubject();
            this.onChangeAttachments();
            this.onChangeContent();
            if (data && (data.security || data.security_info)) this.onChangeSecurity();

            // process unseen flag
            if (unseen) {
                this.onUnseen();
            } else {
                //if this mail was read elsewhere notify other apps about it, for example the notification area (also manages new mail window title)
                api.trigger('update:set-seen', [{ id: this.model.get('id'), folder_id: this.model.get('folder_id') }]);
            }
        },

        onLoadFail: function (e) {
            if (!this.$el) return;
            this.trigger('load:fail');
            this.trigger('load:done');
            this.$el.attr('data-loaded', false);
            this.$('section.error').empty().show().append(
                $('<i class="fa fa-exclamation-triangle" aria-hidden="true">'),
                $('<h4>').text(gt('Error: Failed to load message content')),
                $('<p>').text(e.error),
                $('<a href="#" role="button" data-action="retry">').text(gt('Retry'))
            );
        },

        toggle: function (state) {
            var $li = this.$el,
                $button = $li.find('.toggle-mail-body-btn');

            $li.toggleClass('expanded', state);

            $button.attr('aria-expanded', $li.hasClass('expanded'));

            // trigger DOM event that bubbles
            this.$el.trigger('toggle');

            if ($li.attr('data-loaded') === 'false' && $li.hasClass('expanded')) {
                $li.attr('data-loaded', true);
                $li.find('section.body').addClass('loading');
                this.trigger('load');
                // load detailed email data
                if (this.loaded) {
                    this.onLoad();
                } else {
                    var cid = _.cid(this.model.cid);
                    // check if we have a nested email here, those are requested differently
                    if (_(cid).size() === 1 && cid.id !== undefined && this.model.has('parent')) {
                        api.getNestedMail(this.model.attributes).pipe(
                            this.onLoad.bind(this),
                            this.onLoadFail.bind(this)
                        );
                    } else {
                        // check if this mail was manually set to unread previously so we don't remove the unread state when not intended (only relevant for list perspective as the detailview is already drawn in other perspectives) see Bug 61525
                        api.get(_.extend({}, cid, { unseen: this.model.cid === api.setToUnread })).pipe(
                            this.onLoad.bind(this),
                            this.onLoadFail.bind(this)
                        );
                    }
                }
            } else if ($li.hasClass('expanded')) {
                // trigger resize to restart resizeloop
                this.$el.find('.mail-detail-frame').contents().find('.mail-detail-content').trigger('resize');
            }

            return this;
        },

        expand: function () {
            return this.toggle(true);
        },

        initialize: function (options) {

            this.options = options || {};
            this.model = pool.getDetailModel(options.data);
            this.loaded = options.loaded || false;
            this.listenTo(this.model, 'change:flags', this.onChangeFlags);
            this.listenTo(this.model, 'change:attachments', this.onChangeAttachments);
            this.listenTo(this.model, 'change:to change:cc change:bcc', this.onChangeRecipients);

            this.on({
                'load': function () {
                    this.$('section.body').empty().busy();
                },
                'load:done': function () {
                    this.$('section.body').idle();
                },
                'load:fail': function () {
                    this.$('section.body').hide();
                }
            });
        },

        redraw: function () {
            this.$el.empty();
            this.render();
            if (this.$el.hasClass('expanded')) {
                this.onChangeAttachments();
                this.onChangeContent();
            }
        },

        render: function () {
            var data = this.model.toJSON(),
                baton = ext.Baton({ data: data, model: this.model, view: this });

            // disable extensions?
            baton.disable(this.options.disable);

            this.$el.attr({
                'data-cid': this.model.cid,
                'data-loaded': 'false'
            });

            this.$el.data({ view: this, model: this.model });

            ext.point('io.ox/mail/detail').invoke('draw', this.$el, baton);

            // global event for tracking purposes
            ox.trigger('mail:detail:render', this);

            return this;
        }
    });

    return {
        View: View
    };
});
