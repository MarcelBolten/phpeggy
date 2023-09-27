"use strict";

module.exports = function(
  phpGlobalNamePrefixOrNamespaceEscaped,
  phpGlobalNamespacePrefix
) {
  return [
    "/* Syntax error exception */",
    `if (!\\class_exists("${phpGlobalNamePrefixOrNamespaceEscaped}SyntaxError", false)) {`,
    `    class SyntaxError extends ${phpGlobalNamespacePrefix}Exception`,
    "    {",
    '        public string $name = "SyntaxError";',
    "",
    "        /**",
    "         * @param pegExpectation[]|null $expected",
    "         */",
    "        public function __construct(",
    "            ?string $message,",
    "            public ?array $expected,",
    "            public string $found,",
    "            public int $grammarOffset,",
    "            public int $grammarLine,",
    "            public int $grammarColumn,",
    "            public pegLocation $location",
    "        ) {",
    '            parent::__construct($message ?? "", 0);',
    "        }",
    "",
    "        /**",
    "         * @param array<int, array<string, string>> $sources",
    "         */",
    "        public function format(",
    "            array $sources",
    // $sources = [["source" => "User input", "text" => $user_input], ["source" => "User input2", "text" => $user_input2], ...]
    "        ): string {",
    '            $str = $this->name . ": " . $this->message;',
    "            if (!empty($this->location->source)) {",
    "                $src = null;",
    "                for ($k = 0; $k < \\count($sources); $k++) {",
    '                    if ($sources[$k]["source"] === $this->location->source) {',
    '                        $src = \\preg_split("/\\r\\n|\\n|\\r/", $sources[$k]["text"]);',
    "                        break;",
    "                    }",
    "                }",
    "                $start = $this->location->start;",
    '                $loc = $this->location->source . ":" . $start->line . ":" . $start->column;',
    "                if ($src) {",
    "                    $end = $this->location->end;",
    '                    $filler = $this->peg_padEnd("", $start->line !== 0 ? (int) \\floor(\\log10($start->line) + 1) : 1);',
    "                    $line = $src[$start->line - 1];",
    "                    $last = $start->line === $end->line ? $end->column : \\strlen($line) + 1;",
    "                    $hatLen = ($last - $start->column) ?: 1;",
    '                    $str .= "\\n --> " . $loc . "\\n"',
    '                        . $filler . " |\\n"',
    '                        . $start->line . " | " . $line . "\\n"',
    '                        . $filler . " | " . $this->peg_padEnd("", $start->column - 1)',
    '                        . $this->peg_padEnd("", $hatLen, "^");',
    "                } else {",
    '                    $str .= "\\n at " . $loc;',
    "                }",
    "            }",
    "            return $str;",
    "        }",
    "",
    "        private function peg_padEnd(",
    "            string $str,",
    "            int $targetLength,",
    '            string $padString = " "',
    "        ): string {",
    "            if (\\strlen($str) > $targetLength) {",
    "                return $str;",
    "            }",
    "            $targetLength -= \\strlen($str);",
    "            $padString .= \\str_repeat($padString, $targetLength);",
    "            return $str . \\substr($padString, 0, $targetLength);",
    "        }",
    "    }",
    "}",
    "",
  ];
};
