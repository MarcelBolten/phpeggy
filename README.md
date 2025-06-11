[![Tests](https://github.com/MarcelBolten/phpeggy/actions/workflows/CI-tests.yml/badge.svg)](https://github.com/MarcelBolten/phpeggy/actions/workflows/CI-tests.yml)
[![npm version](https://img.shields.io/npm/v/phpeggy)](https://www.npmjs.com/package/phpeggy)
[![License](https://img.shields.io/badge/license-mit-blue)](https://opensource.org/licenses/MIT)

- [Migrating from phpegjs](#migrating-from-phpegjs)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
  - [Generating a Parser](#generating-a-parser)
    - [JS API](#js-api)
    - [Command Line](#command-line)
  - [Using the Parser](#using-the-parser)
- [Grammar Syntax and Semantics](#grammar-syntax-and-semantics)
- [Conversion Guide - Peggy action blocks to PHPeggy](#guide-for-converting-peggy-action-blocks-to-phpeggy)

# PHPeggy

A PHP code generation plugin for
[Peggy](https://github.com/peggyjs/peggy).

PHPeggy is the successor of [`phpegjs`](https://github.com/nylen/phpegjs) which had been abandoned by its maintainer.

## Migrating from `phpegjs`

Peggy version [1.x.x](https://github.com/MarcelBolten/phpeggy/tree/1.0.1) is compatible with the most recent phpegjs release. Follow these steps to upgrade:

There are a few API changes compared to the most recent `phpegjs` release.
- Options specific to PHPeggy have to be passed to `phpeggy` and not to `phpegjs`.

Follow these steps to upgrade:

1. Follow the [migration instructions from Peggy](https://github.com/peggyjs/peggy#migrating-from-pegjs).
2. Uninstall `phpegjs`.
3. Replace all `require("phpegjs")` or `import ... from "phpegjs"` with `require("phpeggy")` or `import ... from "phpeggy"` as appropriate.
4. [PHPeggy-specific options](#PHPeggyOptions) are now passed to `phpeggy`:
   ```diff
   var parser = peggy.generate("start = ('a' / 'b')+", {
   -    plugins: [require("phpegjs")],
   +    plugins: [require("phpeggy")],
   -    phpegjs: { /* phpegjs-specific options */ }
   +    phpeggy: { /* phpeggy-specific options */ }
   });
   ```
5. That's it!

## Requirements

* [Peggy](https://peggyjs.org/) (known compatible with version 5)
* PHP version >=8 for the created parser
* `mbstring` extension enabled

## Installation

### Node.js

Install Peggy with PHPeggy plugin

```sh
$ npm install peggy@^5.0.0 phpeggy
```

## Usage

### Generating a Parser

#### JS API

In Node.js, require both the Peggy parser generator and the PHPeggy plugin:

```js
const peggy = require("peggy");
const phpeggy = require("phpeggy");
```

To generate a PHP parser, pass both the PHPeggy plugin and your grammar to
`peggy.generate`:

```js
const parser = peggy.generate("start = ('a' / 'b')+", {
    plugins: [phpeggy]
});
```

The method will return source code of generated parser as a string. Unlike
original Peggy, generated PHP parser will be a class, not a function.

Supported options of `peggy.generate`:

  * `allowedStartRules` — rules the parser will be allowed to start parsing from
    (default: the first rule in the grammar)
  * `cache` — if `true`, makes the parser cache results, avoiding exponential
    parsing time in pathological cases but making the parser slower (default:
    `false`). In case of PHP, this is strongly recommended for big grammars
    (like javascript.pegjs or css.pegjs in example folder)
  * `grammarSource` — this object will be passed to any location() objects as the
    source property (default: undefined). This object will be used even if
    options.grammarSource is redefined in the grammar. It is useful to attach the
    file information to the errors, for example

<a name='PHPeggyOptions'></a>
You can also pass options specific to the PHPeggy plugin as follows:

```js
const parser = peggy.generate("start = ('a' / 'b')+", {
    plugins: [phpeggy],
    phpeggy: { /* phpeggy-specific options */ }
});
```

Here are the options available to pass this way:

  * `parserNamespace` - namespace of generated parser (default: `PHPeggy`). If
    value is `''` or `null`, no namespace will be used.
  * `parserClassName` - name of generated class for parser (default: `Parser`).
  * `header` - you can provide a custom header that will be added at the top of the parser, e.g. `/* My custom header */`.

#### Command Line

To generate a parser from your grammar, use the peggy command:

```bash
npx peggy --plugin /path/to/phpeggy/src/phpeggy.js arithmetics.pegjs
```

The following options might be of interest in the context of PHPeggy:

- `--allowed-start-rules <rules>`
- `--cache`
- `--extra-options <options>`
- `-c, --extra-options-file <file>`
- `-o, --output <file>`
- `-S, --start-rule <rule>`

`--format` is irrelevant as PHPeggy will only provide PHP source code.

Here is a more complex example:

```bash
npx peggy -o arithmeticsParser.php --plugin /path/to/phpeggy/src/phpeggy.js arithmetics.pegjs --cache --extra-option '{ "phpeggy" : { "parserNamespace" : "MyNameSpace", "parserClassName" : "ArithmeticsParser", "header" : "/* My custom header */" } }'
```

A more detailed description of the different options can be found in the [peggy documentation](https://peggyjs.org/documentation.html#generating-a-parser-command-line).

## Using the Parser

1) Save parser generated by `peggy.generate` to a file

2) In PHP code:

```php
include "your.parser.file.php";

try {
    $parser = new PHPeggy\Parser;
    $result = $parser->parse($input);
} catch (PHPeggy\SyntaxError $ex) {
    // Handle parsing error
    // [...]
}
```

You can use the following snippet to format parsing errors:

```php
catch (PHPeggy\SyntaxError $e) {
    $message = "Syntax error: " . $e->getMessage() . " at line " . $e->grammarLine . " column " . $e->grammarColumn . " offset " . $e->grammarOffset;
}
```

Or use SyntaxError->format():

```php
catch (PHPeggy\SyntaxError $e) {
    $errorFormatted = $e->format(array(array("source" => "User input", "text" => $user_input)));
}
```

Which will look similar to:

<!-- eslint-disable-next-line markdown/fenced-code-language -->
```
SyntaxError: Expected "a" but "b" found.
 --> Input string:1:1
  |
1 | b
  | ^
```

Note that the generated PHP parser will call `preg_match_all( '/./us', ... )`
on the input string. This may be undesirable for projects that need to
maintain compatibility with PCRE versions that are missing Unicode support
(WordPress, for example). To avoid this call, split the input string into an
array (one array element per UTF-8 character) and pass this array into
`$parser->parse()` instead of the string input.

## Grammar Syntax and Semantics

See [documentation of Peggy](https://peggyjs.org/documentation.html) with following differences:

* action and predicate blocks should be written in PHP.
* the _per-parse initializer_ code block is used to provide additional methods, properties and constants to the Parser class. A special method `function initialize()` can be provided and resembles the Peggy per-parse initializer i.e. this method is called before the generated parser starts parsing (see [examples/fizzbuzz.pegjs](examples/fizzbuzz.pegjs)). All methods have access to the input (`$this->input`) and the options (`$this->options`).
* the _global initializer_ code block can be used to add use statements, classes, functions, constants, ...
* [Importing External Rules](https://peggyjs.org/documentation.html#importing-external-rules) works only from the Command Line.

Original Peggy rule:

```js
media_list = head:medium tail:("," S* medium)* {
  let result = [head];
  for (let i = 0; i < tail.length; i++) {
    result.push(tail[i][2]);
  }
  return result;
}
```

PHPeggy rule:

```php
media_list = head:medium tail:("," S* medium)* {
  $result = [$head];
  for ($i = 0; $i < \count($tail); $i++) {
    $result[] = $tail[$i][2];
  }
  return $result;
}
```

To target both JavaScript and PHP with a single grammar, you can mix the two
languages using a special comment syntax:

```js
media_list = head:medium tail:("," S* medium)* {
  /** <?php
  $result = [$head];
  for ($i = 0; $i < \count($tail); $i++) {
    $result[] = $tail[$i][2];
  }
  return $result;
  ?> **/

  let result = [head];
  for (let i = 0; i < tail.length; i++) {
    result.push(tail[i][2]);
  }
  return result;
}
```

You can also use the following utility functions in PHP action blocks:

- `chr_unicode($code)` - return character by its UTF-8 code (analogue of
  JavaScript's `String.fromCharCode` function).
- `ord_unicode($code)` - return the UTF-8 code for a character (analogue of
  JavaScript's `String.prototype.charCodeAt(0)` function).

## Guide for converting Peggy action blocks to PHPeggy

| Javascript code                   | PHP analogue                              |
| --------------------------------- | ----------------------------------------- |
| `some_var`                        | `$some_var`                               |
| `{f1: "val1", f2: "val2"}`        | `["f1" => "val1", "f2" => "val2"]`        |
| `["val1", "val2"]`                | `["val1", "val2"]`                        |
| `some_array.push("val")`          | `$some_array[] = "val"`                   |
| `some_array.length`               | `count($some_array)`                      |
| `some_array.join("")`             | `implode("", $some_array)`                |
| `some_array1.concat(some_array2)` | `array_merge($some_array1, $some_array2)` |
| `parseInt("23")`                  | `intval("23")`                            |
| `parseFloat("23.1")`              | `floatval("23.1")`                        |
| `some_str.length`                 | `mb_strlen(some_str, "UTF-8")`            |
| `some_str.replace("b", "\b")`     | `str_replace("b", "\b", $some_str)`       |
| `String.fromCharCode(2323)`       | `chr_unicode(2323)`                       |
| `input`                           | `$this->input`                            |
| `options`                         | `$this->options`                          |
| `error(message, where)`           | `$this->error(message, where)`            |
| `expected(message, where)`        | `$this->expected(message, where)`         |
| `location()`                      | `$this->location()`                       |
| `range()`                         | `$this->range()`                          |
| `offset()`                        | `$this->offset()`                         |
| `text()`                          | `$this->text()`                           |
