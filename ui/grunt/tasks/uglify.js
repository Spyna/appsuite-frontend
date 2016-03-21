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
        uglify: {
            bootjs: {
                options: {
                    sourceMap: 'build/maps/boot.js.map',
                    sourceMapRoot: '/appsuite/<%= assemble.options.base %>',
                    sourceMappingURL: '/appsuite/<%= assemble.options.base %>/maps/boot.js.map',
                    sourceMapPrefix: 1
                },
                files: {
                    'dist/appsuite/boot.js': ['build/boot.js']
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-uglify');
};
