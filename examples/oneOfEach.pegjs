start
  = "a" 'b' . [a-z] next ("x" "y") "a"* "b"+
    "c"|2| "d"|1..2| "e"|1..| "f"|..2|
    int:"2" str:"test" "g"|int| "h"|str| "i"|1..int| "j"|int..3| "k"|..int| "l"|int..|
    "m"|str..| "n"|..str| "o"|1..str| "p"|str..3|
    "q"|{ return 4; }| "r"|{ return "text"; }| "s"|{ return "text"; }..| "t"|..{ return "text"; }|
    "u"? &"v" !"w" or
next
  = "c"

or
  = "z" / "y" / "x"
