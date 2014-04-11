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
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 */

define('io.ox/files/main',
    ['io.ox/core/commons',
     'gettext!io.ox/files',
     'settings!io.ox/files',
     'io.ox/core/extensions',
     'io.ox/core/api/folder',
     'io.ox/core/extPatterns/actions',
     'io.ox/files/actions',
     'io.ox/files/folderview-extensions',
     'less!io.ox/files/style'
    ], function (commons, gt, settings, ext, folderAPI, actions) {

    'use strict';

    // application object
    var app = ox.ui.createApp({ name: 'io.ox/files', title: 'Drive' }),
        // app window
        win;

    //map old settings/links
    function map(pers) {
        var mapping;
        if (/^(icons)$/.test(pers)) {
            //support old setting value
            mapping = 'fluid:icon';
        } else if (!/^(fluid:list|fluid:icon|fluid:tile)$/.test(pers)) {
            mapping = 'fluid:list';
        }
        return mapping || pers;
    }

    // launcher
    app.setLauncher(function (options) {
        // get window
        app.setWindow(win = ox.ui.createWindow({
            name: 'io.ox/files',
            title: 'Drive',
            toolbar: true,
            search: true
        }));

        win.addClass('io-ox-files-main');
        app.settings = settings;

        commons.wirePerspectiveEvents(app);
        
        app.on('folder:change', function (id, data) {
            if(folderAPI.is('trash', data)) {//no new files in trash folders
                ext.point('io.ox/files/links/toolbar').disable('default');//that's the plus sign
            } else {
                ext.point('io.ox/files/links/toolbar').enable('default');//that's the plus sign
            }
           win.updateToolbar();
        });

        // folder tree
        commons.addFolderView(app, { type: 'infostore', rootFolderId: settings.get('rootFolderId') });

        win.nodes.outer.on('selection:drop', function (e, baton) {
            actions.invoke('io.ox/files/actions/move', null, baton);
        });

        // fix missing default folder
        options.folder = options.folder || folderAPI.getDefaultFolder('infostore') || 9;

        //use last manually choosen perspective (mode) as default
        win.on('change:perspective', function (e, name, long) {
                if (settings.get('view') !== long) {
                    settings.set('view', long).save();
                }
            });

        // go!
        return commons.addFolderSupport(app, null, 'infostore', options.folder)
            .pipe(commons.showWindow(win))
            .done(function () {
                var pers = map(options.perspective || _.url.hash('perspective') || settings.get('view', 'fluid:list'));
                ox.ui.Perspective.show(app, pers);
            });
    });

    return {
        getApp: app.getInstance
    };
});
