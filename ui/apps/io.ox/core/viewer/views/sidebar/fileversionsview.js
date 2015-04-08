/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Mario Schroeder <mario.schroeder@open-xchange.com>
 */
define('io.ox/core/viewer/views/sidebar/fileversionsview', [
    'io.ox/backbone/disposable',
    'io.ox/core/extensions',
    'io.ox/core/extPatterns/links',
    'io.ox/core/viewer/eventdispatcher',
    'io.ox/files/api',
    'io.ox/core/api/user',
    'io.ox/core/viewer/util',
    'gettext!io.ox/core/viewer'
], function (DisposableView, Ext, LinksPattern, EventDispatcher, FilesAPI, UserAPI, Util, gt) {

    'use strict';

    var POINT = 'io.ox/core/viewer/sidebar/versions',
        PANEL_STATE_OPEN = 'open',
        PANEL_STATE_OPENING = 'opening',
        PANEL_STATE_COLLAPSED = 'collapsed';

    // Extensions for the file versions view
    Ext.point(POINT).extend({
        index: 400,
        id: 'versions',
        draw: function (baton) {
            //console.info('FileVersionsView.draw()');
            var self = this,
                panel, panelBody,
                model = baton && baton.model,
                numberOfVersions = model && model.get('numberOfVersions'),
                panelState = baton.panelState;

            this.empty();

            // mail and PIM attachments don't support versions
            if (!model || !model.isDriveFile()) {
                this.attr({ 'aria-hidden': 'true' }).addClass('hidden');
                return;
            }

            if (numberOfVersions === 0) {
                // get number of versions
                FilesAPI.get({ id: model.get('id'), folder_id: model.get('folderId') }, { cache: false })
                /*.done(function (file) {
                    console.info('FilesAPI.get() ok ', file);
                })*/
                .fail(function (err) {
                    console.warn('FilesAPI.get() error ', err);
                });

            } else if (numberOfVersions > 1) {
                // we already have the number of versions,
                // but we display the versions panel only if we have at least 2 versions

                // a11y
                self.attr({ role: 'tablist', 'aria-hidden': 'false' }).removeClass('hidden');

                // render panel
                panel = Util.createPanelNode({
                    title: gt('Versions (%1$d)', _.noI18n(numberOfVersions)),
                    collapsed: (panelState !== PANEL_STATE_OPEN)
                });
                panelBody = panel.find('.panel-body');
                Ext.point(POINT + '/list').invoke('draw', panelBody, Ext.Baton({ model: model, data: model.get('origData') }));

                self.append(panel);

                // if the panel was about to slide down before repainting, we need to trigger this manually
                if (panelState === PANEL_STATE_OPENING) {
                    panel.find('.toggle-panel').trigger('click');
                }
            }
        }
    });

    // Extensions for the file versions list
    Ext.point(POINT + '/list').extend({
        index: 10,
        id: 'versions-list',
        draw: function (baton) {
            //console.info('FileVersionsView.draw()');
            var model = baton && baton.model,
                versions = model && model.get('versions'),
                table;

            function drawAllVersions(allVersions) {
                _.chain(allVersions)
                .sort(versionSorter)
                .each(function (version) {
                    var entryRow = $('<tr>').addClass('version').append(
                                $('<td>').addClass('version-label' + (version.current_version ? ' current' : '')).append(
                                    $('<div>').text(gt.noI18n(version.version)).attr('title', gt.noI18n(version.version))
                                )
                            );

                    Ext.point(POINT + '/version').invoke('draw', entryRow, Ext.Baton({ data: version }));
                    table.append(entryRow);
                });
            }

            function versionSorter (version1, version2) {
                // current version always on top
                if (version1.current_version) {
                    return -versions.length;
                } else if (version2.current_version) {
                    return versions.length;
                }
                return version2.version - version1.version;
            }

            this.empty();
            if (!model || !_.isArray(versions)) { return; }

            table = $('<table>').addClass('versiontable table').append(
                        $('<caption>').addClass('sr-only').text(gt('File version table, the first row represents the current version.')),
                        $('<thead>').addClass('sr-only').append(
                            $('<tr>').append(
                                $('<th>').text(gt('Version number')),
                                $('<th>').text(gt('File'))
                            )
                        )
                    );

            drawAllVersions(versions);

            this.append(table);
        }
    });

    // dropdown
    Ext.point(POINT + '/version/dropdown').extend(new LinksPattern.Dropdown({
        index: 10,
        label: '',
        ref: 'io.ox/files/versions/links/inline'
    }));

    // Extensions for the version detail table
    Ext.point(POINT + '/version').extend({
        index: 10,
        id: 'filename',
        draw: function (baton) {
            baton.label = '';   // the label is set via CSS
            var row,
                $node;

            this.append(
                row = $('<td>').addClass('version-content')
            );

            Ext.point(POINT + '/version/dropdown').invoke('draw', row, baton);
            $node = row.find('div.dropdown > a');

            Util.setClippedLabel($node, baton.data.filename);
        }
    });

    // Basic Info Fields
    Ext.point(POINT + '/version').extend({
        id: 'created_by',
        index: 20,
        draw: function (baton) {
            var $node;
            this.find('td:last').append($node = $('<div class="createdby">'));

            UserAPI.getName(baton.data.created_by)
            .done(function (name) {
                Util.setClippedLabel($node, name);
            })
            .fail(function (err) {
                console.warn('UserAPI.getName() error ', err);
                $node.text(gt('unknown'));
            });
        }
    });

    Ext.point(POINT + '/version').extend({
        id: 'last_modified',
        index: 30,
        draw: function (baton) {
            var d = Util.getDateFormated(baton.data.last_modified, { fulldate: true, filtertoday: false });
            this.find('td:last').append($('<div class="last_modified">').text(gt.noI18n(d)));
        }
    });

    Ext.point(POINT + '/version').extend({
        id: 'size',
        index: 40,
        draw: function (baton) {
            var size = (_.isNumber(baton.data.file_size)) ? _.filesize(baton.data.file_size) : '-';
            this.find('td:last').append($('<div class="size">').text(gt.noI18n(size)));
        }
    });

    Ext.point(POINT + '/version').extend({
        id: 'comment',
        index: 50,
        draw: function (baton) {
            var $node;

            if (!_.isEmpty(baton.data.version_comment)) {
                this.find('td:last').append(
                    $('<div class="comment">').append(
                        ($node = $('<span class="version-comment">'))
                    )
                );

                Util.setClippedLabel($node, baton.data.version_comment);
            }
        }
    });

    /**
     * The FileVersionsView is intended as a sub view of the SidebarView and
     * is responsible for displaying the history of file versions.
     */
    var FileVersionsView = DisposableView.extend({

        className: 'viewer-fileversions',

        events: {
            'click .toggle-panel': 'onTogglePanel'
        },

        onTogglePanel: function (event) {
            var self = this,
                model = this.model,
                panelHeading = this.$el.find('.panel>.panel-heading'),
                panelBody = this.$el.find('.panel>.panel-body');

            event.preventDefault();
            if (!model) { return; }

            if (panelBody.hasClass('panel-collapsed')) {
                // get file version history
                if (!model.get('versions')) {
                    panelHeading.busy();
                    this.panelState = PANEL_STATE_OPENING;

                    // get file versions
                    FilesAPI.versions.load({
                        id: model.get('id'),
                        folder_id: model.get('folderId')
                    })
                    .done(function (versions) {
                        console.info('FilesAPI.versions.load()', versions);

                        // expand the panel
                        panelBody.slideDown().removeClass('panel-collapsed');
                        self.panelState = PANEL_STATE_OPEN;
                    })
                    .fail(function (err) {
                        console.warn('FilesAPI.versions.load() error ', err);
                    })
                    .always(function () {
                        panelHeading.idle();
                    });

                } else {
                    // expand the panel
                    panelBody.slideDown().removeClass('panel-collapsed');
                    this.panelState = PANEL_STATE_OPEN;
                }

            } else {
                // collapse the panel
                panelBody.slideUp().addClass('panel-collapsed');
                this.panelState = PANEL_STATE_COLLAPSED;
            }
        },

        /**
         * Event handler for version handling changes.
         * Listens on: 'versions', 'currentVersion', 'numberOfVersions' and 'version'
         */
        onModelChangeVersions: function (model) {
            console.info('FileVersionsView.onModelChangeVersions()', 'changed:', model.changed, 'model:', model);

            var baton = Ext.Baton({ model: model, data: model.get('origData'), panelState: this.panelState });
            Ext.point(POINT).invoke('draw', this.$el, baton);
        },

        initialize: function () {
            //console.info('FileVersionsView.initialize()');
            this.on('dispose', this.disposeView.bind(this));
            this.model = null;
            this.panelState = PANEL_STATE_COLLAPSED;
        },

        render: function (data) {
            //console.info('FileVersionsView.render() ', data);
            var baton;

            if (!data || !data.model) { return this; }

            this.panelState = PANEL_STATE_COLLAPSED;
            baton = Ext.Baton({ model: data.model, data: data.model.get('origData'), panelState: this.panelState });

            // remove listener from previous model
            if (this.model) {
                this.stopListening(this.model, 'change:versions change:currentVersion change:numberOfVersions change:version');
            }

            // add listener to new model
            this.model = data.model;
            this.listenTo(this.model, 'change:versions change:currentVersion change:numberOfVersions change:version', this.onModelChangeVersions);

            Ext.point(POINT).invoke('draw', this.$el, baton);
            return this;
        },

        disposeView: function () {
            //console.info('FileVersionsView.disposeView()');
            this.model.off().stopListening();
            this.model = null;
            return this;
        }
    });

    return FileVersionsView;
});
