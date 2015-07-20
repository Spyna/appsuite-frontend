/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2015 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/tk/wizard', [
    'io.ox/backbone/disposable',
    'gettext!io.ox/core',
    'static/3rd.party/velocity/velocity.min.js'
], function (DisposableView, gt) {

    'use strict';

    //
    // Helper
    //

    var overlays = [
        $('<div class="wizard-overlay abs">'),
        $('<div class="wizard-overlay abs">'),
        $('<div class="wizard-overlay abs">'),
        $('<div class="wizard-overlay abs">'),
        $('<div class="wizard-overlay wizard-spotlight abs">')
    ];

    var backdrop = $('<div class="wizard-backdrop abs">');

    // special node for fullscreen wizards on smartphone
    var container = $(
        '<div class="wizard-container abs">' +
        '  <div class="wizard-navbar">' +
        '    <div class="wizard-back"></div>' +
        '    <div class="wizard-title"></div>' +
        '    <div class="wizard-next"></div>' +
        '  </div>' +
        '  <div class="wizard-pages"></div>' +
        '  <div class="wizard-animation"></div>' +
        '</div>'
    );

    function getBounds(elem) {
        var o = elem.offset();
        o.width = elem.outerWidth();
        o.height = elem.outerHeight();
        o.availableWidth = $(document).width();
        o.availableHeight = $(document).height();
        o.right = o.availableWidth - o.width - o.left;
        o.bottom = o.availableHeight - o.height - o.top;
        return o;
    }

    function append(type) {
        return function () {
            var target = this.$(type);
            target.append.apply(target, arguments);
            return this;
        };
    }

    function addControl(html) {
        return function (node, options) {
            node.append(
                $(html)
                    .attr('data-action', options.action)
                    .addClass(options.className)
                    .text(options.label || '\u0A00')
            );
            return this;
        };
    }

    //
    // Wizard/Tour
    //

    function Wizard(options) {

        this.options = options || {};
        this.currentStep = 0;
        this.steps = [];

        // add event hub
        _.extend(this, Backbone.Events);

        this.on({
            'step:next': this.next,
            'step:back': this.back,
            'step:close': this.close,
            'step:done': this.close
        });

        // remove all overlays and backdrop if a step gets hidden
        this.on('step:hide', function () {
            _(overlays).invoke('detach');
            backdrop.detach();
        });

        // focus trap
        $(document).on('click', '.wizard-overlay, .wizard-backdrop', function () {
            $('.wizard-step:visible').focus();
        });

        if (_.device('smartphone')) initalizeSmartphoneSupport.call(this);
    }

    _.extend(Wizard.prototype, {

        step: function (options) {
            var step = new Step(options, this);
            this.steps.push(step);
            return step;
        },

        getCurrentStep: function () {
            return this.steps[this.currentStep];
        },

        withCurrentStep: function (callback) {
            var step = this.getCurrentStep();
            if (step) callback.call(this, step);
            return this;
        },

        setCurrentStep: function (n) {
            if (this.currentStep === n) return;
            if (n < 0 || n >= this.steps.length) return;
            this.currentStep = n;
            this.trigger('change:step');
        },

        shift: function (num) {
            this.withCurrentStep(function (step) {
                step.hide();
            });
            this.setCurrentStep(this.currentStep + num);
            this.withCurrentStep(function (step) {
                step.show();
            });
        },

        next: function () {
            if (this.hasNext()) this.shift(+1);
            return this;
        },

        back: function () {
            if (this.hasBack()) this.shift(-1);
            return this;
        },

        hasNext: function () {
            return this.currentStep < (this.steps.length - 1);
        },

        hasBack: function () {
            return this.currentStep > 0;
        },

        close: function () {
            this.trigger('before:stop');
            this.withCurrentStep(function (step) {
                step.hide();
            });
            _(this.steps).each(function (step) {
                step.dispose();
            });
            if (_.device('smartphone')) this.container.remove().empty();
            this.trigger('stop');
            return this;
        },

        start: function () {

            if (_.device('smartphone')) {
                this.trigger('before:start');
                _(this.steps).invoke('show');
                this.container.appendTo('body');
                this.withCurrentStep(function (step) {
                    step.renderNavBar();
                });
                this.trigger('start');
            } else {
                this.withCurrentStep(function (step) {
                    this.trigger('before:start');
                    step.show();
                    this.trigger('start');
                });
            }

            // for debugging
            window.wizard = this;

            return this;
        },

        spotlight: function (selector) {
            if (!selector) return;
            var elem = $(selector + ':visible');
            if (!elem.length) return;
            var bounds = getBounds(elem);
            // apply positions (top, right, bottom, left)
            overlays[0].css({ width: bounds.left, right: 'auto' });
            overlays[1].css({ left: bounds.left, height: bounds.top, bottom: 'auto' });
            overlays[2].css({ left: bounds.left + bounds.width, top: bounds.top });
            overlays[3].css({ left: bounds.left, top: bounds.top + bounds.height, right: bounds.right });
            overlays[4].css(_(bounds).pick('top', 'right', 'bottom', 'left'));
            $('body').append(overlays);
        },

        toggleBackdrop: function (state) {
            $('body').append(backdrop.toggle(!!state));
        }
    });

    //
    // Wizard/Tour step
    //

    var Step = DisposableView.extend({

        className: 'wizard-step center middle',

        events: {
            'click [data-action]': 'onAction',
            'keydown': 'onKeyDown',
            'keyup': 'onKeyUp'
        },

        onAction: function (e) {
            e.preventDefault();
            var action = $(e.currentTarget).attr('data-action');
            this.trigger(action);
        },

        onKeyDown: function (e) {

            // focus trap; wizard/tour steps are generally modal (even if not visually)
            if (e.which !== 9 || !this.$el.is(':visible')) return;

            // get focusable items
            var items = this.$('[tabindex][tabindex!="-1"][disabled!="disabled"]:visible').andSelf(),
                first = e.shiftKey && document.activeElement === items.get(0),
                last = !e.shiftKey && document.activeElement === items.get(-1);

            if (first || last) {
                e.preventDefault();
                if (first) items.get(-1).focus(); else this.$el.focus();
            }
        },

        onKeyUp: function (e) {
            switch (e.which) {
                // check if "close" button exists
                case 27: if (this.$('.close').length) this.trigger('close'); break;
                // check if "back" button is enabled
                case 37: if (!this.$('.back').prop('disabled')) this.trigger('back'); break;
                // check if "next" button is enabled
                case 39: if (!this.$('.next').prop('disabled')) this.trigger('next'); break;
            }
        },

        initialize: function (options, parent) {

            this.parent = parent;

            this.options = _.extend({
                // general
                modal: true,
                focusWatcher: true,
                // buttons
                back: true,
                next: true,
                labelBack: gt('Back'),
                labelDone: gt('Done')
            }, options);

            // forward events
            this.on('all', function (type) {
                this.parent.trigger('step:' + type);
            });

            // navbar needs an update for every change
            // only once for normal popups
            if (!_.device('smartphone')) this.once('before:show', this.renderButtons);

            this.render();
        },

        // append to title element
        title: append('.title'),

        // append to content element
        content: append('.content'),

        // append to footer element
        footer: append('.footer'),

        // render scaffold
        render: function () {
            this.$el.attr({
                role: 'dialog',
                // as we have a focus trap (modal dialog) we use tabindex=1 in this case
                tabindex: 1,
                'aria-labelledby': 'dialog-title'
            })
            .append(
                $('<div class="header">').append(
                    $('<button class="close pull-right" tabindex="1">').append(
                        $('<span aria-hidden="true">&times;</span>'),
                        $('<span class="sr-only">').text(gt('Close'))
                    ),
                    $('<h4 class="title" id="dialog-title">')
                ),
                $('<div class="content" id="dialog-content">'),
                $('<div class="footer">')
            );
            return this;
        },

        // render buttons; must be done just before 'show'
        // not with inital render() because we don't all steps at this point
        renderButtons: function () {

            var o = this.options, footer = this.$('.footer').empty();

            if (o.back && this.parent.hasBack()) {
                // show "Back" button
                this.addButton(footer, { action: 'back', className: 'btn-default', label: this.getLabelBack() });
            }

            if (o.next && this.parent.hasNext()) {
                // show "Start" or Next" button
                this.addButton(footer, { action: 'next', className: 'btn-primary', label: this.getLabelNext() });
            } else if (this.isLast()) {
                // show "Done" button
                this.addButton(footer, { action: 'done', className: 'btn-primary', label: this.getLabelDone() });
            }
        },

        // different solution for smartphones
        renderNavBar: function () {

            var o = this.options,
                back = this.parent.container.find('.wizard-back').empty(),
                next = this.parent.container.find('.wizard-next').empty();

            if (o.back && this.parent.hasBack()) {
                // show "Back" button
                this.addLink(back, { action: 'back', label: this.getLabelBack() });
            }

            if (o.next && this.parent.hasNext()) {
                // show "Start" or Next" button
                this.addLink(next, { action: 'next', label: this.getLabelNext() });
            } else if (this.isLast()) {
                // show "Done" button
                this.addLink(next, { action: 'done', label: this.getLabelDone() });
            }
        },

        // internal; just add a button
        addButton: addControl('<button class="btn" tabindex="1">'),

        // internal; just add a link
        addLink: addControl('<a href="#" role="button" tabindex="1">'),

        getLabelNext: function () {
            // determine this button label at run-time
            // not during initialize() as the wizard is not yet complete
            if (this.options.labelNext === undefined) return this.isFirst() ? gt('Start tour') : gt('Next');
            return this.options.labelNext;
        },

        getLabelBack: function () {
            return this.options.labelBack;
        },

        getLabelDone: function () {
            return this.options.labelDone;
        },

        // define that this step is mandatory
        // removes the '.close' icon; escape key no longer works
        mandatory: function () {
            this.$('.header .close').remove();
            return this;
        },

        // enable/disable 'next' button
        toggleNext: function (state) {
            this.$('.btn.next').prop('disabled', !state);
            return this;
        },

        // enable/disable 'back' button
        toggleBack: function (state) {
            this.$('.btn.back').prop('disabled', !state);
            return this;
        },

        // returns true if the current step is the first one
        isFirst: function () {
            return this.parent.currentStep === 0;
        },

        // returns true if the current step is the last one
        isLast: function () {
            return this.parent.currentStep === this.parent.steps.length - 1;
        },

        // get current index of this step
        indexOf: function () {
            return _(this.parent.steps).indexOf(this);
        },

        // show this step
        // considers 'navigateTo' and 'waitFor' (both async)
        show: (function () {

            var counter = 0;

            function navigateTo() {
                ox.launch(this.options.navigateTo.id, this.options.navigateTo.options).done(waitFor.bind(this));
            }

            function waitFor() {
                if (!this.options.waitFor || $(this.options.waitFor).is(':visible')) return cont.call(this);
                counter++;
                if (counter < 50) {
                    setTimeout(waitFor.bind(this), 100);
                } else {
                    console.error('Step.show(). Stopped waiting for:', this.options.waitFor);
                    this.parent.close();
                }
            }

            function cont() {

                this.trigger('before:show');

                // make invisible and add to DOM to allow proper alignment
                this.$el.addClass('invisible').appendTo('body');

                // auto-align
                this.align();

                if (this.options.spotlight) {
                    // apply spotlight
                    this.parent.toggleBackdrop(false);
                    this.parent.spotlight(this.options.spotlight);
                    // respond to window resize
                    $(window).on('resize.wizard.spotlight', _.debounce(function () {
                        this.parent.spotlight(this.options.spotlight);
                    }.bind(this), 50));
                } else {
                    // toggle backdrop
                    this.parent.toggleBackdrop(this.options.modal);
                }

                // scroll?
                if (this.options.scrollIntoView) {
                    var scroll = $(this.options.scrollIntoView);
                    if (scroll.length) scroll.get(0).scrollIntoView();
                }

                // now, show and focus popup
                this.$el.removeClass('invisible').focus();

                // enable focus watcher?
                if (this.options.focusWatcher) {
                    this.focusWatcher = setInterval(function () {
                        if (!$.contains(this.el, document.activeElement)) this.$el.focus();
                    }.bind(this), 100);
                }

                this.trigger('show');
            }

            // no alignment, no spotlight, nothing to wait for
            function handleSmartphone() {
                this.trigger('before:show');
                this.$el
                    .css('left', this.indexOf() * 100 + '%')
                    .removeClass('center middle')
                    .appendTo(this.parent.container.find('.wizard-pages'));
                this.trigger('show');
                return this;
            }

            return function () {

                if (_.device('smartphone')) return handleSmartphone.call(this);

                this.parent.toggleBackdrop(true);

                if (this.options.navigateTo) navigateTo.call(this);
                else if (this.options.waitFor) waitFor.call(this);
                else cont.call(this);

                return this;
            };

        }()),

        // hide this step
        hide: function () {
            this.trigger('before:hide');
            if (!_.device('smartphone')) {
                if (this.focusWatcher) clearInterval(this.focusWatcher);
                $(window).off('resize.wizard.spotlight');
                this.$el.detach();
            }
            this.trigger('hide');
            return this;
        },

        // set one-time callback for 'before:show' event
        beforeShow: function (callback) {
            this.once('before:show', callback);
            return this;
        },

        // point at given element
        // defined by selector (string or DOM element)
        pointAt: function (selector) {
            this.options.pointAt = selector;
            return this;
        },

        // spotlight on given element
        // defined by selector (string or DOM element)
        spotlight: function (selector) {
            this.options.spotlight = selector;
            return this;
        },

        // show backdrop
        modal: function (state) {
            this.options.modal = !!state;
            return this;
        },

        // wait for element for be visible
        waitFor: function (selector) {
            this.options.waitFor = selector;
            return this;
        },

        // set 'navigateTo' option; defines which app to start
        navigateTo: function (id, options) {
            this.options.navigateTo = { id: id, options: options };
            return this;
        },

        // set 'scrollIntoView' option
        // this element will be scrolled into view when the step is shown
        scrollIntoView: function (selector) {
            this.options.scrollIntoView = selector;
            return this;
        },

        // auto-align popup (used internally)
        align: (function () {

            function set($el, key, value) {
                value = Math.max(16, value);
                $el.css(key, value);
            }

            return function (selector) {

                // if nothing is defined the step is centered
                selector = selector || this.options.pointAt || this.options.spotlight;
                if (!selector) return;

                // align automatically
                var elem = $(selector + ':visible');
                if (!elem.length) return;

                // remove default class and reset all inline positions
                this.$el.removeClass('center middle').css({ top: 'auto', right: 'auto', bottom: 'auto', left: 'auto' });

                var bounds = getBounds(elem), popupWidth = this.$el.width(), popupHeight = this.$el.height();

                if ((bounds.left + bounds.width + popupWidth) < bounds.availableWidth) {
                    // enough room to appear on the right side
                    set(this.$el, 'left', bounds.left + bounds.width + 16);
                    set(this.$el, 'top', bounds.top);
                } else if ((bounds.top + bounds.height + popupHeight) < bounds.availableHeight) {
                    // enough room to appear below
                    set(this.$el, 'top', bounds.top + bounds.height + 16);
                    set(this.$el, 'left', bounds.left);
                } else if ((bounds.left - popupWidth) > 0) {
                    // enough room to appear on the left side
                    set(this.$el, 'left', bounds.left - popupWidth - 16);
                    set(this.$el, 'top', bounds.top);
                } else {
                    // otherwise
                    this.$el.addClass('center middle');
                }

                // fix positions
                if ((bounds.left + popupWidth + 16) > bounds.availableWidth) this.$el.css('left', bounds.availableWidth - popupWidth - 16);
                if ((bounds.top + popupHeight + 16) > bounds.availableHeight) this.$el.css('top', bounds.availableHeight - popupHeight - 16);

                return this;
            };
        }()),

        // little helper to allow long chains while constructing a wizard or a tour
        end: function () {
            return this.parent;
        }
    });

    //
    // Tour registry (based on a Backbone collection)
    //

    Wizard.registry = {

        collection: new Backbone.Collection(),

        add: function (options, callback) {
            options.run = callback;
            var model = new Backbone.Model(options);
            this.collection.add(model);
            return model;
        },

        get: function (id) {
            return this.collection.get(id);
        },

        list: function (type) {
            return type === undefined ? this.collection : this.collection.where({ type: type });
        },

        run: function (id) {
            var model = this.get(id);
            if (model) model.get('run')();
        }
    };

    //
    // Special handling for smartphones
    //

    function initalizeSmartphoneSupport() {

        this.container = container.clone();
        this.container.find('.wizard-title').text(this.options.title || gt('Welcome'));

        this.container.on('tap', '[data-action]', { parent: this }, function (e) {
            e.preventDefault();
            var action = $(this).attr('data-action');
            e.data.parent.trigger('step:' + action);
        });

        // override shift for animation support
        this.shift = function (num) {

            this.setCurrentStep(this.currentStep + num);

            this.withCurrentStep(function (step) {
                step.renderNavBar();
            });

            var node = this.container.find('.wizard-pages'),
                current = node.position().left / width * 100,
                pct = 0 - this.currentStep * 100;

            node.stop().velocity({ translateX: [pct + '%', current + '%'] }, 500, [150, 15]);

            return this;
        };

        // touch/swipe support
        var self = this, offset = 0, pageX = 0, x, moved, width, minX, maxX;

        this.container.find('.wizard-pages').on({

            touchstart: function (e) {

                var touches = e.originalEvent.targetTouches;
                if (touches.length !== 1) return;
                pageX = touches[0].pageX;
                moved = false;

                // get current window width to calculate percentages
                width = $(window).width();
                offset = $(this).position().left;
                maxX = self.hasBack() ? +width : +width / 3;
                minX = self.hasNext() ? -width : -width / 3;
            },

            touchmove: function (e) {
                var touches = e.originalEvent.targetTouches;
                if (touches.length !== 1) return;
                e.preventDefault();
                x = touches[0].pageX - pageX;
                if (!moved) {
                    if (Math.abs(x) < 20) return;
                    moved = true;
                    // reset pageX to avoid bumps
                    pageX = touches[0].pageX;
                    x = 0;
                    return;
                }
                x = Math.min(x, maxX);
                x = Math.max(x, minX);
                $(this).css('transform', 'translateX(' + ((offset + x) / width * 100) + '%)');
            },

            touchend: function () {
                if (!moved) return;
                var pct = x / width * 100;
                self.shift(pct < 0 ? (pct > -50 ? 0 : +1) : (pct < +50 ? 0 : -1));
            }
        });
    }

    return Wizard;

});
