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
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define('io.ox/contacts/view-detail', [
    'io.ox/core/extensions',
    'io.ox/contacts/util',
    'io.ox/contacts/api',
    'io.ox/contacts/actions',
    'io.ox/contacts/model',
    'io.ox/participants/views',
    'io.ox/participants/model',
    'io.ox/core/folder/breadcrumb',
    'io.ox/core/util',
    'io.ox/core/capabilities',
    'gettext!io.ox/contacts',
    'settings!io.ox/contacts',
    'io.ox/core/tk/attachments',
    'io.ox/core/http',
    'io.ox/core/locale/postal-address',
    'io.ox/backbone/views/toolbar',
    'io.ox/backbone/views/action-dropdown',
    'static/3rd.party/purify.min.js',
    'less!io.ox/contacts/style'
], function (ext, util, api, actions, model, pViews, pModel, BreadcrumbView, coreUtil, capabilities, gt, settings, attachments, http, postalAddress, ToolbarView, ActionDropdownView, DOMPurify) {

    'use strict';

    // smart join
    // var join = function () {
    //     return _(arguments)
    //         .select(function (obj, i) {
    //             return i > 0 && !!obj;
    //         })
    //         .join(arguments[0] || '');
    // };

    // function getDescription(data) {

    //     function single(index, value) {
    //         var params = new Array(index);
    //         params[index - 1] = value;
    //         return { format: '%' + index + '$s', params: params };
    //     }

    //     var count, desc;

    //     if (api.looksLikeDistributionList(data)) {
    //         count = data.number_of_distribution_list;
    //         //#. %1$d is a number of members in distribution list
    //         desc = count === 0 ?
    //             gt('Distribution list') :
    //             gt.format(gt.ngettext('Distribution list with 1 entry', 'Distribution list with %1$d entries', count), count);
    //         return single(7, desc, true);
    //     }

    //     if (api.looksLikeResource(data)) {
    //         return single(7, gt('Resource'), true);
    //     }

    //     if (data.position || data.profession) {
    //         return {
    //             format: join(', ', data.position ? '%1$s' : '', data.profession ? '%2$s' : ''),
    //             params: [data.position, data.profession]
    //         };
    //     }

    //     return util.getMailFormat(data);
    // }

    function hideAddressBook() {
        return ox.ui.apps._indexOf('io.ox/contacts') < 0;
    }

    // function createText(format, classes) {
    //     return _.aprintf(
    //         format.format,
    //         function (index) {
    //             return $('<span>').addClass(classes[index]).text(format.params[index]);
    //         },
    //         function (text) {
    //             return $.txt(text);
    //         }
    //     );
    // }

    function buildDropdown(container, title, data) {
        var dropdown = new ActionDropdownView({ point: 'io.ox/core/tk/attachment/links', data: data, title: title });
        container.append(dropdown.$el);
    }

    /*
     * Extensions
     */

    var INDEX = 100;

    ext.point('io.ox/contacts/detail').extend({
        index: (INDEX += 100),
        id: 'inline-actions',
        draw: function (baton) {
            if (api.looksLikeResource(baton.data)) return;
            if (hideAddressBook()) return;
            this.append(
                new ToolbarView({ point: 'io.ox/contacts/links/inline', inline: true })
                .setSelection(baton.array(), { data: baton.array() })
                .$el
            );
        }
    });

    ext.point('io.ox/contacts/detail').extend({
        index: (INDEX += 100),
        id: 'contact-header',
        draw: function (baton) {

            if (baton.data.mark_as_distributionlist) return;

            var $photo = $('<dt role="presentation">');
            ext.point('io.ox/contacts/detail/photo').invoke('draw', $photo, baton);

            var $summary = $('<dd class="contact-summary" role="presentation">');
            ext.point('io.ox/contacts/detail/summary').invoke('draw', $summary, baton);

            this.append(
                // we use a definition list here to get exactily the same layout
                // for screen reeader support we remove any semantics
                $('<dl class="dl-horizontal contact-header" role="presentation">').append($photo, $summary)
            );
        }
    });

    ext.point('io.ox/contacts/detail').extend({
        index: (INDEX += 100),
        id: 'list-header',
        draw: function (baton) {

            if (!baton.data.mark_as_distributionlist) return;

            this.addClass('distribution-list').append(
                $('<div class="contact-header">').append(
                    $('<h1 class="fullname">').text(util.getFullName(baton.data)),
                    $('<h2>').text(gt('Distribution list'))
                )
            );
        }
    });

    // Contact Photo

    ext.point('io.ox/contacts/detail/photo').extend({
        draw: function (baton) {
            this.append(api.getContactPhoto(baton.data, { size: 120 }));
        }
    });

    // Contact Summary
    var countryFlag = settings.get('features/countryFlag', true),
        flags = {
            US: '\uD83C\uDDFA\uD83C\uDDF8',
            GB: '\uD83C\uDDEC\uD83C\uDDE7',
            DE: '\uD83C\uDDE9\uD83C\uDDEA',
            FR: '\uD83C\uDDEB\uD83C\uDDF7',
            ES: '\uD83C\uDDEA\uD83C\uDDF8',
            IT: '\uD83C\uDDEE\uD83C\uDDF9',
            NL: '\uD83C\uDDF3\uD83C\uDDF1',
            FI: '\uD83C\uDDEB\uD83C\uDDEE',
            JP: '\uD83C\uDDEF\uD83C\uDDF5',
            AT: '\uD83C\uDDE6\uD83C\uDDF9',
            CH: '\uD83C\uDDE8\uD83C\uDDED',
            BE: '\uD83C\uDDE7\uD83C\uDDEA'
        };

    ext.point('io.ox/contacts/detail/summary').extend(
        {
            index: 100,
            id: 'fullname',
            draw: function (baton) {
                var options = { html: util.getFullNameWithFurigana(baton.data), tagName: 'h1 class="fullname"' };
                this.append(coreUtil.renderPersonalName(options, baton.data));
            }
        },
        {
            index: 110,
            id: 'flag',
            draw: function (baton) {
                if (!countryFlag) return;
                if (_.device('smartphone')) return;
                var country = baton.data.country_home || baton.data.country_business;
                if (!country) return;
                var flag = flags[postalAddress.getCountryCode(country)];
                if (!flag) return;
                this.find('h1.fullname').append($.txt(' ' + flag));
            }
        },
        {
            index: 200,
            id: 'business',
            draw: function (baton) {
                this.append(
                    $('<h2 class="business hidden-xs">').text(
                        util.getSummaryBusiness(baton.data)
                    )
                );
            }
        },
        {
            index: 300,
            id: 'location',
            draw: function (baton) {
                this.append(
                    $('<h2 class="location hidden-xs">').text(
                        util.getSummaryLocation(baton.data)
                    )
                );
            }
        }
    );

    // var name =

    // var job = createText(getDescription(baton.data), ['position', 'profession', 'type']),
    //     company = $.trim(baton.data.company),
    //     container;

    // this.append(
    //     $('<div class="next-to-picture">').append(
    //         // right side
    //         $('<i class="fa fa-lock private-flag" aria-hidden="true">').attr('title', gt('Private')).hide(),
    //         name.children().length ? name.addClass('header-name') : [],
    //         company ? $('<h2 class="header-company">').append($('<span class="company">').text(company)) : [],
    //         job.length ? $('<h2 class="header-job">').append(job) : [],
    //         container = $('<section class="attachments-container clear-both">')
    //             .hide()
    //     )
    // );

    // if (baton.data.private_flag) {
    //     this.find('.private-flag').show();
    // }

    // if (api.uploadInProgress(_.ecid(baton.data))) {
    //     var progressview = new attachments.progressView({ cid: _.ecid(baton.data) });
    //     container.append(progressview.render().$el).show();
    // } else if (baton.data.number_of_attachments > 0) {
    //     ext.point('io.ox/contacts/detail/attachments').invoke('draw', container, baton.data);
    // }

    // Attachments

    ext.point('io.ox/contacts/detail/attachments').extend({
        draw: function (contact) {

            var section = this.show();
            // TODO: Use io.ox/core/tk/attachments for attachment list here
            require(['io.ox/core/api/attachment'], function (api) {
                // this request might take a while; not cached
                api.getAll({ folder_id: contact.folder_id, id: contact.id, module: 7 }).then(
                    function success(data) {
                        section.empty();
                        _(data).each(function (a) {
                            // draw
                            buildDropdown(section, a.filename, a);
                        });
                        if (data.length > 1) {
                            buildDropdown(section, gt('All attachments'), data);
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

            //clearfix needed or halo design is broken
            var node = $('<article class="clearfix">').appendTo(this),
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
                new pViews.ParticipantEntryView({
                    tagName: 'li',
                    model: new pModel.Participant(data),
                    halo: true,
                    isMail: true,
                    // forces the use of the correct mailfield (disables fallback). User is no longer misslead by the ui showing a mail address, that is not used by this distributionlist
                    strict: true
                }).render().$el
            );
        }
    });

    ext.point('io.ox/contacts/detail/list').extend({

        draw: function (baton) {

            var list = _.copy(baton.data.distribution_list || [], true),
                count = list.length,
                hash = {}, $list;

            this.append(
                count === 0 ? $('<div class="list-count">').text(gt('This list has no members yet')) : $(),
                $list = $('<ul class="member-list list-unstyled">')
            );

            // if there are no members in the list
            if (!count) return;

            // remove duplicates to fix backend bug
            http.pause();
            _(list)
                .chain()
                .filter(function (member) {
                    if (hash[member.display_name + '_' + member.mail]) return false;
                    return (hash[member.display_name + '_' + member.mail] = true);
                })
                .each(function (member) {
                    ext.point('io.ox/contacts/detail/member').invoke('draw', $list, member);
                }, this);
            http.resume();
        }
    });

    function block() {

        var rows = _(arguments).compact(),
            block = $('<section class="block">'),
            dl = $('<dl class="dl-horizontal">');

        // if block empty
        if (rows.length < 1) return $();

        _.each(rows, function (row) {
            dl.append(row);
        });

        return block.append(dl);
    }

    function row(id, builder) {
        var build = builder();
        if (!build) return null;
        return function () {
            $(this).append(
                $('<dt>').text(model.fields[id]),
                $('<dd>').append(_.isString(build) ? $.txt(build) : build)
            );
        };
    }

    function simple(data, id, label) {
        var value = $.trim(data[id]);
        if (!value) return null;
        return function () {
            $(this).append(
                $('<dt>').text(label || model.fields[id]),
                $('<dd>').text(value)
            );
        };
    }

    function clickMail(e) {
        if (capabilities.has('webmail')) {
            e.preventDefault();
            // set recipient and open compose
            ox.registry.call('mail-compose', 'open', { to: [[e.data.display_name, e.data.email]] });
        }
    }

    function mail(address, name, id) {
        if (!address) return null;
        return function () {
            $(this).append(
                $('<dt>').text(model.fields[id]),
                $('<dd>').append(
                    $('<a>').attr('href', 'mailto:' + address).text(address)
                        .on('click', { email: address, display_name: name }, clickMail)
                )
            );
        };
    }

    function phone(data, id, label) {
        var number = $.trim(data[id]);
        if (!number) return null;
        return function () {
            $(this).append(
                $('<dt>').text(label || model.fields[id]),
                $('<dd>').append(
                    $('<a>').attr({
                        href: _.device('smartphone') ? 'tel:' + number : 'callto:' + number,
                        'aria-label': label || model.fields[id]
                    }).text(number)
                )
            );
        };
    }

    function note(data) {
        var text = $.trim(data.note);
        if (!text) return null;
        return function () {
            $(this).append(
                $('<dt>').text(model.fields.note),
                _.nltobr(text, $('<dd class="note">'))
            );
        };
    }

    function IM(number, id) {
        number = $.trim(number);
        if (!number) return null;

        var obj = {};

        if (/^skype:/.test(number)) {
            number = number.split('skype:')[1];
            return function () {
                $(this).append(
                    $('<dt>').text('Skype'),
                    $('<dd>').append(
                        $('<a>', { href: 'callto:' + number + '?call' }).text(number)
                    )
                );
            };
        }

        if (/^x-apple:/.test(number)) {
            number = number.split('x-apple:')[1];
            return function () {
                $(this).append(
                    $('<dt>').text('iMessage'),
                    $('<dd>').append(
                        $('<a>', { href: 'imessage://' + number + '@me.com' }).text(number)
                    )
                );
            };
        }

        obj[id] = number;
        return simple(obj, id, gt('Messenger'));
    }

    // data is full contact data
    // type is 'business' or 'home' or 'other'
    function address(data, type) {

        var text = postalAddress.format(data, type);
        if (!text) return null;

        var services = {
            google: { label: gt('Google Maps'), url: 'https://www.google.com/maps?q=' },
            osm: { label: gt('Open Street Map'), url: 'https://www.openstreetmap.org/search?query=' },
            apple: { label: gt('Apple Maps'), url: 'https://maps.apple.com/?q=' }
        };

        var i18n = {
            home: gt('Home address'),
            business: gt('Business address'),
            other: gt('Other address')
        };

        return function () {

            var address = $('<address>').attr('data-property', type).text($.trim(text)),
                service = settings.get('mapService', 'google'),
                dd = $('<dd>').append(address);

            $(this).append($('<dt>').text(i18n[type]), dd);

            // Apple Maps only works on iOS and MacOS
            if (service === 'apple' && !_.device('ios || macos')) service = 'none';
            if (service === 'none') return $(this);

            var query = encodeURIComponent(text.replace(/\n*/, '\n').trim().replace(/\n/g, ', '));

            dd.append(
                $('<a class="maps-service" target="_blank" rel="noopener">')
                .attr('href', services[service].url + query)
                .append(
                    $('<i class="fa fa-external-link" aria-hidden="true">'),
                    //#. %1$s is a map service, like "Google Maps"
                    $.txt(' ' + gt('Open in %1$s', services[service].label))
                )
            );
        };
    }

    ext.point('io.ox/contacts/detail/content')

        .extend({
            id: 'personal',
            index: 200,
            draw: function (baton) {

                var data = baton.data;

                this.append(
                    block(
                        simple(data, 'title'),
                        simple(data, 'second_name'),
                        simple(data, 'nickname'),
                        simple(data, 'suffix'),
                        row('birthday', function () {
                            // check if null, undefined, empty string
                            // 0 is valid (1.1.1970)
                            if (!_.isNumber(baton.data.birthday)) return;
                            return util.getBirthday(baton.data.birthday, true);
                        }),
                        row('url', function () {
                            var url = $.trim(baton.data.url);
                            if (!url) return;
                            if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
                            var node = $('<a target="_blank" rel="noopener">').attr('href', encodeURI(decodeURI(url))).text(url);
                            return DOMPurify.sanitize(node.get(0), { ALLOW_TAGS: ['a'], SAFE_FOR_JQUERY: true, RETURN_DOM_FRAGMENT: true });
                        }),
                        // --- rare ---
                        simple(data, 'marital_status'),
                        simple(data, 'number_of_children'),
                        simple(data, 'spouse_name'),
                        row('anniversary', function () {
                            // check if null, undefined, empty string
                            // 0 is valid (1.1.1970)
                            if (_.isNumber(baton.data.anniversary)) {
                                // use same mechanic as with birthdays
                                return util.getBirthday(baton.data.anniversary);
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
                    block(
                        simple(data, 'company'),
                        simple(data, 'department'),
                        simple(data, 'position'),
                        simple(data, 'profession'),
                        simple(data, 'room_number'),
                        simple(data, 'manager_name'),
                        simple(data, 'assistant_name'),
                        // --- rare ---
                        simple(data, 'employee_type'),
                        simple(data, 'number_of_employees'),
                        simple(data, 'sales_volume'),
                        simple(data, 'tax_id'),
                        simple(data, 'commercial_register'),
                        simple(data, 'branches'),
                        simple(data, 'business_category'),
                        simple(data, 'info')
                    )
                    .attr('data-block', 'job')
                );
            }
        })

        .extend({
            id: 'communication',
            index: 400,
            draw: function (baton) {

                var data = baton.data,
                    fullname = util.getFullName(data),
                    addresses = _([data.email1, data.email2, data.email3])
                        .chain()
                        .map(function (address) {
                            return $.trim(address).toLowerCase();
                        })
                        .value();

                this.append(
                    block(
                        mail(addresses[0], fullname, 'email1'),
                        mail(addresses[1], fullname, 'email2'),
                        mail(addresses[2], fullname, 'email3'),
                        IM(data.instant_messenger1, 'instant_messenger1'),
                        IM(data.instant_messenger2, 'instant_messenger2'),
                        phone(data, 'cellular_telephone1'),
                        phone(data, 'cellular_telephone2'),
                        phone(data, 'telephone_business1'),
                        phone(data, 'telephone_business2'),
                        phone(data, 'telephone_home1'),
                        phone(data, 'telephone_home2'),
                        phone(data, 'telephone_other'),
                        simple(data, 'fax_business'),
                        simple(data, 'fax_home'),
                        simple(data, 'fax_other'),
                        // --- rare ---
                        phone(data, 'telephone_company'),
                        phone(data, 'telephone_car'),
                        phone(data, 'telephone_isdn'),
                        phone(data, 'telephone_pager'),
                        phone(data, 'telephone_primary'),
                        phone(data, 'telephone_radio'),
                        phone(data, 'telephone_telex'),
                        phone(data, 'telephone_ttytdd'),
                        phone(data, 'telephone_ip'),
                        phone(data, 'telephone_assistant'),
                        phone(data, 'telephone_callback')
                    )
                    .attr('data-block', 'communication')
                );
            }
        })

        .extend({
            id: 'home-address',
            index: 600,
            draw: function (baton) {
                this.append(
                    block(
                        address(baton.data, 'home')
                    )
                    .attr('data-block', 'home-address')
                );
            }
        })

        .extend({
            id: 'business-address',
            index: 700,
            draw: function (baton) {
                this.append(
                    block(
                        address(baton.data, 'business')
                    )
                    .attr('data-block', 'business-address')
                );
            }
        })

        .extend({
            id: 'other-address',
            index: 800,
            draw: function (baton) {
                this.append(
                    block(
                        address(baton.data, 'other')
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
                        note(data, 'note'),
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

    var regPhone = /(\+?[\d\x20/()]{4,})/g,
        regClean = /[^+0-9]/g;

    ext.point('io.ox/contacts/detail/content').extend({
        index: 1000000000000,
        id: 'description',
        draw: function (baton) {

            var str = _.escape($.trim(baton.data.description || ''));
            if (str === '') return;

            // find phone numbers & links
            str = str.replace(regPhone, function (match) {
                var number = match.replace(regClean, '');
                return '<a href="callto:' + number + '">' + match + '</a>';
            });

            str = coreUtil.urlify(str);

            // fix missing newlines
            str = str.replace(/\n/g, '<br>');

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
    });

    ext.point('io.ox/contacts/detail').extend({
        index: 1000000000000,
        id: 'breadcrumb',
        draw: function (baton) {

            var id = baton.data.folder_id;

            // this is also used by halo, so we might miss a folder id
            if (!id) return;
            if (hideAddressBook()) return;

            // don't show folders path for folder 6 if global address book is disabled
            if (String(id) === '6' && !capabilities.has('gab')) return;

            this.append(
                $('<div class="clearfix">'),
                new BreadcrumbView({ folder: id, app: baton.app, display: 'block', label: gt('Saved in:'), disable: ['2', '3'] }).render().$el
            );
        }
    });

    function redraw(e, data) {
        var baton = e.data.baton;
        //use old baton with new data(keep disabled extensionpoints)
        baton.data = data;
        $(this).replaceWith(e.data.view.draw(baton));
    }

    return {

        draw: function (baton) {

            if (!baton) return $('<div>');

            try {

                // make sure we have a baton
                baton = ext.Baton.ensure(baton);

                var node = $.createViewContainer(baton.data, api)
                    .on('redraw', { view: this, data: baton.data, baton: baton }, redraw)
                    .addClass('contact-detail view')
                    .attr({
                        'role': 'region',
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
