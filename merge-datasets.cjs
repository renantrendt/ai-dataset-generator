const fs = require('fs');
const path = require('path');

// Caminho para o arquivo de entrada
const inputFilePath = path.join(__dirname, 'output', 'dataset_2025-02-26T03-22-23-567Z.jsonl');
// Caminho para o arquivo de saída
const outputFilePath = path.join(__dirname, 'output', 'merged-dataset.jsonl');

// Função para ler o arquivo JSONL
function readJsonlFile(filePath) {
    const data = fs.readFileSync(filePath, 'utf-8');
    return data.trim().split('\n').map(line => JSON.parse(line));
}

// Função para mesclar datasets
function mergeDatasets(entries) {
    const merged = {};

    entries.forEach(entry => {
        const word = entry.messages[1].content.match(/'(.+?)'/)[1]; // Extrai a palavra
        if (!merged[word]) {
            merged[word] = entry;
        } else {
            // Mescla as informações
            const existingEntry = merged[word];
            const newExamples = entry.messages[1].content.match(/Here are some examples:(.*?)(?=\n\n|$)/s);
            const existingExamples = existingEntry.messages[1].content.match(/Here are some examples:(.*?)(?=\n\n|$)/s);

            // Adiciona novos exemplos
            if (newExamples && existingExamples) {
                const newExamplesList = newExamples[1].trim().split('\n\n');
                const existingExamplesList = existingExamples[1].trim().split('\n\n');
                const combinedExamples = newExamplesList.concat(existingExamplesList);
                existingEntry.messages[1].content = existingEntry.messages[1].content.replace(/Here are some examples:(.*?)(?=\n\n|$)/s, `Here are some examples:\n\n${combinedExamples.join('\n\n')}`);
            }
        }
    });

    return Object.values(merged);
}

// Função principal
function main() {
    const entries = readJsonlFile(inputFilePath);
    const mergedEntries = mergeDatasets(entries);
    const outputContent = mergedEntries.map(entry => JSON.stringify(entry)).join('\n');
    fs.writeFileSync(outputFilePath, outputContent);
    console.log('Merged dataset saved to:', outputFilePath);
}

module.exports = main;
