Change Log
==========

This file documents all notable changes to PHPeggy.

2.0.0
-----

Released: TBD

### Breaking Changes

- node ≥14 is required.
- PHP ≥8.0 is required.

### Major Changes

- Use types in PHP wherever possible.
- Keep up with Peggy development up to version 3.0.0:
  Implementation of global initializer blocks, plucking, and repetition operator (see https://github.com/peggyjs/peggy/blob/main/CHANGELOG.md#major-changes).

### Developer

- Switch form Travis to GitHub Actions
- Added ESLint
- Use PHP-CS-Fixer to check generated PHP parsers
- Use Psalm and PHPStan for static analysis
- Split generate-php.js into several files
- Cleanup bytecode generator, PHP code is now exclusively in `generate-php.js`.
- The attempt to use `mbstring` extension-dependent features with option `mbstringAllowed: false`
  will now throw an error in `passes.check` and not `passes.generate`.

1.0.1
-----

Released: 2022-02-25

### Patch

Fix php string concatenation (#1)

1.0.0
-----

Released: 2021-10-11

### Major Changes

First release

## Previous history

There has not been a change log for `phpegjs` PHP PEG.js.
