<?php
/**
 * Generated by Peggy 3.0.1 with PHPeggy plugin 2.0.0
 *
 * https://peggyjs.org/
 * https://github.com/marcelbolten/phpeggy
 */

declare(strict_types=1);

namespace PHPeggy;

/* BEGIN Utility functions */
/* chr_unicode - get unicode character from its char code */
if (!\function_exists("PHPeggy\\chr_unicode")) {
    /** @param float|int $code */
    function chr_unicode(
        $code
    ): string {
        return \html_entity_decode("&#" . (int) $code .";", ENT_QUOTES, "UTF-8");
    }
}

/* ord_unicode - get unicode char code from string */
if (!\function_exists("PHPeggy\\ord_unicode")) {
    function ord_unicode(
        string $character
    ): int {
        if (\strlen($character) === 1) {
            return \ord($character);
        }
        $json = \json_encode($character, \JSON_THROW_ON_ERROR);
        $utf16_1 = (int) \hexdec(\substr($json, 3, 4));
        if (substr($json, 7, 2) === "\u") {
            $utf16_2 = (int) \hexdec(\substr($json, 9, 4));
            return 0x10000 + (($utf16_1 & 0x3ff) << 10) + ($utf16_2 & 0x3ff);
        }

        return $utf16_1;
    }
}

/* peg_regex_test - multibyte regex test */
if (!\function_exists("PHPeggy\\peg_regex_test")) {
    function peg_regex_test(
        string $pattern,
        string $string
    ): bool {
        if ($pattern[-1] === "i") {
            return \mb_eregi(\substr($pattern, 1, -2), $string);
        }

        return \mb_ereg(\substr($pattern, 1, -1), $string);
    }
}
/* END Utility functions */

/* Syntax error exception */
if (!\class_exists("PHPeggy\\SyntaxError", false)) {
    class SyntaxError extends \Exception
    {
        public string $name = "SyntaxError";

        /**
         * @param pegExpectation[]|null $expected
         */
        public function __construct(
            ?string $message,
            public ?array $expected,
            public string $found,
            public int $grammarOffset,
            public int $grammarLine,
            public int $grammarColumn,
            public pegLocation $location
        ) {
            parent::__construct($message ?? "", 0);
        }

        /**
         * @param array<int, array<string, string>> $sources
         */
        public function format(
            array $sources
        ): string {
            $str = $this->name . ": " . $this->message;
            if (!empty($this->location->source)) {
                $src = null;
                for ($k = 0; $k < \count($sources); $k++) {
                    if ($sources[$k]["source"] === $this->location->source) {
                        $src = \preg_split("/\r\n|\n|\r/", $sources[$k]["text"]);
                        break;
                    }
                }
                $start = $this->location->start;
                $loc = $this->location->source . ":" . $start->line . ":" . $start->column;
                if ($src) {
                    $end = $this->location->end;
                    $filler = $this->peg_padEnd("", $start->line !== 0 ? (int) \floor(\log10($start->line) + 1) : 1);
                    $line = $src[$start->line - 1];
                    $last = $start->line === $end->line ? $end->column : \strlen($line) + 1;
                    $hatLen = ($last - $start->column) ?: 1;
                    $str .= "\n --> " . $loc . "\n"
                        . $filler . " |\n"
                        . $start->line . " | " . $line . "\n"
                        . $filler . " | " . $this->peg_padEnd("", $start->column - 1)
                        . $this->peg_padEnd("", $hatLen, "^");
                } else {
                    $str .= "\n at " . $loc;
                }
            }
            return $str;
        }

        private function peg_padEnd(
            string $str,
            int $targetLength,
            string $padString = " "
        ): string {
            if (\strlen($str) > $targetLength) {
                return $str;
            }
            $targetLength -= \strlen($str);
            $padString .= \str_repeat($padString, $targetLength);
            return $str . \substr($padString, 0, $targetLength);
        }
    }
}

if (!\class_exists("PHPeggy\\pegExpectation", false)) {
    class pegExpectation
    {
        public function __construct(
            public ?string $type = null,
            public ?string $description = null,
            public ?string $value = null,
            public ?string $ignoreCase = null
        ) {
        }
    }
}

if (!\class_exists("PHPeggy\\pegCacheItem", false)) {
    class pegCacheItem
    {
        public function __construct(
            public int $nextPos,
            public mixed $result
        ) {
        }
    }
}

if (!\class_exists("PHPeggy\\pegCachedPosDetails", false)) {
    class pegCachedPosDetails
    {
        public function __construct(
            public int $line = 1,
            public int $column = 1,
            public bool $seenCR = false
        ) {
        }
    }
}

