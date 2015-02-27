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
define('io.ox/core/viewer/types/audiotype',  [
    'io.ox/core/viewer/types/basetype'
], function (BaseType) {
    /**
     * The audio file type. Implements the ViewerType interface.
     *
     * interface ViewerType {
     *    function createSlide(model, modelIndex);
     *    function loadSlide(model, slideElement);
     * }
     *
     */
    var audioType = {
        /**
         * Creates a audio slide.
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
        createSlide: function (model, modelIndex) {
            //console.warn('AudioType.createSlide()');
            var slide = $('<div class="swiper-slide" tabindex="-1" role="option" aria-selected="false">'),
                slidesCount = model.collection.length;
            slide.append(this.createCaption(modelIndex, slidesCount));
            return slide;
        },

        /**
         * "Loads" a audio slide.
         *
         * @param {Number} slideIndex
         *  index of the slide to be loaded.
         *
         * @param {jQuery} slideElement
         *  the slide jQuery element to be loaded.
         */
        loadSlide: function (model, slideElement) {
            //console.warn('AudioType.loadSlide()', slideIndex, slideElement);
            if (!model || slideElement.length === 0) {
                return;
            }
        }
    };

    // returns an object which inherits BaseType
    return _.extend(Object.create(BaseType), audioType);

});
