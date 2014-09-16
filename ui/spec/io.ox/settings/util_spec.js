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
 * @author Frank Paczynski <frank.paczynski@open-xchange.com>
 */

define(['io.ox/settings/util'], function (util) {

    describe('Settings Utilities', function () {

        describe('yellOnReject function', function () {

            it('should always return a deferred', function () {
                expect(util.yellOnReject(undefined)).to.exist; //FIXME: check for deferred
            });

            describe('reject should trigger a notification', function () {

                var e = {
                        error: 'test error message',
                        error_params: []
                    }, def, text;

                // reset deferred
                beforeEach(function () {
                    def = new $.Deferred();
                    util.destroy();
                });

                it.skip('with default message (reject without args)', function () {
                    util.yellOnReject(def.reject());
                    text = $('.io-ox-alert-error').find('.message').find('div').text();
                    expect('unknown').to.equal(text);
                });

                it('with custom error message for MAIL_FILTER-0015', function () {
                    var e = {
                            code: 'MAIL_FILTER-0015'
                        };
                    util.yellOnReject(def);
                    def.reject(e);
                    text = $('.io-ox-alert-error').find('.message').find('div').text();
                    expect(text).not.to.equal('unknown');
                });
            });
        });
    });
});
