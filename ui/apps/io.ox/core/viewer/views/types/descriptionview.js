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

define('io.ox/core/viewer/views/types/descriptionview', [
    'io.ox/core/viewer/views/types/baseview',
    'io.ox/files/api'
], function (BaseView, api) {

    'use strict';

    // used for item without a file

    var DescriptionView = BaseView.extend({

        initialize: function (options) {
            _.extend(this, options);
            this.isPrefetched = true;
            this.$el.on('scroll', _.throttle(this.onScrollHandler.bind(this), 500));
        },

        render: function () {
            // quick hack to get rid of flex box
            this.$el.empty().css('display', 'block');
            return this;
        },

        prefetch: function () {
            return this;
        },

        show: function () {
            // make sure we have the description
            this.$el.busy();
            api.get(this.model.pick('folder_id', 'id')).done(function (data) {
                if (this.disposed) return;
                this.$el.idle().append($('<div class="white-page letter plain-text">').text(data.description));
            }.bind(this));
            return this;
        },

        unload: function () {
            this.$el.find('.white-page').remove();
            this.isPrefetched = false;
            return this;
        },

        // the "why" or "what for" would be interesting
        onScrollHandler: function () {
            this.viewerEvents.trigger('viewer:blendnavigation');
        }

    });

    return DescriptionView;
});
