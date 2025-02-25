import Anthropic from '@anthropic-ai/sdk';

/**
 * Processes a chunk of text using Claude API to generate a structured dataset entry
 * @param {string} chunk - The text chunk to process
 * @param {string} template - The template format to follow
 * @param {Anthropic} anthropic - The Anthropic client instance
 * @returns {Promise<Object|null>} The processed entry or null if invalid
 */
import { linesCoverage, usedWords } from '../src/index.js';

// Configurações do processamento
export const config = {
    chunkSize: 10, // Tamanho máximo do chunk em caracteres
    minSentences: 1,  // Mínimo de sentenças por chunk
    maxSentences: 1  // Máximo de sentenças por chunk
};

export async function processChunk(chunk, template, anthropic, lineStart = 0, currentFile) {
    try {
        const lines = chunk.split('\n');
        const endLine = lineStart + lines.length - 1;
        const chunkSize = chunk.length;
        const numLines = lines.length;
        console.log(`\n   📄 Chunk size: ${chunkSize} characters, ${numLines} lines`);
        console.log(`   📄 Lines from file: ${lineStart} to ${endLine}`);
        console.log('   Text being processed:');
        console.log('   ' + chunk.split('\n').map((line, i) => `   ${lineStart + i}: ${line}`).join('\n'));
        
        // Extract Yanomami words from the chunk (basic pattern, can be improved)
        const words = chunk.match(/[A-Za-zë\-]+/g) || [];
        
        // Find words we haven't used yet
        const unusedWords = words.filter(word => !usedWords.has(word.toLowerCase()));
        
        if (unusedWords.length === 0) {
            console.log('   ⚠️ No unused words found in chunk, skipping...');
            return null;
        }
        
        // Customize this prompt based on your needs
        const prompt = `You are helping create a Yanomami language learning dataset. Given this dictionary entry:

${chunk}

Create a Q&A pair about ONE of these unused words: ${unusedWords.join(', ')}

Follow this exact template format:
${template}

Make sure to:
1. Choose ONE unused word from the list
2. Provide accurate translation
3. Include grammar information
4. Add relevant usage examples
5. Include cultural context if present

Respond only with the JSONL formatted entry.`;

        console.log('\n   📤 Text sent to AI:');
        console.log('   ' + prompt.split('\n').join('\n   '));

        // Create a promise that rejects in 30 seconds
        let timeoutId;
        const timeout = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error('API request timed out after 30 seconds'));
            }, 30000);
        });

        let response;
        try {
            // Create the API request promise
            const apiRequest = anthropic.messages.create({
                model: process.env.DATASET_GEN_CLAUDE_MODEL || "claude-3-sonnet-20240229",
                max_tokens: 40,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2 // Reduzir temperatura para respostas mais consistentes
            });

            // Race between the timeout and the API request
            response = await Promise.race([apiRequest, timeout]);
            clearTimeout(timeoutId); // Clear timeout if request succeeds
            console.log('\n   📥 Output returned from AI:');
            console.log('   ' + response.content[0].text.split('\n').join('\n   '));
        } catch (error) {
            console.log(`   ⚠️ API Request Error: ${error.message}`);
            return null;
        }

        // Parse and validate the response
        console.log('   🔍 Validating response format...');
        
        // Limpar a resposta
        let responseText = response.content[0].text.trim();
        // Remover caracteres que podem corromper o JSON
        responseText = responseText.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        
        try {
            const entry = JSON.parse(responseText);
            if (!isValidEntry(entry)) {
                console.log('   ⚠️ Invalid entry format');
                return null;
            }

            // Validar conteúdo das mensagens
            const question = entry.messages[0].content;
            const answer = entry.messages[1].content;
            
            if (!question || !answer || question.length < 10 || answer.length < 10) {
                console.log('   ⚠️ Invalid message content');
                return null;
            }

            console.log('   ✅ Valid entry generated');
            
            // Extract the word that was used
            const questionMatch = question.match(/What does '([^']+)' mean/i);
            if (!questionMatch) {
                console.log('   ⚠️ Could not extract used word');
                return null;
            }

            const usedWord = questionMatch[1].toLowerCase();
            usedWords.add(usedWord);
            console.log(`   📝 Added '${usedWord}' to used words list`);

            // Track which lines were used
            const lines = chunk.split('\n');
            const fileCoverage = linesCoverage.get(currentFile);

            // Mark lines as used if they contain the used word or if their content appears in the answer
            lines.forEach((line, idx) => {
                const lineIdx = lineStart + idx;
                if (usedWord && line.toLowerCase().includes(usedWord)) {
                    fileCoverage.add(lineIdx);
                    console.log(`   📝 Added line ${lineIdx} to coverage (contains word '${usedWord}')`);
                }
                // Also mark lines that contain significant parts of the answer
                const words = line.toLowerCase().split(/\s+/).filter(w => w.length > 3);
                for (const word of words) {
                    if (answer.includes(word)) {
                        fileCoverage.add(lineIdx);
                        console.log(`   📝 Added line ${lineIdx} to coverage (contains word '${word}' from answer)`);
                        break;
                    }
                }
            });

            return entry;
        } catch (error) {
            console.log(`   ⚠️ Error processing response: ${error.message}`);
            return null;
        }
    } catch (error) {
        console.log(`   ⚠️ API Error: ${error.message}`);
        if (error.response) {
            console.log('   📝 Error details:', error.response.data);
        }
        return null;
    }
}

/**
 * Validates the structure of a dataset entry
 * @param {Object} entry - The entry to validate
 * @returns {boolean} Whether the entry is valid
 */
function isValidEntry(entry) {
    return entry?.messages?.length === 2 && 
           entry.messages[0].role === 'user' && 
           entry.messages[1].role === 'assistant';
}
