"use strict";

const visitor = require("peggy/lib/compiler/visitor");

module.exports = function(ast, options, session) {
  const mbstringAllowed = options.phpeggy.mbstringAllowed;

  function errorMessage(prefix) {
    return prefix + " matching requires the "
      + "`mbstring` PHP extension. However, the PHPeggy plugin option "
      + "`mbstringAllowed` is set to `false`.";
  }

  const check = visitor.build({
    literal(node) {
      if (node.value.length > 0 && node.ignoreCase && !mbstringAllowed) {
        session.error(
          errorMessage("Case-insensitive string"),
          node.location
        );
      }
    },
    class(node) {
      if (node.ignoreCase && !mbstringAllowed) {
        session.error(
          errorMessage("Case-insensitive character class"),
          node.location
        );
      }
      if (node.parts.length === 0 && !mbstringAllowed) {
        session.error(
          errorMessage("Empty character class"),
          node.location
        );
      }
    },
  });

  check(ast);
};
