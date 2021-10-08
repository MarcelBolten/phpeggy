const mocha = require( 'mocha' );
const expect = require( 'chai' ).expect;
const fs = require( 'fs' );
const path = require( 'path' );
const cp = require( 'child_process' );
const util = require( 'util' );

const peggy = require( 'peggy' );
const phpeggy = require( '../src/phpeggy' );

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

function runPhp( args, stdin ) {
  const result = cp.spawnSync( 'php', args, {
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
if ( major < 5 || ( major === 5 && minor < 6 ) ) {
  throw new Error(
    'This library requires at least PHP 5.6.  (Why so old?)'
  );
}
console.log('Running tests');

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

grammarNames.forEach( grammarName => {
  describe( 'Example grammar ' + grammarName, () => {
    let phpActual;

    it( 'generates the expected PHP code', () => {
      const grammar = fs.readFileSync(
        fixtureFilePath( grammarName + '.pegjs' ),
        'utf8'
      );

      const peggyOptions = {
        plugins: [ phpeggy ]
      };
      let extraOptions = {};
      try {
        extraOptions = JSON.parse( fs.readFileSync(
          fixtureFilePath( grammarName + '.options.json' ),
          'utf8'
        ) );
      } catch ( err ) { }
      for ( const key in extraOptions ) {
        peggyOptions[ key ] = extraOptions[ key ];
      }

      try {
        phpActual = peggy.generate( grammar, peggyOptions );
      } catch ( err ) {
        phpActual = util.format(
          '<?php /*\nERROR GENERATING PARSER:\n\n%s\n\n*/\n',
          err.message
        );
      }

      const phpExpectedPath = fixtureFilePath(
        grammarName + '.php'
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
        expect( result.stderr ).to.eql(
          '',
          'Received messages from PHP stderr'
        );
        let outputActual;
        try {
          outputActual = JSON.parse( result.stdout );
        } catch ( err ) {
          throw new Error( 'JSON.parse failed:  ' + result.stdout );
        }

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
