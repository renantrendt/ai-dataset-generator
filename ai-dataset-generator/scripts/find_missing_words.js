const fs = require('fs');
const path = require('path');

const __dirname = path.dirname(__filename);

// Caminho para o arquivo com palavras únicas
const uniqueWordsFilePath = path.join(__dirname, '..', 'output', 'yanomami-words-unique.txt');
// Caminho para o arquivo com respostas mescladas
const mergedAnswersFilePath = path.join(__dirname, '..', 'output', 'merged_answers-from-original.jsonl');
// Caminho para o novo arquivo com palavras ausentes
const missingWordsFilePath = path.join(__dirname, '..', 'output', 'missing_words.jsonl');

// Função para encontrar palavras ausentes
function findMissingWords() {
    // Lê o arquivo de palavras únicas
    fs.readFile(uniqueWordsFilePath, 'utf8', (err, uniqueData) => {
        if (err) {
            console.error('Error reading unique words file:', err);
            return;
        }

        const uniqueWords = uniqueData.split('\n').filter(word => word.trim().length > 0);

        // Lê o arquivo de respostas mescladas
        fs.readFile(mergedAnswersFilePath, 'utf8', (err, mergedData) => {
            if (err) {
                console.error('Error reading merged answers file:', err);
                return;
            }

            const mergedLines = mergedData.split('\n').filter(line => line.trim().length > 0);
            const mergedWords = new Set();

            // Extrai palavras dos prompts mesclados
            mergedLines.forEach(line => {
                const wordsInLine = line.split(/\W+/);
                wordsInLine.forEach(word => {
                    if (word) mergedWords.add(word);
                });
            });

            // Encontra palavras ausentes
            const missingWords = uniqueWords.filter(word => !mergedWords.has(word));

            // Escreve as palavras ausentes em um novo arquivo
            fs.writeFile(missingWordsFilePath, missingWords.join('\n'), 'utf8', (err) => {
                if (err) {
                    console.error('Error writing missing words file:', err);
                    return;
                }
                console.log('Missing words saved to:', missingWordsFilePath);
            });
        });
    });
}

// Executa a função
findMissingWords();
