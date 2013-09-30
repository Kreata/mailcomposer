
test("Create mailcomposer object", function(){
    var mc = mailcomposer();
    ok(true, mc instanceof mailcomposer);
});

test("bodyTree: plaintext", function(){
    var mc = mailcomposer();
    mc.setText("test");
    deepEqual(mc._buildBodyTree(), {"contentType":"text/plain","content":"text"});
});

test("bodyTree: html", function(){
    var mc = mailcomposer();
    mc.setHtml("html");
    deepEqual(mc._buildBodyTree(), {"contentType":"text/html","content":"html"});
});

test("bodyTree: attachment", function(){
    var mc = mailcomposer();
    mc.addAttachment({content: "test"});
    deepEqual(mc._buildBodyTree(), {"attachment":{"content":"test"}});
});

test("bodyTree: plaintext and html", function(){
    var mc = mailcomposer();
    mc.setHtml("html");
    mc.setText("test");
    deepEqual(mc._buildBodyTree(), {"contentType":"multipart/alternative","multipart":true,"childNodes":[{"contentType":"text/plain","content":"text"},{"contentType":"text/html","content":"html"}]});
});

test("bodyTree: plaintext and attachment", function(){
    var mc = mailcomposer();
    mc.setText("test");
    mc.addAttachment({content: "test"});
    deepEqual(mc._buildBodyTree(), {"contentType":"multipart/mixed","multipart":true,"childNodes":[{"contentType":"text/plain","content":"text"},{"attachment":{"content":"test"}}]});
});

test("bodyTree: plaintext and several attachments", function(){
    var mc = mailcomposer();
    mc.setText("test");
    mc.addAttachment({content: "test1"});
    mc.addAttachment({content: "test2"});
    mc.addAttachment({content: "test3"});
    deepEqual(mc._buildBodyTree(), {"contentType":"multipart/mixed","multipart":true,"childNodes":[{"contentType":"text/plain","content":"text"},{"attachment":{"content":"test1"}},{"attachment":{"content":"test2"}},{"attachment":{"content":"test3"}}]});
});

test("bodyTree: plaintext and cid attachment", function(){
    var mc = mailcomposer();
    mc.setText("test");
    mc.addAttachment({content: "test", contentId: "test"});
    deepEqual(mc._buildBodyTree(), {"contentType":"multipart/mixed","multipart":true,"childNodes":[{"contentType":"text/plain","content":"text"},{"attachment":{"content":"test", "contentId": "test"}}]});
});

test("bodyTree: plaintext and attachment and cid attachment", function(){
    var mc = mailcomposer();
    mc.setText("test");
    mc.addAttachment({content: "test"});
    mc.addAttachment({content: "test", contentId: "test"});
    deepEqual(mc._buildBodyTree(), {"contentType":"multipart/mixed","multipart":true,"childNodes":[{"contentType":"text/plain","content":"text"},{"attachment":{"content":"test"}},{"attachment":{"content":"test", "contentId": "test"}}]});
});

test("bodyTree: html and attachment", function(){
    var mc = mailcomposer();
    mc.setHtml("test");
    mc.addAttachment({content: "test"});
    deepEqual(mc._buildBodyTree(), {"contentType":"multipart/mixed","multipart":true,"childNodes":[{"contentType":"text/html","content":"html"},{"attachment":{"content":"test"}}]});
});

test("bodyTree: html and cid attachment", function(){
    var mc = mailcomposer();
    mc.setHtml("test");
    mc.addAttachment({content: "test", contentId: "test"});
    deepEqual(mc._buildBodyTree(), {"contentType":"multipart/related","multipart":true,"childNodes":[{"contentType":"text/html","content":"html"},{"attachment":{"content":"test","contentId":"test"}}]});
});

test("bodyTree: html and attachment and cid attachment", function(){
    var mc = mailcomposer();
    mc.setHtml("test");
    mc.addAttachment({content: "test"});
    mc.addAttachment({content: "test", contentId: "test"});
    deepEqual(mc._buildBodyTree(), {"contentType":"multipart/mixed","multipart":true,"childNodes":[{"contentType":"multipart/related","multipart":true,"childNodes":[{"contentType":"text/html","content":"html"},{"attachment":{"content":"test","contentId":"test"}}]},{"attachment":{"content":"test"}}]});
});

