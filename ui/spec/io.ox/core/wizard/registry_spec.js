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
    'io.ox/core/wizard/registry',
    'fixture!io.ox/core/wizard/welcomeWizard.js'
], function (wizard, welcomeWizard, test) {
    'use strict';

    describe('Wizard API', function () {

        it('should define a getWizard method', function () {
            expect(wizard.getWizard).to.exist;
        });

        describe('used by a welcomeWizard example', function () {
            it('should create an instance', function () {
                expect(welcomeWizard.getInstance()).to.exist;
            });
        });
    });
});
