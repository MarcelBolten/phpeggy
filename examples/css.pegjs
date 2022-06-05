/*
 * ! This is php-compatible version of grammar "pegjs/examples/css.pegjs"
 *
 * CSS parser based on the grammar described at http://www.w3.org/TR/CSS2/grammar.html.
 *
 * The parser builds a tree representing the parsed CSS, composed of basic
 * JavaScript values, arrays and objects (basically JSON). It can be easily
 * used by various CSS processors, transformers, etc.
 *
 * Note that the parser does not handle errors in CSS according to the
 * specification -- many errors which it should recover from (e.g. malformed
 * declarations or unexpected end of stylesheet) are simply fatal. This is a
 * result of straightforward rewrite of the CSS grammar to PEG.js and it should
 * be fixed sometimes.
 */

/* ===== Syntactical Elements ===== */

start
  = @stylesheet comment*

stylesheet
  = charset:(CHARSET_SYM STRINGT ";")? (S / CDO / CDC)*
    imports:(import (CDO S* / CDC S*)*)*
    rules:((ruleset / media / page) (CDO S* / CDC S*)*)*
    {
        $importsConverted = [];
        for ($i = 0; $i < count($imports); $i++) {
            $importsConverted[] = $imports[$i][0];
        }

        $rulesConverted = [];
        for ($i = 0; $i < count($rules); $i++) {
            $rulesConverted[] = $rules[$i][0];
        }

        return [
            "type" => "stylesheet",
            "charset" => $charset !== null ? $charset[1] : null,
            "imports" => $importsConverted,
            "rules" => $rulesConverted,
        ];
    }

import
  = IMPORT_SYM S* href:(STRINGT / URI) S* media:media_list? ";" S*
  {
      return [
          "type" => "import_rule",
          "href" => $href,
          "media" => $media !== null ? $media : [],
      ];
  }

media
  = MEDIA_SYM S* media:media_list "{" S* rules:ruleset* "}" S*
  {
      return [
          "type" => "media_rule",
          "media" => $media,
          "rules" => $rules,
      ];
  }

media_list
  = head:medium tail:("," S* medium)*
  {
      $result = [$head];
      for ($i = 0; $i < count($tail); $i++) {
          $result[] = $tail[$i][2];
      }
      return $result;
  }

medium
  = @IDENTT S*

page
  = PAGE_SYM S* qualifier:pseudo_page?
    "{" S*
    declarationsHead:declaration?
    declarationsTail:(";" S* declaration?)*
    "}" S*
    {
        $declarations = $declarationsHead !== null ? [$declarationsHead] : [];
        for ($i = 0; $i < count($declarationsTail); $i++) {
            if ($declarationsTail[$i][2] !== null) {
                $declarations[] = $declarationsTail[$i][2];
            }
        }

        return [
            "type" => "page_rule",
            "qualifier" => $qualifier,
            "declarations" => $declarations,
        ];
    }

pseudo_page
  = ":" @IDENTT S*

operator
  = @"/" S*

  / @"," S*

combinator
  = @"+" S*

  / @">" S*

unary_operator
  = "+"
  / "-"

property
  = @IDENTT S*

ruleset
  = selectorsHead:selector
    selectorsTail:("," S* selector)*
    "{" S*
    declarationsHead:declaration?
    declarationsTail:(";" S* declaration?)*
    "}" S*
    {
        $selectors = [$selectorsHead];
        for ($i = 0; $i < count($selectorsTail); $i++) {
            $selectors[] = $selectorsTail[$i][2];
        }

        $declarations = $declarationsHead !== null ? [$declarationsHead] : [];
        for ($i = 0; $i < count($declarationsTail); $i++) {
            if ($declarationsTail[$i][2] !== null) {
                $declarations[] = $declarationsTail[$i][2];
            }
        }

        return [
            "type"  => "ruleset",
            "selectors" => $selectors,
            "declarations" => $declarations,
        ];
    }

selector
  = left:simple_selector S* combinator:combinator right:selector
  {
      return [
          "type" => "selector",
          "combinator" => $combinator,
          "left" => $left,
          "right" => $right,
      ];
  }

  / left:simple_selector S* right:selector
  {
      return [
          "type" => "selector",
          "combinator" => " ",
          "left" => $left,
          "right" => $right,
      ];
  }

  / @simple_selector S*

