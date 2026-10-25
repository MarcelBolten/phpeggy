Document
  = Thing+

Thing
  = Literal_With_Changed_Lower_Case_Length
  / Dotted_I_Capital
  / Dotted_I_Small
  / Whitespace

Literal_With_Changed_Lower_Case_Length
  = a:("İ"i "x") {
    return ['rule' => 'Literal_With_Changed_Lower_Case_Length', 'value' => $a];
  }

Dotted_I_Capital
  = a:"İ" {
    return ['rule' => 'Dotted_I_Capital', 'value' => $a];
  }

Dotted_I_Small
  = a:"i̇" {
    return ['rule' => 'Dotted_I_Small', 'value' => $a];
  }

Whitespace
  = content:[ \t\r\n]+ {
    return \implode('', $content);
  }
