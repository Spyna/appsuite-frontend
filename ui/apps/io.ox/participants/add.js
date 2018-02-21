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
 * @author Christoph Hellweg <christoph.hellweg@open-xchange.com>
 */

define('io.ox/participants/add', [
    'io.ox/core/extensions',
    'io.ox/participants/model',
    'io.ox/participants/views',
    'io.ox/core/tk/typeahead',
    'io.ox/mail/util',
    'io.ox/contacts/util',
    'io.ox/core/util',
    'io.ox/calendar/util',
    'io.ox/core/yell',
    'gettext!io.ox/core',
    'io.ox/core/capabilities',
    'settings!io.ox/contacts',
    'io.ox/backbone/mini-views/addresspicker',
    // need jquery-ui for scrollParent
    'static/3rd.party/jquery-ui.min.js'
], function (ext, pModel, pViews, Typeahead, util, contactsUtil, coreUtil, calendarUtil, yell, gt, capabilities, settingsContacts, AddressPickerView) {

    'use strict';

    // TODO:
    // - exceptions for global address book

    /*
     * extension point for autocomplete item
     */
    ext.point('io.ox/participants/add/autoCompleteItem').extend({
        id: 'view',
        index: 100,
        draw: function (participant, options) {
            var pview = new pViews.ParticipantEntryView({
                model: participant,
                closeButton: false,
                halo: false,
                field: true,
                isMail: options.isMail
            });
            this.append(pview.render().$el);
        }
    });

    var validation = {

        validate: function (list, options) {
            if (!this.options.blacklist) return;
            var opt = _.extend({ yell: true }, options),
                invalid = this.getInvalid(list);
            // process
            if (invalid.length === 0) return;
            // yell warning
            if (opt.yell) this.yell(list, invalid);
            return invalid;
        },

        getInvalid: function (list) {
            var blacklist = this.options.blacklist;
            return _(getAddresses(list)).filter(function (address) {
                return !!blacklist[address];
            });
        },

        yell: function (list, invalid) {
            yell('warning', gt.format(
                // split strings to support languages wthout plural forms
                list.length === 1 ? gt('This email address cannot be used') :
                    //#. %1$d a list of email addresses
                    //#, c-format
                    gt('The following email addresses cannot be used: %1$d', list.length),
                invalid.join(', ')
            ));
        }
    };

    function getAddresses(list) {
        return _(list).map(getAddress);
    }

    function getAddress(item) {
        // string, data or model
        if (_.isString(item)) item = { email1: item };
        else if (item instanceof Backbone.Model) item = item.toJSON();
        return contactsUtil.getMail(item);
    }

    var AddParticipantView = Backbone.View.extend({

        tagName: 'div',

        events: {
            'keydown input': 'resolve',
            'blur input': 'resolve'
        },

        typeahead: null,

        options: {
            placeholder: gt('Add contact/resource') + ' \u2026',
            label: gt('Add contact/resource'),
            extPoint: 'io.ox/participants/add',
            blacklist: false
        },

        initialize: function (o) {
            this.options = $.extend({}, this.options, o || {});
            if (_.isString(this.options.blacklist)) {
                // turn blacklist into hash to have simpler checks
                var hash = {};
                _(this.options.blacklist.split(/,/)).each(function (address) {
                    hash[address.trim().toLowerCase()] = true;
                });
                this.options.blacklist = hash;
                _.extend(this, validation);
            }
            this.options.click = _.bind(this.addParticipant, this);
            this.options.harmonize = _.bind(function (data) {
                data = _(data).map(function (m) {
                    return new pModel.Participant(m);
                });
                // remove duplicate entries from typeahead dropdown
                var col = this.collection;
                return _(data).filter(function (model) {
                    return !col.get(model);
                });
            }, this);

            // ensure a fixed scroll position when adding participants/members after the initial rendering
            this.initialRendering = true;
            var scrollIntoView = _.debounce(function () {
                if (this.initialRendering) {
                    this.initialRendering = false;
                    return;
                }
                this.typeahead.el.scrollIntoView();
            }.bind(this), 0);

            this.collection.on('render', scrollIntoView);
        },

        resolve: function (e) {
            if (e.type === 'keydown' && e.which !== 13) return;
            var val = this.typeahead.$el.typeahead('val'),
                list = coreUtil.getAddresses(val),
                participants = [];
            // split based on comma or semi-colon as delimiter
            _.each(list, function (value) {
                if (_.isEmpty(value)) return;
                participants.push({
                    display_name: util.parseRecipient(value)[0],
                    email1: util.parseRecipient(value)[1],
                    field: 'email1', type: 5
                });
            });
            this.addParticipant(e, participants, val);
        },

        setFocus: function () {
            if (this.typeahead) this.typeahead.$el.focus();
        },

        addParticipant: function (e, data, value) {
            var list = [].concat(data),
                distlists = [],
                // validate is just used to check against blacklist
                error = this.validate ? this.validate(list) : false,
                self = this;
            // abort when blacklisted where found
            if (error) return;
            // now really validate address
            list = this.getValidAddresses(list);

            if (this.options.convertToAttendee) {

                list = _(list).chain().map(function (item) {
                    if (!(item.attributes && item.attributes.mark_as_distributionlist)) {
                        return calendarUtil.createAttendee(item);
                    }
                    distlists.push(item);

                }).flatten().compact().value();
            }

            if (!_.isEmpty(list)) this.collection.add(list);

            if (!_.isEmpty(distlists)) {
                _.each(distlists, function (item) {
                    self.collection.resolveDistList(item.attributes.distribution_list).done(function (list) {
                        _.each(list, function (item) {
                            // hint: async custom wrapper
                            self.collection.add(calendarUtil.createAttendee(item));
                        });
                    });
                });
            }

            // clean typeahad input
            if (value) this.typeahead.$el.typeahead('val', '');
        },

        getValidAddresses: function (list) {
            return _(list).filter(function (item) {
                var address = getAddress(item);
                if (coreUtil.isValidMailAddress(address)) return true;
                //#. %1$s is an email address
                yell('error', gt('Cannot add contact with an invalid mail address: %1$s', address));//
                return false;
            });
        },

        render: function () {
            var guid = _.uniqueId('form-control-label-'),
                self = this;

            this.typeahead = new Typeahead(this.options);
            this.$el.append(
                $('<label class="sr-only">').attr({ for: guid }).text(this.options.label),
                this.typeahead.$el.attr({ id: guid }).addClass('add-participant')
            );
            this.typeahead.render();
            if (this.options.scrollIntoView) {
                var $el = this.$el;
                this.typeahead.on('typeahead-custom:dropdown-rendered', function () {
                    var target = $el.find('.tt-dropdown-menu'),
                        container = target.scrollParent(),
                        pos = target.offset().top - container.offset().top;
                    if (!target.is(':visible')) return;
                    if ((pos < 0) || (pos + target.height() > container.height())) {
                        // scroll to Node, leave 16px offset
                        container.scrollTop(container.scrollTop() + pos - 16);
                    }
                });
            }
            this.options.usePicker = !_.device('smartphone') && capabilities.has('contacts') && settingsContacts.get('picker/enabled', true);
            if (this.options.usePicker) {
                this.addresspicker = new AddressPickerView({
                    process: function (e, member) {
                        if (self.options.convertToAttendee) {
                            // fix type 5 that are actually type 1
                            member.magic();
                            self.options.collection.add(calendarUtil.createAttendee(member));
                            return;
                        }
                        self.options.collection.add(member);
                    }
                });
                this.$el.append(
                    this.addresspicker.render().$el
                );
                this.$el.wrapInner($('<div class="input-group has-picker">'));

            }
            return this;
        }
    });

    return AddParticipantView;
});
