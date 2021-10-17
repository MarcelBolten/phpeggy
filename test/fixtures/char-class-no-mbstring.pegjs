Document
  = Thing+

Thing
  = Letter_Or_Number
  / Quote
  / Char_Padding_Test
  / Chinese_Character
  / Pile_Of_Poo
  / Whitespace

Letter_Or_Number
  = a:[a-zA-Z0-9] {
    return array('rule' => 'Letter_Or_Number', 'value' => $a);
  }

Quote
  = a:['"] {
    return array('rule' => 'Quote', 'value' => $a);
  }

Char_Padding_Test
  = a:[\u00ff-\u0100] {
    return array('rule' => 'Char_Padding_Test', 'value' => $a);
  }

Chinese_Character // https://stackoverflow.com/a/41155368
  = a:[\u2E80-\u2FD5\u3400-\u4DBF\u4E00-\u9FCC] {
    return array('rule' => 'Chinese_Character', 'value' => $a);
  }

// I would have used a character class like \u1f000-\u1ffff here but parsing >2
// byte characters all at once at a time is not supported by PEG.js.  But this
// doesn't work either, because PHP splits 4-byte emoji into one piece, while
// JavaScript handles this as two 2-byte characters.
Pile_Of_Poo
  = a:[\ud83d][\udca9] {
    return array('rule' => 'Pile_Of_Poo', 'value' => $a);
  }

Whitespace
  = content:[ \t\r\n]+ {
    return implode('', $content);
  }