simple_selector
  = element:element_name qualifiers:(
    id:HASH
    {
        return ["type" => "ID selector", "id" => substr($id, 1)];
    }

    / class
    / attrib
    / pseudo
  )*
  {
      return [
          "type" => "simple_selector",
          "element" => $element,
          "qualifiers" => $qualifiers,
      ];
  }

  / qualifiers:(
    id:HASH
    {
        return ["type" => "ID selector", "id" => substr($id, 1)];
    }

    / class
    / attrib
    / pseudo
  )+
  {
      return [
          "type" => "simple_selector",
          "element" => "*",
          "qualifiers" => $qualifiers,
      ];
    }

class
  = "." class_:IDENTT
  {
      return ["type" => "class_selector", "class" => $class_ ];
  }

element_name
  = IDENTT / '*'

attrib
  = "[" S*
    attribute:IDENTT S*
    operatorAndValue:(
      ('=' / INCLUDES / DASHMATCH) S*
      (IDENTT / STRINGT) S*
    )?
    "]"
    {
        return [
            "type" => "attribute_selector",
            "attribute" => $attribute,
            "operator" => $operatorAndValue !== null ? $operatorAndValue[0] : null,
            "value" => $operatorAndValue !== null ? $operatorAndValue[2] : null,
        ];
    }

pseudo
  = ":"
    value:(
      name:FUNCTIONT S* params:(IDENTT S*)? ")"
      {
          return [
              "type" => "function",
              "name" => $name,
              "params" => $params !== null ? [$params[0]] : [],
          ];
      }

      / IDENTT
    )
    {
        /*
         * The returned object has somewhat vague property names and values because
         * the rule matches both pseudo-classes and pseudo-elements (they look the
         * same at the syntactic level).
         */
        return [
            "type" =>  "pseudo_selector",
            "value" => $value,
        ];
    }

declaration
  = property:property ":" S* expression:expr important:prio?
  {
      return [
          "type" => "declaration",
          "property" => $property,
          "expression" => $expression,
          "important" => $important !== null ? true : false,
      ];
  }

prio
  = IMPORTANT_SYM S*

expr
  = head:term tail:(operator? term)*
  {
      $result = $head;
      for ($i = 0; $i < count($tail); $i++) {
          $result = [
              "type" => "expression",
              "operator" => $tail[$i][0],
              "left" => $result,
              "right" => $tail[$i][1],
          ];
      }
      return $result;
  }

term
  = operator:unary_operator?
    value:(
      EMS S*
      / EXS S*
      / LENGTH S*
      / ANGLE S*
      / TIME S*
      / FREQ S*
      / PERCENTAGE S*
      / NUMBER S*
    )
    {
        return [
            "type" => "value",
            "value" => ($operator !== null ? $operator : "") . $value[0],
        ];
    }

  / value:URI S*
  {
      return ["type" => "uri", "value" => $value];
  }

  / function
  / hexcolor
  / value:STRINGT S*
  {
      return ["type" => "string", "value" => $value];
  }

  / value:IDENTT S*
  {
      return ["type" => "ident", "value" => $value];
  }

function
  = name:FUNCTIONT S* params:expr ")" S*
  {
      return [
          "type" => "function",
          "name" => $name,
          "params" => $params,
      ];
  }

hexcolor
  = value:HASH S*
  {
      return ["type" => "hexcolor", "value" => $value];
  }

/* ===== Lexical Elements ===== */

/* Macros */

hex
  = [0-9a-fA-F]

nonascii
  = [\x80-\xFF]

unicode
  = "\\" digits:$(hex hex? hex? hex? hex? hex?) ("\r\n" / [ \t\r\n\f])?
  {
      return chr_unicode(intval($digits, 16));
  }

escape
  = unicode
  / "\\" @[^\r\n\f0-9a-fA-F]

nmstart
  = [_a-zA-Z]
  / nonascii
  / escape

nmchar
  = [_a-zA-Z0-9-]
  / nonascii
  / escape

integer
  = @$[0-9]+

float
  = @$([0-9]* "." [0-9]+)

