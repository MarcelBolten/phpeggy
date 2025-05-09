"use strict";

const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{}]);

// Todo: fix config file

// module.exports = defineConfig([{
//     extends: ['@peggyjs'],
// }, globalIgnores([
//     "**/.phpdoc/",
//     "**/docker/",
//     "**/examples/",
//     "**/node_modules/",
//     "**/phpdoc/",
//     "test/fixtures",
//     "**/vendor/",
// ])]);
