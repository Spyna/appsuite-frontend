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

define('io.ox/core/viewer/views/types/mailview', [
    'io.ox/core/viewer/views/types/baseview',
    'io.ox/mail/detail/view'
], function (BaseView, detail) {

    'use strict';

    var MailView = BaseView.extend({

        initialize: function () {
            this.isPrefetched = false;
        },

        render: function () {
            // quick hack to get rid of flex box
            this.$el.empty().css('display', 'block');
            return this;
        },

        prefetch: function () {
            this.isPrefetched = true;
            return this;
        },

        show: function () {

            var data = this.model.get('origData').nested_message;
            if (!this.view) {
                // add filename that is used as indicator for isEmbedded and is('toplevel')
                _.extend(data, { filename: this.model.get('filename') });
                // nested mails may not have full data, use attachments attribute to determine
                this.view = new detail.View({ data: data, loaded: !!data.attachments });
            }

            // if we want to reuse the view, we must not delete $el by emptiying the slide. Otherwise the view get's disposed
            this.view.$el.empty().detach();
            this.$el.empty().append(
                $('<div class="white-page">').append(
                    this.view.render().expand().$el
                )
            );

            return this;
        },

        unload: function () {
            this.isPrefetched = false;
            return this;
        }
    });

    return MailView;
});
