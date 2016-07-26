/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2016 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Mario Schroeder <mario.schroeder@open-xchange.com>
 */
define('io.ox/core/viewer/views/sidebar/fileversionsview', [
    'io.ox/core/viewer/views/sidebar/panelbaseview',
    'io.ox/core/extensions',
    'io.ox/core/extPatterns/links',
    'io.ox/files/api',
    'io.ox/core/api/user',
    'io.ox/core/viewer/util',
    'gettext!io.ox/core/viewer'
], function (PanelBaseView, Ext, LinksPattern, FilesAPI, UserAPI, Util, gt) {

    'use strict';

    var POINT = 'io.ox/core/viewer/sidebar/versions';

    // Extensions for the file versions list
    Ext.point(POINT + '/list').extend({
        index: 10,
        id: 'versions-list',
        draw: function (baton) {
            var model = baton && baton.model,
                isViewer = Boolean(baton && baton.isViewer),
                viewerEvents = baton && baton.viewerEvents,
                versions = model && model.get('versions'),
                panelHeading = this.find('.sidebar-panel-heading'),
                panelBody = this.find('.sidebar-panel-body'),
                table;

            function drawAllVersions(allVersions) {
                _.chain(allVersions)
                // avoid unnecessary model changes / change events
                .clone(versionSorter)
                .sort(versionSorter)
                .each(function (version) {
                    var entryRow = $('<tr class="version">');

                    Ext.point(POINT + '/version').invoke('draw', entryRow, Ext.Baton({ data: version, viewerEvents: viewerEvents, isViewer: isViewer }));
                    table.append(entryRow);
                });
            }

            function versionSorter(version1, version2) {
                // current version always on top
                if (version1.current_version) {
                    return -versions.length;
                } else if (version2.current_version) {
                    return versions.length;
                }
                return version2.last_modified - version1.last_modified;
            }

            panelBody.empty();
            if (!model || !_.isArray(versions)) { return; }

            table = $('<table>').addClass('versiontable table').attr('data-latest-version', (versions.length > 0) && _.last(versions).version).append(
                        $('<caption>').addClass('sr-only').text(gt('File version table, the first row represents the current version.')),
                        $('<thead>').addClass('sr-only').append(
                            $('<tr>').append(
                                $('<th>').text(gt('File'))
                            )
                        )
                    );

            drawAllVersions(versions);

            panelHeading.idle();
            panelBody.append(table);
        }
    });

    // Version drop-down
    Ext.point(POINT + '/version/dropdown').extend(new LinksPattern.Dropdown({
        index: 10,
        label: '',
        ref: 'io.ox/files/versions/links/inline'
    }));

    // View a specific version
    Ext.point('io.ox/files/versions/links/inline').extend(new LinksPattern.Link({
        id: 'display-version',
        index: 100,
        prio: 'lo',
        mobile: 'lo',
        label: gt('View'),
        section: 'view',
        ref: 'io.ox/files/actions/viewer/display-version'
    }));

    new LinksPattern.Action('io.ox/files/actions/viewer/display-version', {
        capabilities: 'infostore',
        requires: function (e) {
            var isText = FilesAPI.Model.prototype.isText.call(this, e.baton.data.file_mimetype);
            var isPDF = FilesAPI.Model.prototype.isPDF.call(this, e.baton.data.file_mimetype);
            var isOffice = FilesAPI.Model.prototype.isOffice.call(this, e.baton.data.file_mimetype);

            return (e.baton.isViewer && (isText || isPDF || isOffice));
        },
        action: function (baton) {
            if (baton.viewerEvents) {
                baton.viewerEvents.trigger('viewer:display:version', baton.data);
            }
        }
    });

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
            if (baton.data.current_version) {
                $node.addClass('current');
            }
            Util.setClippedLabel($node, baton.data.filename);
        }
    });

    // User name
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

    // Modification date
    Ext.point(POINT + '/version').extend({
        id: 'last_modified',
        index: 30,
        draw: function (baton) {
            var isToday = moment().isSame(moment(baton.data.last_modified), 'day'),
                dateString = (baton.data.last_modified) ? moment(baton.data.last_modified).format(isToday ? 'LT' : 'l LT') : '-';

            this.find('td:last').append($('<div class="last_modified">').text(gt.noI18n(dateString)));
        }
    });

    // File size
    Ext.point(POINT + '/version').extend({
        id: 'size',
        index: 40,
        draw: function (baton) {
            var size = (_.isNumber(baton.data.file_size)) ? _.filesize(baton.data.file_size) : '-';
            this.find('td:last').append($('<div class="size">').text(gt.noI18n(size)));
        }
    });

    // Version comment
    Ext.point(POINT + '/version').extend({
        id: 'comment',
        index: 50,
        draw: function (baton) {
            var $node;

            if (!_.isEmpty(baton.data.version_comment)) {
                this.find('td:last').append(
                    $('<div class="comment">').append(
                        $node = $('<span class="version-comment">')
                    )
                );

                Util.setClippedLabel($node, baton.data.version_comment);
            }
        }
    });

    // since a file change redraws the entire view
    // we need to track the open/close state manually
    var open = {};

    /**
     * The FileVersionsView is intended as a sub view of the SidebarView and
     * is responsible for displaying the history of file versions.
     */
    var FileVersionsView = PanelBaseView.extend({

        className: 'viewer-fileversions',

        initialize: function (options) {
            PanelBaseView.prototype.initialize.apply(this, arguments);

            _.extend(this, {
                isViewer: Boolean(options && options.isViewer),
                viewerEvents: options && options.viewerEvents || _.extend({}, Backbone.Events)
            });

            // initially hide the panel
            this.$el.hide();
            // attach event handlers
            this.on('dispose', this.disposeView.bind(this));
            this.$el.on({
                open: this.onOpen.bind(this),
                close: this.onClose.bind(this)
            });
            this.listenTo(this.model, 'change:number_of_versions', this.render);
            this.listenTo(this.model, 'change:versions change:current_version change:number_of_versions change:version change:filename', this.renderVersions);
        },

        onOpen: function () {
            var header = this.$('.sidebar-panel-heading').busy();
            // remember
            open[this.model.cid] = true;
            // loading versions will trigger 'change:version' which in turn renders the version list
            FilesAPI.versions.load(this.model.toJSON(), { cache: false })
                .always($.proxy(header.idle, header))
                .done($.proxy(this.renderVersionsAsNeeded, this))
                .fail(function (error) {
                    if (ox.debug) console.error('FilesAPI.versions.load()', 'error', error);
                });
        },

        onClose: function () {
            delete open[this.model.cid];
        },

        render: function () {
            if (!this.model) return this;
            var count = this.model.get('number_of_versions') || 0;
            this.setPanelHeader(gt('Versions (%1$d)', _.noI18n(count)));
            // show the versions panel only if we have at least 2 versions
            this.$el.toggle(count > 1);
            this.togglePanel(count > 1 && !!open[this.model.cid]);
            return this;
        },

        /**
         * Render the version list
         */
        renderVersions: function () {
            if (!this.model) return this;
            Ext.point(POINT + '/list').invoke('draw', this.$el, Ext.Baton({ model: this.model, data: this.model.toJSON(), viewerEvents: this.viewerEvents, isViewer: this.isViewer }));
        },

        renderVersionsAsNeeded: function () {
            // might be disposed meanwhile
            if (!this.$el) return;
            // in case FilesAPI.versions.load will not indirectly triggers a 'change:version'
            // f.e. when a new office document is created and the model
            // is up-to-date when toggling versions pane
            var node = this.$('table.versiontable'),
                model = this.model, versions;
            // is empty
            if (!node.length) return this.renderVersions();
            // missing versions
            versions = model.get('versions') || [];
            if (!versions.length) return this.renderVersions();
            // added and removed same number of versions
            if (node.find('tr.version').length !== versions.length) return this.renderVersions();
            // has difference in version count
            if (node.attr('data-latest-version') !== _.last(versions).version) return this.renderVersions();
        },

        /**
         * Destructor function of this view.
         */
        disposeView: function () {
            this.model = null;
        }
    });

    return FileVersionsView;
});
