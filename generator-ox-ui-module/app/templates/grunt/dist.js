'use strict';

module.exports = function (grunt) {
    var languages = grunt.file.expand({
        filter: isPackagedLanguage
    }, 'i18n/*.po').map(function (fileName) {
        return fileName.match(/([a-zA-Z]+_[a-zA-Z]+).po$/)[1];
    });

    function isPackagedLanguage(file) {
        //filter all languages that should not be packaged
        //those will have something like ""X-Package: no\n"" in their header
        var content = grunt.file.read(file),
        included = !/^\s*"X-Package: (?:off|no|false|0)(?:\\n)?"\s*$/im.test(content);
        if (!included) {
            grunt.verbose.writeln('Filtered file: ', file);
        }
        return included;
    }


    function isTranslationModule(file) {
        return file.match(/\.([a-zA-Z]+_[a-zA-Z]+)\.js$/) && grunt.file.isFile(file);
    }

    function isPackagedTranslationModule(file) {
        var _ = require('underscore'),
            languagePart = file.match(/\.([a-zA-Z]+_[a-zA-Z]+)\.js$/)[1];
        return _(languages).contains(languagePart);
    }

    grunt.config.extend('copy', {
        dist: {
            files: [
                {
                    expand: true,
                    src: ['apps/**/*', 'manifests/**/*', '*.*', '!*.js'],
                    cwd: 'build/',
                    dest: 'dist/<%= pkg.name %>-<%= pkg.version %>/'
                },
                {
                    src: ['debian/**/*', '*.spec', '!**/*.hbs'],
                    dest: 'dist/package/'
                }
            ]
        }
    });

    grunt.config.extend('uglify', {
        dist: {
            files: [{
                src: 'apps/**/*.js',
                cwd: 'build/',
                dest: 'dist/<%= pkg.name %>-<%= pkg.version %>/',
                filter: function (f) {
                    return !isTranslationModule(f) &&  grunt.file.isFile(f);
                },
                expand: true
            }]
        },
        dist_i18n: {
            files: [
                {
                    expand: true,
                    src: ['apps/**/*.js'],
                    cwd: 'build/',
                    dest: 'dist/<%= pkg.name %>-<%= pkg.version %>/',
                    filter: isPackagedTranslationModule
                }
            ]
        }
    });

    grunt.config.extend('assemble', {
        dist: {
            options: {
                ext: '',
                languages: (function () {
                    return languages.map(function (Lang) {
                        return {
                            Lang: Lang,
                            lang: Lang.toLowerCase().replace(/_/g, '-')
                        };
                    });
                })()
            },
            files: [{
                src: ['debian/**/*.hbs', '*.hbs'],
                dest: 'dist/package/'
            }]
        }
    });

    grunt.config.extend('compress', {
        source: {
            options: {
                archive: 'dist/<%= pkg.name %>_<%= pkg.version %>.orig.tar.gz',
                pretty: true
            },
            files: [{
                expand: true,
                src: ['<%= pkg.name %>-<%= pkg.version %>/**/*', '<%= pkg.name %>-<%= pkg.version %>/**/.htaccess'],
                cwd: 'dist/'
            }]
        }
    });

    grunt.loadNpmTasks('grunt-contrib-compress');
    grunt.loadNpmTasks('assemble');
};
