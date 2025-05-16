"use strict";

module.exports = function(
  phpGlobalNamePrefixOrNamespaceEscaped
) {
  return [
    "/* BEGIN Utility functions */",
    "/* chr_unicode - get unicode character from its char code */",
    `if (!\\function_exists("${phpGlobalNamePrefixOrNamespaceEscaped}chr_unicode")) {`,
    "    /** @param float|int $code */",
    "    function chr_unicode(",
    "        $code",
    "    ): string {",
    '        return \\html_entity_decode("&#" . (int) $code . ";", ENT_QUOTES, "UTF-8");',
    "    }",
    "}",
    "",
    "/* ord_unicode - get unicode char code from string */",
    `if (!\\function_exists("${phpGlobalNamePrefixOrNamespaceEscaped}ord_unicode")) {`,
    "    function ord_unicode(",
    "        string $character",
    "    ): int {",
    "        if (\\strlen($character) === 1) {",
    "            return \\ord($character);",
    "        }",
    "        $json = \\json_encode($character, \\JSON_THROW_ON_ERROR);",
    "        $utf16_1 = (int) \\hexdec(\\substr($json, 3, 4));",
    // A character inside the BMP has a JSON representation like "\uXXXX".
    // A character outside the BMP looks like "\uXXXX\uXXXX".
    '        if (substr($json, 7, 2) === "\\u") {',
    // Outside the BMP.  Math from https://stackoverflow.com/a/6240819
    "            $utf16_2 = (int) \\hexdec(\\substr($json, 9, 4));",
    "            return 0x10000 + (($utf16_1 & 0x3ff) << 10) + ($utf16_2 & 0x3ff);",
    "        }",
    "",
    "        return $utf16_1;",
    "    }",
    "}",
    "",

    "/* peg_regex_test - multibyte regex test */",
    `if (!\\function_exists("${phpGlobalNamePrefixOrNamespaceEscaped}peg_regex_test")) {`,
    "    function peg_regex_test(",
    "        string $pattern,",
    "        string $string",
    "    ): bool {",
    '        if ($pattern[-1] === "i") {',
    "            return \\mb_eregi(\\substr($pattern, 1, -2), $string);",
    "        }",
    "",
    "        return \\mb_ereg(\\substr($pattern, 1, -1), $string);",
    "    }",
    "}",
    "/* END Utility functions */",
    "",
  ];
};
