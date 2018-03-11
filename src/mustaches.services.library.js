/*jslint browser: true, devel: true, white: true */
/*global
$,CodeMirror,Handlebars,
Utils,
Page
*/

var Mustache = (function () {
    'use strict';
    var getMustacheType = function (id) {
            if (id.match("^meta")) {
                return "meta";
            }
            if (id.match("^text")) {
                return "text";
            }
            if (id.match("^icon")) {
                return "icon";
            }
            if (id.match("^imagesrc")) { // image src
                return "imagesrc";
            }
            if (id.match("^image")) { // image tag
                return "image";
            }
            if (id.match("^link")) {
                return "link";
            }
            return "html";
        },
        getMustacheName = function (id) {
            if (id.match("^meta") || id.match("^icon") || id.match("^text") || id.match("^image") || id.match("^imagesrc")|| id.match("^link") || id.match("^html")) {
                return id.split("-")[1].replace(/_/g, ' ');
            }
            return id;
        },
        getMustacheDescription = function (id) {
            if (id.split("-")[2]) {
                return id.split("-")[2].replace(/_/g, ' ');
            } else {
                return "";
            }
        },
        getHTMLMustaches = function (html) {
            var musta = html.match(/\{\{\s*[\w\.\_\-]+\s*\}\}/g);
            if (musta) {
                return html.match(/\{\{\s*[\w\.\_\-]+\s*\}\}/g).map(function (x) {
                    return x.match(/[\w\.\_\-]+/)[0];
                });
            }
        };

    return {
        getType: function (id) {
            return getMustacheType(id);
        },
        getName: function (id) {
            return getMustacheName(id);
        },
        getDescription: function (id) {
            return getMustacheDescription(id);
        },
        getMustaches: function (html) {
            return getHTMLMustaches(html);
        }
    };
}());

var InsertMustacheForm = (function(){
  'use strict';
  var
    codeMirror = null,
    initEvents = function(){
    /* Insert mustache dialog box */
    $('#insert-mustache-confirm').on("click", function (e) {
        e.preventDefault();
        if ($('.js-validation-insert-mustache').valid()) {
            var htmlContent = codeMirror.getValue(),
                mustacheType = $('input[name=radio-group-template-type]:checked').val(),
                mustacheValue = mustacheType + '-' + $('#val-mustache-name').val(),
                mustacheCode = mustacheType + '-' + $('#val-mustache-name').val() + '-' + $('#val-mustache-description').val();
            if (!htmlContent.includes('{{' + mustacheValue + '-')) {
                codeMirror.replaceSelection('{{{' + mustacheCode + '}}}');
                $('#val-mustache-name').val('');
                $('#val-mustache-description').val('');
                $('#insert-mustache').modal('hide');
            } else {
                $('#exception-mustache-name-exists').show();
                window.setTimeout(function () {
                    $('#exception-mustache-name-exists').hide();
                }, 2000);
            }
            Utils.ready();
        } else {
            Utils.ready();
        }
    });

    $('#cancel-insert-mustache').on("click", function (e) {
        e.preventDefault();
        Utils.ready();
    });
  };

  return {
    init: function(editor){
        if (editor!==null){
          codeMirror = editor;
        }
        initEvents();
    },
    setCodeMirror:function(editor){
      codeMirror = editor;
    }
  };
}());

