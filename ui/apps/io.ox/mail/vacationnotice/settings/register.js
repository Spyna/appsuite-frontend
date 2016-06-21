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
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define('io.ox/mail/vacationnotice/settings/register', [
    'io.ox/core/extensions',
    'io.ox/core/notifications',
    'io.ox/core/api/user',
    'io.ox/contacts/util',
    'gettext!io.ox/mail'
], function (ext, notifications, userAPI, contactsUtil, gt) {

    'use strict';

    var filterModel,
        touchAttributes = function (model) {
            var fields = ['subject', 'text', 'days', 'id', 'addresses'],
                x = 0;
            for (; x < fields.length; x++) {
                model.touch(fields[x]);
            }
        },
        createDaysObject = function (from, to) {
            var arrayOfValues = [];
            for (var i = from; i <= to; i += 1) {
                arrayOfValues.push({ label: i, value: i });
            }
            return arrayOfValues;
        };

    ext.point('io.ox/settings/pane/main/io.ox/mail').extend({
        id: 'io.ox/vacation',
        title: gt('Vacation Notice'),
        ref: 'io.ox/vacation',
        loadSettingPane: false,
        index: 100,
        lazySaveSettings: true
    });

    ext.point('io.ox/vacation/settings/detail').extend({
        index: 100,
        draw: function () {
            var $node = this,
                $container = $('<div>');

            $node.append($container);
            require(['io.ox/mail/vacationnotice/settings/filter'], function (filters) {
                userAPI.get().done(function (user) {

                    function assembleFrom(aliases) {
                        var list = [];
                        _.each(aliases, function (key, value) {
                            var assembledValue = userFullName.trim() === '' ? value : userFullName + ' <' + value + '>',
                                assembledValueEscaped = userFullName.trim() === '' ? value : '"' + userFullName + '" <' + value + '>';
                            list.push({ 'value': assembledValueEscaped, 'label': assembledValue });
                        });
                        return list;
                    }

                    function assembleArrays(aliases) {
                        var arrays = [];
                        _.each(aliases, function (value, key) {
                            arrays[key] = [];
                            if (userFullName.trim() !== '') arrays[key].push(userFullName);
                            arrays[key].push(value);
                        });
                        return arrays;
                    }

                    var userFullName = contactsUtil.getMailFullName(user),
                        aliases = _.object(user.aliases, user.aliases),
                        multiValues = {
                            aliases: user.aliases,
                            days: createDaysObject(1, 31),
                            from: assembleFrom(aliases),
                            fromArrays: assembleArrays(user.aliases)
                        };

                    filters.editVacationtNotice($container, multiValues, user.email1).done(function (filter) {
                        filterModel = filter;
                        touchAttributes(filterModel);
                    }).fail(function (error) {
                        var msg;
                        if (error.code === 'MAIL_FILTER-0015') {
                            msg = gt('Unable to load mail filter settings.');
                        }
                        $container.append(
                            $.fail(msg || gt('Couldn\'t load your vacation notice.'), function () {
                                filters.editVacationtNotice($node).done(function () {
                                    $node.find('[data-action="discard"]').hide();
                                });
                            })
                        );
                    });
                });
            });
        },

        save: function (node) {
            return filterModel.save().done(
                function () {
                    if (node) node.trigger('refresh:mailfilter');
                    touchAttributes(filterModel);
                    //notifications.yell('success', gt('Your vacation notice has been saved'));
                }
            );
        }
    });
});
