"use strict";

module.exports = function(
  mbstringAllowed
) {
  /*
   * Import all functions definitely used by the generated parser
   * and also import functions frequently used in grammar files.
   */
  return [
    "use function array_fill;",
    "use function array_merge;",
    "use function array_slice;",
    "use function array_splice;",
    "use function call_user_func;",
    "use function class_exists;",
    "use function count;",
    "use function floatval;",
    "use function floor;",
    "use function function_exists;",
    "use function hexdec;",
    "use function html_entity_decode;",
    "use function implode;",
    "use function intval;",
    "use function json_encode;",
    "use function log10;",
    ...mbstringAllowed
      ? ["use function mb_eregi;", "use function mb_regex_encoding;", "use function mb_strlen;", "use function mb_strtolower;"]
      : [],
    "use function min;",
    "use function ord;",
    "use function preg_match_all;",
    "use function preg_split;",
    "use function str_repeat;",
    "use function str_replace;",
    "use function strlen;",
    "use function substr;",
    "use function usort;",
    "",
  ].join("\n");
};
