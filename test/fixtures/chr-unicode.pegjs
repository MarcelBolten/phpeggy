{

function _chr_unicode( $ch ) {
	if ( function_exists( 'php52_compat_chr_unicode' ) ) {
		return php52_compat_chr_unicode( $ch );
	}
	return chr_unicode( $ch );
}

}

Document
	= Thing+

Thing
	= Chr_Unicode_Test
	/ Comment
	/ Whitespace

Chr_Unicode_Test
	= "\\x" hex_code:[0-9a-f]i+ {
		return _chr_unicode( hexdec( implode( '', $hex_code ) ) );
	}

Comment
	= delim:"//" text:[^\r\n]* {
		return $delim . implode( '', $text );
	}

Whitespace
	= content:[ \t\r\n]+ {
		return implode( '', $content );
	}
