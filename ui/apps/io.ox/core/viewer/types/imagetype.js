/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2015 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Edy Haryono <edy.haryono@open-xchange.com>
 */
define('io.ox/core/viewer/types/imagetype', [
    'gettext!io.ox/core'
], function (gt) {

    /**
     * The image file type. Implements the ViewerType interface.
     *
     * interface ViewerType {
     *    function createSlide(model, modelIndex);
     *    function loadSlide(slideElement);
     * }
     *
     * @constructor
     */
    function ImageType(model) {
        /**
         * Creates a Image slide.
         *
         * @param {Object} model
         *  An OX Viewer Model object.
         *
         * @param {Number} modelIndex
         *  Index of this model object in the collection.
         *
         * @returns {jQuery} slide
         *  the slide jQuery element.
         */
        this.createSlide = function (modelIndex) {
            //console.warn('ImageType.createSlide()');
            var slide = $('<div class="swiper-slide" tabindex="-1">'),
                image = $('<img class="viewer-displayer-image">'),
                caption = $('<div class="viewer-displayer-caption">'),
                previewUrl = model && model.getPreviewUrl(),
                filename = model && model.get('filename') || '',
                slidesCount = model.collection.length,
                displayerTopOffset = 45;
            if (previewUrl) {
                image
                    .attr({ 'data-src': _.unescapeHTML(previewUrl), alt: filename })
                    .css({ maxHeight: window.innerHeight - displayerTopOffset, maxWidth: window.innerWidth });
                caption.text(modelIndex + 1 + ' ' + gt('of') + ' ' + slidesCount);
                slide.append(image, caption);
            }
            return slide;
        };

        /**
         * "Loads" an image slide by transferring the image source from the 'data-src'
         *  to the 'src' attribute of the <img> HTMLElement.
         *
         * @param {jQuery} slideElement
         *  the slide jQuery element to be loaded.
        */
        this.loadSlide = function (slideElement) {
            //console.warn('ImageType.loadSlide()', slideIndex, slideElement);
            if (slideElement.length === 0) {
                return;
            }
            var imageToLoad = slideElement.find('img');
            if (imageToLoad.length === 0) { return ;}
            slideElement.busy();
            imageToLoad.attr('src', imageToLoad.attr('data-src'));
            imageToLoad[0].onload = function () {
                slideElement.idle();
                imageToLoad.show();
            };
            imageToLoad[0].onerror = function () {
                var notification = $('<p class="viewer-displayer-notification">')
                    .text(gt('Sorry, there is no preview available for this file.'));
                slideElement.idle().append(notification);
            };
        };
    }

    return ImageType;
});