string1
  = '"' chars:(
    [^\n\r\f\\"]
    / "\\" @nl
    / escape
  )* '"'
  {
      return join("", $chars);
  }

string2
  = "'" chars:(
    [^\n\r\f\\']
    / "\\" @nl
    / escape
  )* "'"
  {
      return join("", $chars);
  }

comment
  = "/*" [^*]* "*"+ ([^/*] [^*]* "*"+)* "/"

ident
  = dash:"-"? nmstart:nmstart nmchars:nmchar*
  {
      return ($dash !== null ? $dash : "") . $nmstart . join("", $nmchars);
  }

name
  = nmchars:nmchar+
  {
      return join("", $nmchars);
  }

num
  = float
  / integer

string
  = string1
  / string2

url
  = chars:([!#$%&*-~] / nonascii / escape)*
  {
      return join("", $chars);
  }

space
  = [ \t\r\n\f]+

w
  = space?

nl
  = "\n"
  / "\r\n"
  / "\r"
  / "\f"

A
  = [aA]
  / "\\" "0"? "0"? "0"? "0"? "41" ("\r\n" / [ \t\r\n\f])?
  {
      return "A";
  }

  / "\\" "0"? "0"? "0"? "0"? "61" ("\r\n" / [ \t\r\n\f])?
  {
      return "a";
  }

C
  = [cC]
  / "\\" "0"? "0"? "0"? "0"? "43" ("\r\n" / [ \t\r\n\f])?
  {
    return "C";
  }

  / "\\" "0"? "0"? "0"? "0"? "63" ("\r\n" / [ \t\r\n\f])?
  {
      return "c";
  }

D
  = [dD]
  / "\\" "0"? "0"? "0"? "0"? "44" ("\r\n" / [ \t\r\n\f])?
  {
      return "D";
  }

  / "\\" "0"? "0"? "0"? "0"? "64" ("\r\n" / [ \t\r\n\f])?
  {
      return "d";
  }

E
  = [eE]
  / "\\" "0"? "0"? "0"? "0"? "45" ("\r\n" / [ \t\r\n\f])?
  {
      return "E";
  }

  / "\\" "0"? "0"? "0"? "0"? "65" ("\r\n" / [ \t\r\n\f])?
  {
      return "e";
  }

G
  = [gG]
  / "\\" "0"? "0"? "0"? "0"? "47" ("\r\n" / [ \t\r\n\f])?
  {
      return "G";
  }

  / "\\" "0"? "0"? "0"? "0"? "67" ("\r\n" / [ \t\r\n\f])?
  {
      return "g";
  }

  / "\\" @[gG]

H
  = hex:[hH]
  / "\\" "0"? "0"? "0"? "0"? "48" ("\r\n" / [ \t\r\n\f])?
  {
      return "H";
  }

  / "\\" "0"? "0"? "0"? "0"? "68" ("\r\n" / [ \t\r\n\f])?
  {
      return "hex";
  }

  / "\\" @[hH]

I
  = i:[iI]
  / "\\" "0"? "0"? "0"? "0"? "49" ("\r\n" / [ \t\r\n\f])?
  {
      return "I";
  }

  / "\\" "0"? "0"? "0"? "0"? "69" ("\r\n" / [ \t\r\n\f])?
  {
      return "i";
  }

  / "\\" @[iI]

K
  = [kK]
  / "\\" "0"? "0"? "0"? "0"? "4" [bB] ("\r\n" / [ \t\r\n\f])?
  {
      return "K";
  }

  / "\\" "0"? "0"? "0"? "0"? "6" [bB] ("\r\n" / [ \t\r\n\f])?
  {
      return "k";
  }

  / "\\" @[kK]

L
  = [lL]
  / "\\" "0"? "0"? "0"? "0"? "4" [cC] ("\r\n" / [ \t\r\n\f])?
  {
      return "L";
  }

  / "\\" "0"? "0"? "0"? "0"? "6" [cC] ("\r\n" / [ \t\r\n\f])?
  {
      return "l";
  }

  / "\\" @[lL]

M
  = [mM]
  / "\\" "0"? "0"? "0"? "0"? "4" [dD] ("\r\n" / [ \t\r\n\f])?
  {
      return "M";
  }

  / "\\" "0"? "0"? "0"? "0"? "6" [dD] ("\r\n" / [ \t\r\n\f])?
  {
      return "m";
  }

  / "\\" @[mM]

N
  = [nN]
  / "\\" "0"? "0"? "0"? "0"? "4" [eE] ("\r\n" / [ \t\r\n\f])?
  {
      return "N";
  }

  / "\\" "0"? "0"? "0"? "0"? "6" [eE] ("\r\n" / [ \t\r\n\f])?
  {
      return "n";
  }

  / "\\" @[nN]

O
  = [oO]
  / "\\" "0"? "0"? "0"? "0"? "4" [fF] ("\r\n" / [ \t\r\n\f])?
  {
      return "O";
  }

  / "\\" "0"? "0"? "0"? "0"? "6" [fF] ("\r\n" / [ \t\r\n\f])?
  {
      return "o";
  }

  / "\\" @[oO]

P
  = [pP]
  / "\\" "0"? "0"? "0"? "0"? "50" ("\r\n" / [ \t\r\n\f])?
  {
      return "P";
  }

  / "\\" "0"? "0"? "0"? "0"? "70" ("\r\n" / [ \t\r\n\f])?
  {
      return "p";
  }

  / "\\" @[pP]

R
  = [rR]
  / "\\" "0"? "0"? "0"? "0"? "52" ("\r\n" / [ \t\r\n\f])?
  {
      return "R";
  }

  / "\\" "0"? "0"? "0"? "0"? "72" ("\r\n" / [ \t\r\n\f])?
  {
      return "r";
  }

  / "\\" @[rR]

S_
  = [sS]
  / "\\" "0"? "0"? "0"? "0"? "53" ("\r\n" / [ \t\r\n\f])?
  {
      return "S";
  }

  / "\\" "0"? "0"? "0"? "0"? "73" ("\r\n" / [ \t\r\n\f])?
  {
      return "s";
  }

  / "\\" @[sS]

T
  = [tT]
  / "\\" "0"? "0"? "0"? "0"? "54" ("\r\n" / [ \t\r\n\f])?
  {
      return "T";
  }

  / "\\" "0"? "0"? "0"? "0"? "74" ("\r\n" / [ \t\r\n\f])?
  {
      return "t";
  }

  / "\\" @[tT]

U
  = [uU]
  / "\\" "0"? "0"? "0"? "0"? "55" ("\r\n" / [ \t\r\n\f])?
  {
      return "U";
  }

  / "\\" "0"? "0"? "0"? "0"? "75" ("\r\n" / [ \t\r\n\f])?
  {
      return "u";
  }

  / "\\" @[uU]

X
  = [xX]
  / "\\" "0"? "0"? "0"? "0"? "58" ("\r\n" / [ \t\r\n\f])?
  {
      return "X";
  }

  / "\\" "0"? "0"? "0"? "0"? "78" ("\r\n" / [ \t\r\n\f])?
  {
      return "x";
  }

  / "\\" @[xX]

Z
  = [zZ]
  / "\\" "0"? "0"? "0"? "0"? "5" [aA] ("\r\n" / [ \t\r\n\f])?
  {
      return "Z";
  }

  / "\\" "0"? "0"? "0"? "0"? "7" [aA] ("\r\n" / [ \t\r\n\f])?
  {
      return "z";
  }

  / "\\" @[zZ]

/* Tokens */

S "whitespace"
  = comment* space

CDO "<!--"
  = comment* "<!--"

CDC "-->"
  = comment* "-->"

INCLUDES "~="
  = comment* "~="

DASHMATCH "|="
  = comment* "|="

STRINGT "string"
  = comment* @string

IDENTT "identifier"
  = comment* @ident

HASH "hash"
  = comment* "#" name:name
  {
      return "#" . $name;
  }

IMPORT_SYM "@import"
  = comment* "@" I M P O R T

PAGE_SYM "@page"
  = comment* "@" P A G E

MEDIA_SYM "@media"
  = comment* "@" M E D I A

CHARSET_SYM "@charset"
  = comment* "@charset "

/* Note: We replace "w" with "space" here to avoid infinite recursion. */
IMPORTANT_SYM "!important"
  = comment* "!" (space / comment)* I M P O R T A N T
  {
      return "!important";
  }

EMS "length"
  = comment* num:num e:E m:M
  {
      return $num . $e . $m;
  }

EXS "length"
  = comment* num:num e:E x:X
  {
      return $num . $e . $x;
  }

LENGTH "length"
  = comment* num:num unit:(P X / C M / M M / I N / P T / P C)
  {
      return $num . join("", $unit);
  }

ANGLE "angle"
  = comment* num:num unit:(D E G / R A D / G R A D)
  {
      return $num . join("", $unit);
  }

TIME "time"
  = comment* num:num unit:(
    m:M s:S_
    {
        return $m . $s;
    }

    / S_
  )
  {
      return $num . $unit;
  }

FREQ "frequency"
  = comment* num:num unit:(H Z / K H Z)
  {
      return $num . join("", $unit);
  }

DIMENSION "dimension"
  = comment* num:num unit:ident
  {
      return $num . $unit;
  }

PERCENTAGE "percentage"
  = comment* @$(num "%")

NUMBER "number"
  = comment* @num

URI "uri"
  = comment* U R L "(" w @(string / url) w ")"

FUNCTIONT "function"
  = comment* @ident "("
