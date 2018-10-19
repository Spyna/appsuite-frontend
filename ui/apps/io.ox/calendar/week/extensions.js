/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2016 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Richard Petersen <richard.petersen@open-xchange.com>
 */

define('io.ox/calendar/week/extensions', [
    'io.ox/core/extensions',
    'io.ox/calendar/util'
], function (ext, util) {

    'use strict';

    ext.point('io.ox/calendar/week/view/appointment').extend({
        id: 'resize-fulltime',
        index: 100,
        draw: function (baton) {
            var model = baton.model;
            if (!util.isAllday(model)) return;
            if (!this.hasClass('modify')) return;
            var startDate = baton.view.model.get('startDate'),
                endDate = startDate.clone().add(baton.view.numColumns, 'days');
            if (!model.getMoment('startDate').isSame(startDate, 'day')) this.append($('<div class="resizable-handle resizable-w">'));
            if (!model.getMoment('endDate').isSame(endDate, 'day')) this.append($('<div class="resizable-handle resizable-e">'));
        }
    });

    ext.point('io.ox/calendar/week/view/appointment').extend({
        id: 'resize',
        index: 200,
        draw: function (baton) {
            var model = baton.model;
            if (util.isAllday(model)) return;
            if (!this.hasClass('modify')) return;
            if (!model.getMoment('startDate').isSame(baton.date, 'day')) this.append($('<div class="resizable-handle resizable-n">'));
            if (!model.getMoment('endDate').isSame(baton.date, 'day')) this.append($('<div class="resizable-handle resizable-s">'));
        }
    });

    ext.point('io.ox/calendar/week/view/appointment').extend({
        id: 'flags',
        index: 300,
        draw: function (baton) {
            var model = baton.model;
            if (util.isAllday(model)) return;
            var contentContainer = $(this).find('.appointment-content'),
                contentHeight = contentContainer.height(),
                titleHeight = $(this).find('.title').height(),
                noWrap = $(this).hasClass('no-wrap'),
                locationHeight = $(this).find('.location').length < 1 || noWrap ? 0 : $(this).find('.location').height(),
                flags = util.returnIconsByType(model).property,
                flagsHeight = 12;
            if (flags.length === 0) return;
            if (titleHeight + locationHeight < contentHeight - flagsHeight) {
                contentContainer.append($('<div class="flags bottom-right">').append(flags));
            }
        }
    });

});
