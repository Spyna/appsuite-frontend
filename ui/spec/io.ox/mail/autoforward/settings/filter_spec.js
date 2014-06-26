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
 * @author Christoph Kopp <christoph.kopp@open-xchange.com>
 */

define(['io.ox/mail/autoforward/settings/filter', 'gettext!io.ox/mail'], function (filter, gt) {

    'use strict';

    var resultWithFlag = { timestamp: 1378223251586,
        'data': [{
            'position': 1,
            'id': 1,
            'flags': ['autoforward'],
            'test': {
                'id': 'true'
            },
            'actioncmds': [{
                'to': 'tester@open-xchange.com',
                'id': 'redirect'
            },
            {
                'id': 'keep'
            }],
            'rulename': 'autoforward',
            'active': false
        }]
    },
    filtermodel = { id: 1,
        active: false,
        forwardmail: 'tester@open-xchange.com',
        userMainEmail: 'tester@open-xchange.com'
    },
    multiValues = {},
    model;

    describe('autoforward', function () {

        beforeEach(function (done) {
            this.server.respondWith('GET', /api\/mailfilter\?action=list&flag=autoforward/, function (xhr) {
                xhr.respond(200, { 'Content-Type': 'text/javascript;charset=UTF-8'}, JSON.stringify(resultWithFlag));
            });
            $('body', document).append(this.node = $('<div id="autoforwardtestNode">'));

            filter.editAutoForward(this.node, multiValues, 'tester@open-xchange.com').done(function (filtermodel) {
                model = filtermodel;
                done();
            });
        });

        afterEach(function () {
            $('#autoforwardtestNode', document).remove();
        });

        it('should draw the form', function () {
            expect(this.node.find('input[name="forwardmail"]')).to.have.length(1);
            expect(this.node.find('input[name="forwardmail"]').val()).to.equal('tester@open-xchange.com');
            expect(this.node.find('input[name="keep"]')).to.have.length(1);
            expect(this.node.find('input[name="keep"]').prop('checked')).to.be.true;
            expect(this.node.find('input[name="active"]')).to.have.length(1);
            expect(this.node.find('input[name="active"]').prop('checked')).to.be.false;
        });

        it.skip('should create the filtermodel', function () {
            //FIXME: behaviour seems to be changed, model.attributes.userMainEmail seems to be an empty object
            model.attributes.should.deep.equal(filtermodel);
        });

        it('should set a new forwardmail', function () {
            this.node.find('input[name="forwardmail"]').val('tester1@open-xchange.com').change();
            model.get('forwardmail').should.be.equal('tester1@open-xchange.com');
        });

        it('should set the rule to active', function () {
            this.node.find('input[type="checkbox"]').click();
            model.get('active').should.be.equal(true);
        });

    });

});
