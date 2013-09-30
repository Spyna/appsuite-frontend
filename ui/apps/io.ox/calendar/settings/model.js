/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2012
 * Mail: info@open-xchange.com
 *
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */
define('io.ox/calendar/settings/model',
      ['settings!io.ox/calendar'], function (settings) {

    'use strict';

    var calendarSettingsModel = Backbone.Model.extend({


        initialize: function (options) {
        },

        save: function () {
            return settings.save(this.attributes);
        },

        saveAndYell: function () {
            return settings.saveAndYell(this.attributes);
        },

        destroy: function () {
            console.log('destroy in model.js');
        }

    });

    return calendarSettingsModel;
});