if (!\class_exists("PHPeggy\\pegLocation", false)) {
    class pegLocation
    {
        public function __construct(
            public string $source,
            public pegPosition $start,
            public pegPosition $end
        ) {
        }
    }
}

if (!\class_exists("PHPeggy\\pegPosition", false)) {
    class pegPosition
    {
        public function __construct(
            public int $offset,
            public int $line,
            public int $column
        ) {
        }
    }
}

if (!\class_exists("PHPeggy\\pegRange", false)) {
    class pegRange
    {
        public function __construct(
            public string $source,
            public int $start,
            public int $end
        ) {
        }
    }
}

class Parser
{
    private int $peg_currPos = 0;
    private int $peg_reportedPos = 0;
    private int $peg_cachedPos = 0;
    private pegCachedPosDetails $peg_cachedPosDetails;
    private int $peg_maxFailPos = 0;
    /** @var pegExpectation[] $peg_maxFailExpected */
    private array $peg_maxFailExpected = [];
    private int $peg_silentFails = 0;
    /** @var string[] $input */
    private array $input = [];
    /** @var array<string, mixed> $options */
    private array $options = [];
    private int $input_length = 0;
    private \stdClass $peg_FAILED;
    private string $peg_source = "";

    private string $peg_c0 = "/^[a-z0-9]/i";
    private string $peg_c1 = "/^['\"]/";
    private string $peg_c2 = "/^[\\x{000FF}-\\x{00100}]/";
    private string $peg_c3 = "/^[\\x{02E80}-\\x{02FD5}\\x{03400}-\\x{04DBF}\\x{04E00}-\\x{09FCC}]/";
    private string $peg_c4 = "/^[\\x{0D83D}]/";
    private string $peg_c5 = "/^[\\x{0DCA9}]/";
    private string $peg_c6 = "/^[ \\t\\r\\n]/";
    private pegExpectation $peg_e0;
    private pegExpectation $peg_e1;
    private pegExpectation $peg_e2;
    private pegExpectation $peg_e3;
    private pegExpectation $peg_e4;
    private pegExpectation $peg_e5;
    private pegExpectation $peg_e6;

    public function __construct()
    {
        $this->peg_FAILED = new \stdClass();
        $this->peg_cachedPosDetails = new pegCachedPosDetails();
        $this->peg_e0 = new pegExpectation("class", "[a-z0-9]", "[a-z0-9]", "true");
        $this->peg_e1 = new pegExpectation("class", "['\\\"]", "['\"]", "false");
        $this->peg_e2 = new pegExpectation("class", "[\\x{000FF}-\\x{00100}]", "[\x{000FF}-\x{00100}]", "false");
        $this->peg_e3 = new pegExpectation("class", "[\\x{02E80}-\\x{02FD5}\\x{03400}-\\x{04DBF}\\x{04E00}-\\x{09FCC}]", "[\x{02E80}-\x{02FD5}\x{03400}-\x{04DBF}\x{04E00}-\x{09FCC}]", "false");
        $this->peg_e4 = new pegExpectation("class", "[\\x{0D83D}]", "[\x{0D83D}]", "false");
        $this->peg_e5 = new pegExpectation("class", "[\\x{0DCA9}]", "[\x{0DCA9}]", "false");
        $this->peg_e6 = new pegExpectation("class", "[ \\t\\r\\n]", "[ \t\r\n]", "false");
    }

    /**
     * @param string|string[] $input
     * @param mixed[] $args
     * @throws \Exception
     * @throws SyntaxError
     */
    public function parse(
        $input,
        array ...$args
    ): mixed {
        $this->peg_cleanup_state();
        $this->options = $args[0] ?? [];
        if (\is_array($input)) {
            $this->input = $input;
        } else {
            \preg_match_all("/./us", $input, $match);
            $this->input = $match[0];
        }
        $this->input_length = \count($this->input);
        $this->peg_source = $this->options["grammarSource"] ?? "";

        $old_regex_encoding = (string) \mb_regex_encoding();
        \mb_regex_encoding("UTF-8");

        if (method_exists($this, 'initialize')) {
            $this->initialize();
        }

        $peg_startRuleFunctions = ["Document" => [$this, "peg_parse_Document"]];
        $peg_startRuleFunction = [$this, "peg_parse_Document"];
        if (isset($this->options["startRule"])) {
            if (!isset($peg_startRuleFunctions[$this->options["startRule"]])) {
                throw new \Exception("Can't start parsing from rule \"" . $this->options["startRule"] . "\".");
            }

            $peg_startRuleFunction = $peg_startRuleFunctions[$this->options["startRule"]];
        }

        /* @var mixed $peg_result */
        $peg_result = \call_user_func($peg_startRuleFunction);

        \mb_regex_encoding($old_regex_encoding);

        if ($peg_result !== $this->peg_FAILED && $this->peg_currPos === $this->input_length) {
            $this->peg_cleanup_state();
            return $peg_result;
        }
        if ($peg_result !== $this->peg_FAILED && $this->peg_currPos < $this->input_length) {
            $this->peg_fail(new pegExpectation("end", "end of input"));
        }

        $exception = $this->peg_buildException(null, $this->peg_maxFailExpected, $this->peg_maxFailPos);
        $this->peg_cleanup_state();
        throw $exception;
    }

