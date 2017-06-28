const mocha = require( 'mocha' );
const expect = require( 'chai' ).expect;
const fs = require( 'fs' );
const path = require( 'path' );
const cp = require( 'child_process' );

const pegjs = require( 'pegjs' );
const phpegjs = require( '../src/phppegjs' );

function getUniqueBasenames( array ) {
	return array
		// Strip extensions
		.map( filename => filename.replace( /\..+$/, '' ) )
		// Filter to unique entries: https://stackoverflow.com/a/14438954
		.filter( ( value, index, array ) => array.indexOf( value ) === index );
}

function fixtureFilePath( filename ) {
	if ( Array.isArray( filename ) ) {
		return path.join.apply(
			path,
			[ __dirname, 'fixtures' ].concat( filename )
		);
	} else {
		return path.join( __dirname, 'fixtures', filename );
	}
}

function runPhp( arguments, stdin ) {
	const result = cp.spawnSync( 'php', arguments, {
		input: stdin || null,
		encoding: 'utf8'
	} );
	if ( result.error ) {
		throw result.error;
	}
	if ( result.status ) {
		console.log( {
			stderr: result.stderr,
			stdout: result.stdout,
		} );
		throw new Error(
			'Non-zero exit code from PHP: ' + result.status
		);
	}
	return result;
}

console.log( 'Determining version of PHP command-line executable...' );
const result = runPhp( [ '--version' ] );
const match = result.stdout.match( /^PHP (\d+)\.(\d+)(\.[^ ]+) / );
if ( ! match ) {
	throw new Error( 'Unable to determine PHP version.' );
}
console.log( 'PHP version: ' + match[ 0 ].trim() );
const major = +match[ 1 ];
const minor = +match[ 2 ];
if ( major < 5 || minor < 2 ) {
	throw new Error(
		'This library requires at least PHP 5.2.  (Why so old?)'
	);
}
const isPHP52 = ( major === 5 && minor === 2 );
console.log(
	'(Running tests in %s mode)',
	isPHP52 ? 'PHP 5.2' : 'modern PHP'
);

function getPHPParserTestCode( parser, input ) {
	return parser + `

$input = base64_decode( '${ new Buffer( input ).toString( 'base64' ) }' );

try {
	$parser = new ${ isPHP52 ? 'php52_compat_Parser' : 'Parser' };
	$result = $parser->parse( $input );
	echo json_encode( $result );
} catch ( ${ isPHP52 ? 'php52_compat_SyntaxError' : 'SyntaxError' } $ex ) {
	echo json_encode( array(
		'error' => array(
			'message'  => $ex->getMessage(),
			'expected' => $ex->expected,
			'found'    => $ex->found,
			'line'     => $ex->grammarLine,
			'column'   => $ex->grammarColumn,
			'offset'   => $ex->grammarOffset,
		),
	) );
}
`;
}

const grammarNames = getUniqueBasenames(
	fs.readdirSync( path.join( __dirname, 'fixtures' ) )
);

grammarNames.forEach( grammarName => {
	describe( 'Example grammar ' + grammarName, () => {
		let phpActual;

		it( 'generates the expected PHP code', () => {
			const grammar = fs.readFileSync(
				fixtureFilePath( grammarName + '.pegjs' ),
				'utf8'
			);
			const pegjsOptions = {
				plugins: [ phpegjs ]
			};
			if ( isPHP52 ) {
				pegjsOptions.phpegjs = {
					parserNamespace: null,
					parserGlobalNamePrefix: 'php52_compat_'
				};
			}
			phpActual = pegjs.generate( grammar, pegjsOptions );
			const phpExpectedPath = fixtureFilePath(
				grammarName + ( isPHP52 ? '.php52.php' : '.php' )
			);
			if (
				process.env.GENERATE_MISSING_FIXTURES &&
				! fs.existsSync( phpExpectedPath )
			) {
				fs.writeFileSync( phpExpectedPath, phpActual );
			}
			const phpExpected = fs.readFileSync(
				phpExpectedPath,
				'utf8'
			);
			expect( phpActual ).to.eql( phpExpected );
		} );

		let testNames = [];
		try {
			const stats = fs.statSync( fixtureFilePath( grammarName ) );
			if ( stats.isDirectory() ) {
				testNames = getUniqueBasenames(
					fs.readdirSync( fixtureFilePath( grammarName ) )
				);
			}
		} catch ( err ) { }

		testNames.forEach( testName => {
			it( 'generates the expected output for test case ' + testName, () => {
				const input = fs.readFileSync(
					fixtureFilePath( [ grammarName, testName + '.txt' ] ),
					'utf8'
				);

				const result = runPhp( [], getPHPParserTestCode( phpActual, input ) );
				const outputActual = JSON.parse( result.stdout );

				const outputExpectedPath =
					fixtureFilePath( [ grammarName, testName + '.json' ] );
				if (
					process.env.GENERATE_MISSING_FIXTURES &&
					! fs.existsSync( outputExpectedPath )
				) {
					fs.writeFileSync(
						outputExpectedPath,
						JSON.stringify( outputActual, null, 4 ) + "\n"
					);
				}

				const outputExpected = JSON.parse( fs.readFileSync(
					outputExpectedPath,
					'utf8'
				) );
				expect( outputActual ).to.eql( outputExpected );
			} );
		} );
	} );
} );
