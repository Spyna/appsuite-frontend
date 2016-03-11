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
define([
    'io.ox/emoji/main',
    'settings!io.ox/mail/emoji'
], function (emoji, settings) {
    'use strict';

    describe('Emoji support', function () {
        describe('with fallback collections', function () {
            var api;
            beforeEach(function () {
                settings.set('availableCollections', 'unified,softbank,japan_carrier');
                settings.set('userCollection', 'unified');

                api = emoji.getInstance();
            });

            afterEach(function () {
                api = null;
            });

            it('should get CSS for unicode emoji', function () {
                expect(api.cssFor('\u2600')).to.equal('emoji-unified emoji2600');
            });
        });
    });
});
