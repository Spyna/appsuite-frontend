/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2013 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/util', [/* only add light core deps, not stuff like account API or mail API */], function () {

    'use strict';

    return {

        // remove unwanted quotes from display names
        // "World, Hello" becomes World, Hello
        // but "Say \"Hello\"" becomes Say "Hello"
        unescapeDisplayName: function (str) {

            str = $.trim(str || '');

            // remove outer quotes
            while (str.length > 1 && /^["'\\\s]/.test(str[0]) && str[0] === str.substr(-1)) {
                str = $.trim(str.substr(1, str.length - 2));
            }

            // unescape inner quotes
            str = str.replace(/\\"/g, '"');

            return str;
        },

        // split long character sequences
        breakableHTML: function (text, node) {
            // inject zero width space and replace by <wbr>
            var substrings = String(text || '').replace(/(\S{20})/g, '$1\u200B').split('\u200B');
            return _(substrings).map(_.escape).join('<wbr/>');
        },

        breakableText: function (text) {
            return String(text || '').replace(/(\S{20})/g, '$1\u200B');
        }
    };
});
