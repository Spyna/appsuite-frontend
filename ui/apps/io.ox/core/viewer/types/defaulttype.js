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
define('io.ox/core/viewer/types/defaulttype',  [
    'io.ox/core/viewer/types/basetype',
    'gettext!io.ox/core'
], function (BaseType, gt) {
    /**
     * Default file type for OX Viewer. Displays a generic file icon
     * and the file name. This type acts as a fallback in cases if the
     * current file is not supported by OX Viewer.
     *
     * Implements the ViewerType interface.
     *
     * interface ViewerType {
     *    function createSlide(model, modelIndex);
     *    function loadSlide(slideElement);
     * }
     *
     */
    var defaultType = {
        //console.warn('defaulttype()');
        /**
         * Creates a default slide.
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
            //console.warn('DefaultType.createSlide()', model, modelIndex, count);
            var slide = $('<div class="swiper-slide" tabindex="-1" role="option" aria-selected="false">'),
                displayerTopOffset = 45,
                slideContent = $('<div class="viewer-displayer-notification">')
                    .css({ maxHeight: window.innerHeight - displayerTopOffset }),
                fileIcon = $('<i class="fa fa-file-o">'),
                filename = model && model.get('filename') || '',
                filenameEl = $('<p>').text(filename),
                apology = $('<p class="apology">').text(gt('Sorry, there is no preview available for this file.')),
                slidesCount = model.collection.length;
            slideContent.append(fileIcon, filenameEl, apology);
            slide.append(slideContent, this.createCaption(modelIndex, slidesCount));
            return slide;
        },

        /**
         * "Loads" a default slide.
         *
         * @param {jQuery} slideElement
         *  the slide jQuery element to be loaded.
         */
        loadSlide: function () {}

    };

    // returns an object which inherits BaseType
    return _.extend(Object.create(BaseType), defaultType);

});
