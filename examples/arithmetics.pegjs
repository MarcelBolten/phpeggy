//
// ! This is php-compatible version of grammar "peggy/examples/arithmetics.pegjs"
//
// Simple Arithmetics Grammar
// ==========================
//
// Accepts expressions like "(2 * (3 + 4) - 5) / 6" and computes their value.
{

private function calculate(float $result, array $element): float
{
    $operand = $element[3];

    switch ($element[1]) {
        case "+":
            return $result + $operand;
        case "-":
            return $result - $operand;
        case "*":
            return $result * $operand;
        case "/":
            return $result / $operand;
        default:
            return 0;
    }
}

}

Expression
  = head:Term tail:(_ [+-] _ Term)*
  {
    return array_reduce($tail, [$this, 'calculate'], $head);
  }

Term
  = head:Factor tail:(_ [*/] _ Factor)*
  {
    return array_reduce($tail, [$this, 'calculate'], $head);
  }

Factor
  = "(" _ @Expression _ ")"
  / Integer

Integer "integer"
  = _ int:$[0-9]+
  {
    return intval($int);
  }

_ "whitespace"
  = [ \t\n\r]*
