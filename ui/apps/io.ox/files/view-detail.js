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

// TODO: Render Versions

define("io.ox/files/view-detail",
    ["io.ox/core/extensions",
     "io.ox/core/extPatterns/links",
     "io.ox/core/extPatterns/layouts",
     "io.ox/core/i18n",
     "io.ox/core/event",
     "io.ox/files/actions",
     "io.ox/files/api",
     "io.ox/preview/main",
     "io.ox/core/tk/upload",
     "gettext!io.ox/files/files"], function (ext, links, layouts, i18n, Event, actions, filesAPI, Preview, upload, gt) {

    "use strict";

    var supportsDragOut = Modernizr.draganddrop && _.browser.Chrome;

    var draw = function (file) {

        var self,
            mode = 'display',
            $element = $("<div>").addClass("file-details view"),
            sections = new layouts.Sections({
                ref: "io.ox/files/details/sections"
            });

        // add drag-out delegate
        if (supportsDragOut) {
            $element.on('dragstart', '.dragout', function (e) {
                e.originalEvent.dataTransfer.setData('DownloadURL', this.dataset.downloadurl);
            });
        }

        var blacklisted = {
            "refresh.list": true
        };

        self = {
            element: $element,
            file: file,
            trigger: function (type, evt) {
                if (blacklisted[type]) {
                    return;
                }
                var self = this;
                if (evt && evt.id && evt.id === file.id && type !== "delete") {
                    filesAPI.get({id: evt.id, folder: evt.folder}).done(function (file) {
                        self.file = file;
                        sections.trigger($element, type, file);
                    });
                }
            },
            edit: function () {
                if (mode === 'edit') {
                    return;
                }
                mode = 'edit';
                sections.each(function (sublayout, $sectionNode) {
                    var hideSection = true;
                    sublayout.each(function (extension, $node) {
                        if (extension.edit) {
                            hideSection = false;
                            extension.edit.call($node, file, self, extension);
                        } else {
                            if (extension.deactivate) {
                                hideSection = false;
                                extension.deactivate.call($node, file, self, extension);
                            } else {
                                // Dim the extension, poor mans 'deactivate'
                                if ($node) {
                                    $node.css({opacity: "0.5" });
                                }
                            }
                        }
                    });

                    if (hideSection) {
                        $sectionNode.fadeOut();
                        $sectionNode.data("io-ox-files-hidden", true);
                    }

                });
            },
            endEdit: function () {
                if (mode === 'display') {
                    return;
                }
                mode = 'display';
                sections.each(function (sublayout, $sectionNode) {
                    sublayout.each(function (extension, $node) {
                        if (extension.endEdit) {
                            extension.endEdit.call($node, file, self, extension);
                        } else {
                            if (extension.activate) {
                                extension.activate.call($node, file, self, extension);
                            } else {
                                // Activate the extension
                                if ($node) {
                                    $node.css({opacity: "" });
                                }
                            }
                        }
                    });

                    if ($sectionNode.data("io-ox-files-hidden")) {
                        $sectionNode.fadeIn();
                        $sectionNode.data("io-ox-files-hidde", false);
                    }
                });
            },
            getModifiedFile: function () {
                sections.each(function (sublayout, $sectionNode) {
                    sublayout.each(function (extension, $node) {
                        if (extension.process) {
                            extension.process.call($node, file, self, extension);
                        }
                    });
                });
                return file;
            },
            destroy: function () {
                sections.destroy();
                $element.empty();
                $element = null;
            }
        };

        sections.draw.call($element, file, self);

        return self;
    };

    // Let's define the standard sections
    ext.point("io.ox/files/details/sections").extend({
        id: "header",
        layout: "Grid",
        index: 100
    });

    ext.point("io.ox/files/details/sections").extend({
        id: "content",
        layout: "Grid",
        index: 200
    });

    ext.point("io.ox/files/details/sections").extend({
        id: "upload",
        title: gt("Upload a new version"),
        layout: "Grid",
        index: 300
    });

    ext.point("io.ox/files/details/sections").extend({
        id: "versions",
        title: gt("Versions"),
        layout: "Grid",
        index: 400,
        isEnabled: function (file) {
            return file.current_version && file.version > 1;
        }
    });



    // Fill up the sections


    // Details Extensions
    // Title
    ext.point("io.ox/files/details/sections/header").extend({
        id: "title",
        index: 10,
        draw: function (file) {
            this.append($("<div>").addClass("title clear-title").text(file.title));
        },
        edit: function (file) {
            var size = this.find(".title").height();
            this.find(".title").empty().append($("<input type='text' name='title'>").css({fontSize: size + "px", height: size + 7 + "px", width: "100%", boxSizing: "border-box"}).attr({placeholder: gt("Title")}).val(file.title));
        },
        endEdit: function (file) {
            this.find(".title").empty().text(file.title);
        },
        process: function (file) {
            file.title = this.find("input").val();
        },
        on: {
            update: function (file) {
                this.empty();
                this.append($("<div>").addClass("title clear-title").text(file.title));
            }
        }
    });


    // Basic Info Table
    ext.point("io.ox/files/details/sections/header").extend({
        id: "basicInfo",
        index: 20,
        draw: function (file) {
            this.addClass("basicInfo");
            var $line = $("<div>");
            this.append($line);

            ext.point("io.ox/files/details/sections/header/basicInfo").each(function (extension) {
                var count = 0;
                _.each(extension.fields, function (index, field) {
                    var content = null;
                    $line.append($("<em>").text(extension.label(field) + ":")).append(content = $("<span>"));
                    extension.draw(field, file, content);
                    count++;
                    if (count === 5) {
                        count = 0;
                        $line = $("<div>");
                        this.append($line);
                    }
                });
            });
        },
        on: {
            update: function (file, extension) {
                this.empty();
                extension.draw.call(this, file);
            }
        }
    });


    // Basic Info Fields

    var bytesToSize = function (bytes) {
        var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'], i;
        if (bytes === 0) {
            return 'n/a';
        } else {
            i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
            return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
        }
    };

    ext.point("io.ox/files/details/sections/header/basicInfo").extend({
        id: "size",
        index: 10,
        fields: ["file_size"],
        label: function () {
            return gt("Size");
        },
        draw: function (field, file, $element) {
            $element.text(bytesToSize(file.file_size));
        }
    });

    ext.point("io.ox/files/details/sections/header/basicInfo").extend({
        id: "version",
        index: 20,
        fields: ["version"],
        label: function (field) {
            return gt("Version");
        },
        draw: function (field, file, $element) {
            $element.text(file.version);
        }
    });

    ext.point("io.ox/files/details/sections/header/basicInfo").extend({
        id: "last_modified",
        index: 30,
        fields: ["last_modified"],
        label: function () {
            return gt("Last Modified");
        },
        draw: function (field, file, $element) {
            $element.text(i18n.date("fulldatetime", file.last_modified));
        }
    });

    // Basic Actions
    (function () {
        var regularLinks = new links.InlineLinks({
            ref: 'io.ox/files/links/inline'
        });

        var editLinks = new links.InlineLinks({
            ref: 'io.ox/files/links/edit/inline'
        });

        ext.point('io.ox/files/details/sections/header').extend({
            index: 30,
            id: 'inline-links',
            orientation: 'right',
            draw: function (file, detailView, extension) {
                regularLinks.draw.call(this, {
                    data: file,
                    view: detailView,
                    folder_id: file.folder_id // collection needs this to work!
                });
            },
            edit: function (file, detailView, extension) {
                this.empty();
                editLinks.draw.call(this, {
                    data: file,
                    view: detailView,
                    folder_id: file.folder_id // collection needs this to work!
                });

            },
            endEdit: function (file, detailView, extension) {
                this.empty();
                regularLinks.draw.call(this, {
                    data: file,
                    view: detailView,
                    folder_id: file.folder_id // collection needs this to work!
                });
            }
        });

    }());



    // Content Section
    // Preview
    ext.point("io.ox/files/details/sections/content").extend({
        id: "preview",
        index: 10,
        dim: {
            span: 6
        },
        isEnabled: function (file) {
            if (!file.filename) {
                return false;
            }
            var fileDescription = {
                name: file.filename,
                mimetype: file.file_mimetype,
                size: file.file_size,
                dataURL: filesAPI.getUrl(file)
            };
            var prev = new Preview(fileDescription);
            return prev.supportsPreview();
        },
        draw: function (file) {

            this.addClass("preview");

            var desc = {
                    name: file.filename,
                    mimetype: file.file_mimetype,
                    size: file.file_size,
                    dataURL: filesAPI.getUrl(file)
                },
                link = $('<a>', { href: filesAPI.getUrl(file, 'open'), target: '_blank', draggable: true })
                    .addClass('dragout')
                    .attr('data-downloadurl', desc.mimetype + ':' + desc.name + ':' + ox.abs + desc.dataURL),
                self = this.hide(),
                prev = new Preview(desc);

            if (prev.supportsPreview()) {
                prev.appendTo(link.appendTo(self));
                if (supportsDragOut) {
                    link.attr('title', gt('Click to open. Drag on your desktop to download.'));
                }
                self.show();
            }
        },
        on: {
            update: function (file, extension) {
                this.empty();
                extension.draw.call(this, file, extension);
            }
        }
    });

    // Description

    ext.point("io.ox/files/details/sections/content").extend({
        id: "description",
        index: 20,
        dim: {
            span: 6
        },
        isEnabled: function (file) {
            return true;
        },
        draw: function (file) {
            this.append(
                $("<div>")
                .css({
                    // makes it readable
                    fontFamily: "monospace, 'Courier new'",
                    whiteSpace: "pre-wrap",
                    paddingRight: "2em"
                }).addClass("description")
                .text(file.description || '')
            );
        },
        edit: function (file) {
            var height = this.parent().innerHeight();
            if (height < 220) {
                height = 220;
            }
            this.empty().append($("<textarea>").css({resize: 'none', width: "100%", height: height + "px", boxSizing: "border-box"}).attr({placeholder: gt("Description")}).val(file.description));
        },
        endEdit: function (file) {
            this.empty().append(
                $("<div>")
                .css({
                    // makes it readable
                    fontFamily: "monospace, 'Courier new'",
                    whiteSpace: "pre-wrap",
                    paddingRight: "2em"
                }).addClass("description")
                .text(file.description || '')
            );
        },
        process: function (file) {
            file.description = this.find("textarea").val();
        },
        on: {
            update: function (file, extension) {
                this.empty();
                extension.draw.call(this, file, extension);
            }
        }
    });


    // Upload Field

    ext.point("io.ox/files/details/sections/upload").extend({
        id: "form",
        index: 10,
        dim: {
            span: 6
        },
        draw: function (file) {
            var self = this;
            var $node = $("<form>").appendTo(this);
            var $input = $("<input>", {
                type: "file"
            });

            var $button = $("<button/>").text("Upload").addClass("btn btn-primary pull-right").on("click", function () {
                _($input[0].files).each(function (fileData) {
                    $button.addClass("disabled").text(gt("Uploading..."));
                    $commentArea.addClass("disabled");
                    $input.addClass("disabled");
                    filesAPI.uploadNewVersion({
                        file: fileData,
                        id: file.id,
                        folder: file.folder,
                        timestamp: file.last_modified,
                        json: {version_comment: $commentArea.val()}
                    }).done(function (data) {
                        $button.removeClass("disabled").text(gt("Upload new version"));
                        $commentArea.removeClass("disabled");
                        $input.removeClass("disabled");
                        $comment.hide();
                        $commentArea.val("");
                    });
                });

                return false;
            });

            $("<div>").addClass("row-fluid").append($("<div>").addClass("span6").append($input)).append($("<div>").addClass("span6 pull-right").append($button)).appendTo($node);

            var $comment = $("<div>").addClass("row-fluid").hide().appendTo($node);
            $comment.append($("<label>").text(gt("Version Comment:")));
            var $commentArea = $("<textarea rows='5'></textarea>").css({resize: 'none', width: "100%"}).appendTo($comment);

            $input.on("change", function () {
                $comment.show();
                $commentArea.focus();
            });
        }
    });

    // Version List

    var versionSorter = function (version1, version2) {
        if (version1.version === version2.version) {
            return 0;
        }
        if (version1.current_version) {
            return -1;
        }
        if (version2.current_version) {
            return 1;
        }
        return version2.version - version1.version;
    };

    ext.point("io.ox/files/details/sections/versions").extend({
        id: "table",
        index: 10,
        isEnabled: function (file) {
            return file.current_version && file.version > 1;
        },
        draw: function (file, detailView, allVersions) {
            var self = this,
                $link = $("<a>", {
                    href: '#'
                }).appendTo(this),
                $mainContent = $("<div>").addClass("versions");

            function drawAllVersions(allVersions) {
                $mainContent.empty();
                _.chain(allVersions).sort(versionSorter).each(function (version) {
                    var $entryRow = $("<div>")
                            .addClass("row-fluid version " + (version.current_version ? 'current' : ''))
                            .append(
                                $("<div>").addClass("span1").append(
                                    $("<span>").text(version.version).addClass("versionLabel")
                                )
                            ),
                        $detailsPane = $("<div>").addClass("span11").appendTo($entryRow);
                    new layouts.Grid({ref: "io.ox/files/details/versions/details"}).draw.call($detailsPane, version);
                    $mainContent.append($entryRow);
                });
                self.empty().append($mainContent);
            }

            // Then let's fetch all versions and update the table accordingly
            if (!allVersions) {
                filesAPI.versions({
                    id: file.id
                }).done(drawAllVersions);
            } else {
                drawAllVersions(allVersions);
            }
        },

        on: {
            update: function (file, extension) {
                var self = this;
                filesAPI.versions({
                    id: file.id
                }).done(function (allVersions) {
                    self.empty();
                    extension.draw.call(self, file, null, allVersions);
                });
            }
        }
    });

    // Extensions for the version detail table

    ext.point("io.ox/files/details/versions/details").extend({
        index: 10,
        id: "filename",
        dim: {
            span: 4
        },
        draw: function (version) {
            new links.DropdownLinks({
                label: version.filename,
                ref: "io.ox/files/versions/links/inline"
            }).draw.call(this, version);
        }
    });

    ext.point("io.ox/files/details/versions/details").extend({
        index: 20,
        id: "size",
        dim: {
            span: 4
        },
        draw: function (version) {
            this.text(bytesToSize(version.file_size)).css({textAlign: "right"});
        }
    });

    ext.point("io.ox/files/details/versions/details").extend({
        index: 30,
        id: "created_by",
        dim: {
            span: 4,
            orientation: 'right'
        },
        draw: function (version) {
            var $node = this;
            require(["io.ox/core/api/user"], function (userAPI) {
                $node.append($("<span>").append(userAPI.getLink(version.created_by)).addClass("pull-right"));
            });
        }
    });

    ext.point("io.ox/files/details/versions/details").extend({
        index: 40,
        id: "comment",
        dim: {
            span: 8
        },
        draw: function (version) {
            this.addClass('version-comment').text(version.version_comment || '\u00A0');
        }
    });

    ext.point("io.ox/files/details/versions/details").extend({
        index: 50,
        id: "creation_date",
        dim: {
            span: 4,
            orientation: 'right'
        },
        draw: function (version) {
            this.append($("<span>").text(i18n.date("datetime", version.creation_date)).addClass("pull-right"));
        }
    });

    return {
        draw: draw
    };
});
