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
    return ast.literals.map(
      (l, i) => "private $peg_l" + i + ";"
    ).concat("", ast.classes.map(
      (c, i) => "private $peg_c" + i + ";"
    )).concat("", ast.expectations.map(
      (e, i) => "private $peg_e" + i + ";"
    )).join("\n");
  }

  function generateTablesDefinition() {
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
        const classArray = "array("
          + cls.value.map(part => {
            if (!(part instanceof Array)) {
              part = [part, part];
            }
            return "array("
              + part[0].charCodeAt(0) + ","
              + part[1].charCodeAt(0) + ")";
          }).join(", ")
          + ")";
        classIndex = classArray;
      }
      return classIndex;
    }

    function buildExpectation(e) {
      switch (e.type) {
        case "rule": {
          return 'array("type" => "other", "description" => ' + internalUtils.quote(e.value) + ")";
        }

        case "literal": {
          return "array("
            + ['"type" => "literal",',
              '"value" => ' + internalUtils.quote(e.value) + ",",
              '"description" => ' + internalUtils.quote(internalUtils.quote(e.value)) + ",",
              '"ignoreCase" => ' + internalUtils.quote(e.ignoreCase.toString())].join(" ")
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

          return "array("
            + ['"type" => "class",',
              '"value" => ' + internalUtils.quotePhp(rawText) + ",",
              '"description" => ' + internalUtils.quotePhp(rawText) + ",",
              '"ignoreCase" => ' + internalUtils.quote(e.ignoreCase.toString())].join(" ")
            + ")";
        }

        case "any":
          return 'array("type" => "any", "description" => "any character")';

        default: throw new Error("Unknown expectation type (" + JSON.stringify(e) + ")");
      }
    }

    return ast.literals.map(
      (l, i) => "$this->peg_l" + i + " = " + buildLiteral(l) + ";"
    ).concat("", ast.classes.map(
      (c, i) => "$this->peg_c" + i + " = " + buildRegexp(c) + ";"
    )).concat("", ast.expectations.map(
      (e, i) => "$this->peg_e" + i + " = " + buildExpectation(e) + ";"
    )).join("\n");
  }

  function generateFunctions() {
    return ast.functions.map(
      (f, i) => "private function peg_f" + i
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
      "$cached = isset($this->peg_cache[$key]) ? $this->peg_cache[$key] : null;",
      "",
      "if ($cached) {",
      '    $this->peg_currPos = $cached["nextPos"];',
      '    return $cached["result"];',
      "}",
      "",
    ].join("\n");
  }

  function generateCacheFooter(resultCode) {
    return [
      "",
      '$this->peg_cache[$key] = array ("nextPos" => $this->peg_currPos, "result" => ' + resultCode + ");",
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
            parts.push(stack.push("array()"));
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
              stack.push("array(" + stack.pop(bc[ip + 1]).join(", ") + ")")
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
            parts.push(stack.push("$this->peg_parse" + ast.rules[bc[ip + 1]].name + "()"));
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
      "private function peg_parse" + rule.name + "()",
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
  ].join("\n"));

  if (phpNamespace) {
    parts.push("namespace " + phpNamespace + ";");
  }

  parts.push([
    "",
    "/* BEGIN Useful functions */",
    "/* chr_unicode - get unicode character from its char code */",
    'if (!function_exists("' + phpGlobalNamePrefixOrNamespaceEscaped + 'chr_unicode")) {',
    "    function chr_unicode($code) {",
    '        return html_entity_decode("&#$code;", ENT_QUOTES, "UTF-8");',
    "    }",
    "}",
    "",
    "/* ord_unicode - get unicode char code from string */",
    'if (!function_exists("' + phpGlobalNamePrefixOrNamespaceEscaped + 'ord_unicode")) {',
    "    function ord_unicode($character) {",
    "        if (strlen($character) === 1) {",
    "            return ord($character);",
    "        }",
    "        $json = json_encode($character);",
    "        $utf16_1 = hexdec(substr($json, 3, 4));",
    // A character inside the BMP has a JSON representation like "\uXXXX".
    // A character outside the BMP looks like "\uXXXX\uXXXX".
    '        if (substr($json, 7, 2) === "\\u") {',
    // Outside the BMP.  Math from https://stackoverflow.com/a/6240819
    "            $utf16_2 = hexdec(substr($json, 9, 4));",
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
      "    function peg_regex_test($pattern, $string) {",
      '        if (substr($pattern, -1) === "i") {',
      "            return mb_eregi(substr($pattern, 1, -2), $string);",
      "        } else {",
      "            return mb_ereg(substr($pattern, 1, -1), $string);",
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
      "    function peg_char_class_test($class, $character) {",
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
    "        public $expected;",
    "        public $found;",
    "        public $grammarOffset;",
    "        public $grammarLine;",
    "        public $grammarColumn;",
    "        public $name;",
    "",
    "        public function __construct($message, $expected, $found, $offset, $line, $column)",
    "        {",
    "            parent::__construct($message, 0);",
    "            $this->expected = $expected;",
    "            $this->found = $found;",
    "            $this->grammarOffset = $offset;",
    "            $this->grammarLine = $line;",
    "            $this->grammarColumn = $column;",
    '            $this->name = "SyntaxError";',
    "        }",
    "    }",
    "}",
    "",
    "class " + phpParserClass,
    "{",
  ].join("\n"));

  parts.push(indent(4, [
    ...options.cache
      ? ["public $peg_cache = array();", ""]
      : [],

    "private $peg_currPos = 0;",
    "private $peg_reportedPos = 0;",
    "private $peg_cachedPos = 0;",
    'private $peg_cachedPosDetails = array("line" => 1, "column" => 1, "seenCR" => false);',
    "private $peg_maxFailPos = 0;",
    "private $peg_maxFailExpected = array();",
    "private $peg_silentFails = 0;", // 0 = report failures, > 0 = silence failures
    "private $input = array();",
    "private $input_length = 0;",
    "private $peg_FAILED;",
    "",
  ].join("\n")));

  parts.push(indent(4, generateTablesDeclaration()));
  parts.push("");

  // START public function parse
  parts.push(indent(4, [
    "public function parse($input)",
    "{",
    "    $arguments = func_get_args();",
    "    $options = count($arguments) > 1 ? $arguments[1] : array();",
    "    $this->cleanup_state();",
    "",
    "    if (is_array($input)) {",
    "        $this->input = $input;",
    "    } else {",
    '        preg_match_all("/./us", $input, $match);',
    "        $this->input = $match[0];",
    "    }",
    "    $this->input_length = count($this->input);",
    "",
  ].join("\n")));

  if (mbstringAllowed) {
    parts.push(indent(8, [
      "$old_regex_encoding = mb_regex_encoding();",
      'mb_regex_encoding("UTF-8");',
      "",
    ].join("\n")));
  }

  parts.push(indent(8, "$this->peg_FAILED = new " + phpGlobalNamespacePrefix + "stdClass;"));
  parts.push("");
  parts.push(indent(8, generateTablesDefinition()));
  parts.push("");

  const startRuleFunctions = "array("
    + options.allowedStartRules.map(
      r => '"' + r + '" => array($this, "peg_parse' + r + '")'
    ).join(", ")
    + ")";
  const startRuleFunction = 'array($this, "peg_parse' + options.allowedStartRules[0] + '")';

  parts.push(indent(8, [
    "$peg_startRuleFunctions = " + startRuleFunctions + ";",
    "$peg_startRuleFunction = " + startRuleFunction + ";",
  ].join("\n")));

  parts.push(indent(8, [
    'if (isset($options["startRule"])) {',
    '    if (!(isset($peg_startRuleFunctions[$options["startRule"]]))) {',
    "        throw new " + phpGlobalNamespacePrefix + 'Exception("Can\'t start parsing from rule \\"" + $options["startRule"] + "\\".");',
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
    parts.push(indent(8, "$this->peg_cache = array();"));
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
    '    $this->peg_fail(array("type" => "end", "description" => "end of input"));',
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
    "private function cleanup_state()",
    "{",

    ...options.cache
      ? ["    $this->peg_cache = array();"]
      : [],

    "    $this->peg_currPos = 0;",
    "    $this->peg_reportedPos = 0;",
    "    $this->peg_cachedPos = 0;",
    '    $this->peg_cachedPosDetails = array("line" => 1, "column" => 1, "seenCR" => false);',
    "    $this->peg_maxFailPos = 0;",
    "    $this->peg_maxFailExpected = array();",
    "    $this->peg_silentFails = 0;",
    "    $this->input = array();",
    "    $this->input_length = 0;",
    "}",
    "",
    "private function input_substr($start, $length)",
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
    "private function text()",
    "{",
    "    return $this->input_substr($this->peg_reportedPos, $this->peg_currPos - $this->peg_reportedPos);",
    "}",
    "",
    "private function offset()",
    "{",
    "    return $this->peg_reportedPos;",
    "}",
    "",
    "private function range()",
    "{",
    '    return array("start" => $this->peg_reportedPos, "end" => $this->peg_currPos);',
    "}",
    "",
    "private function line()",
    "{",
    "    $compute_pd = $this->peg_computePosDetails($this->peg_reportedPos);",
    '    return $compute_pd["line"];',
    "}",
    "",
    "private function column()",
    "{",
    "    $compute_pd = $this->peg_computePosDetails($this->peg_reportedPos);",
    '    return $compute_pd["column"];',
    "}",
    "",
    "private function expected($description)",
    "{",
    "    throw $this->peg_buildException(",
    "        null,",
    '        array(array("type" => "other", "description" => $description)),',
    "        $this->peg_reportedPos",
    "    );",
    "}",
    "",
    "private function error($message)",
    "{",
    "    throw $this->peg_buildException($message, null, $this->peg_reportedPos);",
    "}",
    "",
    "private function peg_advancePos(&$details, $startPos, $endPos)",
    "{",
    "    for ($p = $startPos; $p < $endPos; $p++) {",
    "        $ch = $this->input_substr($p, 1);",
    '        if ($ch === "\\n") {',
    '            if (!$details["seenCR"]) { $details["line"]++; }',
    '            $details["column"] = 1;',
    '            $details["seenCR"] = false;',
    '        } else if ($ch === "\\r" || $ch === "\\u2028" || $ch === "\\u2029") {',
    '            $details["line"]++;',
    '            $details["column"] = 1;',
    '            $details["seenCR"] = true;',
    "        } else {",
    '            $details["column"]++;',
    '            $details["seenCR"] = false;',
    "        }",
    "    }",
    "}",
    "",
    "private function peg_computePosDetails($pos)",
    "{",
    "    if ($this->peg_cachedPos !== $pos) {",
    "        if ($this->peg_cachedPos > $pos) {",
    "            $this->peg_cachedPos = 0;",
    '            $this->peg_cachedPosDetails = array("line" => 1, "column" => 1, "seenCR" => false);',
    "        }",
    "        $this->peg_advancePos($this->peg_cachedPosDetails, $this->peg_cachedPos, $pos);",
    "        $this->peg_cachedPos = $pos;",
    "    }",
    "",
    "    return $this->peg_cachedPosDetails;",
    "}",
    "",
    "private function peg_fail($expected)",
    "{",
    "    if ($this->peg_currPos < $this->peg_maxFailPos) { return; }",
    "",
    "    if ($this->peg_currPos > $this->peg_maxFailPos) {",
    "        $this->peg_maxFailPos = $this->peg_currPos;",
    "        $this->peg_maxFailExpected = array();",
    "    }",
    "",
    "    $this->peg_maxFailExpected[] = $expected;",
    "}",
    "",
    "private function peg_buildException_expectedComparator($a, $b)",
    "{",
    '    if ($a["description"] < $b["description"]) {',
    "        return -1;",
    '    } else if ($a["description"] > $b["description"]) {',
    "        return 1;",
    "    } else {",
    "        return 0;",
    "    }",
    "}",
    "",
    "private function peg_buildException($message, $expected, $pos)",
    "{",
    "    $posDetails = $this->peg_computePosDetails($pos);",
    "    $found = $pos < $this->input_length ? $this->input[$pos] : null;",
    "",
    "    if ($expected !== null) {",
    '        usort($expected, array($this, "peg_buildException_expectedComparator"));',
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
    "    if ($message === null) {",
    "        $expectedDescs = array_fill(0, count($expected), null);",
    "",
    "        for ($i = 0; $i < count($expected); $i++) {",
    '            $expectedDescs[$i] = $expected[$i]["description"];',
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
    "        $found,",
    "        $pos,",
    '        $posDetails["line"],',
    '        $posDetails["column"]',
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