    private function peg_cleanup_state(): void
    {
        $this->peg_currPos = 0;
        $this->peg_reportedPos = 0;
        $this->peg_cachedPos = 0;
        $this->peg_cachedPosDetails = new pegCachedPosDetails();
        $this->peg_maxFailPos = 0;
        $this->peg_maxFailExpected = [];
        $this->peg_silentFails = 0;
        $this->input = [];
        $this->input_length = 0;
        $this->options = [];
        $this->peg_source = "";
    }

    private function input_substr(
        int $start,
        int $length
    ): string {
        if ($length === 1 && $start < $this->input_length) {
            return $this->input[$start];
        }
        $substr = "";
        $max = \min($start + $length, $this->input_length);
        for ($i = $start; $i < $max; $i++) {
            $substr .= $this->input[$i];
        }
        return $substr;
    }

    private function text(): string
    {
        return $this->input_substr($this->peg_reportedPos, $this->peg_currPos - $this->peg_reportedPos);
    }

    private function offset(): int
    {
        return $this->peg_reportedPos;
    }

    private function range(): pegRange
    {
        return new pegRange($this->peg_source, $this->peg_reportedPos, $this->peg_currPos);
    }

    private function location(
        bool $fail = false
    ): pegLocation {
        $start = $this->peg_reportedPos;
        $end = $this->peg_currPos;
        if ($fail) {
            $start = $this->peg_maxFailPos;
            $end = $this->peg_maxFailPos + ($this->peg_maxFailPos < \count($this->input) ? 1 : 0);
        }
        $compute_pd_start = clone $this->peg_computePosDetails($start);
        $compute_pd_end = clone $this->peg_computePosDetails($end);

        return new pegLocation(
            $this->peg_source,
            new pegPosition($start, $compute_pd_start->line, $compute_pd_start->column),
            new pegPosition($end, $compute_pd_end->line, $compute_pd_end->column),
        );
    }

    private function line(): int
    {
        return $this->peg_computePosDetails($this->peg_reportedPos)->line;
    }

    private function column(): int
    {
        return $this->peg_computePosDetails($this->peg_reportedPos)->column;
    }

    /**
     * @throws SyntaxError
     */
    private function expected(
        string $description,
        ?int $where = null
    ): void {
        throw $this->peg_buildException(
            null,
            [new pegExpectation("other", $description)],
            $where ?? $this->peg_reportedPos
        );
    }

    /**
     * @throws SyntaxError
     */
    private function error(
        string $message,
        ?int $where = null
    ): void {
        throw $this->peg_buildException(
            $message,
            null,
            $where ?? $this->peg_reportedPos,
        );
    }

    private function peg_advancePos(
        pegCachedPosDetails $details,
        int $startPos,
        int $endPos
    ): void {
        for ($p = $startPos; $p < $endPos; $p++) {
            $ch = $this->input_substr($p, 1);
            if ($ch === "\n") {
                if (!$details->seenCR) {
                    $details->line++;
                }
                $details->column = 1;
                $details->seenCR = false;
            } elseif ($ch === "\r" || $ch === "\u2028" || $ch === "\u2029") {
                $details->line++;
                $details->column = 1;
                $details->seenCR = true;
            } else {
                $details->column++;
                $details->seenCR = false;
            }
        }
    }

    private function peg_computePosDetails(
        int $pos
    ): pegCachedPosDetails {
        if ($this->peg_cachedPos !== $pos) {
            if ($this->peg_cachedPos > $pos) {
                $this->peg_cachedPos = 0;
                $this->peg_cachedPosDetails = new pegCachedPosDetails();
            }
            $this->peg_advancePos($this->peg_cachedPosDetails, $this->peg_cachedPos, $pos);
            $this->peg_cachedPos = $pos;
        }

        return $this->peg_cachedPosDetails;
    }

