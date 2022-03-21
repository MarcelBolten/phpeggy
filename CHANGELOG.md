Change Log
==========

This file documents all notable changes to PHPeggy.

2.0.0
-----

Released: TBD

### Major Changes

- Use types in PHP when possible.
- PHP >=7.3 is required.
- Keep up with Peggy development up to version 1.2.0:
  Implementation of global initializer blocks and plucking (see https://github.com/peggyjs/peggy/blob/main/CHANGELOG.md#major-changes)
  Cleanup bytecode generator, PHP code is now exclusively in `generate-php.js`
- switch form Travis to github workflows
- Attempting to use `mbstring` extension-dependent features with `mbstringAllowed: false`
  will now cause `check` and not `generate` to throw an error.

### Developer

- Added ESLint
- Use PHP-CS-Fixer to check generated PHP parsers
- Use Psalm and PHPStan for static analysis

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
