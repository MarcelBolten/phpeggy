//
// ! This is php-compatible version of grammar "peggy/examples/arithmetics.pegjs"
//
// Simple Arithmetics Grammar
// ==========================
//
// Accepts expressions like "(2 * (3 + 4) - 5) / 6" and computes their value.
{{
if (!function_exists(__NAMESPACE__ . "\\calculate")) {
    function calculate($result, $element) {
        $operator = $element[1];
        $operand = $element[3];

        if ($operator === "+") {
            return $result + $operand;
        }
        if ($operator === "-") {
            return $result - $operand;
        }
        if ($operator === "*") {
            return $result * $operand;
        }
        if ($operator === "/") {
            return $result / $operand;
        }
    }
}
}}

Expression
  = head:Term tail:(_ ("+" / "-") _ Term)*
  {
    return array_reduce($tail, __NAMESPACE__ . "\\calculate", $head);
  }

Term
  = head:Factor tail:(_ ("*" / "/") _ Factor)*
  {
    return array_reduce($tail, __NAMESPACE__ . "\\calculate", $head);
  }

Factor
  = "(" _ @Expression _ ")"
  / Integer

Integer "integer"
  = _ [0-9]+
  {
    return intval($this->text());
  }

_ "whitespace"
  = [ \t\n\r]*
