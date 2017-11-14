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
 * @author Christoph Hellweg <christoph.hellweg@open-xchange.com>
 */
define(['io.ox/calendar/util', 'io.ox/core/moment', 'io.ox/calendar/model'], function (util, moment, models) {

    'use strict';

    describe('Calendar utils', function () {

        describe('can convert timestamp to even smarter dates', function () {

            var model = new models.Model({
                allDay: false
            });

            it('yesterday', function () {
                var date = moment().subtract(1, 'day');
                model.set('startDate', {
                    value: date.format('YYYYMMDD[T]HHmmss'),
                    tzid: 'Europe/Berlin'
                });
                expect(util.getEvenSmarterDate(model)).to.equal('Gestern, ' + date.format('l'));
            });

            it('same day', function () {
                var date = moment();
                model.set('startDate', {
                    value: date.format('YYYYMMDD[T]HHmmss'),
                    tzid: 'Europe/Berlin'
                });
                expect(util.getEvenSmarterDate(model)).to.equal('Heute, ' + date.format('l'));
            });

            it('tomorrow', function () {
                var date = moment().add(1, 'day');
                model.set('startDate', {
                    value: date.format('YYYYMMDD[T]HHmmss'),
                    tzid: 'Europe/Berlin'
                });
                expect(util.getEvenSmarterDate(model)).to.equal('Morgen, ' + date.format('l'));
            });

            it('date in the past', function () {
                var date = moment().set({ 'year': 2012, 'month': 10, 'date': 11 });
                model.set('startDate', {
                    value: date.format('YYYYMMDD[T]HHmmss'),
                    tzid: 'Europe/Berlin'
                });
                expect(util.getEvenSmarterDate(model)).to.equal('So., 11.11.2012');
            });

        });

        describe('can convert two dates to a date interval string', function () {

            it('no given dates', function () {
                expect(util.getDateInterval()).to.be.empty;
            });

            it('same day', function () {
                expect(util.getDateInterval({ startDate: { value: '20121111' }, endDate: { value: '20121112' } })).to.equal('So., 11.11.2012');
            });

            it('one week difference', function () {
                expect(util.getDateInterval({ startDate: { value: '20121111' }, endDate: { value: '20121119' } })).to.equal('So., 11.11.2012 – So., 18.11.2012');
            });

        });

        describe('can convert two time values to an interval string', function () {

            it('no given dates', function () {
                expect(util.getTimeInterval()).to.be.empty;
            });

            it('same time', function () {
                expect(util.getTimeInterval({ startDate: { value: '20121111T111100' }, endDate: { value: '20121111T111100' } })).to.equal('11:11');
            });

            it('same day', function () {
                expect(util.getTimeInterval({ startDate: { value: '20121111T111100' }, endDate: { value: '20121111T121100' } })).to.equal('11:11\u201312:11 Uhr');
            });

        });

        describe('build reminder options', function () {

            it('object', function () {
                var result = {
                    '-PT0M': '0 Minuten',
                    '-PT5M': '5 Minuten',
                    '-PT10M': '10 Minuten',
                    '-PT15M': '15 Minuten',
                    '-PT30M': '30 Minuten',
                    '-PT45M': '45 Minuten',
                    '-PT1H': '1 Stunde',
                    '-PT2H': '2 Stunden',
                    '-PT4H': '4 Stunden',
                    '-PT6H': '6 Stunden',
                    '-PT8H': '8 Stunden',
                    '-PT12H': '12 Stunden',
                    '-P1D': '1 Tag',
                    '-P2D': '2 Tage',
                    '-P3D': '3 Tage',
                    '-P4D': '4 Tage',
                    '-P5D': '5 Tage',
                    '-P6D': '6 Tage',
                    '-P1W': '1 Woche',
                    '-P2W': '2 Wochen',
                    '-P3W': '3 Wochen',
                    '-P4W': '4 Wochen'
                };
                expect(util.getReminderOptions()).to.deep.equal(result);
            });

        });

        describe('should translate recurrence strings', function () {

            var data = {
                    day_in_month: 13,
                    days: 1,
                    interval: 1,
                    month: 1,
                    recurrence_type: 1
                },
                localeWeek = {
                    dow: moment.localeData().firstDayOfWeek(),
                    doy: moment.localeData().firstDayOfYear()
                };

            afterEach(function () {
                moment.updateLocale('de', {
                    week: localeWeek
                });
            });

            it('Only works for de_DE', function () {
                expect(ox.language).to.equal('de_DE');
            });

            // Daily
            it('Every day', function () {
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Täglich.');
            });

            it('Every 10 days', function () {
                data.interval = 10;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Alle 10 Tage.');
            });

            // Weekly
            it('Weekly on Monday', function () {
                data.days = util.days.MONDAY;
                data.interval = 1;
                data.recurrence_type = 2;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Jeden Montag.');
            });

            it('Weekly on Monday and Tuesday', function () {
                data.days = util.days.MONDAY | util.days.TUESDAY;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Jeden Montag und Dienstag.');
            });

            it('Weekly on Monday, Tuesday, Wednesday', function () {
                data.days = util.days.MONDAY | util.days.TUESDAY | util.days.WEDNESDAY;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Jeden Montag, Dienstag, Mittwoch.');
            });

            it('On workdays', function () {
                data.days = 2 + 4 + 8 + 16 + 32;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('An Werktagen.');
            });

            it('On weekends', function () {
                data.days = 1 + 64;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Jedes Wochenende.');
            });

            it('Weekly on all days -> Every day', function () {
                data.interval = 1;
                data.days = 127;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Täglich.');
            });

            // Weekly - interval > 1
            it('Every 2 weeks on Monday', function () {
                data.days = util.days.MONDAY;
                data.interval = 2;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Alle 2 Wochen am Montag.');
            });

            // test if superessive days and start of the week work well together
            it('Every 2 weeks on Monday with start of week = 3', function () {
                moment.updateLocale('de', { week: { dow: 3, doy: localeWeek.doy } });
                data.days = util.days.MONDAY;
                data.interval = 2;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Alle 2 Wochen am Montag.');
            });

            it('Every 2 weeks on Monday, Tuesday, Wednesday', function () {
                data.days = util.days.MONDAY | util.days.TUESDAY | util.days.WEDNESDAY;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Alle 2 Wochen am Montag, Dienstag, Mittwoch.');
            });

            it('Every 2 weeks on workdays', function () {
                data.days = 2 + 4 + 8 + 16 + 32;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Alle 2 Wochen an Werktagen.');
            });

            it('Every 2 weeks on weekends', function () {
                data.days = 1 + 64;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Alle 2 Wochen am Wochenende.');
            });

            it('Every 2 weeks on all days', function () {
                data.days = 127;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Täglich alle 2 Wochen.');
            });

            // Monthly
            it('Monthly on day 11', function () {
                data.day_in_month = 11;
                data.days = null;
                data.interval = 1;
                data.recurrence_type = 3;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Monatlich am 11.');
            });

            it('Every 2 months on day 11', function () {
                data.interval = 2;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Alle 2 Monate am 11.');
            });

            // Monthly - specific days
            it('Monthly on the first Friday', function () {
                data.day_in_month = 1;
                data.days = util.days.FRIDAY;
                data.interval = 1;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Monatlich am ersten Freitag.');
            });

            it('Monthly on the last Sunday', function () {
                data.day_in_month = -1;
                data.days = util.days.SUNDAY;
                data.interval = 1;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Monatlich am fünften / letzten Sonntag.');
            });

            // Monthly - specific days - interval > 1
            it('Every 3 months on the first Friday', function () {
                data.day_in_month = 1;
                data.days = util.days.FRIDAY;
                data.interval = 3;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Alle 3 Monate am ersten Freitag.');
            });

            it('Every 3 months on the last Sunday', function () {
                data.days = util.days.SUNDAY;
                data.day_in_month = 5;
                data.interval = 3;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Alle 3 Monate am fünften / letzten Sonntag.');
            });

            // Yearly
            it('Yearly on January 29', function () {
                data.day_in_month = 29;
                data.days = null;
                data.interval = 1;
                data.month = 0;
                data.recurrence_type = 4;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Jährlich am 29. Januar.');
            });

            // Yearly - specific days
            it('Yearly on the first Friday of July', function () {
                data.day_in_month = 1;
                data.days = util.days.FRIDAY;
                data.interval = 1;
                data.month = 6;
                var str = util.getRecurrenceString(data);
                expect(str).to.equal('Jährlich am ersten Freitag im Juli.');
            });

        });

        describe.skip('can resolve group ids to user arrays', function () {
            var userList = {
                'timestamp': 1385422043857,
                'data': [
                    [1, 6, 'Max Muster1', 'Max', 'Muster1', 'Founder', 21, 'maxmuster1@open-xchange.com', null, 10],
                    [2, 6, 'Max Muster2', 'Max', 'Muster1', '', 22, 'maxmuster2@open-xchange.com', null, 11],
                    [3, 6, 'Max Muster3', 'Max', 'Muster1', null, 23, 'maxmuster3@open-xchange.com', null, 12],
                    [4, 6, 'Max Muster4', 'Max', 'Muster1', 'CEO', 24, 'maxmuster4@open-xchange.com', null, 13]
                ]
            };

            beforeEach(function () {
                this.server.respondWith('PUT', /api\/user\?action=list/, function (xhr) {
                    xhr.respond(200, { 'Content-Type': 'text/javascript;charset=UTF-8' }, JSON.stringify(userList));
                });
                this.server.respondWith('PUT', /api\/group\?action=list/, function (xhr) {
                    xhr.respond(200, { 'Content-Type': 'text/javascript;charset=UTF-8' },
                        '{"timestamp":1383694139525,"data":[{"id":1337,"display_name":"dream-team","members":[21,22,23,24],"last_modified_utc":1383694139525,"name":"dream-team"}]}'
                    );
                });
            });

            it('for test group', function (done) {
                util.resolveParticipants({ participants: [{ id: 1337, type: 2 }] }).then(function (result) {
                    var expectedResult = [{
                        'id': 1,
                        'folder_id': 6,
                        'display_name': 'Max Muster1',
                        'first_name': 'Max',
                        'last_name': 'Muster1',
                        'title': 'Founder',
                        'internal_userid': 21,
                        'email1': 'maxmuster1@open-xchange.com',
                        'image1_url': null,
                        'contact_id': 10,
                        'mail': 'maxmuster1@open-xchange.com',
                        'mail_field': 1
                    }, {
                        'id': 2,
                        'folder_id': 6,
                        'display_name': 'Max Muster2',
                        'first_name': 'Max',
                        'last_name': 'Muster1',
                        'title': '',
                        'internal_userid': 22,
                        'email1': 'maxmuster2@open-xchange.com',
                        'image1_url': null,
                        'contact_id': 11,
                        'mail': 'maxmuster2@open-xchange.com',
                        'mail_field': 1
                    }, {
                        'id': 3,
                        'folder_id': 6,
                        'display_name': 'Max Muster3',
                        'first_name': 'Max',
                        'last_name': 'Muster1',
                        'title': null,
                        'internal_userid': 23,
                        'email1': 'maxmuster3@open-xchange.com',
                        'image1_url': null,
                        'contact_id': 12,
                        'mail': 'maxmuster3@open-xchange.com',
                        'mail_field': 1
                    }, {
                        'id': 4,
                        'folder_id': 6,
                        'display_name': 'Max Muster4',
                        'first_name': 'Max',
                        'last_name': 'Muster1',
                        'title': 'CEO',
                        'internal_userid': 24,
                        'email1': 'maxmuster4@open-xchange.com',
                        'image1_url': null,
                        'contact_id': 13,
                        'mail': 'maxmuster4@open-xchange.com',
                        'mail_field': 1
                    }];
                    expect(result).to.deep.equal(expectedResult);
                    done();
                });
            });
        });

        describe('can compute folder color', function () {
            describe('resolves folder color', function () {
                it('without color label', function () {
                    expect(util.getFolderColor({})).to.equal('#CEE7FF');
                });
                it('with color label', function () {
                    expect(util.getFolderColor({ 'com.openexchange.calendar.extendedProperties': { color: { value: 'lightblue' } } })).to.equal('lightblue');
                });
            });
            describe('resolve appointment color', function () {
                it('with appointment without color', function () {
                    var folder = { 'com.openexchange.calendar.extendedProperties': { color: { value: 'lightblue' } } },
                        appointment = new Backbone.Model({ attendees: [{ entity: 1337, partStat: 'ACCEPTED' }] });

                    expect(util.getAppointmentColor(folder, appointment)).to.equal('lightblue');
                });
                it('with appointment with color', function () {
                    var folder = { 'com.openexchange.calendar.extendedProperties': { color: { value: 'lightblue' } } },
                        appointment = new Backbone.Model({ color: '#aabbcc', attendees: [{ entity: 1337, partStat: 'ACCEPTED' }] });

                    expect(util.getAppointmentColor(folder, appointment)).to.equal('#aabbcc');
                });
                it('with private appointment without color', function () {
                    var folder = { 'com.openexchange.calendar.extendedProperties': { color: { value: 'lightblue' } } },
                        appointment = new Backbone.Model({ class: 'CONFIDENTIAL', attendees: [{ entity: 1337, partStat: 'ACCEPTED' }] });

                    expect(util.getAppointmentColor(folder, appointment)).to.equal('#666666');
                });

                it('with private appointment with color', function () {
                    var folder = { 'com.openexchange.calendar.extendedProperties': { color: { value: 'lightblue' } } },
                        appointment = new Backbone.Model({ class: 'CONFIDENTIAL', color: '#aabbcc', attendees: [{ entity: 1337, partStat: 'ACCEPTED' }] });

                    expect(util.getAppointmentColor(folder, appointment)).to.equal('#aabbcc');
                });
                it('with shared unconfirmed appointment', function () {
                    var folder = { 'com.openexchange.calendar.extendedProperties': { color: { value: 'lightblue' } }, type: 3 },
                        appointment = new Backbone.Model({ created_by: 377, attendees: [{ entity: 1337, partStat: 'NEEDS-ACTION' }] });

                    expect(util.getAppointmentColor(folder, appointment)).to.equal('');
                });
                it('with public folder', function () {
                    var folder = { 'com.openexchange.calendar.extendedProperties': { color: { value: 'lightblue' } }, type: 2 },
                        appointment = new Backbone.Model({ created_by: 377, attendees: [{ entity: 1337, partStat: 'ACCEPTED' }] });

                    expect(util.getAppointmentColor(folder, appointment)).to.equal('lightblue');
                });
            });
            describe('detects, if appointment is editable', function () {
                it('with appointment without color', function () {
                    var folder = { 'com.openexchange.calendar.extendedProperties': { color: { value: 'lightblue' } } },
                        appointment = new Backbone.Model({ attendees: [{ entity: 1337, partStat: 'ACCEPTED' }] });

                    expect(util.canAppointmentChangeColor(folder, appointment)).to.equal(true);
                });
                it('with appointment with color', function () {
                    var folder = { 'com.openexchange.calendar.extendedProperties': { color: { value: 'lightblue' } } },
                        appointment = new Backbone.Model({ color: '#aabbcc', attendees: [{ entity: 1337, partStat: 'ACCEPTED' }] });

                    expect(util.canAppointmentChangeColor(folder, appointment)).to.equal(false);
                });
                it('with private appointment without color', function () {
                    var folder = { 'com.openexchange.calendar.extendedProperties': { color: { value: 'lightblue' } } },
                        appointment = new Backbone.Model({ class: 'CONFIDENTIAL', attendees: [{ entity: 1337, partStat: 'ACCEPTED' }] });

                    expect(util.canAppointmentChangeColor(folder, appointment)).to.equal(false);
                });

                it('with private appointment with color', function () {
                    var folder = { 'com.openexchange.calendar.extendedProperties': { color: { value: 'lightblue' } } },
                        appointment = new Backbone.Model({ class: 'CONFIDENTIAL', color: '#aabbcc', attendees: [{ entity: 1337, partStat: 'ACCEPTED' }] });

                    expect(util.canAppointmentChangeColor(folder, appointment)).to.equal(false);
                });
                it('with shared unconfirmed appointment', function () {
                    var folder = { 'com.openexchange.calendar.extendedProperties': { color: { value: 'lightblue' } }, type: 3 },
                        appointment = new Backbone.Model({ color: '#aabbcc', created_by: 377, attendees: [{ entity: 1337, partStat: 'NEEDS-ACTION' }] });

                    expect(util.canAppointmentChangeColor(folder, appointment)).to.equal(false);
                });
            });
        });

        describe('can compute color to hex', function () {
            it('converts rgb colors', function () {
                expect(util.colorToHex('rgb(23, 167, 237)')).to.equal(1550317);
            });
            it('converts rgba colors', function () {
                expect(util.colorToHex('rgba(23, 167, 237, 80)')).to.equal(1550317);
            });
            it('converts hsl colors', function () {
                expect(util.colorToHex('hsl(195, 53%, 79%)')).to.equal(11393254);
            });
            it('converts colors by name', function () {
                expect(util.colorToHex('lightblue')).to.equal(11393254);
            });
        });

        it('converts hex (as number) to hsl', function () {
            expect(util.hexToHSL(0xadd8e6)).to.deep.equal([194, 53, 79]);
        });

        it('computes foreground color for background-color with an appropriate contrast ratio', function () {
            // contrast computation is the same as in the chrome developer accessibility tools
            function luminance(r, g, b) {
                var a = [r, g, b].map(function (v) {
                    v /= 255;
                    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
                });
                return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
            }
            function contrast(bg, fg) {
                var bgLuminance, fgLuminance;
                bgLuminance = luminance(bg[0], bg[1], bg[2]);
                if (fg === 'black') fgLuminance = luminance(0, 0, 0);
                else if (fg === 'white') fgLuminance = luminance(255, 255, 255);
                return (Math.max(fgLuminance, bgLuminance) + 0.05) / (Math.min(fgLuminance, bgLuminance) + 0.05);
            }

            // yellow
            expect(contrast([255, 255, 0], util.getForegroundColor('rgb(255, 255, 0)'))).to.be.above(4.54);
            // red
            expect(contrast([255, 0, 0], util.getForegroundColor('rgb(255, 0, 0)'))).to.be.above(4.54);
            // blue
            console.log(util.getForegroundColor('rgb(0, 0, 255)'));
            expect(contrast([0, 0, 255], util.getForegroundColor('rgb(0, 0, 255)'))).to.be.above(4.54);
            // black
            expect(contrast([0, 0, 0], util.getForegroundColor('rgb(0, 0, 0)'))).to.be.above(4.54);
            // white
            expect(contrast([255, 255, 255], util.getForegroundColor('rgb(255, 255, 255)'))).to.be.above(4.54);
        });

    });

    describe('createAttendee', function () {

        // partial user object
        var testUser = {
                contact_id: 123456,
                display_name: 'Test, Miss',
                email1: 'miss.test@test.com',
                first_name: 'Miss',
                folder_id: 123,
                id: 1337,
                last_name: 'Test',
                user_id: 1337
            },
            testUserResult = {
                cuType: 'INDIVIDUAL',
                cn: 'Test, Miss',
                partStat: 'NEEDS-ACTION',
                comment: '',
                entity: 1337,
                email: 'miss.test@test.com',
                uri: 'mailto:miss.test@test.com',
                contactInformation: {
                    folder: 123,
                    contact_id: 123456
                }
            },
            // test resource object
            testResource = {
                description: 'Now with 20% more PEW PEW',
                display_name: 'Deathstar',
                email1: '',
                id: 319,
                type: 3
            },
            testResourceResult = {
                cn: 'Deathstar',
                comment: 'Now with 20% more PEW PEW',
                cuType: 'RESOURCE',
                entity: 319,
                partStat: 'ACCEPTED'
            },
            // test contact object
            testContact = {
                display_name: 'Smith, Hannibal',
                email1: 'hannibal@a.team',
                first_name: 'Hannibal',
                folder_id: 123,
                id: 1337,
                internal_userid: 0,
                last_name: 'Smith',
                type: 5
            },
            testContactResult = {
                cn: 'Smith, Hannibal',
                comment: '',
                cuType: 'INDIVIDUAL',
                email: 'hannibal@a.team',
                partStat: 'NEEDS-ACTION',
                uri: 'mailto:hannibal@a.team',
                contactInformation: {
                    folder: 123,
                    contact_id: 1337
                }
            },
            // input from addParticipants for external contacts not in your gab
            inputFragment = {
                display_name: 'vader',
                email1: 'vader@dark.side',
                field: 'email1',
                type: 5
            };

        it('should return undefined if no argument is given', function () {
            expect(util.createAttendee()).to.equal(undefined);
        });

        it('should work with user object', function () {
            util.createAttendee(testUser).should.deep.equal(testUserResult);
        });

        it('should work with user model', function () {
            util.createAttendee(new Backbone.Model(testUser)).should.deep.equal(testUserResult);
        });

        it('should work with contact object', function () {
            util.createAttendee(testContact).should.deep.equal(testContactResult);
        });

        it('should work with contact model', function () {
            util.createAttendee(new Backbone.Model(testContact)).should.deep.equal(testContactResult);
        });

        it('should handle resources correctly', function () {
            util.createAttendee(testResource).should.deep.equal(testResourceResult);
            util.createAttendee(new Backbone.Model(testResource)).should.deep.equal(testResourceResult);
        });

        it('should add predefined values', function () {
            var result = _.copy(testUserResult);
            result.partStat = 'ACCEPTED';
            util.createAttendee(testUser, { partStat: 'ACCEPTED' }).should.deep.equal(result);
        });

        it('should resolve distribution lists', function () {
            util.createAttendee({ mark_as_distributionlist: true, distribution_list: [testUser, testContact] }, { partStat: 'ACCEPTED' }).should.deep.equal([testUserResult, testContactResult]);
        });

        it('should work with input fragments created by addParticipants autocomplete', function () {
            util.createAttendee(inputFragment).should.deep.equal({
                cn: 'vader',
                comment: '',
                cuType: 'INDIVIDUAL',
                email: 'vader@dark.side',
                partStat: 'NEEDS-ACTION',
                uri: 'mailto:vader@dark.side',
                contactInformation: {
                    folder: undefined,
                    contact_id: undefined
                }
            });
        });
    });

});
