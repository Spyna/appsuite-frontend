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
    'io.ox/core/tk/iframe'
], function (main) {

    'use strict';

    var appOptions = {
            name: 'com.example',
            title: 'Hallo, World!',
            pageTitle: 'Hallo, World!',
            url: 'https://example.com/index.html?test=test',
            acquireToken: true
        },
        appOptionsWithoutToken = {
            name: 'com.example',
            title: 'Hallo, World!',
            pageTitle: 'Hallo, World!',
            url: 'https://example.com'
        },
        appOptionsWithoutParameter = {
            name: 'com.example',
            title: 'Hallo, World!',
            pageTitle: 'Hallo, World!',
            url: 'https://example.com/index.html',
            acquireToken: true
        },

        response = {
            'timestamp': 1379403021960,
            'data': {
                'token': 1234567890
            }
        },

        app;

    describe('iframe app', function () {

        beforeEach(function (done) {
            app = main(appOptions).getApp();
            app.launch().done(function () {
                done();
            });

            this.server.respondWith('GET', /api\/token\?action=acquireToken/, function (xhr) {
                xhr.respond(200, { 'Content-Type': 'text/javascript;charset=UTF-8' }, JSON.stringify(response));
            });

        });

        it('should provide a getApp function', function () {
            expect(main(appOptions).getApp()).to.exist;
        });

        it('should provide a launch function', function () {
            console.log(main(appOptions).getApp().launch);
            expect(main(appOptions).getApp().launch).to.be.a('function');
        });

        it('should open the iframe app', function () {
            expect(app.get('state')).to.equal('running');
        });

        it('should render the app name', function () {
            expect(app.getWindow().nodes.outer.attr('data-app-name')).to.equal(appOptions.name);
        });

        it('should render the iframe', function () {
            expect(app.getWindow().nodes.main.find('iframe').length).to.equal(1);
        });

        it('should render the iframe src', function () {
            expect(app.getWindow().nodes.main.find('iframe').attr('src')).to.equal(appOptions.url + '&ox_token=' + response.data.token);
        });

    });

    describe('iframe app without token', function () {

        beforeEach(function (done) {
            app = main(appOptionsWithoutToken).getApp();
            app.launch().done(function () {
                done();
            });

        });

        it('should render the iframe', function () {
            expect(app.getWindow().nodes.main.find('iframe').length).to.equal(1);
        });

        it('should render the iframe src without appended token', function () {
            expect(app.getWindow().nodes.main.find('iframe').attr('src')).to.equal(appOptionsWithoutToken.url);
        });

    });

    describe('iframe app without appended parameter', function () {

        beforeEach(function (done) {
            app = main(appOptionsWithoutParameter).getApp();
            app.launch().done(function () {
                done();
            });

            this.server.respondWith('GET', /api\/token\?action=acquireToken/, function (xhr) {
                xhr.respond(200, { 'Content-Type': 'text/javascript;charset=UTF-8' }, JSON.stringify(response));
            });

        });

        it('should render the iframe src', function () {
            expect(app.getWindow().nodes.main.find('iframe').attr('src')).to.equal(appOptionsWithoutParameter.url + '?ox_token=' + response.data.token);
        });

    });

});