test("bodyTree: plaintext and html and attachment", function(){
    var mc = mailcomposer();
    mc.setText("test");
    mc.setHtml("test");
    mc.addAttachment({content: "test"});
    deepEqual(mc._buildBodyTree(), {"contentType":"multipart/mixed","multipart":true,"childNodes":[{"contentType":"multipart/alternative","multipart":true,"childNodes":[{"contentType":"text/plain","content":"text"},{"contentType":"text/html","content":"html"}]},{"attachment":{"content":"test"}}]});
});

test("bodyTree: plaintext and html and cid attachment", function(){
    var mc = mailcomposer();
    mc.setText("test");
    mc.setHtml("test");
    mc.addAttachment({content: "test", contentId: "test"});
    deepEqual(mc._buildBodyTree(), {"contentType":"multipart/alternative","multipart":true,"childNodes":[{"contentType":"text/plain","content":"text"},{"contentType":"multipart/related","multipart":true,"childNodes":[{"contentType":"text/html","content":"html"},{"attachment":{"content":"test","contentId":"test"}}]}]});
});

test("bodyTree: plaintext and html and attachment and cid attachment", function(){
    var mc = mailcomposer();
    mc.setText("test");
    mc.setHtml("test");
    mc.addAttachment({content: "test"});
    mc.addAttachment({content: "test", contentId: "test"});
    deepEqual(mc._buildBodyTree(), {"contentType":"multipart/mixed","multipart":true,"childNodes":[{"contentType":"multipart/alternative","multipart":true,"childNodes":[{"contentType":"text/plain","content":"text"},{"contentType":"multipart/related","multipart":true,"childNodes":[{"contentType":"text/html","content":"html"},{"attachment":{"content":"test","contentId":"test"}}]}]},{"attachment":{"content":"test"}}]});
});

test("flattenBodyTree", function(test){
    var mc = mailcomposer();
    mc.setText("test");
    mc.setHtml("test");
    mc.addAttachment({content: "test"});
    mc.addAttachment({content: "test", contentId: "test"});
    deepEqual(mc._flattenBodyTree(), [{"boundary":0,"contentType":"multipart/mixed","multipart":true,"boundaryOpen":1},{"boundary":1,"contentType":"multipart/alternative","multipart":true,"boundaryOpen":2},{"boundary":2,"contentType":"text/plain","content":"text"},{"boundary":2,"contentType":"multipart/related","multipart":true,"boundaryOpen":3},{"boundary":3,"contentType":"text/html","content":"html"},{"boundary":3,"attachment":{"content":"test","contentId":"test"}},{"boundaryClose":3},{"boundaryClose":2},{"boundary":1,"attachment":{"content":"test"}},{"boundaryClose":1}]);
});

asyncTest("pause and resume", function(){
    var mc = mailcomposer(),
        paused = true;
    mc.setText("test");
    mc.setHtml("test");
    mc.addAttachment({content: "test"});
    mc.addAttachment({content: "test", contentId: "test"});

    expect(19);

    mc.ondata = function(chunk){
        
        // should be called 18x
        ok(!paused);

        mc.suspend();
        paused = true;
        setTimeout(function(){
            paused = false;
            mc.resume();
        }, 20);
    };

    mc.onend = function(){
        ok(1);
        start();
    };

    mc.suspend();
    mc.stream();

    setTimeout(function(){
        paused = false;
        mc.resume();
    }, 20);
});

test("generateHeader", function(){
    var mc = mailcomposer();
    mc.setHeader("test1", "abc");
    mc.setHeader("test2", "def");
    mc.setHeader("test3", "def");
    mc.setHeader("test3", ["ghi", "jkl"]);
    deepEqual(mc._generateHeader(), "Test3: jkl\r\n"+
                                     "Test3: ghi\r\n"+
                                     "Test2: def\r\n"+
                                     "Test1: abc\r\n"+
                                     "MIME-Version: 1.0");
});

