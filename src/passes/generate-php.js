"use strict";

const asts = require("peggy/lib/compiler/asts");
const Stack = require("peggy/lib/compiler/stack");
const op = require("../opcodes");
const internalUtils = require("../utils");

// Load static parser parts
const header = require("./generate-php/header");
const utilityFunctions = require("./generate-php/utility-functions");
const syntaxErrorClass = require("./generate-php/syntax-error-class");
const dataStorageClasses = require("./generate-php/data-storage-classes");
const commonMethods = require("./generate-php/common-methods");

/* Generates parser PHP code. */
module.exports = function(ast, options) {
  if (!ast.literals || !ast.classes || !ast.expectations || !ast.functions) {
    throw new Error(
      "generatePHP: generate bytecode was not called."
    );
  }

  let phpGlobalNamespacePrefix = "";
  let phpGlobalNamePrefixOrNamespaceEscaped = "";
  const phpNamespace = options.phpeggy.parserNamespace;
  const phpParserClass = options.phpeggy.parserClassName;
  if (phpNamespace) {
    phpGlobalNamespacePrefix = "\\";
    // For use within double quoted strings inside generated code, ensure there is a double backslash
    phpGlobalNamePrefixOrNamespaceEscaped = phpNamespace.replace(/\\+/g, "\\\\") + "\\\\";
  }

  /* Only indent non-empty lines to avoid trailing whitespace. */
  function indent(numberOfSpaces, code) {
    return code.replace(/^(.+)$/gm, " ".repeat(numberOfSpaces) + "$1");
  }

  function name(name) { return "peg_parse_" + name; }

  function generateTablesDeclaration() {
    function buildRegexp(cls) {
      const regexp = "/^["
        + (cls.inverted ? "^" : "")
        + cls.value.map(part => (Array.isArray(part)
          ? internalUtils.escapePhpRegexp(part[0])
            + "-"
            + internalUtils.escapePhpRegexp(part[1])
          : internalUtils.escapePhpRegexp(part)
        )).join("")
        + "]/" + (cls.ignoreCase ? "i" : "");
        // should use r modifier in future for fine tuning, only as of php 8.4.0

      return internalUtils.quotePhp(regexp);
    }

    const literals = ast.literals.map(
      (l, i) => "private string $peg_l" + i + " = " + internalUtils.quotePhp(l) + ";"
    );

    const classes = ast.classes.map(
      (c, i) => "private string $peg_c" + i + " = " + buildRegexp(c) + ";"
    );

    const expectations = ast.expectations.map(
      (e, i) => "private pegExpectation $peg_e" + i + ";"
    );

    return [
      ...literals ? literals : [],
      ...classes ? classes : [],
      ...expectations ? expectations : [],
    ];
  }

  function generateTablesDefinition() {
    function buildExpectation(e) {
      switch (e.type) {
        case "rule": {
          return 'new pegExpectation("other", ' + internalUtils.quotePhp(e.value) + ")";
        }

        case "literal": {
          return "new pegExpectation("
            + ['"literal",',
                internalUtils.quotePhp(internalUtils.quotePhp(e.value)) + ",",
                internalUtils.quotePhp(e.value) + ",",
                internalUtils.quotePhp(e.ignoreCase.toString())
              ].join(" ")
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
                internalUtils.quotePhp(internalUtils.escapePhp(rawText)) + ",",
                internalUtils.quotePhp(rawText) + ",",
                internalUtils.quotePhp(e.ignoreCase.toString()),
              ].join(" ")
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
    ];
  }

  function generateFunctions() {
    return ast.functions.map((f, i) => [
      "private function peg_f" + i + "(",
      ...f.params.map(param => "    mixed $" + param + ","),
      "): mixed {",
      "    " + internalUtils.extractPhpCode(f.body).trim(),
      "}",
      "",
    ].join("\n"));
  }

  function generateCacheHeader(ruleIndexCode) {
    return [
      "$key = $this->peg_currPos * " + ast.rules.length + " + " + ruleIndexCode + ";",
      "$cached = $this->peg_cache[$key] ?? false;",
      "",
      "if ($cached) {",
      "    $this->peg_currPos = $cached->nextPos;",
      "    return $cached->result;",
      "}",
      "",
    ];
  }

  function generateCacheFooter(resultCode) {
    return [
      "",
      "$this->peg_cache[$key] = new pegCacheItem($this->peg_currPos, " + resultCode + ");",
    ];
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

    function inputSubstr(start, len) {
      /*
       * If we can guarantee that `start` is within the bounds of
       * the array, replace this with a direct array access when
       * `len === 1`.  Currently we cannot guarantee this.
       */
      return "$this->input_substr(" + start + ", " + len + ")";
    }

    const stack = new Stack(rule.name, "$s", "", rule.bytecode);

    function compile(bc) {
      let ip = 0;
      const end = bc.length;
      const parts = [];
      let stackTop = undefined;
      let value = undefined;

      function compileCondition(cond, argCount, thenFn) {
        const baseLength = argCount + 3;
        const thenLength = bc[ip + baseLength - 2];
        const elseLength = bc[ip + baseLength - 1];
        let thenCode = undefined;
        let elseCode = undefined;

        stack.checkedIf(
          ip,
          () => {
            ip += baseLength;
            thenCode = (thenFn || compile)(bc.slice(ip, ip + thenLength));
            ip += thenLength;
          },
          elseLength > 0
            ? () => {
                elseCode = compile(bc.slice(ip, ip + elseLength));
                ip += elseLength;
              }
            : null
        );

        parts.push("if (" + cond + ") {");
        parts.push(...thenCode.map(line => indent(4, line)));
        if (elseLength > 0) {
          parts.push("} else {");
          parts.push(...elseCode.map(line => indent(4, line)));
        }
        parts.push("}");
      }

      /*
        MATCH_* opcodes typically do something like
          if (<test>($this->input_substr($this->peg_currPos, length))) {
            sN = $this->input_substr($this->peg_currPos, length);
            ...
          } else {
            sN = $this->peg_FAILED;
            ...
          }
        compileInputChunkCondition will convert that to
          sN = $this->input_substr($this->peg_currPos, length);
          if (<test>(sN)) {
            ...
          } else {
            sN = $this->peg_FAILED;
            ...
          }
          and avoid extracting the sub string twice.
      */
      function compileInputChunkCondition(
        condFn, argCount, inputChunkLength
      ) {
        const baseLength = argCount + 3;
        let inputChunk = inputSubstr("$this->peg_currPos", inputChunkLength);
        let thenFn = null;
        if (bc[ip + baseLength] === op.ACCEPT_N
              && bc[ip + baseLength + 1] === inputChunkLength) {
          // Push the assignment to the next available variable.
          parts.push(stack.push(inputChunk));
          inputChunk = stack.pop();
          thenFn = bc => {
            // The bc[0] is an ACCEPT_N, and bc[1] is the N. We've already done
            // the assignment (before the if), so we just need to bump the
            // stack, and increment $this->peg_currPos appropriately.
            stack.sp++;
            const code = compile(bc.slice(2));
            code.unshift(
              inputChunkLength > 1
                ? "$this->peg_currPos += " + inputChunkLength + ";"
                : "$this->peg_currPos++;"
            );
            return code;
          };
        }
        compileCondition(condFn(inputChunk, thenFn !== null), argCount, thenFn);
      }

      function compileLoop(cond) {
        const baseLength = 2;
        const bodyLength = bc[ip + baseLength - 1];
        let bodyCode = undefined;

        stack.checkedLoop(ip, () => {
          ip += baseLength;
          bodyCode = compile(bc.slice(ip, ip + bodyLength));
          ip += bodyLength;
        });

        parts.push("while (" + cond + ") {");
        parts.push(...bodyCode.map(line => indent(4, line)));
        parts.push("}");
      }

      /*
       * Extracted into a function just to silence JSHint complaining about
       * creating functions in a loop.
       */
      function stackIndex(p) {
        return stack.index(p);
      }

      function compileCall(baseLength) {
        const paramsLength = bc[ip + baseLength - 1];

        return f(bc[ip + 1])
          + "("
          + bc.slice(ip + baseLength, ip + baseLength + paramsLength).map(
            p => stackIndex(p)
          ).join(", ")
          + ")";
      }

      while (ip < end) {
        switch (bc[ip]) {
          case op.PUSH_EMPTY_STRING:     // PUSH_EMPTY_STRING
            parts.push(stack.push("\"\""));
            ip++;
            break;

          case op.PUSH_UNDEFINED:        // PUSH_UNDEFINED
            parts.push(stack.push("null"));
            ip++;
            break;

          case op.PUSH_NULL:             // PUSH_NULL
            parts.push(stack.push("null"));
            ip++;
            break;

          case op.PUSH_FAILED:           // PUSH_FAILED
            parts.push(stack.push("$this->peg_FAILED"));
            ip++;
            break;

          case op.PUSH_EMPTY_ARRAY:      // PUSH_EMPTY_ARRAY
            parts.push(stack.push("[]"));
            ip++;
            break;

          case op.PUSH_CURR_POS:         // PUSH_CURR_POS
            parts.push(stack.push("$this->peg_currPos"));
            ip++;
            break;

          case op.POP:                   // POP
            stack.pop();
            ip++;
            break;

          case op.POP_CURR_POS:          // POP_CURR_POS
            parts.push("$this->peg_currPos = " + stack.pop() + ";");
            ip++;
            break;

          case op.POP_N:                 // POP_N n
            stack.pop(bc[ip + 1]);
            ip += 2;
            break;

          case op.NIP:                   // NIP
            value = stack.pop();
            stack.pop();
            parts.push(stack.push(value));
            ip++;
            break;

          case op.APPEND:                // APPEND
            value = stack.pop();
            parts.push(stack.top() + "[] = " + value + ";");
            ip++;
            break;

          case op.WRAP:                  // WRAP n
            parts.push(
              stack.push("[" + stack.pop(bc[ip + 1]).join(", ") + "]")
            );
            ip += 2;
            break;

          case op.TEXT:                  // TEXT
            stackTop = stack.pop();
            parts.push(stack.push(
              inputSubstr(
                stackTop,
                "$this->peg_currPos - " + stackTop
              )
            ));
            ip++;
            break;

          case op.PLUCK: {               // PLUCK n, k, p1, ..., pK
            const baseLength = 3;
            const paramsLength = bc[ip + baseLength - 1];
            const n = baseLength + paramsLength;
            value = bc.slice(ip + baseLength, ip + n);
            value = (paramsLength === 1)
              ? stack.index(value[0])
              : `[ ${
                value.map(p => stackIndex(p)).join(", ")
              } ]`;
            stack.pop(bc[ip + 1]);
            parts.push(stack.push(value));
            ip += n;
            break;
          }

          case op.IF:                   // IF t, f
            compileCondition(stack.top(), 0);
            break;

          case op.IF_ERROR:              // IF_ERROR t, f
            compileCondition(stack.top() + " === $this->peg_FAILED", 0);
            break;

          case op.IF_NOT_ERROR:          // IF_NOT_ERROR t, f
            compileCondition(stack.top() + " !== $this->peg_FAILED", 0);
            break;

          case op.WHILE_NOT_ERROR:       // WHILE_NOT_ERROR b
            compileLoop(stack.top() + " !== $this->peg_FAILED", 0);
            break;

          case op.MATCH_ANY:             // MATCH_ANY a, f, ...
            compileCondition("$this->input_length > $this->peg_currPos", 0);
            break;

          case op.MATCH_STRING: {        // MATCH_STRING s, a, f, ...
            const litNum = bc[ip + 1];
            compileInputChunkCondition(
              inputChunk => `${inputChunk} === ${l(litNum)}`,
              1,
              [...ast.literals[litNum]].length // length of literal in terms of code points
            );
            break;
          }

          case op.MATCH_STRING_IC: {     // MATCH_STRING_IC s, a, f, ...
            const litNum = bc[ip + 1];
            compileInputChunkCondition(
              inputChunk => `\\mb_strtolower(${inputChunk}, "UTF-8") === ${l(litNum)}`,
              1,
              [...ast.literals[litNum]].length // length of literal in terms of code points
            );
            break;
          }

          case op.MATCH_CHAR_CLASS: {    // MATCH_CHAR_CLASS c, a, f, ...
            const regNum = bc[ip + 1];
            compileInputChunkCondition(
              inputChunk => `peg_regex_test(${c(regNum)}, ${inputChunk})`,
              1,
              1
            );
            break;
          }

          case op.ACCEPT_N:               // ACCEPT_N n
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

          case op.ACCEPT_STRING:          // ACCEPT_STRING s
            parts.push(stack.push(l(bc[ip + 1])));
            const length = [...ast.literals[bc[ip + 1]]].length; // length of value in terms of code points
            parts.push(
              length > 1
                ? `$this->peg_currPos += ${length};`
                : "$this->peg_currPos++;"
            );
            ip += 2;
            break;

          case op.FAIL:                  // FAIL e
            parts.push(stack.push("$this->peg_FAILED"));
            parts.push("if ($this->peg_silentFails === 0) {");
            parts.push("    $this->peg_fail(" + e(bc[ip + 1]) + ");");
            parts.push("}");
            ip += 2;
            break;

          case op.IF_LT:                 // IF_LT min, t, f
            compileCondition("\\count(" + stack.top() + ") < " + bc[ip + 1], 1);
            break;

          case op.IF_GE:                 // IF_GE max, t, f
            compileCondition("\\count(" + stack.top() + ") >= " + bc[ip + 1], 1);
            break;

          case op.IF_LT_DYNAMIC:         // IF_LT_DYNAMIC min, t, f
            value = stack.index(bc[ip + 1]);
            compileCondition("\\is_numeric(" + value + ") ? \\count(" + stack.top() + ") < " + value + " : false", 1);
            break;

          case op.IF_GE_DYNAMIC:         // IF_GE_DYNAMIC max, t, f
            value = stack.index(bc[ip + 1]);
            compileCondition("\\is_numeric(" + value + ") ? \\count(" + stack.top() + ") >= " + value + " : true", 1);
            break;

          case op.LOAD_SAVED_POS:        // LOAD_SAVED_POS p
            parts.push("$this->peg_reportedPos = " + stack.index(bc[ip + 1]) + ";");
            ip += 2;
            break;

          case op.UPDATE_SAVED_POS:      // UPDATE_SAVED_POS
            parts.push("$this->peg_reportedPos = $this->peg_currPos;");
            ip++;
            break;

          case op.CALL:                  // CALL f, n, pc, p1, p2, ..., pN
            value = compileCall(4);
            stack.pop(bc[ip + 2]);
            parts.push(stack.push(value));
            ip += 4 + bc[ip + 3];
            break;

          case op.RULE:                  // RULE r
            parts.push(stack.push("$this->" + name(ast.rules[bc[ip + 1]].name) + "()"));
            ip += 2;
            break;

          case op.SILENT_FAILS_ON:       // SILENT_FAILS_ON
            parts.push("$this->peg_silentFails++;");
            ip++;
            break;

          case op.SILENT_FAILS_OFF:      // SILENT_FAILS_OFF
            parts.push("$this->peg_silentFails--;");
            ip++;
            break;

          default:
            throw new Error("Invalid opcode: " + bc[ip] + ".", { rule: rule.name, bytecode: bc });
        }
      }

      return parts;
    }

    const code = compile(rule.bytecode);

    parts.push(
      "private function " + name(rule.name) + "(): mixed",
      "{"
    );

    if (options.cache) {
      parts.push(...generateCacheHeader(
        asts.indexOfRule(ast, rule.name)
      ).map(line => indent(4, line)));
    }

    parts.push(...code.map(line => indent(4, line)));

    if (options.cache) {
      parts.push(...generateCacheFooter(stack.result())
        .map(line => indent(4, line)));
    }

    parts.push(
      "",
      "    return " + stack.result() + ";",
      "}",
      ""
    );

    return parts;
  }

  //
  // Start collection of code for parser output
  //
  const parts = [];

  parts.push(...header);

  if (typeof options.phpeggy.header === "string") {
    parts.push(
      options.phpeggy.header,
      ""
    );
  }

  parts.push(
    "declare(strict_types=1);",
    ""
  );

  if (phpNamespace) {
    parts.push(
      "namespace " + phpNamespace + ";",
      ""
    );
  }

  // Global initializer
  if (ast.topLevelInitializer) {
    const topLevel = Array.isArray(ast.topLevelInitializer)
      ? ast.topLevelInitializer
      : [ast.topLevelInitializer];
    // Put library code before code using it.
    for (const topLevelInitializer of topLevel.slice().reverse()) {
      const topLevelInitializerCode = internalUtils.extractPhpCode(
        topLevelInitializer.code.trim()
      );
      if (topLevelInitializerCode !== "") {
        parts.push(
          topLevelInitializerCode,
          ""
        );
      }
    }
  }

  parts.push(...utilityFunctions(
    phpGlobalNamePrefixOrNamespaceEscaped
  ));

  parts.push(...syntaxErrorClass(
    phpGlobalNamePrefixOrNamespaceEscaped,
    phpGlobalNamespacePrefix
  ));

  parts.push(...dataStorageClasses(
    phpGlobalNamePrefixOrNamespaceEscaped
  ));

  parts.push(
    "class " + phpParserClass,
    "{"
  );

  parts.push(...[
    ...options.cache
      ? ["/** @var pegCacheItem[] */",
          "public array $peg_cache = [];",
          ""]
      : [],

    "private int $peg_currPos = 0;",
    "private int $peg_reportedPos = 0;",
    "private int $peg_cachedPos = 0;",
    "private pegCachedPosDetails $peg_cachedPosDetails;",
    "private int $peg_maxFailPos = 0;",
    "/** @var pegExpectation[] $peg_maxFailExpected */",
    "private array $peg_maxFailExpected = [];",
    "private int $peg_silentFails = 0;", // 0 = report failures, > 0 = silence failures
    "/** @var string[] $input */",
    "private array $input = [];",
    "/** @var array<string, mixed> $options */",
    "private array $options = [];",
    "private int $input_length = 0;",
    "private " + phpGlobalNamespacePrefix + "stdClass $peg_FAILED;",
    'private string $peg_source = "";',
    "",
  ].map(line => indent(4, line)));

  parts.push(...[
    ...generateTablesDeclaration(),
    "",
  ].map(line => indent(4, line)));

  // Constructor start
  parts.push(...[
    "public function __construct()",
    "{",
    "    $this->peg_FAILED = new " + phpGlobalNamespacePrefix + "stdClass();",
    "    $this->peg_cachedPosDetails = new pegCachedPosDetails();",
  ].map(line => indent(4, line)));

  parts.push(...generateTablesDefinition().map(line => indent(8, line)));

  parts.push(...[
    "}",
    "",
  ].map(line => indent(4, line)));
  // Constructor end

  // Grammar-provided methods
  if (ast.initializer) {
    const astInitializer = Array.isArray(ast.initializer)
      ? ast.initializer
      : [ast.initializer];
    for (const initializer of astInitializer) {
      const initializerCode = internalUtils.extractPhpCode(
        initializer.code.trim()
      );
      if (initializerCode !== "") {
        parts.push(...[
          initializerCode,
          "",
        ].map(line => indent(4, line)));
      }
    }
  }

  // START public function parse
  parts.push(...[
    "/**",
    " * @param string|string[] $input",
    " * @param mixed[] $args",
    " * @throws " + phpGlobalNamespacePrefix + "Exception",
    " * @throws SyntaxError",
    " */",
    "public function parse(",
    "    $input,",
    "    array ...$args",
    "): mixed {",
  ].map(line => indent(4, line)));

  parts.push(...[
    "$this->peg_cleanup_state();",
    "$this->options = $args[0] ?? [];",
    "if (\\is_array($input)) {",
    "    $this->input = $input;",
    "} else {",
    '    \\preg_match_all("/./us", $input, $match);',
    "    $this->input = $match[0];",
    "}",
    "$this->input_length = \\count($this->input);",
    '$this->peg_source = $this->options["grammarSource"] ?? "";',
    "",
  ].map(line => indent(8, line)));

  parts.push(...[
    "$old_regex_encoding = (string) \\mb_regex_encoding();",
    '\\mb_regex_encoding("UTF-8");',
    "",
  ].map(line => indent(8, line)));

  parts.push(...[
    "if (method_exists($this, 'initialize')) {",
    "    $this->initialize();",
    "}",
    "",
  ].map(line => indent(8, line)));

  const startRuleFunctions = options.allowedStartRules.map(
    ruleName => '"' + ruleName + '" => [$this, "' + name(ruleName) + '"]'
  ).join(", ");

  parts.push(...[
    "$peg_startRuleFunctions = [" + startRuleFunctions + "];",
    '$peg_startRuleFunction = [$this, "' + name(options.allowedStartRules[0]) + '"];',
  ].map(line => indent(8, line)));

  parts.push(...[
    'if (isset($this->options["startRule"])) {',
    '    if (!isset($peg_startRuleFunctions[$this->options["startRule"]])) {',
    "        throw new " + phpGlobalNamespacePrefix + 'Exception("Can\'t start parsing from rule \\"" . $this->options["startRule"] . "\\".");',
    "    }",
    "",
    '    $peg_startRuleFunction = $peg_startRuleFunctions[$this->options["startRule"]];',
    "}",
    "",
    "/* @var mixed $peg_result */",
    "$peg_result = \\call_user_func($peg_startRuleFunction);",
    "",
  ].map(line => indent(8, line)));

  if (options.cache) {
    parts.push(...[
      "$this->peg_cache = [];",
      "",
    ].map(line => indent(8, line)));
  }

  parts.push(...[
    "\\mb_regex_encoding($old_regex_encoding);",
    "",
  ].map(line => indent(8, line)));

  parts.push(...[
    "if ($peg_result !== $this->peg_FAILED && $this->peg_currPos === $this->input_length) {",
    "    $this->peg_cleanup_state();", // Free up memory
    "    return $peg_result;",
    "}",
    "",
    "if ($peg_result !== $this->peg_FAILED && $this->peg_currPos < $this->input_length) {",
    '    $this->peg_fail(new pegExpectation("end", "end of input"));',
    "}",
    "",
    "$exception = $this->peg_buildException(null, $this->peg_maxFailExpected, $this->peg_maxFailPos);",
    "$this->peg_cleanup_state();", // Free up memory
    "throw $exception;",
  ].map(line => indent(8, line)));

  parts.push(
    "    }",
    ""
  );
  // END public function parse

  parts.push(...commonMethods(options.cache).map(line => indent(4, line)));

  parts.push(...generateFunctions().map(line => indent(4, line)));

  ast.rules.forEach(rule => {
    parts.push(...generateRuleFunction(rule).map(line => indent(4, line)));
  });
  // Remove empty line
  parts.pop();

  parts.push(
    "};",
    ""
  );

  ast.code = parts.join("\n");
};
/*
 *   The MIT License (MIT)
 *
 *   Copyright (c) 2014-2023 The PHPeggy AUTHORS
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
