const fs = require('fs');
const path = require('path');

// Caminho para o arquivo com palavras ausentes
const missingWordsFilePath = path.join(__dirname, '..', 'output', 'missing_words_in_answers.jsonl');
// Caminho para o arquivo com respostas mescladas
const mergedAnswersFilePath = path.join(__dirname, '..', 'output', 'merged_answers-from-original.jsonl');
// Caminho para o novo arquivo de conversas de tradução
const translationOutputFilePath = path.join(__dirname, '..', 'output', 'translation_conversations.jsonl');

// Função para gerar conversas de tradução
async function generateTranslationConversations() {
    try {
        // Lê o arquivo de palavras ausentes
        const missingData = await fs.promises.readFile(missingWordsFilePath, 'utf8');
        const missingWords = missingData.split('\n').filter(word => word.trim().length > 0);

        // Lê o arquivo de respostas mescladas
        const mergedData = await fs.promises.readFile(mergedAnswersFilePath, 'utf8');
        const mergedLines = mergedData.split('\n').filter(line => line.trim().length > 0);

        // Para cada palavra ausente, encontra frases e traduções
        for (const word of missingWords) {
            const conversations = [];

            for (const line of mergedLines) {
                if (line.includes(word)) {
                    // Aqui você pode adicionar lógica para extrair a tradução
                    // Exemplo: enviar a frase para uma IA para gerar a tradução
                    const translation = await getTranslation(line); // Chama a função para obter a tradução
                    conversations.push({
                        word: word,
                        phrase: line,
                        translation: translation
                    });

                    // Salva as conversas em tempo real
                    await fs.promises.appendFile(translationOutputFilePath, JSON.stringify(conversations[conversations.length - 1]) + '\n');
                }
            }
        }
    } catch (err) {
        console.error('Error generating translation conversations:', err);
    }
}

// Função fictícia para obter a tradução de uma frase
async function getTranslation(phrase) {
    // Aqui você deve implementar a chamada para a IA ou serviço de tradução
    // Retorne a tradução como uma string
    return 'Translated version of: ' + phrase;
}

// Executa a função
generateTranslationConversations();
