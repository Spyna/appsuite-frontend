/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2016 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Edy Haryono <edy.haryono@open-xchange.com>
 * @author Mario Schroeder <mario.schroeder@open-xchange.com>
 */
define('io.ox/core/viewer/views/types/imageview', [
    'io.ox/core/viewer/views/types/baseview',
    'gettext!io.ox/core'
], function (BaseView, gt) {

    'use strict';

    /**
     * The image file type. Implements the ViewerType interface.
     *
     * interface ViewerType {
     *    function render();
     *    function load();
     *    function unload();
     * }
     *
     */
    var ImageView =  BaseView.extend({

        initialize: function () {
            this.isPrefetched = false;
        },

        /**
         * Creates and renders the image slide.
         *
         * @returns {ImageView}
         *  the ImageView instance.
         */
        render: function () {

            // since this node is not yet part of the DOM we look
            // for the carousel's dimensions directly
            var retina = _.device('retina'),
                RETINA_FACTOR = 2,
                carousel = $('.viewer-displayer:visible'),
                // on retina screen request larger previews to render sharp images
                width = retina ? carousel.width() * RETINA_FACTOR : carousel.width(),
                height = retina ? carousel.height() * RETINA_FACTOR : carousel.height(),
                options = { scaleType: 'contain', width: width, height: height },
                image = $('<img class="viewer-displayer-item viewer-displayer-image">'),
                previewUrl = this.getPreviewUrl(options),
                filename = this.model.get('filename') || '',
                self = this;

            this.$el.empty();

            if (previewUrl) {
                previewUrl = _.unescapeHTML(previewUrl);
                image.attr({ 'data-src': previewUrl, alt: filename });
                this.$el.busy();
                image.one('load', function () {
                    self.$el.idle();
                    image.show();
                });
                image.one('error', function () {
                    var notification = self.createNotificationNode(gt('Sorry, there is no preview available for this image.'));
                    self.$el.idle().append(notification);
                });
                this.$el.append($('<div>').append(image));
            }

            return this;
        },

        /**
         * "Prefetches" the image slide by transferring the image source from the 'data-src'
         *  to the 'src' attribute of the <img> HTMLElement.
         *
         * @returns {ImageView}
         *  the ImageView instance.
         */
        prefetch: function () {
            //console.warn('ImageView.prefetch()', this.model.get('filename'));

            var image = this.$el.find('img.viewer-displayer-image');
            if (image.length > 0) {
                image.attr('src', image.attr('data-src'));
                this.isPrefetched = true;
            }

            return this;
        },

        /**
         * "Shows" the image slide.
         * For images all work is already done in prefetch()
         *
         * @returns {ImageView}
         *  the ImageView instance.
         */
        show: function () {
            //console.warn('ImageView.show()', this.model.get('filename'));
            return this;
        },

        /**
         * "Unloads" the image slide by replacing the src attribute of the image to an
         * Base64 encoded, 1x1 pixel GIF image.
         *
         * @returns {ImageView}
         *  the ImageView instance.
         */
        unload: function () {
            //console.warn('ImageView.unload()', this.model.get('filename'));
            var imageToUnLoad;
            // never unload slide duplicates
            if (!this.$el.hasClass('swiper-slide-duplicate')) {
                imageToUnLoad = this.$el.find('img.viewer-displayer-image');
                if (imageToUnLoad.length > 0) {
                    imageToUnLoad.attr('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=');
                }
                this.isPrefetched = false;
            }
            return this;
        }

    });

    // returns an object which inherits BaseView
    return ImageView;
});
