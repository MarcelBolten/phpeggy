const mocha = require( 'mocha' );
const expect = require( 'chai' ).expect;
const fs = require( 'fs' );
const path = require( 'path' );

const pegjs = require( 'pegjs' );
const phpegjs = require( '../src/phppegjs' );

describe( 'WP Gutenberg post content parser', () => {
	it( 'should match expected output', () => {
		const grammar = fs.readFileSync(
			path.join( __dirname, 'fixtures', 'wp-gutenberg-post.pegjs' ),
			'utf8'
		);
		const phpActual = pegjs.generate(
			grammar,
			{ plugins: [ phpegjs ] }
		);
		const phpExpectedPath = path.join(
			__dirname, 'fixtures', 'wp-gutenberg-post.php'
		);
		if (
			process.env.GENERATE_MISSING_FIXTURES &&
			! fs.existsSync( phpExpectedPath )
		) {
			fs.writeFileSync( phpExpectedPath, phpActual );
		}
		const phpExpected = fs.readFileSync(
			path.join( __dirname, 'fixtures', 'wp-gutenberg-post.php' ),
			'utf8'
		);
		expect( phpActual ).to.eql( phpExpected );
	} );
} );
