/**
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2011
 * Mail: info@open-xchange.com
 *
 * @author Francisco Laguna <francisco.laguna@open-xchange.com>
 */

define.async('io.ox/realtime/rt', ['io.ox/core/extensions', "io.ox/core/event", "io.ox/core/capabilities", "io.ox/core/uuids", "io.ox/core/http", "io.ox/realtime/atmosphere"], function (ext, Event, caps, uuids, http) {
    'use strict';

    if (!caps.has("rt")) {
        console.error("Backend doesn't support realtime communication!");
        var dummy = {
            send: $.noop
        };
        Event.extend(dummy);
        return $.Deferred().resolve(dummy);
    }

    var tabId = uuids.randomUUID();
    var connecting = false;
    var shouldReconnect = false;
    var disconnected = true;
    var tentativeConnect = false;
    var online = true;
    var socket = $.atmosphere;
    var splits = document.location.toString().split('/');
    var proto = splits[0];
    var host = splits[2];
    var url = proto + "//" + host + (_.url.hash("realtimePath") || "/realtime") + "/atmosphere/rt";
    var api = {};
    var def = $.Deferred();
    var BUFFERING = true;
    var BUFFER_INTERVAL = 1000;
    var INFINITY = 4;
    var seq = 0;
    var request = null;
    var resendBuffer = {};
    var resendDeferreds = {};
    var serverSequenceThreshhold = 0;
    var initialReset = true;
    var silenceCount = 0;
    var loadDetectionTimer = null;
    var highLoad = false;
    var closeCount = 0;
    var ackBuffer = {};
    var rejectAll = false;
    var transmitting = false;

    Event.extend(api);


    function matches(json, namespace, element) {
        return json.namespace === namespace && json.element === element;
    }

    function get(json, namespace, element) {
        var i;
        if (matches(json, namespace, element)) {
            return new RealtimePayload(json);
        } else {
            if (json.payloads || json.data) {
                var payloads = json.payloads || json.data;
                for (i = 0; i < payloads.length; i++) {
                    var payload = get(payloads[i], namespace, element);
                    if (payload !== null) {
                        return payload;
                    }
                }
            }
            return null;
        }
    }

    function getAll(collector, json, namespace, element) {
        if (matches(json, namespace, element)) {
            collector.push(new RealtimePayload(json));
        }
        _(json.payloads || json.data || []).each(function (p) {
            getAll(collector, p, namespace, element);
        });
    }

    function RealtimePayload(json) {
        this.element = json.element;
        this.namespace = json.namespace;
        this.data = json.data;
        this.payloads = json.payloads || [];

        this.get = function (namespace, element) {
            return get(json, namespace, element);
        };

        this.getAll = function (namespace, element) {
            var collector = [];
            getAll(collector, json, namespace, element);
            return collector;
        };

    }

    function RealtimeStanza(json) {
        this.selector = json.selector;
        this.to = json.to;
        this.from = json.from;
        this.type = json.type;
        this.element = json.element;
        this.payloads = json.payloads || [];
        this.tracer = json.tracer;
        this.seq = _.isNull(json.seq) ? -1 : Number(json.seq);
        if (_.isNaN(this.seq)) {
            this.seq = -1;
        }
        this.tracer = json.tracer;
        this.log = json.log;

        this.get = function (namespace, element) {
            return get(json, namespace, element);
        };

        this.getAll = function (namespace, element) {
            var collector = [];
            getAll(collector, json, namespace, element);
            return collector;
        };
    }

    function receivedAcknowledgement(sequenceNumber) {
        delete resendBuffer[sequenceNumber];
        if (resendDeferreds[sequenceNumber]) {
            resendDeferreds[sequenceNumber].resolve();
        } else {
        }
        if (api.debug) {
            console.log("Received receipt for " + sequenceNumber);
        }
        delete resendDeferreds[sequenceNumber];
    }

    function flushAllBuffers() {
        resendBuffer = {};
        _(resendDeferreds).chain().values().each(function (def) {
            def.reject();
        });
        resendDeferreds = {};
        queue.stanzas = [];
        queue.timer = false;
        rejectAll = true;
    }

    function resetSequence(newSequence) {
        flushAllBuffers();
        http.PUT({
            module: 'rt',
            params: {
                action: 'send',
                resource: tabId
            },
            data: {type: 'nextSequence', seq: newSequence}
        }).done(function () {
            rejectAll = false;
            resendBuffer = {};
            _(resendDeferreds).chain().values().each(function (def) {
                def.reject();
            });
            resendDeferreds = {};
            queue.stanzas = [];
            queue.timer = false;
            if (api.debug) {
                console.log("Got reset command, nextSequence is ", seq);
            }
            seq = newSequence;
            serverSequenceThreshhold = -1;
            api.trigger("reset");
        });

    }

    function received(stanza) {
        if (api.debug) {
            console.log("Received  Stanza");
        }
        if (stanza.get("", "error")) {
            if (api.debug) {
                console.log("Received Stanza contained an error");
            }
            var error = stanza.get("", "error");
            if (error.data && error.data.code === 1005) {
                ox.trigger('relogin:required');
            } else if (error.data && error.data.code === 1006) {
                resetSequence(-1);
            }
        } else if (stanza.get("atmosphere", "received")) {
            _(stanza.getAll("atmosphere", "received")).each(function (receipt) {
                var sequenceNumber = Number(receipt.data);
                receivedAcknowledgement(sequenceNumber);
            });
        } else if (stanza.get("atmosphere", "pong")) {
            _(stanza.getAll("atmosphere", "pong")).each(function (pong) {
                // Discard
            });
        } else if (stanza.get("atmosphere", "nextSequence")) {
            if (!initialReset) {
                resetSequence(stanza.get("atmosphere", "nextSequence").data);
            } else {
                initialReset = false;
            }
        } else {
            if (stanza.seq > -1) {
                if (api.debug) {
                    console.log("Enqueueing receipt " + stanza.seq);
                }
                ackBuffer[Number(stanza.seq)] = 1;
            }
            if (serverSequenceThreshhold === -1 && stanza.seq > 0) {
                serverSequenceThreshhold = stanza.seq - 1;
            }
            if (api.debug) {
                console.log("SERVER THRESHHOLD: ", serverSequenceThreshhold, stanza.seq);
            }
            if (stanza.seq === -1 || stanza.seq > serverSequenceThreshhold || stanza.seq === 0) {
                var outOfOrder = false;
                if (stanza.seq > 0 && stanza.seq - serverSequenceThreshhold > 1) {
                    console.error("Received a sequence number that is too far out of order: Expected: " + serverSequenceThreshhold + 1 + ", but got: " + stanza.seq);
                    outOfOrder = true;
                }
                if (!outOfOrder) {
                    if (api.debug) {
                        console.log("RECEIVED", stanza.seq);
                    }
                    api.trigger("receive", stanza);
                    api.trigger("receive:" + stanza.selector, stanza);
                    if (stanza.seq !== -1) {
                        serverSequenceThreshhold = stanza.seq;
                    }
                } else {
                    resetSequence(0);
                }
            }
        }
    }


    function connect() {
        if (connecting) {
            return;
        }
        connecting = true;

        request = {
            url: url + '?session=' + ox.session + "&resource=" + tabId,
            contentType : "application/json",
            logLevel : 'shutUp',
            transport : 'long-polling',
            fallbackTransport: 'long-polling',
            timeout: 60000,
            messageDelimiter: null,
            maxRequest: 60
        };


        //------------------------------------------------------------------------------
        //request callbacks
        request.onOpen = function (response) {
            connecting = false;
            def.resolve(api);
            if (disconnected) {
                disconnected = false;
                tentativeConnect = true;
                if (subSocket) {
                    subSocket.push("{\"type\": \"ping\", \"commit\": true }");
                }
                api.trigger("open");
            }
        };

        var reconnectCount = 0;

        request.onReconnect = function (request, response) {
            reconnectCount++;
            if (reconnectCount > 30 && !disconnected) {
                reconnect();
            }
        };


        request.onMessage = function (response) {
            if (api.debug) {
                console.log("On message called: ", response);
            }

            silenceCount = 0;
            request.requestCount = 0;
            closeCount = 0;
            if (response.status !== 200 && response.status !== 408) { // 200 = OK, 408 == TIMEOUT, which is expected
                if (!disconnected) {
                    if (api.debug) {
                        console.log("Triggering offline, because request failed with status: ", response.status);
                    }
                    goOffline();
                    subSocket.close();
                }
                if (api.debug) {
                    console.log("Got an error status, discarding message", response.status);
                }
                return;
            }

            if (tentativeConnect) {
                if (api.debug) {
                    console.log("Triggering Online because #onMessage was called");
                }
                if (!online) {
                    api.trigger("online");
                    online = true;
                }
                tentativeConnect = false;
            }

            var message = response.responseBody;
            if (api.debug) {
                console.log("Message received", response.responseBody);
            }
            var json = {};
            try {
                json = $.parseJSON(message);
            } catch (e) {
                console.log(response);
                console.log('This doesn\'t look like valid JSON: ', message);
                console.error(e, e.stack, response);
                throw e;
            }
            if (_.isArray(json)) {
                _(json).each(function (stanza) {
                    if (api.debug) {
                        console.log("<-", stanza);
                    }
                    stanza = new RealtimeStanza(stanza);
                    received(stanza);
                });
            } else if (_.isObject(json)) { // json may be null
                if (api.debug) {
                    console.log("<-", json);
                }
                var stanza = new RealtimeStanza(json);
                received(stanza);
            }
            drainAckBuffer();
        };

        request.onClose = function (response) {
            if (api.debug) {
                console.log("Closed");
            }
            if (shouldReconnect) {
                shouldReconnect = false;
                subSocket = connect();
            } else {
                if (closeCount > 5) {
                    goOffline();
                }
                closeCount++;
            }
        };

        request.onError = function (response) {
            if (!disconnected) {
                disconnected = true;
                reconnect();
            }
        };

        return socket.subscribe(request);
    }

    function goOffline() {
        // test connection with a ping
        http.GET({module: 'system', params: {action: 'ping'}});
    }

    http.on("unreachable", function () {
        if (!disconnected) {
            disconnected = true;
            subSocket.close();
            socket.unsubscribe();
            if (online) {
                api.trigger("offline");
                online = false;
            }
        }
    });

    http.on("reachable", function () {
        if (!online && !connecting) {
            reconnect();
        }
    });

    ox.on("relogin:required", function () {
        if (api.debug) {
            console.log("Closing socket, because I got a session expired error");
        }
        flushAllBuffers();
        transmitting = false;
        subSocket.close();
        socket.unsubscribe();
        disconnected = true;
    });

    ox.on('relogin:success', function () {
        connect();
        resetSequence(0);
    });

    function reconnect() {
        if (connecting) {
            return;
        }
        shouldReconnect = true;
        disconnected = true;
        if (api.debug) {
            console.log("Closing for reconnect");
        }
        subSocket.close();
    }

    var subSocket = connect();

    disconnected = false;
    ox.on("change:session", function () {
        subSocket = connect();
    });

    var queue = {
        stanzas: [],
        timer: null
    };

    var reconnectBuffer = [];

    function drainAckBuffer() {
        if (_(ackBuffer).isEmpty()) {
            return;
        }
        var start, stop;

        start = stop = -1;
        var seqExpression = [];

        function addToSeqExpression(start, stop) {
            if (start === stop) {
                seqExpression.push(start);
            } else {
                seqExpression.push([start, stop]);
            }
        }

        _(_(ackBuffer).keys().sort()).each(function (seq) {
            if (start === -1) {
                start = stop = seq;
            } else if (seq === stop + 1) {
                stop = seq;
            } else {
                addToSeqExpression(start, stop);
                start = stop = seq;
            }
        });

        addToSeqExpression(start, stop);
        http.PUT({
            module: 'rt',
            params: {
                action: 'send',
                resource: tabId
            },
            data: {type: 'ack', seq: seqExpression}
        });
        ackBuffer = {};

    }

    function drainBuffer() {
        if (api.debug) {
            console.log("Drain buffer");
        }
        if (transmitting) {
            // Purge sequenced, but leave unsequenced
            queue.stanzas = _(queue.stanzas).reject(function (s) { return !_.isUndefined(s.seq); });
            if (api.debug) {
                console.log("Transmitting, so waiting for opportunity to send later");
            }
            return;
        }
        transmitting = true;
        request.requestCount = 0;
        // Send queue.stanzas
        if (api.debug) {
            console.log("SENDING", queue.stanzas);
        }
        http.PUT({
            module: 'rt',
            params: {
                action: 'send',
                resource: tabId
            },
            data: queue.stanzas,
            noRetry: true
        }).done(function (resp) {
            transmitting = false;
            if (resp.acknowledgements) {
                _(resp.acknowledgements).each(function (sequenceNumber) {
                    receivedAcknowledgement(sequenceNumber);
                });
            }
        }).fail(function (resp) {
            transmitting = false;
            if (resp.code === "RT_STANZA-1006") {
                resetSequence(0);
            }
        });

        if (api.debug) {
            console.log("->", queue.stanzas);
        }

        queue.timer = false;
        queue.stanzas = [];
        if (api.interrupt) {
            alert("INTERRUPT!");
            api.interrupt = false;
        }
    }

    api.internal = {
        setSequence: function (newSequence) {
            seq = newSequence;
        }
    };

    api.query = function (options) {
        if (options.trace) {
            delete options.trace;
            options.tracer = uuids.randomUUID();
        }
        options.seq = seq;
        seq++;
        return http.PUT({
            module: 'rt',
            params: {
                action: 'query',
                resource: tabId
            },
            data: options
        }).done(function (responseStanza) {
            var stanza = new RealtimeStanza(responseStanza);
            if (stanza.get("", "error")) {
                if (api.debug) {
                    console.log("Received Stanza contained an error");
                }
                var error = stanza.get("", "error");
                if (error.data && error.data.code === 6) {
                    resetSequence(0);
                }
            }
            return stanza;
        }).fail(function (resp) {
            if (resp.code === "RT_STANZA-1006" || resp.code === 'RT_STANZA-0006') {
                resetSequence(0);
            }
        });
    };

    api.send = function (options) {
        if (api.debug) {
            console.log("Send", options);
        }
        options.seq = seq;
        seq++;
        return api.sendWithoutSequence(options);
    };

    api.sendWithoutSequence = function (options) {
        var def = $.Deferred(),
            bufferinterval = (_.isNumber(options.bufferinterval)) ? options.bufferinterval : BUFFER_INTERVAL;
        if (rejectAll) {
            if (api.debug) {
                console.log("Not connected, so rejecting all");
            }
            return def.reject();
        }
        if (options.trace) {
            delete options.trace;
            options.tracer = uuids.randomUUID();
        }
        if (_.isNumber(options.bufferinterval)) {
            delete options.bufferinterval;  // Do not send bufferinterval to server
        }
        if (_.isUndefined(options.seq)) {
            def.resolve(); // Pretend a message without sequence numbers always arrives
        } else {
            if (api.debug) {
                console.log("Enqueuing in resendBuffer", options.seq);
            }
            resendBuffer[Number(options.seq)] = {count: 0, msg: options};
            if (resendDeferreds[Number(options.seq)]) {
                def = resendDeferreds[Number(options.seq)];
            } else {
                resendDeferreds[Number(options.seq)] = def;
            }
        }
        if (disconnected) {
            if (api.debug) {
                console.log("Disconnected, so reconnecting and adding message to reconnect buffer");
            }
            subSocket = connect();
            reconnectBuffer.push(options);
            return def;
        }
        if (connecting) {
            if (api.debug) {
                console.log("Connecting, so adding message to reconnect buffer");
            }
            // Buffer messages until connect went through
            reconnectBuffer.push(options);
            return def;
        }
        if (BUFFERING) {
            if (api.debug) {
                console.log("Adding to sender queue", queue);
            }
            queue.stanzas.push(JSON.parse(JSON.stringify(options)));
            if (!queue.timer) {
                queue.timer = true;
                setTimeout(drainBuffer, bufferinterval);
            }
        } else {
            request.requestCount = 0;
            subSocket.push(JSON.stringify(options));
            if (api.debug) {
                console.log("->", options);
            }
        }
        return def;
    };

    api.on("open", function () {
        _(reconnectBuffer).each(function (options) {
            api.sendWithoutSequence(options);
        });
        reconnectBuffer = [];
    });

    api.inspectStatus = function () {
        console.log("Resend Buffer", resendBuffer);
        console.log("Resend Deferreds", resendDeferreds);
        console.log("Connecting", connecting);
        console.log("Disconnected", disconnected);
        console.log("silenceCount", silenceCount);
    };

    api.resource = tabId;

    setInterval(function () {
        if (!connecting) {
            if (!disconnected) {
                subSocket.push("{\"type\": \"ping\", \"commit\": true }");
            }
        }
    }, 30000);

    setInterval(function () {
        if (silenceCount < 7 && !disconnected) {
            if (highLoad) {
                highLoad = false;
                api.trigger("normalLoad");
            }
            _(resendBuffer).each(function (m) {
                m.count++;
                if (m.count < INFINITY) {
                    api.sendWithoutSequence(m.msg);
                } else {
                    delete resendBuffer[Number(m.msg.seq)];
                    resendDeferreds[Number(m.msg.seq)].reject();
                    delete resendDeferreds[Number(m.msg.seq)];
                }
            });
        }
        if (silenceCount === 10 && !disconnected) {
            api.trigger("highLoad");
            console.warn("High Load detected");
        }
        if (silenceCount === 12) {
            silenceCount = 0;
            reconnect();
        }
        silenceCount++;
        if (loadDetectionTimer && (new Date().getTime() - loadDetectionTimer > 15000)) {
            api.trigger("highLoad");
            console.warn("High Load detected");
        }
        loadDetectionTimer = new Date().getTime();

    }, 5000);

    return def;
});
