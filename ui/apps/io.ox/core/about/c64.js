/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2012 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/core/about/c64',
    ['less!io.ox/core/about/c64.less'], function () {

    'use strict';

    var keydown = function (e) {
        if (e.which === 27) {
            $('.c64').remove();
            $(document).off('keydown', keydown);
        }
    };

    var focus = function () {
        $(this).attr('contenteditable', 'true');
        $(this).find('.cursor').remove();
    };

    return function () {

        $('body').append(
            $('<div class="c64">').append(
                $('<div class="inner" tabindex="-1">').append(
                    $('<div class="cursor">'),
                    $.txt(
                        '\n' +
                        '    **** COMMODORE 64 BASIC V2 ****\n' +
                        '\n' +
                        ' 64K RAM SYSTEM  57462 BASIC BYTES FREE\n' +
                        '\n' +
                        'READY.\n' +
                        'LIST\n' +
                        '\n' +
                        '100 REM   UI Team' + '\n' +
                        '110 REM -----------------------' + '\n' +
                        '110 REM   Matthias Biggeleben' + '\n' +
                        '120 REM   Francisco Laguna' + '\n' +
                        '130 REM   Christoph Kopp' + '\n' +
                        '140 REM   Tobias Prinz' + '\n' +
                        '150 REM   Christoph Hellweg' + '\n' +
                        '160 REM   Alexander Quast' + '\n' +
                        '170 REM   Frank Paczynski' + '\n' +
                        '180 REM   Julian Baeume' + '\n' +
                        '190 REM   David Bauer' + '\n' +
                        '200 REM   Daniel Dickhaus' + '\n' +
                        '210 REM   Viktor Pracht' + '\n' +
                        '220 REM -----------------------' + '\n' +
                        '\n' +
                        'READY.\n'
                    )
                )
                .on('focus', focus)
            )
        );

        $(document).on('keydown', keydown);
    };
});
