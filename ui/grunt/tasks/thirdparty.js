/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author David Bauer <david.bauer@open-xchange.com>
 * @author Julian Bäume <julian.baeume@open-xchange.com>
 */

'use strict';

module.exports = function (grunt) {

    grunt.config.extend('copy', {
        thirdparty: {
            files: [
                {
                    expand: true,
                    src: [
                        'font-awesome/{less,fonts}/*',
                        'open-sans-fontface/fonts/Light/*',
                        'Chart.js/Chart.js',
                        'jquery-imageloader/jquery.imageloader.js',
                        '!**/*.otf'
                    ],
                    cwd: 'bower_components/',
                    dest: 'build/apps/3rd.party/',
                    filter: 'isFile'
                },
                {
                    expand: true,
                    src: ['view-qrcode.js', 'hopscotch/*', 'mobiscroll/css/*'],
                    cwd: 'lib/',
                    dest: 'build/apps/3rd.party/'
                },
                {
                    expand: true,
                    src: ['jquery-ui.min.js'],
                    cwd: 'lib/',
                    dest: 'build/static/3rd.party/'
                },
                {
                    expand: true,
                    src: ['*.{js,png,svg,swf,gif,css,xap}', '!{jquery,*.min}.js'],
                    cwd: 'bower_components/mediaelement/build/',
                    dest: 'build/apps/3rd.party/mediaelement/',
                    filter: 'isFile'
                },
                {
                    expand: true,
                    src: ['*.{js,css,png}'],
                    cwd: 'lib/node_modules/emoji/lib',
                    dest: 'build/apps/3rd.party/emoji'
                }
            ]
        }
    });
};
