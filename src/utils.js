"use strict";

// Matches: /** <?php
const regexPhpStart = /\/\*\*\s*<\?php/;
// Matches: ?> **/
const regexPhpEnd = /\?>\s*\*\*\//;
// Matches either kind of delimiter
const regexPhpDelimiters = new RegExp(
  "(" + regexPhpStart.source + "|" + regexPhpEnd.source + ")"
);

function extractPhpCode(code) {
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
  return phpCode ? phpCode.trim() : code;
}

function hex(ch) {
  return ch.codePointAt(0).toString(16).toUpperCase();
}

function hexPad(ch, len) {
  const hexCode = hex(ch);
  return "0".repeat(len - hexCode.length) + hexCode;
}

function escapePhpRegexp(s) {
  return s
    .replace(/\\/g, "\\\\")        // Backslash
    .replace(/\//g, "\\/")         // Closing slash
    .replace(/\[/g, "\\[")         // Opening [ bracket
    .replace(/\]/g, "\\]")         // Closing ] bracket
    .replace(/\(/g, "\\(")         // Opening ( bracket
    .replace(/\)/g, "\\)")         // Closing ) bracket
    .replace(/\^/g, "\\^")         // Caret
    .replace(/\$/g, "\\$")         // Dollar
    .replace(/([^[])-/g, "$1\\-")  // Dash
    .replace(/\0/g, "\\0")         // Null
    .replace(/\t/g, "\\t")         // Horizontal tab
    .replace(/\n/g, "\\n")         // Line feed
    .replace(/\v/g, "\\x0B")       // Vertical tab
    .replace(/\f/g, "\\f")         // Form feed
    .replace(/\r/g, "\\r")         // Carriage return
    .replace(/[\u{10000}-\u{10FFFF}]/gu,  ch => "\\x{" + hexPad(ch, 6) + "}")
    .replace(/[\u0100-\uFFFF]/g,          ch => "\\x{" + hexPad(ch, 4) + "}")
    .replace(/[\x10-\x1F\x7F-\x9F\xFF]/g, ch => "\\x"  + hex(ch))
    .replace(/[\x00-\x0F]/g,              ch => "\\x0" + hex(ch));
}

function escapePhp(s) {
  return s
    .replace(/\\/g, "\\\\")  // Backslash
    .replace(/"/g, '\\"')    // Closing quote character
    .replace(/\x08/g, "\\b") // Backspace
    .replace(/\t/g, "\\t")   // Horizontal tab
    .replace(/\n/g, "\\n")   // Line feed
    .replace(/\v/g, "\\v")   // Vertical tab
    .replace(/\f/g, "\\f")   // Form feed
    .replace(/\r/g, "\\r")   // Carriage return
    .replace(/\$/g, "\\$")   // Dollar
    .replace(/[\u{10000}-\u{10FFFF}]/gu,  ch => "\\u{" + hexPad(ch, 6) + "}")
    .replace(/[\u0100-\uFFFF]/g,          ch => "\\u{" + hexPad(ch, 4) + "}")
    .replace(/[\x10-\x1F\x7F-\x9F\xFF]/g, ch => "\\x"  + hex(ch))
    .replace(/[\x00-\x0F]/g,              ch => "\\x0" + hex(ch));
}

function quotePhp(s) {
  return '"' + escapePhp(s) + '"';
}

module.exports = {
  extractPhpCode,
  escapePhpRegexp,
  escapePhp,
  quotePhp,
};
