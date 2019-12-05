/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 * © 2019 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Daniel Pondruff <daniel.pondruff@open-xchange.com>
 */

/// <reference path="../../../steps.d.ts" />

Feature('Tasks > Delete');

Before(async (users) => {
    await Promise.all([
        users.create(),
        users.create(),
        users.create()
    ]);
});
After(async (users) => {
    await users.removeAll();
});

Scenario('[C7753] Delete single Task', async function (I, users, tasks) {
    const testrailID = 'C7753';
    const testrailName = 'Delete single Task';

    await I.haveTask({
        title: testrailID,
        status: '1',
        percent_completed: '0',
        folder_id: await I.grabDefaultFolder('tasks', { user: users[0] }),
        recurrence_type: '0',
        full_time: true,
        private_flag: false,
        timezone: 'Europe/Berlin',
        notification: true,
        note: testrailName
    });

    I.login('app=io.ox/tasks');
    tasks.waitForApp();
    I.waitForText(testrailID, 5, '.window-body');
    I.waitForText(testrailID, 5, '.tasks-detailview .title');
    I.clickToolbar('Delete');
    I.waitForElement('.modal-body', 5);
    I.waitForText('Do you really want to delete this task?');
    I.click('Delete', '.modal-footer');
    I.waitForDetached('.modal-body', 5);
    I.waitForText('No elements selected');
    I.waitForText('Empty', 5, '.vgrid');
});

Scenario('[C7754] Delete several Task at the same time', async function (I, users, tasks) {
    const testrailID = 'C7754',
        testrailName = 'Delete several Task at the same time',
        taskDefaultFolder = await I.grabDefaultFolder('tasks', { user: users[0] }),
        numberOfTasks = 3;

    for (let i = 1; i <= numberOfTasks; i++) {
        I.haveTask({ title: `${testrailID} - ${i}`, folder_id: taskDefaultFolder, note: testrailName });
    }

    I.login('app=io.ox/tasks');
    tasks.waitForApp();
    I.waitForElement('.tasks-detailview', 5);
    I.clickToolbar('.btn[title="Select all"]');
    I.seeNumberOfElements('li.selected.vgrid-cell', numberOfTasks);
    I.waitForText(numberOfTasks + ' items selected', 5, '.task-detail-container');
    I.clickToolbar('Delete');
    I.waitForElement('.modal-body');
    I.waitForText('Do you really want to delete these tasks?');
    I.click('Delete', '.modal-footer');
    I.waitForDetached('.modal-body');
    I.waitForText('No elements selected');
    I.waitForText('Empty', 5, '.vgrid');
});

Scenario('[C7755] Delete recurring Task', async function (I, tasks) {
    const testrailID = 'C7755',
        testrailName = 'Delete recurring Task';

    await I.haveTask({
        title: testrailID,
        note: testrailName,
        status: '1',
        percent_completed: '0',
        folder_id: await I.grabDefaultFolder('tasks'),
        recurrence_type: 2,
        full_time: true,
        private_flag: false,
        timezone: 'Europe/Berlin',
        notification: true,
        start_time: 1551657600000,
        end_time: 1551744000000,
        interval: 1,
        days: 2
    });

    I.login('app=io.ox/tasks');
    tasks.waitForApp();
    I.clickToolbar('Delete');
    I.waitForElement('.modal-body');
    I.waitForText('Do you really want to delete this task?');
    I.click('Delete', '.modal-footer');
    I.waitForDetached('.modal-body');
    I.waitForText('No elements selected');
    I.waitForText('Empty', 5, '.vgrid');
});
