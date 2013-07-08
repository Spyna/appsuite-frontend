/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2011
 * Mail: info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/mail/view-grid-template',
    ['io.ox/mail/util',
     'io.ox/mail/api',
     'io.ox/core/tk/vgrid',
     'io.ox/core/api/account',
     'gettext!io.ox/core/mail',
     'less!io.ox/mail/style.less'], function (util, api, VGrid, account, gt) {

    'use strict';

    var that = {

        // main grid template
        main: {

            // will be replaced with proper object from mail/main.js
            openThreads: {},

            unified: false,

            build: function () {
                var from, date, priority, subject, attachment, threadSize, threadSizeCount, threadSizeIcon,
                    flag, answered, forwarded, unread, account = null;
                this.addClass('mail').append(
                    $('<div>').append(
                        date = $('<span class="date">'),
                        from = $('<div class="from">')
                    ),
                    $('<div>').append(
                        threadSize = $('<div class="thread-size">').append(
                            threadSizeCount = $('<span class="number">'),
                            $.txt(' '),
                            threadSizeIcon = $('<i class="icon-caret-right">')
                        ),
                        flag = $('<div class="flag">').text(_.noI18n('\u00A0')),
                        attachment = $('<i class="icon-paper-clip">'),
                        priority = $('<span class="priority">'),
                        $('<div class="subject">').append(
                            unread = $('<i class="icon-unread icon-circle">'),
                            answered = $('<i class="icon-circle-arrow-left">'),
                            forwarded = $('<i class="icon-circle-arrow-right">'),
                            subject = $('<span class="drag-title">')
                        )
                    )
                );
                if (that.unified) {
                    this.append(account = $('<div class="account-name">'));
                }
                return {
                    from: from,
                    date: date,
                    priority: priority,
                    unread: unread,
                    subject: subject,
                    attachment: attachment,
                    threadSize: threadSize,
                    threadSizeCount: threadSizeCount,
                    threadSizeIcon: threadSizeIcon,
                    flag: flag,
                    answered: answered,
                    forwarded: forwarded,
                    account: account
                };
            },
            set: function (data, fields, index) {
                fields.priority.empty().append(util.getPriority(data));
                var subject = $.trim(data.subject);
                if (subject !== '') {
                    fields.subject.removeClass('empty').text(_.noI18n(subject));
                } else {
                    fields.subject.addClass('empty').text(gt('No subject'));
                }
                if (!data.threadSize || data.threadSize <= 1) {
                    fields.threadSize.css('display', 'none');
                    fields.threadSizeCount.text(_.noI18n(''));
                } else {
                    fields.threadSize.css('display', '');
                    fields.threadSizeCount.text(_.noI18n(data.threadSize));
                    fields.threadSizeIcon.attr('class', (index + 1) in that.openThreads ? 'icon-caret-down' : 'icon-caret-right');
                }
                fields.from.empty().append(
                    util.getFrom(data, (data.threadSize || 1) === 1 && account.is('sent', data.folder_id) ? 'to' : 'from')
                );
                fields.date.text(_.noI18n(util.getTime(data.received_date)));
                fields.attachment.css('display', data.attachment ? '' : 'none');
                var color = api.tracker.getColorLabel(data);
                fields.flag.get(0).className = 'flag flag_' + (color || 0);
                if (fields.account) {
                    fields.account.text(util.getAccountName(data));
                }
                if (util.isUnseen(data) || api.tracker.isPartiallyUnseen(data)) {
                    this.addClass('unread');
                }
                if (util.byMyself(data)) {
                    this.addClass('me');
                }
                if (util.isDeleted(data)) {
                    this.addClass('deleted');
                }
                var thread = api.tracker.getThread(data) || data;
                if (util.isAnswered(thread, data)) {
                    this.addClass('answered');
                }
                if (util.isForwarded(thread, data)) {
                    this.addClass('forwarded');
                }
                this.attr('data-index', index);
            }
        },

        // use label concept to visualize thread overview
        thread: {
            build: function () {
            },
            set: function (data, fields, index, prev, grid) {
                var self = this.removeClass('vgrid-label').addClass('thread-summary').empty(),
                    thread = api.getThread(prev);
                return api.getList(thread).done(function (list) {
                    var length = list.length, subset = list.slice(1);
                    // update selection
                    if (!grid.selection.contains(subset)) {
                        grid.selection.insertAt(subset, index);
                    }
                    // draw labels
                    _(subset).each(function (data, index) {
                        self.append(
                            $('<div class="thread-summary-item selectable">')
                            .addClass(util.isUnseen(data) ? 'unread' : undefined)
                            .attr('data-obj-id', _.cid(data))
                            .append(
                                $('<div class="thread-summary-right">')
                                    .addClass('date').text(_.noI18n(util.getTime(data.received_date))),
                                $('<div class="thread-summary-left">').append(
                                    $('<span class="thread-summary-pos">').text(_.noI18n((length - index - 1))),
                                    $('<span class="thread-summary-from">').append(util.getFrom(data).removeClass('person'), $.txt(' ')),
                                    $('<span class="thread-summary-subject">').text(_.noI18n(data.subject))
                                )
                            )
                        );
                    });
                });
            }
        },

        // simple grid-based list for portal & halo
        drawSimpleGrid: function (list) {

            // use template
            var tmpl = new VGrid.Template(),
                $div = $('<div>');

            // add template
            tmpl.add(that.main);

            _(list).each(function (data, i) {
                var clone = tmpl.getClone();
                clone.update(data, i);
                clone.appendTo($div).node
                    .css('position', 'relative')
                    .data('object-data', data)
                    .addClass('hover');
            });

            return $div;
        }
    };

    return that;
});
