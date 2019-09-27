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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define(['io.ox/contacts/api', 'io.ox/contacts/util'], function (api, util) {
    'use strict';

    describe('Contact API', function () {

        beforeEach(function () {
            this.server.respondWith('GET', /api\/contacts\?action=get/, function (xhr) {
                xhr.respond(200, { 'Content-Type': 'text/javascript;charset=UTF-8' }, '{"timestamp":1368791630910,"data":{"id":1337, "birthday":-62122809600000}}');
            });
            this.server.respondWith('PUT', /api\/contacts\?action=new/, function (xhr) {
                xhr.respond(200, { 'Content-Type': 'text/javascript;charset=UTF-8' }, '{"timestamp":1368791630910,"data":{"id":1338}}');
            });
            this.server.respondWith('PUT', /api\/contacts\?action=update/, function (xhr) {
                xhr.respond(200, { 'Content-Type': 'text/javascript;charset=UTF-8' }, '{"timestamp":1368791630910,"data":{"id":1338}}');
            });
        });

        it('should return proper image path for internal users', function () {
            var url = api.pictureHalo($(), { folder_id: 6, id: 1337, internal_userid: 1 }, { urlOnly: true });
            expect(url).to.contain(ox.apiRoot + '/contacts/picture?action=get&user_id=1');
            expect(url).to.contain('uniq=');
        });

        it('should return proper image path for contacts', function () {
            var url = api.pictureHalo($(), { folder_id: 6, id: 1337 }, { urlOnly: true });
            expect(url).to.contain(ox.apiRoot + '/contacts/picture?action=get&contact_id=1337&folder_id=6');
            expect(url).to.contain('uniq=');
        });

        it('should return proper image path for contacts while ignoring internal_userid = 0', function () {
            var url = api.pictureHalo($(), { folder_id: 6, id: 1337, internal_userid: 0 }, { urlOnly: true });
            expect(url).to.contain(ox.apiRoot + '/contacts/picture?action=get&contact_id=1337&folder_id=6');
            expect(url).to.contain('uniq=');
        });
        ///contacts/picture?action=get
        it('should consider width, height, and scaleType', function () {
            var url = api.pictureHalo($(), { folder_id: 6, id: 1337, width: 48, height: 48, scaleType: 'cover' }, { urlOnly: true });
            expect(url).to.match(/\/contacts\/picture\?action=get&contact_id=1337&folder_id=6&sequence=\d+&width=\d+&height=\d+&scaleType=cover/);
            expect(url).to.contain('uniq=');
        });

        it('should return proper image path for recipients', function () {
            var url = api.pictureHalo($(), { email: 'test@open-xchange.com' }, { urlOnly: true });
            expect(url).to.contain(ox.apiRoot + '/contacts/picture?action=get&email=test%40open-xchange.com');
            expect(url).to.contain('uniq=');
        });

        it('should return proper image path for distribution lists', function () {
            var url = api.pictureHalo($(), { mark_as_distributionlist: true, folder_id: 6, id: 1337 }, { urlOnly: true });
            expect(url).to.contain(ox.base + '/apps/themes/default/fallback-image-group.png');
        });

        it('should return proper image path for resources', function () {
            var url = api.pictureHalo($(), { mailaddress: 'beamer@open-xchange.com', description: '', id: 1337 }, { urlOnly: true });
            expect(url).to.contain(ox.base + '/apps/themes/default/fallback-image-resource.png');
        });

        it('should return proper image path for groups', function () {
            var url = api.pictureHalo($(), { members: [], id: 1337 }, { urlOnly: true });
            expect(url).to.contain(ox.base + '/apps/themes/default/fallback-image-group.png');
        });

        it('GET should convert birthday to Julian calendar', function () {
            return api.get({ folder: 6, id: 1337 }).done(function (data) {
                expect(data.birthday).to.equal(-62122636800000);
            });
        });

        it('CREATE should convert birthday to Gregorian calendar', function () {
            var spy = sinon.spy(util, 'gregorianToJulian');

            return api.create({ folder: 6, birthday: -62122636800000 }).then(function () {
                expect(spy.called).to.be.true;
                spy.restore();
            });
        });

        it('UPDATE should convert birthday to Gregorian calendar', function () {
            var spy = sinon.spy(util, 'gregorianToJulian');

            return api.update({ folder: 6, id: 1338, data: { birthday: -62122636800000 } }).then(function () {
                expect(spy.called).to.be.true;
                spy.restore();
            });
        });
    });
});
