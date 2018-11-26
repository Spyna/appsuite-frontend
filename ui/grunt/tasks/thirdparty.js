/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2016 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author David Bauer <david.bauer@open-xchange.com>
 * @author Julian Bäume <julian.baeume@open-xchange.com>
 */

'use strict';

module.exports = function (grunt) {

    grunt.config.merge({
        copy: {
            build_thirdparty: {
                files: [
                    {
                        expand: true,
                        src: [
                            'bootstrap/less/**/*.less',
                            'font-awesome/{less,fonts}/*',
                            'open-sans-fontface/fonts/Light/*',
                            '!**/*.otf'
                        ],
                        cwd: 'node_modules/',
                        dest: 'build/apps/3rd.party/',
                        filter: 'isFile'
                    },
                    {
                        flatten: true,
                        expand: true,
                        src: ['*.ttf'],
                        dest: 'build/apps/3rd.party/fonts/',
                        cwd: 'apps/io.ox/core/about/'
                    },
                    {
                        expand: true,
                        src: [
                            'tinymce/jquery.tinymce.js',
                            'tinymce/jquery.tinymce.min.js',
                            'tinymce/{plugins,skins,themes}/**/*',
                            'tinymce/tinymce.js'
                        ],
                        cwd: 'node_modules/',
                        dest: 'build/apps/3rd.party/'
                    },
                    {
                        expand: true,
                        src: [
                            'bootstrap-datepicker/less/datepicker3.less',
                            'tinymce/{langs,plugins,skins,themes}/**/*',
                            '{hopscotch,emoji}/*.{js,css,png}'
                        ],
                        cwd: 'node_modules/@open-xchange/',
                        dest: 'build/apps/3rd.party/'
                    },
                    {
                        // static lib
                        expand: true,
                        src: ['jquery-ui.min.js'],
                        cwd: 'lib/',
                        dest: 'build/static/3rd.party/'
                    },
                    {
                        flatten: true,
                        expand: true,
                        src: [
                            '@open-xchange/bootstrap-datepicker/js/bootstrap-datepicker.js',
                            '@open-xchange/bootstrap-tokenfield/js/bootstrap-tokenfield.js',
                            'socket.io-client/dist/socket.io.slim.js',
                            'bigscreen/bigscreen.min.js',
                            'chart.js/dist/Chart.min.js',
                            'clipboard/dist/clipboard.min.js',
                            'croppie/croppie.min.js',
                            'marked/lib/marked.js',
                            'resize-polyfill/lib/polyfill-resize.js',
                            'swiper/dist/js/swiper.js',
                            'typeahead.js/dist/typeahead.jquery.js',
                            'dompurify/dist/purify.min.js'
                        ],
                        cwd: 'node_modules',
                        dest: 'build/static/3rd.party/'
                    },
                    {
                        expand: true,
                        flatten: true,
                        src: [
                            'moment/moment.js',
                            'moment-timezone/builds/moment-timezone-with-data.js',
                            '@open-xchange/moment-interval/moment-interval.js'
                        ],
                        cwd: 'node_modules',
                        dest: 'build/static/3rd.party/moment'
                    },
                    {
                        expand: true,
                        src: ['*.css'],
                        cwd: 'node_modules/swiper/dist/css/',
                        dest: 'build/apps/3rd.party/swiper'
                    },
                    {
                        expand: true,
                        src: ['croppie.css'],
                        cwd: 'node_modules/croppie',
                        dest: 'build/apps/3rd.party/croppie'
                    },
                    {
                        expand: true,
                        src: [
                            'build/pdf.min.js',
                            'build/pdf.worker.min.js',
                            'web/images/*'
                        ],
                        cwd: 'node_modules/pdfjs-dist',
                        dest: 'build/apps/pdfjs-dist/',
                        rename: function (dest, src) {
                            return dest + src.replace(/\.min.js$/, '.js');
                        }
                    },
                    {
                        expand: true,
                        src: ['unorm.js'],
                        cwd: 'node_modules/unorm/lib/',
                        dest: 'build/static/3rd.party/unorm'
                    }
                ]
            }
        }
    });

    // replace the anonymous defines in the moment.js locales to prevent require.js errors
    grunt.config.merge({
        copy: {
            build_moment_locales: {
                options: {
                    process: function (content, srcPath) {
                        var defineName = (srcPath.split('.').shift()).replace('node_modules/', '');
                        return content.replace(/define\(\['\.\.\/moment'\]/, 'define(\'' + defineName + '\', [\'moment\']');
                    }
                },
                files: [{
                    expand: true,
                    src: ['moment/locale/*'],
                    cwd: 'node_modules',
                    dest: 'build/static/3rd.party/'
                }]
            }
        }
    });

    grunt.config.merge({
        less: {
            build_tokenfield: {
                options: {
                    lessrc: '.lessrc',
                    process: function (src) {
                        return src.replace(/@import "..\/node_modules\/(.*)";/g, '');
                    }
                },
                files: [{
                    expand: true,
                    ext: '.css',
                    cwd: 'node_modules/@open-xchange/bootstrap-tokenfield/less/',
                    src: ['*.less'],
                    dest: 'build/apps/3rd.party/bootstrap-tokenfield/css/'
                }]
            }
        }
    });
};
