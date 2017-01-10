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

define('io.ox/core/collection', ['io.ox/core/folder/api'], function (api) {

    'use strict';

    var unresolved = {},

        // helper
        getRight = function (folder, owner, offset) {
            // get bits
            var bits = api.bits(folder, offset);
            // check
            if (bits === 0) {
                // no permissions
                return false;
            } else if (bits === 1) {
                // only own objects
                return owner === ox.user_id;
            }
            // all objects or admin
            return true;
        },

        isFolder = function (obj) {
            return 'standard_folder' in obj || obj.folder_id === 'folder';
        },

        getFolderId = function (obj) {
            if (!_.isObject(obj)) return undefined;
            if (isFolder(obj)) return obj.id;
            return obj.folder_id || obj.folder;
        },

        // get properties of object collection (async)
        getProperties = function (collection) {

            // selection length
            var $l = collection.length || 0,
                /**
                 * Property object
                 */
                props = {
                    // item permissions
                    'read': true,
                    'modify': true,
                    'delete': true,
                    'create': true,
                    // folder permissions
                    'create:folder': true,
                    'rename:folder': true,
                    'delete:folder': true,
                    // special
                    'change:seen': true,
                    // quantity
                    'none': $l === 0,
                    'some': $l > 0,
                    'one': $l === 1,
                    'multiple': $l > 1,
                    // quality
                    'items': false,
                    'folders': false,
                    'mixed': false,
                    // guard
                    'guard': false
                },

                // get all folders first
                folders = _.chain(collection).map(getFolderId).compact().uniq().value();

            // mail specific: toplevel? (in contrast to nested mails)
            props.toplevel = _(collection).reduce(function (memo, item) {
                // nested mails don't have a folder_id but a filename
                return memo && 'folder_id' in item && !('filename' in item);
            }, true);

            if (folders.length === 0) {
                props.unknown = true;
                'read modify delete create:folder rename:folder delete:folder change:seen'.split(' ').forEach(function (id) {
                    props[id] = false;
                });
                return $.when(props);
            }

            function findUserPermissions(item) {
                // see if user has direct permission or as a member of a group
                // use rampup data for groups to avoid a request and making this deferred
                return (item.group === false && item.entity === ox.user_id) || (item.group === true && _(ox.rampup.user.groups).contains(item.entity));
            }

            return api.multiple(folders).then(function (array) {

                var i = 0, item = null, folder = null, hash = _.toHash(array, 'id'), folders = false, items = false, objectPermission;

                for (; i < $l; i++) {

                    item = collection[i];
                    objectPermission = item && item.object_permissions && _(item.object_permissions).find(findUserPermissions);

                    // Check for Guard files or folders
                    if (item.meta && item.meta.Encrypted) props.guard = true;

                    if (isFolder(item)) {

                        // use fresh data from multiple() request
                        if (item.own_rights === undefined) item = hash[item.id];

                        folders = true;
                        props['create:folder'] = props['create:folder'] && api.can('create:folder', item);
                        props['rename:folder'] = props['rename:folder'] && api.can('rename:folder', item);
                        props['delete:folder'] = props['delete:folder'] && api.can('delete:folder', item);
                        props['change:seen'] = props['change:seen'] && api.can('change:seen', item);
                        // we unify delete; otherwise the action checks are too complicated
                        props['delete'] = props['delete'] && api.can('delete:folder', item);

                    } else if (objectPermission || (folder = hash[getFolderId(item)])) {

                        // get properties
                        items = true;
                        // item-specific
                        if (objectPermission) {
                            props.read = props.read && objectPermission.bits >= 1;
                            props.modify = props.modify && objectPermission.bits >= 2;
                            props['delete'] = props['delete'] && objectPermission.bits >= 4;
                        } else {
                            props.read = props.read && getRight(folder, item.created_by, 7);
                            props.modify = props.modify && getRight(folder, item.created_by, 14);
                            props['delete'] = props['delete'] && getRight(folder, item.created_by, 21);
                        }
                        if (folder) {
                            // create new objects
                            props.create = props.create && (folder.own_rights & 127) >= 2;
                        }

                    } else {
                        // folder unknown
                        props.unknown = true;
                        props.read = props.modify = props['delete'] = props.create = props['change:seen'] = false;
                        break;
                    }
                }

                if (!folders) {
                    'create:folder rename:folder'.split(' ').forEach(function (id) {
                        props[id] = false;
                    });
                }

                if (!items) {
                    'create read modify'.split(' ').forEach(function (id) {
                        props[id] = false;
                    });
                }

                // items and folders are exclusive,
                // so it's EITHER items OR folders OR mixed
                props.items = items && !folders;
                props.folders = folders && !items;
                props.mixed = folders && items;

                return props;
            });
        };

    function Collection(list) {

        var items = _.compact([].concat(list)),
            properties = unresolved;

        // resolve properties (async).
        // Must be done upfront before 'has' checks for example
        this.getProperties = function () {
            return getProperties(items).always(function (props) {
                properties = props;
            });
        };

        this.isResolved = function () {
            return properties !== unresolved;
        };

        // avoid too large selections (just freezes browsers)
        this.isLarge = function () {
            return items.length >= 100;
        };

        // check if collection satisfies a set of properties
        // e.g. has('some') or has('one', 'read')
        this.has = function () {
            if (!this.isResolved()) {
                console.error('Using Collection.has before properties are resolved!', list, arguments);
            }
            return _(arguments).inject(function (memo, key) {
                return memo && properties[key] === true;
            }, true);
        };
    }

    // publish class
    return Collection;
});
