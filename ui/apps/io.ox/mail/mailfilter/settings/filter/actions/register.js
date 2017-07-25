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
*
*/

define.async('io.ox/mail/mailfilter/settings/filter/actions/register', [
    'io.ox/core/extensions',
    'gettext!io.ox/mailfilter',
    'io.ox/backbone/mini-views',
    'io.ox/mail/mailfilter/settings/filter/actions/util',
    'io.ox/core/folder/picker',
    'io.ox/core/api/mailfilter',
    'settings!io.ox/mail'

], function (ext, gt, mini, util, picker, api, settings) {

    'use strict';

    var defer = $.Deferred();

    function processConfig(config) {

        var cap = _.object(config.capabilities, config.capabilities);

        if (_.has(cap, 'imap4flags')) {

            ext.point('io.ox/mail/mailfilter/actions').extend({

                id: 'addflags',

                index: 400,

                initialize: function (opt) {
                    var defaults = {
                            'markmail': {
                                'flags': ['\\seen'],
                                'id': 'addflags'
                            },
                            'tag': {
                                'flags': ['$'],
                                'id': 'addflags'

                            },
                            'flag': {
                                'flags': ['$cl_1'],
                                'id': 'addflags'
                            }
                        },
                        translations = {
                            'markmail': gt('Mark mail as'),
                            'tag': gt('Add IMAP keyword')
                        };

                    if (settings.get('features/flag/color')) translations.flag = gt('Set color flag');

                    _.extend(opt.defaults.actions, defaults);

                    _.extend(opt.actionsTranslations, translations);

                    _.extend(opt.actionCapabilities, { 'markmail': 'addflags', 'tag': 'addflags', 'flag': 'addflags' });

                    opt.actionsOrder.push('markmail', 'tag');
                    if (settings.get('features/flag/color')) opt.actionsOrder.push('flag');

                },

                draw: function (baton, actionKey, amodel, filterValues, action) {

                    var inputId,
                        flagValues = {
                            '\\deleted': gt('deleted'),
                            '\\seen': gt('seen'),
                            '\\flagged': gt('flagged')
                        },
                        COLORS = {
                            NONE: { value: 0, text: gt('None') },
                            RED: { value: 1, text: gt('Red') },
                            ORANGE: { value: 7, text: gt('Orange') },
                            YELLOW: { value: 10, text: gt('Yellow') },
                            LIGHTGREEN: { value: 6, text: gt('Light green') },
                            GREEN: { value: 3, text: gt('Green') },
                            LIGHTBLUE: { value: 9, text: gt('Light blue') },
                            BLUE: { value: 2, text: gt('Blue') },
                            PURPLE: { value: 5, text: gt('Purple') },
                            PINK: { value: 8, text: gt('Pink') },
                            GRAY: { value: 4, text: gt('Gray') }
                        },

                        COLORFLAGS = {
                            '$cl_1': '1',
                            '$cl_2': '2',
                            '$cl_3': '3',
                            '$cl_4': '4',
                            '$cl_5': '5',
                            '$cl_6': '6',
                            '$cl_7': '7',
                            '$cl_8': '8',
                            '$cl_9': '9',
                            '$cl_10': '10'
                        };

                    if (/delete|seen/.test(action.flags[0])) {
                        inputId = _.uniqueId('markas_');
                        this.append(
                            util.drawAction({
                                actionKey: actionKey,
                                inputId: inputId,
                                title: baton.view.actionsTranslations.markmail,
                                dropdownOptions: { name: 'flags', model: amodel, values: flagValues, id: inputId }
                            })
                        );
                    } else if (/^\$cl/.test(action.flags[0])) {
                        inputId = _.uniqueId('colorflag_');
                        this.append($('<li>').addClass('filter-settings-view row').attr({ 'data-action-id': actionKey }).append(
                            $('<div>').addClass('col-sm-4 singleline').append(
                                $('<span>').addClass('list-title').text(baton.view.actionsTranslations.flag)
                            ),
                            $('<div>').addClass('col-sm-8').append(
                                $('<div>').addClass('row').append(
                                    $('<div>').addClass('col-sm-3 col-sm-offset-9 rightalign').append(
                                        util.drawColorDropdown(action.flags[0], COLORS, COLORFLAGS)
                                    )
                                )
                            ),
                            util.drawDeleteButton('action')
                        ));
                    } else {
                        inputId = _.uniqueId('customflag_');
                        this.append(
                            util.drawAction({
                                actionKey: actionKey,
                                inputId: inputId,
                                title: baton.view.actionsTranslations.tag,
                                inputLabel: baton.view.actionsTranslations.tag,
                                inputOptions: { name: 'flags', model: amodel, className: 'form-control', id: inputId },
                                errorView: true
                            })
                        );
                    }
                }

            });

            ext.point('io.ox/mail/mailfilter/actions').extend({

                id: 'removeflags',

                index: 1000,

                initialize: function (opt) {
                    var defaults = {
                        'removeflags': {
                            'flags': ['$'],
                            'id': 'removeflags'

                        }
                    };
                    _.extend(opt.defaults.actions, defaults);
                    _.extend(opt.actionsTranslations, {
                        'removeflags': gt('Remove IMAP keyword')
                    });

                    _.extend(opt.actionCapabilities, { 'removeflags': 'removeflags' });

                    if (_.indexOf(opt.actionsOrder, 'tag') !== -1) opt.actionsOrder.push(_.first(opt.actionsOrder.splice(_.indexOf(opt.actionsOrder, 'tag'), 1)));
                    opt.actionsOrder.push('removeflags');
                },

                draw: function (baton, actionKey, amodel) {
                    var inputId = _.uniqueId('removeflags_');
                    this.append(
                        util.drawAction({
                            actionKey: actionKey,
                            inputId: inputId,
                            title: baton.view.actionsTranslations.removeflags,
                            inputLabel: baton.view.actionsTranslations.removeflags,
                            inputOptions: { name: 'flags', model: amodel, className: 'form-control', id: inputId },
                            errorView: true
                        })
                    );
                }

            });
        }

        ext.point('io.ox/mail/mailfilter/actions').extend({

            id: 'discard',

            index: 600,

            initialize: function (opt) {
                var defaults = {
                    'discard': {
                        'id': 'discard'
                    }
                };
                _.extend(opt.defaults.actions, defaults);
                _.extend(opt.actionsTranslations, {
                    'discard': gt('Discard')
                });

                _.extend(opt.actionCapabilities, { 'discard': 'discard' });

                opt.actionsOrder.push('discard');
            },

            draw: function (baton, actionKey, amodel, filterValues, action) {
                var inputId = _.uniqueId('discard_');
                this.append(
                    util.drawAction({
                        actionKey: actionKey,
                        inputId: inputId,
                        addClass: 'warning',
                        title: baton.view.actionsTranslations[action.id]
                    })
                );
            }

        });

        ext.point('io.ox/mail/mailfilter/actions').extend({

            id: 'keep',

            index: 800,

            initialize: function (opt) {
                var defaults = {
                    'keep': {
                        'id': 'keep'
                    }
                };
                _.extend(opt.defaults.actions, defaults);
                _.extend(opt.actionsTranslations, {
                    'keep': gt('Keep')
                });

                _.extend(opt.actionCapabilities, { 'keep': 'keep' });

                opt.actionsOrder.push('keep');
            },

            draw: function (baton, actionKey, amodel, filterValues, action) {
                var inputId = _.uniqueId('keep_');
                this.append(
                    util.drawAction({
                        actionKey: actionKey,
                        inputId: inputId,
                        title: baton.view.actionsTranslations[action.id]
                    })
                );
            }

        });

        if (_.has(cap, 'fileinto')) {

            ext.point('io.ox/mail/mailfilter/actions').extend({

                id: 'move',

                index: 100,

                initialize: function (opt) {
                    var defaults = {
                        'move': {
                            'id': 'move',
                            'into': 'default0/INBOX'
                        }
                    };
                    _.extend(opt.defaults.actions, defaults);
                    _.extend(opt.actionsTranslations, {
                        //#. File a message into a folder
                        'move': gt('File into')
                    });

                    _.extend(opt.actionCapabilities, { 'move': 'move' });

                    opt.actionsOrder.push('move');
                },

                draw: function (baton, actionKey, amodel, filterValues, action) {

                    function onFolderSelect(e) {
                        e.preventDefault();

                        var model = $(e.currentTarget).data('model');

                        baton.view.dialog.pause();

                        picker({
                            context: 'filter',
                            done: function (id) {
                                model.set('into', id);
                            },
                            close: function () {
                                baton.view.dialog.resume();
                            },
                            folder: model.get('into'),
                            module: 'mail',
                            root: '1'
                        });
                    }

                    var inputId = _.uniqueId('move_');
                    this.append(
                        util.drawAction({
                            actionKey: actionKey,
                            inputId: inputId,
                            title: baton.view.actionsTranslations[action.id],
                            activeLink: true,
                            inputLabel: baton.view.actionsTranslations[action.id],
                            inputOptions: { name: 'into', model: amodel, className: 'form-control', id: inputId }
                        })
                    );
                    this.find('[data-action-id="' + actionKey + '"] .folderselect').on('click', onFolderSelect);
                }

            });
        }

        if (_.has(cap, 'fileinto') && _.has(cap, 'copy')) {

            ext.point('io.ox/mail/mailfilter/actions').extend({

                id: 'copy',

                index: 200,

                initialize: function (opt) {
                    var defaults = {
                        'copy': {
                            'id': 'copy',
                            'into': 'default0/INBOX',
                            'copy': true
                        }
                    };
                    _.extend(opt.defaults.actions, defaults);
                    _.extend(opt.actionsTranslations, {
                        //#. Copy a message into a folder
                        'copy': gt('Copy into')
                    });

                    _.extend(opt.actionCapabilities, { 'copy': 'copy' });

                    opt.actionsOrder.push('copy');
                },

                draw: function (baton, actionKey, amodel, filterValues, action) {

                    function onFolderSelect(e) {
                        e.preventDefault();

                        var model = $(e.currentTarget).data('model');

                        baton.view.dialog.pause();

                        picker({
                            context: 'filter',
                            done: function (id) {
                                model.set('into', id);
                            },
                            close: function () {
                                baton.view.dialog.resume();
                            },
                            folder: model.get('into'),
                            module: 'mail',
                            root: '1'
                        });
                    }

                    var inputId = _.uniqueId('copy_');
                    this.append(
                        util.drawAction({
                            actionKey: actionKey,
                            inputId: inputId,
                            title: baton.view.actionsTranslations[action.id],
                            activeLink: true,
                            inputLabel: baton.view.actionsTranslations[action.id],
                            inputOptions: { name: 'into', model: amodel, className: 'form-control', id: inputId }
                        })
                    );
                    this.find('[data-action-id="' + actionKey + '"] .folderselect').on('click', onFolderSelect);
                }

            });
        }

        ext.point('io.ox/mail/mailfilter/actions').extend({

            id: 'redirect',

            index: 300,

            initialize: function (opt) {
                var defaults = {
                    'redirect': {
                        'id': 'redirect',
                        'to': ''
                    }
                };
                _.extend(opt.defaults.actions, defaults);
                _.extend(opt.actionsTranslations, {
                    'redirect': gt('Redirect to')
                });

                _.extend(opt.actionCapabilities, { 'redirect': 'redirect' });

                opt.actionsOrder.push('redirect');
            },

            draw: function (baton, actionKey, amodel, filterValues, action) {
                var inputId = _.uniqueId('redirect_');
                this.append(
                    util.drawAction({
                        actionKey: actionKey,
                        inputId: inputId,
                        title: baton.view.actionsTranslations[action.id],
                        inputLabel: baton.view.actionsTranslations.redirect,
                        inputOptions: { name: 'to', model: amodel, className: 'form-control', id: inputId },
                        errorView: true
                    })
                );
            }

        });

        if (_.has(cap, 'reject')) {

            ext.point('io.ox/mail/mailfilter/actions').extend({

                id: 'reject',

                index: 700,

                initialize: function (opt) {
                    var defaults = {
                        'reject': {
                            'id': 'reject',
                            'text': ''
                        }
                    };
                    _.extend(opt.defaults.actions, defaults);
                    _.extend(opt.actionsTranslations, {
                        'reject': gt('Reject with reason')
                    });

                    _.extend(opt.actionCapabilities, { 'reject': 'reject' });

                    opt.actionsOrder.push('reject');
                },

                draw: function (baton, actionKey, amodel, filterValues, action) {
                    var inputId = _.uniqueId('reject_');
                    this.append(
                        util.drawAction({
                            actionKey: actionKey,
                            inputId: inputId,
                            title: baton.view.actionsTranslations[action.id],
                            inputLabel: baton.view.actionsTranslations.reject,
                            inputOptions: { name: 'text', model: amodel, className: 'form-control', id: inputId },
                            errorView: true
                        })
                    );
                }

            });

        }

    }

    return api.getConfig().then(processConfig).then(function () {
        defer.resolve({ processConfig: processConfig });
        return defer;
    });

});
