{{

// The `maybeJSON` function is not needed in PHP because its return semantics
// are the same as `json_decode`
// but we need a code block for php so here is an empty one
/** <?php
?> **/

function maybeJSON(s) {
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

}}

Document
  = WP_Block_List

WP_Block_List
  = WP_Block*

WP_Block
  = WP_Block_Void
  / WP_Block_Balanced

WP_Block_Void
  = "<!--" WS+ "wp:" blockName:WP_Block_Name WS+ attrs:(@WP_Block_Attributes WS+)? "/-->"
  {
    /** <?php
    return [
        'blockName' => $blockName,
        'attrs' => $attrs,
        'rawContent' => '',
    ];
    ?> **/

    return {
      blockName,
      attrs,
      rawContent: ''
    };
  }

WP_Block_Balanced
  = s:WP_Block_Start ts:(!WP_Block_End @Any)* e:WP_Block_End & {
    /** <?php return $s['blockName'] === $e['blockName']; ?> **/
    return s.blockName === e.blockName;
  }
  {
    /** <?php
    return [
        'blockName' => $s['blockName'],
        'attrs' => $s['attrs'],
        'rawContent' => \implode('', $ts),
    ];
    ?> **/

    return {
      blockName: s.blockName,
      attrs: s.attrs,
      rawContent: ts.join('')
    };
  }

WP_Block_Start
  = "<!--" WS+ "wp:" blockName:WP_Block_Name WS+ attrs:(@WP_Block_Attributes WS+)? "-->"
  {
    /** <?php
    return [
        'blockName' => $blockName,
        'attrs' => $attrs,
    ];
    ?> **/

    return {
      blockName,
      attrs
    };
  }

WP_Block_End
  = "<!--" WS+ "/wp:" blockName:WP_Block_Name WS+ "-->"
  {
    /** <?php
    return [
        'blockName' => $blockName,
    ];
    ?> **/

    return {
      blockName
    };
  }

WP_Block_Name
  = $(ASCII_Letter (ASCII_AlphaNumeric / "/" ASCII_AlphaNumeric)*)

WP_Block_Attributes
  = attrs:$("{" (!("}" WS+ """/"? "-->") .)* "}")
  {
    /** <?php return \json_decode($attrs, true); ?> **/
    return maybeJSON(attrs);
  }

ASCII_AlphaNumeric
  = ASCII_Letter
  / ASCII_Digit
  / Special_Chars

ASCII_Letter
  = [a-zA-Z]

ASCII_Digit
  = [0-9]

Special_Chars
  = [\-\_]

WS
  = [ \t\r\n]

Newline
  = [\r\n]

_
  = [ \t]

__
  = _+

Any
  = .
