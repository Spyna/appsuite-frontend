/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Edy Haryono <edy.haryono@open-xchange.com>
 */
define('io.ox/core/viewer/views/sidebarview', function () {

    'use strict';

    /**
     * The SidebarView is responsible for displaying the detail sidebar.
     * This view should show file meta information, versions, sharing/permissions
     * etc. This view should have children views (TBD)
     */
    var SidebarView = Backbone.View.extend({

        className: 'io-ox-viewer-sidebar',

        events: {

        },

        initialize: function () {
            //console.warn('SidebarView.initialize()');
        },

        render: function () {
            //console.warn('SidebarView.render()');
            return this;
        }
    });

    return SidebarView;
});
