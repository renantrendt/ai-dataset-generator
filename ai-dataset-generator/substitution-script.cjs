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
        .replace(/–rayo–/g, '–rayo– sufijo simple o compuesto, desinencia verbal.');

    // Write to output file
    fs.writeFile(outputFilePath, modifiedData, (err) => {
        if (err) {
            console.error('Error writing the file:', err);
            return;
        }
        console.log('File has been modified and saved to', outputFilePath);
    });
});
