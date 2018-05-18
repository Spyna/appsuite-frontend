
type ICodeceptCallback = (i: CodeceptJS.I) => void;

declare const actor: () => CodeceptJS.I;
declare const Feature: (string: string) => void;
declare const Scenario: (string: string, callback: ICodeceptCallback) => void;
declare const Before: (callback: ICodeceptCallback) => void;
declare const BeforeSuite: (callback: ICodeceptCallback) => void;
declare const After: (callback: ICodeceptCallback) => void;
declare const AfterSuite: (callback: ICodeceptCallback) => void;
declare const within: (selector: string, callback: Function) => void;

declare namespace CodeceptJS {
  export interface I {
    defineTimeout: (defineTimeout(timeouts) => any; 
    amOnPage: (amOnPage) => any; 
    click: (click(locator, context=null) => any; 
    doubleClick: (doubleClick(locator, context=null) => any; 
    rightClick: (rightClick(locator) => any; 
    fillField: (fillField(field, value) => any; 
    appendField: (appendField(field, value) => any; 
    clearField: (clearField(field) => any; 
    selectOption: (async) => any; 
    attachFile: (attachFile(locator, pathToFile) => any; 
    checkOption: (checkOption(field, context=null) => any; 
    uncheckOption: (uncheckOption(field, context=null) => any; 
    grabTextFrom: (async) => any; 
    grabHTMLFrom: (async) => any; 
    grabValueFrom: (async) => any; 
    grabCssPropertyFrom: (async) => any; 
    grabAttributeFrom: (async) => any; 
    seeInTitle: (seeInTitle(text) => any; 
    seeTitleEquals: (seeTitleEquals(text) => any; 
    dontSeeInTitle: (dontSeeInTitle(text) => any; 
    grabTitle: (grabTitle() => any; 
    see: (see(text, context=null) => any; 
    seeTextEquals: (seeTextEquals(text, context=null) => any; 
    dontSee: (dontSee(text, context=null) => any; 
    seeInField: (seeInField(field, value) => any; 
    dontSeeInField: (dontSeeInField(field, value) => any; 
    seeCheckboxIsChecked: (seeCheckboxIsChecked(field) => any; 
    dontSeeCheckboxIsChecked: (dontSeeCheckboxIsChecked(field) => any; 
    seeElement: (async) => any; 
    dontSeeElement: (async) => any; 
    seeElementInDOM: (seeElementInDOM(locator) => any; 
    dontSeeElementInDOM: (dontSeeElementInDOM(locator) => any; 
    seeInSource: (seeInSource(text) => any; 
    grabSource: (grabSource() => any; 
    grabBrowserLogs: (async) => any; 
    grabCurrentUrl: (grabCurrentUrl() => any; 
    grabBrowserUrl: (grabBrowserUrl() => any; 
    dontSeeInSource: (dontSeeInSource(text) => any; 
    seeNumberOfElements: (seeNumberOfElements(selector, num) => any; 
    seeNumberOfVisibleElements: (seeNumberOfVisibleElements(locator, num) => any; 
    seeCssPropertiesOnElements: (async) => any; 
    seeAttributesOnElements: (async) => any; 
    grabNumberOfVisibleElements: (async) => any; 
    seeInCurrentUrl: (seeInCurrentUrl(url) => any; 
    dontSeeInCurrentUrl: (dontSeeInCurrentUrl(url) => any; 
    seeCurrentUrlEquals: (seeCurrentUrlEquals(url) => any; 
    dontSeeCurrentUrlEquals: (dontSeeCurrentUrlEquals(url) => any; 
    executeScript: (executeScript) => any; 
    executeAsyncScript: (executeAsyncScript) => any; 
    scrollTo: (scrollTo(locator, offsetX=0, offsetY=0) => any; 
    moveCursorTo: (moveCursorTo(locator, offsetX=0, offsetY=0) => any; 
    saveScreenshot: (async) => any; 
    setCookie: (setCookie(cookie) => any; 
    clearCookie: (clearCookie(cookie) => any; 
    seeCookie: (seeCookie(name) => any; 
    dontSeeCookie: (dontSeeCookie(name) => any; 
    grabCookie: (grabCookie(name) => any; 
    acceptPopup: (acceptPopup() => any; 
    cancelPopup: (cancelPopup() => any; 
    seeInPopup: (async) => any; 
    grabPopupText: (async) => any; 
    pressKey: (pressKey(key) => any; 
    resizeWindow: (async) => any; 
    dragAndDrop: (dragAndDrop(srcElement, destElement) => any; 
    closeOtherTabs: (async) => any; 
    wait: (wait(sec) => any; 
    waitForEnabled: (async) => any; 
    waitForElement: (async) => any; 
    waitUntilExists: (waitUntilExists(locator, sec=null) => any; 
    waitInUrl: (async) => any; 
    waitUrlEquals: (async) => any; 
    waitForText: (async) => any; 
    waitForValue: (async) => any; 
    waitForVisible: (async) => any; 
    waitNumberOfVisibleElements: (async) => any; 
    waitForInvisible: (async) => any; 
    waitToHide: (waitToHide(locator, sec=null) => any; 
    waitForStalenessOf: (waitForStalenessOf(locator, sec=null) => any; 
    waitForDetached: (async) => any; 
    waitUntil: (waitUntil(fn, sec=null, timeoutMsg=null) => any; 
    switchTo: (switchTo(locator) => any; 
    switchToNextTab: (switchToNextTab(num=1, sec=null) => any; 
    switchToPreviousTab: (switchToPreviousTab(num=1, sec=null) => any; 
    closeCurrentTab: (closeCurrentTab() => any; 
    openNewTab: (openNewTab() => any; 
    grabNumberOfOpenTabs: (grabNumberOfOpenTabs() => any; 
    refreshPage: (refreshPage() => any; 
    scrollPageToTop: () => any; 
    scrollPageToBottom: () => any; 
    runOnIOS: (caps, fn) => any; 
    runOnAndroid: (caps, fn) => any; 
    runInWeb: (fn) => any; 
    debug: (msg) => any; 
    debugSection: (section, msg) => any; 
    clickToolbar: (clickToolbar) => any; 
    selectFolder: (selectFolder) => any; 
    setSetting: (setSetting) => any; 
    waitForFocus: (waitForFocus) => any; 
    insertMailaddress: (selector, userIndex) => any; 
    login: (params, options) => any; 
    logout: () => any; 
    removeAllAppointments: (function) => any; 
    say: (msg) => any; 
    retry: (function) => any; 

  }
}

declare module "codeceptjs" {
    export = CodeceptJS;
}
