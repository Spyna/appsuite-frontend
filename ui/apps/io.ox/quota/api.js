/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2011
 * Mail: info@open-xchange.com
 *
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */
define("io.ox/quota/api", ["io.ox/core/http"], function (http) {
    
    "use strict";
    
    var api = {
        getFile: function () {
            return http.GET({
                module: "quota",
                params: {action: "filestore"}
            });
        },
        getMail: function () {
            return http.GET({
                module: "quota",
                params: {action: "mail"}
            });
        }
    };
    
    return api;
});