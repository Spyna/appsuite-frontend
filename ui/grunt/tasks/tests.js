'use strict';

module.exports = function (grunt) {
    grunt.config.set('copy.specs', {
        files: [{
            expand: true,
            src: ['spec/**/*', '!spec/disabled/**/*'],
            dest: 'build/'
        }]
    });
    grunt.config.set('karma.continuous.reporters', ['spec']);
    grunt.config.set('karma.continuous.browsers', (process.env.BROWSERS || 'ChromeHeadless').split(' '));
};
