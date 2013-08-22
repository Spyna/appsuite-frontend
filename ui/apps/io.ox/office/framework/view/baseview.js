/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2012
 * Mail: info@open-xchange.com
 *
 * @author Daniel Rentz <daniel.rentz@open-xchange.com>
 */

define('io.ox/office/framework/view/baseview',
    ['io.ox/core/event',
     'io.ox/office/tk/utils',
     'io.ox/office/tk/keycodes',
     'io.ox/office/framework/view/pane',
     'gettext!io.ox/office/main',
     'io.ox/office/framework/view/nodetracking',
     'less!io.ox/office/framework/view/basestyle.less',
     'less!io.ox/office/framework/view/docs-icons.less'
    ], function (Events, Utils, KeyCodes, Pane, gt) {

    'use strict';

    var // the global root element used to store DOM elements temporarily
        tempStorageNode = $('<div>', { id: 'io-ox-office-temp' }).appendTo('body');

    // global functions =======================================================

    /**
     * Converts the passed number or object to a complete margin descriptor
     * with the properties 'left', 'right', 'top', and 'bottom'.
     *
     * @param {Number|Object} margin
     *  The margins, as number (for all margins) or as object with the optional
     *  properties 'left', 'right', 'top', and 'bottom'. Missing properties
     *  default to the value zero.
     *
     * @returns {Object}
     *  The margins (in pixels), in the properties 'left', 'right', 'top', and
     *  'bottom'.
     */
    function getMarginFromValue(margin) {

        if (_.isObject(margin)) {
            return _({ left: 0, right: 0, top: 0, bottom: 0 }).extend(margin);
        }

        if (!_.isNumber(margin)) {
            margin = 0;
        }
        return { left: margin, right: margin, top: margin, bottom: margin };
    }

    // class BaseView =========================================================

    /**
     * Base class for the view instance of an office application. Creates the
     * application window, and provides functionality to create and control the
     * top, bottom, and side pane elements.
     *
     * Triggers the following events:
     * - 'refresh:layout': After this view instance has refreshed the layout of
     *      all registered view panes. This event will be triggered after
     *      inserting new view panes into this view, or content nodes into the
     *      application pane, after showing/hiding view panes, while and after
     *      the browser window is resized, and when the method
     *      BaseView.refreshPaneLayout() has been called manually.
     *
     * @constructor
     *
     * @extends Events
     *
     * @param {BaseApplication} app
     *  The application containing this view instance.
     *
     * @param {Object} [options]
     *  Additional options to control the appearance of the view. The following
     *  options are supported:
     *  @param {Function} [options.initHandler]
     *      A callback handler function called to initialize the contents of
     *      this view instance after construction.
     *  @param {Function} [options.deferredInitHandler]
     *      A callback handler function called to initialize more contents of
     *      this view instance, after the document has been imported.
     *  @param {Function} [options.grabFocusHandler]
     *      A function that has to implement moving the browser focus somewhere
     *      into the application pane. Used in the method BaseView.grabFocus()
     *      of this class. If omitted, the application pane itself will be
     *      focused.
     *  @param {Boolean} [options.contentFocusable=false]
     *      If set to true, the container node for the document contents will
     *      be focusable and will be registered for global focus traversal with
     *      the F6 key.
     *  @param {Boolean} [options.contentScrollable=false]
     *      If set to true, the container node for the document contents will
     *      be scrollable. By default, the size of the container node is locked
     *      and synchronized with the size of the application pane (with regard
     *      to content margins, see the option 'options.contentMargin' for
     *      details).
     *  @param {Number|Object} [options.contentMargin=0]
     *      The margins between the fixed application pane and the embedded
     *      application container node, in pixels. If set to a number, all
     *      margins will be set to the specified value. Otherwise, an object
     *      with the optional properties 'left', 'right', 'top', and 'bottom'
     *      for specific margins for each border. Missing properties default to
     *      the value zero. The content margin can also be modified at runtime
     *      with the method BaseView.setContentMargin().
     *  @param {Number|Object} [options.overlayMargin=0]
     *      The margins between the overlay panes and the inner borders of the
     *      application pane, in pixels. If set to a number, all margins will
     *      be set to the specified value. Otherwise, an object with the
     *      optional properties 'left', 'right', 'top', and 'bottom' for
     *      specific margins for each border. Missing properties default to the
     *      value zero.
     */
    function BaseView(app, options) {

        var // self reference
            self = this,

            // CSS classes to be added at the window root node
            windowNodeClasses = 'io-ox-office-main ' + app.getName().replace(/[.\/]/g, '-') + '-main',

            // moves the browser focus into a node of the application pane
            grabFocusHandler = Utils.getFunctionOption(options, 'grabFocusHandler'),

            // centered application pane
            appPane = null,

            // root container node for invisible document contents
            hiddenRootNode = $('<div>').addClass('abs app-hidden-root'),

            // root container node for visible document contents (may be scrollable)
            contentRootNode = $('<div>').addClass('abs app-content-root'),

            // container node for application contents
            appContentNode = $('<div>').addClass('app-content').appendTo(contentRootNode),

            // busy node for the application pane
            appBusyNode = $('<div>').addClass('abs app-busy'),

            // all fixed view panes, in insertion order
            fixedPanes = [],

            // all overlay view panes, in insertion order
            overlayPanes = [],

            // inner shadows for application pane
            shadowNodes = {},

            // whether refreshing the pane layout is currently locked
            layoutLocks = 0,

            // alert banner currently shown
            currentAlert = null,

            // the temporary container for all nodes while application is hidden
            tempNode = $('<div>').addClass(windowNodeClasses).appendTo(tempStorageNode),

            // margins of overlay panes to the borders of the application pane
            overlayMargin = getMarginFromValue(Utils.getOption(options, 'overlayMargin', 0)),

            // whether the content root node is focusable by itself
            contentFocusable = Utils.getBooleanOption(options, 'contentFocusable', false),

            // whether the application is hidden explicitly
            viewHidden = false;

        // base constructor ---------------------------------------------------

        // add event hub
        Events.extend(this);

        // private methods ----------------------------------------------------

        /**
         * Adjusts the positions of all view pane nodes.
         */
        function refreshPaneLayout() {

            var // the root node of the application pane
                appPaneNode = appPane.getNode(),
                // current offsets representing available space in the application window
                offsets = { top: 0, bottom: 0, left: 0, right: 0 },
                // margin for the alert banner, to keep a maximum width
                alertMargin = 0;

            function updatePane(pane) {

                var paneNode = pane.getNode(),
                    visible = pane.isVisible(),
                    transparent = pane.isTransparent(),
                    position = pane.getPosition(),
                    vertical = Utils.isVerticalPosition(position),
                    leading = Utils.isLeadingPosition(position),
                    sizeFunc = _.bind(vertical ? paneNode.outerHeight : paneNode.outerWidth, paneNode),
                    sizeAttr = vertical ? 'height' : 'width',
                    paneOffsets = _.clone(offsets);

                // remove the position attribute at the opposite border of the pane position
                paneOffsets[vertical ? (leading ? 'bottom' : 'top') : (leading ? 'right' : 'left')] = '';

                // transparent overlay panes: temporarily set to auto size, adjust position of trailing panes
                if (visible && transparent) {
                    paneNode.css(sizeAttr, 'auto');
                    if (!leading) {
                        paneOffsets[position] += sizeFunc();
                    }
                }

                // set pane position, adjust global offsets
                paneNode.css(paneOffsets);
                if (visible) {
                    offsets[position] += sizeFunc();
                }

                // transparent overlay panes: set zero size
                if (visible && transparent) {
                    paneNode.css(sizeAttr, 0);
                }
            }

            // do nothing if refreshing is currently locked, or the window is hidden, or import still running
            if ((layoutLocks > 0) || !self.isVisible() || !app.isImportFinished()) { return; }

            // update fixed view panes
            _(fixedPanes).each(updatePane);

            // update the application pane and the shadow nodes (jQuery interprets numbers as pixels automatically)
            appPaneNode.css(offsets);
            shadowNodes.top.css({ top: offsets.top - 10, height: 10, left: offsets.left, right: offsets.right });
            shadowNodes.bottom.css({ bottom: offsets.bottom - 10, height: 10, left: offsets.left, right: offsets.right });
            shadowNodes.left.css({ top: offsets.top, bottom: offsets.bottom, left: offsets.left - 10, width: 10 });
            shadowNodes.right.css({ top: offsets.top, bottom: offsets.bottom, right: offsets.right - 10, width: 10 });

            // skip margins for overlay panes
            _(offsets).each(function (offset, pos) { offsets[pos] += overlayMargin[pos]; });

            // update alert banner
            if (_.isObject(currentAlert)) {
                if (app.getWindowNode().width() <= 640) {
                    alertMargin = Math.max((app.getWindowNode().width() - 500) / 2, 10);
                    // TODO: get size of existing overlay panes at top border
                    currentAlert.css({ top: offsets.top + 56, left: alertMargin, right: alertMargin });
                } else {
                    alertMargin = Math.max((appPaneNode.width() - 500) / 2, 10);
                    currentAlert.css({ top: offsets.top + 10, left: offsets.left + alertMargin, right: offsets.right + alertMargin });
                }
            }

            // update overlay view panes
            _(overlayPanes).each(updatePane);

            // notify listeners
            self.trigger('refresh:layout');
        }

        /**
         * Updates the view after the application becomes active/visible.
         */
        function windowShowHandler() {

            // do not show the window contents if view is still hidden explicitly
            if (viewHidden || (tempNode.children().length === 0)) { return; }

            // move all application nodes from temporary storage into view
            app.getWindowNode().append(tempNode.children());
            refreshPaneLayout();

            // do not update GUI and grab focus while document is still being imported
            if (app.isImportFinished()) {
                app.getController().update();
                self.grabFocus();
            }
        }

        /**
         * Updates the view after the application becomes inactive/hidden.
         */
        function windowHideHandler() {
            // move all application nodes from view to temporary storage
            if (tempNode.children().length === 0) {
                tempNode.append(app.getWindowNode().children());
            }
        }

        // methods ------------------------------------------------------------

        /**
         * Moves the browser focus into the application pane. Calls the
         * handler function passed to the constructor of this instance.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.grabFocus = function () {
            if (_.isFunction(grabFocusHandler)) {
                grabFocusHandler.call(this);
            } else if (contentFocusable) {
                contentRootNode.focus();
            } else {
                this.getAppPaneNode().find('[tabindex]').first().focus();
            }
            return this;
        };

        /**
         * Returns whether the contents of the view are currently visible.
         *
         * @returns {Boolean}
         *  Whether the application is active, and the view has not been hidden
         *  manually.
         */
        this.isVisible = function () {
            return !viewHidden && app.getWindow().state.visible;
        };

        /**
         * Hides all contents of the application window and moves them to the
         * internal temporary DOM storage node.
         *
         * @return {BaseView}
         *  A reference to this instance.
         */
        this.hide = function () {
            viewHidden = true;
            windowHideHandler();
            return this;
        };

        /**
         * Shows all contents of the application window, if the application
         * itself is currently active. Otherwise, the contents will be shown
         * when the application becomes visible.
         *
         * @return {BaseView}
         *  A reference to this instance.
         */
        this.show = function () {
            viewHidden = false;
            windowShowHandler();
            return this;
        };

        /**
         * Returns the DOM node of the application pane (the complete inner
         * area between all existing view panes). Note that this is NOT the
         * container node where applications insert their own contents. The
         * method BaseView.insertContentNode() is intended to be used to insert
         * own contents into the application pane.
         *
         * @returns {jQuery}
         *  The DOM node of the application pane.
         */
        this.getAppPaneNode = function () {
            return appPane.getNode();
        };

        /**
         * Sets the application into the busy state by displaying a window
         * blocker element covering the application pane. All other view panes
         * (also the overlay panes covering the blocked application pane)
         * remain available.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.appPaneBusy = function () {
            appBusyNode.show().busy();
            return this;
        };

        /**
         * Leaves the busy state from the application pane that has been
         * entered by the method BaseView.appPaneBusy().
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.appPaneIdle = function () {
            appBusyNode.idle().hide();
            return this;
        };

        /**
         * Detaches the document contents in the application pane from the DOM.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.detachAppPane = function () {
            appContentNode.detach();
            return this;
        };

        /**
         * Attaches the document contents in the application pane to the DOM.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.attachAppPane = function () {
            contentRootNode.append(appContentNode);
            return this;
        };

        /**
         * Returns the root container node for the application contents. Note
         * that this is NOT the direct parent node where applications insert
         * their own contents, but the (optionally scrollable) root node
         * containing the target container node for document contents. The
         * method BaseView.insertContentNode() is intended to be used to insert
         * own contents into the application pane.
         *
         * @returns {jQuery}
         *  The DOM root node for visible document contents.
         */
        this.getContentRootNode = function () {
            return contentRootNode;
        };

        /**
         * Returns the current margins between the fixed application pane and
         * the embedded application container node.
         *
         * @returns {Object}
         *  The margins between the fixed application pane and the embedded
         *  application container node (in pixels), in the properties 'left',
         *  'right', 'top', and 'bottom'.
         */
        this.getContentMargin = function () {
            return {
                left: Utils.convertCssLength(appContentNode.css('margin-left'), 'px', 1),
                right: Utils.convertCssLength(appContentNode.css('margin-right'), 'px', 1),
                top: Utils.convertCssLength(appContentNode.css('margin-top'), 'px', 1),
                bottom: Utils.convertCssLength(appContentNode.css('margin-bottom'), 'px', 1)
            };
        };

        /**
         * Changes the margin between the fixed application pane and the
         * embedded application container node.
         *
         * @param {Number|Object} margin
         *  The margins between the fixed application pane and the embedded
         *  application container node, in pixels. If set to a number, all
         *  margins will be set to the specified value. Otherwise, an object
         *  with the optional properties 'left', 'right', 'top', and 'bottom'
         *  for specific margins for each border. Missing properties default to
         *  the value zero.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.setContentMargin = function (margin) {
            margin = getMarginFromValue(margin);
            appContentNode.css('margin', margin.top + 'px ' + margin.right + 'px ' + margin.bottom + 'px ' + margin.left + 'px');
            return this;
        };

        /**
         * Inserts new DOM nodes into the container node of the application
         * pane.
         *
         * @param {HTMLElement|jQuery} contentNode
         *  The DOM node(s) to be inserted into the application pane. If this
         *  object is a jQuery collection, inserts all contained DOM nodes into
         *  the application pane.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.insertContentNode = function (contentNode) {
            appContentNode.append(contentNode);
            return this.refreshPaneLayout();
        };

        /**
         * Removes all DOM nodes from the container node of the application
         * pane.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.removeAllContentNodes = function () {
            appContentNode.empty();
            return this.refreshPaneLayout();
        };

        /**
         * Returns the root container node for hidden application contents.
         *
         * @returns {jQuery}
         *  The DOM root node for hidden document contents.
         */
        this.getHiddenRootNode = function () {
            return hiddenRootNode;
        };

        /**
         * Inserts new DOM nodes into the hidden container node of the
         * application pane.
         *
         * @param {HTMLElement|jQuery} hiddenNode
         *  The DOM node(s) to be inserted into the hidden container of the
         *  application pane. If this object is a jQuery collection, inserts
         *  all contained DOM nodes into the application pane.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.insertHiddenNode = function (hiddenNode) {
            hiddenRootNode.append(hiddenNode);
            return this;
        };

        /**
         * Inserts new DOM nodes into the private storage container. The nodes
         * will not be visible but will be part of the living DOM, thus it will
         * be possible to access and modify the geometry of the nodes.
         *
         * @param {HTMLElement|jQuery}
         *  The DOM node(s) to be inserted into the private storage container.
         *  If this object is a jQuery collection, inserts all contained DOM
         *  nodes into the container.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.insertTemporaryNode = function (node) {
            tempStorageNode.append(node);
            return this;
        };

        /**
         * Adds the passed view pane instance into this view.
         *
         * @param {Pane} pane
         *  The view pane instance to be inserted into this view.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.addPane = function (pane) {

            // insert the pane
            (pane.isOverlay() ? overlayPanes : fixedPanes).push(pane);
            app.getWindowNode().append(pane.getNode());

            // refresh pane layout when the pane or its contents are changed
            pane.on('pane:show pane:resize pane:layout', refreshPaneLayout);
            refreshPaneLayout();

            return this;
        };

        /**
         * Adjusts the positions of all view pane nodes, and the current alert
         * banner.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.refreshPaneLayout = function () {
            refreshPaneLayout();
            return this;
        };

        /**
         * Prevents refreshing the pane layout while the specified callback
         * function is running. After the callback function has finished, the
         * pane layout will be adjusted once by calling the method
         * BaseApplication.refreshPaneLayout().
         *
         * @param {Function} callback
         *  The callback function that will be executed synchronously while
         *  refreshing the pane layout is locked.
         *
         * @param {Object} [context]
         *  The context bound to the callback function.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.lockPaneLayout = function (callback, context) {
            layoutLocks += 1;
            callback.call(context);
            layoutLocks -= 1;
            refreshPaneLayout();
            return this;
        };

        /**
         * Sets the application into the busy state by displaying a window
         * blocker element covering the entire GUI of the application. The
         * contents of the header and footer in the blocker element are
         * cleared, and the passed initialization callback function may insert
         * new contents into these elements.
         *
         * @param {Object} [options]
         *  A map with additional options. The following options are supported:
         *  @param {Boolean} [options.showFileName=false]
         *      If set to true, the file name will be shown in the top-left
         *      corner of the blocker element.
         *  @param {Function} [options.initHandler]
         *      A function that can fill custom contents into the header and
         *      footer of the window blocker element. Receives the following
         *      parameters:
         *      (1) {jQuery} header
         *          The header element above the centered progress bar.
         *      (2) {jQuery} footer
         *          The footer element below the centered progress bar.
         *      (3) {jQuery} blocker
         *          The entire window blocker element (containing the header,
         *          footer, and progress bar elements).
         *      Will be called in the context of this view instance.
         *  @param {Function} [options.cancelHandler]
         *      If specified, a 'Cancel' button will be shown after a short
         *      delay. Pressing that button, or pressing the ESCAPE key, will
         *      execute this callback function, and will leave the busy mode
         *      afterwards. Will be called in the context of this view
         *      instance.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.enterBusy = function (options) {

            // enter busy state, and extend the blocker element
            app.getWindow().busy(null, null, function () {

                var // the initialization handler
                    initHandler = Utils.getFunctionOption(options, 'initHandler'),
                    // the cancel handler
                    cancelHandler = Utils.getFunctionOption(options, 'cancelHandler'),
                    // the window blocker element (bound to 'this')
                    blockerNode = this,
                    // the header container node
                    headerNode = blockerNode.find('.header').empty(),
                    // the footer container node
                    footerNode = blockerNode.find('.footer').empty(),
                    // the container element with the button to cancel the busy mode
                    cancelNode = null;

                // keyboard event handler for busy mode (ESCAPE key)
                function busyKeydownHandler(event) {
                    if (event.keyCode === KeyCodes.ESCAPE) {
                        cancelHandler.call(self);
                        return false;
                    }
                }

                // special marker for custom CSS formatting, clear header/footer
                blockerNode.addClass('io-ox-office-blocker');

                // add file name to header area
                if (Utils.getBooleanOption(options, 'showFileName', false)) {
                    headerNode.append($('<div>').addClass('filename clear-title').text(_.noI18n(app.getFullFileName())));
                }

                // initialize 'Cancel' button (hide initially, show after a delay)
                if (_.isFunction(cancelHandler)) {

                    // create and insert the container node for the Cancel button
                    cancelNode = $('<div>').addClass('cancel-node').hide().appendTo(footerNode);

                    // create the Cancel button
                    $.button({ label: gt('Cancel') })
                        .addClass('btn-warning')
                        .on('click', function () { cancelHandler.call(self); })
                        .appendTo(cancelNode);

                    // register a keyboard handler for the ESCAPE key
                    app.getWindowNode().on('keydown', busyKeydownHandler);
                    app.getWindow().one('idle', function () {
                        app.getWindowNode().off('keydown', busyKeydownHandler);
                    });

                    // make the blocker focusable for keyboard input
                    blockerNode.attr('tabindex', 0).focus();

                    // show the Cancel button after a delay
                    _.delay(function () { cancelNode.show().find('.btn').focus(); }, 5000);
                }

                // execute initialization handler
                if (_.isFunction(initHandler)) {
                    initHandler.call(self, headerNode, footerNode, blockerNode);
                }

            });

            return this;
        };

        /**
         * Leaves the busy state of the application. Hides the window blocker
         * element covering the entire GUI of the application.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.leaveBusy = function () {
            app.getWindow().idle();
            this.grabFocus();
            return this;
        };

        /**
         * Returns whether an alert banner is currently visible.
         *
         * @returns {Boolean}
         *  Whether an alert banner is visible.
         */
        this.hasAlert = function () {
            return _.isObject(currentAlert);
        };

        /**
         * Shows an alert banner at the top of the application window. An alert
         * currently shown will be removed before.
         *
         * @param {String} title
         *  The alert title.
         *
         * @param {String} message
         *  The alert message text.
         *
         * @param {String} type
         *  The type of the alert banner. Supported values are 'error',
         *  'warning', and 'success'.
         *
         * @param {Object} [options]
         *  A map with additional options controlling the appearance and
         *  behavior of the alert banner. The following options are supported:
         *  @param {Boolean} [options.closeable=false]
         *      If set to true, the alert banner can be closed with a close
         *      button shown in the top-right corner of the banner.
         *  @param {Number} [options.timeout=5000]
         *      Can be specified together with 'options.closeable'. Specifies
         *      the number of milliseconds until the alert banner will vanish
         *      automatically. If not specified, the default of five seconds is
         *      used. The value 0 will show a closeable alert banner that will
         *      not vanish automatically.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.showAlert = function (title, message, type, options) {

            var // whether the alert is closeable manually
                closeable = Utils.getBooleanOption(options, 'closeable', false),
                // auto-close timeout delay
                delay = Utils.getIntegerOption(options, 'timeout', 5000, 0),
                // create a new alert node
                alert = $('<div>')
                    .addClass('alert alert-' + type)
                    .append($('<h4>').text(title), $('<p>').text(message))
                    .data('pane-pos', 'top');

            // Hides the alert with a specific animation.
            function closeAlert() {
                currentAlert = null;
                alert.off('click').stop(true).fadeOut(function () { alert.remove(); });
            }

            // remove the alert banner currently shown, store reference to new alert
            if (currentAlert) { currentAlert.stop(true).remove(); }
            currentAlert = alert;

            // make the alert banner closeable
            if (closeable) {
                // add closer symbol
                alert.prepend($('<a>', { href: '#' }).text(_.noI18n('\xd7')).addClass('close').attr('tabindex', 0))
                    .css('cursor', 'pointer')
                    // alert can be closed by clicking anywhere in the banner
                    .on('click', closeAlert);
                // initialize auto-close
                if (delay > 0) {
                    alert.delay(delay).fadeOut(function () {
                        currentAlert = null;
                        alert.remove();
                    });
                }
            }

            // return focus to application pane when alert has been clicked (also if not closeable)
            alert.on('click', function () { self.grabFocus(); });

            // if the alert is closeable without timeout, or contains a button,
            // add it to the global F6 focus traveling chain
            if (closeable && (delay === 0)) {
                alert.addClass('f6-target');
            }

            // insert and show the new alert banner
            app.getWindowNode().append(alert);
            refreshPaneLayout();

            return this;
        };

        /**
         * Shows an error alert banner at the top of the application window. An
         * alert currently shown will be removed before.
         *
         * @param {String} title
         *  The alert title.
         *
         * @param {String} message
         *  The alert message text.
         *
         * @param {Object} [options]
         *  A map with additional options controlling the appearance and
         *  behavior of the alert banner. See method Alert.showAlert() for
         *  details.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.showError = function (title, message, options) {
            return this.showAlert(title, message, 'error', options);
        };

        /**
         * Shows a warning alert banner at the top of the application window.
         * An alert currently shown will be removed before.
         *
         * @param {String} title
         *  The alert title.
         *
         * @param {String} message
         *  The alert message text.
         *
         * @param {Object} [options]
         *  A map with additional options controlling the appearance and
         *  behavior of the alert banner. See method Alert.showAlert() for
         *  details.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.showWarning = function (title, message, options) {
            return this.showAlert(title, message, 'warning', options);
        };

        /**
         * Shows a success alert banner at the top of the application window.
         * An alert currently shown will be removed before.
         *
         * @param {String} title
         *  The alert title.
         *
         * @param {String} message
         *  The alert message text.
         *
         * @param {Object} [options]
         *  A map with additional options controlling the appearance and
         *  behavior of the alert banner. See method Alert.showAlert() for
         *  details.
         *
         * @returns {BaseView}
         *  A reference to this instance.
         */
        this.showSuccess = function (title, message, options) {
            return this.showAlert(title, message, 'success', options);
        };

        this.destroy = function () {
            this.events.destroy();
            _(fixedPanes).invoke('destroy');
            _(overlayPanes).invoke('destroy');
            appPane.destroy();
            tempNode.remove();
            appPane = fixedPanes = overlayPanes = tempNode = null;
        };

        // initialization -----------------------------------------------------

        // create the application pane, and insert the container nodes
        appPane = new Pane(app, { classes: 'app-pane', enableContextMenu: true });
        appPane.getNode().append(hiddenRootNode, contentRootNode, appBusyNode.hide());

        // add the main application pane to the application window
        app.getWindowNode().addClass(windowNodeClasses).append(appPane.getNode());

        // add shadow nodes above application pane, but below other panes
        _(['top', 'bottom', 'left', 'right']).each(function (border) {
            app.getWindowNode().append(shadowNodes[border] = $('<div>').addClass('app-pane-shadow'));
        });

        // initialize content node from passed options
        contentRootNode.toggleClass('scrolling', Utils.getBooleanOption(options, 'contentScrollable', false));
        this.setContentMargin(Utils.getOption(options, 'contentMargin', 0));

        // make the content root node focusable for global navigation with F6 key
        if (contentFocusable) {
            contentRootNode.addClass('f6-target').attr('tabindex', 0);
        }

        // listen to browser window resize events when the application window is visible
        app.registerWindowResizeHandler(refreshPaneLayout);

        // keep application in DOM while application is hidden, applications
        // may want to access element geometry in background tasks
        app.getWindow().on({ show: windowShowHandler, hide: windowHideHandler });

        // after construction, call initialization handler
        app.on('docs:init', function () {
            self.lockPaneLayout(function () {
                Utils.getFunctionOption(options, 'initHandler', $.noop).call(self);
            });
        });

        // after import, call deferred initialization handler, and update view and controller
        app.on('docs:import:after', function () {
            self.lockPaneLayout(function () {
                Utils.getFunctionOption(options, 'deferredInitHandler', $.noop).call(self);
            });
            windowShowHandler();
        });

        // safely destroy all image nodes
        app.getWindow().on('quit', function () {
            app.destroyImageNodes(app.getWindowNode().find('img'));
        });

    } // class BaseView

    // exports ================================================================

    return _.makeExtendable(BaseView);

});
