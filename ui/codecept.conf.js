var fs = require('fs');
var _ = require('underscore');
var localConf = {};

if (fs.existsSync('grunt/local.conf.json')) {
    localConf = JSON.parse(fs.readFileSync('grunt/local.conf.json')) || {};
}
localConf.e2e = localConf.e2e || {};
localConf.e2e.helpers = localConf.e2e.helpers || {};

module.exports.config = {
    'tests': './e2e/tests/**/*_test.js',
    'timeout': 10000,
    'output': './build/e2e/',
    'helpers': {
        'Mochawesome': {
            'uniqueScreenshotNames': true
        },
        'WebDriver': _.extend({}, {
            'url': process.env.LAUNCH_URL || 'http://localhost:8337/appsuite/',
            'host': process.env.SELENIUM_HOST || '10.50.0.94',
            'smartWait': 1000,
            'waitForTimeout': 30000,
            'browser': 'chrome',
            'restart': true,
            'windowSize': 'maximize',
            'uniqueScreenshotNames': true,
            'desiredCapabilities': {
                'browserName': 'chrome',
                'chromeOptions': {
                    'args': ['no-sandbox']
                }
            }
        }, localConf.e2e.helpers.WebDriver || {}),
        OpenXchange: _.extend({}, {
            require: './e2e/helper',
            mxDomain: 'ox-e2e-backend.novalocal',
            serverURL: localConf.appserver && localConf.appserver.server || process.env.LAUNCH_URL
        }, localConf.e2e.helpers.OpenXchange || {})
    },
    'include': {
        'I': './e2e/actor',
        'users': './e2e/users'
    },
    'bootstrap': function (done) {
        // setup chai
        var chai = require('chai');
        chai.config.includeStack = true;
        // setup axe matchers
        require('./e2e/axe-matchers');

        var config = require('codeceptjs').config.get();
        if (config.helpers.WebDriver && /127\.0\.0\.1/.test(config.helpers.WebDriver.host)) {
            require('@open-xchange/codecept-helper').selenium
                .start(localConf.e2e.selenium)
                .then(done);
        } else {
            done();
        }
    },
    'teardown': function () {
        //HACK: defer killing selenium, because it's still needed for a few ms
        setTimeout(function () {
            require('@open-xchange/codecept-helper').selenium.stop();
        }, 500);
    },
    'mocha': {
        'reporterOptions': {
            'codeceptjs-cli-reporter': {
                'stdout': '-'
            },
            'mocha-junit-reporter': {
                'stdout': '-',
                'options': {
                    'mochaFile': './build/e2e/report.xml'
                }
            },
            'mochawesome': {
                'stdout': './build/e2e/console.log',
                'options': {
                    'reportTitle': 'E2E Report: App Suite UI',
                    'reportPageTitle': 'E2E: App Suite UI',
                    'inline': true,
                    'cdn': true,
                    'json': false,
                    'reportDir': './build/e2e',
                    'reportFilename': 'index',
                    'autoOpen': process.env.CI !== 'true',
                    'showPassed': false
                }
            }
        }
    },
    'name': 'App Suite Core UI'
};
