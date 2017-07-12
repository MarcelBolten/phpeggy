{

function _chr_unicode( $ch ) {
	if ( function_exists( 'php52_compat_chr_unicode' ) ) {
		return php52_compat_chr_unicode( $ch );
	}
	return chr_unicode( $ch );
}

function _ord_unicode( $ch ) {
	if ( function_exists( 'php52_compat_ord_unicode' ) ) {
		return php52_compat_ord_unicode( $ch );
	}
	return ord_unicode( $ch );
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
		$chr = _chr_unicode( hexdec( implode( '', $hex_code ) ) );
		return array(
			'chr' => $chr,
			'ord' => _ord_unicode( $chr ),
		);
	}

Comment
	= delim:"//" text:[^\r\n]* {
		return $delim . implode( '', $text );
	}

Whitespace
	= content:[ \t\r\n]+ {
		return implode( '', $content );
	}
