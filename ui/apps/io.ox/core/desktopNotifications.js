/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2014 Open-Xchange Inc., Tarrytown, NY, USA. info@open-xchange.com
 *
 * @author Daniel Dickhaus <daniel.dickhaus@open-xchange.com>
 */

define('io.ox/core/desktopNotifications', [
    'settings!io.ox/core'
], function (settings) {
    //see http://www.w3.org/TR/notifications for information

    'use strict';

    var desktopNotifications,
        supported = !!Notification,
        //variables used by visibility api
        isHidden = true,
        hiddenAttribute, visibilityChangeEvent;

    //try to find the visibility api attributes
    //using some code modified code snippets from https://developer.mozilla.org/en-US/docs/Web/Guide/User_experience/Using_the_Page_Visibility_API
    if (typeof document.hidden !== 'undefined') {
        hiddenAttribute = 'hidden';
        visibilityChangeEvent = 'visibilitychange';
    } else if (typeof document.mozHidden !== 'undefined') {
        hiddenAttribute = 'mozHidden';
        visibilityChangeEvent = 'mozvisibilitychange';
    } else if (typeof document.msHidden !== 'undefined') {
        hiddenAttribute = 'msHidden';
        visibilityChangeEvent = 'msvisibilitychange';
    } else if (typeof document.webkitHidden !== 'undefined') {
        hiddenAttribute = 'webkitHidden';
        visibilityChangeEvent = 'webkitvisibilitychange';
    }

    if (typeof document[hiddenAttribute] !== 'undefined') {
        isHidden = document[hiddenAttribute] ? true : false;
        $(document).on(visibilityChangeEvent, function handleVisibilityChange() {
            isHidden = document[hiddenAttribute] ? true : false;
        });
    }

    //actually draws the message
    function draw(message) {
        //only show if page is hidden (minimized etc)
        //no need to show them otherwise
        //if visibility api is not supported, we always show desktop notifications because we cannot be sure
        if (!isHidden && !message.ignoreVisibility) {
            return;
        }
        //defaults
        message = _.extend({
            title: '',
            body: '',
            duration: '4000'
        }, message);

        var title = message.title,
            duration = message.duration,
            notification,
            //yes the web notification standard events are not in camel case
            onclose = message.onclose, onshow = message.onshow, onclick = message.onclick, onerror = message.onerror;
        message = _(message).omit('title duration ignoreVisibility onclick onclose onshow onerror');

        notification = new Notification(title, message);
        //assign events
        if ( onclose ) { notification.onclose = onclose; }
        if ( onshow ) { notification.onshow = onshow; }
        if ( onclick ) { notification.onclick = onclick; }
        if ( onerror ) { notification.onerror = onerror; }

        if (duration) {
            //firefox closes notifications automatically after 4s so there is no need to do this manually then
            //see https://bugzilla.mozilla.org/show_bug.cgi?id=875114
            if (!(_.device('firefox') && duration >= 4000)) {
                //use timeout on show to start timeout when the notification is actually shown (might be in waiting queue)
                notification.onshow = function () {
                    setTimeout(function () {
                        $(notification).trigger('close');
                    }, duration);
                    //call given onshow if there is one
                    if (onshow) {
                        onshow.call(arguments, this);
                    }
                };
            }
        }
    }

    desktopNotifications = {
        //possible results are 'default', 'granted', 'denied', 'unsupported'
        getPermissionStatus: function () {
            return supported ? Notification.permission : 'unsupported';
        },

        //returns true if the browser supports W3C desktop notifications (all major browsers do except Internet Explorer)
        isSupported: function () {
            return supported;
        },

        //used to require permission to show desktop notifications
        //just for convenience since the show function asks automatically if desktop notifications are supported
        requestPermission: function (callback) {
            if (supported) {
                Notification.requestPermission(callback);
            }
        },

        /*shows desktop notifications if supported
        automatically asks for permission
        supports 4 types of parameter configurations for maximum compatibility:

        messageObject e.g. {title: 'abc', body: 'hey', icon: ...}
        title, options e.g. 'abc', {body: 'hey', icon: ...} (standard w3c parameter list)
        title, body e.g. 'abc', 'hey'
        title e.g. 'abc' */
        show: function (message) {
            //if desktop notifications aren't supported or not wanted stop here
            if (!message || !supported || !settings.get('showDesktopNotifications', true)) {
                return;
            }

            //check parameter configurations
            if (arguments.length === 2) {
                if (_.isString(arguments[0]) && _.isString(arguments[1])) {
                    //title, body
                    message = { title: message, body: arguments[1] };
                } else {
                    //title, options
                    arguments[1].title = message;
                    message = arguments[1];
                }
            } else if (_.isString(message)) {
                //only title is given
                message = { title: message };
            }

            //get current permission status
            //only save locally because a user might have changed it in the meantime
            var permission = this.getPermissionStatus();

            if (permission === 'granted') {
                draw(message);
            } else if (permission === 'default') {
                //default means we haven't asked yet
                this.requestPermission(function (result) {
                    if (result === 'granted') {
                        draw(message);
                    }
                });
            }
        }
    };

    return desktopNotifications;
});
