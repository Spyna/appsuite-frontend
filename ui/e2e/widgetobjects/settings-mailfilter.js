
const { I } = inject();

module.exports = {

    locators: {
        tree: locate({ css: '.io-ox-settings-window .leftside .tree-container' }).as('Tree'),
        main: locate({ css: '.io-ox-settings-window .rightside' }).as('Main content'),
        dialog: locate({ css: '.modal[data-point="io.ox/settings/mailfilter/filter/settings/detail/dialog"]' }).as('Create/Edit dialog'),
        lastaction: locate({ css: '.io-ox-mailfilter-edit .actions > li:last-of-type' }).as('Last action')
    },

    waitForApp() {
        I.waitForText('Filter Rules', 5, this.locators.tree);
        I.click('Filter Rules', this.locators.tree);
        I.waitForElement(this.locators.main.find('h1').withText('Mail Filter Rules'));
    },

    newRule(name) {
        I.click('Add new rule');
        I.waitForVisible(this.locators.dialog);
        I.see('Create new rule');
        I.see('This rule applies to all messages. Please add a condition to restrict this rule to specific messages.');
        I.see('Please define at least one action.');
        // set rulename
        I.fillField('rulename', name);
    },

    addCondition(condition, value) {
        I.click('Add condition');
        I.click(condition);
        I.fillField('values', value);
    },

    addSubjectCondition(value) {
        I.click('Add condition');
        I.click('Subject');
        I.fillField('values', value);
    },

    addSimpleAction(label) {
        I.click('Add action');
        I.click(label);
    },

    addAction(label, value) {
        I.click('Add action');
        I.click(label);
        I.fillField(this.locators.lastaction.find('input[name]'), value);
    },

    setFlag(flag) {
        I.click('Add action');
        I.click('Set color flag');
        I.click('~Set color');

        I.waitForVisible('.flag-dropdown');
        I.click(flag, '.flag-dropdown');
    },

    save() {
        I.click('Save');
        I.waitForDetached(this.locators.dialog);
        I.waitForVisible('.settings-detail-pane li.settings-list-item[data-id="0"]');
    }

};