    private function peg_fail(
        pegExpectation $expected
    ): void {
        if ($this->peg_currPos < $this->peg_maxFailPos) {
            return;
        }

        if ($this->peg_currPos > $this->peg_maxFailPos) {
            $this->peg_maxFailPos = $this->peg_currPos;
            $this->peg_maxFailExpected = [];
        }

        $this->peg_maxFailExpected[] = $expected;
    }

    private function peg_buildException_expectedComparator(
        pegExpectation $a,
        pegExpectation $b
    ): int {
        return $a->description <=> $b->description;
    }

    /** @param pegExpectation[]|null $expected */
    private function peg_buildException(
        ?string $message,
        ?array $expected,
        int $pos
    ): SyntaxError {
        $posDetails = $this->peg_computePosDetails($pos);
        $found = $pos < $this->input_length ? $this->input[$pos] : null;

        if ($expected !== null) {
            \usort($expected, [$this, "peg_buildException_expectedComparator"]);
            $i = 1;
            while ($i < \count($expected)) {
                if ($expected[$i - 1] === $expected[$i]) {
                    \array_splice($expected, $i, 1);
                } else {
                    $i++;
                }
            }
        }

        if ($message === null && $expected !== null) {
            $expectedDescs = \array_fill(0, \count($expected), null);

            for ($i = 0; $i < \count($expected); $i++) {
                $expectedDescs[$i] = $expected[$i]->description;
            }

            $expectedDesc = \count($expected) > 1
                ? join(", ", \array_slice($expectedDescs, 0, -1))
                    . " or "
                    . ($expectedDescs[\count($expected) - 1] ?? "")
                : $expectedDescs[0] ?? "";

            $foundDesc = $found ? \json_encode($found) : "end of input";

            $message = "Expected " . $expectedDesc . " but " . $foundDesc . " found.";
        }

        return new SyntaxError(
            $message,
            $expected,
            $found ?? "",
            $pos,
            $posDetails->line,
            $posDetails->column,
            $this->location(true)
        );
    }

    private function peg_f0(
        mixed $a,
    ): mixed {
        return ['rule' => 'Letter_Or_Number', 'value' => $a];
    }

    private function peg_f1(
        mixed $a,
    ): mixed {
        return ['rule' => 'Quote', 'value' => $a];
    }

    private function peg_f2(
        mixed $a,
    ): mixed {
        return ['rule' => 'Char_Padding_Test', 'value' => $a];
    }

    private function peg_f3(
        mixed $a,
    ): mixed {
        return ['rule' => 'Chinese_Character', 'value' => $a];
    }

    private function peg_f4(
        mixed $a,
    ): mixed {
        return ['rule' => 'Pile_Of_Poo', 'value' => $a];
    }

    private function peg_f5(
        mixed $content,
    ): mixed {
        return \implode('', $content);
    }

    private function peg_parse_Document(): mixed
    {
        $s0 = [];
        $s1 = $this->peg_parse_Thing();
        if ($s1 !== $this->peg_FAILED) {
            while ($s1 !== $this->peg_FAILED) {
                $s0[] = $s1;
                $s1 = $this->peg_parse_Thing();
            }
        } else {
            $s0 = $this->peg_FAILED;
        }

        return $s0;
    }

    private function peg_parse_Thing(): mixed
    {
        $s0 = $this->peg_parse_Letter_Or_Number();
        if ($s0 === $this->peg_FAILED) {
            $s0 = $this->peg_parse_Quote();
            if ($s0 === $this->peg_FAILED) {
                $s0 = $this->peg_parse_Char_Padding_Test();
                if ($s0 === $this->peg_FAILED) {
                    $s0 = $this->peg_parse_Chinese_Character();
                    if ($s0 === $this->peg_FAILED) {
                        $s0 = $this->peg_parse_Pile_Of_Poo();
                        if ($s0 === $this->peg_FAILED) {
                            $s0 = $this->peg_parse_Whitespace();
                        }
                    }
                }
            }
        }

        return $s0;
    }

    private function peg_parse_Letter_Or_Number(): mixed
    {
        $s0 = $this->peg_currPos;
        if (peg_regex_test($this->peg_c0, $this->input_substr($this->peg_currPos, 1))) {
            $s1 = $this->input_substr($this->peg_currPos, 1);
            $this->peg_currPos++;
        } else {
            $s1 = $this->peg_FAILED;
            if ($this->peg_silentFails === 0) {
                $this->peg_fail($this->peg_e0);
            }
        }
        if ($s1 !== $this->peg_FAILED) {
            $this->peg_reportedPos = $s0;
            $s1 = $this->peg_f0($s1);
        }
        $s0 = $s1;

        return $s0;
    }

