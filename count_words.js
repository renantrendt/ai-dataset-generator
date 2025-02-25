import fs from 'fs';

// Lê o arquivo
const content = fs.readFileSync('/Users/renanserrano/CascadeProjects/Yanomami/AiDatasetGeneratorFineTunning/ai-dataset-generator/input/yanomamo_dictionary.txt', 'utf8');

// Extrai palavras Yanomami
const entries = content.split('\n\n');
const uniqueWords = new Set();
const nonYanomamiWords = new Set(['sus', 'vb', 'estado', 'bot', 'zool', 'perf', 'inc', 'dur', 'term', 'fact', 'des']);

for (const entry of entries) {
    const lines = entry.split('\n');
    if (lines.length === 0) continue;
    
    // Pega a primeira linha que geralmente contém a palavra Yanomami
    const firstLine = lines[0].trim();
    
    // Ignora linhas que começam com palavras não-Yanomami conhecidas
    if (nonYanomamiWords.has(firstLine.toLowerCase().split('.')[0])) continue;
    
    // Extrai a palavra Yanomami (geralmente antes de números, pontos ou espaços)
    const match = firstLine.match(/^([A-Za-zë\-]+)/);
    if (match) {
        const word = match[1].toLowerCase();
        // Ignora palavras muito curtas ou que são claramente não-Yanomami
        if (word.length > 1 && !nonYanomamiWords.has(word)) {
            uniqueWords.add(word);
        }
    }
}

console.log(`\nEstatísticas do Dicionário Yanomami:`);
console.log(`---------------------------------`);
console.log(`Total de palavras Yanomami únicas: ${uniqueWords.size}`);
console.log(`\nExemplos de palavras Yanomami:`);
console.log(`---------------------------------`);
Array.from(uniqueWords).slice(0, 10).forEach(word => {
    console.log(`- ${word}`);
});
