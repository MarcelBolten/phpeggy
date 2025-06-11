Change Log
==========

This file documents all notable changes to PHPeggy.

3.0.0
-----

Released: 2025-06-11

### Breaking Changes

- Node.js v20+ is now required
- `mbstring` extension is required. The `mbstringAllowed` option is removed.
- Drop support for Internet Explorer

### Major Changes

- Support for peggy 5
- Add wider support for unicode in grammar files

### Minor Changes

- Fix a bug with named NEVER_MATCH expressions.
  compare to https://github.com/peggyjs/peggy/pull/454

3.0.0-alpha
-----

Released: 2025-06-06

### Breaking Changes

- Node.js v20+ is now required
- `mbstring` extension is required. The `mbstringAllowed` option is removed.
- Drop support for Internet Explorer

### Major Changes

- Support for peggy 5
- Add wider support for unicode in grammar files

### Minor Changes

- Fix a bug with named NEVER_MATCH expressions.
  compare to https://github.com/peggyjs/peggy/pull/454

2.0.1
-----

Released: 2023-03-21

### Minor Changes

- Downgrade package-lock.json to lockfile version 2

### Developer

- use typescript 5

2.0.0
-----

Released: 2023-03-20

### Breaking Changes

- node ≥14 is required
- PHP ≥8.0 is required
- The initializer code is not added to Parser->parse() anymore. Instead the code will be added to Parser and a method initialize() will be called if it is provided:
  ~~~diff
  class Parser
  {
  +   initializer code block
  +   it may contain
  +   function initialize() {...}
  +
      public function parse()
      {
          ...
  -       initializer code block
  +       if (method_exists($this, 'initialize')) {
  +           $this->initialize();
  +       }
          ...
      }
  }
  ~~~

### Major Changes

- Use types in PHP wherever possible.
- Keep up with Peggy development up to version 3.0.0:
  Implementation of global initializer blocks, plucking (see [Peggy 1.1.0 changelog](https://github.com/peggyjs/peggy/blob/main/CHANGELOG.md#110)), and repetition operator (see [Peggy 3.0.0 changelog](https://github.com/peggyjs/peggy/blob/main/CHANGELOG.md#300)).
- Add custom header to generated parser via PHPeggyOptions `phpeggy: { header: '/* My custom header */' }`.

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
