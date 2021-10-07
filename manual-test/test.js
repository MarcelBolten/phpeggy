var fs = require('fs');
var peggy = require('peggy');
var phpeggy = require('../src/phpeggy.js');

var examples =
{
    'Digits':      'digits.pegjs',
    'Arithmetics': 'arithmetics.pegjs',
    'Json':        'json.pegjs',
    'Css':         'css.pegjs',
    'Javascript':  'javascript.pegjs'
};

function generateParser(input_file, output_file, classname)
{
    fs.readFile(input_file, function (err, data) {
        if (err) throw err;

        var parser = peggy.buildParser(
            data.toString(),
            {
                cache: true,
                plugins: [phpeggy],
                phpeggy: {parserNamespace: 'Parser', parserClassName: classname}
            }
        );
        fs.writeFile(output_file, parser);
    });

}

if (!fs.existsSync('output')) fs.mkdirSync('output');

for (var classname in examples)
{
    generateParser(
        '../examples/' + examples[classname],
        'output/' + examples[classname].replace(/\.[^/.]+$/, '.php'),
        classname
    );
}

