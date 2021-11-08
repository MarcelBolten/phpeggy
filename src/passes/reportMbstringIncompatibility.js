"use strict";

const visitor = require("peggy/lib/compiler/visitor");

module.exports = function(ast, options) {
  const mbstringAllowed = (
    typeof options.phpeggy.mbstringAllowed === "undefined"
      ? true
      : options.phpeggy.mbstringAllowed
  );

  function ciErrorMessage(type) {
    return "Case-insensitive " + type + " matching requires the "
    + "`mbstring` PHP extension, but it is disabled "
    + "via `mbstringAllowed: false`.";
  }

  const check = visitor.build({
    literal(node) {
      if (node.value.length > 0 && node.ignoreCase && !mbstringAllowed) {
        throw new Error(ciErrorMessage("string"));
      }
    },
    class(node) {
      if (node.ignoreCase && !mbstringAllowed) {
        throw new Error(ciErrorMessage("character class"));
      }
      if (node.parts.length === 0 && !mbstringAllowed) {
        throw new Error(
          "Empty character class matching requires the "
          + "`mbstring` PHP extension, but it is disabled "
          + "via `mbstringAllowed: false`."
        );
      }
    },
  });

  check(ast);
};
