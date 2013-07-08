/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2012 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/calendar/list/perspective',
    ['io.ox/calendar/api',
     'io.ox/core/tk/vgrid',
     'io.ox/calendar/view-grid-template',
     'io.ox/calendar/view-detail',
     'io.ox/core/commons',
     'io.ox/core/extensions',
     'io.ox/core/date',
     'io.ox/calendar/util',
     'settings!io.ox/calendar',
     'gettext!io.ox/calendar'
    ], function (api, VGrid, tmpl, viewDetail, commons, ext, date, util, settings, gt) {

    'use strict';

    var perspective = new ox.ui.Perspective('list');

    perspective.render = function (app) {

        var win = app.getWindow(),
            vsplit = commons.vsplit(this.main, app),
            left = vsplit.left.addClass('border-right'),
            right = vsplit.right.addClass('default-content-padding calendar-detail-pane').scrollable(),
            grid = new VGrid(left, {settings: settings}),
            findRecurrence = false,
            optDropdown = null;

        if (_.url.hash('id') && _.url.hash('id').split(',').length === 1) {// use only for single items
            findRecurrence = _.url.hash('id').split('.').length === 2;//check if recurrencePosition is missing
        }

        // fix selection's serialize
        grid.selection.serialize = function (obj) {
            return typeof obj === "object" ? (obj.folder_id || obj.folder || 0) + "." + obj.id + "." + (obj.recurrence_position || 0) : obj;
        };

        commons.wireGridAndAPI(grid, api);
        commons.wireGridAndSearch(grid, win, api);

        // add grid options
        grid.prop('order', 'asc')
            .prop('folder', app.folder.get());

        // add template
        grid.addTemplate(tmpl.main);

        // add label template
        grid.addLabelTemplate(tmpl.label);

        // requires new label?
        grid.requiresLabel = function (i, data, current) {
            // disable labels in search mode
            if (grid.getMode() === 'search') {
                return false;
            }
            return tmpl.requiresLabel(i, data, current);
        };

        api.on('create', function (e, data) {
            if (app.folder.get() === data.folder) {
                grid.selection.set(data);
            }
        });

        // special search: list request
        grid.setListRequest("search", function (ids) {
            return $.Deferred().resolve(ids);
        });

        // hide grid toolbar options on search
        grid.on('change:mode', function (e, cur) {
            if (optDropdown && cur) {
                optDropdown[cur === 'search' ? 'hide' : 'show']();
            }
        });

        var directAppointment;//directly linked appointments are stored here
        
        //function to check for a selection change to prevent refresh from overiding direct links
        function checkDirectlink(e, list) {
            if (list.length > 1 || (list.length === 1 && list[0].id !== directAppointment.id)) {
                grid.prop('directlink', false);
                grid.selection.off('change', checkDirectlink);
            }
        }
        function showAppointment(obj, directlink) {
            // be busy
            right.busy(true);
            
            //direct links are preferred
            if (directlink) {
                grid.prop('directlink', true);
                directAppointment = obj;
                grid.selection.on('change', checkDirectlink);
                // get appointment
                api.get(obj)
                    .done(drawAppointment)
                    .fail(drawFail, obj);
            } else if (grid.prop('directlink') && directAppointment) {
                api.get(directAppointment)
                .done(drawAppointment)
                .fail(drawFail, directAppointment);
            } else {
                directAppointment = undefined;
                // get appointment
                if (!(grid.prop('directlink'))) {
                    api.get(obj)
                        .done(_.lfo(drawAppointment))
                        .fail(_.lfo(drawFail, obj));
                }
            }
        }

        showAppointment.cancel = function () {
            _.lfo(drawAppointment);
            _.lfo(drawFail);
        };

        function drawAppointment(data) {
            right.idle().empty().append(viewDetail.draw(data));
        }

        function drawFail(obj) {
            right.idle().empty().append(
                $.fail(gt("Couldn't load appointment data."), function () {
                    showAppointment(obj);
                })
            );
        }

        function buildOption(value, text) {
            return $('<li>').append($('<a href="#"><i/></a>').attr('data-option', value).append($.txt(text)));
        }

        function updateGridOptions() {
            var dropdown = grid.getToolbar().find('.grid-options'),
                list = dropdown.find('ul'),
                props = grid.prop();
            // uncheck all
            list.find('i').attr('class', 'icon-none');
            // sort
            list.find(
                    '[data-option="' + props.order + '"], ' +
                    '[data-option="' + (settings.get('showAllPrivateAppointments', false) ? 'all' : '~all') + '"]'
                )
                .find('i').attr('class', 'icon-ok');
            // order
            var opacity = [1, 0.4][props.order === 'asc' ? 'slice' : 'reverse']();
            dropdown.find('.icon-arrow-down').css('opacity', opacity[0]).end()
                .find('.icon-arrow-up').css('opacity', opacity[1]).end();
        }

        ext.point('io.ox/calendar/vgrid/toolbar').extend({
            id: 'dropdown',
            index: 100,
            draw: function () {
                this.prepend(
                    optDropdown = $('<div>').addClass('grid-options dropdown').css({ display: 'inline-block', 'float': 'right' })
                        .append(
                            $('<a>', { href: '#' })
                                .attr('data-toggle', 'dropdown')
                                .append(
                                    $('<i class="icon-arrow-down">'),
                                    $('<i class="icon-arrow-up">')
                                )
                                .dropdown(),
                            $('<ul>').addClass("dropdown-menu")
                                .append(
                                    buildOption('desc', gt('Ascending')),
                                    buildOption('asc', gt('Descending')),
                                    $('<li class="divider">'),
                                    buildOption('all', gt('show all'))
                                )
                                .on('click', 'a', { grid: grid }, function () {
                                    var option = $(this).attr('data-option');
                                    switch (option) {
                                    case 'asc':
                                    case 'desc':
                                        grid.prop('order', option).refresh(true);
                                        break;
                                    case 'all':
                                        settings.set('showAllPrivateAppointments', !settings.get('showAllPrivateAppointments', false)).save();
                                        app.trigger('folder:change');
                                        break;
                                    default:
                                        break;
                                    }
                                })
                        )
                );
            }
        });

        grid.setAllRequest(function () {
            var prop = grid.prop(),
                start = new date.Local().setHours(0, 0, 0, 0),
                end = new date.Local(start).setMonth(start.getMonth() + 1);

            return app.folder.getData().pipe(function (folder) {
                // set folder data to view and update
                return api.getAll({
                    start: start.getTime(),
                    end: end.getTime(),
                    folder: settings.get('showAllPrivateAppointments', false) && folder.type === 1 ? undefined : prop.folder,
                    order: prop.order
                }).pipe(function (data) {
                    if (!settings.get('showDeclinedAppointments', false)) {
                        data = _.filter(data, function (obj) {
                            return util.getConfirmationStatus(obj) !== 2;
                        });
                    }
                    if (findRecurrence) {

                        var foundRecurrence = false,
                            searchItem = _.url.hash('id').split('.');

                        _(data).each(function (obj) {
                            if (obj.id.toString() === searchItem[1] && obj.folder_id.toString() === searchItem[0]) {
                                if (foundRecurrence) {
                                    if (foundRecurrence > obj.recurrence_position) {
                                        foundRecurrence = obj.recurrence_position;
                                    }

                                } else {
                                    foundRecurrence = obj.recurrence_position || 0;
                                }
                            }
                        });

                        //found valid recurrence, append it
                        if (foundRecurrence !== false) {
                            _.url.hash({id: _.url.hash('id') + '.' + foundRecurrence});
                        } else {//ok its not in the list lets show it directly
                            app.trigger('show:appointment', {id: searchItem[1], folder_id: searchItem[0], recurrence_position: 0}, true);
                        }

                        findRecurrence = false;//only search once
                    }
                    return data;
                });
            });
        });

        commons.wireGridAndSelectionChange(grid, 'io.ox/calendar', showAppointment, right, api);
        commons.wireGridAndWindow(grid, win);
        commons.wireGridAndRefresh(grid, api, win);
        commons.addGridFolderSupport(app, grid);
        commons.addGridToolbarFolder(app, grid);

        grid.on('change:prop', updateGridOptions);
        updateGridOptions();

        grid.setListRequest(function (ids) {
            return $.Deferred().resolve(ids);
        });

        grid.prop('folder', app.folder.get());
        app.on('folder:change', function () {
            updateGridOptions();
            grid.refresh(true);
        });
        //to show an appointment without it being in the grid, needed for direct links
        app.on('show:appointment', showAppointment);
        grid.paint();
    };

    return perspective;
});
