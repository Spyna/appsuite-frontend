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
                            'bootstrap-datepicker/less/datepicker3.less',
                            'font-awesome/{less,fonts}/*',
                            'open-sans-fontface/fonts/Light/*',
                            '!**/*.otf'
                        ],
                        cwd: 'bower_components/',
                        dest: 'build/apps/3rd.party/',
                        filter: 'isFile'
                    },
                    {
                        expand: true,
                        src: ['**/*', '!tinymce.min.js'],
                        cwd: 'bower_components/tinymce-dist',
                        dest: 'build/apps/3rd.party/tinymce/'
                    },
                    {
                        expand: true,
                        src: ['hopscotch/*'],
                        cwd: 'lib/',
                        dest: 'build/apps/3rd.party/'
                    },
                    {
                        // static lib
                        expand: true,
                        src: ['jquery-ui.min.js', 'bootstrap-combobox.js', 'socket.io.js'],
                        cwd: 'lib/',
                        dest: 'build/static/3rd.party/'
                    },
                    {
                        // static bower_components
                        expand: true,
                        src: [
                            'bigscreen/bigscreen.min.js',
                            'bootstrap-datepicker/js/bootstrap-datepicker.js',
                            'jquery-imageloader/jquery.imageloader.js',
                            'Chart.js/Chart.js',
                            'bootstrap-tokenfield/js/bootstrap-tokenfield.js',
                            'typeahead.js/dist/typeahead.jquery.js',
                            'marked/lib/marked.js',
                            'clipboard/dist/clipboard.min.js',
                            'velocity/velocity.min.js',
                            'moment/moment.js'
                        ],
                        cwd: 'bower_components',
                        dest: 'build/static/3rd.party/'
                    },
                    {
                        // static bower_components
                        expand: true,
                        flatten: true,
                        src: [
                            'moment-timezone/builds/moment-timezone-with-data.js',
                            'moment-interval/moment-interval.js'
                        ],
                        cwd: 'bower_components',
                        dest: 'build/static/3rd.party/moment'
                    },
                    {
                        expand: true,
                        src: ['*.{png,svg,swf,gif,xap,css}', '!{jquery,*.min}.js'],
                        cwd: 'bower_components/mediaelement/build/',
                        dest: 'build/apps/3rd.party/mediaelement/',
                        filter: 'isFile'
                    },
                    {
                        // js file of mediaelement goes to static path for caching
                        expand: true,
                        src: ['*.js', '!{jquery,*.min}.js'],
                        cwd: 'bower_components/mediaelement/build/',
                        dest: 'build/static/3rd.party/mediaelement/',
                        filter: 'isFile'
                    },
                    {
                        expand: true,
                        src: ['*.{js,css,png}'],
                        cwd: 'lib/node_modules/emoji/lib',
                        dest: 'build/apps/3rd.party/emoji'
                    },
                    {
                        expand: true,
                        src: ['swiper.jquery.js'],
                        cwd: 'bower_components/swiper/dist/js/',
                        dest: 'build/static/3rd.party/swiper'
                    },
                    {
                        expand: true,
                        src: ['*.css'],
                        cwd: 'bower_components/swiper/dist/css/',
                        dest: 'build/apps/3rd.party/swiper'
                    },
                    {
                        expand: true,
                        src: ['**/*'],
                        cwd: 'bower_components/pdfjs-dist',
                        dest: 'build/apps/pdfjs-dist/'
                        // pdfjs now has it's own define: define('pdfjs-dist/build/pdf.combined', ...)
                    },
                    {
                        expand: true,
                        src: ['unorm.js'],
                        cwd: 'bower_components/unorm/lib/',
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
                        var defineName = (srcPath.split('.').shift()).replace('bower_components/', '');
                        return content.replace(/define\(\['moment'\]/, 'define(\'' + defineName + '\', [\'moment\']');
                    }
                },
                files: [{
                    expand: true,
                    src: ['moment/locale/*'],
                    cwd: 'bower_components',
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
                        return src.replace(/@import "..\/bower_components\/(.*)";/g, '');
                    }
                },
                files: [{
                    expand: true,
                    ext: '.css',
                    cwd: 'bower_components/bootstrap-tokenfield/less/',
                    src: ['*.less'],
                    dest: 'build/apps/3rd.party/bootstrap-tokenfield/css/'
                }]
            }
        }
    });
};
