"use strict";

const js = require("peggy/lib/compiler/js");

exports.quote = function(str) {
  return '"' + js.stringEscape(str) + '"';
};

// Matches: /** <?php
const regexPhpStart = /\/\*\*\s*<\?php/;
// Matches: ?> **/
const regexPhpEnd   = /\?>\s*\*\*\//;
// Matches either kind of delimiter
const regexPhpDelimiters = new RegExp(
  "(" + regexPhpStart.source + "|" + regexPhpEnd.source + ")"
);

exports.extractPhpCode = function(code) {
  const codePieces = code.split(regexPhpDelimiters);
  let phpCode = "";
  let insidePhp = false;
  codePieces.forEach(piece => {
    if (regexPhpStart.test(piece)) {
      insidePhp = true;
    } else if (regexPhpEnd.test(piece)) {
      insidePhp = false;
    } else if (insidePhp) {
      phpCode += piece;
    }
  });
  return phpCode ? phpCode : code;
};
