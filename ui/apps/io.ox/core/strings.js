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
 * @author Tobias Prinz <tobias.prinz@open-xchange.com>
 */

define('io.ox/core/strings', ['gettext!io.ox/core'], function (gt) {

    'use strict';

    var n_size;
    function init_n_size() {
        n_size = [
            /*#. Bytes*/
            gt('B'),
            /*#. Kilobytes*/
            gt('KB'),
            /*#. Megabytes*/
            gt('MB'),
            /*#. Gigabytes*/
            gt('GB'),
            /*#. Terabytes*/
            gt('TB'),
            /*#. Petabytes*/
            gt('PB'),
            /*#. Exabytes*/
            gt('EB'),
            /*#. Zettabytes*/
            gt('ZB'),
            /*#. Yottabytes*/
            gt('YB')
        ];
    }

    return {

        shortenUri: function (uriString, maxlen) {
            uriString = uriString !== undefined && uriString !== null ? uriString : '';
            var string = uriString.replace(/^https?:\/\//, '');
            var difference = string.length - maxlen;
            if (difference <= 0) {
                return string;
            }
            var middle = string.length / 2;
            var left = middle - (difference / 2) - 1;
            var right = middle + (difference / 2) + 1;

            return string.substring(0, left) + '...' + string.substring(right, string.length);
        },

        fileSize: function (size, decimalPlaces) {
            if (!n_size) init_n_size();
            var i = 0, $i = n_size.length;
            // for security so math.pow doesn't get really high values
            if (decimalPlaces > 10) decimalPlaces = 10;
            var dp = Math.pow(10, decimalPlaces || 0);
            while (size >= 1024 && i < $i) {
                size = size / 1024;
                i++;
            }
            // get rounded size
            size = Math.round(size * dp) / dp;
            // edge case: rounded size is 1024 (see bug 50095)
            if (size === 1024) {
                size = size / 1024;
                i++;
            }
            return (
                //#. File size
                //#. %1$d is the number
                //#. %2$s is the unit (B, KB, MB etc.)
                gt('%1$d %2$s', size, n_size[i])
            );
        },

        // String size in bytes
        size: function (string, kBmode) {
            var size = (encodeURI(string).split(/%(?:u[0-9A-F]{2})?[0-9A-F]{2}|./).length - 1);
            return kBmode ? (size / 1024).toFixed() : size;
        }

    };
});
