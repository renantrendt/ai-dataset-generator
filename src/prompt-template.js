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
    chunkSize: 1000,    // Caracteres suficientes para uma entrada completa do dicionário
    minSentences: 3,    // Mínimo de sentenças para capturar a definição e alguns exemplos
    maxSentences: 10    // Máximo de sentenças para não pegar entradas adjacentes
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
        const prompt = `You are a Yanomami language expert. Create a dataset entry following these EXACT instructions:

Input Dictionary Text:
${chunk}

Available Words: ${unusedWords.join(', ')}

Rules:
1. Choose ONE main Yanomami word (not Spanish/English)
2. Extract information ONLY from the dictionary text
3. Include related forms (e.g., if 'ahemarei', include 'aheamai')
4. Keep ALL grammatical markers (e.g., 'perf.', 'fact.')
5. Use examples EXACTLY as they appear in text

Format your response as a VALID JSON object with this EXACT structure:
{
  "word": "main_yanomami_word",
  "related_forms": [
    "form1",
    "form2"
  ],
  "translation": "exact_translation_from_dictionary",
  "grammar": "grammatical_info_from_dictionary",
  "examples": [
    {
      "yanomami": "yanomami_example_from_text",
      "spanish": "spanish_translation",
      "english": "english_translation"
    }
  ]
}

IMPORTANT JSON RULES:
1. Every string MUST be in double quotes
2. Arrays/objects MUST have commas between items
3. NO trailing commas after last item
4. NO comments or extra text
5. NO line breaks within strings

Respond ONLY with the JSON object.`;

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
                max_tokens: 1000,  // Suficiente para uma entrada de dicionário com exemplos
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1   // Temperatura muito baixa para máxima consistência
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
        
        // Tenta processar a resposta com até 3 tentativas
        let maxRetries = 3;
        let currentTry = 1;
        let entry = null;

        while (currentTry <= maxRetries) {
            try {
                entry = JSON.parse(responseText);
                break; // Se conseguiu fazer parse, sai do loop
            } catch (error) {
                console.log(`   ⚠️ Try ${currentTry}/${maxRetries}: JSON Parse Error - ${error.message}`);
                
                if (currentTry < maxRetries) {
                    // Criar prompt de correção
                    const fixPrompt = `The previous response had a JSON error: ${error.message}

Original response:
${responseText}

Please fix the JSON format issues and return ONLY a valid JSON object following these rules:
1. Every string MUST be in double quotes
2. Arrays/objects MUST have commas between items
3. NO trailing commas after last item
4. NO comments or extra text
5. NO line breaks within strings`;

                    console.log('   🔄 Requesting JSON fix...');
                    response = await anthropic.messages.create({
                        model: process.env.DATASET_GEN_CLAUDE_MODEL || "claude-3-sonnet-20240229",
                        max_tokens: 1000,
                        messages: [{ role: "user", content: fixPrompt }],
                        temperature: 0.1
                    });

                    responseText = response.content[0].text.trim();
                    responseText = responseText.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
                    currentTry++;
                } else {
                    console.log('   ❌ Max retries reached, skipping chunk');
                    return null;
                }
            }
        }

        // Validar estrutura e conteúdo
        if (!isValidEntry(entry)) {
            console.log('   ⚠️ Invalid entry format');
            return null;
        }

        // Validar campos obrigatórios
        if (!entry.word || !entry.translation || !entry.grammar || !entry.examples) {
            console.log('   ⚠️ Invalid content - missing required fields');
            return null;
        }

            console.log('   ✅ Valid entry generated');
            
            // Track used word
            const usedWord = entry.word.toLowerCase();
            usedWords.add(usedWord);
            console.log(`   📝 Added '${usedWord}' to used words list`);

            // Track which lines were used
            const lines = chunk.split('\n');
            const fileCoverage = linesCoverage.get(currentFile);

            // Mark lines as used if they contain the used word or if their content appears in examples
            lines.forEach((line, idx) => {
                const lineIdx = lineStart + idx;
                if (usedWord && line.toLowerCase().includes(usedWord)) {
                    fileCoverage.add(lineIdx);
                    console.log(`   📝 Added line ${lineIdx} to coverage (contains word '${usedWord}')`);
                }
                // Also mark lines that contain significant parts of examples
                const words = line.toLowerCase().split(/\s+/).filter(w => w.length > 3);
                for (const word of words) {
                    if (entry.examples.some(example => example.toLowerCase().includes(word))) {
                        fileCoverage.add(lineIdx);
                        console.log(`   📝 Added line ${lineIdx} to coverage (contains word '${word}' from examples)`);
                        break;
                    }
                }
            });

            // Convert to JSONL format
            const jsonlEntry = {
                messages: [
                    {
                        role: 'user',
                        content: `What does '${entry.word}' mean in Yanomami?`
                    },
                    {
                        role: 'assistant',
                        content: `The word '${entry.word}' in Yanomami means '${entry.translation}'. It is a ${entry.grammar}. Here are some examples of its usage:\n\n${entry.examples.map(ex => `- ${ex}`).join('\n')}`
                    }
                ]
            };

            return jsonlEntry;
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
    return entry?.word && 
           entry?.translation && 
           entry?.grammar && 
           Array.isArray(entry?.examples);
}
