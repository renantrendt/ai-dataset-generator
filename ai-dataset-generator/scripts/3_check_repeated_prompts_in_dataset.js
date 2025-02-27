import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o arquivo dataset_2025-02-26T11-00-33-047Z.jsonl
const datasetFilePath = path.join(__dirname, '..', 'output', 'dataset_2025-02-26T11-00-33-047Z.jsonl');
// Caminho para o novo arquivo com linhas duplicadas
const duplicatesFilePath = path.join(__dirname, '..', 'output', 'dataset_duplicates.jsonl');

// Função para verificar linhas duplicadas no dataset
function checkDuplicatesInDataset() {
    fs.readFile(datasetFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }

        // Divide o conteúdo em linhas
        const lines = data.split('\n').filter(line => line.trim().length > 0);
        const wordCount = {};
        const duplicateLines = [];

        // Processa cada linha do dataset
        lines.forEach(line => {
            const entry = JSON.parse(line);
            entry.messages.forEach(message => {
                if (message.role === 'user') {
                    const userPrompt = message.content;
                    // Extrai palavras entre aspas simples do prompt
                    const words = userPrompt.match(/'([^']+)'/g);
                    if (words) {
                        words.forEach(word => {
                            // Remove aspas e conta a palavra
                            const cleanWord = word.replace(/'/g, '');
                            wordCount[cleanWord] = (wordCount[cleanWord] || 0) + 1;
                            // Se a palavra já foi vista, adiciona a linha ao conjunto de duplicatas
                            if (wordCount[cleanWord] > 1) {
                                duplicateLines.push(line);
                            }
                        });
                    }
                }
            });
        });

        // Escreve as linhas duplicadas em um novo arquivo
        fs.writeFile(duplicatesFilePath, duplicateLines.join('\n'), 'utf8', (err) => {
            if (err) {
                console.error('Error writing the file:', err);
                return;
            }
            console.log('Duplicate lines saved to:', duplicatesFilePath);
        });
    });
}

// Executa a função
checkDuplicatesInDataset();
