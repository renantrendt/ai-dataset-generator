const fs = require('fs');
const path = require('path');

// Caminho para o arquivo com palavras únicas
const uniqueWordsFilePath = path.join(__dirname, '..', 'output', 'yanomami-words-unique.txt');
// Caminho para o arquivo com respostas mescladas
const mergedAnswersFilePath = path.join(__dirname, '..', 'output', 'merged_answers-from-original.jsonl');
// Caminho para o novo arquivo com palavras ausentes
const missingWordsFilePath = path.join(__dirname, '..', 'output', 'missing_words_in_answers.jsonl');

// Função para encontrar palavras ausentes
function findMissingWordsInAnswers() {
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
            const mergedText = mergedLines.join(' '); // Combina todas as linhas em um único texto

            // Encontra palavras ausentes
            const missingWords = uniqueWords.filter(word => !mergedText.includes(word));

            // Escreve as palavras ausentes em um novo arquivo
            fs.writeFile(missingWordsFilePath, missingWords.join('\n'), 'utf8', (err) => {
                if (err) {
                    console.error('Error writing missing words file:', err);
                    return;
                }
                console.log('Missing words not in answers saved to:', missingWordsFilePath);
            });
        });
    });
}

// Executa a função
findMissingWordsInAnswers();
