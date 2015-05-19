/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2015 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Mario Schroeder <mario.schroeder@open-xchange.com>
 */
define('io.ox/core/viewer/views/types/videoview',  [
    'io.ox/core/viewer/views/types/baseview',
    'gettext!io.ox/core'
], function (BaseView, gt) {

    'use strict';

    /**
     * The video file type. Implements the ViewerType interface.
     *
     * interface ViewerType {
     *    function render();
     *    function load();
     *    function unload();
     * }
     *
     */
    var VideoView = BaseView.extend({

        /**
         * Creates and renders the video slide.
         *
         * @returns {VideoView}
         *  the VideoView instance.
         */
        render: function () {
            var video = $('<video controls="true" class="viewer-displayer-item viewer-displayer-video player-hidden">'),
                previewUrl = this.getPreviewUrl() || '',
                contentType = this.model.get('file_mimetype') || '';

            // run own disposer function on dispose event from DisposableView
            this.on('dispose', this.disposeView.bind(this));

            // remove event listeners from video element before removing it from the DOM
            this.$el.find('video').off();
            this.$el.empty().append(
                video.append(
                    $('<div>').text(gt('Your browser does not support the video format of this file.'))
                )
            );

            // register play handler, use 'loadeddata' because 'canplay' is not always triggered on Firefox
            video.on({
                'loadeddata': this.onLoadedData.bind(this),
                'error': this.onError.bind(this)
            });

            video.attr({ 'data-src': _.unescapeHTML(previewUrl), type: contentType });

            return this;
        },

        /**
         * Video data load handler
         */
        onLoadedData: function () {
            this.$el.idle().find('.viewer-displayer-video').removeClass('player-hidden');
        },

        /**
         * Video load error handler
         */
        onError: function () {
            this.$el.idle().find('div.viewer-displayer-notification').remove();
            this.$el.append(
                this.createNotificationNode(gt('Your browser does not support the video format of this file.'))
            );
        },

        /**
         * "Prefetches" the video slide.
         * In order to save memory and network bandwidth videos are not prefetched.
         *
         * @returns {VideoView}
         *  the VideoView instance.
         */
        prefetch: function () {
            return this;
        },

        /**
         * "Shows" the video slide by transferring the video source from the 'data-src'
         *  to the 'src' attribute.
         *
         * @returns {VideoView}
         *  the VideoView instance.
         */
        show: function () {
            var video = this.$el.find('video');

            if ((video.length > 0)) {
                this.$el.busy().find('div.viewer-displayer-notification').remove();
                video.attr('src', video.attr('data-src'));
                video[0].load(); // reset and start selecting and loading a new media resource from scratch
            }

            return this;
        },

        /**
         * "Unloads" the video slide by removing the src attribute from
         * the video element and calling load() again.
         *
         * @returns {VideoView}
         *  the VideoView instance.
         */
        unload: function () {
            // never unload slide duplicates
            if (this.$el.hasClass('swiper-slide-duplicate')) {
                return this;
            }
            var video = this.$el.find('video');
            if (video.length > 0) {
                this.$el.find('.viewer-displayer-video').addClass('player-hidden');
                video[0].pause();
                // work around for Chrome bug #234779, HTML5 video request stay pending (forever)
                // https://code.google.com/p/chromium/issues/detail?id=234779
                video.removeAttr('src');
                video[0].load();
            }

            return this;
        },

        /**
         * Destructor function of this view.
         */
        disposeView: function () {
            // remove event listeners from video element
            this.$el.find('video').off();
        }

    });

    // returns an object which inherits BaseView
    return VideoView;
});
