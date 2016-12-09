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

    // displays the execution time of grunt tasks
    if (grunt.option('benchmark') || grunt.config('local.benchmark')) require('time-grunt')(grunt);

    grunt.registerTask('bootjs', ['newer:copy:ox', 'newer:concat:bootjs']);

    grunt.registerTask('lint', ['newer:eslint:all', 'newer:jsonlint:all']);
    grunt.registerTask('lint:specs', ['newer:eslint:all', 'newer:jsonlint:specs']);

    //Override the default tasks

    //default implementation uses newer, we don't want that, because it has some problems and copy is fast anyway
    grunt.registerTask('copy_build', grunt.util.runPrefixedSubtasksFor('copy', 'build'));

    // steps to build the ui (ready for development)
    grunt.registerTask('build', ['lint', 'copy_build', 'compile_po', 'concat', 'newer:less']);
    // create a package ready version of the ui (aka what jenkins does)
    grunt.registerTask('dist', ['clean', 'checkDependencies:build', 'bower', 'build', 'uglify', 'copy_dist', 'create_i18n_properties']);

    grunt.registerTask('refresh', 'force an update and reload the broweser', ['force_update', 'send_livereload']);
};
