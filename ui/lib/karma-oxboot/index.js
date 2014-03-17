var createPattern = function(path) {
  return {pattern: path, included: true, served: true, watched: false};
};

var oxBoot = function(files) {
    var path = require('path'),
        builddir = path.resolve(__dirname + '/../../build/'),
        bootjs = createPattern(builddir + '/boot.js'),
        ts = new Date().getTime();
    bootjs.watched = true;
    files.unshift(createPattern(__dirname + '/adapter.js'));
    files.unshift({pattern: builddir + '/apps/**/*.js', included: false, served: true, watched: true});
    files.unshift(bootjs);
    files.unshift(createPattern(__dirname + '/pre_boot.js'));
    files.unshift(createPattern(__dirname + '/../../node_modules/sinon/pkg/sinon.js'));
};

oxBoot.$inject = ['config.files'];

module.exports = {
  'framework:oxboot': ['factory', oxBoot]
};
