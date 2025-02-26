import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o arquivo dataset_2025-02-26T11-00-33-047Z.jsonl
const datasetFilePath = path.join(__dirname, '..', 'output', 'dataset_2025-02-26T11-00-33-047Z.jsonl');
// Caminho para o novo arquivo com duplicatas removidas
const uniqueDatasetFilePath = path.join(__dirname, '..', 'output', 'dataset_unique_prompts.jsonl');

// Função para verificar palavras duplicadas no dataset
function checkDuplicatesInDataset() {
    fs.readFile(datasetFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }

        // Divide o conteúdo em linhas
        const lines = data.split('\n').filter(line => line.trim().length > 0);
        const wordCount = {};

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
                        });
                    }
                }
            });
        });

        // Filtra as palavras únicas
        const uniqueWords = Object.keys(wordCount);

        // Escreve as palavras únicas em um novo arquivo
        fs.writeFile(uniqueDatasetFilePath, uniqueWords.join('\n'), 'utf8', (err) => {
            if (err) {
                console.error('Error writing the file:', err);
                return;
            }
            console.log(`Arquivo com palavras únicas do dataset criado em: ${uniqueDatasetFilePath}`);
        });

        // Exibe as palavras duplicadas
        const duplicates = Object.entries(wordCount).filter(([word, count]) => count > 1);
        if (duplicates.length > 0) {
            console.log('Palavras duplicadas encontradas no dataset:');
            duplicates.forEach(([word, count]) => {
                console.log(`- ${word}: ${count} vezes`);
            });
        } else {
            console.log('Nenhuma palavra duplicada encontrada no dataset.');
        }
    });
}

// Executa a função
checkDuplicatesInDataset();
