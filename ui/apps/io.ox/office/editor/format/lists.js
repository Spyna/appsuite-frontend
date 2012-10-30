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
 * @author Oliver Specht <oliver.specht@open-xchange.com>
 */

define('io.ox/office/editor/format/lists',
    ['io.ox/office/tk/utils',
     'io.ox/office/editor/format/container',
     'io.ox/office/editor/operations'
    ], function (Utils, Container, Operations) {

    'use strict';

    // class Lists ============================================================

    /**
     * Contains the definitions of lists.
     *
     * @constructor
     *
     * @extends Container
     *
     * @param {DocumentStyles} documentStyles
     *  Collection with the style containers of all style families.
     */
    function Lists(documentStyles) {

        var // list definitions
            lists = [],
        // defaults
            defaultNumberingNumId, defaultBulletNumId;

        var defaultBulletListDefinition = {
            listlevel0: { justification: 'left', leftindent: 1270,     numberformat: 'bullet', levelstart: 1, fontname: 'Symbol', leveltext: '', hangingindent: 635 },
            listlevel1: { justification: 'left', leftindent: 2 * 1270, numberformat: 'bullet', levelstart: 1, fontname: 'Symbol', leveltext: 'o',  hangingindent: 635 },
            listlevel2: { justification: 'left', leftindent: 3 * 1270, numberformat: 'bullet', levelstart: 1, fontname: 'Symbol', leveltext: '', hangingindent: 635 },
            listlevel3: { justification: 'left', leftindent: 4 * 1270, numberformat: 'bullet', levelstart: 1, fontname: 'Symbol', leveltext: '', hangingindent: 635 },
            listlevel4: { justification: 'left', leftindent: 5 * 1270, numberformat: 'bullet', levelstart: 1, fontname: 'Symbol', leveltext: 'o', hangingindent: 635 },
            listlevel5: { justification: 'left', leftindent: 6 * 1270, numberformat: 'bullet', levelstart: 1, fontname: 'Symbol', leveltext: '', hangingindent: 635 },
            listlevel6: { justification: 'left', leftindent: 7 * 1270, numberformat: 'bullet', levelstart: 1, fontname: 'Symbol', leveltext: '', hangingindent: 635 },
            listlevel7: { justification: 'left', leftindent: 8 * 1270, numberformat: 'bullet', levelstart: 1, fontname: 'Symbol', leveltext: 'o',  hangingindent: 635 },
            listlevel8: { justification: 'left', leftindent: 9 * 1270, numberformat: 'bullet', levelstart: 1, fontname: 'Symbol', leveltext: '', hangingindent: 635 }
        };
        // O 2010 uses: decimal-lowerLetter-lowerRomen-decimal-lowerLetter-lowerRomen-decimal-lowerLetter-lowerRomen-
        var defaultNumberingListDefinition = {
            listlevel0: { numberformat: 'decimal',       levelstart: 1, leftindent: 1270,     hangingindent: 635, justification: 'left',  leveltext: '%1.'},
            listlevel1: { numberformat: 'lowerLetter',   levelstart: 1, leftindent: 2 * 1270, hangingindent: 635, justification: 'left',  leveltext: '%2.'},
            listlevel2: { numberformat: 'upperLetter',   levelstart: 1, leftindent: 3 * 1270, hangingindent: 635, justification: 'right', leveltext: '%3.'},
            listlevel3: { numberformat: 'lowerRoman',    levelstart: 1, leftindent: 4 * 1270, hangingindent: 635, justification: 'left',  leveltext: '%4.'},
            listlevel4: { numberformat: 'upperRoman',    levelstart: 1, leftindent: 5 * 1270, hangingindent: 635, justification: 'left',  leveltext: '%5.'},
            listlevel5: { numberformat: 'decimal',       levelstart: 1, leftindent: 6 * 1270, hangingindent: 635, justification: 'right', leveltext: '%6.'},
            listlevel6: { numberformat: 'lowerLetter',   levelstart: 1, leftindent: 7 * 1270, hangingindent: 635, justification: 'left',  leveltext: '%7.'},
            listlevel7: { numberformat: 'upperLetter',   levelstart: 1, leftindent: 8 * 1270, hangingindent: 635, justification: 'left',  leveltext: '%8.'},
            listlevel8: { numberformat: 'lowerRoman',    levelstart: 1, leftindent: 9 * 1270, hangingindent: 635, justification: 'right', leveltext: '%9.'}
        };
        // base constructor ---------------------------------------------------

        Container.call(this, documentStyles);

        // methods ------------------------------------------------------------

        function isLevelEqual(defaultLevel, compareLevel) {
            var ret = defaultLevel !== undefined && compareLevel !== undefined &&
            defaultLevel.numberformat === compareLevel.numberformat &&
            defaultLevel.leftindent === compareLevel.leftindent &&
            defaultLevel.hangingindent === compareLevel.hangingindent &&
            defaultLevel.firstlineindent === compareLevel.firstlineindent &&
            defaultLevel.justification === compareLevel.justification &&
            defaultLevel.leveltext === compareLevel.leveltext &&
            defaultLevel.fontname === compareLevel.fontname;
            return ret;
        }
        function isDefinitionEqual(defaultDefinition, compareDefinition) {
            var ret = isLevelEqual(defaultDefinition.listlevel0, compareDefinition.listlevel0) &&
                    isLevelEqual(defaultDefinition.listlevel1, compareDefinition.listlevel1) &&
                    isLevelEqual(defaultDefinition.listlevel2, compareDefinition.listlevel2) &&
                    isLevelEqual(defaultDefinition.listlevel3, compareDefinition.listlevel3) &&
                    isLevelEqual(defaultDefinition.listlevel4, compareDefinition.listlevel4) &&
                    isLevelEqual(defaultDefinition.listlevel5, compareDefinition.listlevel5) &&
                    isLevelEqual(defaultDefinition.listlevel6, compareDefinition.listlevel6) &&
                    isLevelEqual(defaultDefinition.listlevel7, compareDefinition.listlevel7) &&
                    isLevelEqual(defaultDefinition.listlevel8, compareDefinition.listlevel8);

            return ret;
        }

        function convertToRoman(value, caps) {
            var result = '';
            var romanCapsArr = ['M', 'D', 'C', 'L', 'X', 'V', 'I'];
            var romanSmallArr = ['m', 'd', 'c', 'l', 'x', 'v', 'i'];
            var romanValArr = [1000, 500, 100,  50,  10,   5,   1];
            if (value > 0) {
                var index = 0;
                for (;index < 7; index++) {
                    while (value >= romanValArr[index]) {
                        result += caps ? romanCapsArr[index] : romanSmallArr[index];
                        value -= romanValArr[index];
                    }
                    var position = 7;
                    for (; position > index; position--) {
                        var tempVal = romanValArr[index] - romanValArr[position];
                        if ((romanValArr[position] < tempVal) && (tempVal <= value))
                        {
                            if (caps)
                                result += romanCapsArr[position] + romanCapsArr[index];
                            else
                                result += romanSmallArr[position] + romanSmallArr[index];
                            value -= tempVal;
                        }
                    }
                }
            }
            return result;
        }
        function parseRoman(text) {
            var romanSmallArr = ['m', 'd', 'c', 'l', 'x', 'v', 'i'],
            romanValArr = [1000, 500, 100,  50,  10,   5,   1],
            ret = {},
            lowerText = text.toLowerCase(),
            startValue = 0;
            ret.caps = lowerText !== text;
            var index = 0, lastValue = 1000;
            for (; index < text.length; ++index) {
                var position = 0;
                for (; position < 7; ++position) {
                    var char = lowerText.charAt(index);
                    if (char === romanSmallArr[position]) {
                        var value = romanValArr[position];
                        if (lastValue < value) {
                            startValue = startValue - lastValue + (value - lastValue);
                        } else {
                            startValue += value;
                        }
                        lastValue = value;
                        break;
                    }
                }
            }
            if (startValue > 0) {
                ret.startnumber = startValue;
                ret.numberformat = lowerText !== text ? 'upperRoman' : 'lowerRoman';
            }
            return ret;
        }
        function formatNumberType(seqNo, numberformat, leveltext) {
            var retString = "???";
            switch (numberformat) {
            case "decimal":
                retString = seqNo.toString();
                break;
            case "lowerLetter":
                retString = String.fromCharCode(96 + seqNo);
                break;
            case "upperLetter":
                retString = String.fromCharCode(64 + seqNo);
                break;
            case "lowerRoman":
            case "upperRoman":
                retString = convertToRoman(seqNo, numberformat === "upperRoman");
                break;
            case "bullet":
                var charCode = leveltext ? leveltext.charCodeAt(0) : -1;
                if (charCode > 0 && (charCode < 0xE000 || charCode > 0xF8FF)) {
                    retString = leveltext;
                }
                else
                    retString = "●";
                break;
            case "none":
                retString = '';
                break;
            default:
            }
            if (numberformat !== 'bullet')
                retString += '.';
            return retString;
        }
        // exports ================================================================

        /**
         * Adds a new list to this container. An existing list definition
         * with the specified identifier will be replaced.
         *
         * @param {String} name
         *  The name of of the new list definition.
         *
         * @param {Object} listDefinition
         *  The attributes of the list definition.
         *
         * @returns {Lists}
         *  A reference to this instance.
         */
        this.addList = function (listIdentifier, listdefinition) {

            lists[listIdentifier] = {};
            var list = lists[listIdentifier];
            //list.listIdentifier = listIdentifier;
            list.listlevels = [];
            if (listdefinition) {
                list.listlevels[0] = listdefinition.listlevel0;
                list.listlevels[1] = listdefinition.listlevel1;
                list.listlevels[2] = listdefinition.listlevel2;
                list.listlevels[3] = listdefinition.listlevel3;
                list.listlevels[4] = listdefinition.listlevel4;
                list.listlevels[5] = listdefinition.listlevel5;
                list.listlevels[6] = listdefinition.listlevel6;
                list.listlevels[7] = listdefinition.listlevel7;
                list.listlevels[8] = listdefinition.listlevel8;
                if (listdefinition.defaultlist) {
                    if (listdefinition.defaultlist === 'bullet')
                        defaultBulletNumId = listIdentifier;
                    else
                        defaultNumberingNumId = listIdentifier;
                } else {
                    if (defaultBulletNumId === undefined) {
                        if (isDefinitionEqual(defaultBulletListDefinition, listdefinition) === true)
                            defaultBulletNumId = listIdentifier;
                    }
                    if (defaultNumberingNumId === undefined) {
                        if (isDefinitionEqual(defaultNumberingListDefinition, listdefinition) === true)
                            defaultNumberingNumId = listIdentifier;
                    }
                }
            }
            // notify listeners
            this.triggerChangeEvent();

            return this;
        };

        /**
         * Gives access to a single list definition.
         *
         * @param name the name of the list to return.
         * @returns {Lists}
         *  A reference to this instance.
         */
        this.getList = function (name) {
            return (name in lists) ? lists[name] : undefined;
        };

        /**
         * Gives access to all list definitions.
         */
        this.getLists = function () {
            return lists;
        };

        /**
         * @param {String} type
         *  either bullet or numbering
         * @returns {integer}
         *  the Id of a default bullet or numbered numbering. If this default numbering definition is not available then it will be created
         */
        this.getDefaultNumId = function (type) {
            return type === 'bullet' ? defaultBulletNumId : defaultNumberingNumId;
        };
        /**
         * @param {String} type
         *  either bullet or numbering
         * @param {Object} options
         *  can contain symbol - the bullet symbol
         *              levelstart - start index of an ordered list
         * @returns {Object}
         *  the operation that creates the requested list
         *
         */
        this.getDefaultListOperation = function (type, options) {
            var freeId = 1;
            for (;;++freeId) {
                if (!(freeId in lists))
                    break;
            }
            var newOperation = { name: Operations.INSERT_LIST, listname: freeId };
            if (type === 'bullet') {
                newOperation.listdefinition = _.copy(defaultBulletListDefinition, true);
                if (options && options.symbol && options.symbol !== '*') {
                    newOperation.listdefinition.listlevel0.leveltext = options.symbol;
                } else {
                    newOperation.listdefinition.defaultlist = type;
                }
            } else {
                newOperation.listdefinition = _.copy(defaultNumberingListDefinition, true);
                var defaultlist = true;
                if (options) {
                    if (options.levelstart) {
                        newOperation.listdefinition.listlevel0.levelstart = options.levelstart;
                        defaultlist = false;
                    }
                    if (options.numberformat) {
                        newOperation.listdefinition.listlevel0.numberformat = options.numberformat;
                        defaultlist = false;
                    }
                }
                if (defaultlist) {
                    newOperation.listdefinition.defaultlist = type;
                }
            }
            return newOperation;
        };
        /**
         *
         * @param {integer} numId
         *  id of a list
         * @param {String} type
         *  either bullet or numbering
         * @returns {bool}
         *  determines whether a supplied id is points to the default list of bullets or numberings
         *
         */
        this.isDefaultList = function (numId, type) {
            return (type === 'bullet' && defaultBulletNumId === numId) ||
                    (type === 'numbering' && defaultNumberingNumId === numId);
        };
        /**
         * Generates the numbering Label for the given paragraph
         *
         * @param listId identifier of the applied numbering definition
         * @param ilvl indent level, zero based
         * @param levelIndexes array of sequential position of the current paragraph
         *      contains an array with ilvl + 1 elements that determines the sequential position of the current paragraph within the numbering
         *
         * @returns {Object} containing:
         *          indent
         *          labelwidth
         *          text
         *          tbd.
         */
        this.formatNumber = function (listId, ilvl, levelIndexes) {
            var ret = {};
            var currentList = this.getList(listId);
            if (currentList === undefined) {
                return "?";
            }
            var levelFormat = currentList.listlevels[ilvl];
            if (levelFormat === undefined) {
                return "??";
            }
            var numberformat = levelFormat.numberformat;
            ret.text = formatNumberType(levelIndexes === undefined ? 0 :
                    levelIndexes[ilvl] + (levelFormat.levelstart !== undefined ? levelFormat.levelstart - 1 : 0), numberformat,
                    levelFormat.leveltext);
            ret.indent = levelFormat.leftindent - (levelFormat.hangingindent ? levelFormat.hangingindent : 0);
            //+ levelFormat.firstlineindent
            ret.labelWidth = (levelFormat.hangingindent ? levelFormat.hangingindent : 0);
            return ret;
        };

        /**
         * @param text possible numbering label text
         *
         * @returns {integer} listId
         *
         */
        this.detectListSymbol = function (text) {
            var ret = {};
            if (text.length === 1 && (text === '-' || text === '*')) {
                // bullet
                ret.numberformat = 'bullet';
                ret.symbol = text;
            } else if (text.substring(text.length - 1) === '.') {
                var sub = text.substring(0, text.length - 1);
                var startnumber = parseInt(sub, 10);
                if (startnumber > 0) {
                    ret.numberformat = 'decimal';
                    ret.levelstart = startnumber;
                } else {
                    var roman = parseRoman(text);
                    if (roman.startnumber > 0) {
                        ret.numberformat = roman.numberformat;
                        ret.levelstart = roman.startnumber;
                    }
                }
            }
            return ret;
        };
        this.findIlvl = function (numId, pstyle) {
            var list = this.getList(numId);
            if (list === undefined) {
                return -1;
            }
            var ilvl = 0;
            for (; ilvl < 9; ++ilvl) {
                var levelFormat = list.listlevels[ilvl];
                if (levelFormat.pstyle === pstyle)
                    return ilvl;
            }
            return -1;
        };

    } // class Lists

    // derive this class from class Container
    return Container.extend({ constructor: Lists });

});
