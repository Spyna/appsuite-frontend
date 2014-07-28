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
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define('io.ox/mail/mailfilter/settings/filter/view-form',
    ['io.ox/core/notifications',
     'gettext!io.ox/settings/settings',
     'io.ox/core/extensions',
     'io.ox/backbone/forms',
     'io.ox/backbone/views',
     'io.ox/mail/mailfilter/settings/filter/form-elements',
     'io.ox/mail/mailfilter/settings/filter/defaults',
     'apps/io.ox/core/tk/jquery-ui.min.js'
    ], function (notifications, gt, ext, forms, views, elements, DEFAULTS) {

    'use strict';

    var POINT = 'io.ox/mailfilter/settings/filter/detail',

        sizeValues = {
            'over': gt('Is bigger than'),
            'under': gt('Is smaller than')
        },

        flagValues = {
            '\\deleted': gt('deleted'),
            '\\seen': gt('seen')
        },

        containsValues = {
            'contains': gt('Contains'),
            'is': gt('Is exactly'),
            'matches': gt('Matches'),
            'regex': gt('Regex') //needs no different translation
        },

        headerTranslation = {
            'From': gt('Sender/From'),
            'any': gt('Any recipient'),
            'Subject': gt('Subject'),
            'mailingList': gt('Mailing list'),
            'To': gt('To'),
            'Cc': gt('CC'),
            'cleanHeader': gt('Header'),
            'envelope': gt('Envelope'),
            'size': gt('Size (bytes)')
        },

        actionsTranslations = {
            'keep': gt('Keep'),
            'discard': gt('Discard'),
            'redirect': gt('Redirect to'),
            'move': gt('Move to folder'),
            'reject': gt('Reject with reason'),
            'markmail': gt('Mark mail as'),
            'tag': gt('Tag mail with'),
            'flag': gt('Flag mail with')
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
        },

        adjustRulePosition = function (models) {
            var position, firstPos, secondPos,
                posibleStaticFilters = _.last(models, 2),
                getStaticFilterStatus =  function (model) {
                if (model.length === 0) {
                    return '0';
                } else if (model.length === 1) {
                    firstPos = _.isEqual(model[0].get('flags'), ['vacation']) ? _.isEqual(model[0].get('flags'), ['vacation']) : _.isEqual(model[0].get('flags'), ['autoforward']);
                } else {
                    firstPos = _.isEqual(model[0].get('flags'), ['vacation']) ? _.isEqual(model[0].get('flags'), ['vacation']) : _.isEqual(model[0].get('flags'), ['autoforward']);
                    secondPos = _.isEqual(model[1].get('flags'), ['vacation']) ? _.isEqual(model[1].get('flags'), ['vacation']) : _.isEqual(model[1].get('flags'), ['autoforward']);
                }
                if (firstPos && secondPos === undefined) {
                    return '3';
                } else if (firstPos && secondPos) {
                    return '2';
                } else if (!firstPos && secondPos) {
                    return '1';
                } else if (!firstPos && !secondPos) {
                    return '0';
                }
            };

            switch (getStaticFilterStatus(posibleStaticFilters)) {
            case '0':
                break;
            case '1':
                position = posibleStaticFilters[1].attributes.position;
                posibleStaticFilters[1].attributes.position = posibleStaticFilters[1].attributes.position + 1;
                break;
            case '2':
                position = posibleStaticFilters[0].get('position');
                posibleStaticFilters[0].set('position', posibleStaticFilters[0].attributes.position + 1);
                posibleStaticFilters[1].set('position', posibleStaticFilters[1].attributes.position + 1);
                break;
            case '3':
                position = posibleStaticFilters[0].attributes.position;
                posibleStaticFilters[0].attributes.position = posibleStaticFilters[0].attributes.position + 1;
                break;
            default:
                break;
            }

            return position;
        },

        checkForMultipleTests = function (el) {
            return $(el).find('[data-test-id]');
        },

        setFocus = function (el, type) {
            $(el).find('[data-' + type + '-id]').last().find('[tabindex="1"]').first().focus();
        },

        renderWarningForEmptyTests = function (node) {
            var warning = $('<div>').addClass('alert alert-block').text(gt('This rule applies to all messages. Please add a condition to restrict this rule to specific messages.'));
            node.append(warning);
        },

        prepareFolderForDisplay = function (folder) {
            var arrayOfParts = folder.split('/');
            arrayOfParts.shift();
            return arrayOfParts.join('/');
        },

        AccountDetailView = Backbone.View.extend({
            tagName: 'div',
            className: 'io-ox-mailfilter-edit',
            _modelBinder: undefined,
            initialize: function () {},
            render: function () {

                var baton = ext.Baton({ model: this.model, view: this });
                ext.point(POINT + '/view').invoke('draw', this.$el.empty(), baton);
                return this;

            },
            events: {
                'save': 'onSave',
                'click [data-action="change-value"]': 'onChangeValue',

                'click [data-action=change-value-extern]': 'onChangeValueExtern',

                'click [data-action="change-value-actions"]': 'onChangeValueAction',
                'change [data-action="change-text-test"]': 'onChangeTextTest',
                'change [data-action="change-text-test-second"]': 'onChangeTextTestSecond',

                'change [data-action="change-text-action"]': 'onChangeTextAction',
                'click .folderselect': 'onFolderSelect',
                'click [data-action="change-color"]': 'onChangeColor',
                'click [data-action="remove-test"]': 'onRemoveTest',
                'click [data-action="remove-action"]': 'onRemoveAction'
            },

            onRemoveTest: function (e) {

                e.preventDefault();
                var node = $(e.target),
                    testID = node.closest('li').attr('data-test-id'),
                    testArray =  this.model.get('test');

                if (checkForMultipleTests(this.el).length > 2) {
                    testArray.tests.splice(testID, 1);
                } else {

                    if (testArray.tests) {
                        testArray.tests.splice(testID, 1);
                        testArray = testArray.tests[0];
                    } else {
                        testArray = { id: 'true' };
                    }

                }

                this.model.set('test', testArray);
                this.render();

            },

            onRemoveAction: function (e) {

                e.preventDefault();
                var node = $(e.target),
                    actionID = node.closest('li').attr('data-action-id'),
                    actionArray =  this.model.get('actioncmds');

                actionArray.splice(actionID, 1);
                this.model.set('actioncmds', actionArray);
                this.render();

            },

            onSave: function () {
                var self = this,
                    rulePosition,
                    actionArray = this.model.get('actioncmds');

                function returnKeyForStop(actionsArray) {
                    var indicatorKey;
                    _.each(actionsArray, function (action, key) {
                        if (_.isEqual(action, {id: 'stop'})) {
                            indicatorKey = key;
                        }
                    });
                    return indicatorKey;
                }

                if (!this.model.has('id')) {
                    rulePosition = adjustRulePosition(self.options.listView.collection.models);
                    if (rulePosition !== undefined) {
                        this.model.set('position', rulePosition);
                    }
                }

                // if there is a stop action it should always be the last
                if (returnKeyForStop(actionArray) !== undefined) {
                    actionArray.splice(returnKeyForStop(actionArray), 1);
                    actionArray.push({id: 'stop'});
                    this.model.set('actioncmds', actionArray);
                }

                this.model.save().then(function (id) {
                    //first rule gets 0
                    if (!_.isUndefined(id) && !_.isNull(id)) {
                        self.model.set('id', id);
                        self.options.listView.collection.add(self.model);
                    }
                    self.dialog.close();
                }, self.dialog.idle);
            },

            onChangeValueExtern: function (e) {
                e.preventDefault();
                var node = $(e.target),
                    data = node.data(),
                    valueType = data.test ? 'test' : 'action';
                if (data.target) {
                    var arrayOfTests = this.model.get('test');
                    arrayOfTests.id = data.value;
                    this.model.set('test', arrayOfTests);
                } else if (data.test === 'create') {

                    var testArray =  this.model.get('test');
                    if (checkForMultipleTests(this.el).length > 1) {
                        testArray.tests.push(_.copy(DEFAULTS.tests[data.value], true));

                    } else if (checkForMultipleTests(this.el).length === 1) {
                        var createdArray = [testArray];
                        createdArray.push(_.copy(DEFAULTS.tests[data.value], true));
                        testArray = { id: 'allof'};
                        testArray.tests = createdArray;
                    } else {

                        testArray = _.copy(DEFAULTS.tests[data.value], true);
                    }

                    this.model.set('test', testArray);

                } else if (data.action === 'create') {
                    var actionArray = this.model.get('actioncmds');
                    actionArray.push(_.copy(DEFAULTS.actions[data.value], true));

                    this.model.set('actioncmds', actionArray);
                }
                this.render();

                setFocus(this.el, valueType);
            },

            onChangeValue: function (e) {
                e.preventDefault();
                var node = $(e.target),
                    value = node.attr('data-value') ? node.attr('data-value') : node.parent().attr('data-value'),
                    link = node.closest('.action').find('a.dropdown-toggle'),

                    list = link.closest('li'),
                    type = list.attr('data-type'),
                    testID = list.attr('data-test-id'),

                    testArray =  this.model.get('test'),
                    translatedValue = type === 'size' ? sizeValues[value] : containsValues[value];

                link.text(translatedValue);

                if (checkForMultipleTests(this.el).length > 1) {
                    testArray.tests[testID].comparison = value;
                } else {
                    testArray.comparison = value;
                }
                this.model.set('test', testArray);

                link.focus();
            },

            onChangeValueAction: function (e) {
                e.preventDefault();
                var node = $(e.target),
                    value = node.attr('data-value') ? node.attr('data-value') : node.parent().attr('data-value'),
                    link = node.closest('.action').find('a.dropdown-toggle'),

                    list = link.closest('li'),
                    actionID = list.attr('data-action-id'),
                    actionsArray =  this.model.get('actioncmds'),
                    translatedValue = flagValues[value];

                link.text(translatedValue);

                actionsArray[actionID].flags = [value];
                this.model.set('actioncmds', actionsArray);

                link.focus();
            },

            onChangeTextTest: function (e) {
                e.preventDefault();
                var node = $(e.target),
                    value = node.val(),
                    list = node.closest('li'),
                    type = list.attr('data-type'),
                    testID = list.attr('data-test-id'),
                    testArray =  this.model.get('test');

                if (checkForMultipleTests(this.el).length > 1) {
                    testArray.tests[testID][type] = type === 'size' ? value : [value];
                } else {
                    testArray[type] = type === 'size' ? value : [value];
                }

                this.model.set('test', testArray);

            },

            onChangeTextTestSecond: function (e) {
                e.preventDefault();
                var node = $(e.target),
                    value = node.val(),
                    list = node.closest('li'),
                    type = list.attr('data-type-second'),
                    testID = list.attr('data-test-id'),
                    testArray =  this.model.get('test');

                if (checkForMultipleTests(this.el).length > 1) {
                    testArray.tests[testID][type] = [value];
                } else {
                    testArray[type] = [value];
                }

                this.model.set('test', testArray);

            },

            onChangeTextAction: function (e) {

                function validateValue(value) {
                    var regex =  /\s/;
                    return  regex.test(value);
                }

                e.preventDefault();
                var node = $(e.target),
                    value = node.val(),
                    list = node.closest('li'),
                    type = list.attr('data-type'),
                    actionID = list.attr('data-action-id'),
                    actionArray =  this.model.get('actioncmds');

                if (type === 'flags') {

                    if (!validateValue(value)) {
                        actionArray[actionID][type] = ['$' + value.toString()];
                    } else {
                        notifications.yell('error', gt('The character " " is not allowed.'));
                    }

                } else {
                    actionArray[actionID][type] = type === 'to' || 'text' ? value : [value];
                }

                this.model.set('actioncmds', actionArray);

            },

            onFolderSelect: function (e) {
                e.preventDefault();
                var self = this,
                    list = $(e.currentTarget).closest('li'),
                    type = list.attr('data-type'),
                    actionID = list.attr('data-action-id'),
                    inputField = list.find('input'),
                    currentFolder =  self.model.get('actioncmds')[actionID].into,
                    actionArray =  this.model.get('actioncmds');

                self.dialog.getPopup().hide();

                require(['io.ox/core/tk/dialogs', 'io.ox/core/tk/folderviews'], function (dialogs, views) {

                    var label = gt('Select folder'),
                        dialog = new dialogs.ModalDialog()
                        .header($('<h4>').text(label))
                        .addPrimaryButton('select', label, 'select', {tabIndex: '1'})
                        .addButton('cancel', gt('Cancel'), 'cancel', {tabIndex: '1'});
                    dialog.getBody().css({ height: '250px' });
                    var tree = new views.FolderTree(dialog.getBody(), {
                            type: 'mail'
                                // can a mail be moved to any folder?
//                            rootFolderId: 'default0'
                        });
                    dialog.show(function () {
                        tree.paint().done(function () {
                            tree.select(currentFolder);
                        });
                    })
                    .done(function (action) {
                        if (action === 'select') {
                            var value = _(tree.selection.get()).first(),
                                prepared = prepareFolderForDisplay(value);

                            actionArray[actionID][type] = value;
                            self.model.set('actioncmds', actionArray);

                            inputField.val(prepared);
                            inputField.attr('title', value);
                        }
                        tree.destroy().done(function () {
                            tree = dialog = null;
                        });
                        self.dialog.getPopup().show();
                        self.$el.find('[data-action-id="' + actionID + '"] .folderselect').focus();
                    });
                });
            },

            onChangeColor: function (e) {
                e.preventDefault();
                var list = $(e.currentTarget).closest('li[data-action-id]'),
                    actionID = list.attr('data-action-id'),
                    colorValue = list.find('div.flag').attr('data-color-value'),
                    actionArray =  this.model.get('actioncmds');

                actionArray[actionID].flags[0] = '$cl_' + colorValue;
                this.model.set('actioncmds', actionArray);
                this.render();

                this.$el.find('[data-action-id="' + actionID + '"] .dropdown-toggle').focus();
            }



        });

    ext.point(POINT + '/view').extend({
        index: 150,
        id: 'tests',
        draw: function (baton) {

            var listTests = $('<ol class="widget-list tests">'),
                listActions = $('<ol class="widget-list actions">'),
                appliedTest = baton.model.get('test');

            if (appliedTest.tests) {
                appliedTest = appliedTest.tests;
            } else {
                appliedTest = [appliedTest];
            }

            _(appliedTest).each(function (test, num) {
                if (test.id === 'size') {
                    listTests.append($('<li>').addClass('filter-settings-view').attr({'data-type': 'size', 'data-test-id': num}).text(headerTranslation[test.id]).append(
                            $('<div>').addClass('pull-right').append(
                                elements.drawOptions(test.comparison, sizeValues),
                                elements.drawInputfieldTest(test.size),
                                elements.drawDeleteButton('test')
                            )

                        )
                    );
                } else if (test.id === 'header') {
                    var name;
                    if (test.headers[3]) {
                        name = headerTranslation.mailingList;
                    } else if (test.headers[1]) {
                        name = headerTranslation.any;
                    } else {
                        name = test.headers[0] === '' ? headerTranslation.cleanHeader : headerTranslation[test.headers[0]];
                    }

                    if (test.headers[0] === '' || name === undefined) {
                        name = headerTranslation.cleanHeader;
                        listTests.append($('<li>').addClass('filter-settings-view').attr({'data-test-id': num, 'data-type': 'values', 'data-type-second': 'headers' }).append(
                                $('<span>').addClass('list-title').text(name),

                                $('<div>').addClass('pull-right').append(
                                    $('<div>').addClass('inner').append(
                                        $('<div>').addClass('first-label').append(
                                            elements.drawInputfieldTestSecond(test.headers[0], gt('Name'))
                                        ),
                                        $('<div>').append(
                                            elements.drawOptions(test.comparison, containsValues),
                                            elements.drawInputfieldTest(test.values[0])
                                        )
                                    ),

                                    elements.drawDeleteButton('test')

                                )

                            )
                        );
                    } else {
                        listTests.append($('<li>').addClass('filter-settings-view').attr({'data-test-id': num, 'data-type': 'values'}).text(name).append(
                                $('<div>').addClass('pull-right').append(
                                    elements.drawOptions(test.comparison, containsValues),
                                    elements.drawInputfieldTest(test.values[0]),
                                    elements.drawDeleteButton('test')
                                )

                            )
                        );
                    }

                } else if (test.id === 'envelope') {

                    listTests.append($('<li>').addClass('filter-settings-view').attr({'data-type': 'values', 'data-test-id': num}).text(headerTranslation[test.id]).append(
                            $('<div>').addClass('pull-right').append(
                                elements.drawOptions(test.comparison, containsValues),
                                elements.drawInputfieldTest(test.values[0]),
                                elements.drawDeleteButton('test')
                            )

                        )
                    );

                }

            });

            _(baton.model.get('actioncmds')).each(function (action, num) {
                if (action.id !== 'stop') {

                    if (action.id === 'redirect') {
                        listActions.append($('<li>').addClass('filter-settings-view').attr({'data-action-id': num, 'data-type': 'to'}).text(actionsTranslations[action.id]).append(
                                $('<div>').addClass('pull-right').append(
                                    elements.drawInputfieldAction(action.to),
                                    elements.drawDeleteButton('action')
                                )

                            )
                        );
                    }

                    else if (action.id === 'move') {
                        listActions.append($('<li>').addClass('filter-settings-view').attr({'data-action-id': num, 'data-type': 'into'}).text(actionsTranslations[action.id]).append(
                                $('<div>').addClass('pull-right').append(
                                    elements.drawFolderSelect(),
                                    elements.drawDisabledInputfield(prepareFolderForDisplay(action.into)),
                                    elements.drawDeleteButton('action')
                                )
                        ));
                    }
                    else if (action.id === 'reject') {
                        listActions.append($('<li>').addClass('filter-settings-view').attr({'data-action-id': num, 'data-type': 'text'}).text(actionsTranslations[action.id]).append(
                                $('<div>').addClass('pull-right').append(
                                    elements.drawInputfieldAction(action.text),
                                    elements.drawDeleteButton('action')
                                )
                        ));
                    }
                    else if (action.id === 'addflags') {
                        if (/delete|seen/.test(action.flags[0])) {
                            listActions.append($('<li>').addClass('filter-settings-view').attr({'data-action-id': num, 'data-type': 'text'}).text(actionsTranslations.markmail).append(
                                    $('<div>').addClass('pull-right').append(
                                        elements.drawOptionsActions(action.flags[0], flagValues, 'mark-as'),
                                        elements.drawDeleteButton('action')
                                    )
                              ));
                        } else if (/^\$cl/.test(action.flags[0])) {
                            listActions.append($('<li>').addClass('filter-settings-view').attr({'data-action-id': num, 'data-type': 'text'}).text(actionsTranslations.flag).append(
                                    $('<div>').addClass('pull-right').append(
                                        elements.drawColorDropdown(action.flags[0], COLORS, COLORFLAGS),
                                        elements.drawDeleteButton('action')
                                    )
                            ));
                        } else {
                            listActions.append($('<li>').addClass('filter-settings-view').attr({'data-action-id': num, 'data-type': 'flags'}).text(actionsTranslations.tag).append(
                                    $('<div>').addClass('pull-right').append(
                                        elements.drawInputfieldAction(action.flags[0].replace(/^\$+/, '')),
                                        elements.drawDeleteButton('action')
                                    )
                          ));
                        }
                    }
                    else {
                        var classSet = action.id === 'discard' ? 'filter-settings-view warning' : 'filter-settings-view';
                        listActions.append($('<li>').addClass(classSet).attr('data-action-id', num).text(actionsTranslations[action.id]).append(
                                elements.drawDeleteButton('action')
                        ));
                    }

                }
            });

            var headlineTest = $('<legend>').addClass('sectiontitle expertmode conditions').text(gt('Conditions')),
                headlineActions = $('<legend>').addClass('sectiontitle expertmode actions').text(gt('Actions')),
                notification = $('<div>');

            if (_.isEqual(appliedTest[0], {id : 'true'})) {
                renderWarningForEmptyTests(notification);
            }

            this.append(
                headlineTest, notification, listTests,
                elements.drawOptionsExtern(gt('Add condition'), headerTranslation, {
                    test: 'create',
                    classes: 'no-positioning block',
                    toggle: 'dropdown'
                }),
                headlineActions, listActions,
                elements.drawOptionsExtern(gt('Add action'), actionsTranslations, {
                    action: 'create',
                    classes: 'no-positioning block',
                    toggle: 'dropup'
                })
            );

        }
    });

    views.point(POINT + '/view').extend(new forms.ControlGroup({
        id: 'rulename',
        index: 100,
        fluid: true,
        label: gt('Rule name'),
        control: '<input type="text" class="span7" name="rulename" tabindex="1">',
        attribute: 'rulename'
    }));


    ext.point(POINT + '/view').extend({
        index: 100,
        id: 'appliesto',
        draw: function (baton) {
            var arrayOfTests = baton.model.get('test'),
                options = {
                    target: 'id',
                    toggle: 'dropdown',
                    classes: 'no-positioning',
                    caret: true
//                    test: { nrInArray: '', target: ''  },
//                    action: { nrInArray: '', target: ''  }
                },
                optionsSwitch = elements.drawOptionsExtern(arrayOfTests.id, {allof: gt('Apply rule if all conditions are met'), anyof: gt('Apply rule if any condition is met.')}, options);
            if (arrayOfTests.id === 'allof' || arrayOfTests.id === 'anyof') {
                this.append($('<div>').addClass('line').append(optionsSwitch));
            } else {
                this.append($('<div>').addClass('line').text(gt('Apply rule if all conditions are met')));
            }

        }
    });

    ext.point(POINT + '/view').extend({
        index: 200,
        id: 'stopaction',
        draw: function (baton) {

            var checkStopAction = function (e) {
                var currentState = $(e.currentTarget).find('[type="checkbox"]').prop('checked'),
                    arrayOfActions = baton.model.get('actioncmds');

                function getCurrentPosition(array) {
                    var currentPosition;
                    _.each(array, function (single, id) {
                        if (single.id === 'stop') {
                            currentPosition = id;
                        }
                    });

                    return currentPosition;
                }

                if (currentState === true) {
                    arrayOfActions.splice(getCurrentPosition(arrayOfActions), 1);

                } else {
                    arrayOfActions.push({id: 'stop'});
                }

                baton.model.set('actioncmds', arrayOfActions);

            },

                target = baton.view.dialog.getFooter(),
                arrayOfActions = baton.model.get('actioncmds');

            function checkForStopAction(array) {
                var stopAction;
                if (baton.model.id === undefined) { // default value
                    return true;
                }

                _.each(array, function (single) {
                    if (single.id === 'stop') {
                        stopAction = false;
                    }

                });
                if (stopAction === undefined) {
                    return true;
                }
                return stopAction;
            }

            if (!target.find('[type="checkbox"]').length) {
                target.append(elements.drawcheckbox(checkForStopAction(arrayOfActions)).on('change', checkStopAction));
            }


        }
    });

    return AccountDetailView;
});
