Document
  = Thing+

Thing
  = Letter_Or_Number
  / Quote
  / Char_Padding_Test
  / Chinese_Character
  / Person_Using_Computer
  / Surfing_Woman_Or_Man
  / Emoji
  / Whitespace
  / Ascii

Letter_Or_Number
  = a:[a-z0-9]i {
    return ['rule' => 'Letter_Or_Number', 'value' => $a];
  }

Quote
  = a:['"] {
    return ['rule' => 'Quote', 'value' => $a];
  }

Ascii
  = a:[\p{ASCII}] {
    return ['rule' => 'Ascii', 'value' => $a];
  }

Char_Padding_Test
  = a:[\u00ff-\u0100] {
    return ['rule' => 'Char_Padding_Test', 'value' => $a];
  }

Chinese_Character // https://stackoverflow.com/a/41155368
  = a:[\u2E80-\u2FD5\u3400-\u4DBF\u4E00-\u9FCC] {
    return ['rule' => 'Chinese_Character', 'value' => $a];
  }

Person_Using_Computer // grapheme clusters, split into class and string literal
  = a:(@[👩👨] // women or man class
    @"\u200D💻" // zero-width joiner + laptop
  ) {
    return ['rule' => 'Person_Using_Computer', 'value' => \implode('', $a)];
  }

Surfing_Woman_Or_Man // grapheme clusters, intentionally as string literal and not as class
  = a:("\u{1F3C4}\u200D\u2640\uFE0F" / "\u{1F3C4}\u200D\u2642\uFE0F") {
    return ['rule' => 'Surfing_Woman_Or_Man', 'value' => $a];
  }

Emoji
  = a:[\u2600-\u27BF\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FC}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAF8}] {
    return ['rule' => 'Emoji', 'value' => $a];
  }

Whitespace
  = content:[ \t\r\n]+ {
    return \implode('', $content);
  }
