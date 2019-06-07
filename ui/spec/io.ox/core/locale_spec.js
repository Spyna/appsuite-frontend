/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2019 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define(['io.ox/core/locale'], function (locale) {

    describe('Locale', function () {

        it('returns current locale as de_DE', function () {
            expect(locale.current()).to.equal('de_DE');
        });

        it('set proper date format', function () {
            var m = moment([2019, 5, 5, 13, 37]);
            expect(m.format('L')).to.equal('05.06.2019');
            expect(m.format('LL')).to.equal('5. Juni 2019');
            expect(m.format('LT')).to.equal('13:37');
        });

        it('formats number with 0 fraction digits correctly', function () {
            expect(locale.number(111)).to.equal('111');
            expect(locale.number(123.5)).to.equal('124');
            expect(locale.number(1234.56)).to.equal('1.235');
            expect(locale.number(1234.567)).to.equal('1.235');
        });

        it('formats number with 2 fraction digits correctly', function () {
            expect(locale.number(111, 2)).to.equal('111,00');
            expect(locale.number(123.5, 2)).to.equal('123,50');
            expect(locale.number(1234.56, 2)).to.equal('1.234,56');
            expect(locale.number(1234.567, 2)).to.equal('1.234,57');
        });

        it('formats percentages correctly', function () {
            expect(locale.percent(1234.51, 1)).to.equal('1.234,5 %');
        });

        it('formats currency correctly', function () {
            expect(locale.currency(1234)).to.equal('1.234,00 €');
        });

        it('return correct default format', function () {
            expect(locale.getDefaultNumberFormat()).to.equal('1.234,56');
        });

        it('returns localeData correctly', function () {
            expect(locale.getLocaleData()).to.deep.equal({
                date: 'dd.MM.yyyy',
                dateFull: 'EEEE, d. MMMM yyyy',
                dateLong: 'd. MMMM yyyy',
                dateMedium: 'dd.MM.yyyy',
                dateShort: 'dd.MM.yyyy',
                firstDayOfWeek: 'monday',
                firstDayOfYear: 4,
                number: '1.234,56',
                time: 'HH:mm',
                timeLong: 'HH:mm:ss'
            });
        });

        it('sets custom formats correctly', function () {
            locale.setLocaleData({ timeLong: 'HH.mm.ss', date: 'dd-MM-yyyy' });
            var m = moment([2019, 5, 5, 13, 37]);
            expect(m.format('L')).to.equal('05-06-2019');
            expect(m.format('LL')).to.equal('5. Juni 2019');
            expect(m.format('LT')).to.equal('13.37');
        });

        it('return start of week', function () {
            expect(locale.getFirstDayOfWeek()).to.equal('Montag');
        });

        it('returns default locale', function () {
            expect(locale.meta.getDefaultLocale()).to.equal('de_DE');
        });

        it('returns default locale from cookie', function () {
            _.setCookie('locale', 'de_CH');
            expect(locale.meta.getValidDefaultLocale()).to.equal('de_CH');
        });

        it('returns valid default locale', function () {
            _.setCookie('locale', 'de_DE');
            ox.serverConfig.languages = _(locale.meta.locales).omit('de_DE');
            expect(locale.meta.getValidDefaultLocale()).to.equal('en_US');
        });

        it('returns valid default locale if en_US is not listed', function () {
            _.setCookie('locale', 'en_US');
            ox.serverConfig.languages = _(locale.meta.locales).omit('en_US');
            expect(locale.meta.getValidDefaultLocale()).to.equal('ca_ES');
        });
    });
});
