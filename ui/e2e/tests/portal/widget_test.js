/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2017 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Richard Petersen <richard.petersen@open-xchange.com>
 */
/// <reference path="../../steps.d.ts" />

const expect = require('chai').expect;

Feature('Portal widgets');

Scenario('add and remove Inbox widget', function* (I) {
    I.login('app=io.ox/portal');
    I.waitForElement('[data-app-name="io.ox/portal"] .header', 20);
    let [oldWidgetId] = yield I.grabAttributeFrom('.io-ox-portal-window .widgets li:first-child', 'data-widget-id');
    I.click('Add widget');
    I.click('Inbox', '.dropdown.open');
    I.click('Save', '.io-ox-dialog-popup');
    let [widgetId] = yield I.grabAttributeFrom('.io-ox-portal-window .widgets li:first-child', 'data-widget-id');
    expect(oldWidgetId).not.equal(widgetId);
    let title = yield I.grabTextFrom(`.io-ox-portal-window .widgets li[data-widget-id="${widgetId}"] .title`);
    expect(title).to.contain('Inbox');
    I.click(`.io-ox-portal-window .widgets li[data-widget-id="${widgetId}"] .disable-widget`);
    I.click('Delete', '.io-ox-dialog-popup');
    I.waitForDetached(`.io-ox-portal-window .widgets li[data-widget-id="${widgetId}"]`);
    I.logout();
});
