"use strict";

module.exports = function(useCache) {
  return [
    "private function cleanup_state(): void",
    "{",

    ...useCache
      ? ["    $this->peg_cache = [];"]
      : [],

    "    $this->peg_currPos = 0;",
    "    $this->peg_reportedPos = 0;",
    "    $this->peg_cachedPos = 0;",
    "    $this->peg_cachedPosDetails = new pegCachedPosDetails();",
    "    $this->peg_maxFailPos = 0;",
    "    $this->peg_maxFailExpected = [];",
    "    $this->peg_silentFails = 0;",
    "    $this->input = [];",
    "    $this->input_length = 0;",
    '    $this->peg_source = "";',
    "}",
    "",
    "private function input_substr(",
    "    int $start,",
    "    int $length",
    "): string {",
    "    if ($length === 1 && $start < $this->input_length) {",
    "        return $this->input[$start];",
    "    }",
    '    $substr = "";',
    "    $max = min($start + $length, $this->input_length);",
    "    for ($i = $start; $i < $max; $i++) {",
    "        $substr .= $this->input[$i];",
    "    }",
    "    return $substr;",
    "}",
    "",
    "private function text(): string",
    "{",
    "    return $this->input_substr($this->peg_reportedPos, $this->peg_currPos - $this->peg_reportedPos);",
    "}",
    "",
    "private function offset(): int",
    "{",
    "    return $this->peg_reportedPos;",
    "}",
    "",
    "private function range(): pegRange",
    "{",
    "    return new pegRange($this->peg_source, $this->peg_reportedPos, $this->peg_currPos);",
    "}",
    "",
    "private function location(",
    "    bool $fail = false",
    "): pegLocation {",
    "    $start = $this->peg_reportedPos;",
    "    $end = $this->peg_currPos;",
    "    if ($fail) {",
    "        $start = $this->peg_maxFailPos;",
    "        $end = $this->peg_maxFailPos + ($this->peg_maxFailPos < count($this->input) ? 1 : 0);",
    "    }",
    "    $compute_pd_start = clone $this->peg_computePosDetails($start);",
    "    $compute_pd_end = clone $this->peg_computePosDetails($end);",
    "",
    "    return new pegLocation(",
    "        $this->peg_source,",
    "        new pegPosition($start, $compute_pd_start->line, $compute_pd_start->column),",
    "        new pegPosition($end, $compute_pd_end->line, $compute_pd_end->column),",
    "    );",
    "}",
    "",
    "private function line(): int",
    "{",
    "    return $this->peg_computePosDetails($this->peg_reportedPos)->line;",
    "}",
    "",
    "private function column(): int",
    "{",
    "    return $this->peg_computePosDetails($this->peg_reportedPos)->column;",
    "}",
    "",
    "/**",
    " * @throws SyntaxError",
    " */",
    "private function expected(",
    "    string $description",
    "): void {",
    "    throw $this->peg_buildException(",
    "        null,",
    '        [new pegExpectation("other", $description)],',
    "        $this->peg_reportedPos",
    "    );",
    "}",
    "",
    "/**",
    " * @throws SyntaxError",
    " */",
    "private function error(",
    "    string $message",
    "): void {",
    "    throw $this->peg_buildException($message, null, $this->peg_reportedPos);",
    "}",
    "",
    "private function peg_advancePos(",
    "    pegCachedPosDetails $details,",
    "    int $startPos,",
    "    int $endPos",
    "): void {",
    "    for ($p = $startPos; $p < $endPos; $p++) {",
    "        $ch = $this->input_substr($p, 1);",
    '        if ($ch === "\\n") {',
    "            if (!$details->seenCR) {",
    "                $details->line++;",
    "            }",
    "            $details->column = 1;",
    "            $details->seenCR = false;",
    '        } elseif ($ch === "\\r" || $ch === "\\u2028" || $ch === "\\u2029") {',
    "            $details->line++;",
    "            $details->column = 1;",
    "            $details->seenCR = true;",
    "        } else {",
    "            $details->column++;",
    "            $details->seenCR = false;",
    "        }",
    "    }",
    "}",
    "",
    "private function peg_computePosDetails(",
    "    int $pos",
    "): pegCachedPosDetails {",
    "    if ($this->peg_cachedPos !== $pos) {",
    "        if ($this->peg_cachedPos > $pos) {",
    "            $this->peg_cachedPos = 0;",
    "            $this->peg_cachedPosDetails = new pegCachedPosDetails();",
    "        }",
    "        $this->peg_advancePos($this->peg_cachedPosDetails, $this->peg_cachedPos, $pos);",
    "        $this->peg_cachedPos = $pos;",
    "    }",
    "",
    "    return $this->peg_cachedPosDetails;",
    "}",
    "",
    "private function peg_fail(",
    "    pegExpectation $expected",
    "): void {",
    "    if ($this->peg_currPos < $this->peg_maxFailPos) {",
    "        return;",
    "    }",
    "",
    "    if ($this->peg_currPos > $this->peg_maxFailPos) {",
    "        $this->peg_maxFailPos = $this->peg_currPos;",
    "        $this->peg_maxFailExpected = [];",
    "    }",
    "",
    "    $this->peg_maxFailExpected[] = $expected;",
    "}",
    "",
    "private function peg_buildException_expectedComparator(",
    "    pegExpectation $a,",
    "    pegExpectation $b",
    "): int {",
    "    if ($a->description < $b->description) {",
    "        return -1;",
    "    }",
    "",
    "    if ($a->description > $b->description) {",
    "        return 1;",
    "    }",
    "",
    "    return 0;",
    "}",
    "",
    "/** @param array<int, pegExpectation>|null $expected */",
    "private function peg_buildException(",
    "    ?string $message,",
    "    ?array $expected,",
    "    int $pos",
    "): SyntaxError {",
    "    $posDetails = $this->peg_computePosDetails($pos);",
    "    $found = $pos < $this->input_length ? $this->input[$pos] : null;",
    "",
    "    if ($expected !== null) {",
    '        usort($expected, [$this, "peg_buildException_expectedComparator"]);',
    "        $i = 1;",
    /*
     * This works because the bytecode generator guarantees that every
     * expectation object exists only once, so it's enough to use |===| instead
     * of deeper structural comparison.
     */
    "        while ($i < count($expected)) {",
    "            if ($expected[$i - 1] === $expected[$i]) {",
    "                array_splice($expected, $i, 1);",
    "            } else {",
    "                $i++;",
    "            }",
    "        }",
    "    }",
    "",
    "    if ($message === null && $expected !== null) {",
    "        $expectedDescs = array_fill(0, count($expected), null);",
    "",
    "        for ($i = 0; $i < count($expected); $i++) {",
    "            $expectedDescs[$i] = $expected[$i]->description;",
    "        }",
    "",
    "        $expectedDesc = count($expected) > 1",
    '            ? join(", ", array_slice($expectedDescs, 0, -1))',
    '                . " or "',
    '                . ($expectedDescs[count($expected) - 1] ?? "")',
    '            : $expectedDescs[0] ?? "";',
    "",
    '        $foundDesc = $found ? json_encode($found) : "end of input";',
    "",
    '        $message = "Expected " . $expectedDesc . " but " . $foundDesc . " found.";',
    "    }",
    "",
    "    return new SyntaxError(",
    "        $message,",
    "        $expected,",
    '        $found ?? "",',
    "        $pos,",
    "        $posDetails->line,",
    "        $posDetails->column,",
    "        $this->location(true)",
    "    );",
    "}",
    "",
  ].join("\n");
};
