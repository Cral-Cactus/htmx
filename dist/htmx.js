// noinspection JSUnusedAssignment
var htmx = htmx || (function () {
        'use strict';

        var VERBS = ['get', 'post', 'put', 'delete', 'patch'];

        //====================================================================
        // Utilities
        //====================================================================
        function parseInterval(str) {
            if (str === "null" || str === "false" || str === "") {
                return null;
            } else if (str.lastIndexOf("ms") === str.length - 2) {
                return parseFloat(str.substr(0, str.length - 2));
            } else if (str.lastIndexOf("s") === str.length - 1) {
                return parseFloat(str.substr(0, str.length - 1)) * 1000;
            } else {
                return parseFloat(str);
            }
        }

        function getRawAttribute(elt, name) {
            return elt.getAttribute && elt.getAttribute(name);
        }

        // resolve with both hx and data-hx prefixes
        function getAttributeValue(elt, qualifiedName) {
            return getRawAttribute(elt, qualifiedName) || getRawAttribute(elt, "data-" + qualifiedName);
        }

        function parentElt(elt) {
            return elt.parentElement;
        }

        function getDocument() {
            return document;
        }

        function getClosestMatch(elt, condition) {
            if (condition(elt)) {
                return elt;
            } else if (parentElt(elt)) {
                return getClosestMatch(parentElt(elt), condition);
            } else {
                return null;
            }
        }

        function getClosestAttributeValue(elt, attributeName) {
            var closestAttr = null;
            getClosestMatch(elt, function (e) {
                return closestAttr = getAttributeValue(e, attributeName);
            });
            return closestAttr;
        }

        function matches(elt, selector) {
            // noinspection JSUnresolvedVariable
            var matchesFunction = elt.matches ||
                elt.matchesSelector || elt.msMatchesSelector || elt.mozMatchesSelector
                || elt.webkitMatchesSelector || elt.oMatchesSelector;
            return matchesFunction && matchesFunction.call(elt, selector);
        }

        function getStartTag(str) {
            var tagMatcher = /<([a-z][^\/\0>\x20\t\r\n\f]*)/i
            var match = tagMatcher.exec( str );
            if (match) {
                return match[1].toLowerCase();
            } else {
                return "";
            }
        }

        function parseHTML(resp, depth) {
            var parser = new DOMParser();
            var responseDoc = parser.parseFromString(resp, "text/html");
            var responseNode = responseDoc.body;
            while (depth > 0) {
                depth--;
                responseNode = responseNode.firstChild;
            }
            return responseNode;
        }

        function makeFragment(resp) {
            var startTag = getStartTag(resp);
            switch (startTag) {
                case "thead":
                case "tbody":
                case "tfoot":
                case "colgroup":
                case "caption":
                    return parseHTML("<table>" + resp + "</table>", 1);
                case "col":
                    return parseHTML("<table><colgroup>" + resp + "</colgroup></table>", 2);
                case "tr":
                    return parseHTML("<table><tbody>" + resp + "</tbody></table>", 2);
                case "td":
                case "th":
                    return parseHTML("<table><tbody><tr>" + resp + "</tr></tbody></table>", 3);
                default:
                    return parseHTML(resp, 0);
            }
        }

        function isType(o, type) {
            return Object.prototype.toString.call(o) === "[object " + type + "]";
        }

        function isFunction(o) {
            return isType(o, "Function");
        }

        function isRawObject(o) {
            return isType(o, "Object");
        }

        function getInternalData(elt) {
            var dataProp = 'htmx-internal-data';
            var data = elt[dataProp];
            if (!data) {
                data = elt[dataProp] = {};
            }
            return data;
        }

        function toArray(arr) {
            var returnArr = [];
            if (arr) {
                for (var i = 0; i < arr.length; i++) {
                    returnArr.push(arr[i]);
                }
            }
            return returnArr
        }

        function forEach(arr, func) {
            if (arr) {
                for (var i = 0; i < arr.length; i++) {
                    func(arr[i]);
                }
            }
        }

        function isScrolledIntoView(el) {
            var rect = el.getBoundingClientRect();
            var elemTop = rect.top;
            var elemBottom = rect.bottom;
            return elemTop < window.innerHeight && elemBottom >= 0;
        }

        function bodyContains(elt) {
            return getDocument().body.contains(elt);
        }

        function splitOnWhitespace(trigger) {
            return trigger.split(/\s+/);
        }

        function mergeObjects(obj1, obj2) {
            for (var key in obj2) {
                if (obj2.hasOwnProperty(key)) {
                    obj1[key] = obj2[key];
                }
            }
            return obj1;
        }

        //==========================================================================================
        // public API
        //==========================================================================================

        function internalEval(str){
            return eval(str);
        }

        function onLoadHelper(callback) {
            var value = htmx.on("load.htmx", function(evt) {
                callback(evt.detail.elt);
            });
            return value;
        }

        function logAll(){
            htmx.logger = function(elt, event, data) {
                if(console) {
                    console.log(event, elt, data);
                }
            }
        }

        function find(eltOrSelector, selector) {
            if (selector) {
                return eltOrSelector.querySelector(selector);
            } else {
                return getDocument().body.querySelector(eltOrSelector);
            }
        }

        function findAll(eltOrSelector, selector) {
            if (selector) {
                return eltOrSelector.querySelectorAll(selector);
            } else {
                return getDocument().body.querySelectorAll(eltOrSelector);
            }
        }

        function removeElement(elt, delay) {
            if (delay) {
                setTimeout(function(){removeElement(elt);}, delay)
            } else {
                elt.parentElement.removeChild(elt);
            }
        }

        function addClassToElement(elt, clazz, delay) {
            if (delay) {
                setTimeout(function(){addClassToElement(elt, clazz);}, delay)
            } else {
                elt.classList.add(clazz);
            }
        }

        function removeClassFromElement(elt, clazz, delay) {
            if (delay) {
                setTimeout(function(){removeClassFromElement(elt, clazz);}, delay)
            } else {
                elt.classList.remove(clazz);
            }
        }

        function toggleClassOnElement(elt, clazz) {
            elt.classList.toggle(clazz);
        }

        function takeClassForElement(elt, clazz) {
            forEach(elt.parentElement.children, function(child){
                removeClassFromElement(child, clazz);
            })
            addClassToElement(elt, clazz);
        }

        function closest(elt, selector) {
            do if (elt == null || matches(elt, selector)) return elt;
            while (elt = elt && parentElt(elt));
        }

        function processEventArgs(arg1, arg2, arg3) {
            if (isFunction(arg2)) {
                return {
                    target: getDocument().body,
                    event: arg1,
                    listener: arg2
                }
            } else {
                return {
                    target: arg1,
                    event: arg2,
                    listener: arg3
                }
            }

        }

        function addEventListenerImpl(arg1, arg2, arg3) {
            ready(function(){
                var eventArgs = processEventArgs(arg1, arg2, arg3);
                eventArgs.target.addEventListener(eventArgs.event, eventArgs.listener);
            })
            var b = isFunction(arg2);
            return b ? arg2 : arg3;
        }

        function removeEventListenerImpl(arg1, arg2, arg3) {
            ready(function(){
                var eventArgs = processEventArgs(arg1, arg2, arg3);
                eventArgs.target.removeEventListener(eventArgs.event, eventArgs.listener);
            })
            return isFunction(arg2) ? arg2 : arg3;
        }

        //====================================================================
        // Node processing
        //====================================================================

        function getTarget(elt) {
            var explicitTarget = getClosestMatch(elt, function(e){return getAttributeValue(e,"hx-target") !== null});
            if (explicitTarget) {
                var targetStr = getAttributeValue(explicitTarget, "hx-target");
                if (targetStr === "this") {
                    return explicitTarget;
                } else if (targetStr.indexOf("closest ") === 0) {
                    return closest(elt, targetStr.substr(8));
                } else {
                    return getDocument().querySelector(targetStr);
                }
            } else {
                var data = getInternalData(elt);
                if (data.boosted) {
                    return getDocument().body;
                } else {
                    return elt;
                }
            }
        }

        function cloneAttributes(mergeTo, mergeFrom) {
            forEach(mergeTo.attributes, function (attr) {
                if (!mergeFrom.hasAttribute(attr.name)) {
                    mergeTo.removeAttribute(attr.name)
                }
            });
            forEach(mergeFrom.attributes, function (attr) {
                mergeTo.setAttribute(attr.name, attr.value);
            });
        }

        function handleOutOfBandSwaps(fragment, settleInfo) {
            forEach(toArray(fragment.children), function (child) {
                if (getAttributeValue(child, "hx-swap-oob") === "true") {
                    var target = getDocument().getElementById(child.id);
                    if (target) {
                        var fragment = getDocument().createDocumentFragment();
                        fragment.appendChild(child);
                        swapOuterHTML(target, fragment, settleInfo);
                    } else {
                        child.parentNode.removeChild(child);
                        triggerErrorEvent(getDocument().body, "oobErrorNoTarget.htmx", {content: child})
                    }
                }
            });
        }

        function handleAttributes(parentNode, fragment, settleInfo) {
            forEach(fragment.querySelectorAll("[id]"), function (newNode) {
                var oldNode = parentNode.querySelector(newNode.tagName + "[id=" + newNode.id + "]")
                if (oldNode) {
                    var newAttributes = newNode.cloneNode();
                    cloneAttributes(newNode, oldNode);
                    settleInfo.tasks.push(function () {
                        cloneAttributes(newNode, newAttributes);
                    });
                }
            });
        }

        function insertNodesBefore(parentNode, insertBefore, fragment, settleInfo) {
            handleAttributes(parentNode, fragment, settleInfo);
            while(fragment.childNodes.length > 0){
                var child = fragment.firstChild;
                parentNode.insertBefore(child, insertBefore);
                if (child.nodeType !== Node.TEXT_NODE) {
                    triggerEvent(child, 'load.htmx', {});
                    processNode(child);
                }
            }
        }

        function swapOuterHTML(target, fragment, settleInfo) {
            if (target.tagName === "BODY") {
                return swapInnerHTML(target, fragment);
            } else {
                var eltBeforeNewContent = target.previousSibling;
                insertNodesBefore(parentElt(target), target, fragment, settleInfo);
                if (eltBeforeNewContent == null) {
                    var newElt = parentElt(target).firstChild;
                } else {
                    var newElt = eltBeforeNewContent.nextSibling;
                }
                while(newElt && newElt != target) {
                    settleInfo.elts.push(newElt);
                    newElt = newElt.nextSibling;
                }
                parentElt(target).removeChild(target);
            }
        }

        function swapAfterBegin(target, fragment, settleInfo) {
            return insertNodesBefore(target, target.firstChild, fragment, settleInfo);
        }

        function swapBeforeBegin(target, fragment, settleInfo) {
            return insertNodesBefore(parentElt(target), target, fragment, settleInfo);
        }

        function swapBeforeEnd(target, fragment, settleInfo) {
            return insertNodesBefore(target, null, fragment, settleInfo);
        }

        function swapAfterEnd(target, fragment, settleInfo) {
            return insertNodesBefore(parentElt(target), target.nextSibling, fragment, settleInfo);
        }

        function swapInnerHTML(target, fragment, settleInfo) {
            var firstChild = target.firstChild;
            insertNodesBefore(target, firstChild, fragment, settleInfo);
            if (firstChild) {
                while (firstChild.nextSibling) {
                    target.removeChild(firstChild.nextSibling);
                }
                target.removeChild(firstChild);
            }
        }

        function maybeSelectFromResponse(elt, fragment) {
            var selector = getClosestAttributeValue(elt, "hx-select");
            if (selector) {
                var newFragment = getDocument().createDocumentFragment();
                forEach(fragment.querySelectorAll(selector), function (node) {
                    newFragment.appendChild(node);
                });
                fragment = newFragment;
            }
            return fragment;
        }

        function swap(swapStyle, elt, target, fragment, settleInfo) {
            switch (swapStyle) {
                case "outerHTML":
                    swapOuterHTML(target, fragment, settleInfo);
                    return;
                case "afterbegin":
                    swapAfterBegin(target, fragment, settleInfo);
                    return;
                case "beforebegin":
                    swapBeforeBegin(target, fragment, settleInfo);
                    return;
                case "beforeend":
                    swapBeforeEnd(target, fragment, settleInfo);
                    return;
                case "afterend":
                    swapAfterEnd(target, fragment, settleInfo);
                    return;
                default:
                    var extensions = getExtensions(elt);
                    for (var i = 0; i < extensions.length; i++) {
                        var ext = extensions[i];
                        if (ext.handleSwap(swapStyle, target, fragment, settleInfo)) {
                            return;
                        }
                    }
                    swapInnerHTML(target, fragment, settleInfo);
            }
        }

        function selectAndSwap(swapStyle, target, elt, responseText, settleInfo) {
            var fragment = makeFragment(responseText);
            if (fragment) {
                handleOutOfBandSwaps(fragment, settleInfo);
                fragment = maybeSelectFromResponse(elt, fragment);
                return swap(swapStyle, elt, target, fragment, settleInfo);
            }
        }

        function handleTrigger(elt, trigger) {
            if (trigger) {
                if (trigger.indexOf("{") === 0) {
                    var triggers = JSON.parse(trigger);
                    for (var eventName in triggers) {
                        if (triggers.hasOwnProperty(eventName)) {
                            var detail = triggers[eventName];
                            if (!isRawObject(detail)) {
                                detail = {"value": detail}
                            }
                            triggerEvent(elt, eventName, detail);
                        }
                    }
                } else {
                    triggerEvent(elt, trigger, []);
                }
            }
        }

        function getTriggerSpecs(elt) {

            var explicitTrigger = getAttributeValue(elt, 'hx-trigger');
            if (explicitTrigger) {
                var triggerSpecs = explicitTrigger.split(',').map(function(triggerString) {
                    var tokens = splitOnWhitespace(triggerString.trim());
                    var trigger = tokens[0];  // splitOnWhitespace returns at least one element
                    if (!trigger)
                        return null;

                    if (trigger === "every")
                        return {trigger: 'every', pollInterval: parseInterval(tokens[1])};

                    var triggerSpec = {trigger: trigger};
                    for (var i = 1; i < tokens.length; i++) {
                        var token = tokens[i].trim();
                        if (token === "changed") {
                            triggerSpec.changed = true;
                        }
                        if (token === "once") {
                            triggerSpec.once = true;
                        }
                        if (token.indexOf("delay:") === 0) {
                            triggerSpec.delay = parseInterval(token.substr(6));
                        }
                    }
                    return triggerSpec;
                }).filter(function(x){ return x !== null });

                if (triggerSpecs.length)
                    return triggerSpecs;
            }

            if (matches(elt, 'form'))
                return [{trigger: 'submit'}];
            if (matches(elt, 'input, textarea, select'))
                return [{trigger: 'change'}];
            return [{trigger: 'click'}];
        }

        function cancelPolling(elt) {
            getInternalData(elt).cancelled = true;
        }

        function processPolling(elt, verb, path, interval) {
            var nodeData = getInternalData(elt);
            nodeData.timeout = setTimeout(function () {
                if (bodyContains(elt) && nodeData.cancelled !== true) {
                    issueAjaxRequest(elt, verb, path);
                    processPolling(elt, verb, getAttributeValue(elt, "hx-" + verb), interval);
                }
            }, interval);
        }

        function isLocalLink(elt) {
            return location.hostname === elt.hostname &&
                getRawAttribute(elt,'href') &&
                getRawAttribute(elt,'href').indexOf("#") !== 0;
        }

        function boostElement(elt, nodeData, triggerSpecs) {
            if ((elt.tagName === "A" && isLocalLink(elt)) || elt.tagName === "FORM") {
                nodeData.boosted = true;
                var verb, path;
                if (elt.tagName === "A") {
                    verb = "get";
                    path = getRawAttribute(elt, 'href');
                } else {
                    var rawAttribute = getRawAttribute(elt, "method");
                    verb = rawAttribute ? rawAttribute.toLowerCase() : "get";
                    path = getRawAttribute(elt, 'action');
                }
                triggerSpecs.forEach(function(triggerSpec) {
                    addEventListener(elt, verb, path, nodeData, triggerSpec, true);
                });
            }
        }

        function shouldCancel(elt) {
            return elt.tagName === "FORM" ||
                (matches(elt, 'input[type="submit"], button') && closest(elt, 'form') !== null) ||
                (elt.tagName === "A" && elt.href && elt.href.indexOf('#') !== 0);
        }

        function ignoreBoostedAnchorCtrlClick(elt, evt) {
            return getInternalData(elt).boosted && elt.tagName === "A" && evt.type === "click" && evt.ctrlKey;
        }

        function addEventListener(elt, verb, path, nodeData, triggerSpec, explicitCancel) {
            var eventListener = function (evt) {
                if (ignoreBoostedAnchorCtrlClick(elt, evt)) {
                    return;
                }
                if(explicitCancel || shouldCancel(elt)) {}evt.preventDefault();
                var eventData = getInternalData(evt);
                var elementData = getInternalData(elt);
                if (!eventData.handled) {
                    eventData.handled = true;
                    if (triggerSpec.once) {
                        if (elementData.triggeredOnce) {
                            return;
                        } else {
                            elementData.triggeredOnce = true;
                        }
                    }
                    if (triggerSpec.changed) {
                        if (elementData.lastValue === elt.value) {
                            return;
                        } else {
                            elementData.lastValue = elt.value;
                        }
                    }
                    if (elementData.delayed) {
                        clearTimeout(elementData.delayed);
                    }
                    var issueRequest = function(){
                        issueAjaxRequest(elt, verb, path, evt.target);
                    }
                    if (triggerSpec.delay) {
                        elementData.delayed = setTimeout(issueRequest, triggerSpec.delay);
                    } else {
                        issueRequest();
                    }
                }
            };
            nodeData.trigger = triggerSpec.trigger;
            nodeData.eventListener = eventListener;
            elt.addEventListener(triggerSpec.trigger, eventListener);
        }

        function initScrollHandler() {
            if (!window['htmxScrollHandler']) {
                var scrollHandler = function() {
                    forEach(getDocument().querySelectorAll("[hx-trigger='revealed'],[data-hx-trigger='revealed']"), function (elt) {
                        maybeReveal(elt);
                    });
                };
                window['htmxScrollHandler'] = scrollHandler;
                window.addEventListener("scroll", scrollHandler)
            }
        }

        function maybeReveal(elt) {
            var nodeData = getInternalData(elt);
            if (!nodeData.revealed && isScrolledIntoView(elt)) {
                nodeData.revealed = true;
                issueAjaxRequest(elt, nodeData.verb, nodeData.path);
            }
        }

        function processWebSocketInfo(elt, nodeData, info) {
            var values = info.split(",");
            for (var i = 0; i < values.length; i++) {
                var value = removeWhiteSpace(values[i]);
                if (value.indexOf("source:") === 0) {
                    processWebSocketSource(elt, value.substr(7));
                }
                if (value.indexOf("send:") === 0) {
                    processWebSocketSend(elt, value.substr(5));
                }
            }
        }

        function processWebSocketSource(elt, wssSource) {
            var detail = {
                protocols:[]
            };
            triggerEvent(elt, "initWebSocket.htmx", detail);
            var socket = new WebSocket("wss:" + wssSource, detail.protocols);
            socket.onerror = function (e) {
                triggerErrorEvent(elt, "wsError.htmx", {error:e, socket:socket});
                maybeCloseWebSocketSource(elt);
            };
            getInternalData(elt).webSocket = socket;
            socket.addEventListener('message', function (event) {
                if (maybeCloseWebSocketSource(elt)) {
                    return;
                }

                var response = event.data;
                forEach(getExtensions(elt), function(extension){
                    response = extension.transformResponse(response, null, elt);
                });

                var settleInfo = makeSettleInfo(elt);
                var fragment = makeFragment(response);
                var children = toArray(fragment.children);
                for (var i = 0; i < children.length; i++) {
                    var child = children[i];
                    if (child.id) {
                        var target = getDocument().getElementById(child.id);
                        if (target) {
                            var tmp = getDocument().createDocumentFragment();
                            tmp.appendChild(child);
                            swapOuterHTML(target, fragment, settleInfo);
                        }
                    }
                }

                settleImmediately(settleInfo.tasks);
            });
        }

        function maybeCloseWebSocketSource(elt) {
            if (!bodyContains(elt)) {
                getInternalData(elt).webSocket.close();
                return true;
            }
        }

        function processWebSocketSend(elt, eventName) {
            var webSocketSourceElt = getClosestMatch(elt, function (parent) {
                return getInternalData(parent).webSocket != null;
            });
            if (webSocketSourceElt) {
                var webSocket = getInternalData(webSocketSourceElt).webSocket;
                elt.addEventListener(eventName, function () {
                    var headers = getHeaders(elt, webSocketSourceElt, null, elt);
                    var rawParameters = getInputValues(elt, 'post');
                    var filteredParameters = filterValues(rawParameters, elt);
                    filteredParameters['HEADERS'] = headers;
                    webSocket.send(JSON.stringify(filteredParameters));
                });
            } else {
                triggerErrorEvent(elt, "noWebSocketSourceError.htmx");
            }
        }

        function maybeCloseSSESource(elt) {
            if (!bodyContains(elt)) {
                getInternalData(elt).sseEventSource.close();
                return true;
            }
        }

        function processSSEInfo(elt, nodeData, info) {
            var values = info.split(",");
            for (var i = 0; i < values.length; i++) {
                var value = removeWhiteSpace(values[i]);
                if (value.indexOf("source:") === 0) {
                    processSSESource(elt, value.substr(7));
                }
                if (value.indexOf("trigger:") && nodeData.verb) {
                    processSSETrigger(elt, nodeData.verb, nodeData.path, value.substr(8));
                }
            }
        }

        function processSSESource(elt, sseSrc) {
            var detail = {
                config:{withCredentials: true}
            };
            triggerEvent(elt, "initSSE.htmx", detail);
            var source = new EventSource(sseSrc, detail.config);
            source.onerror = function (e) {
                triggerErrorEvent(elt, "sseError.htmx", {error:e, source:source});
                maybeCloseSSESource(elt);
            };
            getInternalData(elt).sseEventSource = source;
        }

        function processSSETrigger(elt, verb, path, sseEventName) {
            var sseSourceElt = getClosestMatch(elt, function (parent) {
                return getInternalData(parent).sseEventSource != null;
            });
            if (sseSourceElt) {
                var sseEventSource = getInternalData(sseSourceElt).sseEventSource;
                var sseListener = function () {
                    if (!maybeCloseSSESource(sseEventSource)) {
                        if (bodyContains(elt)) {
                            issueAjaxRequest(elt, verb, path);
                        } else {
                            sseEventSource.removeEventListener(sseEventName, sseListener);
                        }
                    }
                };
                getInternalData(elt).sseListener = sseListener;
                sseEventSource.addEventListener(sseEventName, sseListener);
            } else {
                triggerErrorEvent(elt, "noSSESourceError.htmx");
            }
        }

        function loadImmediately(elt, verb, path, nodeData, delay) {
            var load = function(){
                if (!nodeData.loaded) {
                    nodeData.loaded = true;
                    issueAjaxRequest(elt, verb, path);
                }
            }
            if (delay) {
                setTimeout(load, delay);
            } else {
                load();
            }
        }

        function processVerbs(elt, nodeData, triggerSpecs) {
            var explicitAction = false;
            forEach(VERBS, function (verb) {
                var path = getAttributeValue(elt, 'hx-' + verb);
                if (path) {
                    explicitAction = true;
                    nodeData.path = path;
                    nodeData.verb = verb;
                    triggerSpecs.forEach(function(triggerSpec) {
                        if (triggerSpec.trigger === "revealed") {
                            initScrollHandler();
                            maybeReveal(elt);
                        } else if (triggerSpec.trigger === "load") {
                            loadImmediately(elt, verb, path, nodeData, triggerSpec.delay);
                        } else if (triggerSpec.pollInterval) {
                            nodeData.polling = true;
                            processPolling(elt, verb, path, triggerSpec.pollInterval);
                        } else {
                            addEventListener(elt, verb, path, nodeData, triggerSpec);
                        }
                    });
                }
            });
            return explicitAction;
        }

        function processNode(elt) {
            var nodeData = getInternalData(elt);
            if (!nodeData.processed) {
                nodeData.processed = true;

                var triggerSpecs = getTriggerSpecs(elt);
                var explicitAction = processVerbs(elt, nodeData, triggerSpecs);

                if (!explicitAction && getClosestAttributeValue(elt, "hx-boost") === "true") {
                    boostElement(elt, nodeData, triggerSpecs);
                }
                var sseInfo = getAttributeValue(elt, 'hx-sse');
                if (sseInfo) {
                    processSSEInfo(elt, nodeData, sseInfo);
                }
                var sseInfo = getAttributeValue(elt, 'hx-ws');
                if (sseInfo) {
                    processWebSocketInfo(elt, nodeData, sseInfo);
                }
                triggerEvent(elt, "processedNode.htmx");
            }
            if (elt.children) { // IE
                forEach(elt.children, function(child) { processNode(child) });
            }
        }

        //====================================================================
        // Event/Log Support
        //====================================================================

        function sendError(elt, eventName, detail) {
            var errorURL = getClosestAttributeValue(elt, "hx-error-url");
            if (errorURL) {
                var xhr = new XMLHttpRequest();
                xhr.open("POST", errorURL);
                xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
                xhr.send(JSON.stringify({ "elt": elt.id, "event": eventName, "detail" : detail }));
            }
        }

        function makeEvent(eventName, detail) {
            var evt;
            if (window.CustomEvent && typeof window.CustomEvent === 'function') {
                evt = new CustomEvent(eventName, {bubbles: true, cancelable: true, detail: detail});
            } else {
                evt = getDocument().createEvent('CustomEvent');
                evt.initCustomEvent(eventName, true, true, detail);
            }
            return evt;
        }

        function triggerErrorEvent(elt, eventName, detail) {
            triggerEvent(elt, eventName, mergeObjects({isError:true}, detail));
        }

        function ignoreEventForLogging(eventName) {
            return eventName === "processedNode.htmx"
        }

        function triggerEvent(elt, eventName, detail) {
            if (detail == null) {
                detail = {};
            }
            detail["elt"] = elt;
            var event = makeEvent(eventName, detail);
            if (htmx.logger && !ignoreEventForLogging(eventName)) {
                htmx.logger(elt, eventName, detail);
            }
            if (detail.isError) {
                sendError(elt, eventName, detail);
            }
            var eventResult = elt.dispatchEvent(event);
            forEach(getExtensions(elt), function (extension) {
                eventResult = eventResult && (extension.onEvent(eventName, event) !== false)
            })
            return eventResult;
        }

        //====================================================================
        // History Support
        //====================================================================
        var currentPathForHistory = null;

        function getHistoryElement() {
            var historyElt = getDocument().querySelector('[hx-history-elt],[data-hx-history-elt]');
            return historyElt || getDocument().body;
        }

        function saveToHistoryCache(url, content, title, scroll) {
            var historyCache = JSON.parse(localStorage.getItem("htmx-history-cache")) || [];
            for (var i = 0; i < historyCache.length; i++) {
                if (historyCache[i].url === url) {
                    historyCache = historyCache.slice(i, 1);
                    break;
                }
            }
            historyCache.push({url:url, content: content, title:title, scroll:scroll})
            while (historyCache.length > htmx.config.historyCacheSize) {
                historyCache.shift();
            }
            localStorage.setItem("htmx-history-cache", JSON.stringify(historyCache));
        }

        function getCachedHistory(url) {
            var historyCache = JSON.parse(localStorage.getItem("htmx-history-cache")) || [];
            for (var i = 0; i < historyCache.length; i++) {
                if (historyCache[i].url === url) {
                    return historyCache[i];
                }
            }
            return null;
        }

        function saveHistory() {
            var elt = getHistoryElement();
            var path = currentPathForHistory || location.pathname+location.search;
            triggerEvent(getDocument().body, "beforeHistorySave.htmx", {path:path, historyElt:elt});
            if(htmx.config.historyEnabled) history.replaceState({}, getDocument().title, window.location.href);
            saveToHistoryCache(path, elt.innerHTML, getDocument().title, window.scrollY);
        }

        function pushUrlIntoHistory(path) {
            if(htmx.config.historyEnabled)  history.pushState({}, "", path);
            currentPathForHistory = path;
        }

        function settleImmediately(tasks) {
            forEach(tasks, function (task) {
                task.call();
            });
        }

        function loadHistoryFromServer(path) {
            var request = new XMLHttpRequest();
            var details = {path: path, xhr:request};
            triggerEvent(getDocument().body, "historyCacheMiss.htmx", details);
            request.open('GET', path, true);
            request.onload = function () {
                if (this.status >= 200 && this.status < 400) {
                    triggerEvent(getDocument().body, "historyCacheMissLoad.htmx", details);
                    var fragment = makeFragment(this.response);
                    fragment = fragment.querySelector('[hx-history-elt],[data-hx-history-elt]') || fragment;
                    var historyElement = getHistoryElement();
                    var settleInfo = makeSettleInfo(historyElement);
                    swapInnerHTML(historyElement, fragment, settleInfo)
                    settleImmediately(settleInfo.tasks);
                    currentPathForHistory = path;
                } else {
                    triggerErrorEvent(getDocument().body, "historyCacheMissLoadError.htmx", details);
                }
            };
            request.send();
        }

        function restoreHistory(path) {
            saveHistory(currentPathForHistory);
            path = path || location.pathname+location.search;
            triggerEvent(getDocument().body, "historyRestore.htmx", {path:path});
            var cached = getCachedHistory(path);
            if (cached) {
                var fragment = makeFragment(cached.content);
                var historyElement = getHistoryElement();
                var settleInfo = makeSettleInfo(historyElement);
                swapInnerHTML(historyElement, fragment, settleInfo)
                settleImmediately(settleInfo.tasks);
                document.title = cached.title;
                window.scrollTo(0, cached.scroll);
                currentPathForHistory = path;
            } else {
                loadHistoryFromServer(path);
            }
        }

        function shouldPush(elt) {
            return getClosestAttributeValue(elt, "hx-push-url") === "true" ||
                (elt.tagName === "A" && getInternalData(elt).boosted);
        }

        function addRequestIndicatorClasses(elt) {
            mutateRequestIndicatorClasses(elt, "add");
        }

        function removeRequestIndicatorClasses(elt) {
            mutateRequestIndicatorClasses(elt, "remove");
        }

        function mutateRequestIndicatorClasses(elt, action) {
            var indicator = getClosestAttributeValue(elt, 'hx-indicator');
            if (indicator) {
                var indicators = getDocument().querySelectorAll(indicator);
            } else {
                indicators = [elt];
            }
            forEach(indicators, function(ic) {
                ic.classList[action].call(ic.classList, "htmx-request");
            });
        }

        //====================================================================
        // Input Value Processing
        //====================================================================

        function haveSeenNode(processed, elt) {
            for (var i = 0; i < processed.length; i++) {
                var node = processed[i];
                if (node.isSameNode(elt)) {
                    return true;
                }
            }
            return false;
        }

        function shouldInclude(elt) {
            if(elt.name === "" || elt.name == null || elt.disabled) {
                return false;
            }
            // ignore "submitter" types (see jQuery src/serialize.js)
            if (elt.type === "button" || elt.type === "submit" || elt.tagName === "image" || elt.tagName === "reset" || elt.tagName === "file" ) {
                return false;
            }
            if (elt.type === "checkbox" || elt.type === "radio" ) {
                return elt.checked;
            }
            return true;
        }

        function processInputValue(processed, values, elt) {
            if (elt == null || haveSeenNode(processed, elt)) {
                return;
            } else {
                processed.push(elt);
            }
            if (shouldInclude(elt)) {
                var name = getRawAttribute(elt,"name");
                var value = elt.value;
                if (name != null && value != null) {
                    var current = values[name];
                    if(current) {
                        if (Array.isArray(current)) {
                            current.push(value);
                        } else {
                            values[name] = [current, value];
                        }
                    } else {
                        values[name] = value;
                    }
                }
            }
            if (matches(elt, 'form')) {
                var inputs = elt.elements;
                forEach(inputs, function(input) {
                    processInputValue(processed, values, input);
                });
            }
        }

        function getInputValues(elt, verb) {
            var processed = [];
            var values = {};

            // for a non-GET include the closest form
            if (verb !== 'get') {
                processInputValue(processed, values, closest(elt, 'form'));
            }

            // include the element itself
            processInputValue(processed, values, elt);

            // include any explicit includes
            var includes = getClosestAttributeValue(elt, "hx-include");
            if (includes) {
                var nodes = getDocument().querySelectorAll(includes);
                forEach(nodes, function(node) {
                    processInputValue(processed, values, node);
                });
            }


            return values;
        }

        function appendParam(returnStr, name, realValue) {
            if (returnStr !== "") {
                returnStr += "&";
            }
            returnStr += encodeURIComponent(name) + "=" + encodeURIComponent(realValue);
            return returnStr;
        }

        function urlEncode(values) {
            var returnStr = "";
            for (var name in values) {
                if (values.hasOwnProperty(name)) {
                    var value = values[name];
                    if (Array.isArray(value)) {
                        forEach(value, function(v) {
                            returnStr = appendParam(returnStr, name, v);
                        });
                    } else {
                        returnStr = appendParam(returnStr, name, value);
                    }
                }
            }
            return returnStr;
        }

        //====================================================================
        // Ajax
        //====================================================================

        function getHeaders(elt, target, prompt, eventTarget) {
            var headers = {
                "X-HX-Request" : "true",
                "X-HX-Trigger" : getRawAttribute(elt, "id"),
                "X-HX-Trigger-Name" : getRawAttribute(elt, "name"),
                "X-HX-Target" : getAttributeValue(target, "id"),
                "X-HX-Current-URL" : getDocument().location.href,
            }
            if (prompt !== undefined) {
                headers["X-HX-Prompt"] = prompt;
            }
            if (eventTarget) {
                headers["X-HX-Event-Target"] = getRawAttribute(eventTarget, "id");
            }
            if (getDocument().activeElement) {
                headers["X-HX-Active-Element"] = getRawAttribute(getDocument().activeElement, "id");
                headers["X-HX-Active-Element-Name"] = getRawAttribute(getDocument().activeElement, "name");
                if (getDocument().activeElement.value) {
                    headers["X-HX-Active-Element-Value"] = getRawAttribute(getDocument().activeElement, "value");
                }
            }
            return headers;
        }

        function filterValues(inputValues, elt) {
            var paramsValue = getClosestAttributeValue(elt, "hx-params");
            if (paramsValue) {
                if (paramsValue === "none") {
                    return {};
                } else if (paramsValue === "*") {
                    return inputValues;
                } else if(paramsValue.indexOf("not ") === 0) {
                    forEach(paramsValue.substr(4).split(","), function (name) {
                        name = name.trim();
                        delete inputValues[name];
                    });
                    return inputValues;
                } else {
                    var newValues = {}
                    forEach(paramsValue.split(","), function (name) {
                        name = name.trim();
                        newValues[name] = inputValues[name];
                    });
                    return newValues;
                }
            } else {
                return inputValues;
            }
        }

        function getSwapSpecification(elt) {
            var swapInfo = getClosestAttributeValue(elt, "hx-swap");
            var swapSpec = {
                "swapStyle" : htmx.config.defaultSwapStyle,
                "swapDelay" : htmx.config.defaultSwapDelay,
                "settleDelay" : htmx.config.defaultSettleDelay
            }
            if (swapInfo) {
                var split = splitOnWhitespace(swapInfo);
                if (split.length > 0) {
                    swapSpec["swapStyle"] = split[0];
                    for (var i = 1; i < split.length; i++) {
                        var modifier = split[i];
                        if (modifier.indexOf("swap:") === 0) {
                            swapSpec["swapDelay"] = parseInterval(modifier.substr(5));
                        }
                        if (modifier.indexOf("settle:") === 0) {
                            swapSpec["settleDelay"] = parseInterval(modifier.substr(7));
                        }
                    }
                }
            }
            return swapSpec;
        }

        function encodeParamsForBody(xhr, elt, filteredParameters) {
            var encodedParameters = null;
            forEach(getExtensions(elt), function (extension) {
                if (encodedParameters == null) {
                    encodedParameters = extension.encodeParameters(xhr, filteredParameters, elt);
                }
            });
            if (encodedParameters != null) {
                return encodedParameters;
            } else {
                return urlEncode(filteredParameters);
            }
        }

        function makeSettleInfo(target) {
            return {tasks: [], elts: [target]};
        }

        function issueAjaxRequest(elt, verb, path, eventTarget) {
            var target = getTarget(elt);
            if (target == null) {
                triggerErrorEvent(elt, 'targetError.htmx', {target: getAttributeValue(elt, "hx-target")});
                return;
            }
            var eltData = getInternalData(elt);
            if (eltData.requestInFlight) {
                return;
            } else {
                eltData.requestInFlight = true;
            }
            var endRequestLock = function(){
                eltData.requestInFlight = false
            }
            var promptQuestion = getClosestAttributeValue(elt, "hx-prompt");
            if (promptQuestion) {
                var promptResponse = prompt(promptQuestion);
                // prompt returns null if cancelled and empty string if accepted with no entry
                if (promptResponse === null ||
                    !triggerEvent(elt, 'prompt.htmx', {prompt: promptResponse, target:target}))
                    return endRequestLock();
            }

            var confirmQuestion = getClosestAttributeValue(elt, "hx-confirm");
            if (confirmQuestion) {
                if(!confirm(confirmQuestion)) return endRequestLock();
            }

            var xhr = new XMLHttpRequest();

            var headers = getHeaders(elt, target, promptResponse, eventTarget);
            var rawParameters = getInputValues(elt, verb);
            var filteredParameters = filterValues(rawParameters, elt);

            if (verb !== 'get') {
                headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
                if (verb !== 'post') {
                    headers['X-HTTP-Method-Override'] = verb.toUpperCase();
                }
            }

            // behavior of anchors w/ empty href is to use the current URL
            if (path == null || path === "") {
                path = getDocument().location.href;
            }

            var requestConfig = {
                parameters: filteredParameters,
                unfilteredParameters:rawParameters,
                headers:headers,
                target:target,
                verb:verb
            };
            if(!triggerEvent(elt, 'configRequest.htmx', requestConfig)) return endRequestLock();

            var splitPath = path.split("#");
            var pathNoAnchor = splitPath[0];
            var anchor = splitPath[1];
            if (verb === 'get') {
                var finalPathForGet = pathNoAnchor;
                var values = Object.keys(filteredParameters).length !== 0;
                if (values) {
                    if (finalPathForGet.indexOf("?") < 0) {
                        finalPathForGet += "?";
                    } else {
                        finalPathForGet += "&";
                    }
                    finalPathForGet += urlEncode(filteredParameters);
                    if (anchor) {
                        finalPathForGet += "#" + anchor;
                    }
                }
                xhr.open('GET', finalPathForGet, true);
            } else {
                xhr.open('POST', path, true);
            }

            xhr.overrideMimeType("text/html");

            // request headers
            for (var header in headers) {
                if (headers.hasOwnProperty(header)) {
                    if (headers[header] !== null) xhr.setRequestHeader(header, headers[header]);
                }
            }

            var eventDetail = {xhr: xhr, target: target};
            xhr.onload = function () {
                try {
                    if (!triggerEvent(elt, 'beforeOnLoad.htmx', eventDetail)) return;

                    handleTrigger(elt, this.getResponseHeader("X-HX-Trigger"));
                    var pushedUrl = this.getResponseHeader("X-HX-Push");

                    var shouldSaveHistory = shouldPush(elt) || pushedUrl;

                    if (this.status >= 200 && this.status < 400) {
                        if (this.status === 286) {
                            cancelPolling(elt);
                        }
                        // don't process 'No Content' response
                        if (this.status !== 204) {
                            if (!triggerEvent(elt, 'beforeSwap.htmx', eventDetail)) return;

                            var resp = this.response;
                            forEach(getExtensions(elt), function(extension){
                                resp = extension.transformResponse(resp, xhr, elt);
                            });

                            // Save current page
                            if (shouldSaveHistory) {
                                saveHistory();
                            }

                            var swapSpec = getSwapSpecification(elt);

                            target.classList.add("htmx-swapping");
                            var doSwap = function () {
                                try {
                                    var settleInfo = makeSettleInfo(target);
                                    selectAndSwap(swapSpec.swapStyle, target, elt, resp, settleInfo);
                                    target.classList.remove("htmx-swapping");
                                    forEach(settleInfo.elts, function (elt) {
                                        if (elt.classList) {
                                            elt.classList.add("htmx-settling");
                                        }
                                    });
                                    triggerEvent(elt, 'afterSwap.htmx', eventDetail);
                                    if (anchor) {
                                        location.hash = anchor;
                                    }
                                    var doSettle = function(){
                                        forEach(settleInfo.tasks, function (task) {
                                            task.call();
                                        });
                                        forEach(settleInfo.elts, function (elt) {
                                            if (elt.classList) {
                                                elt.classList.remove("htmx-settling");
                                            }
                                        });
                                        // push URL and save new page
                                        if (shouldSaveHistory) {
                                            pushUrlIntoHistory(pushedUrl || path);
                                        }
                                        triggerEvent(elt, 'afterSettle.htmx', eventDetail);
                                    }

                                    if (swapSpec.settleDelay > 0) {
                                        setTimeout(doSettle, swapSpec.settleDelay)
                                    } else {
                                        doSettle();
                                    }
                                } catch (e) {
                                    triggerErrorEvent(elt, 'swapError.htmx', eventDetail);
                                    throw e;
                                }
                            };

                            if (swapSpec.swapDelay > 0) {
                                setTimeout(doSwap, swapSpec.swapDelay)
                            } else {
                                doSwap();
                            }
                        }
                    } else {
                        triggerErrorEvent(elt, 'responseError.htmx', eventDetail);
                    }
                } catch (e) {
                    eventDetail['exception'] = e;
                    triggerErrorEvent(elt, 'onLoadError.htmx', eventDetail);
                    throw e;
                } finally {
                    removeRequestIndicatorClasses(elt);
                    triggerErrorEvent(elt, 'afterRequest.htmx', eventDetail);
                    triggerEvent(elt, 'afterOnLoad.htmx', eventDetail);
                    endRequestLock();
                }
            }
            xhr.onerror = function () {
                removeRequestIndicatorClasses(elt);
                triggerErrorEvent(elt, 'afterRequest.htmx', eventDetail);
                triggerErrorEvent(elt, 'sendError.htmx', eventDetail);
                endRequestLock();
            }
            if(!triggerEvent(elt, 'beforeRequest.htmx', eventDetail)) return endRequestLock();
            addRequestIndicatorClasses(elt);
            xhr.send(verb === 'get' ? null : encodeParamsForBody(xhr, elt, filteredParameters));
        }

        //====================================================================
        // Extensions API
        //====================================================================
        var extensions = {};
        function extensionBase() {
            return {
                onEvent : function(name, evt) {return true;},
                transformResponse : function(text, xhr, elt) {return text;},
                handleSwap : function(swapStyle, target, fragment, settleInfo) {return false;},
                encodeParameters : function(xhr, parameters, elt) {return null;}
            }
        }

        function defineExtension(name, extension) {
            extensions[name] = mergeObjects(extensionBase(), extension);
        }

        function removeExtension(name) {
            delete extensions[name];
        }

        function getExtensions(elt, extensionsToReturn) {
            if (elt == null) {
                return extensionsToReturn;
            }
            if (extensionsToReturn == null) {
                extensionsToReturn = [];
            }
            var extensionsForElement = getAttributeValue(elt, "hx-ext");
            if (extensionsForElement) {
                forEach(extensionsForElement.split(","), function(extensionName){
                    extensionName = extensionName.replace(/ /g, '');
                    var extension = extensions[extensionName];
                    if (extension && !extensionsToReturn.includes(extension)) {
                        extensionsToReturn.push(extension);
                    }
                });
            }
            return getExtensions(parentElt(elt), extensionsToReturn);
        }

        //====================================================================
        // Initialization
        //====================================================================

        function ready(fn) {
            if (getDocument().readyState !== 'loading') {
                fn();
            } else {
                getDocument().addEventListener('DOMContentLoaded', fn);
            }
        }

        // insert htmx-indicator css rules immediate, if not configured otherwise
        (function() {
            var metaConfig = getMetaConfig();
            if (metaConfig === null || metaConfig.includeIndicatorStyles !== false) {
                getDocument().head.insertAdjacentHTML("beforeend",
                    "<style>\
                      .htmx-indicator{opacity:0;transition: opacity 200ms ease-in;}\
                      .htmx-request .htmx-indicator{opacity:1}\
                      .htmx-request.htmx-indicator{opacity:1}\
                    </style>");
            }
        })();

        function getMetaConfig() {
            var element = getDocument().querySelector('meta[name="htmx-config"]');
            if (element) {
                return JSON.parse(element.content);
            } else {
                return null;
            }
        }

        function mergeMetaConfig() {
            var metaConfig = getMetaConfig();
            if (metaConfig) {
                htmx.config = mergeObjects(htmx.config , metaConfig)
            }
        }

        // initialize the document
        ready(function () {
            mergeMetaConfig();
            var body = getDocument().body;
            processNode(body);
            triggerEvent(body, 'load.htmx', {});
            window.onpopstate = function () {
                restoreHistory();
            };
        })

        // Public API
        return {
            onLoad: onLoadHelper,
            process: processNode,
            on: addEventListenerImpl,
            off: removeEventListenerImpl,
            trigger : triggerEvent,
            find : find,
            findAll : findAll,
            closest : closest,
            remove : removeElement,
            addClass : addClassToElement,
            removeClass : removeClassFromElement,
            toggleClass : toggleClassOnElement,
            takeClass : takeClassForElement,
            defineExtension : defineExtension,
            removeExtension : removeExtension,
            logAll : logAll,
            logger : null,
            config : {
                historyEnabled:true,
                historyCacheSize:10,
                defaultSwapStyle:'innerHTML',
                defaultSwapDelay:0,
                defaultSettleDelay:100,
                includeIndicatorStyles:true
            },
            _:internalEval
        }
    }
)();
