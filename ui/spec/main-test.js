var tests = Object.keys(window.__karma__.files).filter(function (file) {
    return /spec\.js$/.test(file);
});

requirejs.config({
    // Karma serves files from '/base/apps'
    baseUrl: '/base/apps',

    // ask Require.js to load these files (all our tests)
    deps: tests,

    // start test run, once Require.js is done
    callback: window.__karma__.start
});

var root = location.pathname.replace(/\/[^\/]*$/, '');
window.ox = {
    abs: location.protocol + '//' + location.host,
    apiRoot: root + '/api',
    base: '',
    context_id: 0,
    debug: true,
    language: 'de_DE',
    logoutLocation: 'signin',
    online: false,
    revision: '1',
    root: root,
    secretCookie: false, // auto-login
    serverConfig: {},
    version: new Date(),
    session: {
        context_id: 0,
        locale: "de_DE",
        random: "44444444444444444444444444444444",
        session: "13371337133713371337133713371337",
        user: "jan.doe",
        user_id: 1337
    },
    signin: true,
    t0: new Date().getTime(), // for profiling
            testTimeout: 1000,
            ui: { session: {} },
            user: '',
            user_id: 0,
            windowState: 'foreground'
};

if (jasmine) {
    /**
     * Hack pending specs/expected fails
     *
     * It’s possible to provide an option parameter to the sharedExamples
     * call with an attribute 'markedPending'. This must contain an object
     * with attributes for each (full) spec name representing a truthy value.
     *
     * This method will then fail the spec if the test is marked pending and doesn’t fail.
     * Or it will just skip it otherwise.
     *
     * Jasmine from master branch supports pending specs, so once we update, we can change
     * this to native jasmine.
     *
     */
    jasmine.Spec.prototype.handleExpectedFail = function (markedPending) {
        if (!markedPending[this.getFullName()]) {
            return;
        }

        if (this.results().passed()) {
            console.error('expected to fail: ' + this.getFullName());
            this.results_.totalCount++;
            this.results_.failedCount++;
            return;
        }
        this.results_.skipped = true;
        this.results_.items_ = [];
        this.results_.totalCount = 1;
        this.results_.passedCount = 1;
        this.results_.failedCount = 0;
    };
}
