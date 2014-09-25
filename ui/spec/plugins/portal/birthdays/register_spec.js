/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2013 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */
define([
    'plugins/portal/birthdays/register',
    'io.ox/core/extensions',
    'io.ox/core/date',
    'waitsFor',
    'fixture!plugins/portal/birthdays/birthdaysTestData.json'
], function (birthdayPlugin, ext, date, waitsFor, testData) {
    'use strict';

    //update testdata
    testData[0].birthday = new date.UTC().getTime() - date.DAY;//yesterday
    testData[1].birthday = new date.UTC().getTime();//today
    testData[2].birthday = new date.UTC().getTime() + date.DAY;//tomorrow

    describe('portal Birthday plugin', function () {

        describe('should', function () {
            beforeEach(function (done) {
                this.server.respondWith('GET', /api\/contacts\?action=birthdays/, function (xhr) {
                    xhr.respond(200, { 'Content-Type': 'text/javascript;charset=UTF-8' },
                            '{ "timestamp":1368791630910,"data": ' + JSON.stringify(testData) + '}');
                });
                this.node = $('<div>');
                this.baton  = ext.Baton();
                var def = ext.point('io.ox/portal/widget/birthdays').invoke('load', this.node, this.baton);

                def._wrapped[0].then(function () {
                    return ext.point('io.ox/portal/widget/birthdays').invoke('preview', this.node, this.baton);
                }.bind(this))
                .then(function () {
                    done();
                });
            });

            afterEach(function () {
                this.node.remove();
            });

            it('draw content', function () {
                expect(this.node.children()).to.have.length(1);
            });
            it('draw all birthdays', function () {
                expect(this.node.find('li')).to.have.length(5);
            });
            it('not draw year if its year 1', function () {
                expect($(this.node.find('.accent')[4]).text()).to.equal('12.6.');
            });
            it('recognize yesterday/today/tomorrow', function () {
                expect($(this.node.find('.accent')[0]).text()).to.equal('Gestern');
                expect($(this.node.find('.accent')[1]).text()).to.equal('Heute');
                expect($(this.node.find('.accent')[2]).text()).to.equal('Morgen');
            });
            describe('have', function () {
                it('a sidepopup drawn', function (done) {
                    ext.point('io.ox/portal/widget/birthdays').invoke('draw', this.node, this.baton);
                    waitsFor(function () {
                        return this.node.find('.io-ox-portal-birthdays').length === 1;
                    }.bind(this)).done(done);
                });
            });
        });
        describe('should', function () {
            beforeEach(function (done) {
                this.server.respondWith('GET', /api\/contacts\?action=birthdays/, function (xhr) {
                    xhr.respond(200, { 'Content-Type': 'text/javascript;charset=UTF-8' },
                            '{ "timestamp":1368791630910,"data": []}');
                });
                this.node = $('<div>');
                var baton  = ext.Baton();
                var def = ext.point('io.ox/portal/widget/birthdays').invoke('load', this.node, baton);
                def._wrapped[0].then(function () {
                    return ext.point('io.ox/portal/widget/birthdays').invoke('preview', this.node, baton);
                }.bind(this))
                .then(function () {
                    done();
                });
            });

            afterEach(function () {
                this.node.remove();
            });

            it('draw correct empty message', function () {
                expect(this.node.children()).to.have.length(1);
                expect(this.node.children().first().is('ul')).to.be.true;
                expect(this.node.children().children().first().is('li')).to.be.true;
                expect(this.node.find('li').children()).to.have.length(0);
                expect(this.node.find('li').first().text()).to.equal('Keine Geburtstage in den nächsten 12 Wochen');
            });
        });
    });
});
