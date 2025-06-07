"use strict";

const visitor = require("peggy/lib/compiler/visitor");

module.exports = function(ast, _options, session) {
  const annotate = visitor.build({
    class(node) {
      // Need unicode modifier (u) for preg_match() if multibyte characters are part of class
      if (node.unicode === false
        && node.parts.flat().some(part => part.codePointAt(0) > 0x7F)
      ) {
        session.info(
          "Setting unicode flag for class at location:",
          node.location
        );
        node.unicode = true;
      }
    },
  });

  annotate(ast);
};
