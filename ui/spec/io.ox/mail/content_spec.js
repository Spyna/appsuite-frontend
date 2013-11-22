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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define(['io.ox/mail/detail/content', 'settings!io.ox/mail'], function (content, settings) {

    'use strict';

    describe('Mail content processing', function () {

        ox.serverConfig.hosts = ['localhost'];

        function process(str, type) {
            return content.get({
                attachments: [{ content: str, content_type: type || 'text/html', disp: 'inline' }]
            });
        }

        it('should detect empty email', function () {
            var result = process('');
            expect(result.content.html()).toBe('<div class="alert alert-info">Diese E-Mail hat keinen Inhalt</div>');
        });

        it('should process basic html', function () {
            var result = process('<p>Hello World</p>');
            expect(result.content.html()).toBe('<p>Hello World</p>');
        });

        it('should process plain text', function () {
            var result = process('\r\rHello World ', 'text/plain');
            expect(result.content.html()).toBe('Hello World');
        });

        it('should set proper class for plain text mails', function () {
            var result = process('Test', 'text/plain');
            expect(result.content.hasClass('plain-text')).toBe(true);
        });

        it('should set proper class for fixed width fonts', function () {
            settings.set('useFixedWidthFont', true).detach();
            var result = process('Test', 'text/plain');
            expect(result.content.hasClass('fixed-width-font')).toBe(true);
        });

        it('should remove leading <br> tags', function () {
            var result = process(' <br/> <br />  <br >text', 'text/plain');
            expect(result.content.html()).toBe('text');
        });

        it('should reduce long <br> sequences', function () {
            var result = process('text<br><br><br><br>text<br><br>', 'text/plain');
            expect(result.content.html()).toBe('text<br><br>text<br><br>');
        });

        it('should simplify links', function () {
            var result = process('text <a href="http://localhost/path?query" target="_blank">http://localhost/path?query</a> &lt;<a href="http://localhost/path?query" target="_blank">http://localhost/path?query</a>&gt; text');
            expect(result.content.html()).toBe('text <a href="http://localhost/path?query" target="_blank">http://localhost/path?query</a> text');
        });

        // Mail address

        it('should detect email addresses (text/plain)', function () {
            var result = process('test<br>otto.xantner@open-xchange.com<br>test', 'text/plain');
            expect(result.content.html()).toBe('test<br><a href="mailto:otto.xantner@open-xchange.com" target="_blank">otto.xantner@open-xchange.com</a><br>test');
        });

        it('should detect email addresses (text/html; @)', function () {
            var result = process('<p><a href="mailto:otto.xantner@open-xchange.com">otto.xantner@open-xchange.com</a></p>');
            expect(result.content.html()).toBe('<p><a href="mailto:otto.xantner@open-xchange.com" target="_blank">otto.xantner@open-xchange.com</a></p>');
        });

        it('should detect email addresses (text/html; &#64;)', function () {
            // https://bugs.open-xchange.com/show_bug.cgi?id=29892
            var result = process('<p><a href="mailto:otto.xantner&#64;open-xchange.com">Otto Xantner</a></p>');
            expect(result.content.html()).toBe('<p><a href="mailto:otto.xantner@open-xchange.com" target="_blank">Otto Xantner</a></p>');
        });

        // Folder

        it('should detect folder links (html, old-school)', function () {
            var result = process('<p>Link: <a href="http://localhost/appsuite/?foo#m=infostore&f=1234">http://localhost/appsuite/?foo#m=infostore&f=1234</a>.</p>');
            expect(result.content.html()).toBe('<p>Link: <a href="http://localhost/appsuite/?foo#m=infostore&amp;f=1234" target="_blank" class="deep-link deep-link-files" style="text-decoration: none; font-family: Arial;"><span class="label label-info">Ordner</span></a>.</p>');
        });

        it('should detect folder links (html)', function () {
            var result = process('<p>Link: <a href="http://localhost/appsuite/#app=io.ox/files&folder=1337">http://localhost/appsuite/#app=io.ox/files&folder=1337</a>.</p>');
            expect(result.content.html()).toBe('<p>Link: <a href="http://localhost/appsuite/#app=io.ox/files&amp;folder=1337" target="_blank" class="deep-link deep-link-files" style="text-decoration: none; font-family: Arial;"><span class="label label-info">Ordner</span></a>.</p>');
        });

        it('should detect folder links (html, variant)', function () {
            var result = process('<p>Link: <a href="http://localhost/appsuite/#app=io.ox/files&perspective=fluid:icon&folder=1337">http://localhost/appsuite/#app=io.ox/files&perspective=fluid:icon&folder=1337</a>.</p>');
            expect(result.content.html()).toBe('<p>Link: <a href="http://localhost/appsuite/#app=io.ox/files&amp;perspective=fluid:icon&amp;folder=1337" target="_blank" class="deep-link deep-link-files" style="text-decoration: none; font-family: Arial;"><span class="label label-info">Ordner</span></a>.</p>');
        });

        // File

        it('should detect file links (html, old-school)', function () {
            var result = process('<p>Link: <a href="http://localhost/appsuite/?foo#m=infostore&f=1234&i=0">http://localhost/appsuite/?foo#m=infostore&f=1234&i=0</a>.</p>');
            expect(result.content.html()).toBe('<p>Link: <a href="http://localhost/appsuite/?foo#m=infostore&amp;f=1234&amp;i=0" target="_blank" class="deep-link deep-link-files" style="text-decoration: none; font-family: Arial;"><span class="label label-info">Datei</span></a>.</p>');
        });

        it('should detect file links (html)', function () {
            var result = process('<p>Link: <a href="http://localhost/appsuite/#app=io.ox/files&folder=1337&id=0">http://localhost/appsuite/#app=io.ox/files&folder=1337&id=0</a>.</p>');
            expect(result.content.html()).toBe('<p>Link: <a href="http://localhost/appsuite/#app=io.ox/files&amp;folder=1337&amp;id=0" target="_blank" class="deep-link deep-link-files" style="text-decoration: none; font-family: Arial;"><span class="label label-info">Datei</span></a>.</p>');
        });

        it('should detect file links (html, variant)', function () {
            var result = process('<p>Link: <a href="http://localhost/appsuite/#app=io.ox/files&perspective=fluid:icon&folder=1337&id=0">http://localhost/appsuite/#app=io.ox/files&perspective=fluid:icon&folder=1337&id=0</a>.</p>');
            expect(result.content.html()).toBe('<p>Link: <a href="http://localhost/appsuite/#app=io.ox/files&amp;perspective=fluid:icon&amp;folder=1337&amp;id=0" target="_blank" class="deep-link deep-link-files" style="text-decoration: none; font-family: Arial;"><span class="label label-info">Datei</span></a>.</p>');
        });

        // Appointment

        it('should detect appointment links (html, old-school)', function () {
            var result = process('<p>Link: <a href="http://localhost/appsuite/?foo#m=calendar&i=0&f=1234">http://localhost/appsuite/?foo#m=calendar&i=0&f=1234</a>.</p>');
            expect(result.content.html()).toBe('<p>Link: <a href="http://localhost/appsuite/?foo#m=calendar&amp;i=0&amp;f=1234" target="_blank" class="deep-link deep-link-calendar" style="text-decoration: none; font-family: Arial;"><span class="label label-info">Termin</span></a>.</p>');
        });

        it('should detect appointment links (html)', function () {
            var result = process('<p>Link: <a href="http://localhost/appsuite/#app=io.ox/calendar&folder=1337&id=0">http://localhost/appsuite/#app=io.ox/calendar&folder=1337&id=0</a>.</p>');
            expect(result.content.html()).toBe('<p>Link: <a href="http://localhost/appsuite/#app=io.ox/calendar&amp;folder=1337&amp;id=0" target="_blank" class="deep-link deep-link-calendar" style="text-decoration: none; font-family: Arial;"><span class="label label-info">Termin</span></a>.</p>');
        });

        // Task

        it('should detect task links (html, old-school)', function () {
            var result = process('<p>Link: <a href="http://localhost/appsuite/?foo#m=tasks&i=0&f=1234">http://localhost/appsuite/?foo#m=tasks&i=0&f=1234</a>.</p>');
            expect(result.content.html()).toBe('<p>Link: <a href="http://localhost/appsuite/?foo#m=tasks&amp;i=0&amp;f=1234" target="_blank" class="deep-link deep-link-tasks" style="text-decoration: none; font-family: Arial;"><span class="label label-info">Aufgabe</span></a>.</p>');
        });

        it('should detect task links (html)', function () {
            var result = process('<p>Link: <a href="http://localhost/appsuite/#app=io.ox/tasks&id=1337.0&folder=1337">http://localhost/appsuite/#app=io.ox/tasks&id=1337.0&folder=1337</a>.</p>');
            expect(result.content.html()).toBe('<p>Link: <a href="http://localhost/appsuite/#app=io.ox/tasks&amp;id=1337.0&amp;folder=1337" target="_blank" class="deep-link deep-link-tasks" style="text-decoration: none; font-family: Arial;"><span class="label label-info">Aufgabe</span></a>.</p>');
        });
    });
});
