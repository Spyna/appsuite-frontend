/**
 *
 * All content on this website (including text, images, source
 * code and any other original works), unless otherwise noted,
 * is licensed under a Creative Commons License.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * Copyright (C) Open-Xchange Inc., 2006-2011
 * Mail: info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 *
 */

define("io.ox/core/http", ["io.ox/core/event"], function (Events) {

    "use strict";

    // default columns for each module
    var idMapping = {
        "common" : {
            "1" : "id",
            "2" : "created_by",
            "3" : "modified_by",
            "4" : "creation_date",
            "5" : "last_modified",
            "20" : "folder_id",
            "100" : "categories",
            "101" : "private_flag",
            "102" : "color_label",
            "104" : "number_of_attachments"
        },
        "mail" : {
            "102" : "color_label",
            "600" : "id",
            "601" : "folder_id",
            "602" : "attachment",
            "603" : "from",
            "604" : "to",
            "605" : "cc",
            "606" : "bcc",
            "607" : "subject",
            "608" : "size",
            "609" : "sent_date",
            "610" : "received_date",
            "611" : "flags",
            "612" : "level",
            "613" : "disp_notification_to",
            "614" : "priority",
            "615" : "msgref",
            "651" : "flag_seen",
            "652" : "account_name"
        },
        "contacts" : {
            "500" : "display_name",
            "501" : "first_name",
            "502" : "last_name",
            "503" : "second_name",
            "504" : "suffix",
            "505" : "title",
            "506" : "street_home",
            "507" : "postal_code_home",
            "508" : "city_home",
            "509" : "state_home",
            "510" : "country_home",
            "511" : "birthday",
            "512" : "marital_status",
            "513" : "number_of_children",
            "514" : "profession",
            "515" : "nickname",
            "516" : "spouse_name",
            "517" : "anniversary",
            "518" : "note",
            "519" : "department",
            "520" : "position",
            "521" : "employee_type",
            "522" : "room_number",
            "523" : "street_business",
            "525" : "postal_code_business",
            "526" : "city_business",
            "527" : "state_business",
            "528" : "country_business",
            "529" : "number_of_employees",
            "530" : "sales_volume",
            "531" : "tax_id",
            "532" : "commercial_register",
            "533" : "branches",
            "534" : "business_category",
            "535" : "info",
            "536" : "manager_name",
            "537" : "assistant_name",
            "538" : "street_other",
            "539" : "city_other",
            "540" : "postal_code_other",
            "541" : "country_other",
            "542" : "telephone_business1",
            "543" : "telephone_business2",
            "544" : "fax_business",
            "545" : "telephone_callback",
            "546" : "telephone_car",
            "547" : "telephone_company",
            "548" : "telephone_home1",
            "549" : "telephone_home2",
            "550" : "fax_home",
            "551" : "cellular_telephone1",
            "552" : "cellular_telephone2",
            "553" : "telephone_other",
            "554" : "fax_other",
            "555" : "email1",
            "556" : "email2",
            "557" : "email3",
            "558" : "url",
            "559" : "telephone_isdn",
            "560" : "telephone_pager",
            "561" : "telephone_primary",
            "562" : "telephone_radio",
            "563" : "telephone_telex",
            "564" : "telephone_ttytdd",
            "565" : "instant_messenger1",
            "566" : "instant_messenger2",
            "567" : "telephone_ip",
            "568" : "telephone_assistant",
            "569" : "company",
            //"570" : "image1",
            "571" : "userfield01",
            "572" : "userfield02",
            "573" : "userfield03",
            "574" : "userfield04",
            "575" : "userfield05",
            "576" : "userfield06",
            "577" : "userfield07",
            "578" : "userfield08",
            "579" : "userfield09",
            "580" : "userfield10",
            "581" : "userfield11",
            "582" : "userfield12",
            "583" : "userfield13",
            "584" : "userfield14",
            "585" : "userfield15",
            "586" : "userfield16",
            "587" : "userfield17",
            "588" : "userfield18",
            "589" : "userfield19",
            "590" : "userfield20",
            "592" : "distribution_list",
            "594" : "number_of_distribution_list",
            "596" : "contains_image1",
            "597" : "image_last_modified",
            "598" : "state_other",
            "599" : "file_as",
            "104" : "number_of_attachments",
            "601" : "image1_content_type",
            "602" : "mark_as_distributionlist",
            "605" : "default_address",
            "524" : "internal_userid",
            "606" : "image1_url"
        },
        "calendar" : {
            "200" : "title",
            "201" : "start_date",
            "202" : "end_date",
            "203" : "note",
            "204" : "alarm",
            "206" : "recurrence_id",
            "207" : "recurrence_position",
            "208" : "recurrence_date_position",
            "209" : "recurrence_type",
            "210" : "change_exceptions",
            "211" : "delete_exceptions",
            "212" : "days",
            "213" : "day_in_month",
            "214" : "month",
            "215" : "interval",
            "216" : "until",
            "217" : "notification",
            "220" : "participants",
            "221" : "users",
            "222" : "occurrences",
            "223" : "uid",
            "224" : "organizer",
            "225" : "sequence",
            "226" : "confirmations",
            "227" : "organizerId",
            "228" : "principal",
            "229" : "principalId",
            "400" : "location",
            "401" : "full_time",
            "402" : "shown_as",
            "408" : "timezone",
            "410" : "recurrence_start"
        },
        "infostore" : {
            "700" : "title",
            "701" : "url",
            "702" : "filename",
            "703" : "file_mimetype",
            "704" : "file_size",
            "705" : "version",
            "706" : "description",
            "707" : "locked_until",
            "708" : "file_md5sum",
            "709" : "version_comment",
            "710" : "current_version",
            "711" : "number_of_versions"
        },
        "tasks" : {
            "200" : "title",
            "201" : "start_date",
            "202" : "end_date",
            "203" : "note",
            "204" : "alarm",
            "209" : "recurrence_type",
            "212" : "days",
            "213" : "day_in_month",
            "214" : "month",
            "215" : "internal",
            "216" : "until",
            "220" : "participants",
            "221" : "users",
            "300" : "status",
            "301" : "percent_completed",
            "302" : "actual_costs",
            "303" : "actual_duration",
            "305" : "billing_information",
            "307" : "target_costs",
            "308" : "target_duration",
            "309" : "priority",
            "312" : "currency",
            "313" : "trip_meter",
            "314" : "companies",
            "315" : "date_completed"
        },
        "folders" : {
            "1" : "id",
            "2" : "created_by",
            "3" : "modified_by",
            "4" : "creation_date",
            "5" : "last_modified",
            "6" : "last_modified_utc",
            "20" : "folder_id",
            "300" : "title",
            "301" : "module",
            "302" : "type",
            "304" : "subfolders",
            "305" : "own_rights",
            "306" : "permissions",
            "307" : "summary",
            "308" : "standard_folder",
            "309" : "total",
            "310" : "new",
            "311" : "unread",
            "312" : "deleted",
            "313" : "capabilities",
            "314" : "subscribed",
            "315" : "subscr_subflds",
            "316" : "standard_folder_type",
            "3010" : "com.openexchange.publish.publicationFlag",
            "3020" : "com.openexchange.subscribe.subscriptionFlag",
            "3030" : "com.openexchange.folderstorage.displayName"
        },
        "user": {
            "610" : "aliases",
            "611" : "timezone",
            "612" : "locale",
            "613" : "groups",
            "614" : "contact_id",
            "615" : "login_info"
        },
        "group": {
        },
        "resource": {
        },
        "account": {
            "1001": "id",
            "1002": "login",
            "1003": "password",
            "1004": "mail_url",
            "1005": "transport_url",
            "1006": "name",
            "1007": "primary_address",
            "1008": "spam_handler",
            "1009": "trash",
            "1010": "sent",
            "1011": "drafts",
            "1012": "spam",
            "1013": "confirmed_spam",
            "1014": "confirmed_ham",
            "1015": "mail_server",
            "1016": "mail_port",
            "1017": "mail_protocol",
            "1018": "mail_secure",
            "1019": "transport_server",
            "1020": "transport_port",
            "1021": "transport_protocol",
            "1022": "transport_secure",
            "1023": "transport_login",
            "1024": "transport_passord",
            "1025": "unified_inbox_enabled",
            "1026": "trash_fullname",
            "1027": "sent_fullname",
            "1028": "drafts_fullname",
            "1029": "spam_fullname",
            "1030": "confirmed_spam_fullname",
            "1031": "confirmed_ham_fullname",
            "1032": "pop3_refresh_rate",
            "1033": "pop3_expunge_on_quit",
            "1034": "pop3_delete_write_through",
            "1035": "pop3_storage ",
            "1036": "pop3_path",
            "1037": "personal"
        }
    };

    // extend with commons (not all modules use common columns, e.g. folders)
    $.extend(idMapping.contacts, idMapping.common);
    $.extend(idMapping.calendar, idMapping.common);
    $.extend(idMapping.infostore, idMapping.common);
    delete idMapping.infostore["101"]; // not "common" here (exception)
    delete idMapping.infostore["104"];
    $.extend(idMapping.tasks, idMapping.common);
    $.extend(idMapping.user, idMapping.contacts, idMapping.common);

    var that = {};

    // get all columns of a module
    var getAllColumns = function (module, join) {
        // get ids
        var ids = idMapping[module] || {};
        // flatten this array
        var tmp = [], column = "";
        for (column in ids) {
            tmp.push(column);
        }
        tmp.sort(function (a, b) {
            return a - b;
        });
        return join === true ? tmp.join(",") : tmp;
    };

    // transform arrays to objects
    var makeObject = function (data, module, columns) {
        // primitive types may be mixed with column arrays
        // e. g. deleted objects from action=updates.
        if (typeof data !== "object") {
            return data;
        }
        // columns set?
        columns = columns !== undefined ? columns : getAllColumns(module);
        // get ids
        var ids = idMapping[module] || {};
        var obj = {}, i = 0, $l = data.length;
        // loop through data
        for (; i < $l; i++) {
            // get id
            var id = ids[columns[i]] || columns[i];
            // extend object
            obj[id] = data[i];
        }
        return obj;
    };

    var processOptions = function (options, type) {
        // defaults
        var o = $.extend({
                module: "",
                params: {},
                data: {},
                dataType: "json",
                appendColumns: type === "GET" || type === "UPLOAD" ? false : true,
                columnModule: options.module || "",
                appendSession: true,
                processData: true,
                processResponse: true,
                cursor: true
            }, options || {}),
            columns;
        // store type for retry
        o.type = type;
        // prepend root
        o.url = ox.apiRoot + "/" + o.module;
        // add session
        if (o.appendSession === true) {
            o.params.session = ox.session;
        }
        // add columns
        if (o.appendColumns === true && o.params.columns === undefined) {
            columns = getAllColumns(o.columnModule);
            if (columns.length) {
                o.params.columns = columns.join(",");
            }
        }
        // remove white space from columns (otherwise evil to debug)
        if (o.params.columns) {
            o.params.columns.replace(/\s/g, "");
        }
        // data & body
        if (type === "GET" || type === "POST") {
            // GET & POST
            o.data = o.params;
        }
        else if (type === "PUT" || type === "DELETE") {
            // PUT & DELETE
            o.url += "?" + _.serialize(o.params);
            o.original = o.data;
            o.data = typeof o.data !== "string" ? JSON.stringify(o.data) : o.data;
            o.contentType = "text/javascript; charset=UTF-8";
        }
        else if (type === "UPLOAD") {
            // POST with FormData object
            o.url += "?" + _.serialize(o.params);
            o.contentType = false;
            o.processData = false;
            o.processResponse = false;
        }
        // done
        return o;
    };

    var sanitize = function (data, module, columns) {
        // not array or no columns given?
        if (!_.isArray(data) || !columns) {
            // typically from "action=get" (already sanitized)
            return data;
        } else {
            // POST/PUT - sanitize data
            var i = 0, $l = data.length, sanitized = [], obj,
                columnList = columns.split(",");
            for (; i < $l; i++) {
                obj = data[i];
                sanitized.push(_.isArray(obj) ? makeObject(obj, module, columnList) : obj);
            }
            return sanitized;
        }
    };

    var processResponse = function (deferred, response, o) {
        // server error?
        if (response && response.error !== undefined && !response.data) {
            // session expired?
            var isSessionError = (/^SES\-/i).test(response.code),
                isAutoLogin = o.module === "login" && o.data && o.data.action === "autologin";
            if (isSessionError && !isAutoLogin) {
                // login dialog
                ox.session = "";
                ox.relogin(o, deferred);
            } else {
                deferred.reject(response);
            }
        } else {
            // handle warnings
            if (response && response.error !== undefined) {
                console.warn("TODO: warning");
            }
            // success
            if (o.dataType === "json" && o.processResponse === true) {
                // variables
                var data = [], timestamp;
                // response? (logout e.g. hasn't any)
                if (response) {
                    // multiple?
                    if (o.module === "multiple") {
                        var i = 0, $l = response.length, tmp;
                        for (; i < $l; i++) {
                            // time
                            timestamp = response[i].timestamp !== undefined ? response[i].timestamp : _.now();
                            // data/error
                            if (response[i].data !== undefined) {
                                // data
                                tmp = sanitize(response[i].data, o.data[i].columnModule, o.data[i].columns);
                                data.push({ data: tmp, timestamp: timestamp });
                                // handle warnings within multiple
                                if (response[i].error !== undefined) {
                                    console.warn("TODO: warning");
                                }
                            } else {
                                // error
                                data.push({ error: response[i], timestamp: timestamp });
                            }
                        }
                        deferred.resolve(data);
                    } else {
                        var columns = o.params.columns || (o.processResponse === true ? getAllColumns(o.columnModule, true) : '');
                        data = sanitize(response.data, o.columnModule, columns);
                        timestamp = response.timestamp !== undefined ? response.timestamp : _.now();
                        deferred.resolve(data, timestamp);
                    }
                } else {
                    deferred.resolve({}, _.now());
                }
            } else {
                // e.g. plain text
                deferred.resolve(response || "");
            }
        }
    };

    // internal queue
    var paused = false,
        queue = [],
        // slow mode
        slow = _.url.hash("slow"),
        // fail mode
        fail = _.url.hash("fail");

    var ajax = (function () {

        // helps joining identical requests
        var requests = {};

        function lowLevelSend(r) {
            // TODO: remove backend fix
            var fixPost = r.o.fixPost && r.xhr.type === 'POST',
                xhr = _.extend({}, r.xhr, { dataType: fixPost ? 'text' : r.xhr.dataType });
            $.ajax(xhr)
                // TODO: remove backend fix
                .pipe(function (response) {
                    if (fixPost) {
                        // Extract the JSON text
                        var matches = /\((\{.*?\})\)/.exec(response);
                        return matches && matches[1] ? JSON.parse(matches[1]) : JSON.parse(response);
                    } else {
                        return response;
                    }
                })
                .done(function (data) {
                    // trigger event first since HTTP layer finishes work
                    that.trigger("stop done", r.xhr);
                    // process response
                    if (r.o.processData) {
                        processResponse(r.def, data, r.o, r.o.type);
                    } else {
                        // error handling if JSON (e.g. for UPLOAD)
                        if (r.xhr.dataType === 'json' && data.error !== undefined) {
                            r.def.reject(data);
                        } else {
                            r.def.resolve(data);
                        }
                    }
                    r = null;
                })
                .fail(function (xhr, textStatus, errorThrown) {
                    that.trigger("stop fail", r.xhr);
                    r.def.reject({ error: xhr.status + " " + (errorThrown || "general") }, xhr);
                    r = null;
                });
        }

        function send(r) {

            var hash;

            // look for concurrent identical GET requests
            if (r.o.type === 'GET') {
                // get hash value - we just use stringify here
                hash = JSON.stringify(r.xhr);
                if (requests[hash] !== undefined) {
                    // enqueue callbacks
                    requests[hash]
                        .then(r.def.resolve, r.def.reject)
                        .then(
                            function () {
                                that.trigger("stop done", r.xhr);
                                r = null;
                            },
                            function () {
                                that.trigger("stop fail", r.xhr);
                                r  = null;
                            }
                        );
                    hash = null;
                } else {
                    // create new request
                    requests[hash] = r.def.always(function () {
                        delete requests[hash];
                        hash = null;
                    });
                    lowLevelSend(r);
                    r = null;
                }
            } else {
                lowLevelSend(r);
                r = null;
            }
        }

        return function (o, type) {
            // process options
            o = processOptions(o, type);
            // vars
            var r, def = $.Deferred();
            // paused?
            if (paused === true) {
                queue.push({ deferred: def, options: o });
                return def;
            }
            // build request object
            r = {
                def: def,
                o: o,
                xhr: {
                    // type (GET, POST, PUT, ...)
                    type: type === "UPLOAD" ? "POST" : type,
                    // url
                    url: o.url,
                    // data
                    data: o.data,
                    dataType: o.dataType,
                    processData: o.processData,
                    contentType: o.contentType !== undefined ? o.contentType : "application/x-www-form-urlencoded"
                }
            };
            // use timeout?
            if (typeof o.timeout === "number") {
                r.xhr.timeout = o.timeout;
            }
            // continuation
            function cont() {
                if (fail && o.module !== "login" && Math.random() < Number(fail)) {
                    // simulate broken connection
                    console.error("HTTP fail", r.o.url, r.xhr);
                    r.def.reject({ error: "0 simulated fail" });
                    that.trigger("stop fail", r.xhr);
                } else {
                    // go!
                    send(r);
                }
                r = o = null;
            }
            that.trigger("start", r.xhr);
            if (Number(slow)) {
                // simulate slow connection
                setTimeout(cont, 250 * Number(slow) + (Math.random() * 500 >> 0));
            } else {
                cont();
            }
            return def;
        };
    }());

    that = {

        /**
         * Send a GET request
         * @param {Object} options Request options
         * @param {string} options.module Module, e.g. folder, mail, calendar etc.
         * @param {Object} options.params URL parameters
         * @returns {Object} jQuery's Deferred
         * @example
         * http.GET({ module: "mail", params: { action: "all", folder: "default0/INBOX" }});
         */
        GET: function (options) {
            return ajax(options, "GET");
        },

        /**
         * Send a POST request
         * @param {Object} options Request options
         * @param {string} options.module Module, e.g. folder, mail, calendar etc.
         * @param {Object} options.params URL parameters
         * @returns {Object} jQuery's Deferred
         */
        POST: function (options) {
            return ajax(options, "POST");
        },

        /**
         * Send a PUT request
         * @param {Object} options Request options
         * @param {string} options.module Module, e.g. folder, mail, calendar etc.
         * @param {Object} options.params URL parameters
         * @returns {Object} jQuery's Deferred
         */
        PUT: function (options) {
            return ajax(options, "PUT");
        },

        /**
         * Send a DELETE request
         * @param {Object} options Request options
         * @param {string} options.module Module, e.g. folder, mail, calendar etc.
         * @param {Object} options.params URL parameters
         * @returns {Object} jQuery's Deferred
         */
        DELETE: function (options) {
            return ajax(options, "DELETE");
        },

        /**
         * Send a POST request using a FormData object
         * @param {Object} options Request options
         * @param {string} options.module Module, e.g. folder, mail, calendar etc.
         * @param {Object} options.params URL parameters
         * @returns {Object} jQuery's Deferred
         */
        UPLOAD: function (options) {
            return ajax(options, "UPLOAD");
        },

        /**
         * Get all columns of a module
         * @param {string} module Module name
         * @returns {Array} All columns
         */
        getAllColumns: getAllColumns,

        /**
         * Transform objects with array-based columns into key-value-based columns
         * @param {Array} data Data
         * @param {string} module Module name
         * @param {Array} columns Columns
         * @returns {Object} Transformed object
         */
        makeObject: makeObject,

        /**
         * Simplify objects in array for list requests
         */
        simplify: function (list) {
            var i = 0, item = null, tmp = new Array(list.length);
            for (; (item = list[i]); i++) {
                if (typeof item === 'object') {
                    tmp[i] = { id: item.id };
                    // look for folder(_id) - e.g. groups/users don't have one
                    if (item.folder || item.folder_id) {
                        tmp[i].folder = item.folder || item.folder_id;
                    }
                    // calendar support:
                    if (item.recurrence_position) {
                        tmp[i].recurrence_position = item.recurrence_position;
                    }
                } else {
                    // just integers for example
                    tmp[i] = item;
                }
            }
            return tmp;
        },

        /**
         * Fixes order of list requests (temp. fixes backend bug)
         */
        fixList: function (ids, deferred) {

            return deferred
                .pipe(function (data) {
                    // simplify
                    ids = that.simplify(ids);
                    // build hash (uses folder_id!)
                    var i, obj, hash = {}, tmp = new Array(data.length), key;
                    for (i = 0; (obj = data[i]); i++) {
                        key = String(obj.internal_userid ? obj.internal_userid : (obj.folder_id || 0) + "." + (obj.internal_userid || obj.id) + "." + (obj.recurrence_position || 0));
                        hash[key] = obj;
                    }
                    // fix order (uses folder!)
                    for (i = 0; (obj = ids[i]); i++) {
                        key = String(typeof obj === "object" ? (obj.folder || 0) + "." + (obj.internal_userid || obj.id) + "." + (obj.recurrence_position || 0) : obj);
                        tmp[i] = hash[key];
                    }
                    hash = obj = ids = null;
                    return tmp;
                });
        },

        /**
         * Retry request
         */
        retry: function (request) {
            // get type
            var type = (request.type || "GET").toUpperCase();
            return this[type](request);
        },

        /**
         * Collect requests
         */
        pause: function () {
            paused = true;
            this.trigger("paused");
        },

        /**
         * Resume HTTP API. Send all queued requests as one multiple
         */
        resume: function () {
            var def = $.Deferred(),
                q = queue.slice();
            if (paused === true) {
                // create multiple request
                var i = 0, $l = q.length, req, o, tmp = [];
                for (; i < $l; i++) {
                    // get request
                    req = q[i].options;
                    // remove session
                    delete req.params.session;
                    // build request
                    o = $.extend(req.params, { module: req.module, data: req.original });
                    // action?
                    if (req.params.action !== undefined) {
                        o.action = req.params.action;
                    }
                    // add
                    tmp.push(o);
                }
                // clear queue & remove "paused" flag
                queue = [];
                paused = false;
                this.trigger("resumed");
                // send PUT
                if (tmp.length > 0) {
                    this.PUT({
                        module: "multiple",
                        "continue": true,
                        data: tmp,
                        appendColumns: false
                    })
                    .done(function (data) {
                        // orchestrate callbacks and their data
                        for (i = 0, $l = q.length; i < $l; i++) {
                            q[i].deferred.resolve(data[i]);
                        }
                        // continuation
                        def.resolve(data);
                    })
                    .fail(def.reject);
                } else {
                    // continuation
                    def.resolve([]);
                }
            } else {
                def.resolve([]);
            }
            return def;
        }
    };

    Events.extend(that);

    return that;
});
