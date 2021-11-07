/*
 *   The MIT License (MIT)
 *
 *   Copyright (c) 2014-2021 The PHPeggy AUTHORS
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *   SOFTWARE.
 */
"use strict";

const asts = require("peggy/lib/compiler/asts");
const op = require("../opcodes");
const internalUtils = require("../utils");
const phpeggyVersion = require("../../package.json").version;
const peggyVersion = require("peggy/package.json").version;

/* Generates parser PHP code. */
module.exports = function(ast, options) {
  let phpGlobalNamespacePrefix, phpGlobalNamePrefixOrNamespaceEscaped;
  const phpNamespace = options.phpeggy.parserNamespace;
  const phpParserClass = options.phpeggy.parserClassName;
  if (phpNamespace) {
    phpGlobalNamespacePrefix = "\\";
    // For use within double quoted strings inside generated code, ensure there is a double backslash
    phpGlobalNamePrefixOrNamespaceEscaped = phpNamespace.replace(/\\+/g, "\\\\") + "\\\\";
  } else {
    phpGlobalNamespacePrefix = "";
    phpGlobalNamePrefixOrNamespaceEscaped = "";
  }

  const mbstringAllowed = (
    typeof options.phpeggy.mbstringAllowed === "undefined"
      ? true
      : options.phpeggy.mbstringAllowed
  );

  /* Only indent non-empty lines to avoid trailing whitespace. */
  function indent(numberOfSpaces, code) {
    return code.replace(/^(.+)$/gm, " ".repeat(numberOfSpaces) + "$1");
  }

  function generateTablesDeclaration() {
    function buildLiteral(literal) {
      return internalUtils.quote(literal);
    }

    function buildRegexp(cls) {
      if (cls.ignoreCase && !mbstringAllowed) {
        throw new Error(
          "Case-insensitive character class matching requires the "
          + "`mbstring` PHP extension, but it is disabled "
          + "via `mbstringAllowed: false`."
        );
      }

      let regexp, classIndex;

      if (cls.value.length > 0) {
        regexp = "/^["
          + (cls.inverted ? "^" : "")
          + cls.value.map(part => Array.isArray(part)
            ? internalUtils.quoteForPhpRegexp(part[0])
              + "-"
              + internalUtils.quoteForPhpRegexp(part[1])
            : internalUtils.quoteForPhpRegexp(part)).join("")
          + "]/" + (cls.ignoreCase ? "i" : "");
      } else {
        if (!mbstringAllowed) {
          throw new Error(
            "Empty character class matching requires the "
            + "`mbstring` PHP extension, but it is disabled "
            + "via `mbstringAllowed: false`."
          );
        }
        /*
         * IE considers regexps /[]/ and /[^]/ as syntactically invalid, so we
         * translate them into euqivalents it can handle.
         */
        regexp = cls.inverted ? "/^[\\S\\s]/" : "/^(?!)/";
      }

      if (mbstringAllowed) {
        classIndex = internalUtils.quotePhp(regexp);
      } else {
        const classArray = "["
          + cls.value.map(part => {
            if (!(part instanceof Array)) {
              part = [part, part];
            }
            return "["
              + part[0].charCodeAt(0) + ","
              + part[1].charCodeAt(0) + "]";
          }).join(", ")
          + "]";
        classIndex = classArray;
      }
      return classIndex;
    }

    const literals = ast.literals.map(
      (l, i) => "/** @var string $peg_l" + i + " */\n"
        + "private $peg_l" + i + " = " + buildLiteral(l) + ";"
    );
    const classes = ast.classes.map(
      (c, i) => "/** @var " + (mbstringAllowed ? "string" : "array<int, array<int, int>>") + " $peg_c" + i + " */\n"
        + "private $peg_c" + i + " = " + buildRegexp(c) + ";"
    );
    const expectations = ast.expectations.map(
      (e, i) => {
        if (e.value && e.value.length === 0 && !mbstringAllowed) {
          throw new Error(
            "Empty character class matching requires the "
            + "`mbstring` PHP extension, but it is disabled "
            + "via `mbstringAllowed: false`."
          );
        }
        return "/** @var pegExpectation $peg_e" + i + " */\n"
          + "private $peg_e" + i + ";";
      }
    );

    return [
      ...literals ? literals : [],
      ...classes ? classes : [],
      ...expectations ? expectations : [],
    ].join("\n");
  }

  function generateTablesDefinition() {
    function buildExpectation(e) {
      switch (e.type) {
        case "rule": {
          return 'new pegExpectation("other", ' + internalUtils.quote(e.value) + ")";
        }

        case "literal": {
          return "new pegExpectation("
            + ['"literal",',
              internalUtils.quote(internalUtils.quote(e.value)) + ",",
              internalUtils.quote(e.value) + ",",
              internalUtils.quote(e.ignoreCase.toString())].join(" ")
            + ")";
        }

        case "class": {
          const rawText = "[" + e.value.map(part => {
            if (typeof part === "string") {
              return part;
            }
            return part.join("-");
          }).join("")
          + "]";

          return "new pegExpectation("
            + ['"class",',
              internalUtils.quotePhp(rawText) + ",",
              internalUtils.quotePhp(rawText) + ",",
              internalUtils.quote(e.ignoreCase.toString())].join(" ")
            + ")";
        }

        case "any":
          return 'new pegExpectation("any", "any character")';

        default: throw new Error("Unknown expectation type (" + JSON.stringify(e) + ")");
      }
    }

    const expectations = ast.expectations.map(
      (e, i) => "$this->peg_e" + i + " = " + buildExpectation(e) + ";"
    );

    return [
      ...expectations ? expectations : [],
    ].join("\n");
  }

  function generateFunctions() {
    return ast.functions.map(
      (f, i) => "/**\n"
        + f.params.map(param => " * @param mixed $" + param).join("\n")
        + "\n * @return mixed\n */\n"
        + "private function peg_f" + i
        + "("
        + f.params.map(param => "$" + param).join(", ")
        + ")\n"
        + "{\n"
        + "    " + internalUtils.extractPhpCode(f.body).trim()
        + "\n}\n"
    ).join("\n");
  }

  function generateCacheHeader(ruleIndexCode) {
    return [
      "$key = $this->peg_currPos * " + ast.rules.length + " + " + ruleIndexCode + ";",
      "$cached = $this->peg_cache[$key] ?? null;",
      "",
      "if ($cached) {",
      "    $this->peg_currPos = $cached->nextPos;",
      "    return $cached->result;",
      "}",
      "",
    ].join("\n");
  }

  function generateCacheFooter(resultCode) {
    return [
      "",
      "$this->peg_cache[$key] = new pegCacheItem($this->peg_currPos, " + resultCode + ");",
    ].join("\n");
  }

  function generateRuleFunction(rule) {
    const parts = [];

    // |literals[i]| of the abstract machine
    function l(i) {
      return "$this->peg_l" + i;
    }

    // |classes[i]| of the abstract machine
    function c(i) {
      return "$this->peg_c" + i;
    }

    // |expectations[i]| of the abstract machine
    function e(i) {
      return "$this->peg_e" + i;
    }

    // |actions[i]| of the abstract machine
    function f(i) {
      return "$this->peg_f" + i;
    }

    // |stack[i]| of the abstract machine
    function s(i) {
      return "$s" + i;
    }

    function inputSubstr(start, len) {
      // If we can guarantee that `start` is within the bounds of
      // the array, replace this with a direct array access when
      // `len === 1`.  Currently we cannot guarantee this.
      return "$this->input_substr(" + start + ", " + len + ")";
    }

    const stack = {
      sp: -1,
      maxSp: -1,
      push(exprCode) {
        const code = s(++this.sp) + " = " + exprCode + ";";

        if (this.sp > this.maxSp) {
          this.maxSp = this.sp;
        }

        return code;
      },
      pop(...args) {
        let n, sp, values;

        if (args.length === 0) {
          return s(this.sp--);
        } else {
          n = args[0];
          sp = this.sp;
          values = Array.from(
            new Array(n),
            (value, index) => s(sp - n + 1 + index)
          );
          this.sp -= n;

          return values;
        }
      },
      top() {
        return s(this.sp);
      },
      index(i) {
        return s(this.sp - i);
      },
    };

    function compile(bc) {
      let ip = 0;
      const end = bc.length;
      const parts = [];
      let stackTop, value;

      function compileCondition(cond, argCount) {
        const baseLength = argCount + 3;
        const thenLength = bc[ip + baseLength - 2];
        const elseLength = bc[ip + baseLength - 1];
        const baseSp = stack.sp;
        let elseCode, elseSp;

        ip += baseLength;
        const thenCode = compile(bc.slice(ip, ip + thenLength));
        const thenSp = stack.sp;
        ip += thenLength;

        if (elseLength > 0) {
          stack.sp = baseSp;
          elseCode = compile(bc.slice(ip, ip + elseLength));
          elseSp = stack.sp;
          ip += elseLength;

          if (thenSp !== elseSp) {
            throw new Error("Branches of a condition must move the stack pointer in the same way.");
          }
        }

        parts.push("if (" + cond + ") {");
        parts.push(indent(4, thenCode));
        if (elseLength > 0) {
          parts.push("} else {");
          parts.push(indent(4, elseCode));
        }
        parts.push("}");
      }

      function compileLoop(cond) {
        const baseLength = 2;
        const bodyLength = bc[ip + baseLength - 1];
        const baseSp = stack.sp;

        ip += baseLength;
        const bodyCode = compile(bc.slice(ip, ip + bodyLength));
        const bodySp = stack.sp;
        ip += bodyLength;

        if (bodySp !== baseSp) {
          throw new Error("Body of a loop can't move the stack pointer.");
        }

        parts.push("while (" + cond + ") {");
        parts.push(indent(4, bodyCode));
        parts.push("}");
      }

      function compileCall() {
        const baseLength = 4;
        const paramsLength = bc[ip + baseLength - 1];

        const params = bc.slice(
          ip + baseLength,
          ip + baseLength + paramsLength
        );
        let value = f(bc[ip + 1]) + "(";
        if (params.length > 0) {
          value += params.map(stackIndex).join(", ");
        }
        value += ")";
        stack.pop(bc[ip + 2]);
        parts.push(stack.push(value));
        ip += baseLength + paramsLength;
      }

      /*
       * Extracted into a function just to silence JSHint complaining about
       * creating functions in a loop.
       */
      function stackIndex(p) {
        return stack.index(p);
      }

      while (ip < end) {
        switch (bc[ip]) {
          case op.PUSH_EMPTY_STRING: // PUSH_EMPTY_STRING
            parts.push(stack.push("\"\""));
            ip++;
            break;

          case op.PUSH_UNDEFINED:    // PUSH_UNDEFINED
            parts.push(stack.push("null"));
            ip++;
            break;

          case op.PUSH_NULL:         // PUSH_NULL
            parts.push(stack.push("null"));
            ip++;
            break;

          case op.PUSH_FAILED:       // PUSH_FAILED
            parts.push(stack.push("$this->peg_FAILED"));
            ip++;
            break;

          case op.PUSH_EMPTY_ARRAY:  // PUSH_EMPTY_ARRAY
            parts.push(stack.push("[]"));
            ip++;
            break;

          case op.PUSH_CURR_POS:     // PUSH_CURR_POS
            parts.push(stack.push("$this->peg_currPos"));
            ip++;
            break;

          case op.POP:               // POP
            stack.pop();
            ip++;
            break;

          case op.POP_CURR_POS:      // POP_CURR_POS
            parts.push("$this->peg_currPos = " + stack.pop() + ";");
            ip++;
            break;

          case op.POP_N:             // POP_N n
            stack.pop(bc[ip + 1]);
            ip += 2;
            break;

          case op.NIP:               // NIP
            value = stack.pop();
            stack.pop();
            parts.push(stack.push(value));
            ip++;
            break;

          case op.APPEND:            // APPEND
            value = stack.pop();
            parts.push(stack.top() + "[] = " + value + ";");
            ip++;
            break;

          case op.WRAP:              // WRAP n
            parts.push(
              stack.push("[" + stack.pop(bc[ip + 1]).join(", ") + "]")
            );
            ip += 2;
            break;

          case op.TEXT:              // TEXT
            stackTop = stack.pop();
            parts.push(stack.push(
              inputSubstr(
                stackTop,
                "$this->peg_currPos - " + stackTop
              )
            ));
            ip++;
            break;

          case op.PLUCK: {           // PLUCK n, k, p1, ..., pK
            const baseLength = 3;
            const paramsLength = bc[ip + baseLength - 1];
            const n = baseLength + paramsLength;
            value = bc.slice(ip + baseLength, ip + n);
            value = paramsLength === 1
              ? stack.index(value[0])
              : `[ ${
                value.map(p => stackIndex(p)).join(", ")
              } ]`;
            stack.pop(bc[ip + 1]);
            parts.push(stack.push(value));
            ip += n;
            break;
          }

          case op.IF:                // IF t, f
            compileCondition(stack.top(), 0);
            break;

          case op.IF_ERROR:          // IF_ERROR t, f
            compileCondition(stack.top() + " === $this->peg_FAILED", 0);
            break;

          case op.IF_NOT_ERROR:      // IF_NOT_ERROR t, f
            compileCondition(stack.top() + " !== $this->peg_FAILED", 0);
            break;

          case op.WHILE_NOT_ERROR:   // WHILE_NOT_ERROR b
            compileLoop(stack.top() + " !== $this->peg_FAILED", 0);
            break;

          case op.MATCH_ANY:         // MATCH_ANY a, f, ...
            compileCondition("$this->input_length > $this->peg_currPos", 0);
            break;

          case op.MATCH_STRING:      // MATCH_STRING s, a, f, ...
            compileCondition(
              inputSubstr(
                "$this->peg_currPos",
                ast.literals[bc[ip + 1]].length
              ) + " === " + l(bc[ip + 1]),
              1
            );
            break;

          case op.MATCH_STRING_IC:   // MATCH_STRING_IC s, a, f, ...
            if (!mbstringAllowed) {
              throw new Error(
                "Case-insensitive string matching requires the "
                + "`mbstring` PHP extension, but it is disabled "
                + "via `mbstringAllowed: false`."
              );
            }
            compileCondition(
              "mb_strtolower("
              + inputSubstr(
                "$this->peg_currPos",
                ast.literals[bc[ip + 1]].length
              ) + ', "UTF-8") === ' + l(bc[ip + 1]),
              1
            );
            break;

          case op.MATCH_CHAR_CLASS:  // MATCH_CHAR_CLASS c, a, f, ...
            if (mbstringAllowed) {
              compileCondition(
                "peg_regex_test("
                + c(bc[ip + 1]) + ", "
                + inputSubstr("$this->peg_currPos", 1)
                + ")",
                1
              );
            } else {
              compileCondition(
                "peg_char_class_test("
                + c(bc[ip + 1]) + ", "
                + inputSubstr("$this->peg_currPos", 1)
                + ")",
                1
              );
            }
            break;

          case op.ACCEPT_N:          // ACCEPT_N n
            parts.push(stack.push(
              inputSubstr("$this->peg_currPos", bc[ip + 1])
            ));
            parts.push(
              bc[ip + 1] > 1
                ? "$this->peg_currPos += " + bc[ip + 1] + ";"
                : "$this->peg_currPos++;"
            );
            ip += 2;
            break;

          case op.ACCEPT_STRING:     // ACCEPT_STRING s
            parts.push(stack.push(l(bc[ip + 1])));
            parts.push(
              ast.literals[bc[ip + 1]].length > 1
                ? "$this->peg_currPos += " + ast.literals[bc[ip + 1]].length + ";"
                : "$this->peg_currPos++;"
            );
            ip += 2;
            break;

          case op.FAIL:              // FAIL e
            parts.push(stack.push("$this->peg_FAILED"));
            parts.push("if ($this->peg_silentFails === 0) {");
            parts.push("    $this->peg_fail(" + e(bc[ip + 1]) + ");");
            parts.push("}");
            ip += 2;
            break;

          case op.LOAD_SAVED_POS:    // LOAD_SAVED_POS p
            parts.push("$this->peg_reportedPos = " + stack.index(bc[ip + 1]) + ";");
            ip += 2;
            break;

          case op.UPDATE_SAVED_POS:  // UPDATE_SAVED_POS
            parts.push("$this->peg_reportedPos = $this->peg_currPos;");
            ip++;
            break;

          case op.CALL:              // CALL f, n, pc, p1, p2, ..., pN
            compileCall();
            break;

          case op.RULE:              // RULE r
            parts.push(stack.push("$this->peg_parse_" + ast.rules[bc[ip + 1]].name + "()"));
            ip += 2;
            break;

          case op.SILENT_FAILS_ON:   // SILENT_FAILS_ON
            parts.push("$this->peg_silentFails++;");
            ip++;
            break;

          case op.SILENT_FAILS_OFF:  // SILENT_FAILS_OFF
            parts.push("$this->peg_silentFails--;");
            ip++;
            break;

          default:
            throw new Error("Invalid opcode: " + bc[ip] + ".");
        }
      }

      return parts.join("\n");
    }

    const code = compile(rule.bytecode);

    parts.push([
      "/** @return mixed */",
      "private function peg_parse_" + rule.name + "()",
      "{",
    ].join("\n"));

    if (options.cache) {
      parts.push(indent(4, generateCacheHeader(
        asts.indexOfRule(ast, rule.name)
      )));
    }

    parts.push(indent(4, code));

    if (options.cache) {
      parts.push(indent(4, generateCacheFooter(s(0))));
    }

    parts.push([
      "",
      "    return " + s(0) + ";",
      "}",
    ].join("\n"));

    return parts.join("\n");
  }

  //
  // Start collection of code for parser output
  //
  const parts = [];

  parts.push([
    "<?php",
    "/*",
    " * Generated by Peggy " + peggyVersion + " with PHPeggy plugin " + phpeggyVersion,
    " *",
    " * https://peggyjs.org/",
    " */",
    "",
    "declare(strict_types=1);",
    "",
  ].join("\n"));

  if (phpNamespace) {
    parts.push("namespace " + phpNamespace + ";");
  }

  parts.push([
    "",
    "/* BEGIN Useful functions */",
    "/* chr_unicode - get unicode character from its char code */",
    'if (!function_exists("' + phpGlobalNamePrefixOrNamespaceEscaped + 'chr_unicode")) {',
    "    /** @param float|int $code */",
    "    function chr_unicode($code): string",
    "    {",
    '        return html_entity_decode("&#" . (int) $code .";", ENT_QUOTES, "UTF-8");',
    "    }",
    "}",
    "",
    "/* ord_unicode - get unicode char code from string */",
    'if (!function_exists("' + phpGlobalNamePrefixOrNamespaceEscaped + 'ord_unicode")) {',
    "    function ord_unicode(string $character): int",
    "    {",
    "        if (strlen($character) === 1) {",
    "            return ord($character);",
    "        }",
    "        $json = json_encode($character, JSON_THROW_ON_ERROR);",
    "        $utf16_1 = (int) hexdec(substr($json, 3, 4));",
    // A character inside the BMP has a JSON representation like "\uXXXX".
    // A character outside the BMP looks like "\uXXXX\uXXXX".
    '        if (substr($json, 7, 2) === "\\u") {',
    // Outside the BMP.  Math from https://stackoverflow.com/a/6240819
    "            $utf16_2 = (int) hexdec(substr($json, 9, 4));",
    "            return 0x10000 + (($utf16_1 & 0x3ff) << 10) + ($utf16_2 & 0x3ff);",
    "        } else {",
    "            return $utf16_1;",
    "        }",
    "    }",
    "}",
    "",
  ].join("\n"));

  if (mbstringAllowed) {
    parts.push([
      "/* peg_regex_test - multibyte regex test */",
      'if (!function_exists("' + phpGlobalNamePrefixOrNamespaceEscaped + 'peg_regex_test")) {',
      "    function peg_regex_test(string $pattern, string $string): bool",
      "    {",
      '        if (substr($pattern, -1) === "i") {',
      "            return (bool) mb_eregi(substr($pattern, 1, -2), $string);",
      "        } else {",
      "            return (bool) mb_ereg(substr($pattern, 1, -1), $string);",
      "        }",
      "    }",
      "}",
      "",
    ].join("\n"));
  } else {
    // Case-insensitive character classes are disallowed in
    // `generate-bytecode-php.js` if the `mbstringAllowed` option is set to
    // false.
    parts.push([
      "/* peg_char_class_test - simple character class test */",
      'if (!function_exists("' + phpGlobalNamePrefixOrNamespaceEscaped + 'peg_char_class_test")) {',
      "    /** @param array<int, array<int, int>> $class */",
      "    function peg_char_class_test(array $class, string $character): bool",
      "    {",
      "        $code = ord_unicode($character);",
      "        foreach ($class as $range) {",
      "            if ($code >= $range[0] && $code <= $range[1]) {",
      "                return true;",
      "            }",
      "        }",
      "        return false;",
      "    }",
      "}",
      "/* END Useful functions */",
      "",
    ].join("\n"));
  }

  if (ast.topLevelInitializer) {
    const topLevelInitializerCode = internalUtils.extractPhpCode(
      ast.topLevelInitializer.code.trim()
    );
    if (topLevelInitializerCode !== "") {
      parts.push("/* BEGIN global initializer code */");
      parts.push(topLevelInitializerCode);
      parts.push("/* END global initializer code */");
      parts.push("");
    }
  }

  parts.push([
    "/* Syntax error exception */",
    'if (!class_exists("' + phpGlobalNamePrefixOrNamespaceEscaped + 'SyntaxError", false)) {',
    "    class SyntaxError extends " + phpGlobalNamespacePrefix + "Exception",
    "    {",
    "        /** @var string $name */",
    '        public $name = "SyntaxError";',
    "        /** @var ?array<int, pegExpectation> $expected */",
    "        public $expected;",
    "        /** @var string $found */",
    "        public $found;",
    "        /** @var int $grammarOffset */",
    "        public $grammarOffset;",
    "        /** @var int $grammarLine */",
    "        public $grammarLine;",
    "        /** @var int $grammarColumn */",
    "        public $grammarColumn;",
    "        /** @var " + phpGlobalNamespacePrefix + "stdClass $location */",
    "        public $location;",
    "",
    "        /**",
    "         * @param ?array<int, pegExpectation> $expected",
    "         */",
    "        public function __construct(?string $message, ?array $expected, string $found, int $offset, int $line, int $column, " + phpGlobalNamespacePrefix + "stdClass $location)",
    "        {",
    '            parent::__construct($message ?? "", 0);',
    "            $this->expected = $expected;",
    "            $this->found = $found;",
    "            $this->grammarOffset = $offset;",
    "            $this->grammarLine = $line;",
    "            $this->grammarColumn = $column;",
    "            $this->location = $location;",
    "        }",
    "",
    "        /**",
    "         * @param array<int, array<string, string>> $sources",
    "         */",
    "        public function format(array $sources): string",
    // $sources = [["source" => "User input", "text" => $user_input], ["source" => "User input2", "text" => $user_input2]]
    "        {",
    '            $str = $this->name . ": " . $this->message;',
    "            if (!empty($this->location->source)) {",
    "                $src = null;",
    "                for ($k = 0; $k < count($sources); $k++) {",
    '                    if ($sources[$k]["source"] === $this->location->source) {',
    '                        $src = preg_split("/\\r\\n|\\n|\\r/", $sources[$k]["text"]);',
    "                        break;",
    "                    }",
    "                }",
    "                $s = $this->location->start;",
    '                $loc = $this->location->source . ":" . $s->line . ":" . $s->column;',
    "                if ($src) {",
    "                    $e = $this->location->end;",
    '                    $filler = $this->peg_padEnd("", $s->line !== 0 ? (int) floor(log10($s->line) + 1) : 1);',
    "                    $line = $src[$s->line - 1];",
    "                    $last = $s->line === $e->line ? $e->column : strlen($line) + 1;",
    '                    $str .= "\\n --> " . $loc . "\\n"',
    '                        . $filler . " |\\n"',
    '                        . $s->line . " | " . $line . "\\n"',
    '                        . $filler . " | " . $this->peg_padEnd("", $s->column - 1)',
    '                        . $this->peg_padEnd("", $last - $s->column, "^");',
    "                } else {",
    '                    $str .= "\\n at " . $loc;',
    "                }",
    "            }",
    "            return $str;",
    "        }",
    "",
    '        private function peg_padEnd(string $str, int $targetLength, string $padString = " "): string',
    "        {",
    "            if (strlen($str) > $targetLength) {",
    "                return $str;",
    "            }",
    "            $targetLength -= strlen($str);",
    "            $padString .= str_repeat($padString, $targetLength);",
    "            return $str . substr($padString, 0, $targetLength);",
    "        }",
    "    }",
    "}",
    "",
    "class pegExpectation",
    "{",
    "    /** @var ?string $type */",
    "    public $type;",
    "    /** @var ?string $description */",
    "    public $description;",
    "    /** @var ?string $value */",
    "    public $value;",
    "    /** @var ?string $ignoreCase */",
    "    public $ignoreCase;",
    "",
    "    public function __construct(string $type = null, string $description = null, string $value = null, string $ignoreCase = null)",
    "    {",
    "        $this->type = $type;",
    "        $this->description = $description;",
    "        $this->value = $value;",
    "        $this->ignoreCase = $ignoreCase;",
    "    }",
    "}",
    "",
    "class pegCacheItem",
    "{",
    "    /** @var int $nextPos */",
    "    public $nextPos;",
    "    /** @var mixed $result */",
    "    public $result;",
    "",
    "    /** @param mixed $result */",
    "    public function __construct(int $nextPos, $result)",
    "    {",
    "        $this->nextPos = $nextPos;",
    "        $this->result = $result;",
    "    }",
    "}",
    "",
    "class pegCachedPosDetails",
    "{",
    "    /** @var int $line */",
    "    public $line;",
    "    /** @var int $column */",
    "    public $column;",
    "    /** @var bool $seenCR */",
    "    public $seenCR;",
    "",
    "    public function __construct(int $line = 1, int $column = 1, bool $seenCR = false)",
    "    {",
    "        $this->line = $line;",
    "        $this->column = $column;",
    "        $this->seenCR = $seenCR;",
    "    }",
    "}",

    "class " + phpParserClass,
    "{",
  ].join("\n"));

  parts.push(indent(4, [
    ...options.cache
      ? ["/** @var array<int, pegCacheItem> */", "public $peg_cache = [];", ""]
      : [],

    "/** @var int $peg_currPos */",
    "private $peg_currPos = 0;",
    "/** @var int $peg_reportedPos */",
    "private $peg_reportedPos = 0;",
    "/** @var int $peg_cachedPos */",
    "private $peg_cachedPos = 0;",
    "/** @var pegCachedPosDetails $peg_cachedPosDetails */",
    "private $peg_cachedPosDetails;",
    "/** @var int $peg_maxFailPos */",
    "private $peg_maxFailPos = 0;",
    "/** @var array<int, pegExpectation> $peg_maxFailExpected */",
    "private $peg_maxFailExpected = [];",
    "/** @var int $peg_silentFails */",
    "private $peg_silentFails = 0;", // 0 = report failures, > 0 = silence failures
    "/** @var array<int, string> $input */",
    "private $input = [];",
    "/** @var int $input_length */",
    "private $input_length = 0;",
    "/** @var " + phpGlobalNamespacePrefix + "stdClass $peg_FAILED */",
    "private $peg_FAILED;",
    "/** @var string $peg_source */",
    'private $peg_source = "";',
    "",
  ].join("\n")));

  parts.push(indent(4, generateTablesDeclaration()));
  parts.push("");

  parts.push(indent(4, [
    "public function __construct()",
    "{",
    "    $this->peg_FAILED = new " + phpGlobalNamespacePrefix + "stdClass();",
    "    $this->peg_cachedPosDetails = new pegCachedPosDetails();",
  ].join("\n")));

  parts.push(indent(8, generateTablesDefinition()));

  parts.push(indent(4, [
    "}",
    "",
  ].join("\n")));

  // START public function parse
  parts.push(indent(4, [
    "/**",
    " * @param string|array<int, string> $input",
    " * @param array<int, mixed> $args",
    " * @return mixed",
    " */",
    "public function parse($input, array ...$args)",
    "{",
    "    /** @var array<string, string> $options */",
    "    $options = $args[0] ?? [];",
    "    $this->cleanup_state();",
    "",
    "    if (is_array($input)) {",
    "        $this->input = $input;",
    "    } else {",
    '        preg_match_all("/./us", $input, $match);',
    "        $this->input = $match[0];",
    "    }",
    "    $this->input_length = count($this->input);",
    '    $this->peg_source = $options["grammarSource"] ?? "";',
    "",
  ].join("\n")));

  if (mbstringAllowed) {
    parts.push(indent(8, [
      "$old_regex_encoding = (string) mb_regex_encoding();",
      'mb_regex_encoding("UTF-8");',
      "",
    ].join("\n")));
  }

  const startRuleFunctions = "["
    + options.allowedStartRules.map(
      r => '"' + r + '" => [$this, "peg_parse_' + r + '"]'
    ).join(", ")
    + "]";
  const startRuleFunction = '[$this, "peg_parse_' + options.allowedStartRules[0] + '"]';

  parts.push(indent(8, [
    "$peg_startRuleFunctions = " + startRuleFunctions + ";",
    "$peg_startRuleFunction = " + startRuleFunction + ";",
  ].join("\n")));

  parts.push(indent(8, [
    'if (isset($options["startRule"])) {',
    '    if (!(isset($peg_startRuleFunctions[$options["startRule"]]))) {',
    "        throw new " + phpGlobalNamespacePrefix + 'Exception("Can\'t start parsing from rule \\"" . $options["startRule"] . "\\".");',
    "    }",
    "",
    '    $peg_startRuleFunction = $peg_startRuleFunctions[$options["startRule"]];',
    "}",
  ].join("\n")));

  if (ast.initializer) {
    const initializerCode = internalUtils.extractPhpCode(
      ast.initializer.code.trim()
    );
    if (initializerCode !== "") {
      parts.push("");
      parts.push(indent(8, "/* BEGIN initializer code */"));
      parts.push(indent(8, initializerCode));
      parts.push(indent(8, "/* END initializer code */"));
    }
  }

  parts.push("");
  parts.push(indent(8, "$peg_result = call_user_func($peg_startRuleFunction);"));

  if (options.cache) {
    parts.push("");
    parts.push(indent(8, "$this->peg_cache = [];"));
  }

  if (mbstringAllowed) {
    parts.push(indent(8, [
      "",
      "mb_regex_encoding($old_regex_encoding);",
    ].join("\n")));
  }

  parts.push(indent(8, [
    "",
    "if ($peg_result !== $this->peg_FAILED && $this->peg_currPos === $this->input_length) {",
    "    // Free up memory",
    "    $this->cleanup_state();",
    "    return $peg_result;",
    "}",
    "if ($peg_result !== $this->peg_FAILED && $this->peg_currPos < $this->input_length) {",
    '    $this->peg_fail(new pegExpectation("end", "end of input"));',
    "}",
    "",
    "$exception = $this->peg_buildException(null, $this->peg_maxFailExpected, $this->peg_maxFailPos);",
    "// Free up memory",
    "$this->cleanup_state();",
    "throw $exception;",
  ].join("\n")));

  parts.push([
    "    }",
    "",
  ].join("\n"));
  // END public function parse

  parts.push(indent(4, [
    "private function cleanup_state(): void",
    "{",

    ...options.cache
      ? ["    $this->peg_cache = [];"]
      : [],

    "    $this->peg_currPos = 0;",
    "    $this->peg_reportedPos = 0;",
    "    $this->peg_cachedPos = 0;",
    "    $this->peg_cachedPosDetails = new pegCachedPosDetails();",
    "    $this->peg_maxFailPos = 0;",
    "    $this->peg_maxFailExpected = [];",
    "    $this->peg_silentFails = 0;",
    "    $this->input = [];",
    "    $this->input_length = 0;",
    '    $this->peg_source = "";',
    "}",
    "",
    "private function input_substr(int $start, int $length): string",
    "{",
    "    if ($length === 1 && $start < $this->input_length) {",
    "        return $this->input[$start];",
    "    }",
    '    $substr = "";',
    "    $max = min($start + $length, $this->input_length);",
    "    for ($i = $start; $i < $max; $i++) {",
    "        $substr .= $this->input[$i];",
    "    }",
    "    return $substr;",
    "}",
    "",
  ].join("\n")));

  parts.push(indent(4, [
    "private function text(): string",
    "{",
    "    return $this->input_substr($this->peg_reportedPos, $this->peg_currPos - $this->peg_reportedPos);",
    "}",
    "",
    "private function offset(): int",
    "{",
    "    return $this->peg_reportedPos;",
    "}",
    "",
    "/** @return array<string, string|int> */",
    "private function range(): array",
    "{",
    '    return ["source" => $this->peg_source, "start" => $this->peg_reportedPos, "end" => $this->peg_currPos];',
    "}",
    "",
    "private function location(bool $fail = false): " + phpGlobalNamespacePrefix + "stdClass",
    "{",
    "    $start = $this->peg_reportedPos;",
    "    $end = $this->peg_currPos;",
    "    if ($fail) {",
    "        $start = $this->peg_maxFailPos;",
    "        $end = $this->peg_maxFailPos + ($this->peg_maxFailPos < count($this->input) ? 1 : 0);",
    "    }",
    "    $compute_pd_start = $this->peg_computePosDetails($start);",
    "    $compute_pd_end = $this->peg_computePosDetails($end);",
    "",
    "    return (object) [",
    '        "source" => $this->peg_source,',
    '        "start" => (object) [',
    '            "offset" => $start,',
    '            "line" => $compute_pd_start->line,',
    '            "column" => $compute_pd_start->column,',
    "        ],",
    '        "end" => (object) [',
    '            "offset" => $end,',
    '            "line" => $compute_pd_end->line,',
    '            "column" => $compute_pd_end->column,',
    "        ],",
    "    ];",
    "}",
    "",
    "private function line(): int",
    "{",
    "    $compute_pd = $this->peg_computePosDetails($this->peg_reportedPos);",
    "    return $compute_pd->line;",
    "}",
    "",
    "private function column(): int",
    "{",
    "    $compute_pd = $this->peg_computePosDetails($this->peg_reportedPos);",
    "    return $compute_pd->column;",
    "}",
    "",
    "private function expected(string $description): void",
    "{",
    "    throw $this->peg_buildException(",
    "        null,",
    '        [new pegExpectation("other", $description)],',
    "        $this->peg_reportedPos",
    "    );",
    "}",
    "",
    "private function error(string $message): void",
    "{",
    "    throw $this->peg_buildException($message, null, $this->peg_reportedPos);",
    "}",
    "",
    "private function peg_advancePos(pegCachedPosDetails &$details, int $startPos, int $endPos): void",
    "{",
    "    for ($p = $startPos; $p < $endPos; $p++) {",
    "        $ch = $this->input_substr($p, 1);",
    '        if ($ch === "\\n") {',
    "            if (!$details->seenCR) {",
    "                $details->line++;",
    "            }",
    "            $details->column = 1;",
    "            $details->seenCR = false;",
    '        } elseif ($ch === "\\r" || $ch === "\\u2028" || $ch === "\\u2029") {',
    "            $details->line++;",
    "            $details->column = 1;",
    "            $details->seenCR = true;",
    "        } else {",
    "            $details->column++;",
    "            $details->seenCR = false;",
    "        }",
    "    }",
    "}",
    "",
    "private function peg_computePosDetails(int $pos): pegCachedPosDetails",
    "{",
    "    if ($this->peg_cachedPos !== $pos) {",
    "        if ($this->peg_cachedPos > $pos) {",
    "            $this->peg_cachedPos = 0;",
    "            $this->peg_cachedPosDetails = new pegCachedPosDetails();",
    "        }",
    "        $this->peg_advancePos($this->peg_cachedPosDetails, $this->peg_cachedPos, $pos);",
    "        $this->peg_cachedPos = $pos;",
    "    }",
    "",
    "    return $this->peg_cachedPosDetails;",
    "}",
    "",
    "private function peg_fail(pegExpectation $expected): void",
    "{",
    "    if ($this->peg_currPos < $this->peg_maxFailPos) {",
    "        return;",
    "    }",
    "",
    "    if ($this->peg_currPos > $this->peg_maxFailPos) {",
    "        $this->peg_maxFailPos = $this->peg_currPos;",
    "        $this->peg_maxFailExpected = [];",
    "    }",
    "",
    "    $this->peg_maxFailExpected[] = $expected;",
    "}",
    "",
    "private function peg_buildException_expectedComparator(pegExpectation $a, pegExpectation $b): int",
    "{",
    "    $a = (array) $a;",
    "    $b = (array) $b;",
    '    if ($a["description"] < $b["description"]) {',
    "        return -1;",
    '    } elseif ($a["description"] > $b["description"]) {',
    "        return 1;",
    "    } else {",
    "        return 0;",
    "    }",
    "}",
    "",
    "/** @param array<int, pegExpectation> $expected */",
    "private function peg_buildException(?string $message, ?array $expected, int $pos): SyntaxError",
    "{",
    "    $posDetails = $this->peg_computePosDetails($pos);",
    "    $found = $pos < $this->input_length ? $this->input[$pos] : null;",
    "",
    "    if ($expected !== null) {",
    '        usort($expected, [$this, "peg_buildException_expectedComparator"]);',
    "        $i = 1;",
    /*
     * This works because the bytecode generator guarantees that every
     * expectation object exists only once, so it's enough to use |===| instead
     * of deeper structural comparison.
     */
    "        while ($i < count($expected)) {",
    "            if ($expected[$i - 1] === $expected[$i]) {",
    "                array_splice($expected, $i, 1);",
    "            } else {",
    "                $i++;",
    "            }",
    "        }",
    "    }",
    "",
    "    if ($message === null && $expected !== null) {",
    "        $expectedDescs = array_fill(0, count($expected), null);",
    "",
    "        for ($i = 0; $i < count($expected); $i++) {",
    "            $expectedDescs[$i] = $expected[$i]->description;",
    "        }",
    "",
    "        $expectedDesc = count($expected) > 1",
    '            ? join(", ", array_slice($expectedDescs, 0, -1))',
    '                . " or "',
    "                . $expectedDescs[count($expected) - 1]",
    "            : $expectedDescs[0];",
    "",
    '        $foundDesc = $found ? json_encode($found) : "end of input";',
    "",
    '        $message = "Expected " . $expectedDesc . " but " . $foundDesc . " found.";',
    "    }",
    "",
    "    return new SyntaxError(",
    "        $message,",
    "        $expected,",
    '        $found ?? "",',
    "        $pos,",
    "        $posDetails->line,",
    "        $posDetails->column,",
    "        $this->location(true)",
    "    );",
    "}",
    "",
  ].join("\n")));

  parts.push(indent(4, generateFunctions()));

  ast.rules.forEach(rule => {
    parts.push(indent(4, generateRuleFunction(rule)));
    parts.push("");
  });
  // Remove empty line
  parts.pop();

  parts.push([
    "};",
    "",
  ].join("\n"));

  ast.code = parts.join("\n");
};
