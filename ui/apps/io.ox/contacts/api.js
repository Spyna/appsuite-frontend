/**
 * This work is provided under the terms of the CREATIVE COMMONS PUBLIC
 * LICENSE. This work is protected by copyright and/or other applicable
 * law. Any use of the work other than as authorized under this license
 * or copyright law is prohibited.
 *
 * http://creativecommons.org/licenses/by-nc-sa/2.5/
 *
 * © 2016 OX Software GmbH, Germany. info@open-xchange.com
 *
 * @author Matthias Biggeleben <matthias.biggeleben@open-xchange.com>
 */

define('io.ox/contacts/api', [
    'io.ox/core/extensions',
    'io.ox/core/http',
    'io.ox/core/api/factory',
    'io.ox/core/notifications',
    'io.ox/core/cache',
    'io.ox/contacts/util',
    'io.ox/core/util',
    'l10n/ja_JP/io.ox/collation',
    'settings!io.ox/contacts',
    'io.ox/core/capabilities'
], function (ext, http, apiFactory, notifications, cache, util, coreUtil, collation, settings, capabilities) {

    'use strict';

    var // object to store contacts, that have attachments uploading atm
        uploadInProgress = {},
        //columns ids mapped by keywords
        mapping = {
            email: ['555', '556', '557'],
            telephone: ['542', '543', '545', '546', '548', '549', '551', '552', '553', '559', '560', '561', '562', '563', '564', '567', '568'],
            cellular: ['551', '552'],
            fax: ['544', '550', '554'],
            addresses: '506 507 508 509 510 523 525 526 527 528 538 539 540 541'.split(' ')
        },
        convertResponseToGregorian = function (response) {
            if (response.id) {
                // single contact: convert birthdays with year 1 or earlier from julian to gregorian calendar
                // year might be 0 if birthday is on 1.1 or 1.2. (year 1 - 2days difference)
                // same for anniversary
                if (response.birthday && moment.utc(response.birthday).year() <= 1) {
                    response.birthday = util.julianToGregorian(response.birthday);
                }
                if (response.anniversary && moment.utc(response.anniversary).year() <= 1) {
                    response.anniversary = util.julianToGregorian(response.anniversary);
                }
                return response;
            }
            // array of contacts: convert birthdays with year 1 or earlier from julian to gregorian calendar
            // year might be 0 if birthday is on 1.1 or 1.2. (year 1 - 2days difference)
            // same for anniversary
            _(response).each(function (contact) {
                if (contact.birthday && moment.utc(contact.birthday).year() <= 1) {
                    // birthday without year
                    contact.birthday = util.julianToGregorian(contact.birthday);
                }
                if (contact.anniversary && moment.utc(contact.anniversary).year() <= 1) {
                    // birthday without year
                    contact.anniversary = util.julianToGregorian(contact.anniversary);
                }
            });
            return response;
        },
        // removes empty values before updating/creating
        // update mode=> send null
        // create mode => don't send at all
        cleanUpData = function (data, options) {
            options = options || { mode: 'update' };

            return _(data).each(function (value, key) {
                if (!value) {
                    if (options.mode === 'update') {
                        data[key] = null;
                    } else {
                        delete data[key];
                    }
                }
            });
        };

    // mapped ids for msisdn
    mapping.msisdn = settings.get('msisdn/columns', mapping.cellular);

    // generate basic API
    var api = apiFactory({
        module: 'contacts',
        mapping: mapping,
        requests: {
            all: {
                action: 'all',
                folder: '6',
                columns: '20,1,101,607',
                extendColumns: 'io.ox/contacts/api/all',
                // 607 = magic field
                sort: '607',
                order: 'asc',
                admin: function () {
                    return settings.get('showAdmin', false);
                }
            },
            list: {
                action: 'list',
                columns: '20,1,101,500,501,502,505,520,524,555,556,557,569,592,602,606,607,5,2',
                extendColumns: 'io.ox/contacts/api/list'
            },
            get: {
                action: 'get'
            },
            search: {
                action: 'search',
                columns: '20,1,101,500,501,502,505,520,524,555,556,557,569,592,602,606,607,5,2',
                extendColumns: 'io.ox/contacts/api/list',
                // magic sort field: ignores asc/desc
                sort: '609',
                getData: function (query, opt) {
                    opt = opt || {};
                    query = query + '*';
                    var data = {
                            orSearch: true,
                            admin: settings.get('showAdmin', false),
                            emailAutoComplete: !!opt.emailAutoComplete
                        },
                        defaultBehaviour = true,
                        queryField = {
                            names: {
                                display_name: query,
                                first_name: query,
                                last_name: query,
                                email1: query,
                                email2: query,
                                email3: query
                            },
                            addresses: {
                                street_home: query,
                                postal_code_home: query,
                                city_home: query,
                                state_home: query,
                                country_home: query,
                                street_business: query,
                                postal_code_business: query,
                                city_business: query,
                                state_business: query,
                                country_business: query,
                                street_other: query,
                                postal_code_other: query,
                                city_other: query,
                                state_other: query,
                                country_other: query
                            },
                            phones: {
                                telephone_business1: query,
                                telephone_business2: query,
                                telephone_home1: query,
                                telephone_home2: query,
                                telephone_other: query,
                                fax_business: query,
                                telephone_callback: query,
                                telephone_car: query,
                                telephone_company: query,
                                fax_home: query,
                                cellular_telephone1: query,
                                cellular_telephone2: query,
                                fax_other: query,
                                telephone_isdn: query,
                                telephone_pager: query,
                                telephone_primary: query,
                                telephone_radio: query,
                                telephone_telex: query,
                                telephone_ttytdd: query,
                                telephone_ip: query,
                                telephone_assistant: query
                            }
                        };

                    _(opt).each(function (value, key) {
                        if (_(queryField).chain().keys().contains(key).value() && value === 'on') {
                            data = _(data).extend(queryField[key]);
                            defaultBehaviour = false;
                        }
                    });
                    if (defaultBehaviour) {
                        data = _(data).extend(queryField.names);
                    }
                    ext.point('io.ox/contacts/api/search')
                        .invoke('getData', data, query, opt);
                    return data;
                }
            },
            advancedsearch: {
                action: 'advancedSearch',
                columns: '20,1,101,500,501,502,505,520,524,555,556,557,569,592,602,606,607',
                extendColumns: 'io.ox/contacts/api/list',
                // magic sort field: ignores asc/desc
                sort: '607',
                getData: function (query, opt) {
                    var queryFields = {
                            names: ('display_name first_name last_name yomiFirstName yomiLastName company yomiCompany ' +
                            'email1 email2 email3').split(' '),
                            addresses: ('street_home postal_code_home city_home state_home country_home ' +
                            'street_business postal_code_business city_business state_business country_business ' +
                            'street_other postal_code_other city_other state_other country_other').split(' '),
                            phones: ('telephone_business1 telephone_business2 telephone_home1 telephone_home2 ' +
                            'telephone_other fax_business telephone_callback telephone_car telephone_company ' +
                            'fax_home cellular_telephone1 cellular_telephone2 fax_other telephone_isdn ' +
                            'telephone_pager telephone_primary telephone_radio telephone_telex telephone_ttytdd ' +
                            'telephone_ip telephone_assistant').split(' ')
                        },
                        filter = ['or'],
                        data,
                        defaultBehaviour = true;

                    opt = opt || {};
                    // add wildcards to front and back if none is specified
                    if ((query.indexOf('*') + query.indexOf('?')) < -1) {
                        query = '*' + query + '*';
                    }

                    _(opt).each(function (value, key) {
                        if (_(queryFields).chain().keys().contains(key).value() && value === 'on') {
                            _(queryFields[key]).each(function (name) {
                                filter.push(['=', { 'field': name }, query]);
                            });
                            defaultBehaviour = false;
                        }
                    });

                    if (defaultBehaviour) {
                        _(queryFields.names).each(function (name) {
                            filter.push(['=', { 'field': name }, query]);
                        });
                    }
                    data = { 'filter': filter };
                    ext.point('io.ox/contacts/api/search')
                        .invoke('getData', data, query, opt);
                    return data;
                }
            }
        },
        pipe: {
            get: function (data) {
                if (data.user_id) data.internal_userid = data.user_id;
                return convertResponseToGregorian(data);
            },
            all: function (response) {
                // japanese sorting
                if (ox.language === 'ja_JP') {
                    response.sort(collation.sorter);
                    //console.debug('Japanese order', _(response).pluck('sort_name'));
                    return response;
                }
                // move contacts with empty sort_name to end of array
                // would be nice if backend does this
                var i = 0, item, count = 0;
                while ((item = response[i++])) {
                    if (item.sort_name === '') count++;
                }
                if (count > 0) {
                    response = response.slice(count).concat(response.slice(0, count));
                }
                return response;
            },
            list: function (data) {
                _(data).each(function (obj) {
                    // drop certain null fields (see bug 46574)
                    if (obj.birthday === null) delete obj.birthday;
                    if (obj.distribution_list === null) delete obj.distribution_list;
                });
                return data;
            },
            listPost: function (data) {
                _(data).each(function (obj) {
                    // remove from cache if get cache is outdated
                    api.caches.get.dedust(obj, 'last_modified');
                });
                api.trigger('list:ready');
                return data;
            },
            search: convertResponseToGregorian,
            advancedsearch: convertResponseToGregorian
        }
    });

    // override/wrap api.getList call to inject check function
    var apiGetList = api.getList;

    api.getList = function (list, useCache, opt) {
        // check for valid option param and existing filter function
        if (!capabilities.has('gab') && opt && opt.check && _.isFunction(opt.check)) {
            var missingData = _(list).any(function (item) {
                return !opt.check(item);
            });
            // if some required data is missing, try to get fresh values
            if (missingData) {
                delete opt.check;
                return apiGetList.apply(this, arguments);
            }
            return new $.Deferred().resolve(list);
        }
        return apiGetList.apply(this, arguments);
    };

    /**
     * clear userapi cache
     * @returns defered
     */
    function clearUserApiCache(data) {
        return require(['io.ox/core/api/user']).then(function (userApi) {
            return $.when(
                userApi.caches.get.remove({ id: data.user_id }),
                userApi.caches.all.clear(),
                userApi.caches.list.remove({ id: data.user_id })
            );
        });
    }

    /**
     * fix backend WAT
     * @param  {object} data
     * @param  {string} id (data object property)
     * @return {object} data (cleaned)
     */
    function wat(data, id) {
        if (data[id] === '' || data[id] === undefined) {
            delete data[id];
        }
    }

    /**
     * create contact
     * @param  {object} data (contact object)
     * @param  {object} file (image) [optional]
     * @fires  api#create (object)
     * @fires  api#refresh.all
     * @return {deferred} returns contact object
     */
    api.create = function (data, file) {

        // TODO: Ask backend for a fix, until that:
        wat(data, 'email1');
        wat(data, 'email2');
        wat(data, 'email3');

        if (data.birthday && moment.utc(data.birthday).local(true).year() <= 1) {
            // convert birthdays with year 1 (birthdays without year) from gregorian to julian calendar
            data.birthday = util.gregorianToJulian(data.birthday);
        }
        if (data.anniversary && moment.utc(data.anniversary).local(true).year() <= 1) {
            // convert anniversary with year 1 (anniversaries without year) from gregorian to julian calendar
            data.anniversary = util.gregorianToJulian(data.anniversary);
        }

        var method,
            attachmentHandlingNeeded = data.tempAttachmentIndicator,
            opt = {
                module: 'contacts',
                data: data,
                appendColumns: false,
                fixPost: true
            };

        delete data.tempAttachmentIndicator;
        data = cleanUpData(data, { mode: 'create' });
        if (file) {
            if (window.FormData && file instanceof window.File) {
                method = 'UPLOAD';
                opt.data = new FormData();
                opt.data.append('file', file);
                opt.data.append('json', JSON.stringify(data));
                opt.params = { action: 'new' };
            } else {
                method = 'FORM';
                opt.form = file;
                opt.action = 'new';
            }
        } else {
            method = 'PUT';
            opt.params = { action: 'new' };
        }

        // go!
        return http[method](opt)
            .then(function (fresh) {
                // UPLOAD does not process response data, so ...
                fresh = fresh.data || fresh;
                // get brand new object
                return api.get({ id: fresh.id, folder: data.folder_id });
            })
            .then(function (d) {
                return $.when(
                    api.caches.all.grepRemove(d.folder_id + api.DELIM),
                    fetchCache.clear()
                )
                .then(function () {
                    if (attachmentHandlingNeeded) {
                        // to make the detailview show the busy animation
                        api.addToUploadList(_.ecid(d));
                    }
                    api.trigger('create', { id: d.id, folder: d.folder_id });
                    api.trigger('refresh.all');
                    return d;
                });
            });
    };

    /**
     * updates contact
     * @param  {object} o (contact object)
     * @fires  api#update: + folder + id
     * @fires  api#update: + cid
     * @fires  api#update (data)
     * @fires  api#refresh.all
     * @return {deferred} returns
     */
    api.update = function (o) {

        var attachmentHandlingNeeded = o.data.tempAttachmentIndicator;
        delete o.data.tempAttachmentIndicator;

        if (_.isEmpty(o.data)) {
            if (attachmentHandlingNeeded) {
                return $.when().then(function () {
                    // to make the detailview show the busy animation
                    api.addToUploadList(_.ecid(o));
                    api.trigger('update:' + _.ecid(o));
                    api.trigger('update', o);
                    return { folder_id: o.folder, id: o.id };
                });
            }
            return $.when();
        }
        // convert birthdays with year 1(birthdays without year) from gregorian to julian calendar
        if (o.data.birthday && moment.utc(o.data.birthday).local(true).year() <= 1) {
            o.data.birthday = util.gregorianToJulian(o.data.birthday);
        }

        // convert anniversaries with year 1(birthdays without year) from gregorian to julian calendar
        if (o.data.anniversary && moment.utc(o.data.anniversary).local(true).year() <= 1) {
            o.data.anniversary = util.gregorianToJulian(o.data.anniversary);
        }

        o.data = cleanUpData(o.data, { mode: 'update' });

        // go!
        return http.PUT({
            module: 'contacts',
            params: {
                action: 'update',
                id: o.id,
                folder: o.folder,
                timestamp: o.last_modified || _.then(),
                timezone: 'UTC'
            },
            data: o.data,
            appendColumns: false
        })
        .then(function () {
            // get updated contact
            return api.get({ id: o.id, folder: o.folder }, false).then(function (data) {
                return $.when(
                    api.caches.get.add(data),
                    api.caches.all.grepRemove(o.folder + api.DELIM),
                    api.caches.list.remove({ id: o.id, folder: o.folder }),
                    fetchCache.clear(),
                    data.user_id ? clearUserApiCache(data) : ''
                )
                .done(function () {
                    if (attachmentHandlingNeeded) {
                        // to make the detailview show the busy animation
                        api.addToUploadList(_.ecid(data));
                    }
                    api.trigger('update:' + _.ecid(data), data);
                    api.trigger('update', data);
                    // trigger refresh.all, since position might have changed
                    api.trigger('refresh.all');
                    // reset image?
                    if (o.data.image1 === '') {
                        // to clear picture halo's cache
                        api.trigger('update:image', data);
                        api.trigger('reset:image reset:image:' + _.ecid(data), data);
                    }
                });
            });
        });
    };

    /**
     * update contact image (and properties)
     * @param  {object} o (id and folder_id)
     * @param  {object} changes (target values)
     * @param  {object} file
     * @fires  api#refresh.list
     * @fires  api#update:image ({id,folder})
     * @return {deferred} object with timestamp
     */
    api.editNewImage = function (o, changes, file) {

        var filter = function (data) {
            $.when(
                api.caches.get.clear(),
                api.caches.list.clear(),
                fetchCache.clear()
            )
            .then(function () {
                api.trigger('refresh.list');
                api.trigger('update:' + _.ecid(o));
                // TODO: needs a switch for created by hand or by test
                api.trigger('update:image', {
                    id: o.id,
                    folder: o.folder_id
                });
            });

            return data;
        };

        if ('FormData' in window && file instanceof window.File) {
            var form = new FormData();
            form.append('file', file);
            form.append('json', JSON.stringify(changes));

            return http.UPLOAD({
                module: 'contacts',
                params: { action: 'update', id: o.id, folder: o.folder_id, timestamp: _.then() },
                data: form,
                fixPost: true
            })
            .then(filter);
        }
        return http.FORM({
            module: 'contacts',
            action: 'update',
            form: file,
            data: changes,
            params: { id: o.id, folder: o.folder_id, timestamp: _.then() }
        })
        .then(filter);
    };

    /**
     * delete contacts
     * @param  {array} list (object)
     * @fires  api#refresh.all
     * @fires  api#delete + cid
     * @fires  api#delete (data)
     * @return {promise}
     */
    api.remove = function (list) {
        api.trigger('beforedelete', list);
        // get array
        list = _.isArray(list) ? list : [list];
        // remove
        return http.PUT({
            module: 'contacts',
            params: { action: 'delete', timestamp: _.then(), timezone: 'UTC' },
            appendColumns: false,
            data: _(list).map(function (data) {
                return { folder: data.folder_id, id: data.id };
            })
        })
        .then(function () {
            return $.when(
                api.caches.all.clear(),
                api.caches.list.remove(list),
                fetchCache.clear()
            );
        })
        .fail(function (response) {
            notifications.yell('error', response.error);
        })
        .done(function () {
            _(list).map(function (data) {
                api.trigger('delete:' + _.ecid(data), data);
                api.trigger('delete', data);
            });
            api.trigger('refresh.all');
        });
    };

    api.on('refresh^', function () {
        api.caches.get.clear();
    });

    // refresh.all caused by import
    api.on('refresh.all:import', function () {
        api.caches.list.clear();
        fetchCache.clear();
        api.caches.get.clear();
        api.trigger('import');
        api.trigger('refresh.all');
    });

    /** @define {object} simple contact cache */
    var fetchCache = new cache.SimpleCache('contacts-fetching');

    /**
     * clear fetching cache
     * @return {deferred}
     */
    api.clearFetchCache = function () {
        return fetchCache.clear();
    };

    /**
    * get contact redced/filtered contact data; manages caching
    * @param  {string} address (emailaddress)
    * @return {deferred} returns exactyl one contact object
    */
    api.getByEmailaddress = function (address) {

        address = address || '';

        return fetchCache.get(address).then(function (data) {

            if (data !== null) return data;
            if (address === '') return {};

            //http://oxpedia.org/wiki/index.php?title=HTTP_API#SearchContactsAlternative
            return http.PUT({
                module: 'contacts',
                params: {
                    action: 'search',
                    admin: settings.get('showAdmin', false),
                    columns: '20,1,500,501,502,505,520,555,556,557,569,602,606,524,592',
                    timezone: 'UTC'
                },
                sort: 609,
                data: {
                    'email1': address,
                    'email2': address,
                    'email3': address,
                    'orSearch': true,
                    'exactMatch': true
                }
            })
            .then(function (data) {

                data = data.filter(function (item) {
                    return !item.mark_as_distributionlist;
                });

                if (data.length) {
                    // favor contacts with an image
                    data.sort(function (a, b) {
                        return !!b.image1_url ? +1 : -1;
                    });
                    // favor contacts in global address book
                    data.sort(function (a, b) {
                        return b.folder_id === '6' ? +1 : -1;
                    });
                    // just use the first one
                    data = data[0];
                    // remove host
                    if (data.image1_url) {
                        data.image1_url = data.image1_url
                            .replace(/^https?:\/\/[^/]+/i, '');
                        data.image1_url = coreUtil.replacePrefix(data.image1_url);
                        data.image1_url = coreUtil.getShardingRoot(data.image1_url);
                    }
                    // use first contact
                    return fetchCache.add(address, data);
                }
                // no data found
                return fetchCache.add(address, {});
            });
        });
    };

    // returns URL to fallback image for contacts
    // type: contact / group / resource
    // a simple helper to unify this across the entire UI
    api.getFallbackImage = function (type) {
        return ox.base + '/apps/themes/' + ox.theme + '/fallback-image-' + (type || 'contact') + '.png';
    };

    /**
     * show default image or assigned image (in case it's available)
     * @param  {jquery} node    placeholder node that gets background-image OR null
     * @param  {object} data    all available date for a person/ressource
     * @param  {object} options
     * @param  {object} options.urlOnly (url request may returns 1x1 'error' picture)
     * @return {jquery|string}  opt.urlOnly ? string : node;
     */
    api.pictureHalo = (function () {

        // local hash to recognize URLs that have been fetched already
        var cachedURLs = {},
            uniq = ox.t0,
            fallback = api.getFallbackImage();

        // update uniq on picture change
        api.on('update:image', function () {
            uniq = _.now();
        });

        function load(node, url, opt) {
            _.defer(function () {
                // use lazyload?
                opt.container = opt.container || _.first(node.closest('.scrollpane, .scrollable, .scrollpane-lazyload'));
                if (opt.lazyload || opt.container) {
                    if (opt.fallback) node.css('background-image', 'url(' + fallback + ')');
                    node.attr('data-original', url)
                        .on('load.lazyload error.lazyload', function (e, image) {
                            if (image.width === 1 || e.type === 'error') {
                                url = opt.fallback ? fallback : null;
                            } else {
                                cachedURLs[url] = url;
                            }
                            if (url) {
                                node.text('').attr('data-original', url).css('background-image', 'url(' + url + ')');
                            }
                            node = url = opt = null;
                            $(this).off('.lazyload');
                        })
                        .lazyload();
                } else {
                    $(new Image()).on('load error', function (e) {
                        var fail = this.width === 1 || e.type === 'error';
                        if (!fail) cachedURLs[url] = url;
                        if (!fail || opt.fallback) node.text('').css('background-image', 'url(' + (fail ? fallback : url) + ')');
                        node = null;
                        $(this).off();
                    })
                    .attr('src', url);
                }
            });
            return node;
        }

        return function (node, data, options) {

            var params,
                url,
                opt = _.extend({
                    width: 48,
                    height: 48,
                    scaleType: 'cover',
                    // lazy load block
                    lazyload: false,
                    effect: 'show',
                    urlOnly: false,
                    fallback: true
                }, options);
            delete opt.api;
            // use copy of data object because of delete-statements
            data = _.clone(data);

            // duck check: special handling for search tokens
            if (data.facet) {
                if (!(data.facet.hasPersons() && data.data.item)) return;
                data.image1_url = data.data.item.image_url;
            }

            // use double size in combination retina
            if (_.device('retina')) {
                opt.width *= 2;
                opt.height *= 2;
            }

            // duck checks
            if (api.looksLikeResource(data)) {

                url = api.getFallbackImage('resource');

            } else if (api.looksLikeGroup(data) || api.looksLikeDistributionList(data)) {

                url = api.getFallbackImage('group');

            } else if (_.isString(data.image1_url) && data.image1_url !== '') {

                params = $.extend({}, {
                    // scale
                    width: opt.width,
                    height: opt.height,
                    scaleType: opt.scaleType,
                    user: ox.user_id,
                    context: ox.context_id,
                    sequence: data.last_modified
                });
                url = data.image1_url = coreUtil.replacePrefix(data.image1_url) + '&' + $.param(params);
                url = coreUtil.getShardingRoot(url);

            } else if (opt.fallback && !data.email && !data.email1 && !data.mail && !data.contact_id && !data.id && !data.internal_userid) {
                url = fallback;
            }

            // already done?
            if (url) {
                return opt.urlOnly ? url : load(node, url, opt);
            }

            // preference; internal_userid must not be undefined, null, or zero
            if (data.internal_userid || data.userid || data.user_id) {
                delete data.contact_id;
                delete data.folder_id;
                delete data.folder;
                delete data.id;
            } else {
                delete data.internal_userid;
                delete data.userid;
                delete data.user_id;
            }

            // empty extend trick to restrict to non-undefined values
            params = $.extend({}, {
                // identifier
                email: data.email && String(data.email).toLowerCase() || data.mail && String(data.mail).toLowerCase() || data.email1 && String(data.email1).toLowerCase(),
                folder: data.folder_id || data.folder,
                id: data.contact_id || data.id,
                internal_userid: data.internal_userid || data.userid || data.user_id,
                // scale
                width: opt.width,
                height: opt.height,
                scaleType: opt.scaleType,
                uniq: uniq,
                user: ox.user_id,
                context: ox.context_id,
                // mails don't have a last modified attribute, just use 1
                sequence: data.last_modified || 1
            });

            // remove empty values
            for (var k in params) {
                if (params.hasOwnProperty(k) && !params[k]) {
                    delete params[k];
                }
            }

            url = coreUtil.getShardingRoot('/halo/contact/picture?' + $.param(params));

            // cached?
            if (cachedURLs[url]) {
                return opt.urlOnly ? cachedURLs[url] : node.text('').css('background-image', 'url(' + cachedURLs[url] + ')');
            }

            try {
                return opt.urlOnly ? url : load(node, url, opt);
            } finally {
                data = node = opt = params = null;
            }
        };

    }());

    /**
    * get div node with callbacks managing fetching/updating
    * @param  {object} obj ('display_name' and 'email')
    * @return {object} div node with callbacks
    */
    api.getDisplayName = function (data, options) {

        options = _.extend({
            halo: true,
            stringify: 'getDisplayName',
            tagName: 'a'
        }, options);

        var set, clear, cont,
            display_name = data.display_name || '',
            node = $('<' + options.tagName + '>').text('\u00A0'),
            email = data.email;

        // set node content
        set = function (name) {
            if (options.halo && /@/.test(data.email) && capabilities.has('contacts')) {
                node
                .addClass('halo-link')
                .attr('href', '#')
                .data({
                    display_name: name,
                    email1: email
                });
            }
            node.text(name + '\u00A0');
        };

        // clear vars after call stack has cleared
        clear = function () {
            // use defer! otherwise we return null on cache hit
            _.defer(function () {
                // don't leak
                node = set = clear = cont = options = null;
            });
        };

        // serverresponse vs. cache
        cont = function (data) {

            if (_.isArray(data)) data = data[0];

            if (_.isString(data)) return set(data);

            if (data) {
                if (!_.isEmpty(data)) {
                    set(util[options.stringify](data));
                } else {
                    //fallback
                    set(display_name);
                }
                clear();
            }
        };

        if (data && data.full_name) {
            // has full_name?
            cont(data.full_name);
            clear();
        } else if (data && (data.last_name || data.first_name)) {
            // looks like a full object?
            cont(data);
            clear();
        } else {
            // load data
            api.getByEmailaddress(data.email).done(cont).fail(clear);
        }

        return node;
    };

    var copymove = function (list, action, targetFolderId) {
        // allow single object and arrays
        list = _.isArray(list) ? list : [list];
        // pause http layer
        http.pause();
        // process all updates
        _(list).map(function (o) {
            return http.PUT({
                module: 'contacts',
                params: {
                    action: action || 'update',
                    id: o.id,
                    folder: o.folder_id || o.folder,
                    timezone: 'UTC',
                    // mandatory for 'update'
                    timestamp: o.timestamp || _.then()
                },
                data: { folder_id: targetFolderId },
                appendColumns: false
            });
        });
        // resume & trigger refresh
        return http.resume()
            .then(function (result) {

                var def = $.Deferred();

                _(result).each(function (val) {
                    if (val.error) { notifications.yell(val.error); def.reject(val.error); }
                });

                if (def.state() === 'rejected') {
                    return def;
                }

                return $.when.apply($,
                    _(list).map(function (o) {
                        return $.when(
                            api.caches.all.grepRemove(targetFolderId + api.DELIM),
                            api.caches.all.grepRemove(o.folder_id + api.DELIM),
                            api.caches.list.remove({ id: o.id, folder: o.folder_id })
                        );
                    })
                );
            })
            .done(function () {
                api.trigger('refresh.all');
            });
    };

    /**
     * move contact to a folder
     * @param  {array} list
     * @param  {string} targetFolderId
     * @return {deferred}
     */
    api.move = function (list, targetFolderId) {
        return copymove(list, 'update', targetFolderId);
    };

    /**
     * copy contact to a folder
     * @param  {array} list
     * @param  {string} targetFolderId
     * @return {deferred}
     */
    api.copy = function (list, targetFolderId) {
        return copymove(list, 'copy', targetFolderId);
    };

    /**
     * get birthday ordered list of contacts
     * @param  {object} options
     * @return {deferred}
     */
    api.birthdays = function (options) {

        var now = _.now(),
            params = _.extend({
                action: 'birthdays',
                start: now,
                // now + WEEK
                end: now + 604800000,
                columns: '1,20,500,501,502,503,504,505,511',
                timezone: 'UTC'
            }, options || {});

        return http.GET({
            module: 'contacts',
            params: params
        }).then(convertResponseToGregorian);
    };

    /**
     * is ressource (duck check)
     * @param  {object} obj (contact) or calendar event attendee
     * @return {boolean}
     */
    api.looksLikeResource = function (obj) {
        return ('mailaddress' in obj && 'description' in obj) || ('cuType' in obj && obj.cuType === 'RESOURCE');
    };

    /**
     * is ressource (duck check)
     * @param  {object} obj (contact)
     * @return {boolean}
     */
    api.looksLikeGroup = function (obj) {
        return 'members' in obj;
    };

    /**
     * is distribution list
     * @param  {object} obj (contact)
     * @return {boolean}
     */
    api.looksLikeDistributionList = function (obj) {
        return !!obj.mark_as_distributionlist;
    };

    /**
     * ask if this contact has attachments uploading at the moment (busy animation in detail View)
     * @param  {string} key (task id)
     * @return {boolean}
     */
    api.uploadInProgress = function (key) {
        //return true boolean
        return uploadInProgress[key] || false;
    };

    /**
     * add contact to the list
     * @param {string} key (task id)
     * @return {undefined}
     */
    api.addToUploadList = function (key) {
        uploadInProgress[key] = true;
    };

    /**
     * remove contact from the list
     * @param  {string} key (task id)
     * @fires  api#update: + key
     * @return {undefined}
     */
    api.removeFromUploadList = function (key) {
        delete uploadInProgress[key];
        //trigger refresh
        api.trigger('update:' + key);
    };

    //
    // Simple auto-complete search
    // that supports client-side lookups on former queries
    //
    api.autocomplete = (function () {

        // should be >= 1!
        var minLength = Math.max(1, settings.get('search/minimumQueryLength', 3)),
            // use these fields for local lookups
            fields = settings.get('search/autocompleteFields', 'display_name,email1,email2,email3,first_name,last_name').split(',');

        if (settings.get('showDepartment')) fields.push('department');

        // check for minimum length
        function hasMinLength(str) {
            return str.length >= minLength;
        }

        // hash key: it's the first word in a query that matches the minimum length
        function getHashKey(query) {
            return (_(query.split(' ')).find(hasMinLength) || '').substr(0, minLength);
        }

        // get from local cache
        function get(query) {

            var key = getHashKey(query), def = search.cache[key], words = query.split(' ');

            // cache miss
            if (!def) return;

            // local lookup:
            return def.then(function (data) {
                return _(data).filter(function (item) {
                    return _(words).every(function (word) {
                        var regexWord = new RegExp('\\b' + escape(word));
                        return _(item.fulltext).some(function (str) {
                            // server might use startsWith() or contains() depending whether DB uses a fulltext index
                            return regexWord.test(str) || str.indexOf(query) > -1;
                        });
                    });
                });
            });
        }

        // add to cache
        function add(query, def) {
            var key = getHashKey(query);
            search.cache[key] = def.then(function (data) {
                return _(data).map(function (item) {
                    // prepare simple array for fast lookups
                    item.fulltext = _(fields).map(function (id) {
                        return String(item[id] || '').toLowerCase();
                    });
                    // avoid useless lookups by removing empty strings
                    item.fulltext = _(item.fulltext).compact();
                    return item;
                });
            });
        }

        // escape words for regex
        function escape(str) {
            return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        }

        function search(query, options) {

            // always work with trimmed lower-case variant
            query = $.trim(query).toLowerCase();

            // default: standard columns plus cell phone for MSISDN support
            var columns = '1,2,5,20,101,500,501,502,505,519,520,524,555,556,557,569,592,602,606,607,551,552';
            options = _.extend({ admin: false, email: true, sort: '609', columns: columns, cache: true, limit: 0 }, options);

            // try local cache
            var cache = options.cache && get(query);
            if (cache) return cache;

            // add query to cache
            add(query, http.GET({
                module: 'contacts',
                params: {
                    action: 'autocomplete',
                    // we just look for the shortest word
                    query: getHashKey(query),
                    admin: options.admin,
                    email: options.email,
                    sort: options.sort,
                    columns: options.columns,
                    right_hand_limit: options.limit
                }
            }));

            // use local lookup! first query might exceed minimum length
            return get(query);
        }

        // export cache for debugging/clearing
        search.cache = {};

        // DEBUGGING: use this to debug bad results:
        // search.inspect = function () {
        //     var pairs = _(search.cache).pairs();
        //     $.when.apply($, _(pairs).pluck(1)).then(function () {
        //         var result = {};
        //         _(arguments).each(function (data, index) {
        //             result[pairs[index][0]] = data;
        //         });
        //         console.log('Inspect', result);
        //     });
        // };

        return search;

    }());

    // clear update cache whenever a contact is added, changed, or removed
    api.on('create update delete', function () {
        api.trigger('maybeNewContact');
    });

    api.on('maybeNewContact', function () {
        api.autocomplete.cache = {};
    });

    return api;
});
