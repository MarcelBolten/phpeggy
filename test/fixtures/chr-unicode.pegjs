Document
  = Thing+

Thing
  = Chr_Unicode_Test
  / Comment
  / Whitespace

Chr_Unicode_Test
  = "\\x" hex_code:[0-9a-f]i+ {
    $chr = chr_unicode(hexdec(implode('', $hex_code)));
    return array(
      'chr' => $chr,
      'ord' => ord_unicode($chr),
    );
  }

Comment
  = delim:"//" text:[^\r\n]* {
    return $delim . implode('', $text);
  }

Whitespace
  = content:[ \t\r\n]+ {
    return implode('', $content);
  }
