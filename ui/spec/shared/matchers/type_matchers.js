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
if (jasmine) {

    var typeMatchers = {
            toBeBoolean: function () {
                return this.actual === true || this.actual === false;
            },

            //functions
            toBeFunction: function () {
                return this.actual instanceof Function;
            },

            //special: jQuery
            toBeJquery: function () {
                var result = this.actual instanceof $;
                expect(this.isNot ? !result : result).toBeTruthy();
                return true;
            },
            toBeEmptyJquery: function () {
                var result = this.actual && this.actual.length === 0;
                expect(this.isNot ? !result : result).toBeTruthy();
                return true;
            }
        };

    beforeEach(function () {
        this.addMatchers(typeMatchers);
    });
}
