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
define('io.ox/core/viewer/views/document/thumbnailview', [
    'io.ox/backbone/disposable',
    'io.ox/core/viewer/util',
    'gettext!io.ox/core'
], function (DisposableView, Util) {

    'use strict';

    var ThumbnailView = DisposableView.extend({

        events: {
            'click .document-thumbnail-link': 'onThumbnailClicked'
        },

        initialize: function (options) {
            _.extend(this, options);
            this.listenTo(this.viewerEvents, 'viewer:document:selectthumbnail', this.selectThumbnail);
            // listen to render thumbnails call
            this.listenTo(this.viewerEvents, 'viewer:sidebar:renderthumbnails', this.render);
            // listen to sidebar scroll
            this.listenTo(this.viewerEvents, 'viewer:sidebar:scroll', this.refreshThumbnails);
            // listen to window resize
            this.listenTo(this.viewerEvents, 'viewer:resize', this.refreshThumbnails);
            // dispose view on global dispose
            this.on('dispose', this.disposeView.bind(this));
            this.thumbnailLoadDef = Util.createAbortableDeferred($.noop);
            this.thumbnailImages = [];
        },

        render: function () {
            var self = this;
            this.$el.busy();
            function beginConvertSuccess(convertData) {
                self.convertData = convertData;
                _.times(convertData.pageCount, function (pageNumber) {
                    var thumbnailNode = self.createThumbnailNode(pageNumber);
                    self.$el.append(thumbnailNode);
                });
                self.$el.idle();
                self.loadThumbnails(convertData);
                return convertData;
            }
            function beginConvertError(response) {
                return $.Deferred().reject(response);
            }
            function beginConvertFinished() {
                self.$el.idle();
            }
            this.thumbnailLoadDef = Util.beginConvert(this.model.toJSON())
                .done(beginConvertSuccess)
                .fail(beginConvertError)
                .always(beginConvertFinished);
            return this;
        },

        /**
         * Creates a complete thumbnail node.
         *
         * @param {Number} pageNumber
         *  the page that should be shown in the thumbnail.
         *
         * @returns {jQuery} thumbnailLink
         */
        createThumbnailNode: function (pageNumber) {
            var thumbnailLink = $('<a class="document-thumbnail-link">'),
                thumbnail = $('<div class="document-thumbnail">'),
                thumbnailImage = this.createDocumentThumbnailImage('thumbnail-image'),
                thumbnailPageNumber = $('<div class="page-number">').text(pageNumber + 1);
            thumbnail.append(thumbnailImage).busy();
            this.thumbnailImages.push(thumbnailImage);
            thumbnailLink.append(thumbnail, thumbnailPageNumber).attr({
                'role': 'button',
                'aria-selected': false,
                'data-page': pageNumber + 1
            });
            return thumbnailLink;
        },

        /**
         * Loads thumbnail images, which are visible in the browser window.
         *
         * @param {Object} convertData
         *  a response object from document converter containing
         *  the convert jobID and the total page count.
         */
        loadThumbnails: function (convertData) {
            var params = {
                    action: 'convertdocument',
                    convert_action: 'getpage',
                    target_format: 'jpg',
                    target_width: 200,
                    target_zoom: 1,
                    job_id: convertData.jobID,
                    page_number: convertData.pageNumber,
                    id: encodeURIComponent(this.model.get('id')),
                    folder_id: this.model.get('folder_id'),
                    filename: encodeURIComponent(this.model.get('filename')),
                    version: this.model.get('version')
                },
                thumbnailNodes = this.$('.document-thumbnail'),
                thumbnailsToLoad = Util.getVisibleNodes(thumbnailNodes);
            _.each(thumbnailsToLoad, function (pageNumber) {
                var image = this.thumbnailImages[pageNumber - 1];
                if (image.src) {
                    return;
                }
                params.page_number = pageNumber;
                var thumbnailUrl = Util.getConverterUrl(params);
                image.src = thumbnailUrl;
            }.bind(this));
        },

        /**
         * Creates thumbnail image of a document page.
         *
         * @returns {HTMLImageElement} image
         *  the image HTML element.
         */
        createDocumentThumbnailImage: function (className) {
            var image = new Image();
            image.className = className;
            image.onload = function () {
                $(image.parentNode).idle();
            };
            return image;
        },

        /**
         * Thumbnail click handler:
         * - selects/highlights the clicked thumbnail.
         * - triggers 'viewer:document:scrolltopage' event, so that the document is scrolled to the requested page.
         * @param {jQueryEvent} event
         */
        onThumbnailClicked: function (event) {
            var clickedThumbnail = $(event.currentTarget),
                clickedPageNumber = clickedThumbnail.data('page');
            this.selectThumbnail(clickedPageNumber);
            this.viewerEvents.trigger('viewer:document:scrolltopage', clickedPageNumber);
        },

        /**
         * Selects a thumbnail of a particular page number.
         * @param {Number} pageNumber
         */
        selectThumbnail: function (pageNumber) {
            var thumbnail = this.$el.find('.document-thumbnail-link[data-page=' + pageNumber + ']');
            thumbnail.siblings().removeClass('selected').attr('aria-selected', false);
            thumbnail.addClass('selected').attr('aria-selected', true);
        },

        /**
         * Refresh thumbnails by loading visible ones.
         */
        refreshThumbnails: function () {
            this.thumbnailLoadDef.done(function (convertData) {
                this.loadThumbnails(convertData);
            }.bind(this));
        },

        disposeView: function () {
            var def = this.thumbnailLoadDef;
            // cancel any pending thumbnail loading
            if (def.state() === 'pending') {
                def.abort();
            }
            // close convert jobs while quitting
            def.done(function (response) {
                Util.endConvert(this.model.toJSON(), response.jobID);
            }.bind(this));
            // unbind image on load handlers
            _.each(this.thumbnailImages, function (image) {
                image.onload = null;
            });
            this.thumbnailImages = null;
        }

    });

    return ThumbnailView;

});