    private function peg_parse_Quote(): mixed
    {
        $s0 = $this->peg_currPos;
        if (peg_regex_test($this->peg_c1, $this->input_substr($this->peg_currPos, 1))) {
            $s1 = $this->input_substr($this->peg_currPos, 1);
            $this->peg_currPos++;
        } else {
            $s1 = $this->peg_FAILED;
            if ($this->peg_silentFails === 0) {
                $this->peg_fail($this->peg_e1);
            }
        }
        if ($s1 !== $this->peg_FAILED) {
            $this->peg_reportedPos = $s0;
            $s1 = $this->peg_f1($s1);
        }
        $s0 = $s1;

        return $s0;
    }

    private function peg_parse_Char_Padding_Test(): mixed
    {
        $s0 = $this->peg_currPos;
        if (peg_regex_test($this->peg_c2, $this->input_substr($this->peg_currPos, 1))) {
            $s1 = $this->input_substr($this->peg_currPos, 1);
            $this->peg_currPos++;
        } else {
            $s1 = $this->peg_FAILED;
            if ($this->peg_silentFails === 0) {
                $this->peg_fail($this->peg_e2);
            }
        }
        if ($s1 !== $this->peg_FAILED) {
            $this->peg_reportedPos = $s0;
            $s1 = $this->peg_f2($s1);
        }
        $s0 = $s1;

        return $s0;
    }

    private function peg_parse_Chinese_Character(): mixed
    {
        $s0 = $this->peg_currPos;
        if (peg_regex_test($this->peg_c3, $this->input_substr($this->peg_currPos, 1))) {
            $s1 = $this->input_substr($this->peg_currPos, 1);
            $this->peg_currPos++;
        } else {
            $s1 = $this->peg_FAILED;
            if ($this->peg_silentFails === 0) {
                $this->peg_fail($this->peg_e3);
            }
        }
        if ($s1 !== $this->peg_FAILED) {
            $this->peg_reportedPos = $s0;
            $s1 = $this->peg_f3($s1);
        }
        $s0 = $s1;

        return $s0;
    }

    private function peg_parse_Pile_Of_Poo(): mixed
    {
        $s0 = $this->peg_currPos;
        if (peg_regex_test($this->peg_c4, $this->input_substr($this->peg_currPos, 1))) {
            $s1 = $this->input_substr($this->peg_currPos, 1);
            $this->peg_currPos++;
        } else {
            $s1 = $this->peg_FAILED;
            if ($this->peg_silentFails === 0) {
                $this->peg_fail($this->peg_e4);
            }
        }
        if ($s1 !== $this->peg_FAILED) {
            if (peg_regex_test($this->peg_c5, $this->input_substr($this->peg_currPos, 1))) {
                $s2 = $this->input_substr($this->peg_currPos, 1);
                $this->peg_currPos++;
            } else {
                $s2 = $this->peg_FAILED;
                if ($this->peg_silentFails === 0) {
                    $this->peg_fail($this->peg_e5);
                }
            }
            if ($s2 !== $this->peg_FAILED) {
                $this->peg_reportedPos = $s0;
                $s0 = $this->peg_f4($s1);
            } else {
                $this->peg_currPos = $s0;
                $s0 = $this->peg_FAILED;
            }
        } else {
            $this->peg_currPos = $s0;
            $s0 = $this->peg_FAILED;
        }

        return $s0;
    }

    private function peg_parse_Whitespace(): mixed
    {
        $s0 = $this->peg_currPos;
        $s1 = [];
        if (peg_regex_test($this->peg_c6, $this->input_substr($this->peg_currPos, 1))) {
            $s2 = $this->input_substr($this->peg_currPos, 1);
            $this->peg_currPos++;
        } else {
            $s2 = $this->peg_FAILED;
            if ($this->peg_silentFails === 0) {
                $this->peg_fail($this->peg_e6);
            }
        }
        if ($s2 !== $this->peg_FAILED) {
            while ($s2 !== $this->peg_FAILED) {
                $s1[] = $s2;
                if (peg_regex_test($this->peg_c6, $this->input_substr($this->peg_currPos, 1))) {
                    $s2 = $this->input_substr($this->peg_currPos, 1);
                    $this->peg_currPos++;
                } else {
                    $s2 = $this->peg_FAILED;
                    if ($this->peg_silentFails === 0) {
                        $this->peg_fail($this->peg_e6);
                    }
                }
            }
        } else {
            $s1 = $this->peg_FAILED;
        }
        if ($s1 !== $this->peg_FAILED) {
            $this->peg_reportedPos = $s0;
            $s1 = $this->peg_f5($s1);
        }
        $s0 = $s1;

        return $s0;
    }
};
