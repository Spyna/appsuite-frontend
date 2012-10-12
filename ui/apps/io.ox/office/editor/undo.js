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
 * @author Malte Timmermann <malte.timmermann@open-xchange.com>
 * @author Ingo Schmidt-Rosbiegal <ingo.schmidt-rosbiegal@open-xchange.com>
 */

define('io.ox/office/editor/undo',
    ['io.ox/office/tk/utils',
     'io.ox/office/editor/operations'
    ], function (Utils, Operations) {

    'use strict';

    // private global functions ===============================================

    function isSameParagraph(pos1, pos2) {
        if (pos1.length !== pos2.length)
            return false;
        if (pos1.length < 2)
            return false;
        var n = pos1.length - 2;
        for (var i = 0; i <= n; i++)
            if (pos1[n] !== pos2[n])
                return false;
        return true;
    }

    // class Action ===========================================================

    /**
     * An instance of Action is used by the undo manager to store undo and redo
     * operations and to apply them in the editor.
     *
     * @constructor
     *
     * @param {Object|Object[]} [undoOperations]
     *  One ore more operations that form a logical undo action. When the undo
     *  action is executed, the operations will be applied in the exact order
     *  as passed in this parameter; they will NOT be applied in reversed order
     *  as it would be the case if the operations have been added in multiple
     *  undo actions. The parameter may be a single operation object, an array
     *  of operation objects, or omitted.
     *
     * @param {Object|Object[]} [redoOperations]
     *  One ore more operations that form a logical redo action. When the redo
     *  action is executed, the operations will be applied in the exact order
     *  as passed in this parameter. The parameter may be a single operation
     *  object, an array of operation objects, or omitted.
     */
    function Action(undoOperations, redoOperations) {
        this.undoOperations = _.isArray(undoOperations) ? undoOperations : _.isObject(undoOperations) ? [_.copy(undoOperations, true)] : [];
        this.redoOperations = _.isArray(redoOperations) ? redoOperations : _.isObject(redoOperations) ? [_.copy(redoOperations, true)] : [];
    }

    /**
     * Returns whether this action is an 'insertText' action (an action with a
     * single 'insertText' redo operation and a single 'deleteText' undo
     * operation).
     */
    Action.prototype.isInsertTextAction = function () {
        return (this.undoOperations.length === 1) && (this.undoOperations[0].name === Operations.TEXT_DELETE) &&
            (this.redoOperations.length === 1) && (this.redoOperations[0].name === Operations.TEXT_INSERT);
    };

    /**
     * Tries to merge this action with the passed action. Merging works only
     * if both actions represent a single 'insertText' operation, and the
     * passed action appends a single character directly after the text of this
     * action.
     *
     * @param {Operation} nextAction
     *  The action that will be tried to merge into this action.
     *
     * @returns {Boolean}
     *  Whether the passed action has been merged successfully into this
     *  action.
     */
    Action.prototype.tryMergeInsertCharacter = function (nextAction) {

        var // check if this and the passed action is an 'insertText' action
            validActions = this.isInsertTextAction() && nextAction.isInsertTextAction(),

            // the redo operation of this action and the passed action
            thisRedo = this.redoOperations[0],
            nextRedo = nextAction.redoOperations[0],

            // last array index in logical positions (pointing to the character offset)
            lastIndex = 0;

        // check that the operations are valid for merging the actions
        if (validActions && (nextRedo.text.length === 1) && isSameParagraph(thisRedo.start, nextRedo.start)) {

            lastIndex = thisRedo.start.length - 1;

            // check that the new action adds the character directly after the text of this action
            if (thisRedo.start[lastIndex] + thisRedo.text.length === nextRedo.start[lastIndex]) {

                // check that the last character of this action is not a space character (merge actions word by word)
                if (thisRedo.text.substr(-1) !== ' ') {

                    // merge undo operation (delete one more characters)
                    this.undoOperations[0].end[lastIndex] += 1;
                    // merge redo operation (add the character)
                    thisRedo.text += nextRedo.text;
                    return true;
                }
            }
        }
        return false;
    };

    /**
     * Applies the undo operations of this action at the passed editor.
     */
    Action.prototype.undo = function (editor) {
        // Doc is being modified, so we need to notify/transfer/merge this operation. Is there a better way for undo?
        _(this.undoOperations).each(function (operation) {
            editor.applyOperation(operation, true, true);
        });
    };

    /**
     * Applies the redo operations of this action at the passed editor.
     */
    Action.prototype.redo = function (editor) {
        _(this.redoOperations).each(function (operation) {
            editor.applyOperation(operation, true, true);
        });
    };

    // class UndoManager ======================================================

    /**
     * The undo manager is used by the editor to administer the operation
     * handling concerning undo and redo. Also the grouping and merging of
     * operations is a task of the undo manager.
     *
     * @constructor
     *
     * @param {Editor} editor
     *  The editor instance where undo and redo operations will be applied.
     */
    function UndoManager(editor) {

        var actions = [],
            // maxActions = 1000,   // not clear if really wanted/needed...
            currentAction = 0,
            groupLevel = 0,
            groupedActions = null,
            enabled = true,
            processing = false;

        // private methods ----------------------------------------------------

        function startActionGroup() {

            // count nested calls but use the same array for all actions
            groupLevel += 1;

            // create an array object for the grouped actions that contains
            // custom undo() and redo() methods
            if (!groupedActions) {
                groupedActions = [];
                groupedActions.undo = function (editor) {
                    var index = this.length;
                    while (index-- > 0) {
                        this[index].undo(editor);
                    }
                };
                groupedActions.redo = function (editor) {
                    _(this).invoke('redo', editor);
                };
            }
        }

        function endActionGroup() {

            // one level up in nested calls of startActionGroup()/endActionGroup()
            groupLevel -= 1;

            // push action group array to global action stack on last call
            if ((groupLevel === 0) && (groupedActions.length > 0)) {
                actions.push(groupedActions);
                currentAction = actions.length;
                groupedActions = null;
            }
        }

        function pushAction(actionStack, nextAction) {

            var // last action on passed action stack
                lastAction = actionStack[actionStack.length - 1];

            // try to merge an 'insertText' operation for a single character with the last action on stack
            if (_.isObject(lastAction) && _.isFunction(lastAction.tryMergeInsertCharacter) && lastAction.tryMergeInsertCharacter(nextAction)) {
                return;
            }

            // action has not been merged: append
            actionStack.push(nextAction);
        }

        // methods ------------------------------------------------------------

        this.clear = function () {
            actions = [];
            currentAction = 0;
        };

        this.isEnabled = function () {
            return enabled && !processing;
        };

        this.enable = function (state) {
            enabled = state;
            if (!enabled) {
                this.clear();
            }
        };

        /**
         * Opens an undo group. All undo operations added while an undo group
         * is open will be collected and act like a single undo action. Can be
         * called repeatedly. Every call of this method must be followed by a
         * matching call of the method UndoManager.endGroup().
         *
         * @deprecated
         *  Use method UndoManager.enterGroup() instead.
         */
        this.startGroup = function () {
            startActionGroup();
        };

        /**
         * Closes an undo group that has been opened with the method
         * UndoManager.startGroup() before.
         *
         * @deprecated
         *  Use method UndoManager.enterGroup() instead.
         */
        this.endGroup = function () {
            if (groupLevel > 0) {
                endActionGroup();
            } else {
                Utils.error('UndoManager.endGroup(): not in undo group!');
            }
        };

        /**
         * Opens an undo action group and executes the specified callback
         * function. All undo operations added by the callback function will be
         * collected in the action group and act like a single undo action.
         * Nested calls are supported.
         *
         * @param {Function} callback
         *  The callback function that will be executed while the undo action
         *  group is open.
         *
         * @param {Object} [context]
         *  The context the callback function will be bound to.
         */
        this.enterGroup = function (callback, context) {
            startActionGroup();
            try {
                callback.call(context);
            } finally {
                endActionGroup();
            }
        };

        /**
         * Creates a new undo action that will apply the passed undo and redo
         * operations in the editor.
         *
         * @constructor
         *
         * @param {Object|Object[]} [undoOperations]
         *  One ore more operations that form a logical undo action. When the
         *  undo action is executed, the operations will be applied in the
         *  exact order as passed in this parameter; they will NOT be applied
         *  in reversed order as would be the case if the operations had been
         *  added in multiple undo actions. The parameter may be a single
         *  operation object, an array of operation objects, or omitted.
         *
         * @param {Object|Object[]} [redoOperations]
         *  One ore more operations that form a logical redo action. When the
         *  redo action is executed, the operations will be applied in the
         *  exact order as passed in this parameter. The parameter may be a
         *  single operation object, an array of operation objects, or omitted.
         */
        this.addUndo = function (undoOperations, redoOperations) {

            if (!this.isEnabled()) { return; }

            var // the new action object
                action = new Action(undoOperations, redoOperations);

            if (groupedActions) {
                // action grouping is active
                pushAction(groupedActions, action);
            } else {
                // top-level action
                if (currentAction < actions.length) {
                    // remove undone actions, do not try to merge with last existing action
                    actions.splice(currentAction);
                    actions.push(action);
                } else {
                    pushAction(actions, action);
                }
                currentAction = actions.length;
            }
        };

        /**
         * Returns the number of undo actions available on the undo stack.
         */
        this.undoAvailable = function () {
            return currentAction;
        };

        /**
         * Executes the specified number of undo actions.
         *
         * @param {Number} [count=1]
         *  The number of undo actions to be executed.
         */
        this.undo = function (count) {
            processing = true;
            try {
                count = _.isNumber(count) ? count : 1;
                while ((currentAction > 0) && (count > 0)) {
                    currentAction -= 1;
                    actions[currentAction].undo(editor);
                    count -= 1;
                }
            } finally {
                processing = false;
            }
        };

        /**
         * Returns the number of redo actions available on the redo stack.
         */
        this.redoAvailable = function () {
            return actions.length - currentAction;
        };

        /**
         * Executes the specified number of redo actions.
         *
         * @param {Number} [count=1]
         *  The number of redo actions to be executed.
         */
        this.redo = function (count) {
            processing = true;
            try {
                count = _.isNumber(count) ? count : 1;
                while ((currentAction < actions.length) && (count > 0)) {
                    actions[currentAction].redo(editor);
                    currentAction += 1;
                    count -= 1;
                }
            } finally {
                processing = false;
            }
        };

    } // class UndoManager

   // exports =================================================================

    return UndoManager;

});
