/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2012 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/files/fluid/perspective', [
    'io.ox/files/fluid/view-detail',
    'io.ox/core/extensions',
    'io.ox/core/commons',
    'io.ox/core/tk/dialogs',
    'io.ox/files/api',
    'io.ox/core/date',
    'io.ox/core/tk/upload',
    'io.ox/core/extPatterns/dnd',
    'io.ox/core/extPatterns/actions',
    'io.ox/files/util',
    'gettext!io.ox/files',
    'io.ox/core/tk/selection',
    'io.ox/core/notifications',
    'io.ox/files/upload/main'
], function (viewDetail, ext, commons, dialogs, api, date, upload, dnd, actions, util, gt, Selection, notifications, fileUpload) {

    'use strict';

    var dropZone,
        loadFilesDef = $.Deferred(),
        dialog = new dialogs.SidePopup({ focus: false }),
        //nodes
        filesContainer, breadcrumb, wrapper,
        scrollpane = $('<div class="files-scrollable-pane" role="section">');

    //init
    filesContainer = wrapper = $('');

    // *** helper functions ***

    function drawGenericIcon(name) {
        var node = $('<i>');
        if (/(docx|docm|dotx|dotm|odt|ott|doc|dot|rtf)$/i.test(name)) {
            node.addClass('fa fa-align-left file-type-doc');
        } else if (/(xlsx|xlsm|xltx|xltm|xlam|xls|xlt|xla|xlsb)$/i.test(name)) {
            node.addClass('fa fa-table file-type-xls');
        } else if (/(pptx|pptm|potx|potm|ppsx|ppsm|ppam|odp|otp|ppt|pot|pps|ppa)$/i.test(name)) {
            node.addClass('fa fa-picture-o file-type-ppt');
        } else if ((/(aac|mp3|m4a|m4b|ogg|opus|wav)$/i).test(name)) {
            node.addClass('fa fa-music');
        } else if ((/(mp4|ogv|webm)$/i).test(name)) {
            node.addClass('fa fa-film');
        } else if ((/(epub|mobi)$/i).test(name)) {
            node.addClass('fa fa-book');
        } else if ((/(cbz|cbr|cb7|cbt|cba)$/i).test(name)) {
            node.addClass('fa fa-comment-o');
        } else if ((/(zip|tar|gz|rar|7z|bz2)$/i).test(name)) {
            node.addClass('fa fa-archive');
        } else {
            node.addClass('fa fa-file');
        }
        return node.addClass('not-selectable');
    }

    function cut(str, maxLen, cutPos) {
        return _.ellipsis(str, {
            max: maxLen || 70,
            length: cutPos || 15,
            charpos: 'middle'
        });
    }

    function dropZoneInit(app) {
        if (_.browser.IE === undefined || _.browser.IE > 9) {
            dropZoneOff();
            dropZone = new dnd.UploadZone({
                ref: 'io.ox/files/dnd/actions'
            }, app);
            dropZoneOn();
        }
    }

    function dropZoneOn() {
        if (dropZone) dropZone.include();
    }

    function dropZoneOff() {
        if (dropZone) dropZone.remove();
    }

    function cid_find(str) {
        return str.replace(/\\\./g, '\\\\.');
    }

    function loadFiles(app) {
        var def = $.Deferred(),
            search = app.getWindow().nodes.sidepanel.find('.search-container').is(':visible');
        if (!search) {
            //empty search query shows folder again
            api.getAll({ folder: app.folder.get() }, false).done(def.resolve).fail(def.reject);
        } else {
            //remove selection to prevent errors (file might not be in our search results)
            _.url.hash('id', null);
            var params = { sort: app.props.get('sort'), order: app.props.get('order') };
            app.searchapi.query(true, params)
                .then(function (response) {
                    return response && response.results ? response.results : [];
                })
                .then(def.resolve, def.reject);
        }
        return def;
    }

    function getDateFormated(timestamp, options) {
        if (!_.isNumber(timestamp))
            return gt('unknown');
        var opt = $.extend({ fulldate: false, filtertoday: true }, options || {}),
            now = new date.Local(),
            d = new date.Local(timestamp),
            timestr = function () {
                return d.format(date.TIME);
            },
            datestr = function () {
                return d.format(date.DATE) + (opt.fulldate ? ' ' + timestr() : '');
            },
            isSameDay = function () {
                return d.getDate() === now.getDate() &&
                    d.getMonth() === now.getMonth() &&
                    d.getYear() === now.getYear();
            };
        return isSameDay() && opt.filtertoday ? timestr() : datestr();
    }

    function calculateLayout(el, options) {

        var rows = Math.round((el.height() - 40) / options.fileIconHeight),
            cols = Math.floor((el.width() - 6) / options.fileIconWidth);

        if (rows === 0) rows = 1;
        if (cols === 0) cols = 1;

        return { iconRows: rows, iconCols: cols, icons: rows * cols };
    }

    function identifyMode(opt) {
        var mode = opt.perspective.split(':')[1] || '';
        if (!/^(icon|list|tile)$/.test(mode)) {
            mode = 'list';
        }
        return mode;
    }

    function preview(e, cid) {
        var app = this.baton.app, el;
        api.get(cid).done(function (file) {
            app.currentFile = file;
            if (dropZone) {
                dropZone.update();
            }
            if (_.device('smartphone')) {
                if (app.props.get('showCheckboxes')) return;
                // mobile mode, use detailView of Pagecontroller instead of Popup
                var dView = app.pages.getPage('detailView');

                // wait for transition to be done
                dView.one('pageshow', function () {
                    dView.idle();
                    // append preview image
                    $('.mobile-detail-view-wrap', dView).append(viewDetail.draw(file, app));
                });

                dView.empty()
                    .append($('<div class="mobile-detail-view-wrap">')).busy();

                app.pages.changePage('detailView');
                app.selection.trigger('pagechange:detailView');

            } else {
                dialog.show(e, function (popup) {
                    popup
                        .append(viewDetail.draw(file, app))
                        .attr({
                            'role': 'complementary',
                            'aria-label': gt('File Details')
                        });
                    el = popup.closest('.io-ox-sidepopup');
                });

                // Focus SidePopup
                _.defer(function () { if (el) { el.focus(); } });
            }
        });
    }

    // *** ext points ***

    ext.point('io.ox/files/icons/options').extend({
        thumbnailWidth: 160,
        thumbnailHeight: 160,
        fileIconWidth: 158,
        fileIconHeight: 182
    });

    ext.point('io.ox/files/icons').extend({
        id: 'selection',
        register: function (baton) {

            Selection.extend(this, scrollpane, { draggable: true, dragType: 'mail', scrollpane: wrapper, focus: undefined });
            //selection accessible via app
            baton.app.selection = this.selection;

            baton.app.trigger('selection:setup');

            // forward selection:change event
            this.selection.on('change', function (e, list) {
                if (baton.app.currentFile && !_.isEmpty(list)) {
                    if (list[0].id !== baton.app.currentFile.id) {
                        baton.app.trigger('selection:change', list);
                    }
                } else {
                    baton.app.trigger('selection:change', list);
                }
            });

            var pers = this;

            //init
            pers.selection
                .setEditable(true, '.checkbox')
                .keyboard(scrollpane, true)
                // toggle visibility of multiselect actions
                .on('change', function (e, selected) {

                    var self = this;

                    if (_.device('smartphone') && baton.options.mode === 'list') {
                        // use custom multiselect toolbar
                        //toggleToolbar(selected, self, baton);
                    }

                    // set url
                    var id = _(selected.length > 50 ? selected.slice(0, 1) : selected).map(function (obj) {
                        return self.serialize(obj);
                    }).join(',');
                    _.url.hash('id', id !== '' ? id : null);
                })
                .on('keyboard', function (selEvent, orgEvent) {
                    var sel = this.get();
                    switch (orgEvent.keyCode || orgEvent.which) {
                    case 13:
                        // enter: treat like click on title
                        if (sel.length === 1) {
                            //trigger click event on title (preview action)
                            $(orgEvent.target).find('[data-obj-id="' + _.cid(sel[0])  + '"]')
                                .find('.not-selectable')
                                .first()
                                .trigger('click');
                        }
                        break;
                    case 37:
                        // left: treat like up
                        orgEvent.which = 38;
                        break;
                    case 39:
                        // right: treat like down
                        orgEvent.which = 40;
                        break;
                    }
                })
                .on('update', function (e, state) {
                    //careful here, if we are not in the files app (editor is opened or so)
                    //this messes up a valid selection(wrong or missing id parameters in url) and sets it to the first item
                    //so only do something if we actually are in the files app
                    if (_.url.hash('app') === 'io.ox/files') {
                        var id = _.url.hash('id'),
                            list, cid, node;

                        //ids to list of objects
                        list = _.isEmpty(id) ? [] : id.split(/,/);
                        list = _(list).map(_.cid);

                        //set selection
                        if (list.length) {
                            // select by object (cid)
                            if (this.contains(list)) {
                                this.set(list);
                            } else {
                                _.url.hash('id', null);
                                this.clear();
                            }
                        } else {
                            if (_.device('!smartphone')) {
                                this.selectFirst();
                            }
                        }

                        //deep link handling
                        //deactivate for search or every item is loaded at once(may cause huge server load)
                        if (state === 'inital' && list.length === 1) {
                            cid = _.cid(this.get()[0]);
                            node = filesContainer.find('[data-obj-id="' + cid + '"]');
                            //node not drawn yet?
                            if (!node.length) {
                                //draw gap
                                pers.redrawGap(baton.allIds, cid);
                                node = filesContainer.find('[data-obj-id="' + cid + '"]');
                                wrapper.scrollTop(wrapper.prop('scrollHeight'));
                            }
                            //trigger click
                            node.trigger('click', 'automated');
                        }
                    }
                });
        }
    });

    ext.point('io.ox/files/icons').extend({
        id: 'icons',
        index: 200,
        draw: function (baton) {
            var focus = function (prevent) {
                var y = wrapper.scrollTop();
                if (!!prevent) {
                    //in some cases IE flickers without this hack
                    filesContainer.addClass('fixed').focus().removeClass('fixed');
                } else {
                    filesContainer.focus();
                }
                wrapper.scrollTop(y);
            },
            isFolderHidden = function () {
                return !baton.app.folderViewIsVisible();
            };
            this.append(
                filesContainer = $('<div class="files-container f6-target view-' + baton.options.mode + '" tabindex="1">')
                    .on('click', function () {
                        //force focus on container click
                        focus();
                    })
                    .on('data:loaded refresh:finished', function () {
                        //inital load and refresh
                        if (isFolderHidden()) {
                            focus();
                        }
                    })
                    .on('perspective:shown', function () {
                        //folder tree select vs. layout change action
                        if (isFolderHidden() || $(document.activeElement).is('a.btn.layout')) {
                            focus();
                        }
                    })
                    .on('dialog:closed', function () {
                        //sidepanel close button vs. folder change (that triggers dialog close)
                        if (!$(document.activeElement).hasClass('folder')) {
                            focus(true);
                        }
                    })
            );
            if (_.device('smartphone')) filesContainer.addClass('checkboxes-hidden');
        }
    });

    function iconLoad() {
        // 1x1 dummy or final image?
        if (this.width === 1 && this.height === 1) iconReload.call(this); else iconFinalize.call(this);
    }

    function iconFinalize() {
        var img = $(this), cell = img.closest('.file-cell'), url = img.attr('src');
        // remove placeholder
        cell.find('i.fa').remove();
        // use background for list/tile view
        cell.find('.preview-cover').css('backgroundImage', 'url(' + url + ')');
        // use icon for icon view
        img.fadeIn().removeClass('lazy');
    }

    function iconReload() {
        var img = $(this),
            retry = img.data('retry') + 1,
            url = String(img.attr('src') || '').replace(/&retry=\d+/, '') + '&retry=' + retry,
            // 3 6 12 seconds
            wait = Math.pow(2, retry - 1) * 3000;
        // stop trying after three retries
        if (retry > 3) return;
        setTimeout(function () {
            img.off('load error').one({ load: iconLoad, error: iconError }).attr('src', url).data('retry', retry);
        }, wait);
    }

    function iconError() {
        $(this).remove();
    }

    /*
     * This extension point adds a toolbar, which displays the upload progess of all files.
     * If several files are loaded this toolbar provides links to open an overview of all currently uploaded files.
     */
    ext.point('io.ox/files/upload/toolbar').extend({
        draw: function () {
            this.append($('<div class="upload-wrapper">').append(
                $('<div class="upload-title">').append(
                    $('<span class="file-name">'),
                    $('<span class="estimated-time">')
                ),
                $('<div class="upload-details">').append(
                    $('<a href=#>').text(gt('Details')).click(function (e) {
                        e.preventDefault();

                        require(['io.ox/files/upload/view'], function (uploadView) {
                            uploadView.show();
                        });
                    })
                ),
                $('<div class="progress">').append(
                    $('<div class="progress-bar progress-bar-striped active">')
                        .attr({
                            'role': 'progressbar',
                            'aria-valuenow': '0',
                            'aria-valuemin': '0',
                            'aria-valuemax': '100'
                        })
                        .css({ 'width': '0%' })
                        .append(
                            $('<span class="sr-only">').text(
                                //#. %1$s progress of currently uploaded files in percent
                                gt('%1$s Complete', '0%')
                            )
                        )
                )
            ));
        }
    });

    ext.point('io.ox/files/icons/file').extend({

        draw: function (baton) {

            var file = baton.data,
                options = _.extend({ version: true, scaletype: 'cover' }, baton.options),
                mode = util.previewMode(file), url,
                changed = getDateFormated(baton.data.last_modified),
                // view mode: icon
                iconImage = drawGenericIcon(file.filename),
                previewImage = $('<div class="preview">').append(iconImage),
                // view modes: list, tile
                iconBackground = drawGenericIcon(file.filename),
                previewBackground = $('<div class="preview-cover not-selectable">').append(iconBackground);

            // add preview image
            if (mode) {
                var url = api.getUrl(file, mode, options);
                if (!baton.update) {
                    url = url.replace(/format=preview_image/, 'format=thumbnail_image');
                }
                previewImage.append(
                    $('<img class="img-thumbnail lazy" alt="">')
                        .attr('data-original', url)
                        .queueload({ container: wrapper, event: 'scrollstop' })
                        .one({
                            'queue:load': function () {
                                iconImage.remove();
                                $(this).removeClass('lazy');
                            },
                            'queue:error': function () {
                                $(this).remove();
                            }
                        })
                );
                previewBackground
                    .attr('data-original', url)
                    .queueload({ container: wrapper, event: 'scrollstop' })
                    .one('queue:load', function () {
                        iconBackground.remove();
                    });
            }

            var title = file.filename || file.title;

            this.addClass('file-cell pull-left selectable')
                .attr('data-obj-id', _.cid(file))
                .attr('tabindex', -1)
                .append(
                    //checkbox
                    $('<div class="checkbox">').append(
                        $('<label>').append(
                            $('<input type="checkbox" class="reflect-selection" aria-hidden="true" tabindex="-1">')
                        )
                    ),
                    //preview
                    previewImage,
                    previewBackground,
                    //details
                    $('<div class="details">').append(
                        //title
                        $('<div class="text title drag-title">')
                        .attr('title', title)
                        .append(
                            // lock icon
                            api.tracker.isLocked(file) ? $('<i class="fa fa-lock">') : $(),
                            // long title
                            $('<span class="not-selectable title-long">').text(gt.noI18n(cut(title, 90))),
                            // short title
                            $('<span class="not-selectable title-short">').text(gt.noI18n(cut(title, 50)))
                        ),
                        //smart last modified
                        $('<span class="text modified">').text(gt.noI18n(changed)),
                        //filesize
                        $('<span class="text size">').text(gt.noI18n(_.filesize(file.file_size || 0, { digits: 1, zerochar: '' })))
                    )
                );
            if (_.device('smartphone')) {
                this.removeClass('selectable')

                    .find('.checkbox')
                    .attr('data-obj-id', _.cid(file))
                    .addClass('selectable');
            }
        }
    });

    // *** perspective ***
    return _.extend(new ox.ui.Perspective('fluid'), {

        //handles mode changes
        afterShow: function (app, opt) {
            var mode = identifyMode(opt), baton = this.baton;
            //mode changed?
            if (baton.options.mode !== mode) {
                //switch to mode
                filesContainer.removeClass('view-' + baton.options.mode)
                                     .addClass('view-' + mode);
                //update baton
                baton.options.mode = mode;
                //clear selection on mobile
                if (_.device('smartphone'))
                    this.selection.clear();
                //handle focus
                filesContainer.trigger('perspective:shown');
            }
        },

        render: function (app, opt) {
            var options = ext.point('io.ox/files/icons/options').options(),
                win = app.getWindow(),
                self = this,
                //functions
                drawFile,
                drawFiles,
                adjustWidth,
                redraw,
                drawFirst,
                events,
                layout,
                recalculateLayout,
                //simple
                start,
                end,
                allIds = [],
                drawnCids = [],
                displayedRows,
                baton = new ext.Baton({ app: app });
            self.baton = baton;
            baton.options.mode = identifyMode(opt);

            self.main.empty().append(
                wrapper = $('<div class="files-wrapper">')
                    .attr({
                        'role': 'main',
                        'aria-label': gt('Files View')
                    })
                    .append(
                        scrollpane
                )
            );

            //register selection accessible via 'self.selection'
            ext.point('io.ox/files/icons').invoke(
                'register', self, baton
            );

            //get list of relevant events
            events = function (type) {
                return _.map(['list', 'icon', 'tile'], function (pers) {
                    return 'perspective:fluid:' + pers + ':' + type;
                }).join(' ');
            };

            layout = calculateLayout(scrollpane.parent(), options);

            //set media query styles also if container width changes
            adjustWidth = function () {
                if (!wrapper.is(':visible')) {
                    //do not change anything if wrapper is not visible.
                    return;
                }

                var width = wrapper.width(),
                    container = self.main;

                if (width > 768) {
                    container.removeClass('width-less-than-768 width-less-than-480');
                } else if (width >= 480 && width <= 768) {
                    container.addClass('width-less-than-768');
                    container.removeClass('width-less-than-480');
                } else if (width <= 480) {
                    container.addClass('width-less-than-768 width-less-than-480');
                }
            };
            adjustWidth();
            //let the foldertree draw or we get wrong values
            app.on('folderview:close folderview:open folderview:resize', _.debounce(function () {
                adjustWidth();
            }, 300));

            //register dnd handler
            dropZoneInit(app);
            app.on('perspective:fluid:hide ' + events('hide'), dropZoneOff)
                .on('perspective:fluid:show ' + events('show'), dropZoneOn)
                .on('folder:change', function () {
                    app.currentFile = null;
                    dropZoneInit(app);
                    self.main.closest('.search-open').removeClass('search-open');
                    dialog.close();
                    breadcrumb = undefined;
                    allIds = [];
                    self.selection.clear();
                    drawFirst();
                });

            //retrigger selection to set the id in the url properly when comming back from editor etc. In other apps this is handled by vgrid.
            win.on('show', function () {
                self.selection.retriggerUnlessEmpty();
            });
            win.on('hide', function () {
                app.off('show', function () {
                    self.selection.retriggerUnlessEmpty();
                });
            });

            if (_.device('!smartphone')) {
                scrollpane.on('click', '.selectable', function (e, data) {
                    var cid = _.cid($(this).attr('data-obj-id')),
                        special = (e.metaKey || e.ctrlKey || e.shiftKey || e.target.type === 'checkbox' || $(e.target).attr('class') === 'checkbox'),
                        valid = !filesContainer.hasClass('view-list') || $(e.target).hasClass('not-selectable') || data === 'automated';
                    if (valid && !special)
                        preview.call(self, e, cid);
                });
            } else {
                scrollpane.on('tap', '.file-cell', function (e, data) {
                    var cid = _.cid($(this).attr('data-obj-id')),
                        valid = e.target.type !== 'checkbox' || data === 'automated';
                    if (valid) {
                        preview.call(self, e, cid);
                        self.selection.trigger('select', [cid]);
                    }
                });
            }

            //register dialog handler
            dialog.on('close', function () {
                if (window.mejs) {
                    _(window.mejs.players).each(function (player) {
                        if ($(player.node).parents('.preview').length > 0) {
                            player.pause();
                        }
                    });
                }
                if (dropZone) {
                    var tmp = app.currentFile;
                    app.currentFile = null;
                    dropZone.update();
                    dropZoneInit(app);
                    app.currentFile = tmp;
                }
                //focus handling
                filesContainer.trigger('dialog:closed');
            });

            drawFile = function (file, update) {
                var node = $('<a>');
                ext.point('io.ox/files/icons/file').invoke(
                    'draw', node, new ext.Baton({ data: file, options: $.extend(baton.options, options), update: update })
                );
                return node;
            };

            drawFiles = function (files) {
                filesContainer.append(
                    _(files).map(function (file) {
                        drawnCids.push(_.cid(file));
                        return drawFile(file);
                    })
                );
            };

            function onScroll() {
                /*
                 *  How this works:
                 *
                 *      +--------+     0
                 *      |        |
                 *      |        |
                 *      |        |
                 *      |        |
                 *   +--+--------+--+  scrollTop
                 *   |  |        |  |
                 *   |  |        |  |
                 *   |  |        |  |  height
                 *   |  |        |  |
                 *   |  |        |  |
                 *   +--+--------+--+  bottom
                 *      |        |
                 *      |        |
                 *      +--------+     scrollHeight
                 *
                 *  If bottom and scrollHeight are near (~ 50 pixels) load new icons.
                 *
                 */
                var scrollTop = wrapper.scrollTop(),
                    scrollHeight = wrapper.prop('scrollHeight'),
                    height = wrapper.outerHeight(),
                    bottom = scrollTop + height;
                // scrolled to bottom?
                if (bottom > (scrollHeight - 50)) {
                    start = end;
                    end = end + layout.iconCols;
                    if (layout.iconCols <= 3) end = end + 10;
                    displayedRows = displayedRows + 1;
                    redraw(allIds.slice(start, end));
                }
            }

            redraw = function (ids) {
                drawFiles(ids);
                wrapper.off('scroll', onScroll).on('scroll', onScroll);
                self.selection.update();
            };

            self.redrawGap = function (ids, cid) {
                start = end;
                _.find(ids, function (file, index) {
                    //identify gap
                    if (cid === _.cid(file)) {
                        end = Math.min(index + 1, baton.allIds.length);
                        return true;
                    }
                });
                //draw gap
                redraw(baton.allIds.slice(start, end));
            };

            drawFirst = function () {
                scrollpane.empty().busy();

                loadFilesDef.reject();

                loadFilesDef = loadFiles(app);

                loadFilesDef.then(
                    function success(ids) {

                        //filter duplicates
                        ids = _.uniq(ids, function (file) {
                            return _.cid(file);
                        });

                        scrollpane.empty().idle();
                        baton.allIds = allIds = ids;
                        ext.point('io.ox/files/icons').invoke('draw', scrollpane, baton);

                        //draw upload toolbar if there are uploads
                        if (fileUpload.collection.length > 0) {
                            ext.point('io.ox/files/upload/toolbar').invoke('draw', self.main, baton);
                        }

                        //anchor node
                        if (!breadcrumb) scrollpane.prepend(breadcrumb = $('<div>'));

                        displayedRows = layout.iconRows;
                        start = 0;
                        end = displayedRows * layout.iconCols;
                        if (layout.iconCols <= 3) { end = end + 10; }
                        var displayedIds = allIds.slice(start, end);

                        redraw(displayedIds);

                        // provoke scrolling if not all elements are displayed
                        // if not, there is no possibility to display all elements due to our loading on demand
                        if (displayedIds < allIds) {
                            // one pixel to large so a scrollbar is displayed
                            var height = parseInt(wrapper.css('height'), 10) + 1;
                            filesContainer.css('height', height + 'px');
                            // some browser don't trigger a scroll event
                            wrapper.trigger('scroll');
                        }

                        self.selection.init(allIds).trigger('update', 'inital');

                        //focus handling
                        filesContainer.trigger('data:loaded');
                    },
                    function fail(response) {
                        if (response) {
                            scrollpane.idle();
                            notifications.yell('error', response.error);
                        }
                    }
                );
            };

            recalculateLayout = function () {
                // This should be improved
                var last_layout = layout;
                layout = calculateLayout($('.files-wrapper'), options);

                if (last_layout.icons < layout.icons) {
                    start = end;
                    end = end + (layout.icons - last_layout.icons);
                    redraw(allIds.slice(start, end));
                }
                displayedRows = layout.iconRows + 1;
                start = end;
                end = end + layout.iconCols;
                redraw(allIds.slice(start, end));
                //adjust topBar width on window resize
                adjustWidth();
            };

            app.getIds = function () {
                return allIds;
            };

            app.queues = {};
            app.queues.create = upload.createQueue(fileUpload)
                .on('start', function () {
                    $('.files-wrapper').addClass('margin-bottom');
                    ext.point('io.ox/files/upload/toolbar').invoke('draw', self.main, baton);
                })
                .on('progress', function (e, def, file) {
                    $('.upload-wrapper').find('.file-name').text(
                        //#. the name of the file, which is currently uploaded
                        gt('Uploading %1$s', file.file.name)
                    );
                })
                .on('stop', function () {
                    $('.files-wrapper').removeClass('margin-bottom');
                    $('.upload-wrapper').remove();
                });

            fileUpload.collection
                .on('progress', function (baton) {
                    var progressWrapper = $('.upload-wrapper'),
                        progressBar = progressWrapper.find('.progress-bar'),
                        progressText = progressWrapper.find('.sr-only'),
                        val = Math.round(baton.progress * 100);

                    progressBar
                        .attr({ 'aria-valuenow': val })
                        .css({ 'width': val + '%' });
                    progressText.text(
                        //#. %1$s progress of currently uploaded files in percent
                        gt('%1$s Complete', val + '%')
                    );

                    progressWrapper.find('.estimated-time').text(
                        //#. %1$s remaining upload time
                        gt('Remaining time: %1$s', baton.estimatedTime)
                    );
                })
                .on('remove', function (model, collection, options) {
                    app.queues.create.remove(options.index);
                });

            app.queues.update = upload.createQueue({
                start: function () {
                    win.busy(0);
                },
                progress: function (item, position, files) {
                    var pct = position / files.length;
                    win.busy(pct, 0);
                    return api.uploadNewVersion({
                        file: item.file,
                        id: app.currentFile.id,
                        folder: app.currentFile.folder_id,
                        timestamp: _.now()
                    })
                    .progress(function (e) {
                        var sub = e.loaded / e.total;
                        win.busy(pct + sub / files.length, sub);
                    }).fail(function (e) {
                        if (e && e.data && e.data.custom) {
                            notifications.yell(e.data.custom.type, e.data.custom.text);
                        }
                    });
                },
                stop: function () {
                    win.idle();
                }
            });

            $(window).resize(_.debounce(recalculateLayout, 300));

            win.on('search:query search:cancel', function () {
                breadcrumb = undefined;
                allIds = [];
                drawFirst();
            });

            api.on('update', function (e, obj) {
                // update icon
                var cid = _.cid(obj),
                    icon = scrollpane.find('.file-cell[data-obj-id="' + cid_find(cid) + '"]');
                if (icon.length) {
                    icon.replaceWith(
                        // draw file ...
                        drawFile(obj, true)
                        // ... and reset lazy loader
                        .find('img.lazy').lazyload({ container: wrapper, event: 'scrollstop' }).end()
                    );
                }
            });

            api.on('refresh.all', function () {
                if (!app.getWindow().facetedsearch.active) {
                    api.getAll({ folder: app.folder.get() }, false).done(function (ids) {

                        var hash = {},
                            oldhash   = {},
                            oldIds    = [],
                            newIds    = [],
                            changed   = [],
                            deleted   = [],
                            added     = [],
                            duplicates = {},
                            indexPrev,
                            indexPrevPosition,
                            indexNextPosition;

                        //filter duplicates
                        ids = _.uniq(ids, function (file) {
                            return _.cid(file);
                        });

                        indexPrev = function (index, cid) {
                            return _.indexOf(drawnCids, _.indexOf(index, cid) - 1);
                        };

                        indexPrevPosition = function (arr, key) {
                            return arr[(_.indexOf(arr, key) - 1 + arr.length) % arr.length];
                        };

                        indexNextPosition = function (arr, key) {
                            return arr[(_.indexOf(arr, key) + 1 + arr.length) % arr.length];
                        };

                        _(allIds).each(function (obj) {
                            var cid = _.cid(obj);
                            if (cid in oldhash) {
                                duplicates[cid] = true;
                            } else {
                                oldhash[cid] = obj;
                            }
                        });

                        _(ids).each(function (obj) {
                            var cid = _.cid(obj);
                            if (cid in hash) {
                                duplicates[cid] = true;
                            } else {
                                hash[cid] = obj;
                                // Update if cid still exists, has already been drawn and object was modified.
                                // Note: If title is changed, last_modified date is not updated
                                if (_.isObject(oldhash[cid]) && (_.indexOf(drawnCids, cid) !== -1) &&
                                   (obj.last_modified !== oldhash[cid].last_modified || obj.title !== oldhash[cid].title)) {
                                    changed.push(cid);
                                }
                            }
                        });

                        oldIds = _.map(allIds, _.cid);
                        newIds = _.map(ids, _.cid);

                        for (var id in oldIds) {
                            if (-1 === newIds.indexOf(oldIds[id])) {
                                deleted.push(oldIds[id]);
                            }
                        }

                        for (var id in newIds) {
                            if (-1 === oldIds.indexOf(newIds[id])) {
                                added.push(newIds[id]);
                            }
                        }

                        //something changed?
                        if (changed.length + deleted.length + added.length + Object.keys(duplicates).length) {
                            baton.allIds = allIds = ids;

                            _(changed).each(function (cid) {
                                var data = hash[cid],
                                    index = _.indexOf(newIds, cid),
                                    prev = indexPrevPosition(newIds, cid),
                                    outdated = scrollpane.find('.file-cell[data-obj-id="' + cid_find(cid) + '"]'),
                                    anchor;

                                outdated.remove();

                                if (indexPrev(newIds, cid)) {
                                    anchor = scrollpane.find('.file-cell[data-obj-id="' + cid_find(prev) + '"]');
                                    if (anchor.length && index !== 0) {
                                        anchor.first().after(drawFile(data));
                                    } else {
                                        scrollpane.find('.files-container').prepend(drawFile(data));
                                    }
                                } else {
                                    end = end - outdated.length;
                                }
                            });

                            _(deleted).each(function (cid) {
                                var nodes = scrollpane.find('.file-cell[data-obj-id="' + cid_find(cid) + '"]');
                                end = end - nodes.remove().length;
                            });

                            _(duplicates).each(function (value, cid) {
                                //remove all nodes for given cid except the first one
                                var nodes = scrollpane.find('.file-cell[data-obj-id="' + cid_find(cid) + '"]');
                                end = end - nodes.slice(1).remove().length;
                            });

                            _(added).each(function (cid) {
                                var data = hash[cid],
                                    index = _.indexOf(newIds, cid),
                                    prev = indexPrevPosition(newIds, cid),
                                    anchor;

                                if (indexPrev(newIds, cid)) {
                                    anchor = scrollpane.find('.file-cell[data-obj-id="' + cid_find(prev) + '"]');
                                    if (anchor.length && index !== 0) {
                                        anchor.first().after(drawFile(data));
                                    } else {
                                        scrollpane.find('.files-container').prepend(drawFile(data));
                                    }
                                    end = end + 1;
                                }
                            });

                            recalculateLayout();
                        }

                        self.selection
                                .init(allIds)
                                .trigger('update');
                        //focus handling
                        filesContainer.trigger('refresh:finished');
                        hash = oldhash = oldIds = newIds = changed = deleted = added = indexPrev = indexPrevPosition = indexNextPosition = null;
                    });
                }
            });
            drawFirst();
        }
    });
});
