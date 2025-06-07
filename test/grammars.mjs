import { describe, it } from "mocha";
import { Buffer } from "node:buffer";
import cp  from "child_process";
import { expect }  from  "chai";
import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import peggy from "peggy";
import phpeggy from "../src/phpeggy.js";
import process from "node:process";
import util from "util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const minPHPVersion = "8.0";

let runPhpOnly = false;
if (process.env.ONLY_RUN_PHP === "y") {
  runPhpOnly = true;
  console.log("Running only PHP tests");
}

let onlyGenerateParsers = false;
if (process.env.ONLY_GENERATE_PARSERS === "y") {
  onlyGenerateParsers = true;
  console.log("Only generating parsers");
}

function getUniqueBasenames(array, onlyParserInput = false) {
  if (onlyParserInput) {
    array = array.filter(filename => filename.endsWith(".txt"));
  }
  return array
    // Strip extensions
    .map(filename => filename.replace(/\..+$/, ""))
    // Filter to unique entries: https://stackoverflow.com/a/14438954
    .filter((value, index, array) => array.indexOf(value) === index);
}

function fixtureFilePath(filename) {
  if (!Array.isArray(filename)) {
    filename = [filename];
  }

  return path.join(...[__dirname, "fixtures"].concat(filename));
}

function runPhp(args, stdin) {
  const result = cp.spawnSync("php", args, {
    input: stdin || null,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status) {
    console.log({
      stderr: result.stderr,
      stdout: result.stdout,
    });
    throw new Error(
      "Non-zero exit code from PHP: " + result.status
    );
  }

  return result;
}

function isWin() {
  return process.platform === "win32";
}

function runPeggyCli(args, stdin) {
  args.unshift("peggy");
  args.push("--verbose");
  const npx = "npx" + (isWin() ? ".cmd" : "");
  // Uncomment next line to debug the CLI command
  // console.log("cli command: npx " + args.join(" "));
  const result = cp.spawnSync(npx, args, {
    input: stdin || null,
    encoding: "utf8",
    shell: isWin(),
    env: {
      PATH: process.env.PATH,
    },
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status) {
    console.log({
      stderr: result.stderr,
      stdout: result.stdout,
    });
    throw new Error(
      "Non-zero exit code from peggy: " + result.status
    );
  }

  return result;
}

function getPHPParserTestCode(parser, input) {
  return parser + `
$input = base64_decode('${Buffer.from(input).toString("base64")}');

try {
    $parser = new Parser;
    $result = $parser->parse($input);
    echo json_encode($result);
} catch (SyntaxError $ex) {
    echo json_encode([
        'error' => [
            'message' => $ex->getMessage(),
            'expected' => $ex->expected,
            'found' => $ex->found,
            'line' => $ex->grammarLine,
            'column' => $ex->grammarColumn,
            'offset' => $ex->grammarOffset,
        ],
    ]);
}
`;
}

if (onlyGenerateParsers && !runPhpOnly) {
  console.log("Determining version of PHP command-line executable...");

  const result = runPhp(["--version"]);
  const match = result.stdout.match(/^PHP (\d+)\.(\d+)(\.[^ ]+) /);

  if (!match) {
    throw new Error("Unable to determine PHP version.");
  }

  console.log("PHP version: " + match[0].trim());

  const [minMajor, minMinor] = minPHPVersion.split(".");
  const major = Number(match[1]);
  const minor = Number(match[2]);

  if (major < Number(minMajor)
    || (major === Number(minMajor) && minor < Number(minMinor))
  ) {
    throw new Error(
      `This library requires at least PHP ${minPHPVersion}.`
    );
  }
}
console.log("Running tests");

const grammarNames = getUniqueBasenames(
  fs.readdirSync(path.join(__dirname, "fixtures"))
);

grammarNames.forEach(grammarName => {
  describe("Example grammar " + grammarName, () => {
    let phpActual = undefined;
    let outputActual = undefined;

    //
    // Generate PHP code from the grammar
    //
    if (!runPhpOnly) {
      it("generates the expected PHP code via js api", () => {
        const grammar = [{
          "source": grammarName + ".pegjs",
          "text": fs.readFileSync(
            fixtureFilePath(grammarName + ".pegjs"),
            "utf8"
          ),
        }];

        const peggyOptions = {
          plugins: [phpeggy],
        };

        let extraOptions = {};

        try {
          extraOptions = JSON.parse(fs.readFileSync(
            fixtureFilePath(grammarName + ".options.json"),
            "utf8"
          ));
        } catch (_error) {
          // Continue regardless of error
        } finally {
          extraOptions.output = "source";
        }

        for (const key in extraOptions) {
          if (Object.prototype.hasOwnProperty.call(extraOptions, key)) {
            if (key === "tests-only" && extraOptions[key].imports) {
              extraOptions[key].imports.forEach(importGrammarName => {
                grammar.push({
                  "source": importGrammarName,
                  "text": fs.readFileSync(
                    fixtureFilePath([grammarName, importGrammarName]),
                    "utf8"
                  ),
                });
              });
            } else {
              peggyOptions[key] = extraOptions[key];
            }
          }
        }

        try {
          phpActual = peggy.generate(grammar, peggyOptions);
        } catch (err) {
          phpActual = util.format(
            "<?php\n/*\nERROR GENERATING PARSER:\n\n%s\n\n*/\n",
            err.message
          );
        }

        const phpExpectedPath = fixtureFilePath(
          grammarName + ".php"
        );

        if (
          process.env.GENERATE_MISSING_FIXTURES === "y"
          && !fs.existsSync(phpExpectedPath)
        ) {
          console.log("\nwriting fixture: " + grammarName + ".php\n");
          fs.writeFileSync(phpExpectedPath, phpActual);
        }

        const phpExpected = fs.readFileSync(
          phpExpectedPath,
          "utf8"
        );

        expect(phpActual).to.eql(phpExpected);
      });

      it("generates the expected PHP code via cli", function() {
        // Increase timeout for this test
        // as it takes a while to run the cli
        this.timeout(40000);

        let grammar = fs.readFileSync(
          fixtureFilePath(grammarName + ".pegjs"),
          "utf8"
        );

        const peggyCliArgs = ["--output", "-", "--plugin", path.join(__dirname, "..", "src", "phpeggy.js")];

        let extraOptions = {};

        try {
          extraOptions = JSON.parse(fs.readFileSync(
            fixtureFilePath(grammarName + ".options.json"),
            "utf8"
          ));
        } catch (_error) {
          // Continue regardless of error
        }

        if (extraOptions.cache) {
          peggyCliArgs.push("--cache");
        }

        if (extraOptions.phpeggy) {
          let jsonArg = JSON.stringify({ phpeggy: extraOptions.phpeggy });

          // Escape double quotes for Windows as we use shell: true
          // and hence the quotes are not escaped by default
          if (isWin()) {
            jsonArg = '"' + jsonArg.replace(/"/g, '\\"') + '"';
          }

          peggyCliArgs.push("--extra-options", `${jsonArg}`);
        }

        if (extraOptions["tests-only"]) {
          grammar = null;
          peggyCliArgs.push(fixtureFilePath(grammarName + ".pegjs"));
          extraOptions["tests-only"].imports.forEach(importGrammarName => {
            peggyCliArgs.push(fixtureFilePath([
              grammarName, importGrammarName,
            ]));
          });
        }

        const result = runPeggyCli(peggyCliArgs, grammar);

        const phpExpectedPath = fixtureFilePath(
          grammarName + ".php"
        );

        const phpExpected = fs.readFileSync(
          phpExpectedPath,
          "utf8"
        );

        expect(result.stdout).to.eql(phpExpected);
      });
    }

    //
    // PHP parser tests
    //
    if (!onlyGenerateParsers) {
      let testNames = [];
      try {
        const stats = fs.statSync(fixtureFilePath(grammarName));
        if (stats.isDirectory()) {
          testNames = getUniqueBasenames(
            fs.readdirSync(fixtureFilePath(grammarName)),
            true
          );
        }
      } catch (_error) {
        // Continue regardless of error
      }

      testNames.forEach(testName => {
        it("generates the expected output for test case " + testName, () => {
          const input = fs.readFileSync(
            fixtureFilePath([grammarName, testName + ".txt"]),
            "utf8"
          );

          if (!phpActual && runPhpOnly) {
            phpActual = fs.readFileSync(
              fixtureFilePath(grammarName + ".php"),
              "utf8"
            );
          }

          const result = runPhp([], getPHPParserTestCode(phpActual, input));
          expect(result.stderr).to.eql(
            "",
            "Received messages from PHP stderr"
          );

          try {
            outputActual = JSON.parse(result.stdout);
          } catch (_error) {
            throw new Error("JSON.parse failed: " + result.stdout);
          }

          const outputExpectedPath = fixtureFilePath([
            grammarName,
            testName + ".json",
          ]);

          if (
            process.env.GENERATE_MISSING_FIXTURES === "y"
            && !fs.existsSync(outputExpectedPath)
          ) {
            console.log("writing fixture: " + outputExpectedPath);
            fs.writeFileSync(
              outputExpectedPath,
              JSON.stringify(outputActual, null, 4) + "\n"
            );
          }

          const outputExpected = JSON.parse(fs.readFileSync(
            outputExpectedPath,
            "utf8"
          ));

          expect(outputActual).to.eql(outputExpected);
        });
      });
    }
  });
});
