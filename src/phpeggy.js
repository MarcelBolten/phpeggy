"use strict";

const path = require("path");

exports.use = function(config, options) {
  config.passes.generate = [
    require("./passes/generate-bytecode-php"),
    require("./passes/generate-php"),
  ];

  // Before peggy 4.1 it was possible to use the option output=source
  // and there was no difference between the cli and the js api.
  // However, the cli relies on source.code from the ast.  Compare to
  // https://github.com/peggyjs/peggy/blob/7a8fd86d43ff14ddfd2f1f5034c47bb6db380cc9/bin/peggy-cli.js#L517)
  // We use this dirty hack to detect if we are in the cli or not.
  if (!new Error().stack.includes(path.join("peggy", "bin", "peggy-cli.js"))) {
    options.output = "source";
  }

  if (!options.phpeggy) {
    options.phpeggy = {};
  }

  if (options.phpeggy.parserNamespace === undefined) {
    options.phpeggy.parserNamespace = "PHPeggy";
  }

  if (options.phpeggy.parserClassName === undefined) {
    options.phpeggy.parserClassName = "Parser";
  }
};
/*
 *   The MIT License (MIT)
 *
 *   Copyright (c) 2014-2025 The PHPeggy AUTHORS
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
