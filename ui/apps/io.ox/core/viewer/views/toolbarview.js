/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Edy Haryono <edy.haryono@open-xchange.com>
 * @author Mario Schroeder <mario.schroeder@open-xchange.com>
 */
define('io.ox/core/viewer/views/toolbarview', [
    'io.ox/backbone/mini-views/dropdown',
    'io.ox/backbone/disposable',
    'io.ox/core/extensions',
    'io.ox/core/extPatterns/links',
    'io.ox/core/extPatterns/actions',
    'io.ox/files/api',
    'io.ox/mail/api',
    'io.ox/core/viewer/util',
    'io.ox/core/viewer/settings',
    'gettext!io.ox/core'
], function (Dropdown, DisposableView, Ext, LinksPattern, ActionsPattern, FilesAPI, MailAPI, Util, Settings, gt) {

    /**
     * The ToolbarView is responsible for displaying the top toolbar,
     * with all its functions buttons/widgets.
     */

    'use strict';

    // define constants
    var TOOLBAR_ID = 'io.ox/core/viewer/toolbar',
        TOOLBAR_LINKS_ID = TOOLBAR_ID + '/links',
        TOOLBAR_ACTION_ID = 'io.ox/core/viewer/actions/toolbar',
        TOOLBAR_ACTION_DROPDOWN_ID = TOOLBAR_ACTION_ID + '/dropdown';

    // define extension points for this ToolbarView
    var toolbarPoint = Ext.point(TOOLBAR_ID),
        // toolbar link meta object used to generate extension points later
        toolbarLinksMeta = {
            // high priority links
            'filename': {
                prio: 'hi',
                mobile: 'hi',
                ref: TOOLBAR_ACTION_ID + '/rename',
                title: gt('File name'),
                customize: function (baton) {
                    var fileIcon = $('<i class="fa">').addClass(Util.getIconClass(baton.model)),
                        filenameLabel = $('<span class="filename-label">').text(baton.model.get('filename'));
                    this.addClass('viewer-toolbar-filename')
                        .attr('title', gt('File name'))
                        .append(fileIcon, filenameLabel)
                        .parent().addClass('pull-left');
                    if (baton.model.isFile()) {
                        this.attr({
                            title: gt('Double click to rename'),
                            'aria-label': gt('Filename, double click to rename')
                        })
                            .addClass('viewer-toolbar-rename');
                    }
                }
            },
            'zoomout': {
                prio: 'hi',
                mobile: 'lo',
                icon: 'fa fa-search-minus',
                ref: TOOLBAR_ACTION_ID + '/zoomout',
                label: gt('Zoom out'),
                customize: function () {
                    this.addClass('viewer-toolbar-zoomout').attr({
                        tabindex: '1',
                        title: gt('Zoom out'),
                        'aria-label': gt('Zoom out')
                    });
                }
            },
            'zoomin': {
                prio: 'hi',
                mobile: 'lo',
                icon: 'fa fa-search-plus',
                label: gt('Zoom in'),
                ref: TOOLBAR_ACTION_ID + '/zoomin',
                customize: function () {
                    this.addClass('viewer-toolbar-zoomin').attr({
                        tabindex: '1',
                        title: gt('Zoom in'),
                        'aria-label': gt('Zoom in')
                    });
                }
            },
            'togglesidebar': {
                prio: 'hi',
                mobile: 'hi',
                icon: 'fa fa-info-circle',
                ref: TOOLBAR_ACTION_ID + '/togglesidebar',
                customize: function () {
                    this.addClass('viewer-toolbar-togglesidebar')
                        .attr({
                            tabindex: '1',
                            title: gt('View details'),
                            'aria-label': gt('View details')
                        });
                }
            },
            'popoutstandalone': {
                prio: 'hi',
                mobile: 'hi',
                icon: 'fa  fa-external-link-square',
                ref: TOOLBAR_ACTION_ID + '/popoutstandalone',
                customize: function () {
                    this.addClass('viewer-toolbar-popoutstandalone')
                        .attr({
                            tabindex: '1',
                            title: gt('Pop out standalone viewer'),
                            'aria-label': gt('Pop out standalone viewer')
                        });
                }
            },
            'close': {
                prio: 'hi',
                mobile: 'hi',
                icon: 'fa fa-times',
                ref: TOOLBAR_ACTION_ID + '/close',
                customize: function () {
                    this.addClass('viewer-toolbar-close')
                        .attr({
                            tabindex: '1',
                            title: gt('Close'),
                            'aria-label': gt('Close')
                        })
                        .parent().addClass('pull-right');
                }
            }
        },
        // a map containing App <-> Links mapping
        linksMap = {
            drive: {
                'rename': {
                    prio: 'lo',
                    mobile: 'lo',
                    label: gt('Rename'),
                    section: 'edit',
                    ref: 'io.ox/files/actions/rename'
                },
                'editdescription': {
                    prio: 'lo',
                    mobile: 'lo',
                    label: gt('Edit description'),
                    section: 'edit',
                    ref: TOOLBAR_ACTION_DROPDOWN_ID + '/editdescription'
                },
                'download': {
                    prio: 'lo',
                    mobile: 'lo',
                    label: gt('Download'),
                    section: 'export',
                    ref: 'io.ox/files/actions/download'
                },
                //'print': {
                //    prio: 'lo',
                //    mobile: 'lo',
                //    label: gt('Print'),
                //    section: 'export',
                //    ref: TOOLBAR_ACTION_DROPDOWN_ID + '/print'
                //},
                'share': {
                    prio: 'lo',
                    mobile: 'lo',
                    label: gt('Share'),
                    section: 'export',
                    ref: 'io.ox/files/icons/share'
                },
                'sendbymail': {
                    prio: 'lo',
                    mobile: 'lo',
                    label: gt('Send by mail'),
                    section: 'share',
                    ref: 'io.ox/files/actions/send'
                },
                'uploadnewversion': {
                    prio: 'lo',
                    mobile: 'lo',
                    label: gt('Upload a new version'),
                    section: 'import',
                    ref: 'io.ox/files/actions/upload-new-version'
                },
                'delete': {
                    prio: 'lo',
                    mobile: 'lo',
                    label: gt('Delete'),
                    section: 'delete',
                    ref: 'io.ox/files/actions/delete'
                }
            },
            mail: {
                'openmailattachment': {
                    prio: 'lo',
                    mobile: 'lo',
                    label: gt('Open in browser tab'),
                    ref: 'io.ox/mail/actions/open-attachment'
                },
                'downloadmailattachment': {
                    prio: 'lo',
                    mobile: 'lo',
                    label: gt('Download'),
                    ref: 'io.ox/mail/actions/download-attachment'
                },
                'savemailattachmenttodrive': {
                    prio: 'lo',
                    mobile: 'lo',
                    label: gt('Save to Drive'),
                    ref: 'io.ox/mail/actions/save-attachment'
                },
                'sendmailattachmentasmail': {
                    prio: 'lo',
                    mobile: 'lo',
                    section: 'share',
                    label: gt('Send as mail'),
                    ref: 'io.ox/core/viewer/actions/toolbar/sendasmail'
                }
            },
            pim: {
                'openmailattachment': {
                    prio: 'lo',
                    mobile: 'lo',
                    label: gt('Open in browser tab'),
                    ref: 'io.ox/core/tk/actions/open-attachment'
                },
                'downloadmailattachment': {
                    prio: 'lo',
                    mobile: 'lo',
                    label: gt('Download'),
                    ref: 'io.ox/core/tk/actions/download-attachment'
                },
                'savemailattachmenttodrive': {
                    prio: 'lo',
                    mobile: 'lo',
                    label: gt('Save to Drive'),
                    ref: 'io.ox/core/tk/actions/save-attachment'
                }
            }
        };

    // create 3 extension points containing each sets of links for Drive, Mail, and PIM apps
    _.each(linksMap, function (appMeta, appName) {
        var index = 0,
            extId = TOOLBAR_LINKS_ID + '/' + appName,
            extPoint = Ext.point(extId),
            defaultMeta = _.copy(toolbarLinksMeta),
            completeMeta = _.extend(defaultMeta, appMeta);
        _.each(completeMeta, function (linkMeta, linkId) {
            linkMeta.id = linkId;
            linkMeta.index = (index += 100);
            extPoint.extend(new LinksPattern.Link(linkMeta));
        });
    });

    // define actions of this ToolbarView
    var Action = ActionsPattern.Action;
    new Action(TOOLBAR_ACTION_DROPDOWN_ID, {
        requires: function () { return true; },
        action: $.noop
    });
    new Action(TOOLBAR_ACTION_DROPDOWN_ID + '/editdescription', {
        id: 'edit-description',
        action: function (baton) {
            var actionBaton = Ext.Baton({ data: baton.model.toJSON() });
            ActionsPattern.invoke('io.ox/files/actions/edit-description', null, actionBaton);
        }
    });
    new Action(TOOLBAR_ACTION_DROPDOWN_ID + '/print', {
        id: 'print',
        action: function () {}
    });
    new Action(TOOLBAR_ACTION_ID + '/rename', {
        id: 'rename',
        requires: function (e) {
            return !e.baton.context.standalone;
        }
    });
    new Action(TOOLBAR_ACTION_ID + '/togglesidebar', {
        id: 'togglesidebar',
        action: function (baton) {
            baton.context.onToggleSidebar();
        }
    });

    new Action(TOOLBAR_ACTION_ID + '/popoutstandalone', {
        id: 'popoutstandalone',
        requires: function () {
            var currentApp = ox.ui.App.getCurrentApp().getName();
            return ox.debug && (currentApp != 'io.ox/files/detail');
        },
        action: function (baton) {
            var fileModel = baton.model;
            ox.launch('io.ox/files/detail/main', fileModel);
        }
    });
    new Action(TOOLBAR_ACTION_ID + '/close', {
        id: 'close',
        requires: function (e) {
            return !e.baton.context.standalone;
        },
        action: function () {}
    });
    // define actions for the zoom function
    new Action(TOOLBAR_ACTION_ID + '/zoomin', {
        id: 'zoomin',
        requires: function (e) {
            var model = e.baton.model;
            return model.isOffice() || model.isPDF() || model.isText();
        },
        action: function (baton) {
            baton.context.onZoomIn();
        }
    });
    new Action(TOOLBAR_ACTION_ID + '/zoomout', {
        id: 'zoomout',
        requires: function (e) {
            var model = e.baton.model;
            return model.isOffice() || model.isPDF() || model.isText();
        },
        action: function (baton) {
            baton.context.onZoomOut();
        }
    });

    new Action(TOOLBAR_ACTION_ID + '/sendasmail', {
        id: 'sendasmail',
        requires: function (e) {
            var model = e.baton.model;
            return model.isOffice() || model.isPDF();
        },
        action: function (baton) {
            var viewedAttachment = baton.data;
            MailAPI.get({ id: viewedAttachment.mail.id, folder_id: viewedAttachment.mail.folder_id }).done(function (mail) {
                ox.registry.call('mail-compose', 'replyall', mail ).then(function (MailApp) {
                    // look for currently viewed attachment in the list of attachments of the source email
                    var attachmentToSend = _.find(mail.attachments, function (attachment) {
                        return attachment.id === viewedAttachment.id;
                    });
                    MailApp.app.model.get('attachments').add(attachmentToSend);
                });
            });
        }
    });

    // define the Backbone view
    var ToolbarView = DisposableView.extend({

        className: 'viewer-toolbar',

        tagName: 'ul',

        events: {
            'click a.viewer-toolbar-close': 'onClose',
            'click a.viewer-toolbar-popoutstandalone': 'onClose',
            'click a.viewer-toolbar-filename': 'onRename',
            'keydown a.viewer-toolbar-filename': 'onRename'
        },

        initialize: function (options) {
            _.extend(this, options);
            // rerender on slide change
            this.listenTo(this.mainEvents, 'viewer:displayeditem:change', this.render);
            // run own disposer function at global dispose
            this.on('dispose', this.disposeView.bind(this));
        },

        /**
         * Close the viewer.
         */
        onClose: function (event) {
            event.preventDefault();
            event.stopPropagation();
            this.mainEvents.trigger('viewer:close');
        },

        /**
         * Toggles the visibility of the sidebar.
         */
        onToggleSidebar: function () {
            this.mainEvents.trigger('viewer:toggle:sidebar');
        },

        /**
         * Handler for the file rename event.
         * Invokes the file rename action on SPACE key, ENTER key or a mouse double click.
         *
         * @param {jQuery.Event} event
         */
        onRename: function (event) {
            if ((this.model.isFile()) && (event.which === 32 || event.which === 13 || event.type === 'click')) {
                event.preventDefault();
                ActionsPattern.invoke('io.ox/files/actions/rename', null, { data: this.model.toJSON() });
            }
        },

        /**
         * Publishes zoom-in event to the MainView event aggregator.
         */
        onZoomIn: function () {
            this.mainEvents.trigger('viewer:zoomin');
        },

        /**
         * Publishes zoom-out event to the MainView event aggregator.
         */
        onZoomOut: function () {
            this.mainEvents.trigger('viewer:zoomout');
        },

        /**
         * Model change handler.
         * - rerenders the toolbar
         * @param {Object} changedModel
         *  an object with changed model attributes.
         */
        onModelChange: function (changedModel) {
            // ignore events that require no render
            if (!_.isString(this.model.previous('description')) && changedModel.get('description') === '') {
                return;
            }
            this.render(changedModel);
        },

        /**
         * Renders this DisplayerView with the supplied model.
         *
         * @param {Object} model
         *  The file model object.
         *
         * @returns {ToolbarView} toolbarView
         *  this view object itself.
         */
        render: function (model) {
            if (!model) {
                console.error('Core.Viewer.ToolbarView.render(): no file to render');
                return this;
            }
            // draw toolbar
            var origData = model.get('origData'),
                toolbar = this.$el.attr({ role: 'menu', 'aria-label': gt('Viewer Toolbar') }),
                isDriveFile = model.isFile(),
                baton = Ext.Baton({
                    context: this,
                    $el: toolbar,
                    model: model,
                    models: isDriveFile ? [model] : null,
                    data: isDriveFile ? model.toJSON() : origData
                }),
                appName = model.get('source'),
                self = this;

            // remove listener from previous model
            if (this.model) {
                this.stopListening(this.model, 'change');
            }
            // save current data as view model
            this.model = model;
            this.listenTo(this.model, 'change', this.onModelChange);
            // set device type
            Util.setDeviceClass(this.$el);
            toolbar.empty();
            // enable only the link set for the current app
            _.each(toolbarPoint.keys(), function (id) {
                if (id === appName) {
                    toolbarPoint.enable(id);
                } else {
                    toolbarPoint.disable(id);
                }
            });
            //extend toolbar extension point with the toolbar links
            toolbarPoint.extend(new LinksPattern.InlineLinks({
                id: appName,
                dropdown: true,
                ref: TOOLBAR_LINKS_ID + '/' + appName
            }));
            toolbarPoint.invoke('draw', toolbar, baton);
            // workaround for correct TAB traversal order:
            // move the close button 'InlineLink' to the right of the 'InlineLinks Dropdown' manually.
            _.defer(function () {
                if (self.disposed) {
                    return;
                }
                self.$el.find('.dropdown').after(
                    self.$el.find('.viewer-toolbar-close').parent()
                );
            });
            return this;
        },

        /**
         * Destructor of this view
         */
        disposeView: function () {
            this.model.off().stopListening();
            this.model = null;
        }

    });

    return ToolbarView;

});
