"use strict";

const fs = require("fs");
const peggy = require("peggy");
const phpeggy = require("../src/phpeggy.js");

const examples
= {
  "Digits": "digits.pegjs",
  "Arithmetics": "arithmetics.pegjs",
  "Json": "json.pegjs",
  "Css": "css.pegjs",
  "Javascript": "javascript.pegjs",
  "FizzBuzz": "fizzbuzz.pegjs",
  "SourceMappings": "source-mappings.pegjs",
  "XML": "xml.pegjs",
  "Minimal": "minimal.pegjs",
};

function generateParser(input_file, output_file, classname) {
  fs.readFile(input_file, (err, data) => {
    if (err) {
      throw err;
    }

    console.info("Generating Parser for grammar: ", input_file);
    fs.writeFile(
      output_file,
      peggy.generate(data.toString(), {
        cache: true,
        grammarSource: input_file,
        plugins: [phpeggy],
        phpeggy: {
          parserNamespace: "Parser",
          parserClassName: classname,
        },
      }),
      err => {
        if (err) {
          throw err;
        }
      }
    );
  });
}

if (!fs.existsSync("output")) {
  fs.mkdirSync("output");
}

for (const classname in examples) {
  if (Object.prototype.hasOwnProperty.call(examples, classname)) {
    generateParser(
      "../examples/" + examples[classname],
      "output/" + examples[classname].replace(/\.[^/.]+$/, ".php"),
      classname
    );
  }
}
