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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/viewer/views/types/textview', [
    'io.ox/core/viewer/views/types/baseview'
], function (BaseView) {

    'use strict';

    var TextView = BaseView.extend({

        initialize: function (options) {
            _.extend(this, options);
            this.isPrefetched = false;
            this.listenTo(this.viewerEvents, 'viewer:zoom:in', this.onZoomIn);
            this.listenTo(this.viewerEvents, 'viewer:zoom:out', this.onZoomOut);
            this.$el.on('scroll', _.throttle(this.onScrollHandler.bind(this), 500));
        },

        render: function () {
            // handle zoom events
            this.size = 13;
            // quick hack to get rid of flex box
            this.$el.empty().css('display', 'block');
            return this;
        },

        prefetch: function () {
            // simply load the document content via $.ajax
            var $el = this.$el.busy(),
                previewUrl = this.getPreviewUrl();
            $.ajax({ url: previewUrl, dataType: 'text' }).done(function (text) {
                $el.addClass('swiper-no-swiping');
                $el.idle().append($('<div class="white-page letter plain-text">').text(text));
                $el = null;
            });
            this.isPrefetched = true;
            return this;
        },

        show: function () {
            return this;
        },

        /**
         * Unloads the text file
         *
         * @returns {TextView}
         *  the TextView instance.
         */
        unload: function () {
            this.$el.find('.white-page').remove();
            this.isPrefetched = false;
            return this;
        },

        setFontSize: function (value) {
            this.size = Math.min(Math.max(value, 9), 21);
            this.$('.white-page').css('fontSize', this.size);
        },

        onZoomIn: function () {
            this.setFontSize(this.size + 2);
        },

        onZoomOut: function () {
            this.setFontSize(this.size - 2);
        },

        /**
         *  Scroll event handler:
         *  -blends in navigation controls.
         */
        onScrollHandler: function () {
            this.viewerEvents.trigger('viewer:blendnavigation');
        }

    });

    return TextView;
});
