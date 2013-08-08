/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2011
 * Mail: info@open-xchange.com
 *
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 */

define('io.ox/core/settings/register', ['io.ox/core/extensions', 'gettext!io.ox/core/settings'], function (ext, gt) {

    'use strict';
    
    var usermodel;

    ext.point("io.ox/settings/pane").extend({
        id: 'io.ox/users',
        title: gt("My contact data"),
        ref: 'io.ox/users',
        loadSettingPane: false,
        lazySaveSettings: true,//don't save on every modelchange (causes ugly busy animations while editing)
        index: 750
    });

    ext.point("io.ox/users/settings/detail").extend({
        index: 100,
        draw: function () {
            var $node = this;
            require(["io.ox/core/settings/user"], function (users) {
                users.editCurrentUser($node).done(function (model) {
                    usermodel = model;
                }).fail(function () {
                    $node.append(
                        $.fail(gt("Couldn't load your contact data."), function () {
                            users.editCurrentUser($node).done(function () {
                                $node.find('[data-action="discard"]').hide();
                            });
                        })
                    );
                });
            });
        },
        save: function () {
            return usermodel.save();
        }
    });
});
