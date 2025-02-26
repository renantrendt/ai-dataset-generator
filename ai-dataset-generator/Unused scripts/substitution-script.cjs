const fs = require('fs');

// Read input file
const inputFilePath = './input/182696243-Yanomamo-Dictionary-Complete (1).txt';
const outputFilePath = './output/modified-dictionary.txt';

fs.readFile(inputFilePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading the file:', err);
        return;
    }

    // Perform substitutions
    let modifiedData = data
        .replace(/√/g, '–')
        .replace(/\$/g, 'h')
        .replace(/@/g, 'i')
        .replace(/(way\.)/g, 'wayamou, diálogo ceremonial.')
        .replace(/ha\.\.\.ni/g, 'ha...ni morfema')
        .replace(/discontinuo\./g, 'discontinuo.')
        .replace(/akare–/g, 'akare– raíz nominal o verbal.')
        .replace(/–rayo–/g, '–rayo– sufijo simple o compuesto, desinencia verbal.')
        .replace(/F1/g, 'formas primarias, sin expresión de modalidad.')
        .replace(/F2/g, 'formas derivadas, modales u otras, caracterizadas por un mismo condicionamiento fonológico.')
        .replace(/hra/g, 'habla de río arriba.')
        .replace(/hsh/g, 'habla del sur del Orinoco.')
        .replace(/leg\./g, 'leguminosa.')
        .replace(/no id\./g, 'no identificado (animal, planta).');

    // Write to output file
    fs.writeFile(outputFilePath, modifiedData, (err) => {
        if (err) {
            console.error('Error writing the file:', err);
            return;
        }
        console.log('File has been modified and saved to', outputFilePath);
    });
});
