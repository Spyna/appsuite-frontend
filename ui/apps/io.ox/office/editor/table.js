/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2012
 * Mail: info@open-xchange.com
 *
 * @author Ingo Schmidt-Rosbiegal <ingo.schmidt-rosbiegal@open-xchange.com>
 */

define('io.ox/office/editor/table',
    ['io.ox/office/tk/utils',
     'io.ox/office/editor/dom',
     'io.ox/office/editor/position',
     'io.ox/office/editor/oxopam'], function (Utils, DOM, Position, OXOPaM) {

    'use strict';

    // static class Table =====================================================

    /**
     * Provides static helper methods for manipulation and calculation
     * of table nodes and its children.
     */
    var Table = {};

    // static functions =======================================================

    /**
     * Creating the grid of widths for all grid positions in a table.
     *
     * @param {Node} startnode
     *  The start node corresponding to the logical position.
     *  (Can be a jQuery object for performance reasons.)
     *
     * @param {Number[]} tablePos
     *  The logical position of the table element
     *
     * @returns {[]}
     *  Array of grid widths of the table in 1/100 mm
     */
    Table.getTableGrid = function (startnode, tablePos) {

        var tablegrid = [],
            tablePosition = Position.getDOMPosition(startnode, tablePos);

        if (tablePosition) {

            var tableNode = tablePosition.node,
                validTableGrid = false;

            if ($(tableNode).data('grid')) {

                tablegrid = $(tableNode).data('grid');

                if (tablegrid.length > 0) {
                    validTableGrid = true;
                }

                for (var i = 0; i < tablegrid.length; i++) {
                    if ((! _.isNumber(tablegrid[i])) || (tablegrid[i] + '' === 'NaN'))  {  // NaN returns true in _.isNumber check
                        validTableGrid = false;
                        break;
                    }
                }
            }

            if (! validTableGrid) {

                tablegrid = [];

                var allCols = $(tableNode).children('colgroup').children('col');

                allCols.each(function (index) {
                    var width = Utils.convertLengthToHmm($(this).width(), 'px');
                    tablegrid.push(width);
                });

                $(tableNode).data('grid', tablegrid);
            }
        }

        return tablegrid;
    };

    /**
     * Calculation the width of a table as the some of the width of all
     * grid positions.
     *
     * @param {Node} startnode
     *  The start node corresponding to the logical position.
     *  (Can be a jQuery object for performance reasons.)
     *
     * @param {Number[]} tablePos
     *  The logical position of the table element
     *
     * @returns {Number}
     *  The width of the table in 1/100 mm
     */
    Table.getTableWidth = function (startnode, tablePos) {

        var width = 0,
            tablePosition = Position.getDOMPosition(startnode, tablePos);

        if (tablePosition) {

            var tableNode = tablePosition.node;

            if ($(tableNode).data('width')) {

                width = $(tableNode).data('width');

            } else {

                var tablegrid = Table.getTableGrid(startnode, tablePos);

                if (tablegrid) {
                    for (var i = 0; i < tablegrid.length; i++) {
                        width += tablegrid[i];
                    }

                    $(tableNode).data('width', width);
                }
            }
        }

        return width;
    };

    /**
     * Recalculating the grid widths of a table, if a new column is inserted.
     * Assuming that the width of the complete table does not change.
     *
     * @param {Node} startnode
     *  The start node corresponding to the logical position.
     *  (Can be a jQuery object for performance reasons.)
     *
     * @param {Number[]} tablePos
     *  The logical position of the table element
     *
     * @param {Number} gridPosition
     *  The grid number that is the basis for the new grid
     *
     * @param {Boolean} insertmode
     *  The insertmode can be 'before' or 'behind'. This is relevant for
     *  the position of the added column.
     *
     * @returns {[]}
     *  Array of grid widths of the table in 1/100 mm
     */
    Table.getTableGridWithNewColumn = function (startnode, tablePos, gridPosition, insertmode) {

        var tableGrid = Table.getTableGrid(startnode, tablePos),
            tableWidth = 0;

        if (! tableGrid) {
            Utils.error('Table.getTableGridWithNewColumn(): Unable to get existing table grid');
            return;
        }

        for (var i = 0; i < tableGrid.length; i++) {
            tableWidth += tableGrid[i];
        }

        var additionalWidth = tableGrid[gridPosition],
            completeWidth = tableWidth + additionalWidth,
            factor = Utils.roundDigits(tableWidth / completeWidth, 2);

        var insertPos = gridPosition;
        if (insertmode === 'behind') {
            insertPos++;
        }
        tableGrid.splice(insertPos, 0, additionalWidth);  // ignoring insertmode !?

        for (var i = 0; i < tableGrid.length; i++) {
            tableGrid[i] = Utils.roundDigits(factor * tableGrid[i], 2);
        }

        return tableGrid;

    };

    /**
     * Calculating the grid position of a selected cell. The attribute
     * 'colspan' of all previous cells in the row have to be added.
     * The return value is 0-based. The first cell in a row always has
     * grid position 0.
     *
     * @param {Number[]} rowNode
     *  The dom position of the row element
     *
     * @param {Number} cellPosition
     *  The cell number inside the row
     *
     * @returns {Object} gridPosition
     *  An array with start and end number representing the grid position
     *  of the selected cell. If the cell has a width of one grid position,
     *  start and end are equal.
     */
    Table.getGridPositionFromCellPosition = function (rowNode, cellPosition) {

        var gridPosition = 0,
            endGridPosition = 0,
            startGridPosition = 0,
            allCells = $(rowNode).children();

        allCells.each(function (index) {

            if (index <= cellPosition) {
                var colSpan = 1;
                if ($(this).attr('colspan')) {
                    colSpan = parseInt($(this).attr('colspan'), 10);
                }

                gridPosition += colSpan;

                if (index === cellPosition) {  // last run, the specified cell

                    endGridPosition = gridPosition;  // the end grid position of the selected cell
                    startGridPosition = gridPosition - colSpan + 1;  // the start grid position of the selected cell

                    endGridPosition--;  // grid position are 0-based
                    startGridPosition--;   // grid position are 0-based
                }

            } else {
                return false; // leaving the each-loop
            }
        });

        return {start: startGridPosition, end: endGridPosition};
    };

    /**
     * Calculating the cell node in a row that fits to the specified
     * grid position. The attribute 'colspan' of all previous cells in
     * the row have to be added.
     *
     * @param {Node} rowNode
     *  The dom node of the row element
     *
     * @param {Number} gridPosition
     *  The grid number that is the basis for the new grid
     *
     * @param {Boolean} defaultToLastCell
     *  This boolean specifies, if the position of the last cell shall be returned,
     *  if no cell is found corresponding to the grid position. This can happen, if
     *  there is a short row between longer rows. In insertColumn a new cell shall
     *  always be added behind the last cell in this short row. In deleteColumns
     *  the last column of the short row shall not be deleted, if the gridposition
     *  is not valid.
     *
     * @returns {Number} cellPosition
     *  The cell position that corresponds to the grid position. If no cell has
     *  the specified grid position, the last cell position is returned.
     */
    Table.getCellPositionFromGridPosition = function (rowNode, gridPosition, defaultToLastCell) {

        var cellPosition = 0,
            allCells = $(rowNode).children(),
            gridSum = 0,
            foundCell = true,
            colSpanTarget = gridPosition + 1; // grid position is 0-based

        if (defaultToLastCell !== false) {
            defaultToLastCell = true;  // no explicit setting required for 'true'
        }

        allCells.each(function (index) {
            cellPosition = index;
            if (gridSum < colSpanTarget) {
                var colSpan = 1;
                if ($(this).attr('colspan')) {
                    colSpan = parseInt($(this).attr('colspan'), 10);
                }

                gridSum += colSpan;

                if (gridSum >= colSpanTarget) {
                    return false; // leaving the each-loop
                }

            } else {
                return false; // leaving the each-loop
            }
        });

        if (gridSum < colSpanTarget) {
            // maybe there are not enough cells in this row
            foundCell = false;
        }

        // In deleteColumns, cells shall only be deleted, if there is a cell
        // with the specified grid position.
        // In insertColumn, cells shall always be added.

        if ((! foundCell) && (! defaultToLastCell)) {
            cellPosition = -1;
        }

        return cellPosition;

    };

    /**
     * Calculating the sum of all colspans from a selection of cells.
     *
     * @param {jQuery} cellSelection
     *  The jQuery selection of cell element(s).
     *
     * @returns {Number} sum
     *  The sum of all col spans in the selection of cells.
     */
    Table.getColSpanSum = function (cellSelection) {

        var sum = 0;

        cellSelection.each(function (index) {

            var colSpan = 1;
            if ($(this).attr('colspan')) {
                colSpan = parseInt($(this).attr('colspan'), 10);
            }

            sum += colSpan;
        });

        return sum;
    };

    /**
     * Shifting the content of table cells from one or more cells to one
     * target cell.
     *
     * @param {jQuery} targetCell
     *  The jQuery selection containing a cell element in which the content
     *  of the other cells shall be included.
     *
     * @param {jQuery} sourceCells
     *  The jQuery selection of cell element(s), whose content shall be
     *  added to another cell.
     */
    Table.shiftCellContent = function (targetCell, sourceCells) {

        sourceCells.each(function (index) {
            targetCell.append($(this).children());
        });
    };


    /**
     * Collecting the attributes of table cells from a jQuery collection of cells.
     *
     * @param {jQuery} cells
     *  The jQuery collection containing cell elements, whose attributes shall
     *  be collected in an array.
     *
     * @return {Object[]} allCellAttributes
     *  An array, that contains the cell attributes in the correct order.
     */
    Table.getCellAttributes = function (cells) {

        var allCellAttributes = [];

        cells.each(function (index) {

            var cellAttrs = {};

            // trying to get attributes from the cell (attributes might be different for each cell)
            if ($(this).data('attributes')) {
                cellAttrs = $(this).data('attributes');
            }
            if ($(this).attr('colspan')) {
                cellAttrs.gridspan = $(this).attr('colspan');
            }

            allCellAttributes.push(cellAttrs);
        });

        return allCellAttributes;

    };

    /**
     * Collecting for a collection of rows the cell positions that correspond
     * to a specific grid position.
     *
     * @param {jQuery} allRows
     *  The jQuery collection containing row elements, whose cell positions
     *  corresponding to a specific grid position shall be collected in an array.
     *
     * @param {Number} gridposition
     *  The integer grid position.
     *
     * @param {String} insertmode
     *  The calculated cell position depends from the insert mode concerning
     *  the grid position. Allowed values are 'behind' and 'before'.
     *
     * @return {any[]} allInsertPositions
     *  An array, that contains the integer insert positions for each row in the
     *  correct order.
     */
    Table.getAllInsertPositions = function (allRows, gridposition, insertmode) {

        var allInsertPositions = [];

        allRows.each(function (index) {

            var insertPosition = Table.getCellPositionFromGridPosition(this, gridposition);

            if (insertmode === 'behind') {
                insertPosition++;
            }

            allInsertPositions.push(insertPosition);
        });

        return allInsertPositions;
    };

    // exports ================================================================

    return Table;

});
