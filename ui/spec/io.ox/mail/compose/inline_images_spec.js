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
define(['io.ox/mail/compose/main', 'waitsFor'], function (compose, waitsFor) {
    'use strict';

    describe('Mail Compose', function () {
        var app, pictureHalo, snippetsGetAll;
        beforeEach(function () {
            return require(['io.ox/core/api/snippets', 'io.ox/contacts/api', 'settings!io.ox/mail'], function (snippetAPI, contactsAPI, settings) {
                snippetsGetAll = sinon.stub(snippetAPI, 'getAll', function () { return $.when([]); });
                pictureHalo = sinon.stub(contactsAPI, 'pictureHalo', _.noop);
                settings.set('messageFormat', 'html');
            }).then(function () {
                app = compose.getApp();
                return app.launch();
            });
        });
        afterEach(function () {
            if (app.view && app.view.model) {
                app.view.model.dirty(false);
            }
            snippetsGetAll.restore();
            pictureHalo.restore();
            return app.quit();
        });
        describe('inline images', function () {
            beforeEach(function () {
                this.server.respondWith('POST', /api\/mail\?action=new/, function (xhr) {
                    xhr.respond(200, 'content-type:text/javascript;', JSON.stringify({
                        data: 'default0/INBOX/Drafts/666'
                    }));
                });
                return app.compose({ folder: 'default0/INBOX' });
            });

            it('should switch to src attribute provided by backend response for img elements', function () {
                var api = require('io.ox/mail/api');
                var spy = sinon.stub(api, 'get');
                var def = waitsFor(function () {
                    console.log('mu');
                    return app.view.contentEditable.find('img').length > 0;
                });

                app.view.setBody('<div>some<img src="test.png" />text</div>');

                spy.withArgs({ id: '666', folder_id: 'default0/INBOX/Drafts' }).returns($.when({
                    attachments: [{
                        content: '<div>some<img src="test_changed_by_backend.png" />text</div>'
                    }]
                }));

                return $.when(def, app.view.saveDraft()).then(function () {
                    expect(spy.calledOnce, 'mailAPI.get called once').to.be.true;
                    var img = app.view.contentEditable.find('img');
                    expect(img.attr('src')).to.equal('test_changed_by_backend.png');
                }).always(function () {
                    spy.restore();
                });
            });
            it('should not switch src attribute of emoji icons', function () {
                var api = require('io.ox/mail/api');
                var spy = sinon.stub(api, 'get');
                var def = waitsFor(function () {
                    return app.view.contentEditable.find('img').length > 0;
                });

                app.view.setBody('<div>some<img src="test.png" />text and emoji<img src="1x1.gif" class="emoji" /></div>');

                spy.withArgs({ id: '666', folder_id: 'default0/INBOX/Drafts' }).returns($.when({
                    attachments: [{
                        content: '<div>some<img src="test_changed_by_backend.png" />text and emoji<img src="random change!should not happen.gif" class="emoji" /></div>'
                    }]
                }));

                return $.when(def, app.view.saveDraft()).then(function () {
                    expect(spy.calledOnce, 'mailAPI.get called once').to.be.true;
                    var imgs = $('img', app.view.contentEditable);
                    expect($(imgs[0]).attr('src')).to.equal('test_changed_by_backend.png');
                    expect($(imgs[1]).attr('src')).to.equal('1x1.gif');
                }).always(function () {
                    spy.restore();
                });
            });
        });
    });
});