test("encodeHeaderValue", function(){
    var mc = mailcomposer();
    equal('"Mati =?UTF-8?Q?J=C3=B5gi?=" <=?UTF-8?Q?mati.j=C3=B5gi?=@xn--matijgi-50a.ee>, "Andris Reinman" <andris@node.ee>, andmekala@hot.ee', mc.encodeHeaderValue("from", ["Mati Jõgi <mati.jõgi@matijõgi.ee>, Andris Reinman <andris@node.ee>", "andmekala@hot.ee"]));
    equal('=?UTF-8?Q?=C3=84ksi_n=C3=B5id_?=teeb tegusid', mc.encodeHeaderValue("subject", "Äksi nõid teeb tegusid"));
    equal('<sssssss>', mc.encodeHeaderValue("in-reply-to", "sssssss"));
    equal('<sssssss>', mc.encodeHeaderValue("in-reply-to", "<sssssss>"));
    equal('<sfdsfds> <sfsfdsfdfs> <wwww> <rrr> <ooo> <qqq> <ddd>', mc.encodeHeaderValue("references", ["sfdsfds", "sfsfdsfdfs", "<wwww>", "<rrr> <ooo>", "qqq ddd"]));
    equal('"=?UTF-8?Q?=C3=95nne_M=C3=A4ger?=" <onne.mager@xn--nnemger-8wa2m.ee>', mc.encodeHeaderValue("To", ["Õnne Mäger <onne.mager@õnnemäger.ee>"]));
});

test("getEnvelope", function(){
    var mc = mailcomposer();
    mc.setHeader("from", "andris1@node.ee, andris2@node.ee");
    mc.setHeader("sender", "andris3@node.ee, andris4@node.ee");
    mc.setHeader("to", "andris5@node.ee, andris6@node.ee, A Group:Chris Jones <c@a.test>,joe@where.test,John <jdoe@one.test>;");
    mc.setHeader("cc", ["andris7@node.ee, andris8@node.ee"]);
    mc.setHeader("bcc", ["andris9@node.ee, andris10@node.ee"]);
    deepEqual(mc.getEnvelope(), {"from":"andris3@node.ee","to":["andris5@node.ee","andris6@node.ee","c@a.test","joe@where.test","jdoe@one.test","andris7@node.ee","andris8@node.ee","andris9@node.ee","andris10@node.ee"]});
});

test("formatGroupAddress", function(){
    var mc = mailcomposer(),
        addresses = mc.encodeHeaderValue("to", "andris5@node.ee, andris6@node.ee, A Group:Chris Jõnes <c@jääger.test>,joe@where.test,John <jdoe@one.test>;, Another Group:;");
    equal(addresses, 'andris5@node.ee, andris6@node.ee, A Group:"Chris =?UTF-8?Q?J=C3=B5nes?=" <c@xn--jger-loaa.test>, joe@where.test, "John" <jdoe@one.test>;, Another Group:;');
});

asyncTest("textFormatFlowed", function(test){
    var inputStr = " a long line that should be stuffed, not sure if it will be but lets see. "+
                   "max line length should be about 76 characters\r\n"+
                   "From should be stuffed\r\n"+
                   "> should be stuffed as well\r\n"+
                   "this line should not be stuffed as it does not begin wither with space, From or >",

        outputStr = "  a long line that should be stuffed, not sure if it will be but lets see. \r\n"+
                    "max line length should be about 76 characters\r\n"+
                    " From should be stuffed\r\n"+
                    " > should be stuffed as well\r\n"+
                    "this line should not be stuffed as it does not begin wither with space, \r\n"+
                    "From or >"+
                    "\r\n"; // not part of folding, added to complete the multipart text

    expect(2);
    var mc = mailcomposer();

    mc._body.text = inputStr;
    mc._suspended = false;
    mc.ondata = function(chunk){
        equal(chunk, outputStr);
    };

    mc._streamText({flowed: true}, function(){
        ok(true);
        start();
    });
});
