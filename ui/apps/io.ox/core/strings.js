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
 * @author Tobias Prinz <tobias.prinz@open-xchange.com>
 */

define('io.ox/core/strings', ['gettext!io.ox/core'], function (gt) {

    "use strict";

    var n_size = [/*#. Bytes*/      gt('B'),
                  /*#. Kilobytes*/  gt('KB'),
                  /*#. Megabytes*/  gt('MB'),
                  /*#. Gigabytes*/  gt('GB'),
                  /*#. Terabytes*/  gt('TB'),
                  /*#. Petabytes*/  gt('PB'),
                  /*#. Exabytes*/   gt('EB'),
                  /*#. Zettabytes*/ gt('ZB'),
                  /*#. Yottabytes*/ gt('YB')];

    return {

        shortenUri: function (uriString, maxlen) {
            uriString = uriString !== undefined && uriString !== null ? uriString : '';
            var string = uriString.replace(/^https?:\/\//, "");
            var difference = string.length - maxlen;
            if (difference <= 0) {
                return string;
            }
            var middle = string.length / 2;
            var left = middle - (difference / 2) - 1;
            var right = middle + (difference / 2) + 1;

            return string.substring(0, left)  + "..." + string.substring(right, string.length);
        },

        fileSize: function (size, decimalPlaces) {
            var i = 0, $i = n_size.length;
            if (decimalPlaces > 10) {//for security so math.pow doesn't get really high values
                decimalPlaces = 10;
            }
            var dp = Math.pow(10, decimalPlaces || 0);
            while (size > 1024 && i < $i) {
                size = size / 1024;
                i++;
            }
            return (
                //#. File size
                //#. %1$d is the number
                //#. %2$s is the unit (B, KB, MB etc.)
                gt('%1$d %2$s', (Math.round(size * dp, 1) / dp), n_size[i]));
        }

    };
});
