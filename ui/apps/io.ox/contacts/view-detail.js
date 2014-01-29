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
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define('io.ox/contacts/view-detail',
    ['io.ox/core/extensions',
     'io.ox/contacts/util',
     'io.ox/contacts/api',
     'io.ox/contacts/actions',
     'io.ox/contacts/model',
     'io.ox/core/api/folder',
     'io.ox/core/extPatterns/links',
     'io.ox/core/date',
     'gettext!io.ox/contacts',
     'settings!io.ox/contacts',
     'less!io.ox/contacts/style.less'
    ], function (ext, util, api, actions, model, folderAPI, links, date, gt, settings) {

    'use strict';

    // smart join
    var join = function () {
        return _(arguments)
            .select(function (obj, i) {
                return i > 0 && !!obj;
            })
            .join(arguments[0] || '');
    };

    function getDescription(data) {
        function single(index, value, translated) {
            var params = new Array(index);
            params[index - 1] = translated ? value : _.noI18n(value);
            return { format: _.noI18n('%' + index + '$s'), params: params };
        }
        if (api.looksLikeDistributionList(data)) {
            return single(7, gt('Distribution list'), true);
        }
        if (api.looksLikeResource(data)) {
            return single(7, gt('Resource'), true);
        }
        if (data.position || data.profession) {
            return {
                format: join(', ', data.position ? '%1$s' : '', data.profession ? '%2$s' : ''),
                params: [_.noI18n(data.position), _.noI18n(data.profession)]
            };
        }
        return util.getMailFormat(data);
    }

    function createText(format, classes) {
        return _.aprintf(
            format.format,
            function (index) {
                return $('<span>').addClass(classes[index]).text(_.noI18n(format.params[index]));
            },
            function (text) {
                return $.txt(text);
            }
        );
    }

    function looksLikeHTML(str) {
        return (/<\w/).test(str);
    }

    function buildDropdown(container, label, data) {
        return new links.DropdownLinks({
            label: label,
            classes: 'attachment-item',
            ref: 'io.ox/contacts/attachment/links'
        }).draw.call(container, data);
    }

    /*
     * Extensions
     */

    var INDEX = 100;

    ext.point('io.ox/contacts/detail').extend({
        index: (INDEX += 100),
        id: 'inline-actions',
        draw: function (baton) {
            if (!api.looksLikeResource(baton.data)) {
                ext.point('io.ox/contacts/detail/actions').invoke('draw', this, baton.data);
            }
        }
    });

    ext.point('io.ox/contacts/detail').extend({
        index: (INDEX += 100),
        id: 'contact-details',
        draw: function (baton) {
            var node;
            this.append(
                node = $('<header class="row-fluid contact-header">')
            );
            ext.point('io.ox/contacts/detail/head').invoke('draw', node, baton);
        }
    });

    // HEAD

    ext.point('io.ox/contacts/detail/head').extend({
        index: 100,
        id: 'contact-picture',
        draw: function (baton) {
            if (api.looksLikeDistributionList(baton.data)) return;
            this.append(
                api.pictureHalo(
                    $('<div class="picture">'),
                    $.extend(baton.data, { width: 64, height: 64, scaleType: 'cover' })
                )
            );
        }
    });

    ext.point('io.ox/contacts/detail/head').extend({
        index: 200,
        id: 'contact-title',
        draw: function (baton) {

            var name = createText(util.getFullNameFormat(baton.data),
                    ['first_name', 'last_name', 'title', 'display_name']),
                job = createText(getDescription(baton.data),
                    ['position', 'profession', 'type']),
                company = $.trim(baton.data.company);

            this.append(
                $('<div class="next-to-picture">').append(
                    // right side
                    $('<i class="icon-lock private-flag">').attr('title', gt('Private')).hide(),
                    $('<h1 class="header-name">').append(name),
                    company ? $('<h2 class="header-company">').append($('<span class="company">').text(company)) : [],
                    $('<h2 class="header-job">').append(job),
                    $('<section class="attachments-container clear-both">')
                        .append($('<span class="attachments-in-progress">').busy())
                        .hide()
                )
            );

            if (baton.data.private_flag) {
                this.find('.private-flag').show();
            }

            if (api.uploadInProgress(_.ecid(baton.data))) {
                this.find('.attachments-container').show();
            } else if (baton.data.number_of_attachments > 0) {
                ext.point('io.ox/contacts/detail/attachments').invoke('draw', this.find('.attachments-container'), baton.data);
            }
        }
    });

    // Attachments

    ext.point('io.ox/contacts/detail/attachments').extend({
        draw: function (contact) {

            var section = this.show();

            require(['io.ox/core/api/attachment'], function (api) {
                // this request might take a while; not cached
                api.getAll({ folder_id: contact.folder_id, id: contact.id, module: 7 }).then(
                    function success(data) {
                        section.empty();
                        _(data).each(function (a) {
                            // draw
                            buildDropdown(section, _.noI18n(a.filename), a);
                        });
                        if (data.length > 1) {
                            buildDropdown(section, gt('All attachments'), data).find('a').removeClass('attachment-item');
                        }
                        section.on('a', 'click', function (e) { e.preventDefault(); });
                    },
                    function fail() {
                        section.empty().append(
                            $.fail(gt('Could not load attachments for this contact.'), function retry() {
                                ext.point('io.ox/contacts/detail/attachments').invoke('draw', section, contact);
                            })
                        );
                    }
                );
            });
        }
    });

    // Content

    ext.point('io.ox/contacts/detail').extend({
        index: (INDEX += 100),
        id: 'contact-content',
        draw: function (baton) {

            var node = $('<article>').appendTo(this),
                id = baton.data.mark_as_distributionlist ?
                    'io.ox/contacts/detail/list' :
                    'io.ox/contacts/detail/content';

            ext.point(id).invoke('draw', node, baton);
        }
    });

    // Distribution list members

    ext.point('io.ox/contacts/detail/member').extend({

        draw: function (data) {
            // draw member
            this.append(
                $('<div class="member">').append(
                    api.pictureHalo(
                        $('<div class="member-picture">'),
                        $.extend(data, { width: 48, height: 48, scaleType: 'cover' })
                    ),
                    $('<div class="member-name">').text(data.display_name),
                    $('<a href="#" class="halo-link">').data({ email1: data.mail }).text(data.mail)
                )
            );
        }
    });

    ext.point('io.ox/contacts/detail/list').extend({

        draw: function (baton) {

            var list = _.copy(baton.data.distribution_list || [], true), hash = {};

            // if there are no members in the list
            if (list.length === 0) {
                this.append(
                    $('<div>').text(gt('This list has no contacts yet'))
                );
                return;
            }

            // remove duplicates to fix backend bug
            _(list)
                .chain()
                .filter(function (member) {
                    if (hash[member.mail]) {
                        return false;
                    } else {
                        return (hash[member.mail] = true);
                    }
                })
                .each(function (member) {
                    ext.point('io.ox/contacts/detail/member').invoke('draw', this, member);
                }, this);
        }
    });

    function block() {

        var args = _(arguments).toArray(),
            rows = _(args.slice(1)).compact();

        if (rows.length === 0) return $();

        return $('<div class="block">').append(
            [$('<legend>').text(args[0])].concat(rows)
        );
    }

    function row(id, builder) {

        var build = builder();
        if (!build) return null;

        return $('<div>').attr('data-property', id).append(
            $('<label>').text(model.fields[id]),
            _.isString(build) ? $.txt(build) : build
        );
    }

    function simple(data, id, label) {
        var value = $.trim(data[id]);
        if (!value) return null;
        return $('<div>').attr('data-property', id).append(
            $('<label>').text(label || model.fields[id]),
            $('<span>').text(value)
        );
    }

    function clickMail(e) {
        e.preventDefault();
        // set recipient
        var data = { to: [[e.data.display_name, e.data.email]] };
        // open compose
        ox.load(['io.ox/mail/write/main']).done(function (m) {
            m.getApp().launch().done(function () {
                this.compose(data);
            });
        });
    }

    function mail(address, name, id) {
        if (!address) return null;
        return $('<div>').attr('data-property', id).append(
            $('<label>').text(gt('Email')),
            $('<a>', { href: 'mailto:' + address })
                .text(_.noI18n(address))
                .on('click', { email: address, display_name: name }, clickMail)
        );
    }

    function getMailAddresses(data) {
        return _([data.email1, data.email2, data.email3])
            .chain()
            .compact()
            .map(function (address) {
                return $.trim(address).toLowerCase();
            })
            .uniq()
            .value();
    }

    function phone(data, id, label) {
        var number = $.trim(data[id]);
        if (!number) return null;
        return $('<div>').attr('data-property', id).append(
            $('<label>').text(label || model.fields[id]),
            $('<a>', { href: _.device('smartphone') ? 'tel:' + number : 'callto:' + number }).text(number)
        );
    }

    function IM(number, id) {

        number = $.trim(number);
        if (!number) return null;

        var node = $('<div>').attr('data-property', id), obj = {};

        if (/^skype:/.test(number)) {
            number = number.split('skype:')[1];
            return node.append(
                $('<label>').text('Skype'),
                $('<a>', { href: 'callto:' + number + '?call' }).text(number)
            );
        }

        if (/^x-apple:/.test(number)) {
            number = number.split('x-apple:')[1];
            return node.append(
                $('<label>').text('iMessage'),
                $('<a>', { href: 'imessage://' + number + '@me.com' }).text(number)
            );
        }

        obj[id] = number;
        return simple(id, gt('Messenger'), obj);
    }

    // data is full contact data
    // type is 'business' or 'home' or 'other'
    function address(data, type) {

        data = _(['street', 'postal_code', 'city', 'state', 'country']).map(function (field) {
            return data[field + '_' + type] || '';
        });

        if (!_.some(data)) return null;

        var text =
            //#. Format of addresses
            //#. %1$s is the street
            //#. %2$s is the postal code
            //#. %3$s is the city
            //#. %4$s is the state
            //#. %5$s is the country
            gt('%1$s\n%2$s %3$s\n%4$s\n%5$s', data);

        return $('<a class="google-maps" target="_blank">')
            .attr('href', 'http://www.google.com/maps?q=' + encodeURIComponent(text.replace('/\n/g', ', ')))
            .attr('data-property', type)
            .append(
                $.txt($.trim(text)),
                $('<caption>').append(
                    $('<i class="icon-external-link">'),
                    $.txt(' Google Maps \u2122') // \u2122 = &trade;
                )
            );
    }

    ext.point('io.ox/contacts/detail/content')

        // Contact note/comment
        .extend({
            id: 'comment',
            index: 100,
            draw: function (baton) {

                var comment = $.trim(baton.data.note || '');
                if (comment !== '') {
                    this.append(
                        $('<div class="comment">').text(comment)
                    );
                }
            }
        })

        .extend({
            id: 'personal',
            index: 200,
            draw: function (baton) {

                var data = baton.data,
                    fullname = util.getFullName(baton.data);

                this.append(
                    block(gt('Personal'),
                        simple(data, 'title'),
                        simple({ fullname: fullname }, 'name', gt('Name')),
                        simple(data, 'second_name'),
                        simple(data, 'suffix'),
                        simple(data, 'nickname'),
                        row('birthday', function () {
                            if (baton.data.birthday) {
                                var birthday = new date.UTC(baton.data.birthday);//use utc time. birthdays must not be converted
                                if (birthday.getYear() === 1) {//Year 0 is special for birthdays without year (backend changes this to 1...)
                                    return birthday.format(date.DATE_NOYEAR);
                                } else {
                                    return birthday.format(date.DATE);
                                }
                            }
                        }),
                        row('URL', function () {
                            if (baton.data.url) {
                                return $('<a>', { href: baton.data.url, target: '_blank' }).text(baton.data.url);
                            }
                        })
                    )
                    .attr('data-block', 'personal')
                );
            }
        })

        .extend({
            id: 'job',
            index: 300,
            draw: function (baton) {

                var data = baton.data;

                this.append(
                    block(gt('Job'),
                        simple(data, 'position'),
                        simple(data, 'department'),
                        simple(data, 'profession'),
                        simple(data, 'company'),
                        simple(data, 'room_number')
                    )
                    .attr('data-block', 'job')
                );
            }
        })

        .extend({
            id: 'messaging',
            index: 400,
            draw: function (baton) {

                var data = baton.data,
                    fullname = util.getFullName(baton.data),
                    addresses = getMailAddresses(data);

                this.append(
                    block(gt('Mail and Messaging'),
                        mail(addresses[0], fullname, 'email1'),
                        mail(addresses[1], fullname, 'email2'),
                        mail(addresses[2], fullname, 'email3'),
                        IM(data.instant_messenger1, 'instant_messenger1'),
                        IM(data.instant_messenger2, 'instant_messenger2')
                    )
                    .attr('data-block', 'messaging')
                );
            }
        })

        .extend({
            id: 'phone',
            index: 500,
            draw: function (baton) {

                var data = baton.data;

                this.append(
                    block(gt('Phone numbers'),
                        phone(data, 'cellular_telephone1'),
                        phone(data, 'cellular_telephone2'),
                        phone(data, 'telephone_business1'),
                        phone(data, 'telephone_business2'),
                        phone(data, 'telephone_home1'),
                        phone(data, 'telephone_home2'),
                        phone(data, 'telephone_other'),
                        simple(data, 'fax_business'),
                        simple(data, 'fax_home'),
                        simple(data, 'fax_other')
                    )
                    .attr('data-block', 'phone')
                );
            }
        })

        .extend({
            id: 'business-address',
            index: 600,
            draw: function (baton) {

                var data = baton.data;

                this.append(
                    block(gt('Business Address'),
                        address(data, 'business')
                    )
                    .attr('data-block', 'business-address')
                );
            }
        })

        .extend({
            id: 'home-address',
            index: 700,
            draw: function (baton) {

                var data = baton.data;

                this.append(
                    block(gt('Home Address'),
                        address(data, 'home')
                    )
                    .attr('data-block', 'home-address')
                );
            }
        })

        .extend({
            id: 'other-address',
            index: 800,
            draw: function (baton) {

                var data = baton.data;

                this.append(
                    block(gt('Other Address'),
                        address(data, 'other')
                    )
                    .attr('data-block', 'other-address')
                );
            }
        })

        .extend({
            id: 'misc',
            index: 900,
            draw: function (baton) {

                var data = baton.data;

                this.append(
                    block(
                        //#. section name for contact fields in detail view
                        gt('Miscellaneous'),
                        // looks stupid but actually easier to read and not much shorter than any smart-ass solution
                        simple(data, 'userfield01'),
                        simple(data, 'userfield02'),
                        simple(data, 'userfield03'),
                        simple(data, 'userfield04'),
                        simple(data, 'userfield05'),
                        simple(data, 'userfield06'),
                        simple(data, 'userfield07'),
                        simple(data, 'userfield08'),
                        simple(data, 'userfield09'),
                        simple(data, 'userfield10'),
                        simple(data, 'userfield11'),
                        simple(data, 'userfield12'),
                        simple(data, 'userfield13'),
                        simple(data, 'userfield14'),
                        simple(data, 'userfield15'),
                        simple(data, 'userfield16'),
                        simple(data, 'userfield17'),
                        simple(data, 'userfield18'),
                        simple(data, 'userfield19'),
                        simple(data, 'userfield20')
                    )
                    .attr('data-block', 'misc')
                );
            }
        });

    // Resource description
    // only applies to resource because they have a "description" field.
    // contacts just have a "note"

    var regPhone = /(\+?[\d\x20\/()]{4,})/g,
        regClean = /[^+0-9]/g;

    ext.point('io.ox/contacts/detail/content').extend({
        index: 'last',
        id: 'description', //
        draw: function (baton) {

            var str = $.trim(baton.data.description || ''), isHTML;
            if (str !== '') {

                isHTML = looksLikeHTML(str);

                // find phone numbers & links
                str = str.replace(regPhone, function (match) {
                    var number = match.replace(regClean, '');
                    return '<a href="callto:' + number + '">' + match + '</a>';
                });

                // fix missing newlines
                if (!isHTML) {
                    str = str.replace(/\n/g, '<br>');
                }

                this.append(
                    $('<div class="description">').append(
                        $('<div>').html(str),
                        // add callback?
                        baton.data.callbacks && 'extendDescription' in baton.data.callbacks ?
                            $('<a href="#">').text(gt('Copy to description'))
                            .on('click', { description: $('<div>').html(str.replace(/[ \t]+/g, ' ').replace(/<br>/g, '\n')).text() }, baton.data.callbacks.extendDescription)
                            : []
                    )
                );
            }
        }
    });

    ext.point('io.ox/contacts/detail/content').extend({
        index: 10000,
        id: 'qr',
        draw: function (baton) {
            var data = baton.data;

            // disabled?
            if (!settings.get('features/qrcode', true)) return;
            // not supported
            if (!Modernizr.canvas || data.mark_as_distributionlist) return;

            var node = $('<div>').addClass('block'),
                show = function (e) {
                    e.preventDefault();
                    node.empty().busy();
                    require(['io.ox/contacts/view-qrcode'], function (qr) {
                        var vc = qr.getVCard(data);
                        node.append(
                            $('<span>').addClass('qrcode').append(
                                $('<i class="icon-qrcode">'), $.txt(' '),
                                $('<a>', { href: '#' })
                                .text(gt('Hide QR code'))
                                .on('click', hide)
                            )
                        );
                        node.idle().qrcode(vc);
                        vc = qr = null;
                    });
                },
                hide = function (e) {
                    e.preventDefault();
                    node.empty();
                    node.append(
                        $('<i class="icon-qrcode">'), $.txt(' '),
                        showLink
                    );
                },
                showLink = $('<a>', { href: '#' }).text(gt('Show QR code')).on('click', show);

            this.append(
                node
             );

            node.append(
                $('<i class="icon-qrcode">'), $.txt(' '),
                showLink
            );
        }
    });

    ext.point('io.ox/contacts/detail').extend({
        index: 'last',
        id: 'breadcrumb',
        draw: function (baton) {

            var options = { subfolder: false, prefix: gt('Saved in'), module: 'contacts' };

            // this is also used by halo, so we might miss a folder id
            if (baton.data.folder_id) {
                // do we know the app?
                if (baton.app) {
                    options.handler = baton.app.folder.set;
                }
                this.append(
                    folderAPI.getBreadcrumb(baton.data.folder_id, options)
                    .addClass('chromeless clear-both')
                );
            }
        }
    });

    function redraw(e, data) {
        $(this).replaceWith(e.data.view.draw(data));
    }

    return {

        draw: function (baton) {

            if (!baton) return $('<div>');

            try {

                // make sure we have a baton
                baton = ext.Baton.ensure(baton);

                var node = $.createViewContainer(baton.data, api)
                    .on('redraw', { view: this, data: baton.data }, redraw)
                    .addClass('contact-detail view')
                    .attr({
                        'role': 'complementary',
                        'aria-label': gt('Contact Details')
                    });
                ext.point('io.ox/contacts/detail').invoke('draw', node, baton);

                return node;

            } catch (e) {
                console.error('io.ox/contacts/view-detail:draw()', e);
            }
        }
    };
});
