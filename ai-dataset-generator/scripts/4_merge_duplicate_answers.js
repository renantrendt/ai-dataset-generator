import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o arquivo com duplicatas
const duplicatesFilePath = path.join(__dirname, '..', 'output', 'dataset_2025-02-26T11-00-33-047Z.jsonl');
// Caminho para o novo arquivo com respostas mescladas
const mergedFilePath = path.join(__dirname, '..', 'output', 'merged_answers-from-original.jsonl');

// Função para mesclar respostas duplicadas
function mergeDuplicateAnswers() {
    fs.readFile(duplicatesFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }

        // Divide o conteúdo em linhas
        const lines = data.split('\n').filter(line => line.trim().length > 0);
        const mergedAnswers = {};

        // Processa cada linha do dataset
        lines.forEach(line => {
            const entry = JSON.parse(line);
            const userPrompt = entry.messages[0].content;
            const assistantResponse = entry.messages[1].content;

            // Extrai a palavra da pergunta do usuário
            const wordMatch = userPrompt.match(/'([^']+)'/);
            if (wordMatch) {
                const word = wordMatch[1];
                if (!mergedAnswers[word]) {
                    mergedAnswers[word] = [];
                }
                mergedAnswers[word].push(assistantResponse);
            }
        });

        // Cria o conteúdo para o arquivo de saída
        const outputContent = Object.entries(mergedAnswers).map(([word, responses]) => {
            const combinedResponse = `It can be ${responses.join(' and also it can be ')}.`;
            return JSON.stringify({ messages: [{ role: 'user', content: `What does '${word}' mean in Yanomami?` }, { role: 'assistant', content: combinedResponse }] });
        }).join('\n');

        // Escreve as respostas mescladas em um novo arquivo
        fs.writeFile(mergedFilePath, outputContent, 'utf8', (err) => {
            if (err) {
                console.error('Error writing the file:', err);
                return;
            }
            console.log('Merged answers saved to:', mergedFilePath);
        });
    });
}

// Executa a função
mergeDuplicateAnswers();
