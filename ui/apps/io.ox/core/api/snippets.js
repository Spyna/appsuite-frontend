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
/*
    {
        id: 12, // Set by the backend
        type: 'signature',   // The type of snippet, for easy lookup
        module: 'io.ox/mail', // The module that created the snippet
        displayname: 'My Signature', // A display name
        content: 'This email contains the absolute unchangeable truth, questioning its content is discouraged. \n The Mgt.', // The content of the snippet
        misc: { insertion: above } // Object with misc options
    }
*/
define('io.ox/core/api/snippets',
    ['io.ox/core/http',
     'io.ox/core/event'
    ], function (http, Events) {

    'use strict';

    var api = {};

    Events.extend(api);

    /**
     * trigger events
     * @param  {string} event
     * @return {undefined}
     */
    function fnTrigger(event) {
        return function () {
            api.trigger(event);
        };
    }

    /**
     * get all snippets
     * @return {deferred} array of snippet objects
     */
    api.getAll = function () {
        return http.GET({
            module: 'snippet',
            params: {
                action: 'all'
            }
        })
        .pipe(function (data) {
            return _(data).map(function (sig) {
                // robustness: snippet migration
                sig.misc = $.extend({ insertion: 'below'}, sig.misc || {});
                return sig;
            });
        });
    };

    /**
     * create snippet
     * @param  {object} snippet
     * @fires  api#refresh.all
     * @return {deferred} returns snippet id
     */
    api.create = function (snippet) {
        return http.PUT({
            module: 'snippet',
            params: {
                action: 'new'
            },
            data: snippet
        }).done(fnTrigger('refresh.all'));
    };

    /**
     * update snippet
     * @param  {object} snippet
     * @fires  api#refresh.all
     * @return {deferred} returns snippet object
     */
    api.update = function (snippet) {
        return http.PUT({
            module: 'snippet',
            params: {
                action: 'update',
                id: snippet.id
            },
            data: snippet
        }).done(fnTrigger('refresh.all'));
    };

    /**
     * get snippet
     * @param  {string} id
     * @return {deferred}
     */
    api.get = function (id) {
        return http.GET({
            module: 'snippet',
            params: {
                action: 'get',
                id: id
            }
        });
    };

    /**
     * get snippets
     * @param  {array} ids
     * @return {deferred}
     */
    api.list = function (ids) {
        return http.PUT({
            module: 'snippet',
            params: {
                action: 'list'
            },
            data: ids
        });
    };

    // TODO: Attachment Handling

    /**
     * remove snippets
     * @param  {string} id
     * @fires  api#refresh.all
     * @return {deferred} returns empty object
     */
    api.destroy = function (id) {
        return http.GET({
            module: 'snippet',
            params: {
                action: 'delete',
                id: id
            }
        }).done(fnTrigger('refresh.all'));
    };


    return api;

});
