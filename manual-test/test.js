"use strict";

const fs = require("fs");
const peggy = require("peggy");
const phpeggy = require("../src/phpeggy.js");

const examples
= {
  "Digits":      "digits.pegjs",
  "Arithmetics": "arithmetics.pegjs",
  "Json":        "json.pegjs",
  "Css":         "css.pegjs",
  "Javascript":  "javascript.pegjs",
};

function generateParser(input_file, output_file, classname) {
  fs.readFile(input_file, (err, data) => {
    if (err) { throw err; }

    const parser = peggy.buildParser(
      data.toString(),
      {
        cache: true,
        plugins: [phpeggy],
        phpeggy: { parserNamespace: "Parser", parserClassName: classname },
      }
    );
    fs.writeFile(output_file, parser);
  });
}

if (!fs.existsSync("output")) { fs.mkdirSync("output"); }

for (const classname in examples) {
  if (Object.prototype.hasOwnProperty.call(examples, classname)) {
    generateParser(
      "../examples/" + examples[classname],
      "output/" + examples[classname].replace(/\.[^/.]+$/, ".php"),
      classname
    );
  }
}

