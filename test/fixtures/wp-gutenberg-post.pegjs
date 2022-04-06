/*
 *
 *    _____       _             _
 *   / ____|     | |           | |
 *  | |  __ _   _| |_ ___ _ __ | |__   ___ _ __ __ _
 *  | | |_ | | | | __/ _ \ '_ \| '_ \ / _ \ '__/ _` |
 *  | |__| | |_| | ||  __/ | | | |_) |  __/ | | (_| |
 *   \_____|\__,_|\__\___|_| |_|_.__/ \___|_|  \__, |
 *                                              __/ |
 *                  GRAMMAR                    |___/
 *
 *
 * Welcome to the grammar file for Gutenberg posts!
 *
 * Please don't be distracted by the functions at the top
 * here - they're just helpers for the grammar below. We
 * try to keep them as minimal and simple as possible,
 * but the parser generator forces us to declare them at
 * the beginning of the file.
 *
 * What follows is the official specification grammar for
 * documents created or edited in Gutenberg. It starts at
 * the top-level rule `Block_List`
 *
 * The grammar is defined by a series of _rules_ and ways
 * to return matches on those rules. It's a _PEG_, a
 * parsing expression grammar, which simply means that for
 * each of our rules we have a set of sub-rules to match
 * on and the generated parser will try them in order
 * until it finds the first match.
 *
 * This grammar is a _specification_ (with as little actual
 * code as we can get away with) which is used by the
 * parser generator to generate the actual _parser_ which
 * is used by Gutenberg. We generate two parsers: one in
 * JavaScript for use the browser and one in PHP for
 * WordPress itself. PEG parser generators are available
 * in many languages, though different libraries may require
 * some translation of this grammar into their syntax.
 *
 * For more information:
 * @see https://pegjs.org
 * @see https://en.wikipedia.org/wiki/Parsing_expression_grammar
 *
 */

{{

/** <?php
// The `maybeJSON` function is not needed in PHP because its return semantics
// are the same as `json_decode`

// array arguments are backwards because of PHP
if (!\function_exists(__NAMESPACE__ . "\\peg_array_partition")) {
    function peg_array_partition(array $array, callable $predicate): array
    {
        $truthy = [];
        $falsey = [];

        foreach ($array as $item) {
            \call_user_func($predicate, $item)
                ? $truthy[] = $item
                : $falsey[] = $item;
        }

        return [$truthy, $falsey];
    }
}

if (!\function_exists(__NAMESPACE__ . "\\peg_join_blocks")) {
    function peg_join_blocks(string $pre, array $tokens, string $post): array
    {
        $blocks = [];

        if (! empty($pre)) {
            $blocks[] = ['attrs' => [], 'innerHTML' => $pre];
        }

        foreach ($tokens as $token) {
            [$token, $html] = $token;

            $blocks[] = $token;

            if (!empty($html)) {
                $blocks[] = ['attrs' => [], 'innerHTML' => $html];
            }
        }

        if (!empty($post)) {
            $blocks[] = ['attrs' => [], 'innerHTML' => $post];
        }

        return $blocks;
    }
}
?> **/
function freeform(s) {
  return s.length && {
    attrs: {},
    innerHTML: s
  };
}

function joinBlocks(pre, tokens, post) {
  var blocks = [], i, l, html, item, token;

  if (pre.length) {
    blocks.push(freeform(pre));
  }

  for (i = 0, l = tokens.length; i < l; i++) {
    item = tokens[ i ];
    token = item[ 0 ];
    html = item[ 1 ];

    blocks.push(token);
    if (html.length) {
      blocks.push(freeform(html));
    }
  }

  if (post.length) {
    blocks.push(freeform(post));
  }

  return blocks;
}

function maybeJSON(s) {
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

function partition(predicate, list) {
  var i, l, item;
  var truthy = [];
  var falsey = [];

  // nod to performance over a simpler reduce
  // and clone model we could have taken here
  for (i = 0, l = list.length; i < l; i++) {
    item = list[ i ];
    predicate(item) ? truthy.push(item) : falsey.push(item);
  };

  return [ truthy, falsey ];
}

}}
//////////////////////////////////////////////////////
//
//   Here starts the grammar proper!
//
//////////////////////////////////////////////////////

Block_List
  = pre:$(!Token .)*
    ts:(t:Token html:$((!Token .)*) { /** <?php return [$t, $html]; ?> **/ return [ t, html ] })*
    post:$(.*)
  { /** <?php return peg_join_blocks($pre, $ts, $post); ?> **/
    return joinBlocks(pre, ts, post);
  }

Token
  = Tag_More
  / Block_Void
  / Block_Balanced

Tag_More
  = "<!--" WS* "more" customText:(WS+ @$((!(WS* "-->") .)+))? WS* "-->" noTeaser:(WS* "<!--noteaser-->")?
  { /** <?php
    $attrs = ['noTeaser' => (bool) $noTeaser];
    if (!empty($customText)) {
        $attrs['customText'] = $customText;
    }
    return [
        'blockName' => 'core/more',
        'attrs' => $attrs,
        'innerHTML' => '',
        'outerHTML' => $this->text(),
    ];
    ?> **/
    return {
      blockName: 'core/more',
      attrs: {
        customText: customText || undefined,
        noTeaser: !! noTeaser
      },
      innerHTML: '',
      outerHTML: text()
    }
  }

Block_Void
  = "<!--" WS+ "wp:" blockName:Block_Name WS+ attrs:(a:Block_Attributes WS+ {
    /** <?php return $a; ?> **/
    return a;
  })? "/-->"
  {
    /** <?php
    return [
        'blockName' => $blockName,
        'attrs' => $attrs,
        'innerBlocks' => [],
        'innerHTML' => '',
        'outerHTML' => $this->text(),
    ];
    ?> **/

    return {
      blockName,
      attrs,
      innerBlocks: [],
      innerHTML: '',
      outerHTML: text()
    };
  }

Block_Balanced
  = s:Block_Start children:(Token / $(!Block_End .))* e:Block_End
  {
    /** <?php
    [$innerHTML, $innerBlocks] = peg_array_partition($children, 'is_string');

    return [
        'blockName' => $s['blockName'],
        'attrs' => $s['attrs'],
        'innerBlocks' => $innerBlocks,
        'innerHTML' => \implode('', $innerHTML),
        'outerHTML' => $this->text(),
    ];
    ?> **/

    var innerContent = partition(function(a) { return 'string' === typeof a }, children);
    var innerHTML = innerContent[ 0 ];
    var innerBlocks = innerContent[ 1 ];

    return {
      blockName: s.blockName,
      attrs: s.attrs,
      innerBlocks,
      innerHTML: innerHTML.join(''),
      outerHTML: text()
    };
  }

Block_Start
  = "<!--" WS+ "wp:" blockName:Block_Name WS+ attrs:(a:Block_Attributes WS+ {
    /** <?php return $a; ?> **/
    return a;
  })? "-->"
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

Block_End
  = "<!--" WS+ "/wp:" blockName:Block_Name WS+ "-->"
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

Block_Name
  = Namespaced_Block_Name
  / Core_Block_Name

Namespaced_Block_Name
  = $(Block_Name_Part "/" Block_Name_Part)

Core_Block_Name
  = type:$(Block_Name_Part)
  {
    /** <?php return "core/$type"; ?> **/
    return 'core/' + type;
  }

Block_Name_Part
  = $([a-z][a-z0-9_-]*)

Block_Attributes
  = attrs:$("{" (!("}" WS+ """/"? "-->") .)* "}")
  {
    /** <?php return \json_decode($attrs, true); ?> **/
    return maybeJSON(attrs);
  }

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
