/*
! This is php-compatible version of grammar "peggy/examples/fizzbuzz.peggy"

This grammar aims to have one of every Peggy syntax.
It parses the output of a fizz-buzz (https://en.wikipedia.org/wiki/Fizz_buzz)
program (plus a few extensions) for correctness.
*/
{{
if (!function_exists(__NAMESPACE__ . "\\notFizzBuzz")) {
    function notFizzBuzz($n) {
        foreach ([3, 5] as $value) {
            if ($n % $value === 0) {
                return false;
            }
        }
        return true;
    }
}
}}
{
$this->currentNumber = isset($options["start"]) && is_numeric($options["start"]) ? $options["start"] : 1;
}

top = c:count* {
  return array_values(array_filter($c));
  }

count
  = end_comment nl { return; }
  / comment nl { return; }
  / comment? fb:line (comment / end_comment)? nl {
    $this->currentNumber++;
    return $fb;
  }

comment "comment"
  = _ "/*" (!"*/" .)* "*/" _

end_comment
  = _ "//" [^\n]+

line
  = @n:number &{ return ($n === $this->currentNumber) && notFizzBuzz($n); }
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