/* options.preview.frameId, options.preview.secondFrameId, options.preview.secondFrameVisibilityId */
var Mustaches = (function () {
   'use strict';
    var options = null,
        selectLinks = null,
        currentMustache = null,
        currentMustacheType = null,
        templateHTML = null,
        mustaches = null,
        pageData = null,
        codeMirrors = [],
        codemirrorOptions = {
            indentWithTabs: true,
            lineNumbers: true,
            lineWrapping: true,
            mode: 'htmlmixed',
            matchBrackets: true,
            autoCloseBrackets: true,
            autoCloseTags: true,
            theme: 'night',
            extraKeys: {
                "F11": function (cm) {
                    cm.setOption("fullScreen", !cm.getOption("fullScreen"));
                },
                "Esc": function (cm) {
                    if (cm.getOption("fullScreen")) {
                        cm.setOption("fullScreen", false);
                    }
                }
            }
        },
        codemirrorOptionsText = {
            mode: 'text/plain'
        },
        codemirrorOptionsImage = {
            mode: 'htmlmixed',
            theme: 'night'
        },
        insertMustacheLink = function (mustacheName) {
            currentMustache = codeMirrors[mustacheName];
            InsertMustacheForm.setCodeMirror(currentMustache);
            currentMustache.setValue($('#link-' + mustacheName + ' option:selected').text() + '.html');
        },
        refreshCodemirrors = function () {
            $('.CodeMirror').each(function (i, el) {
                el.CodeMirror.refresh();
            });
        },
        appendMustache = function (item) {
            var mustacheType = Mustache.getType(item),
                selector = '#snippets-html',
                mustacheHTMLName = '<div class="row"><div class="col-lg-6"><label class="remove-margin" for="mustache#' +
                item + '" style="text-transform: capitalize;">' + Mustache.getName(item) + '</label><div class="small text-muted text-upper-first">' + Mustache.getDescription(item) + '</div></div>',
                mustacheHTMLTopButtons = mustacheType === 'html' || mustacheType === 'image' || mustacheType === 'imagesrc' ? '<div class="col-lg-6 text-right push-15-t"><a class="btn btn-xs btn-default push-5-r push-5" data-toggle="modal" data-target="#insert-image" data-backdrop="static" id="btn-image" onclick="Mustaches.setCurrentMustacheByName(\'' + item + '\',\'' + mustacheType + '\');" ><i class="fa fa-file-image-o"></i> Insert Image</a></div></div>' : '</div>',
                mustacheHTMLTextArea = (mustacheType === 'icon' ? '<div class="row"><div class="col-sm-5">' : '') + '<div style="border-bottom:1px #e6e6e6 solid;' + (mustacheType === 'html' ? 'height:220px' : '') + '" class="form-material ' + (mustacheType !== 'text' && mustacheType !== 'icon' ? 'context-menu-codemirror push-5-t ' : 'remove-margin-t') + '"><textarea " id="mustache#' + item + '"></textarea></div>' + (mustacheType === 'icon' ? '</div>' : ''),
                mustacheHTMLIconButton = mustacheType === 'icon' ? '<div class="col-sm-3"><div class="form-material remove-margin">&nbsp;&nbsp;<a class="btn btn-xs btn-default push-5-t" data-toggle="modal" data-target="#insert-icon" data-backdrop="static" id="btn-icon" onclick="Mustaches.setCurrentMustacheByName(\'' + item + '\',\'' + mustacheType + '\');" ><i class="fa fa-file-image-o"></i> Select Icon</a></div></div></div>' : '',
                mustacheHTMLLinkSelect = mustacheType === 'link' && selectLinks ? '<div class="form-material remove-padding-t"><select class="form-control remove-padding-t my-page-links" id="link#' + item + '">' + selectLinks + '</select></div>' : '';

            switch (mustacheType) {
                case "meta":
                    $('.mustaches a[href="#btabs-snippets-meta"]').show();
                    selector = '#snippets-meta';
                    break;
                case "text":
                case "icon":
                    $('.mustaches a[href="#btabs-snippets-text"]').show();
                    selector = '#snippets-text';
                    break;
                case "image":
                case "imagesrc":
                    $('.mustaches a[href="#btabs-snippets-image"]').show();
                    selector = '#snippets-image';
                    break;
                case "link":
                    $('.mustaches a[href="#btabs-snippets-link"]').show();
                    selector = '#snippets-link';
                    break;
                case "html":
                    $('.mustaches a[href="#btabs-snippets-html"]').show();
                    selector = '#snippets-html';
                    break;
            }

            $(selector).append('<div class="row push-15-t mustache" id="mustache_' + item + '"><div class="col-sm-12">' + mustacheHTMLName + mustacheHTMLTopButtons + mustacheHTMLTextArea + mustacheHTMLIconButton + mustacheHTMLLinkSelect + '</div></div>');

            codeMirrors[item] = CodeMirror.fromTextArea(document.getElementById('mustache#' + item), (mustacheType === 'text' || mustacheType === 'icon' || mustacheType === 'meta') ? codemirrorOptionsText : (mustacheType === 'image' || mustacheType === 'imagesrc' || mustacheType === 'link' ? codemirrorOptionsImage : codemirrorOptions));

        },
        updateSnippetsContextMenu = function () {
            /* codemirror context menu
            $.contextMenu({
                selector: '.context-menu-codemirror',
                zIndex: 10,
                callback: function (key, options) {
                    switch (key) {
                        case "image":
                            currentMustache = codeMirrors[$(this).find('textarea').attr('id').split('#')[1]];
                            $('#insert-image').modal('show');
                            break;
                    }
                },
                items: {
                    "image": {
                        name: "Insert Image",
                        icon: "fa-file-image-o"
                    },
                    "sep1": "---------",
                    "quit": {
                        name: "Quit",
                        icon: function () {
                            return 'context-menu-icon context-menu-icon-quit';
                        }
                    }
                }
            });
            */
        },
        updateSnippetsLinksSelect = function () {
            $('.my-page-links').on('change', function () {
                if ($(this).val() != '0') {
                    var item = $(this).attr('id').split('#')[1];
                    codeMirrors[item].setValue($(this).val());
                }
            });
        },
        initializeMustaches = function (html, data) {
            $('.loading-templates').show();
            templateHTML = Handlebars.compile(html);
            mustaches = Mustache.getMustaches(html);

            if (mustaches) {
                // prepare mustaches snippets.
                $(".snippets").html('');
                mustaches.forEach(function (item) {
                    appendMustache(item);
                    if (data && data[item]) {
                        codeMirrors[item].setValue(data[item]);
                    }
                    codeMirrors[item].on("change", function () {
                        Mustaches.updatePreview();
                    });

                });
                updateSnippetsContextMenu();
                updateSnippetsLinksSelect();
            }

            Utils.ready();
            $('.loading-templates').hide();
        },
        rebuildSnippets = function () {
            $('.mustache').hide();
            // the HTML has changed, repaint mustaches again...
            mustaches.forEach(function (item) {
                $('#mustache_' + item).show();
                if (!$('#mustache_' + item).length) {
                    // .. and add new mustaches.
                    appendMustache(item);
                    codeMirrors[item].on("change", function () {
                        Mustaches.updatePreview();
                    });
                }
            });
            updateSnippetsContextMenu();
        },
        update = function () {
            var // main preview
                iframe = document.getElementById(options.preview.frameId),
                iframedoc = iframe.document || iframe.contentDocument || iframe.contentWindow.document,
                // second preview
                iframeDraggable = options.preview.secondFrameId ? document.getElementById(options.preview.secondFrameId) : null,
                iframedocDraggable = iframeDraggable ? iframeDraggable.document || iframeDraggable.contentDocument || iframeDraggable.contentWindow.document : null,
                mustacheItems = [],
                context = {},
                secondPreviewIsVisible = iframeDraggable && options.preview.secondFrameVisibilityId ? $('#' + options.preview.secondFrameVisibilityId).is(':visible') : false;


            if (iframedoc && context) {
                // get HTML from mustaches.
                if (mustaches) {
                    mustaches.forEach(function (item) {
                        var mustacheHTML = codeMirrors[item].getValue(),
                            obj = {};
                        context[item] = mustacheHTML;
                        if (mustacheHTML) {
                            obj[item] = mustacheHTML;
                            mustacheItems.push(obj);
                        }
                    });
                }

                var previewHTML = templateHTML(context);
                if (secondPreviewIsVisible) {
                    iframedocDraggable.open();
                    iframedocDraggable.writeln(previewHTML);
                    iframedocDraggable.close();
                }

                iframedoc.open();
                iframedoc.writeln(previewHTML);
                iframedoc.close();
            }
        },
        getContent = function () {
            var pageHTML = null,
                mustacheItems = [],
                context = {},
                content = {};

            if (mustaches !== null) {
                mustaches.forEach(function (item) {
                    var mustacheHTML = codeMirrors[item].getValue(),
                        obj = {};
                    context[item] = mustacheHTML;
                    if (mustacheHTML) {
                        obj[item] = mustacheHTML;
                        mustacheItems.push(obj);
                    }
                });
            }
            content.mustaches = mustacheItems;
            if (templateHTML) {
                content.html = templateHTML(context);
            }
            return content;
        };

    return {
        init: function (mustachesOptions, html, mustachesValues) {
            options = mustachesOptions;

            // get pages list for insert link button.
            Page.list(function (pages) {
                // get pages for setting available links on HTML editor.
                pages.list.sort(function (a, b) {
                    return (a.PAGE_NAME > b.PAGE_NAME) ? 1 : ((b.PAGE_NAME > a.PAGE_NAME) ? -1 : 0);
                });
                selectLinks += "<option value='0'>(select to copy one of your Pages url)</option><option value='0'>--------</option>";
                $.each(pages.list, function (i, val) {
                    selectLinks += "<option value='" + val.PAGE_NAME + ".html'>" + val.PAGE_DESCRIPTION + " - " + val.PAGE_NAME + "</option>";
                });
                if (html){
                  initializeMustaches(html, mustachesValues);
                  update();
                }
            });

            InsertMustacheForm.init();
        },
        refresh: function () {
            refreshCodemirrors();
        },
        updatePreview: function () {
            update();
        },
        updateBaseTemplate: function (html) {
            templateHTML = null;
            templateHTML = Handlebars.compile(html);
            mustaches = null;
            mustaches = Mustache.getMustaches(html);
            rebuildSnippets();
            update();
        },
        rebuild: function () {
            rebuildSnippets();
        },
        getContent: function () {
            return getContent();
        },
        setCurrentMustacheByName: function (mustacheName, mustacheType) {
            currentMustache = codeMirrors[mustacheName];
            InsertMustacheForm.setCodeMirror(currentMustache);

            currentMustacheType = mustacheType;
        },
        setCurrentMustache: function (mustache) {
            currentMustache = mustache;
            InsertMustacheForm.setCodeMirror(currentMustache, mustacheType);
        },
        getCurrentMustache: function () {
            return currentMustache;
        },
        getCurrentMustacheType: function () {
            return currentMustacheType;
        }

    };
}());
