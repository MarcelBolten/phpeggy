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
		.map( filename => filename.replace( /\.(pegjs|php|txt|json)$/, '' ) )
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

function getPHPParserTestCode( parser, input ) {
	return parser + `

$input = base64_decode( '${ new Buffer( input ).toString( 'base64' ) }' );

try {
	$parser = new Parser;
	$result = $parser->parse( $input );
	echo json_encode( $result );
} catch ( SyntaxError $ex ) {
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

describe( 'PHP command-line executable', () => {
	it( 'is present', () => {
		const result = cp.spawnSync( 'php', [ '--version' ], {
			encoding: 'utf8'
		} );
		if ( result.error ) {
			throw result.error;
		}
		console.log( result.stderr || result.stdout );
		expect( result.status ).to.eql( 0 );
	} );
} );

grammarNames.forEach( grammarName => {
	describe( 'Example grammar ' + grammarName, () => {
		let phpActual;

		it( 'generates the expected PHP code', () => {
			const grammar = fs.readFileSync(
				fixtureFilePath( grammarName + '.pegjs' ),
				'utf8'
			);
			phpActual = pegjs.generate(
				grammar,
				{ plugins: [ phpegjs ] }
			);
			const phpExpectedPath = fixtureFilePath( grammarName + '.php' );
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

				const result = cp.spawnSync( 'php', {
					input: getPHPParserTestCode( phpActual, input ),
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
