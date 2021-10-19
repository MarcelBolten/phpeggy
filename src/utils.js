"use strict";

exports.quote = function(str) {
  return '"' + stringEscape(str) + '"';
};

// Matches: /** <?php
const regexPhpStart = /\/\*\*\s*<\?php/;
// Matches: ?> **/
const regexPhpEnd = /\?>\s*\*\*\//;
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

/* eslint-disable no-control-regex */

// Code from peggy
// It was public on v. 1.1.0 but converted into private in version 1.2.0 (copying here to make phpeggy to work)

function stringEscape(s) {
  /*
   * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a string
   * literal except for the closing quote character, backslash, carriage
   * return, line separator, paragraph separator, and line feed. Any character
   * may appear in the form of an escape sequence.
   *
   * For portability, we also escape all control and non-ASCII characters.
   */
  return s
    .replace(/\\/g, "\\\\")  // Backslash
    .replace(/"/g, "\\\"")   // Closing double quote
    .replace(/\0/g, "\\0")   // Null
    .replace(/\x08/g, "\\b") // Backspace
    .replace(/\t/g, "\\t")   // Horizontal tab
    .replace(/\n/g, "\\n")   // Line feed
    .replace(/\v/g, "\\v")   // Vertical tab
    .replace(/\f/g, "\\f")   // Form feed
    .replace(/\r/g, "\\r")   // Carriage return
    .replace(/[\x00-\x0F]/g, ch => "\\x0" + hex(ch))
    .replace(/[\x10-\x1F\x7F-\xFF]/g, ch => "\\x" + hex(ch))
    .replace(/[\u0100-\u0FFF]/g, ch => "\\u0" + hex(ch))
    .replace(/[\u1000-\uFFFF]/g, ch => "\\u" + hex(ch));
}

function hex(ch) {
  return ch.charCodeAt(0).toString(16).toUpperCase();
}

