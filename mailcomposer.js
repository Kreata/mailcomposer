// Copyright (c) 2013 Andris Reinman
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// AMD shim
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([
            "../mimefuncs",
            "../mimetypes/mimetypes",
            "../punycode",
            "../addressparser"
            ], factory);
    } else {
        root.mailcomposer = factory(mimefuncs, mimetypes, punycode, addressparser);
    }
}(this, function(mimefuncs, mimetypes, punycode, addressparser) {

    "use strict";

    /**
     * Generates and streams a RFC2822 compatible (multipart) e-mail
     *
     * @constructor
     */
    function MailComposer(){
        this._headers = {order:[], values:{}};

        /**
         * Stores message body values (plaintext and html)
         */
        this._body = {};

        /**
         * An array of attachments not related to the HTML body
         */
        this._unrelatedAttachments = [];

        /**
         * An array of attachments related to the HTML body (have contentId set)
         */
        this._relatedAttachments = [];

        /**
         * Timestamp is used for creating randomness in boundaries
         */
        this._startTime = Date.now(); // needed for generating boundaries

        /**
         * Should data events be fired or not
         */
        this._suspended = false;

        /**
         * Ensure default MIME header is set
         */
        this.setHeader("MIME-Version", "1.0");
    }

    // EVENTS

    // Event functions should be overriden, these are just placeholders

    /**
     * Chunk of data is emitted to be passed on to SMTP
     *
     * @param {String} chunk 7bit string
     */
    MailComposer.prototype.ondata = function(chunk){};

    /**
     * Indicates that there is nothing left to be sent
     */
    MailComposer.prototype.onend = function(){};

    // PUBLIC METHODS

    /**
     * Sets and header to the message. Overwrites previous values with the
     * same key. To use several values for the same key, use an array as the value
     *
     * @param {String} key Header field name
     * @param {String|Array} key Header field value
     */
    MailComposer.prototype.setHeader = function(key, value){
        value = [].concat(value || []).reverse().map(function(val){
            return (val || "").toString().replace(/\r?\n|\r/g, " "); // no newlines allowed
        });

        key = (key || "").toString().replace(/\r?\n|\r/g, " ").trim().toLowerCase().replace(/^MIME\b|^[a-z]|\-[a-z]/ig, function(c){
            return c.toUpperCase();
        });

        if(this._headers.order.indexOf(key) < 0){
            this._headers.order.unshift(key);
        }

        this._headers.values[key] = value;
    };

    /**
     * Encodes a header value. Needed before passing data to setHeader if the data
     * is not correctly formatted, includes unicode symbols etc.
     *
     * @param {String} key
     * @param {String|Array} value A string or an array (for address lists etc)
     */
    MailComposer.prototype.encodeHeaderValue = function(key, value){
        key = (key || "").toString().replace(/\r?\n|\r/g, " ").toLowerCase().trim();

        var addresses;

        switch(key){
            case "from":
            case "sender":
            case "to":
            case "cc":
            case "bcc":
            case "reply-to":
                addresses = [].concat.apply([], [].concat(value).map(addressparser.parse));
                return this._convertAddresses(addresses);

            case "message-id":
            case "in-reply-to":
                value = (value || "").toString().replace(/\r?\n|\r/g, " ");

                if(value.charAt(0)!="<"){
                    value = "<"+value;
                }

                if(value.charAt(value.length-1)!=">"){
                    value = value + ">";
                }
                return value;

            case "references":
                value = [].concat.apply([], [].concat(value || "").map(function(elm){
                        elm = (elm || "").toString().replace(/\r?\n|\r/g, " ").trim();
                        return elm.replace(/<[^>]*>/g,function(str){
                            return str.replace(/\s/g, "");
                        }).split(/\s+/);
                    })).map(function(elm){
                        if(elm.charAt(0) != "<"){
                            elm = "<" + elm;
                        }
                        if(elm.charAt(elm.length-1) != ">"){
                            elm = elm + ">";
                        }
                        return elm;
                    });

                return value.join(" ").trim();

            default:
                value = (value || "").toString().replace(/\r?\n|\r/g, " ");
                return mimefuncs.mimeWordsEncode(value, "Q");
        }

        return value;
    };

    /**
     * Defines plaintext body of the message
     *
     * @param {String} text Plaintext body of the message
     */
    MailComposer.prototype.setText = function(text){
        this._body.text = (text || "").toString();
    };

    /**
     * Defines HTML body of the message
     *
     * @param {String} html HTML body of the message
     */
    MailComposer.prototype.setHtml = function(html){
        this._body.html = (html || "").toString();
    };

    /**
     * Adds an attachment to the message. Can be called several times.
     * For embedded images, use contentId property
     *
     * @param {Object} attachment Attachment object
     * @param {String} [attachment.contentDisposition="attachment"]
     * @param {String} [attachment.contentId]
     * @param {String} [attachment.contentType]
     * @param {String} [attachment.fileName]
     * @param {String|Uint8Array} attachment.content
     */
    MailComposer.prototype.addAttachment = function(attachment){
        if(attachment.contentId){
            this._relatedAttachments.push(attachment);
        }else{
            this._unrelatedAttachments.push(attachment);
        }
    };

    /**
     * Suspends `data` events
     */
    MailComposer.prototype.suspend = function(){
        this._suspended = true;
    };

    /**
     * Resumes `data` events
     */
    MailComposer.prototype.resume = function(){
        if(!this._suspended){
            return;
        }
        var callback = this._suspended;
        this._suspended = false;
        if(callback && typeof callback == "function"){
            callback();
        }
    };

    /**
     * Generates an envelope to be used with SMTP, based on the submitted
     * header fields
     *
     * @return {Object} An envelope in the form of {from: [], to:[]}
     */
    MailComposer.prototype.getEnvelope = function(){
        var senderFields = ["Sender", "From"],
            recipientFields = ["To", "Cc", "Bcc"],
            senderAddress, recipientAddresses = [];

        senderFields.forEach((function(key){
            if(senderAddress){
                return;
            }
            if(this._headers.values[key]){
                [].concat(this._headers.values[key]).forEach(function(value){
                    addressparser.parse(value).forEach(function(address){
                        if(address.group){
                            address.group.forEach(function(address){
                                if(!senderAddress && address.address){
                                    senderAddress = address.address;
                                }
                            });
                        }else{
                            if(!senderAddress && address.address){
                                senderAddress = address.address;
                            }
                        }
                    });
                });
            }
        }).bind(this));

        recipientFields.forEach((function(key){
            if(this._headers.values[key]){
                [].concat(this._headers.values[key]).forEach(function(value){
                    addressparser.parse(value).forEach(function(address){
                        if(address.group){
                            address.group.forEach(function(address){
                                if(address.address && recipientAddresses.indexOf(address.address) < 0){
                                    recipientAddresses.push(address.address);
                                }
                            });
                        }else if(address.address && recipientAddresses.indexOf(address.address) < 0){
                            recipientAddresses.push(address.address);
                        }
                    });
                });
            }
        }).bind(this));

        return {
            from: senderAddress || null,
            to: recipientAddresses
        };
    };

    /**
     * Streams the message with ondata and onend calls
     */
    MailComposer.prototype.stream = function(){

        if(this._suspended){
            this._suspended = this.stream.bind(this);
            return;
        }

        var i = 0,
            flatBodyTree = this._flattenBodyTree(),
            headers = this._generateHeader();

        var processBodyParts = (function(){
            if(i >= flatBodyTree.length){
                return this.onend();
            }

            var bodyPart = flatBodyTree[i++];
            this._processBodyPart(bodyPart, processBodyParts);
        }).bind(this);

        if(headers){
            this.ondata(headers + "\r\n");
        }

        processBodyParts();
    };

    // PRIVATE METHODS

    /**
     * Helper function to create a boundary string for multipart messages
     *
     * @param {Number} nr Nesting level number to separate different boundaries
     * @return {String} Multi part boundary string
     */
    MailComposer.prototype._generateBoundary = function(nr){
        return "----firemail-?=_" + nr + "-" + this._startTime;
    };

    /**
     * Generates message header. This does not include all header values,
     * as content-type is set later depending on the structure of the message
     *
     * @return {String} RFC2822 header
     */
    MailComposer.prototype._generateHeader = function(){
        var headerLines = [];
        this._headers.order.forEach((function(key){
            if(key == "Bcc"){
                // Do not include Bcc addresses in the header
                return;
            }
            this._headers.values[key].forEach((function(value){
                headerLines.push(mimefuncs.foldLines(key + ": " + value, 76));
            }).bind(this));
        }).bind(this));
        return headerLines.join("\r\n");
    };

    /**
     * Generates a tree representing the structure of the message.
     * Subbranches are listed in childNodes (array) property
     *
     * @return {Object} Object tree defining the structure of the message
     */
    MailComposer.prototype._buildBodyTree = function(){
        return this._buildMixedNode();
    };

    /**
     * Generates a plaintext node for the message tree
     *
     * @return {Object} Message part
     */
    MailComposer.prototype._buildTextNode = function(){
        var node = {
            contentType: "text/plain",
            content: "text"
        };
        return node;
    };

    /**
     * Generates a html node for the message tree. If related
     * attachments are foud, this is converted to multipart/related object
     *
     * @return {Object} Message part
     */
    MailComposer.prototype._buildHTMLNode = function(){
        var node = {};

        if(!this._relatedAttachments.length){
            return {
                contentType: "text/html",
                content: "html"
            };
        }

        node = {
            contentType: "multipart/related",
            multipart: true,
            childNodes: []
        };

        node.childNodes.push({
            contentType: "text/html",
            content: "html"
        });

        this._relatedAttachments.forEach(function(attachment){
            node.childNodes.push({
                attachment: attachment
            });
        });

        return node;
    };

    /**
     * Generates a branch node for alternative content
     *
     * @return {Object} Message part
     */
    MailComposer.prototype._buildAlternative = function(){
        var node = {
            contentType: "multipart/alternative",
            multipart: true,
            childNodes: []
        };

        if(this._body.text){
            node.childNodes.push(this._buildTextNode());
        }

        if(this._body.html){
            node.childNodes.push(this._buildHTMLNode());
        }

        if(!node.childNodes.length){
            return false;
        }

        if(node.childNodes.length == 1){
            return node.childNodes.shift();
        }

        return node;
    };

    /**
     * Generates a branch node for multipart content
     *
     * @return {Object} Message part
     */
    MailComposer.prototype._buildMixedNode = function(){
        var node = {
            contentType: "multipart/mixed",
            multipart: true,
            childNodes: []
        };

        if(this._body.text && this._body.html){
            node.childNodes.push(this._buildAlternative());
        }else if(this._body.text){
            node.childNodes.push(this._buildTextNode());
        }else if(this._body.html){
            node.childNodes.push(this._buildHTMLNode());
        }

        this._unrelatedAttachments.forEach(function(attachment){
            node.childNodes.push({
                attachment: attachment
            });
        });

        if(!this._body.html){
            this._relatedAttachments.forEach(function(attachment){
                node.childNodes.push({
                    attachment: attachment
                });
            });
        }

        if(!node.childNodes.length){
            return false;
        }

        if(node.childNodes.length == 1){
            return node.childNodes.shift();
        }

        return node;
    };

    /**
     * Uses the structured content tree to create a single array of
     * message parts that can be processed and streamed separately,
     * one by one.
     *
     * @return {Array} An array of message parts
     */
    MailComposer.prototype._flattenBodyTree = function(){
        var flatTree = [];

        var walkNode = function(node, lastBoundary){
            var flatNode = {
                boundary: lastBoundary
            };

            Object.keys(node).forEach(function(key){
                if(key != "childNodes"){
                    flatNode[key] = node[key];
                }
            });

            flatTree.push(flatNode);

            if(node.childNodes){
                flatNode.boundaryOpen = ++lastBoundary;
                node.childNodes.forEach(function(childNode){
                    walkNode(childNode, lastBoundary);
                });
                flatTree.push({boundaryClose: flatNode.boundaryOpen});
            }
        };

        walkNode(this._buildMixedNode(), 0);

        return flatTree;
    };

    /**
     * Processes single part of the multipart message. Generates headers
     * and streams the content.
     *
     * @param {Object} bodyPart Single part of the multipart message
     * @param {Function} callback Callback function to run, once the part has been processed
     */
    MailComposer.prototype._processBodyPart = function(bodyPart, callback){

        if(this._suspended){
            this._suspended = this._processBodyPart.bind(this, bodyPart, callback);
            return;
        }

        bodyPart.headers = bodyPart.headers || {};

        var headerLines = [];

        if(bodyPart.contentType){
            bodyPart.headers["Content-Type"] = bodyPart.contentType;
        }

        if(bodyPart.boundary){
            headerLines.push("--" + this._generateBoundary(bodyPart.boundary));
        }

        if(bodyPart.boundaryOpen){
            bodyPart.headers["Content-Type"] += "; boundary=\""+this._generateBoundary(bodyPart.boundaryOpen) + "\"";
        }

        // this function needs to be declared in case of the stream is suspended
        // and a pointer is needed to continue when resumed
        var streamBodyCallback = function(bodyPart){

            if(this._suspended){
                this._suspended = streamBodyCallback.bind(this, bodyPart);
                return;
            }

            if(bodyPart.boundaryClose){
                this.ondata("--"+this._generateBoundary(bodyPart.boundaryClose) + "--" + (bodyPart.boundaryClose > 1 ? "\r\n\r\n": ""));
            }

            return callback();
        };

        // this function needs to be declared in case of the stream is suspended
        // and a pointer is needed to continue when resumed
        var prepareHeadersCallback = function(bodyPart, headerLines){

            if(this._suspended){
                this._suspended = prepareHeadersCallback.bind(this, bodyPart, headerLines);
                return;
            }

            Object.keys(bodyPart.headers).forEach(function(key){
                headerLines.push(mimefuncs.foldLines(key + ": " + bodyPart.headers[key], 76));
            });

            this.ondata(headerLines.join("\r\n") + (headerLines.length ? "\r\n\r\n" : ""));

            this._streamBody(bodyPart, streamBodyCallback.bind(this, bodyPart));

        };

        this._prepareHeaders(bodyPart, prepareHeadersCallback.bind(this, bodyPart, headerLines));
    };

    /**
     * Prepares headers for different parts of the multipart message.
     * Headers will be prepared before this part will be streamed to client
     *
     * @param {Object} bodyPart Single part of the multipart message
     * @param {Function} callback Callback function to run, once the headers have been prepared
     */
    MailComposer.prototype._prepareHeaders = function(bodyPart, callback){
        if(bodyPart.content == "text"){
            return this._prepareTextPart(bodyPart, callback);
        }

        if(bodyPart.content == "html"){
            return this._prepareHTMLPart(bodyPart, callback);
        }

        if(bodyPart.attachment){
            return this._prepareAttachment(bodyPart, callback);
        }

        return callback();
    };

    /**
     * Prepares headers for plaintext part of the multipart message,
     *
     * @param {Object} bodyPart Plaintext part of the multipart message
     * @param {Function} callback Callback function to run, once the headers have been prepared
     */
    MailComposer.prototype._prepareTextPart = function(bodyPart, callback){

        if(!this._body.text.match(/[\u0080-\uFFFF]/)){
            bodyPart.headers["Content-Type"] += "; format=flowed";
            bodyPart.flowed = true;
        }else{
            bodyPart.headers["Content-Type"] += "; charset=utf-8";
            bodyPart.headers["Content-Transfer-Encoding"] = "quoted-printable";
            bodyPart.quotedPrintable = true;
        }

        return callback();
    };

    /**
     * Prepares headers for HTML part of the multipart message
     *
     * @param {Object} bodyPart HTML part of the multipart message
     * @param {Function} callback Callback function to run, once the headers have been prepared
     */
    MailComposer.prototype._prepareHTMLPart = function(bodyPart, callback){
        if(!this._body.html.match(/[\u0080-\uFFFF]/)){
            bodyPart.headers["Content-Type"] += "; format=flowed";
            bodyPart.flowed = true;
        }else{
            bodyPart.headers["Content-Type"] += "; charset=utf-8";
            bodyPart.headers["Content-Transfer-Encoding"] = "quoted-printable";
            bodyPart.quotedPrintable = true;
        }

        return callback();
    };

    /**
     * Prepares headers for an attachment of the multipart message
     *
     * @param {Object} bodyPart Attachment
     * @param {Function} callback Callback function to run, once the headers have been prepared
     */
    MailComposer.prototype._prepareAttachment = function(bodyPart, callback){
        var fileName;

        if(bodyPart.attachment.contentId){
            bodyPart.headers["Content-Id"] = bodyPart.attachment.contentId;
        }

        if(bodyPart.attachment.fileName && !bodyPart.attachment.contentType){
            bodyPart.attachment.contentType = mimetypes.detectMimeType(bodyPart.attachment.fileName.split(".").pop());
        }

        if(bodyPart.attachment.contentType){
            bodyPart.headers["Content-Type"] = bodyPart.attachment.contentType;
        }else{
            bodyPart.headers["Content-Type"] = "application/octet-stream";
        }

        bodyPart.headers["Content-Transfer-Encoding"] = "base64";
        bodyPart.headers["Content-Disposition"] = bodyPart.attachment.contentDisposition || "attachment";

        if(bodyPart.attachment.fileName){
            fileName = mimefuncs.mimeWordsEncode(bodyPart.attachment.fileName, "Q");
            bodyPart.headers["Content-Type"] += "; name=\"" + fileName + "\"";
            bodyPart.headers["Content-Disposition"] += "; filename=\"" + fileName + "\"";
        }

        return callback();
    };

    /**
     * Streams different parts of the multipart message. Will be called after
     * the headers are prepared.
     *
     * @param {Object} bodyPart Single part of the multipart message
     * @param {Function} callback Callback function to run, once the data has been streamed
     */
    MailComposer.prototype._streamBody = function(bodyPart, callback){

        if(bodyPart.content == "text"){
            return this._streamText(bodyPart, callback);
        }

        if(bodyPart.content == "html"){
            return this._streamHTML(bodyPart, callback);
        }

        if(bodyPart.attachment){
            return this._streamAttachment(bodyPart, callback);
        }

        return callback();
    };

    /**
     * Streams plaintext part of the multipart message. Will be called after
     * the headers are prepared.
     *
     * @param {Object} bodyPart Single part of the multipart message
     * @param {Function} callback Callback function to run, once the data has been streamed
     */
    MailComposer.prototype._streamText = function(bodyPart, callback){

        if(this._suspended){
            this._suspended = this._streamText.bind(this, bodyPart, callback);
            return;
        }

        if(bodyPart.flowed){
            this.ondata(mimefuncs.foldLines(
                this._body.text.
                    // space stuffing http://tools.ietf.org/html/rfc3676#section-4.2
                    replace(/^( |From|>)/igm, " $1"),
                76, true) + "\r\n");
        }else if(bodyPart.quotedPrintable){
            this.ondata(mimefuncs.quotedPrintableEncode(this._body.text) + "\r\n");
        }

        return callback();
    };

    /**
     * Streams HTML part of the multipart message. Will be called after
     * the headers are prepared.
     *
     * @param {Object} bodyPart Single part of the multipart message
     * @param {Function} callback Callback function to run, once the data has been streamed
     */
    MailComposer.prototype._streamHTML = function(bodyPart, callback){

        if(this._suspended){
            this._suspended = this._streamHTML.bind(this, bodyPart, callback);
            return;
        }

        if(bodyPart.flowed){
            this.ondata(mimefuncs.foldLines(this._body.html, 76, true) + "\r\n");
        }else if(bodyPart.quotedPrintable){
            this.ondata(mimefuncs.quotedPrintableEncode(this._body.html) + "\r\n");
        }

        return callback();
    };

    /**
     * Streams an attachment. Will be called after the headers are prepared.
     *
     * @param {Object} bodyPart Single part of the multipart message
     * @param {Function} callback Callback function to run, once the data has been streamed
     */
    MailComposer.prototype._streamAttachment = function(bodyPart, callback){

        // TODO: this function should be able to actually stream a file if a
        //       file pointer is given. Currently it only takes a string or
        //       an Uint8Array, converts it to base64 and spits out.
        //       I haven't found a way for decent file streaming yet,
        //       I can use a FileReader + onprogress events to check newly loaded
        //       data but this does not have too much sense as I can't pause
        //       the stream and the entire contents of the file are buffered
        //       as a result.

        if(this._suspended){
            this._suspended = this._streamAttachment.bind(this, bodyPart, callback);
            return;
        }

        this.ondata(mimefuncs.base64Encode(bodyPart.attachment.content, typeof bodyPart.attachment.content == "object" && "binary" || false) + "\r\n");

        return callback();
    };

    /**
     * Handles a list of parsed e-mail addresses, checks encoding etc.
     *
     * @param {Array} value A list or single e-mail address {address:'...', name:'...'}
     * @return {String} Comma separated and encoded list of addresses
     */
    MailComposer.prototype._convertAddresses = function(addresses){
        var values = [];

        addresses.forEach((function(address){
            if(address.address){
                address.address = address.address.replace(/^.*?(?=\@)/, function(user){
                    return mimefuncs.mimeWordsEncode(user, "Q");
                }).replace(/@.+$/, function(domain){
                    return "@" + punycode.toASCII(domain.substr(1));
                });

                if(!address.name){
                    values.push(address.address);
                }else if(address.name){
                    address.name = mimefuncs.mimeWordsEncode(address.name, "Q");
                    values.push('"' + address.name+'" <'+address.address+'>');
                }
            }else if(address.group){
                values.push(address.name + ":" + (address.group.length?this._convertAddresses(address.group):"").trim() + ";");
            }
        }).bind(this));

        return values.join(", ");
    };

    return function(){
        return new MailComposer();
    };
}));
