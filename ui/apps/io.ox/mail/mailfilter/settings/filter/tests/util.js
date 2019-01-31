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

define('io.ox/mail/mailfilter/settings/filter/tests/util', [
    'io.ox/core/extensions',
    'io.ox/backbone/mini-views',
    'io.ox/backbone/mini-views/dropdown',
    'gettext!io.ox/mailfilter'

], function (ext, mini, Dropdown, gt) {

    'use strict';

    var DropdownLinkView = mini.DropdownLinkView.extend({
        updateLabel: function () {
            this.$el.find('.dropdown-label').text(this.options.values[this.model.get(this.name)] || this.model.get(this.name));
        }
    });

    var pasteHelper =  function (e) {
        if (!e || e.type !== 'paste') return;
        if (e.originalEvent.clipboardData.types.indexOf('text/plain') !== -1) {
            var self = this;
            // use a one time listener for the input Event, so we can trigger the changes after the input updated (onDrop is still to early)
            this.$el.one('input', function () {
                self.$el.trigger('change');
            });
        }
    };

    var Input = mini.InputView.extend({
        events: { 'change': 'onChange', 'keyup': 'onKeyup', 'paste': 'onPaste' },

        validationForSize: function () {
            var listOfUnits = ['B', 'K', 'KB', 'M', 'MB', 'G', 'GB'],
                splits = this.$el.val().split(''),
                number = '',
                unit = '',
                stop = false;

            _.each(splits, function (val) {
                if (/^[0-9]+$/.test(val) && !stop) {
                    number = number + val;
                } else {
                    stop = true;
                    unit = unit + val;
                }
            });

            return /^[0-9]+$/.test(number) && parseInt(number, 10) < 2147483648 && parseInt(number, 10) >= 0 && (unit === '' || _.contains(listOfUnits, unit.toUpperCase()));
        },
        onChange: function () {
            if (this.name === 'size' && this.validationForSize()) {
                this.model.set(this.name, this.$el.val());
            } else if (this.name === 'values' || this.name === 'headers') {
                this.model.set(this.name, [this.$el.val()]);
            } else {
                this.model.set(this.name, this.$el.val());
            }

            // force validation
            this.onKeyup();
        },
        onKeyup: function () {
            var state;

            if (this.name === 'size') {
                state = this.validationForSize() ? 'valid:' : 'invalid:';

            } else {
                state = $.trim(this.$el.val()) === '' && this.$el.prop('disabled') === false ? 'invalid:' : 'valid:';
            }

            this.model.trigger(state + this.name);
            this.$el.trigger('toggle:saveButton');
        },
        onPaste: pasteHelper
    });

    var drawDeleteButton = function (type) {
        return $('<a href="#" class="remove" tabindex="0">').attr('data-action', 'remove-' + type).append($('<i class="fa fa-trash-o">'));
    };

    var drawCondition = function (o) {
        if (o.layout === '3') {
            return $('<li>').addClass('filter-settings-view row layout-3 ' + o.addClass).attr({ 'data-test-id': o.conditionKey }).append(
                $('<div>').addClass('col-sm-2 doubleline').append(
                    $('<span>').addClass('list-title').text(o.title)
                ),
                $('<div>').addClass('col-sm-10').append(
                    $('<div>').addClass('row').append(
                        $('<div>').addClass('col-sm-4 dualdropdown').append(
                            $('<div>').addClass('row').append(
                                $('<label class="col-sm-4">').text(gt('Header')),
                                $('<div>').addClass('col-sm-8').append(
                                    new DropdownLinkView(o.seconddropdownOptions).render().$el
                                )
                            ),
                            $('<div>').addClass('row').append(
                                $('<label class="col-sm-4">').text(gt('Part')),
                                $('<div>').addClass('col-sm-8').append(
                                    new DropdownLinkView(o.thirddropdownOptions).render().$el
                                )
                            )
                        ),
                        $('<div>').addClass('col-sm-3 dropdownadjust').append(
                            new DropdownLinkView(o.dropdownOptions).render().$el
                        ),
                        $('<div>').addClass('col-sm-5 doubleline').append(
                            $('<label for="' + o.inputId + '" class="sr-only">').text(o.inputLabel),
                            new Input(o.inputOptions).render().$el,
                            o.errorView ? new mini.ErrorView({ selector: '.row' }).render().$el : []
                        )
                    )
                ),
                drawDeleteButton('test')
            );
        }

        if (o.secondInputId) {
            return $('<li>').addClass('filter-settings-view row ' + o.addClass).attr({ 'data-test-id': o.conditionKey }).append(
                $('<div>').addClass('col-sm-4 doubleline').append(
                    $('<span>').addClass('list-title').text(o.title)
                ),
                $('<div>').addClass('col-sm-8').append(
                    $('<div>').addClass('row').append(
                        $('<label for="' + o.inputId + '" class="col-sm-4 control-label" >').text(gt('Name')),
                        $('<div>').addClass('first-label inline-input col-sm-8').append(
                            new Input(o.inputOptions).render().$el,
                            o.errorView ? new mini.ErrorView({ selector: '.row' }).render().$el : []
                        )
                    ),
                    $('<div>').addClass('row').append(
                        $('<div>').addClass('col-sm-4').append(
                            new DropdownLinkView(o.dropdownOptions).render().$el
                        ),
                        $('<div class="col-sm-8">').append(
                            $('<label for="' + o.secondInputId + '" class="sr-only">').text(o.secondInputLabel),
                            new Input(o.secondInputOptions).render().$el,
                            o.errorView ? new mini.ErrorView({ selector: '.row' }).render().$el : []
                        )
                    )
                ),
                drawDeleteButton('test')
            );
        }
        return $('<li>').addClass('filter-settings-view row ' + o.addClass).attr({ 'data-test-id': o.conditionKey }).append(
            $('<div>').addClass('col-sm-4 singleline').append(
                $('<span>').addClass('list-title').text(o.title)
            ),
            $('<div>').addClass('col-sm-8').append(
                $('<div>').addClass('row').append(
                    o.seconddropdownOptions ? $('<div>').addClass('col-sm-2').append(
                        new DropdownLinkView(o.seconddropdownOptions).render().$el
                    ) : [],
                    $('<div>').addClass(o.seconddropdownOptions ? 'col-sm-2' : 'col-sm-4').append(
                        o.dropdownOptions ? new DropdownLinkView(o.dropdownOptions).render().$el : []
                    ),
                    $('<div class="col-sm-8">').append(
                        $('<label for="' + o.inputId + '" class="sr-only">').text(o.inputLabel),
                        new Input(o.inputOptions).render().$el,
                        o.errorView ? new mini.ErrorView({ selector: '.row' }).render().$el : []
                    )
                )
            ),
            drawDeleteButton('test')
        );

    };

    var returnContainsOptions = function (cap, additionalValues) {

        var defaults = {
            'contains': gt('Contains'),
            'not contains': gt('Contains not'),
            'is': gt('Is exactly'),
            'not is': gt('Is not exactly'),
            'matches': gt('Matches'),
            'not matches': gt('Matches not'),
            //needs no different translation
            'startswith': gt('Starts with'),
            'not startswith': gt('Starts not with'),
            //#. a given string does end with a specified pattern
            'endswith': gt('Ends with'),
            //#. a given string does not end with a specified pattern
            'not endswith': gt('Ends not with'),
            'regex': gt('Regex'),
            'not regex': gt('Not Regex'),
            'exists': gt('Exists'),
            'not exists': gt('Does not exist')
        };

        return _.extend(defaults, additionalValues);
    };

    var returnDefaultToolTips = function () {
        return {
            'contains': gt('matches a substring'),
            'not contains': gt('does not match a substring'),
            'is': gt('an exact, full match'),
            'not is': gt('not an exact, full match '),
            'matches': gt('a full match (allows DOS-style wildcards)'),
            'not matches': gt('not a full match (allows DOS-style wildcards)'),
            'startswith': gt('Starts with'),
            'not startswith': gt('Starts not with'),
            'endswith': gt('Ends with'),
            'not endswith': gt('Ends not with'),
            'regex': gt('Regex'),
            'not regex': gt('Not Regex'),
            'exists': gt('Exists'),
            'not exists': gt('Does not exist')
        };
    };

    var drawDropdown = function (activeValue, values, options) {
        var active = values[activeValue] || activeValue;
        if (options.caret) {
            active = active + '<b class="caret">';
        }
        var $toggle = $('<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="menuitem" aria-haspopup="true" tabindex="0">').html(active),
            $ul = $('<ul class="dropdown-menu" role="menu">').append(
                _(values).map(function (name, value) {
                    if (value === options.skip) return;
                    return $('<li>').append(
                        $('<a href="#" data-action="change-dropdown-value">').attr('data-value', value).data(options).append(
                            $.txt(name)
                        )
                    );
                })
            );

        return new Dropdown({
            className: 'action dropdown value ' + (options.classes ? options.classes : ''),
            $toggle: $toggle,
            $ul: $ul
        }).render().$el;
    };

    var filterHeaderValues = function (tests, testId, values) {
        var id = _.findIndex(tests, { id: testId }),
            availableValues = {};

        _.each(values, function (value, key) {
            if (_.indexOf(tests[id].headers, key) !== -1) availableValues[key] = value;
        });
        return availableValues;
    };

    var filterPartValues = function (tests, testId, values) {
        var id = _.findIndex(tests, { id: testId }),
            availableValues = {};

        _.each(values, function (value, key) {
            if (_.indexOf(tests[id].parts, key) !== -1) availableValues[key] = value;
        });
        return availableValues;
    };

    var returnDefault = function (tests, id, option, value) {
        var testId = _.findIndex(tests, { id: id }),
            optionList = tests[testId][option];
        if (_.indexOf(optionList, value) !== -1) {
            return value;
        }
        return optionList[0];
    };

    var handleUnsupportedComparisonValues = function (opt) {
        var input = opt.inputName ? opt.$li.find('[name="' + opt.inputName + '"]') : opt.$li.find('input'),
            label = opt.$li.find('[data-name="comparison"]').first().closest('.dropdownlink').find('.dropdown-label');

        if (!opt.values[opt.model.get('comparison')]) {
            input.prop('disabled', true);
            label.addClass('unsupported');
        }
        opt.model.on('change:comparison', function () {
            label.removeClass('unsupported');
        });
    };

    var handleSpecialComparisonValues = function (opt) {

        var input = opt.inputName ? opt.$li.find('[name="' + opt.inputName + '"]') : opt.$li.find('input'),
            emptyValuesAllowed = ['exists', 'not exists'];

        // handle rule from backend
        if (opt.model.get('comparison') === 'not exists' || opt.model.get('comparison') === 'exists') {
            input.prop('disabled', true);
        }

        opt.model.on('change:comparison', function (m, value) {
            if (!_.contains(emptyValuesAllowed, value)) {
                input.prop('disabled', false);
                opt.model.set('values', opt.defaults.values, { silent: true });
                if (opt.defaults.id !== 'header') opt.model.set('headers', opt.defaults.headers);

            } else {
                input.prop('disabled', true);
                input.val('');
                opt.model.set('values', [''], { silent: true });
                if (opt.defaults.id !== 'header') opt.model.set('headers', [''], { silent: true });
            }
            input.trigger('keyup');
        });

    };

    return {
        Input: Input,
        drawCondition: drawCondition,
        drawDeleteButton: drawDeleteButton,
        returnContainsOptions: returnContainsOptions,
        drawDropdown: drawDropdown,
        returnDefaultToolTips: returnDefaultToolTips,
        filterHeaderValues: filterHeaderValues,
        filterPartValues: filterPartValues,
        returnDefault: returnDefault,
        DropdownLinkView: DropdownLinkView,
        handleUnsupportedComparisonValues: handleUnsupportedComparisonValues,
        handleSpecialComparisonValues: handleSpecialComparisonValues
    };
});
