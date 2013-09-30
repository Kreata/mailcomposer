# Mail Composer

`mailcomposer` allows you to generate and stream multipart mime messages.

## Usage

### Volo

Install with [volo](http://volojs.org/):

    volo add Kreata/mailcomposer/v0.1.0

### AMD

Require [mailcomposer.js](mailcomposer.js) as `mailcomposer`

## API

Create `mailcomposer` object with:

```javascript
var composer = mailcomposer();
```

## Methods

### setHeader

Sets a header value for the specified key. If previous value with the same key exists, it is overwritten.
If you want to set multiple values for the same key, use an array as the value. Values are inserted
"as is", if the value includes unicode symbols or is not properly formatted, use `encodeHeaderValue`
before inserting the data.

    composer.setHeader(key, value)

  * **key** - Header key
  * **value** - Either a string value or an array of string values for the key

For example:

    composer.setHeader("x-mailer", "my awesome mailer")

### encodeHeaderValue

Encodes and formats header values. Needed especially when unicode symbols are used.
Also properly encodes e-mail addresses (names, unicde domain names etc.)

    composer.encodeHeaderValue(key, value) -> String

  * **key** - Header key
  * **value** - Header value, usually string but some keys also accept arrays (`to`, `cc`, `references`)

For example

    composer.encodeHeaderValue("To", ["Õnne Mäger <onne.mager@õnnemäger.ee>"])

returns the following string:

    "=?UTF-8?Q?=C3=95nne_M=C3=A4ger?=" <onne.mager@xn--nnemger-8wa2m.ee>

### setText

Set the plaintext body of the message. Unicode strings are allowed.

    composer.setText(text)

  * **text** - plaintext body

For example:

    composer.setText("Hello world!\r\nYours faithfully\r\nSender");


### setHtml

Set the HTML body of the message. Unicode strings are allowed.

    composer.setHtml(html)

  * **html** - HTML body

For example:

    composer.setHtml("<p>Hello world!</p> <p>Yours faithfully<br/>Sender</p>");

### addAttachment

Adds an attachment to the message. Can be called several times.
For embedded images, use `contentId` property

    composer.addAttachment(attachment)

  * **attachment** - Attachment object

Attachment object has the following options:

  * **contentDisposition** optional, defaults to `"attachment"`
  * **contentId** - optional, use with embedded images (`cid:` urls)
  * **contentType** - optional, if not set will be detected by `fileName`
  * **fileName** - optional file name
  * **content** - either a string or an arraybuffer (Uint8Array)

For example:

    composer.addAttachment({
        content: "hello world!"
    });

or

    composer.addAttachment({
        contentDisposition: "attachment",
        contentId: "mytest@firemail",
        contentType: "text/plain",
        fileName: "test.txt",
        content: "hello world!"
    });


### stream

Run after the message has been set up. Starts streaming of the message.

    composer.stream()

### suspend

Suspends emitting any more `ondata` events until resumed. Use this when
writing to downstream returns false.

    composer.suspend()

### resume

Resumes suspended `ondata` events. Use this when downstream emits `ondrain`

    composer.resume()

## Data events

Once a message has been set up and streaming starts, the following events are emitted:

  * **ondata** `(chunk)`  - Emits an 7bit ASCII string (actually still unicode, but only 7bit symbols are used) for pipeing to SMTP
  * **onend** - the entire message has been generated

## Tests

Download `mailcomposer` source and install dependencies

```bash
git clone git@github.com:Kreata/mailcomposer.git
cd mailcomposer
volo install
```

Tests are handled by QUnit. Open [testrunner.html](tests/testrunner.html) to run the tests.

## License

**MIT**

