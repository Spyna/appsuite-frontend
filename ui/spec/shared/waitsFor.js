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
 * @author Julian Bäume <julian.baeume@open-xchange.com>
 */

define('waitsFor', function () {

    'use strict';

    /**
     * return deferred resolves (after continually called callback returns true for the first time)
     * @param  {function} testCallback
     * @param  {deferred} def (optional)
     * @return {deferred}
     */
    function waitFor(testCallback, def) {
        def = def || $.Deferred();
        if (!!testCallback()) return def.resolve();
        _.defer(waitFor, testCallback, def);
        return def;
    }

    return waitFor;
});
