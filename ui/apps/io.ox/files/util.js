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
 * @author Frank Paczynski <frank.paczynski@open-xchange.com>
 */

define('io.ox/files/util', [
    'io.ox/files/api',
    'io.ox/backbone/views/modal',
    'gettext!io.ox/files',
    'io.ox/core/capabilities',
    'io.ox/core/folder/api',
    'io.ox/core/notifications',
    'io.ox/core/api/filestorage',
    'io.ox/files/upload/main',
    'settings!io.ox/files'
], function (api, ModalDialog, gt, capabilities, folderAPI, Notifications, filestorageApi, Upload, settings) {

    'use strict';

    var regexp = {},
        // action requires handling of deferreds
        RESOLVE = $.Deferred().resolve(),
        REJECT = $.Deferred().reject();

    // pseudo reject -> real reject
    function normalize(val) {
        // consider: fc
        if (!_.isUndefined(val) && val === false) {
            return $.Deferred().reject();
        }
        return $.Deferred().resolve();
    }

    return {

        /**
         * returns deferred that sequently checks sync and async conditions
         * @return {deferred} that rejects on first false/reject in chain
         *
         * truthy condition:
         * ta) true
         * tb) resolved deferred
         * tc) resolved deferred returning true
         *
         * falsy condition:
         * fa) false
         * fb) rejected deferred
         * fc) resolved deferred returning false
         */
        conditionChain: function () {
            var list = _.isArray(arguments[0]) ? arguments[0] : arguments || [],
                chain = $.when(),
                response = $.Deferred();

            // conditions
            _.each(list, function (cond) {
                var async = !!cond.then,
                    def = cond ? RESOLVE : REJECT;
                // line up conditions
                chain = chain.then(function () {
                    return async ? cond.then(normalize) : def;
                });
            });

            //real reject/resolve -> pseudo resolve/reject
            chain.always(function () {
                return response.resolveWith(undefined, [chain.state() === 'resolved']);
            });

            return response.promise();
        },

        /**
         * check type of folder
         * @param  {string}  type  (e.g. 'trash')
         * @param  {object}  baton [description]
         * @return {deferred} that is rejected if
         */
        isFolderType: (function () {
            // tries to get data from current/provided folder
            // hint: may returns a empty objec in case no usable data is provided
            function getFolder(baton) {
                var app = baton.app,
                    data = baton.data || {};
                if (app) {
                    return app.folder.getData();
                } else if (data.folder_id) {
                    // no app given, maybe the item itself has a folder
                    return folderAPI.get(data.folder_id);
                }
                // continue without getFolder
                return $.Deferred().resolveWith(data);
            }
            return function (type, baton) {
                return getFolder(baton).then(function (data) {
                    // '!' type prefix as magical negation
                    var inverse, result;
                    if (type[0] === '!') {
                        type = type.substr(1);
                        inverse = true;
                    }
                    result = folderAPI.is(type, data);
                    // reject/resolve
                    if (inverse ? !result : result) {
                        return RESOLVE;
                    }
                    return REJECT;
                });
            };
        })(),

        /**
         * check for 'lock' and 'unlock' status
         * @param  {string}  type (potentially negated with '!' prefix)
         * @param  {event}  e     (e.context)
         * @return {boolean}
         */
        hasStatus: function (type, e) {
            var self = this,
                list = _.isArray(e) ? e : _.getArray(e.context),
                mapping = {
                    'locked': function (obj) {
                        return obj.locked_until > _.now();
                    },
                    'lockedByOthers': function (obj) {
                        return obj.locked_until > _.now() && obj.modified_by !== ox.user_id;
                    },
                    'lockedByMe': function (obj) {
                        return obj.locked_until > _.now() && obj.modified_by === ox.user_id;
                    },
                    'createdByMe': function (obj) {
                        return obj.created_by === ox.user_id;
                    }
                },
                inverse, result, fn;
            // '!' type prefix as magical negation
            if (type[0] === '!') {
                type = type.substr(1);
                inverse = true;
            }
            // map type and fn
            fn = mapping[type];
            // call
            return _(list).reduce(function (memo, obj) {
                result = fn.call(self, obj);
                // negate result?
                return memo || (inverse ? !result : result);
            }, false);
        },

        /**
         * checks for audio/video support
         * @param  {string} type (audio|video)
         * @param  {event}  e
         * @return {deferred} resolves with boolean
         */
        checkMedia: function (type, e) {

            if (!e.collection.has('some') && !settings.get(type + 'Enabled')) {
                return false;
            }

            var list = _.copy(e.baton.allIds, true),
                incompleteHash = {},
                incompleteItems = [],
                def = $.Deferred(),
                index, folder;

            if (_.isUndefined(e.baton.allIds)) {
                e.baton.allIds = e.baton.data;
                list = [e.baton.allIds];
            }

            // avoid runtime errors
            if (!_.isArray(list)) return false;

            // identify incomplete items
            _(list).each(function (item) {
                if (_.isUndefined(item.filename)) {
                    // collect all incomplete items grouped by folder ID
                    incompleteHash[item.folder_id] = (incompleteHash[item.folder_id] || []).concat(item);
                    // all incomplete items
                    incompleteItems.push(item);
                    index = list.indexOf(item);
                    if (index !== -1) {
                        list.splice(index, 1);
                    }
                }
            });

            // complement data from server/cache
            folder = Object.keys(incompleteHash);
            if (folder.length === 1) {
                // get only this folder
                def = api.getAll(folder[0]);
            } else if (folder.length > 1) {
                // multiple folder -> use getList
                def = api.getList(incompleteItems).then(function (data) {
                    return list.concat(data);
                });
            } else {
                // nothing to do
                def.resolve(list);
            }

            return def.then(function (data) {
                return require(['io.ox/files/mediasupport']).then(function (mediasupport) {
                    // update baton
                    e.baton.allIds = data;
                    return _(data).reduce(function (memo, obj) {
                        return memo || !!(obj && mediasupport.checkFile(type, obj.filename));
                    }, false);
                });
            });
        },

        /**
         * shows confirm dialog in case user changes file extension
         * @param  {string} formFilename    filename
         * @param  {string} serverFilename  filename
         * @return { promise} resolves if user confirms or dialogie needen
         */
        confirmDialog: function (formFilename, serverFilename, options) {
            var opt = options || {};
            // be robust
            serverFilename = String(serverFilename || '');
            formFilename = String(formFilename || '');
            var def = $.Deferred(),
                extServer = serverFilename.indexOf('.') >= 0 ? _.last(serverFilename.split('.')) : '',
                extForm = _.last(formFilename.split('.')),
                $hint = $('<p style="padding-top: 16px;">').append(
                    $('<em>').text(gt('Please note, changing or removing the file extension will cause problems when viewing or editing.'))
                ),
                message;

            // set message
            if (formFilename !== '' && formFilename.split('.').length === 1 && extServer !== '') {
                // file extension ext removed
                message = gt('Do you really want to remove the extension ".%1$s" from your filename?', extServer);
            } else if (extServer !== extForm && extServer !== '') {
                // ext changed
                message = gt('Do you really want to change the file extension from  ".%1$s" to ".%2$s" ?', extServer, extForm);
            }
            // confirmation needed
            if (message) {
                new ModalDialog(_.extend(opt, { title: gt('Confirmation'), description: [message, $hint] }))
                    .addButton({ label: gt('Adjust'), action: 'change', className: 'btn-default' })
                    .addButton({ label: gt('Yes'), action: 'rename' })
                    .on('action', function (action) {
                        if (action === 'rename') def.resolve();
                        else def.reject();
                    })
                    .open();
            } else if (formFilename === '') {
                // usually prevented from ui
                def.reject();
            } else {
                def.resolve();
            }
            return def.promise();
        },

        /**
         * returns previewmode and checks capabilities
         * @param  {object} file
         * @return {string} (thumbnail|cover|preview) or false as fallback
         */
        previewMode: function (file) {

            var image = '(gif|png|jpe?g|bmp|tiff|heic?f?)',
                audio = '(mpeg|m4a|m4b|mp3|ogg|oga|opus|x-m4a)',
                video = '(mp4|m4v|ogv|ogm|webm)',
                office = '(csv|xls|xla|xlb|xlt|ppt|pps|doc|dot|xlsx|xlsm|xltx|xltm|xlam|pptx|pptm|ppsx|ppsm|ppa|ppam|pot|potx|potm|docx|docm|dotx|dotm|odc|odb|odf|odg|otg|odi|odp|otp|ods|ots|odt|odm|ott|oth|pdf|rtf)',
                application = '(ms-word|ms-excel|ms-powerpoint|msword|msexcel|mspowerpoint|openxmlformats|opendocument|pdf|rtf)',
                text = '(rtf|plain)';

            //check file extension or mimetype (when type is defined)
            function is(list, type) {
                var key = (type || '') + '.' + list;
                if (regexp[key]) {
                    //use cached
                    return regexp[key].test(type ? file.file_mimetype : file.filename);
                } else if (type) {
                    //e.g. /^image\/.*(gif|png|jpe?g|bmp|tiff).*$/i
                    return (regexp[key] = new RegExp('^' + type + '\\/.*' + list + '.*$', 'i')).test(file.file_mimetype);
                }
                //e.g. /^.*\.(gif|png|jpe?g|bmp|tiff)$/i
                return (regexp[key] = new RegExp('^.*\\.' + list + '$', 'i')).test(file.filename);
            }

            //identify mode
            if (is(image, 'image') || is(image)) {
                return 'thumbnail';
            } else if (is(audio, 'audio') || is(audio)) {
                return 'cover';
            } else if (capabilities.has('document_preview') && (is(application, 'application') || is(text, 'text') || is(office) || is(video))) {
                return 'preview';
            }
            return false;
        },

        /**
         * Returns if a upload of new version for the file is in progress.
         * If a upload is running a dialog appears with the information that
         * the user can edit the file after the file is uploaded.
         *
         * @param {String} fileId file ID to test if a upload is in progress.
         * @param {String} message the message for the yell dialog. If empty no dialog appears.
         *
         * return {Boolean} True if a upload is in progress, otherwise false.
         */
        isFileVersionUploading: function (fileId, message) {

            return Upload.collection.find(function (file) {

                if (file && file.id === fileId) {
                    if (message) {
                        Notifications.yell({ type: 'info', message: message });
                    }
                    return true;
                }

                return false;
            });
        },

        /**
         * Returns whether a file (type office document) can be edited in its federated guest account.
         *
         * @param {Object} fileModel The file model to be checked.
         *
         * return {Boolean} True if the file can be edited in the federated guest account
         */
        canEditDocFederated: function (fileModel) {
            // early out
            if (!fileModel) { return false; }
            if (!fileModel.isOffice()) { return false; }

            // check if file is in federated shared file account
            if (!filestorageApi.isFederatedAccount(fileModel.getItemAccountSync())) { return false; }

            var accountMeta = filestorageApi.getAccountMetaData(fileModel.getItemAccountSync());
            var guestCapabilities = accountMeta && accountMeta.guestCapabilities;
            var canOpenInFederatedContext = false;

            // Temporary workaround for use-case 'edit federated' in 7.10.5:
            // Use local edit when office availible, and when not, check whether
            // it can be edited in the federated context and open the guest drive as a fallback.
            // Therefore the e.g. "!capabilities.has('text')" check was added, remove this part
            // below when restoring the old behavior.
            if (fileModel.isWordprocessing()) { canOpenInFederatedContext = !capabilities.has('text') && guestCapabilities.indexOf('text') > 0; }
            if (fileModel.isSpreadsheet()) { canOpenInFederatedContext = !capabilities.has('spreadsheet') && guestCapabilities.indexOf('spreadsheet') > 0; }
            if (fileModel.isPresentation()) { canOpenInFederatedContext = !capabilities.has('presentation') && guestCapabilities.indexOf('presentation') > 0; }
            return canOpenInFederatedContext;
        }
    };
});
