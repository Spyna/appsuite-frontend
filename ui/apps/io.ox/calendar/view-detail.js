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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/calendar/view-detail',
    ['io.ox/core/extensions',
     'io.ox/calendar/util',
     'io.ox/calendar/api',
     'io.ox/core/api/user',
     'io.ox/core/api/group',
     'io.ox/core/api/resource',
     'io.ox/core/api/folder',
     'io.ox/core/tk/attachments',
     'io.ox/core/extPatterns/links',
     'gettext!io.ox/calendar',
     'io.ox/calendar/actions',
     'less!io.ox/calendar/style.less'
    ], function (ext, util, calAPI, userAPI, groupAPI, resourceAPI, folderAPI, attachments, links, gt) {

    'use strict';

    // draw via extension points

    ext.point('io.ox/calendar/detail').extend({
        index: 100,
        id: 'inline-actions',
        draw: function (data) {
            ext.point('io.ox/calendar/detail/actions').invoke('draw', this, data);
        }
    });

    // draw appointment date & time
    ext.point('io.ox/calendar/detail').extend({
        index: 200,
        id: 'date',
        draw: function (data) {
            var node;
            this.append(node = $('<div class="appointment-date">'));
            ext.point('io.ox/calendar/detail/date').invoke('draw', node, data);
        }
    });

    // draw appointment time
    ext.point('io.ox/calendar/detail/date').extend({
        index: 100,
        id: 'time',
        draw: function (data) {
            this.append(
                util.addTimezoneLabel($('<div>').addClass('interval'), data)
            );
        }
    });

    // draw date and recurrence information
    ext.point('io.ox/calendar/detail/date').extend({
        index: 200,
        id: 'date',
        draw: function (data) {
            var recurrenceString = util.getRecurrenceString(data);
            this.append(
                $('<div>').addClass('day').append(
                    $.txt(gt.noI18n(util.getDateInterval(data))),
                    $.txt(gt.noI18n((recurrenceString !== '' ? ' \u2013 ' + recurrenceString : '')))
                )
            );
        }
    });

    // draw private flag
    ext.point('io.ox/calendar/detail').extend({
        index: 250,
        id: 'private-flag',
        draw: function (data) {
            if (data.private_flag) {
                $('<i>').addClass('icon-lock private-flag').appendTo(this);
            }
        }
    });

    // draw title
    ext.point('io.ox/calendar/detail').extend({
        index: 300,
        id: 'title',
        draw: function (data) {
            this.append(
                $('<div>').addClass('title clear-title').text(gt.noI18n(data.title || ''))
            );
        }
    });

    // draw location
    ext.point('io.ox/calendar/detail').extend({
        index: 400,
        id: 'location',
        draw: function (data) {
            if (data.location) {
                this.append(
                    $('<div class="location">').text(gt.noI18n(data.location))
                );
            }
        }
    });

    // draw note/comment
    ext.point('io.ox/calendar/detail').extend({
        index: 500,
        id: 'note',
        draw: function (data) {
            if (data.note) {
                this.append(
                    $('<div>').addClass('note').html(util.getNote(data))
                );
            }
        }
    });

    // duck test
    function looksLikeResource(obj) {
        return 'mailaddress' in obj && 'description' in obj;
    }

    function drawParticipant(obj, hash) {
        // initialize vars
        var key = obj.mail || obj.id,
            conf = hash[key] || { status: 0, comment: '' },
            confirm = util.getConfirmationSymbol(conf.status),
            statusClass = util.getConfirmationClass(conf.status),
            isPerson = hash[key] || obj.folder_id,
            personClass = isPerson ? 'person' : '',
            display_name, name, node, name_lc,
            mail_lc = String(obj.mail || obj.mailaddress || '').toLowerCase();
        // external participant?
        if (obj.type === 5) {
            // beautify
            name_lc = String(obj.display_name).toLowerCase();
            if (name_lc === mail_lc) {
                name = display_name = mail_lc;
            } else {
                name = obj.display_name ? obj.display_name + ' <' + mail_lc + '>' : mail_lc;
                display_name = obj.display_name || mail_lc;
            }
        } else {
            name = display_name = obj.display_name || mail_lc;
        }

        node = $('<div class="participant">')
            .addClass(looksLikeResource(obj) ? 'halo-resource-link' : 'halo-link')
            .append($('<a href="#">').addClass(personClass + ' ' + statusClass).text(gt.noI18n(name)))
            .append($('<span>').addClass('status ' + statusClass).html(' ' + confirm))
            .data(_.extend(obj, { display_name: display_name, email1: mail_lc }));
        // has confirmation comment?
        if (conf.comment !== '') {
            node.append($('<span>').addClass('comment').text(gt.noI18n(conf.comment)));
        }
        return node;
    }



    ext.point('io.ox/calendar/detail').extend({
        index: 600,
        id: 'participants',
        draw: function (data) {

            var list = data.participants || {}, $i = list.length, MIN = 0,
                participants = $i > MIN ? $('<div>').addClass('participants') : $(),
                confirmations = {};

            // has participants? should always be true. Was $i > 1 (see bug #23295).
            if ($i > MIN) {

                confirmations = util.getConfirmations(data);
                participants.busy();

                // get internal users
                var users = _(list)
                    .chain()
                    .select(function (obj) {
                        return obj.type === 1;
                    })
                    .map(function (obj) {
                        return obj.id;
                    })
                    .value();
                // get user groups
                var groups = _(list)
                    .chain()
                    .select(function (obj) {
                        return obj.type === 2;
                    })
                    .map(function (obj) {
                        return { id: obj.id };
                    })
                    .value();
                // get resources
                var resources = _(list)
                    .chain()
                    .select(function (obj) {
                        return obj.type === 3;
                    })
                    .map(function (obj) {
                        return { id: obj.id };
                    })
                    .value();
                // get external participants
                var external = _(list)
                    .chain()
                    .select(function (obj) {
                        return obj.type === 5;
                    })
                    .sortBy(function (obj) {
                        return obj.mail;
                    })
                    .value();

                participants.append($('<div>')
                        .addClass('io-ox-label participants-block').text(gt('Participants')));

                var plist = $('<div>').addClass('participant-list').appendTo(participants);

                $.when(userAPI.getList(users), groupAPI.getList(groups), resourceAPI.getList(resources))
                .done(function (userList, groupList, resourceList) {
                    // loop over internal users
                    _(userList)
                        .chain()
                        .sortBy(function (obj) {
                            return obj.display_name;
                        })
                        .each(function (obj) {
                            plist.append(drawParticipant(obj, confirmations));
                        });
                    //external Participants get their own section
                    var extList;
                    if (external.length > 0) {
                        participants.append($('<div>')
                                .addClass('io-ox-label participants-block').text(gt('External participants')),
                                extList = $('<div>').addClass('participant-list'));
                    }
                    // loop over external participants
                    _(external).each(function (obj) {
                        extList.append(drawParticipant(obj, confirmations));
                    });
                    // loop over groups
                    _(groupList)
                        .chain()
                        .sortBy(function (obj) {
                            return obj.display_name;
                        })
                        .each(function (obj) {
                            var glist, memberList;
                            // resolve group members (remove internal users first)
                            memberList = _(obj.members).difference(users);
                            if (memberList.length) {
                                // new section
                                participants
                                    .append($('<div>').addClass('group').text(gt.noI18n(obj.display_name + ':')))
                                    .append(glist = $('<div>').addClass('participant-list'));
                                userAPI.getList(memberList)
                                    .done(function (members) {
                                        // loop members
                                        _(members)
                                            .chain()
                                            .sortBy(function (obj) {
                                                return obj.display_name;
                                            })
                                            .each(function (obj) {
                                                glist.append(drawParticipant(obj, confirmations));
                                            });
                                    });
                            }
                        });
                    // resources
                    if (resourceList.length) {
                        participants
                            .append($('<div>').addClass('io-ox-label').text(gt('Resources')))
                            .append(plist = $('<div>').addClass('participant-list'));
                        // loop over resources
                        _(resourceList)
                            .chain()
                            .sortBy(function (obj) {
                                return obj.display_name;
                            })
                            .each(function (obj) {
                                plist.append(drawParticipant(obj, confirmations));
                            });
                    }
                })
                .always(function () {
                    // finish
                    participants.idle()
                        .append($('<div>').addClass('participants-clear'));
                });
            }

            this.append(participants);
        }
    });


    ext.point('io.ox/calendar/detail').extend({
        index: 700,
        id: 'inline-actions-participantrelated',
        draw: function (data) {
            if (data.participants && data.participants.length > 1) {
                ext.point('io.ox/calendar/detail/actions-participantrelated').invoke('draw', this, data);
            }

        }
    });

    // draw details
    ext.point('io.ox/calendar/detail').extend({
        index: 800,
        id: 'details',
        draw: function (data, options) {
            if (options && options.brief) {
                return $();
            }
            var node = $('<div>').addClass('details')
                .append($('<div>').addClass('io-ox-label').text(gt('Details')))
                .appendTo(this);
            ext.point('io.ox/calendar/detail/details').invoke('draw', node, data);
        }
    });

    // show as
    ext.point('io.ox/calendar/detail/details').extend({
        index: 100,
        id: 'shownAs',
        draw: function (data) {
            this.append(
                $('<span>')
                    .addClass('detail-label')
                    .append($.txt(gt('Show as')), $.txt(gt.noI18n(':\u00A0'))),
                $('<span>')
                    .addClass('detail shown_as ' + util.getShownAsClass(data))
                    .text(gt.noI18n('\u00A0')),
                $('<span>')
                    .addClass('detail shown-as')
                    .append($.txt(gt.noI18n('\u00A0')), $.txt(util.getShownAs(data))),
                $('<br>')
            );
        }
    });

    // folder
    ext.point('io.ox/calendar/detail/details').extend({
        index: 200,
        id: 'folder',
        draw: function (data) {
            if (data.folder_id) {
                this.append(
                    $('<span class="detail-label">')
                        .append($.txt(gt('Folder')), $.txt(gt.noI18n(':\u00A0'))),
                    $('<span class="detail folder">')
                        .attr('data-folder', data.folder_id)
                        .append(folderAPI.getTextNode(data.folder_id)),
                    $('<br>')
                );
            }
        }
    });

    // created on/by
    ext.point('io.ox/calendar/detail/details').extend({
        index: 200,
        id: 'created',
        draw: function (data) {
            if (data.creation_date || data.created_by) {
                this.append(
                    $('<span class="detail-label">').append(
                        $.txt(gt('Created')), $.txt(gt.noI18n(':\u00A0'))
                    ),
                    $('<span class="detail created">').append(
                        $('<span>').text(gt.noI18n(data.creation_date ? util.getDate(data.creation_date) : '')),
                        $('<span>').text(gt.noI18n(data.creation_date ? ' \u2013 ' : '')),
                        $('<a href="#" class="halo-link">').data({ user_id: data.created_by }).append(
                            data.created_by ? userAPI.getTextNode(data.created_by) : ''
                        )
                    ),
                    $('<br>')
                 );
            }
        }
    });

    // modified on/by
    ext.point('io.ox/calendar/detail/details').extend({
        index: 200,
        id: 'modified',
        draw: function (data) {
            if (data.last_modified || data.modified_by) {
                this.append(
                    $('<span class="detail-label">').append(
                        $.txt(gt('Modified')), $.txt(gt.noI18n(':\u00A0'))
                    ),
                    $('<span class="detail modified">').append(
                        $('<span>').text(gt.noI18n(data.last_modified ? util.getDate(data.last_modified) : '')),
                        $('<span>').text(gt.noI18n(data.last_modified ? ' \u2013 ' : '')),
                        $('<a href="#" class="halo-link">').data({ user_id: data.modified_by }).append(
                            data.modified_by ? userAPI.getTextNode(data.modified_by) : ''
                        )
                    ),
                    $('<br>')
                 );
            }
        }
    });

    // organizer
    ext.point('io.ox/calendar/detail/details').extend({
        index: 200,
        id: 'organizer',
        draw: function (data) {
            if (data.organizerId) {
                this.append(
                    $('<span class="detail-label">').append(
                        $.txt(gt('Organizer')), $.txt(gt.noI18n(':\u00A0'))
                    ),
                    $('<span class="detail organizer">').append(
                        $('<a href="#" class="halo-link">').data({ user_id: data.organizerId }).append(
                            data.organizerId ? userAPI.getTextNode(data.organizerId) : ''
                        )
                    ),
                    $('<br>')
                 );
            }
        }
    });

    ext.point('io.ox/calendar/detail').extend({
        id: 'attachments',
        index: 550,
        draw: function (data) {
            var $node;
            if (calAPI.uploadInProgress(_.ecid(data))) {
                this.append(
                        $('<div class="io-ox-label">').text(gt('Attachments')),
                        $node = $('<div>').css({width: '30%', height: '12px'}).busy()
                    );
            } else if (data.number_of_attachments && data.number_of_attachment !== 0) {
                this.append(
                    $('<div class="io-ox-label">').text(gt('Attachments')),
                    $node = $('<div>')
                );
                ext.point('io.ox/calendar/detail/attachments').invoke('draw', $node, new ext.Baton({ data: data }));
            }
        }
    });

    ext.point('io.ox/calendar/detail/attachments').extend(new attachments.AttachmentList({
        id: 'attachment-list',
        index: 200,
        module: 1,
        selector: '.window-container.io-ox-calendar-window'
    }));

    function redraw(e, data) {
        $(this).replaceWith(e.data.view.draw(data));
    }

    return {

        draw: function (data, options) {

            try {
                var node = $.createViewContainer(data, calAPI).on('redraw', { view: this }, redraw);
                node.addClass('calendar-detail view user-select-text').attr('data-cid', String(_.cid(data)));
                ext.point('io.ox/calendar/detail').invoke('draw', node, data, options);

                return node;

            } catch (e) {
                console.error('io.ox/calendar/view-detail:draw()', e);
            }

        }
    };
});
