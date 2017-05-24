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
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define([
    'io.ox/mail/mailfilter/settings/filter/view-form'
], function (View) {

    'use strict';

    describe('Mailfilter view test handling', function () {

        var view, testObject, testObjectSingle;

        beforeEach(function () {
            testObject = {
                id: 'allof',
                tests: [
                    { id: 'header', comparison: 'contains', headers: ['From'], values: ['sender'] },
                    { id: 'body', comparison: 'contains', extensionskey: 'text', extensionsvalue: null, values: ['contend'] },
                    { id: 'header', comparison: 'contains', headers: ['Subject'], values: ['subject'] },
                    { id: 'allof', tests: [
                        { id: 'header', comparison: 'contains', headers: ['From'], values: ['sender'] },
                        { id: 'body', comparison: 'contains', extensionskey: 'text', extensionsvalue: null, values: ['contend'] },
                        { id: 'header', comparison: 'contains', headers: ['Subject'], values: ['subject'] }
                    ] }
                ]
            };
            testObjectSingle = {
                id: 'allof',
                tests: [
                    { id: 'header', comparison: 'contains', headers: ['From'], values: ['sender'] },
                    { id: 'header', comparison: 'contains', headers: ['Subject'], values: ['subject'] }
                ]
            };

            view = new View({
                model: {},
                config: {},
                conditionsTranslation: {},
                actionsTranslations: {},
                defaults: {},
                actionCapabilities: {},
                conditionsMapping: {}
            });

        });

        it('should return a function', function () {
            view.removeTest.should.be.a('function');
        });

        it('should remove a single test', function () {
            var newObject = view.removeTest(testObject, '0');
            expect(newObject.tests.length).to.equal(3);
        });

        it('should leave a single test', function () {
            var newObject = view.removeTest(testObjectSingle, '0');
            expect(newObject).to.deep.equal({ id: 'header', comparison: 'contains', headers: ['Subject'], values: ['subject'] });
        });

        it('should remove all tests', function () {
            var newObject = view.removeTest(testObjectSingle, '0');
            newObject = view.removeTest(newObject, '0');
            expect(newObject).to.deep.equal({ id: 'true' });
        });

        it('should remove a single nested test', function () {
            var newObject = view.removeTest(testObject, '3_1');
            expect(newObject.tests[3].tests.length).to.equal(2);
        });

    });

    describe('Mailfilter view action handling', function () {

        var view, actionArray;

        beforeEach(function () {
            actionArray = [
                { id: 'addflags', flags: ['$cl_1'] },
                { id: 'addflags', flags: ['$tag'] },
                { id: 'addflags', flags: ['\\deleted'] }
            ];

            view = new View({
                model: {},
                config: {},
                conditionsTranslation: {},
                actionsTranslations: {},
                defaults: {},
                actionCapabilities: {},
                conditionsMapping: {}
            });

        });

        it('should return a function', function () {
            view.removeAction.should.be.a('function');
        });

        it('should remove the first action ', function () {
            var newArray = view.removeAction(actionArray, '0');
            expect(newArray.length).to.equal(2);
            expect(newArray).to.deep.equal([{ id: 'addflags', flags: ['$tag'] }, { id: 'addflags', flags: ['\\deleted'] }]);
        });

        it('should leave a single action', function () {
            var newArray = view.removeAction(actionArray, '0');
            newArray = view.removeAction(actionArray, '0');
            expect(newArray.length).to.equal(1);
            expect(newArray).to.deep.equal([{ id: 'addflags', flags: ['\\deleted'] }]);
        });

        it('should remove the last action ', function () {
            var newArray = view.removeAction(actionArray, '2');
            expect(newArray.length).to.equal(2);
            expect(newArray).to.deep.equal([{ id: 'addflags', flags: ['$cl_1'] }, { id: 'addflags', flags: ['$tag'] }]);
        });

    });

});
