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
     'less!io.ox/calendar/style'
    ], function (ext, util, calAPI, userAPI, groupAPI, resourceAPI, folderAPI, attachments, links, gt) {

    'use strict';

    // draw via extension points

    ext.point('io.ox/calendar/detail').extend({
        index: 100,
        id: 'inline-actions',
        draw: function (baton) {
            ext.point('io.ox/calendar/detail/actions').invoke('draw', this, baton);
        }
    });

    // draw appointment date & time
    ext.point('io.ox/calendar/detail').extend({
        index: 200,
        id: 'date',
        draw: function (baton) {
            var node = $('<div>');
            this.append(node);
            ext.point('io.ox/calendar/detail/date').invoke('draw', node, baton);
        }
    });

    // draw appointment time
    ext.point('io.ox/calendar/detail/date').extend({
        index: 100,
        id: 'time',
        draw: function (baton) {
            this.append(
                util.addTimezoneLabel($('<div>').addClass('interval'), baton.data)
            );
        }
    });

    // draw date and recurrence information
    ext.point('io.ox/calendar/detail/date').extend({
        index: 200,
        id: 'date',
        draw: function (baton) {
            var recurrenceString = util.getRecurrenceString(baton.data);
            this.append(
                $('<div>').addClass('day').append(
                    $.txt(gt.noI18n(util.getDateInterval(baton.data))),
                    $.txt(gt.noI18n((recurrenceString !== '' ? ' \u2013 ' + recurrenceString : '')))
                )
            );
        }
    });

    // draw private flag
    ext.point('io.ox/calendar/detail').extend({
        index: 250,
        id: 'private-flag',
        draw: function (baton) {
            if (baton.data.private_flag) {
                $('<i class="fa fa-lock private-flag">').appendTo(this);
            }
        }
    });

    // draw title
    ext.point('io.ox/calendar/detail').extend({
        index: 300,
        id: 'title',
        draw: function (baton) {
            this.append(
                $('<h1>').addClass('title clear-title').text(gt.noI18n(baton.data.title || ''))
            );
        }
    });

    // draw location
    ext.point('io.ox/calendar/detail').extend({
        index: 400,
        id: 'location',
        draw: function (baton) {
            if (baton.data.location) {
                this.append(
                    $('<div class="location">').text(gt.noI18n(baton.data.location))
                );
            }
        }
    });

    // draw note/comment
    ext.point('io.ox/calendar/detail').extend({
        index: 500,
        id: 'note',
        draw: function (baton) {
            if (baton.data.note) {
                this.append(
                    $('<div>').addClass('note').html(util.getNote(baton.data))
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
            comment = conf.comment || conf.message || '',
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

        node = $('<li class="participant">')
            .addClass(looksLikeResource(obj) ? 'halo-resource-link' : 'halo-link')
            .append(
                $('<a href="#">').addClass(personClass + ' ' + statusClass).text(gt.noI18n(name)),
                // has confirmation icon?
                confirm !== '' ? $('<span>').addClass('status ' + statusClass).append(confirm) : '',
                // has confirmation comment?
                comment !== '' ? $('<div>').addClass('comment').text(gt.noI18n(conf.comment)) : ''
            )
            .data(_.extend(obj, { display_name: display_name, email1: mail_lc }));
        if (comment !== '') {
            node.append();
        }
        return node;
    }

    ext.point('io.ox/calendar/detail').extend({
        index: 600,
        id: 'participants',
        draw: function (baton) {

            var list = baton.data.participants || {},
                $i = list.length,
                MIN = 0,
                participants = $i > MIN ? $('<div>').addClass('participants') : $(),
                confirmations = {};

            // has participants? should always be true. Was $i > 1 (see bug #23295).
            if ($i > MIN) {

                confirmations = util.getConfirmations(baton.data);
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

                var plist;

                participants.append(
                    $('<fieldset>').append(
                        $('<legend>').addClass('io-ox-label').text(gt('Participants')),
                        plist = $('<ul>').addClass('participant-list list-inline')
                    )
                );

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
                        participants.append(
                            $('<fieldset>').append(
                                $('<legend>').addClass('io-ox-label').text(gt('External participants')),
                                extList = $('<ul>').addClass('participant-list list-inline')
                            )
                        );
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
                                participants.append(
                                    $('<fieldset>').append(
                                        $('<legend>').addClass('group io-ox-label').text(gt.noI18n(obj.display_name + ':')),
                                        glist = $('<ul>').addClass('participant-list list-inline')
                                    )
                                );

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
                        participants.append(
                            $('<fieldset>').append(
                                $('<legend>').addClass('io-ox-label').text(gt('Resources')),
                                plist = $('<ul>').addClass('participant-list list-inline')
                            )
                        );
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
                    // add summary
                    var sumData = util.getConfirmationSummary(confirmations);
                    if (sumData.count > 3) {
                        var sum = $('<div>').addClass('summary');
                        _.each(sumData, function (res) {
                            if (res.count > 0) {
                                sum.append(
                                    $('<span>')
                                        .addClass('countgroup')
                                        .text(res.count)
                                        .prepend(
                                            $('<span>')
                                                .addClass('status ' + res.css)
                                                .append(res.icon)
                                        )
                                );
                            }
                        });
                        // if (sumData.count > 10) {
                        //     sum.append($('<span>').addClass('countgroup').text('(' + sumData.count + ')'));
                        // }
                        participants.append(sum);
                    }
                    // draw action links
                    ext.point('io.ox/calendar/detail/inline-actions-participantrelated').invoke('draw', participants, baton);
                    // finish
                    participants.idle();
                });
            }

            this.append(participants);
        }
    });

    ext.point('io.ox/calendar/detail/inline-actions-participantrelated').extend({
        index: 700,
        id: 'inline-actions-participantrelated',
        draw: function (baton) {
            if (baton.data.participants && baton.data.participants.length > 1) {
                ext.point('io.ox/calendar/detail/actions-participantrelated').invoke('draw', this, baton);
            }
        }
    });

    // draw details
    ext.point('io.ox/calendar/detail').extend({
        index: 800,
        id: 'details',
        draw: function (baton) {
            var node = $('<dl>');
            this.append(
                $('<fieldset>').addClass('details')
                    .append(
                        $('<legend>').addClass('io-ox-label').text(gt('Details')),
                        node.addClass('dl-horizontal')
                )
            );
            ext.point('io.ox/calendar/detail/details').invoke('draw', node, baton);
        }
    });

    // organizer
    ext.point('io.ox/calendar/detail/details').extend({
        index: 100,
        id: 'organizer',
        draw: function (baton) {

            // internal or external organizer?
            if (!baton.data.organizerId && !baton.data.organizer) return;

            this.append(
                $('<dt>').append(
                    $.txt(gt('Organizer')), $.txt(gt.noI18n(':\u00A0'))
                ),
                $('<dd class="detail organizer">').append(
                    baton.data.organizerId ?
                        $('<a href="#" class="halo-link">').data({ user_id: baton.data.organizerId }).append(
                            userAPI.getTextNode(baton.data.organizerId)
                        ) :
                        $('<a href="#" class="halo-link">').data({ email1: baton.data.organizer }).text(
                            baton.data.organizer
                        )
                )
             );
        }
    });

    // show as
    ext.point('io.ox/calendar/detail/details').extend({
        index: 200,
        id: 'shownAs',
        draw: function (baton) {
            this.append(
                $('<dt>')
                    .append($.txt(gt('Shown as')), $.txt(gt.noI18n(':\u00A0'))),
                $('<dd>')
                    .append(
                        $('<i>').addClass('fa fa-square shown_as ' + util.getShownAsClass(baton.data)),
                        $('<span>')
                            .addClass('detail shown-as')
                            .append($.txt(gt.noI18n('\u00A0')), $.txt(util.getShownAs(baton.data)))
                    )
            );
        }
    });

    // folder
    ext.point('io.ox/calendar/detail/details').extend({
        index: 300,
        id: 'folder',
        draw: function (baton) {
            if (baton.data.folder_id) {
                this.append(
                    $('<dt>')
                        .append($.txt(gt('Folder')), $.txt(gt.noI18n(':\u00A0'))),
                    $('<dd>')
                        .attr('data-folder', baton.data.folder_id)
                        .append(folderAPI.getTextNode(baton.data.folder_id))
                );
            }
        }
    });

    // created on/by
    ext.point('io.ox/calendar/detail/details').extend({
        index: 400,
        id: 'created',
        draw: function (baton) {
            if (baton.data.creation_date || baton.data.created_by) {
                this.append(
                    $('<dt>').append(
                        $.txt(gt('Created')), $.txt(gt.noI18n(':\u00A0'))
                    ),
                    $('<dd>').append(
                        $('<span>').text(gt.noI18n(baton.data.creation_date ? util.getDate(baton.data.creation_date) : '')),
                        $('<span>').text(gt.noI18n(baton.data.creation_date ? ' \u2013 ' : '')),
                        $('<a href="#" class="halo-link">').data({ user_id: baton.data.created_by }).append(
                            baton.data.created_by ? userAPI.getTextNode(baton.data.created_by) : ''
                        )
                    )
                 );
            }
        }
    });

    // modified on/by
    ext.point('io.ox/calendar/detail/details').extend({
        index: 500,
        id: 'modified',
        draw: function (baton) {
            if (baton.data.last_modified || baton.data.modified_by) {
                this.append(
                    $('<dt>').append(
                        $.txt(gt('Modified')), $.txt(gt.noI18n(':\u00A0'))
                    ),
                    $('<dd>').append(
                        $('<span>').text(gt.noI18n(baton.data.last_modified ? util.getDate(baton.data.last_modified) : '')),
                        $('<span>').text(gt.noI18n(baton.data.last_modified ? ' \u2013 ' : '')),
                        $('<a href="#" class="halo-link">').data({ user_id: baton.data.modified_by }).append(
                            baton.data.modified_by ? userAPI.getTextNode(baton.data.modified_by) : ''
                        )
                    )
                 );
            }
        }
    });

    ext.point('io.ox/calendar/detail').extend({
        id: 'attachments',
        index: 550,
        draw: function (baton) {
            var $node = $('<fieldset>').append(
                $('<legend>').addClass('io-ox-label').text(gt('Attachments'))
            );

            if (calAPI.uploadInProgress(_.ecid(baton.data))) {
                this.append(
                    $node.css({width: '30%', height: '12px'}).busy()
                );
            } else if (baton.data.number_of_attachments && baton.data.number_of_attachment !== 0) {
                this.append($node);
                ext.point('io.ox/calendar/detail/attachments').invoke('draw', $node, baton);
            }
        }
    });

    ext.point('io.ox/calendar/detail/attachments').extend(new attachments.AttachmentList({
        id: 'attachment-list',
        index: 200,
        module: 1,
        selector: '.window-container.io-ox-calendar-window'
    }));

    function redraw(e, baton) {
        $(this).replaceWith(e.data.view.draw(baton));
    }

    return {

        draw: function (baton, options) {
            // make sure we have a baton
            baton = ext.Baton.ensure(baton);
            try {
                var node = $.createViewContainer(baton.data, calAPI).on('redraw', { view: this }, redraw);
                node.addClass('calendar-detail view user-select-text').attr('data-cid', String(_.cid(baton.data)));
                ext.point('io.ox/calendar/detail').invoke('draw', node, baton, options);

                return node;

            } catch (e) {
                console.error('io.ox/calendar/view-detail:draw()', e);
            }
        }
    };
});
