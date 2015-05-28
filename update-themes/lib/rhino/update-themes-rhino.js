/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2011 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Viktor Pracht <viktor.pracht@open-xchange.com>
 */

less.Parser.fileLoader = function (file, currentFileInfo, callback, env) {
    var pathname, dirname, data,
        newFileInfo = {
            relativeUrls: env.relativeUrls,
            entryPath: currentFileInfo.entryPath,
            rootpath: currentFileInfo.rootpath,
            rootFilename: currentFileInfo.rootFilename
        };

    var paths = [currentFileInfo.currentDirectory];
    if (env.paths) paths.push.apply(paths, env.paths);
    if (paths.indexOf('.') === -1) paths.push('.');

    for (var i = 0; i < paths.length; i++) {
        try {
            pathname = less.modules.path.join(paths[i], file);
            readFile(pathname);
            break;
        } catch (e) {
            pathname = null;
        }
    }

    if (!pathname) {
        callback({ type: 'File', message: "'" + file + "' wasn't found" });
        return;
    }

    try {
        data = readFile(pathname);
        var j = file.lastIndexOf('/');

        // Pass on an updated rootpath if path of imported file is relative and file
        // is in a (sub|sup) directory
        //
        // Examples:
        // - If path of imported file is 'module/nav/nav.less' and rootpath is 'less/',
        //   then rootpath should become 'less/module/nav/'
        // - If path of imported file is '../mixins.less' and rootpath is 'less/',
        //   then rootpath should become 'less/../'
        if(newFileInfo.relativeUrls && !/^(?:[a-z-]+:|\/)/.test(file) && j != -1) {
            var relativeSubDirectory = file.slice(0, j+1);
            newFileInfo.rootpath = newFileInfo.rootpath + relativeSubDirectory; // append (sub|sup) directory path of imported file
        }
        newFileInfo.currentDirectory = pathname.replace(/[^\\\/]*$/, "");
        newFileInfo.filename = pathname;

        callback(null, data, pathname, newFileInfo);
    } catch (e) {
        callback(e);
    }
};

(function main() {
    var style1 = readFile('apps/themes/style.less');
    var bootstrap = readFile('apps/3rd.party/bootstrap/less/bootstrap.less');
    var bootstrapDP = readFile('apps/3rd.party/bootstrap-datepicker/less/datepicker3.less');
    var fontAwesome = readFile('apps/3rd.party/font-awesome/less/font-awesome.less');

    var themes = new java.io.File('apps/themes').listFiles();
    for (var i = 0; i < themes.length; i++) {
        var dir = themes[i];
        if (!dir.isDirectory()) continue;
        function subDir(name) { return new java.io.File(dir, name); }
	defs2 = subDir('definitions.less');
	if (!defs2.exists()) continue;
	print('Processing', dir);
	deleteRecurse(/\.css$/, new java.io.File(dir));
	var defs = [bootstrap, bootstrapDP, fontAwesome, style1].join('\n');
	compileLess(defs, subDir('common.css'), '<multiple less files>');
	compileLess(readFile(subDir('style.less')),
		subDir('style.css'), '<default theme style.less>');
	recurse('', subDir, new java.io.File('apps'));
    }
}());

function deleteRecurse(filter, parent) {
    var files = parent.listFiles();
    for (var i = 0; i < files.length; i++) {
        var file = files[i], name = file.toString();
        if (file.isDirectory()) {
            deleteRecurse(filter, file);
        } else if (filter.test(name)) {
            file.delete();
        }
    }
}

function recurse(defs, subDir, parent) {
    var files = parent.listFiles();
    for (var i = 0; i < files.length; i++) {
        var file = files[i], name = file.toString();
        if (file.isDirectory()) {
            recurse(defs, subDir, file);
        } else {
            if (name.slice(-5) !== '.less') continue;
            if (name.slice(0, 12) === 'apps/themes/') continue;
            if (name.indexOf('apps/3rd.party/bootstrap/less/') === 0) continue;
            if (name.indexOf('apps/3rd.party/font-awesome/less/') === 0) continue;
            if (name.indexOf('apps/3rd.party/bootstrap-datepicker/less/') === 0) continue;
            var input = readFile(file.toString(), 'UTF-8');
            compileLess(input,
                        subDir(name.slice(5, -4) + 'css'), name);
        }
    }
}

function compileLess(input, outputFile, sourceFileName) {
    var fileName = outputFile.toString();
    var themeName = fileName.slice(12, fileName.indexOf('/', 12));
    var importConfig = {
            reference: [
                'variables.less',
                'mixins.less'
            ],
            less: [
                'definitions.less',
                themeName + '/definitions.less'
            ]
        };
    var imports = [];
    for (directive in importConfig) {
        importConfig[directive].forEach(function (file) {
            imports.push('@import (' + directive + ') "' + file + '";');
        });
    }
    input = imports.join('\n') + '\n' + input;

    new less.Parser({
        syncImport: true,
        relativeUrls: false,
        paths: [
            'apps/3rd.party/bootstrap/less',
            'apps/3rd.party/font-awesome/less',
            'apps/themes',
            'apps/themes/' + themeName
        ],
        filename: '' + sourceFileName
    }).parse(input, function (e, css) {
        if (e) return error(e, sourceFileName);
        outputFile.getParentFile().mkdirs();
        writeFile(outputFile, css.toCSS({
            compress: true,
            cleancss: true,
            ieCompat: false,
            strictMath: false,
            strictUnits: false
        }));
    });
}

function writeFile(filename, content) {
    var fos = new java.io.FileOutputStream(filename);
    var osw = new java.io.OutputStreamWriter(fos, 'UTF-8');
    osw.write(content, 0, content.length);
    osw.close();
}

// The rest is adapted from rhino.js of LessCSS

function loadStyleSheet(sheet, callback, reload, remaining) {
    var sheetName = sheet.href,
        dir = sheetName.replace(/[\w\.-]+$/, ''),
        input = readFile(sheetName, 'UTF-8');

    if (!sheet.contents) sheet.contents = {};
    sheet.contents[sheetName] = input;
    sheet.paths = [dir].concat(sheet.paths);
    if (sheet.relativeUrls) sheet.rootpath += dir;

    var parser = new less.Parser(sheet);
    parser.parse(input, function (e, root) {
        if (e) {
            return error(e, sheetName);
        }
        try {
            callback(e, root, input, sheet, { local: false, lastModified: 0, remaining: remaining }, sheetName);
        } catch(e) {
            error(e, sheetName);
        }
    });
}

function error(e, filename) {

    var content = "Error : " + filename + "\n";

    filename = e.filename || filename;

    if (e.message) {
        content += e.message + "\n";
    }

    var errorline = function (e, i, classname) {
        if (e.extract[i]) {
            content +=
                String(parseInt(e.line) + (i - 1)) +
                ":" + e.extract[i] + "\n";
        }
    };

    if (e.stack) {
        content += e.stack;
    } else if (e.extract) {
        content += 'on line ' + e.line + ', column ' + (e.column + 1) + ':\n';
        errorline(e, 0);
        errorline(e, 1);
        errorline(e, 2);
    }
    print(content);
    quit(1);
}
