/*
! This is php-compatible version of grammar "peggy/examples/fizzbuzz.peggy"

This grammar aims to have one of every Peggy syntax.
It parses the output of a fizz-buzz (https://en.wikipedia.org/wiki/Fizz_buzz)
program (plus a few extensions) for correctness.
*/

{

private int $currentNumber = 1;

private function initialize(): void
{
    $this->currentNumber = isset($this->options["start"])
        && is_int($this->options["start"])
        ? $this->options["start"]
        : 1;
}

private function notFizzBuzz(int $n): bool
{
    foreach ([3, 5] as $value) {
        if ($n % $value === 0) {
            return false;
        }
    }
    return true;
}

}

top = c:count|..| {
  return array_values(array_filter($c));
  }

count
  = end_comment nl { return null; }
  / comment nl { return null; }
  / comment? fb:line (comment / end_comment)? nl {
    $this->currentNumber++;
    return $fb;
  }

comment "comment"
  = _ "/*" (!"*/" .)* "*/" _

end_comment "end of line comment"
  = _ "//" [^\n]+

line
  = @n:number &{ return ($n === $this->currentNumber) && $this->notFizzBuzz($n); }
  / fizzbuzz
  / fizz
  / buzz

fizzbuzz = f:fizz _ b:buzz { return $f . $b; }

fizz = @"fizz"i !{ return $this->currentNumber % 3; }

buzz = @"buzz"i !{ return $this->currentNumber % 5; }

// Arbitrary requirement needing &
number "number without trailing comment"
  = "0x" n:$[0-9a-f]i+ &nl { return intval($n, 16); }
  / n:$[0-9]+ &nl { return intval($n, 10); }

_ "space or tab" = $[ \t]*

nl "newline" = [\n\r]+
