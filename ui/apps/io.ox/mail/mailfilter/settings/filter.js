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

define('io.ox/mail/mailfilter/settings/filter',
    ['io.ox/core/extensions',
     'io.ox/core/api/mailfilter',
     'io.ox/mail/mailfilter/settings/model',
     'io.ox/core/tk/dialogs',
     'io.ox/settings/util',
     'io.ox/mail/mailfilter/settings/filter/view-form',
     'gettext!io.ox/mail',
     'io.ox/mail/mailfilter/settings/filter/defaults'
    ], function (ext, api, mailfilterModel, dialogs, settingsUtil, FilterDetailView, gt, DEFAULTS) {

    'use strict';

    var factory = mailfilterModel.protectedMethods.buildFactory('io.ox/core/mailfilter/model', api),
        collection,
        grid;

    function updatePositionInCollection(collection, positionArray) {
        _.each(positionArray, function (key, val) {
            collection.get(key).set('position', val);
        });
        collection.sort();
    }

    function renderDetailView(evt, data) {
        var myView,
            header = data.id === undefined ? gt('Create new rule') : gt('Edit rule'),
            testArray, actionArray, rulename,

            checkForPosition = function (array, target) {
                var position;
                _.each(array, function (val, index) {
                    if (_.isEqual(val, target)) {
                        position = index;
                    }
                });
                return position;
            },

            filterCondition = function (tests, condition) {
                var position = checkForPosition(tests, condition);
                if (position) {
                    tests.splice(position, 1);
                }
                return tests;
            };

        myView = new FilterDetailView({ model: data, listView: evt.data.listView });

        testArray = _.copy(myView.model.get('test'), true);
        actionArray = _.copy(myView.model.get('actioncmds'), true);
        rulename = _.copy(myView.model.get('rulename'), true);

        if (testArray.tests) {
            testArray.tests = filterCondition(testArray.tests, {id: 'true'});

            if (testArray.tests.length === 1) {
                var includedTest = _.copy(testArray.tests[0]);
                testArray = includedTest;
            }
            myView.model.set('test', testArray);
        }

        myView.dialog = new dialogs.ModalDialog({
            top: 60,
            width: 800,
            center: false,
            maximize: true,
            async: true
        }).header($('<h4>').text(header));

        myView.dialog.append(
            myView.render().el
        )
        .addPrimaryButton('save', gt('Save'), 'save', {tabIndex: '1'})
        .addButton('cancel', gt('Cancel'), 'cancel', {tabIndex: '1'});

        myView.dialog.show();
        myView.$el.find('input[name="rulename"]').focus();

        if (data.id === undefined) {
            myView.$el.find('input[name="rulename"]').trigger('select');
        }

        myView.collection = collection;

        myView.dialog.on('save', function () {
            myView.dialog.getBody().find('.io-ox-mailfilter-edit').trigger('save');
        });

        myView.dialog.on('cancel', function () {
            // reset the model
            myView.model.set('test', testArray);
            myView.model.set('actioncmds', actionArray);
            myView.model.set('rulename', rulename);
        });
    }

    ext.point('io.ox/settings/mailfilter/filter/settings/detail').extend({
        index: 200,
        id: 'mailfiltersettings',
        draw: function (evt) {
            renderDetailView(evt, evt.data.obj);
        }
    });

    ext.point('io.ox/settings/mailfilter/filter/settings/actions/common').extend({
        index: 200,
        id: 'actions',
        draw: function (model) {
            var flag = (model.get('flags') || [])[0];
            var title = model.get('rulename'),
                texttoggle = model.get('active') ? gt('Disable') : gt('Enable');

            $(this).append(
                $('<a>').addClass('action').text(gt('Edit')).attr({
                    href: '#',
                    role: 'button',
                    'data-action': flag === 'vacation' ? 'edit-vacation' : 'edit',
                    tabindex: 1,
                    'aria-label': title + ', ' + gt('Edit')
                }),
                $('<a>').addClass('action').text(texttoggle).attr({
                    href: '#',
                    role: 'button',
                    'data-action': 'toggle',
                    tabindex: 1,
                    'aria-label': title + ', ' + (texttoggle)
                }),
                $('<a>').addClass('close').append($('<i/>').addClass('icon-trash')).attr({
                    href: '#',
                    role: 'button',
                    'data-action': 'delete',
                    tabindex: 1,
                    'aria-label': title + ', ' + gt('remove')
                })
            );
        }
    });

    ext.point('io.ox/settings/mailfilter/filter/settings/actions/vacation').extend({
        index: 200,
        id: 'actions',
        draw: function (model) {
            //redirect
            ext.point('io.ox/settings/mailfilter/filter/settings/actions/common')
                            .invoke('draw', this, model);
        }
    });

    return {
        editMailfilter: function ($node, baton) {
            grid = (baton || {}).grid;

            var createExtpointForSelectedFilter = function (node, args) {
                    ext.point('io.ox/settings/mailfilter/filter/settings/detail').invoke('draw', node, args);
                };

            return api.getRules().then(function (data) {

                collection = factory.createCollection(data);
                collection.comparator = function (model) {
                    return model.get('position');
                };

                var AccountSelectView = Backbone.View.extend({

                    tagName: 'li',

                    saveTimeout: 0,

                    render: function () {
                        var flag = (this.model.get('flags') || [])[0],
                            self = this,
                            actions = (this.model.get('actioncmds') || []);

                        function checkForUnknown() {
                            var unknown = false;
                            _.each(actions, function (action) {
                                if (!_.contains(['stop', 'vacation'], action.id)) {
                                    unknown = _.isEmpty(_.where(DEFAULTS.actions, { id: action.id }));
                                }
                            });

                            return unknown ? 'unknown' : undefined;
                        }

                        function getEditableState() {
                            return (checkForUnknown() === 'unknown' || _.contains(['autoforward', 'spam', 'vacation'], flag))  ? 'fixed' : 'editable';
                        }

                        var title = self.model.get('rulename'),
                            titleNode;
                        this.$el.attr({
                                'data-id': self.model.get('id')
                            })
                            .addClass('widget-settings-view draggable ' + getEditableState() + ' ' + (self.model.get('active') ? 'active' : 'disabled'))
                            .append(
                                $('<a>').addClass('drag-handle').append(
                                    $('<i/>').addClass('icon-reorder')
                                ).attr({
                                    href: '#',
                                    role: 'button',
                                    tabindex: 1,
                                    'aria-label': title + ', ' + gt('Use cursor keys to change the item position')
                                }),
                                $('<div>').addClass('pull-right').append(function () {
                                    var point = ext.point('io.ox/settings/mailfilter/filter/settings/actions/' + (checkForUnknown() || flag || 'common'));
                                    point.invoke('draw', $(this), self.model);
                                }),
                                title = $('<span>').addClass('list-title').text(title)
                            );

                        self.model.on('change:rulename', function (el, val) {
                            titleNode.text(val);
                        });
                        return self;
                    },

                    events: {
                        'click [data-action="toggle"]': 'onToggle',
                        'click [data-action="delete"]': 'onDelete',
                        'click [data-action="edit"]': 'onEdit',
                        'click [data-action="edit-vacation"]': 'onEditVacation',
                        'keydown .drag-handle': 'dragViaKeyboard'
                    },

                    onToggle: function (e) {
                        e.preventDefault();
                        var self = this;
                        this.model.set('active', !this.model.get('active'));

                        //yell on reject
                        settingsUtil.yellOnReject(
                            api.update(self.model).done(function () {
                                self.$el.toggleClass('active disabled');
                                $(e.target).text(self.model.get('active') ? gt('Disable') : gt('Enable'));
                            })
                        );
                    },

                    onDelete: function (e) {
                        e.preventDefault();
                        var self = this,
                            id = self.model.get('id');
                        if (id !== false) {
                             //yell on reject
                            settingsUtil.yellOnReject(
                                api.deleteRule(id).done(function () {
                                    var arrayOfFilters,
                                        data;
                                    self.model.collection.remove(id);
                                    $node.find('.controls [data-action="add"]').focus();

                                    arrayOfFilters = $node.find('li[data-id]');
                                    data = _.map(arrayOfFilters, function (single) {
                                        return parseInt($(single).attr('data-id'), 10);
                                    });
                                     //yell on reject
                                    settingsUtil.yellOnReject(
                                        api.reorder(data)
                                    );
                                    updatePositionInCollection(collection, data);

                                })
                            );
                        }
                    },

                    onEdit: function (e) {
                        e.preventDefault();
                        var self = this;
                        e.data = {};
                        e.data.id = self.model.get('id');
                        e.data.obj = self.model;
                        if (e.data.obj !== undefined) {
                            createExtpointForSelectedFilter(this.$el.parent(), e);
                        }
                    },

                    onEditVacation: function (e) {
                        e.preventDefault();
                        var elem = _.find(grid.getIds(), function (item) {
                                return item.id === 'io.ox/vacation';
                            });

                        if (elem) {
                            grid.selection.set(elem);
                        }
                    },

                    dragViaKeyboard: function (e) {
                        var self = this,
                            list = this.$el.closest('.widget-list'),
                            items = list.children(),
                            index = items.index(this.$el);

                        function keyHandle(dir) {
                            e.preventDefault();
                            if (dir === 'up') {
                                self.$el.insertBefore(self.$el.prev());
                            } else {
                                self.$el.insertAfter(self.$el.next());
                            }
                            clearTimeout(self.saveTimeout);
                            self.saveTimeout = setTimeout(saveOrder, 500);
                            self.$el.find('.drag-handle').focus();
                        }

                        function saveOrder() {
                            var data = _.map(list.children(), function (single) {
                                return parseInt($(single).attr('data-id'), 10);
                            });
                            //yell on reject
                            settingsUtil.yellOnReject(
                                api.reorder(data)
                            );
                            updatePositionInCollection(collection, data);
                        }

                        switch (e.which) {
                        case 38:
                            if (index > 0) { // up
                                keyHandle('up');
                            }
                            break;
                        case 40:
                            if (index < items.length) { // down
                                keyHandle('down');
                            }
                            break;
                        default:
                            break;
                        }
                    }
                }),

                MailfilterEdit = Backbone.View.extend({

                    initialize: function () {
                        _.bindAll(this, 'render', 'onAdd', 'renderFilter');
                        this.collection = collection.bind('add remove', this.renderFilter);
                    },

                    render: function () {
                        this.$el.append($('<h1>').addClass('pull-left').text(gt('Mail Filter')),
                            $('<div>').addClass('btn-group pull-right').append(
                                $('<button>').addClass('btn btn-primary').text(gt('Add new rule')).attr({
                                    'data-action': 'add',
                                    tabindex: 1,
                                    type: 'button'
                                })
                            ),
                            $('<div class="clearfix">'),
                            $('<ol>').addClass('list-group list-unstyled widget-list ui-sortable')
                        );
                        this.renderFilter();
                        return this;
                    },

                    renderFilter: function () {
                        var self = this,
                            list = self.$el.find('.widget-list').empty();
                        if (this.collection.length === 0) {
                            list.append($('<div>').text(gt('There is no rule defined')));
                        } else {
                            this.collection.each(function (item) {
                                list.append(
                                    new AccountSelectView({ model: item }).render().el
                                );
                            });
                            this.makeSortable();
                        }
                    },

                    events: {
                        'click [data-action="add"]': 'onAdd'
                    },

                    onAdd: function (args) {
                        args.data = {
                            listView: this,
                            obj: factory.create(mailfilterModel.protectedMethods.provideEmptyModel())
                        };
                        createExtpointForSelectedFilter(this.el, args);
                    },

                    makeSortable: function () {

                        this.$el.find('ol').sortable({
                            containment: this.el,
                            axis: 'y',
                            handle: '.drag-handle',
                            scroll: true,
                            delay: 150,
                            start: function (e, ui) {
                                ui.item.attr('aria-grabbed', 'true');
                            },
                            stop: function (e, ui) {
                                ui.item.attr('aria-grabbed', 'false');
                                var arrayOfFilters = $node.find('li[data-id]'),
                                data = _.map(arrayOfFilters, function (single) {
                                    return parseInt($(single).attr('data-id'), 10);
                                });
                                 //yell on reject
                                settingsUtil.yellOnReject(
                                    api.reorder(data)
                                );
                                updatePositionInCollection(collection, data);
                            }
                        });
                    }

                }),

                mailFilter = new MailfilterEdit();
                $node.append(mailFilter.render().$el);
                return collection;
            });

        }
    };

});
