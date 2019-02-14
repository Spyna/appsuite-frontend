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
define(['io.ox/mail/compose/model'], function (MailModel) {
    'use strict';

    describe('Mail Compose', function () {
        describe('different content types', function () {
            it('switching text -> html', function () {
                var model = new MailModel({
                    editorMode: 'text'
                });
                model.setContent('This is some plain text\n\n with line breaks and stuff.');
                expect(model.get('attachments').at(0).get('content_type')).to.equal('text/plain');
                model.setMailContentType('text/html');
                expect(model.get('content')).to.equal('This is some plain text\n\n with line breaks and stuff.');
                expect(model.get('attachments').at(0).get('content')).to.equal('This is some plain text\n\n with line breaks and stuff.');
                expect(model.get('attachments').at(0).get('content_type')).to.equal('text/html');
            });
            it('switching html -> text', function () {
                var model = new MailModel({
                    editorMode: 'html'
                });
                model.setContent('This is some <i>html</i> <b>text</b><br /><br> with line breaks and stuff.');
                expect(model.get('attachments').at(0).get('content_type')).to.equal('text/html');
                model.setMailContentType('text/plain');
                expect(model.get('attachments').at(0).get('content_type')).to.equal('text/plain');
                expect(model.get('attachments').at(0).get('content')).to.equal('This is some <i>html</i> <b>text</b><br /><br> with line breaks and stuff.');
                expect(model.get('content')).to.equal('This is some <i>html</i> <b>text</b><br /><br> with line breaks and stuff.');
            });
        });
    });
});
