/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2011 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/mail/write/test/html_send',
    ['io.ox/mail/write/main',
     'io.ox/mail/api',
     'io.ox/core/api/user',
     'io.ox/core/extensions'
    ], function (writer, mailAPI, userAPI, ext) {

    'use strict';

    var TIMEOUT = ox.testTimeout;

    // helpers
    function Done() {
        var f = function () {
            return f.value;
        };
        f.value = false;
        f.yep = function () {
            f.value = true;
        };
        return f;
    }

    /*
     * Suite: Compose mail
     */
    ext.point('test/suite').extend({
        id: 'mail-compose-html',
        index: 100,
        test: function (j) {

            j.describe('Compose email', function () {

                var app = null, ed = null, form = null;

                j.it('opens compose dialog in HTML mode', function () {

                    var loaded = new Done();

                    j.waitsFor(loaded, 'compose dialog', TIMEOUT);

                    writer.getApp().launch().done(function () {
                        app = this;
                        app.compose().done(function () {
                            app.setFormat('html').done(function () {
                                ed = app.getEditor();
                                form = app.getWindow().nodes.main.find('form');
                                loaded.yep();
                                j.expect(ed).toBeDefined();
                                j.expect(form).toBeDefined();
                                j.expect(ed.getMode()).toEqual('html');
                            });
                        });
                    });
                });

                j.it('adds recipient', function () {
                    // enter email address and press <enter>
                    form.find('input[data-type=to]').val('otto.xentner@io.ox')
                        .focus()
                        .trigger($.Event('keyup', { which: 13 }));
                    // check for proper DOM node
                    var to = form.find('.recipient-list input[type=hidden][name=to]');
                    j.expect(to.val())
                        .toEqual('"otto.xentner" <otto.xentner@io.ox>');
                });

                j.it('adds recipient with display name', function () {
                    // enter email address and press <enter>
                    form.find('input[data-type=to]').val('"Otto X." <otto.xentner@io.ox>')
                        .focus()
                        .trigger($.Event('keyup', { which: 13 }));
                    // check for proper DOM node
                    var to = form.find('.recipient-list input[type=hidden][name=to]').last();
                    j.expect(to.val())
                        .toEqual('"Otto X." <otto.xentner@io.ox>');
                });

                j.it('adds recipient by focussing another element', function () {
                    // enter email address and blur
                    form.find('input[data-type=to]').val('"Otto;must escape,this" <otto.xentner@io.ox>')
                        .focus().blur(); // IE has delay when focusing another element
                    // check for proper DOM node
                    var to = form.find('.recipient-list input[type=hidden][name=to]').last();
                    j.expect(to.val())
                        .toEqual('"Otto;must escape,this" <otto.xentner@io.ox>');
                });

                j.it('adds multiple recipients at once', function () {
                    // enter email address and blur
                    form.find('input[data-type=to]')
                        .val(' "Otto;must escape,this" <otto.xentner@io.ox>; "Hannes" <hannes@ox.io>, ' +
                                'Horst <horst@ox.io>;, ')
                        .focus().blur();
                    // check for proper DOM node
                    var to = form.find('.recipient-list input[type=hidden][name=to]').slice(-3);
                    j.expect(true)
                        .toEqual(
                            to.eq(0).val() === '"Otto;must escape,this" <otto.xentner@io.ox>' &&
                            to.eq(1).val() === '"Hannes" <hannes@ox.io>' &&
                            to.eq(2).val() === '"Horst" <horst@ox.io>'
                        );
                });

                j.it('opens CC section', function () {
                    // open section
                    form.find('[data-section-link=cc]').trigger('click');
                    var section = form.find('[data-section=cc]:visible');
                    j.expect(section.length)
                        .toEqual(1);
                });

                j.it('adds recipient to CC', function () {
                    // enter email address and press <enter>
                    form.find('input[data-type=cc]').val('otto.xentner@io.ox')
                        .focus()
                        .trigger($.Event('keyup', { which: 13 }));
                    // check for proper DOM node
                    var cc = form.find('.recipient-list input[type=hidden][name=cc]');
                    j.expect(cc.val())
                        .toEqual('"otto.xentner" <otto.xentner@io.ox>');
                });

                j.it('opens BCC section', function () {
                    // open section
                    form.find('[data-section-link=bcc]').trigger('click');
                    var section = form.find('[data-section=bcc]:visible');
                    j.expect(section.length)
                        .toEqual(1);
                });

                j.it('adds recipient to BCC', function () {
                    // enter email address and press <enter>
                    form.find('input[data-type=bcc]').val('hannes@io.ox')
                        .focus()
                        .trigger($.Event('keyup', { which: 13 }));
                    // check for proper DOM node
                    var bcc = form.find('.recipient-list input[type=hidden][name=bcc]');
                    j.expect(bcc.val())
                        .toEqual('"hannes" <hannes@io.ox>');
                });

                j.it('removes recipient from BCC', function () {
                    // get proper DOM node
                    var a, b;
                    a = form.find('.recipient-list input[type=hidden][name=bcc]');
                    a.parent().find('a.remove').trigger('click');
                    // get proper DOM node (again)
                    b = form.find('.recipient-list input[type=hidden][name=bcc]');
                    j.expect(true)
                        .toEqual(a.length === 1 && b.length === 0);
                });

                j.it('closes BCC section', function () {
                    // open section
                    form.find('[data-section-label=bcc]').trigger('click');
                    var section = form.find('[data-section=bcc]:visible');
                    j.expect(section.length)
                        .toEqual(0);
                });

                j.it('sets high priority', function () {
                    // change radio button
                    form.find('input[name=priority]').eq(0).focus().prop('checked', true).trigger('change').blur();
                    // check priority overlay
                    var overlay = form.find('.priority-overlay');
                    j.expect(overlay.hasClass('high'))
                        .toEqual(true);
                });

                j.it('sets subject', function () {
                    // set subject via class
                    form.find('input.subject').val('TEST: Hello World');
                    // check via name attribute
                    j.expect(form.find('input[name=subject]').val())
                        .toEqual('TEST: Hello World');
                });

                j.it('sets editor content', function () {
                    ed.setContent(' <p>Lorem ipsum</p>\r\n ');
                    j.expect(ed.getContent())
                        .toEqual('<p>Lorem ipsum</p>');
                });

                j.it('has correct mail body', function () {
                    var data = app.getMail().data;
                    j.expect(
                            data.attachments &&
                            data.attachments.length &&
                            data.attachments[0].content_type === 'text/html'
                        ).toEqual(true);
                    j.expect(data.attachments[0].content)
                        .toEqual('<p>Lorem ipsum</p>');
                });

                j.it('has correct mail props (bcc)', function () {
                    var data = app.getMail().data;
                    j.expect(_.isArray(data.bcc) && data.bcc.length === 0)
                        .toEqual(true);
                });

                j.it('has correct mail props (cc)', function () {
                    var data = app.getMail().data;
                    j.expect(
                            _.isArray(data.cc) && data.cc.length === 1 &&
                            data.cc[0][0] === '"otto.xentner"' && data.cc[0][1] === 'otto.xentner@io.ox'
                        )
                        .toEqual(true);
                });

                j.it('has correct mail props (from)', function () {
                    var data = app.getMail().data;
                    j.expect(_.isArray(data.from) && data.from.length === 1)
                        .toEqual(true);
                });

                j.it('has correct mail props (priority)', function () {
                    var data = app.getMail().data;
                    j.expect(data.priority === 1)
                        .toEqual(true);
                });

                j.it('has correct mail props (subject)', function () {
                    var data = app.getMail().data;
                    j.expect(data.subject === 'TEST: Hello World')
                        .toEqual(true);
                });

                j.it('has correct mail props (to)', function () {
                    var data = app.getMail().data;
                    j.expect(
                            _.isArray(data.to) && data.to.length === 6 &&
                            data.to[4][0] === '"Hannes"' && data.to[4][1] === 'hannes@ox.io'
                        )
                        .toEqual(true);
                });

                j.it('has correct mail props (vcard)', function () {
                    var data = app.getMail().data;
                    j.expect(data.vcard === 0)
                        .toEqual(true);
                });

                var sentMailId = {}, sentOriginalData;

                if (!_.browser.IE) {

                    j.it('sends mail successfully', function () {
                        var data = app.getMail().data, done = new Done(), myself = ox.user_id;
                        j.waitsFor(done, 'mail being send', TIMEOUT);
                        // get myself
                        userAPI.get({ id: myself })
                            .done(function (myself) {
                                // just send to myself
                                data.to = [['"' + myself.display_name + '"', myself.email1]];
                                data.cc = [];
                                data.bcc = [];
                                sentOriginalData = data;
                                mailAPI.send(data)
                                    .always(function (result) {
                                        done.yep();
                                        sentMailId = String(result.data);
                                        j.expect(result.error).toBeUndefined();
                                    });
                            });
                    });

                    j.it('verifies that sent mail is ok', function () {
                        var done = new Done(),
                            data = sentOriginalData,
                            split = sentMailId.split(/\/(\d+$)/);

                        j.waitsFor(done, 'mail being fetched', TIMEOUT);
                        mailAPI.get({ folder: split[0], id: split[1] })
                            .done(function (sent) {
                                sent.to[0][0] = '"' + sent.to[0][0] + '"';
                                done.yep();
                                j.expect(
                                    _.isEqual(sent.subject, data.subject) &&
                                    _.isEqual(sent.from, data.from) &&
                                    _.isEqual(sent.to, data.to) &&
                                    _.isEqual(sent.cc, data.cc) &&
                                    _.isEqual(sent.bcc, data.bcc) &&
                                    _.isEqual(sent.priority, data.priority) &&
                                    _.isEqual(sent.vcard || 0, data.vcard || 0)
                                )
                                .toEqual(true);
                            });
                    });
                }

                j.it('closes compose dialog', function () {
                    // mark app as clean so no save as draft question will pop up
                    app.dirty(false).quit();
                    j.expect(app.getEditor).toBeUndefined();
                    app = ed = form = null;
                });
            });
        }
    });
});
