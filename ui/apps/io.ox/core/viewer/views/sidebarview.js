/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Edy Haryono <edy.haryono@open-xchange.com>
 * @author Mario Schroeder <mario.schroeder@open-xchange.com>
 */
define('io.ox/core/viewer/views/sidebarview', [
    'io.ox/backbone/disposable',
    'io.ox/core/viewer/util',
    'io.ox/files/api',
    'io.ox/core/dropzone',
    'io.ox/core/viewer/views/sidebar/fileinfoview',
    'io.ox/core/viewer/views/sidebar/filedescriptionview',
    'io.ox/core/viewer/views/sidebar/fileversionsview',
    'io.ox/core/viewer/views/sidebar/uploadnewversionview',
    'gettext!io.ox/core/viewer'
], function (DisposableView, Util, FilesAPI, Dropzone, FileInfoView, FileDescriptionView, FileVersionsView, UploadNewVersionView, gt) {

    'use strict';

    /**
     * notifications lazy load
     */
    function notify () {
        var self = this, args = arguments;
        require(['io.ox/core/notifications'], function (notifications) {
            notifications.yell.apply(self, args);
        });
    }

    /**
     * The SidebarView is responsible for displaying the detail side bar.
     * This includes sections for file meta information, file description
     * and version history.
     * Triggers 'viewer:sidebar:change:state' event when thr sidebar opens / closes.
     */
    var SidebarView = DisposableView.extend({

        className: 'viewer-sidebar',

        // the visible state of the side bar, hidden per default.
        opened: false,

        initialize: function (options) {
            _.extend(this, {
                mainEvents: options.mainEvents || _.extend({}, Backbone.Events)
            });
            this.model = null;
            this.zone = null;
            // listen to slide change and set fresh model
            this.listenTo(this.mainEvents, 'viewer:displayeditem:change', this.setModel);

            this.on('dispose', this.disposeView.bind(this));
        },

        /**
         * Toggles the side bar depending on the state.
         *  A state of 'true' opens the panel, 'false' closes the panel and
         *  'undefined' toggles the side bar.
         *
         * @param {Boolean} [state].
         *  The panel state.
         */
        toggleSidebar: function (state) {
            // determine current state if undefined
            this.opened = _.isUndefined(state) ? !this.opened : Boolean(state);
            this.$el.toggleClass('opened', this.opened);
            this.mainEvents.trigger('viewer:sidebar:change:state', this.opened);
            this.renderSections();
        },

        /**
         * Sets a new model and renders the sections accordingly.
         *
         * @param {FilesAPI.Model} model.
         *  The new model.
         */
        setModel: function (model) {
            this.model = model || null;
            this.renderSections();
        },

        /**
         * Renders the sections for file meta information, file description
         * and version history.
         */
        renderSections: function () {
            // remove previous sections
            this.$el.empty();
            // remove dropzone handler
            if (this.zone) {
                this.zone.off();
                this.zone = null;
            }
            // render sections only if side bar is open
            if (!this.model || !this.opened) {
                return;
            }
            // load file details
            this.loadFileDetails();
            // add dropzone for drive files
            if (this.model.isFile()) {
                this.zone = new Dropzone.Inplace({
                    caption: gt('Drop new version here')
                });
                // drop handler
                this.zone.on('drop', this.onNewVersionDropped.bind(this));
                this.$el.append(this.zone.render().$el.addClass('abs'));
            }
            // render sections
            this.$el.append(
                new FileInfoView({ model: this.model }).render().el,
                new FileDescriptionView({ model: this.model }).render().el,
                new UploadNewVersionView({ model: this.model }).render().el,
                new FileVersionsView({ model: this.model }).render().el
            );
        },

        /**
         * Renders the sidebar container.
         *
         * @param {FilesAPI.Model} model.
         *  The initial model.
         */
        render: function (model) {
            // a11y
            this.$el.attr({ tabindex: -1, role: 'complementary' }); // TODO: check if we need to set role 'tablist' now instead
            // set device type
            Util.setDeviceClass(this.$el);
            // attach the touch handlers
            if (this.$el.enableTouch) {
                this.$el.enableTouch({ selector: null, horSwipeHandler: this.onHorizontalSwipe });
            }
            // initially set model
            this.model = model;
            return this;
        },

        /**
         * Loads the file details, especially needed for the file description
         * and the number of versions.
         */
        loadFileDetails: function () {
            if (!this.model) {
                return;
            }

            FilesAPI.get(this.model.toJSON())
            .done(function (file) {
                // after loading the file details we set at least an empty string as description.
                // in order to distinguish between 'the file details have been loaded but the file has no description'
                // and 'the file details have not been loaded yet so we don't know if it has a description'.
                if (this.model && this.model.isFile()) {
                    var description = (file && _.isString(file.description)) ? file.description : '';
                    this.model.set('description', description);
                }
            }.bind(this));
        },

        /**
         * Handles new version drop.
         *
         * @param {Array} files.
         *  An array of File objects.
         */
        onNewVersionDropped: function (files) {
            // check for single item drop
            if (!_.isArray(files) || files.length !== 1) {
                notify({ error: gt('Drop only a single file as new version.') });
                return;
            }

            FilesAPI.versions.upload({
                file: _.first(files),
                id: this.model.get('id'),
                folder: this.model.get('folder_id'),
                version_comment: ''
            })
            .fail(notify);
        },

        /**
         * Handles horizontal swipe events.
         *
         * @param {String} phase
         *  The current swipe phase (swipeStrictMode is true, so we only get the 'end' phase)
         *
         * @param {jQuery.Event} event
         *  The jQuery tracking event.
         *
         * @param {Number} distance
         *  The swipe distance in pixel, the sign determines the swipe direction (left to right or right to left)
         *
         */
        onHorizontalSwipe: function (phase, event, distance) {
            //console.info('SidebarView.onHorizontalSwipe()', 'event phase:', phase, 'distance:', distance);

            if (distance > 0) {
                this.toggleSidebar();
            }
        },

        /**
         * Destructor function of this view.
         */
        disposeView: function () {
            this.$el.disableTouch();
            if (this.zone) {
                this.zone.off();
                this.zone = null;
            }
            this.model = null;
        }
    });

    return SidebarView;
});
