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
 * @author Kai Ahrens <kai.ahrens@open-xchange.com>
 */

define('io.ox/office/framework/model/basemodel',
     ['io.ox/core/event'], function (Events) {

    'use strict';

    // class BaseModel ========================================================

    /**
     * The base class for model classes used in OX Documents applications. Adds
     * the Events mix-in class to all created instances.
     *
     * @constructor
     *
     * @extends Events
     *
     * @param {BaseApplication} app
     *  The application that has created this model instance.
     */
    function BaseModel() {

        // base constructor ---------------------------------------------------

        // add the Events mix-in class
        Events.extend(this);

        // methods ------------------------------------------------------------

        this.destroy = function () {
            this.events.destroy();
        };

    } // class BaseModel

    // exports ================================================================

    return _.makeExtendable(BaseModel);

});
