const mocha = require( 'mocha' );
const expect = require( 'chai' ).expect;
const fs = require( 'fs' );
const path = require( 'path' );

const pegjs = require( 'pegjs' );
const phpegjs = require( '../src/phppegjs' );

const fixtureBasenames = fs.readdirSync( path.join( __dirname, 'fixtures' ) )
	// Strip extensions
	.map( filename => filename.replace( /\.(php|pegjs)$/, '' ) )
	// Filter to unique entries: https://stackoverflow.com/a/14438954
	.filter( ( value, index, array ) => array.indexOf( value ) === index );

function fixtureFilePath( filename ) {
	return path.join( __dirname, 'fixtures', filename );
}

fixtureBasenames.forEach( basename => {
	describe( 'Example grammar ' + basename, () => {
		it( 'should generate the expected PHP code', () => {
			const grammar = fs.readFileSync(
				fixtureFilePath( basename + '.pegjs' ),
				'utf8'
			);
			const phpActual = pegjs.generate(
				grammar,
				{ plugins: [ phpegjs ] }
			);
			const phpExpectedPath = fixtureFilePath( basename + '.php' );
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
	} );
} );
