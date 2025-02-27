const fs = require('fs');
const path = require('path');

// Caminho para o arquivo com traduções
const translationsFilePath = path.join(__dirname, '..', 'output', 'translations_output.txt');
// Caminho para o novo arquivo com respostas mescladas
const mergedFilePath = path.join(__dirname, '..', 'output', 'merged_translations.jsonl');

// Função para mesclar traduções
function mergeTranslations() {
    // Lê o arquivo de traduções
    fs.readFile(translationsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading translations file:', err);
            return;
        }

        const lines = data.split('\n').filter(line => line.trim().length > 0);
        const mergedTranslations = {};

        // Processa cada linha do arquivo de traduções
        lines.forEach(line => {
            const match = line.match(/Translate '(.*?)': (.*)/);
            if (match) {
                const word = match[1];
                const translation = match[2];

                // Se a palavra já existe, mescla as traduções
                if (mergedTranslations[word]) {
                    mergedTranslations[word].push(translation);
                } else {
                    mergedTranslations[word] = [translation];
                }
            }
        });

        // Cria o conteúdo para o arquivo de respostas mescladas
        const outputLines = Object.entries(mergedTranslations).map(([word, translations]) => {
            return `Translate '${word}': ${translations.join(', ')} `;
        });

        // Escreve as traduções mescladas em um novo arquivo
        fs.writeFile(mergedFilePath, outputLines.join('\n'), 'utf8', (err) => {
            if (err) {
                console.error('Error writing merged translations file:', err);
                return;
            }
            console.log('Merged translations saved to:', mergedFilePath);
        });
    });
}

// Executa a função
mergeTranslations();
