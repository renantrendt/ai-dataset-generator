import Anthropic from '@anthropic-ai/sdk';

/**
 * Processes a chunk of text using Claude API to generate a structured dataset entry
 * @param {string} chunk - The text chunk to process
 * @param {string} template - The template format to follow
 * @param {Anthropic} anthropic - The Anthropic client instance
 * @returns {Promise<Object|null>} The processed entry or null if invalid
 */
import { linesCoverage, usedWords } from './index.js';

// Configurações do processamento
export const config = {
    chunkSize: 50,     // Caracteres suficientes para uma entrada completa do dicionário
    minSentences: 1,    // Mínimo de uma sentença por chunk
    maxSentences: 2     // Máximo de 4 sentenças por chunk
};

async function processChunk(chunk, template, anthropic, lineStart = 0, currentFile) {
    try {
        // Limita o chunk a 4 linhas
        let lines = chunk.split('\n');
        if (lines.length > 4) {
            lines = lines.slice(0, 4);
            chunk = lines.join('\n');
        }
        
        const endLine = lineStart + lines.length - 1;
        const chunkSize = chunk.length;
        const numLines = lines.length;
        console.log(`\n   📄 Chunk size: ${chunkSize} characters, ${numLines} lines`);
        console.log(`   📄 Lines from file: ${lineStart} to ${endLine}`);
        
        // Extract Yanomami words from the chunk (basic pattern, can be improved)
        const words = chunk.match(/[A-Za-zë\-]+/g) || [];
        
        // Find words we haven't used yet
        const unusedWords = words.filter(word => !usedWords.has(word.toLowerCase()));
        
        if (unusedWords.length === 0) {
            console.log('   ⚠️ No unused words found in chunk, skipping...');
            return null;
        }
        
        // Customize this prompt based on your needs
        const prompt = `You are a linguistic expert specializing in the Yanomami language. Analyze this dictionary entry and create detailed entries for ALL words that have translations:

${chunk}

Create a JSON array containing an object for EACH word you find, following this structure:
[
    {
        "word": "yanomami_word",
        "translation": "english_translation",
        "grammar": "grammatical_info",
        "related_forms": ["list", "of", "related", "words"],
        "examples": [
            {
                "yanomami": "example sentence in Yanomami",
                "translation": "English translation"
            }
        ]
    }
]

Rules:
1. Include ALL words that have clear translations in the chunk
2. Each word MUST appear only once in the array
3. Grammar information MUST use one of these standard categories:
   - Noun
   - Verb (Transitive)
   - Verb (Intransitive)
   - Adjective
   - Adverb
   - Pronoun
   - Particle
   - Prefix
   - Suffix
   - Interjection
4. Translation MUST be complete and clear
5. Include 2-3 examples when available (more only if very distinct usages)
6. Skip any word if:
   - No clear translation is found
   - Grammar category is ambiguous
   - The word appears to be a variant of another entry

JSON Format Rules:
1. Every string MUST be in double quotes
2. Arrays/objects MUST have commas between items
3. NO trailing commas after last item
4. NO comments or extra text
5. NO line breaks within strings
6. The outer structure MUST be a JSON array

Respond ONLY with the JSON array, no additional text.`;

        console.log('\n   📤 Text sent to AI:');
        console.log('   ' + prompt.split('\n').join('\n   '));

        // Create a promise that rejects in 60 seconds
        let timeoutId;
        const timeout = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error('API request timed out after 60 seconds'));
            }, 60000);
        });

        let response;
        try {
            // Create the API request promise
            const apiRequest = anthropic.messages.create({
                model: process.env.DATASET_GEN_CLAUDE_MODEL || "claude-3-sonnet-20240229",
                max_tokens: 4096,  // Máximo permitido para Claude 3 Sonnet
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
        let entries = null;

        while (currentTry <= maxRetries) {
            try {
                const parsedResponse = JSON.parse(responseText);
                
                // Verifica se é um array
                if (!Array.isArray(parsedResponse)) {
                    console.log('   ⚠️ Response is not an array');
                    if (typeof parsedResponse === 'object') {
                        // Se for um objeto único, tenta converter para array
                        parsedResponse = [parsedResponse];
                    } else {
                        currentTry++;
                        continue;
                    }
                }
                
                // Valida cada entrada no array
                const validEntries = parsedResponse.filter(entry => isValidEntry(entry));
                
                if (validEntries.length === 0) {
                    console.log('   ⚠️ No valid entries found');
                    currentTry++;
                    continue;
                }
                
                entries = validEntries;
                break; // Se conseguiu fazer parse e validar, sai do loop
            } catch (error) {
                console.log(`   ⚠️ Try ${currentTry}/${maxRetries}: JSON Parse Error - ${error.message}`);
                
                if (currentTry < maxRetries) {
                    // Criar prompt de correção
                    const fixPrompt = `The previous response had a JSON error: ${error.message}

Original response:
${responseText}

Please fix the JSON format issues and return ONLY a valid JSON array following these rules:
1. Every string MUST be in double quotes
2. Arrays/objects MUST have commas between items
3. NO trailing commas after last item
4. NO comments or extra text
5. NO line breaks within strings
6. The outer structure MUST be a JSON array`;

                    console.log('   🔄 Requesting JSON fix...');
                    response = await anthropic.messages.create({
                        model: process.env.DATASET_GEN_CLAUDE_MODEL || "claude-3-sonnet-20240229",
                        max_tokens: 4096,
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

        if (!entries || entries.length === 0) {
            console.log('   ⚠️ No valid entries found');
            return null;
        }

        console.log('   ✅ Valid entries generated');
        
        const jsonlEntries = entries.map(entry => ({
            messages: [
                {
                    role: 'user',
                    content: `What does '${entry.word}' mean in Yanomami?`
                },
                {
                    role: 'assistant',
                    content: `The word '${entry.word}' in Yanomami means '${entry.translation}'. It is ${entry.grammar === 'Noun' || /^[aeiou]/i.test(entry.grammar) ? 'an' : 'a'} ${entry.grammar}.${entry.examples.length > 0 ? `\n\nHere are some examples:\n\n${entry.examples.map(ex => `- ${ex.yanomami}\n  Translation: ${ex.translation}`).join('\n\n')}` : ''}${entry.related_forms && entry.related_forms.length > 0 ? `\n\nRelated forms: ${entry.related_forms.join(', ')}` : ''}`
                }
            ]
        }));

        // Track used words and update coverage
        for (const entry of entries) {
            const usedWord = entry.word.toLowerCase();
            usedWords.add(usedWord);
            console.log(`   📝 Added '${usedWord}' to used words list`);

            // Track which lines were used
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
                    if (entry.examples.some(example => 
                        example.yanomami.toLowerCase().includes(word) || 
                        example.translation.toLowerCase().includes(word)
                    )) {
                        fileCoverage.add(lineIdx);
                        console.log(`   📝 Added line ${lineIdx} to coverage (contains word '${word}' from examples)`);
                        break;
                    }
                }
            });
        }

        return jsonlEntries;

    } catch (error) {
        console.log(`   ⚠️ API Error: ${error.message}`);
        if (error.response) {
            console.log('   📝 Error details:', error.response.data);
        }
        return null;
    }
}

/**
 * Validates the structure of a single entry
 * @param {Object} entry - Entry to validate
 * @returns {boolean} Whether the entry is valid
 */
function isValidEntry(entry) {
    // Lista de categorias gramaticais válidas
    const validGrammarCategories = [
        'Noun', 'Verb (Transitive)', 'Verb (Intransitive)', 'Adjective',
        'Adverb', 'Pronoun', 'Particle', 'Prefix', 'Suffix', 'Interjection'
    ];

    // Validação básica da estrutura
    const hasBasicStructure = entry &&
        typeof entry === 'object' &&
        typeof entry.word === 'string' &&
        typeof entry.translation === 'string' &&
        typeof entry.grammar === 'string' &&
        Array.isArray(entry.examples) &&
        (!entry.related_forms || Array.isArray(entry.related_forms));  // Campo opcional

    if (!hasBasicStructure) {
        console.log(`   ⚠️ Invalid basic structure for word: ${entry?.word || 'unknown'}`);
        return false;
    }

    // Validação do conteúdo
    if (entry.word.trim().length === 0) {
        console.log(`   ⚠️ Empty word found`);
        return false;
    }

    if (entry.translation.trim().length === 0) {
        console.log(`   ⚠️ Empty translation for word: ${entry.word}`);
        return false;
    }

    if (!validGrammarCategories.includes(entry.grammar)) {
        console.log(`   ⚠️ Invalid grammar category '${entry.grammar}' for word: ${entry.word}`);
        return false;
    }

    // Se tem exemplos, valida a estrutura e conteúdo dos exemplos
    if (entry.examples.length > 0) {
        const hasValidExamples = entry.examples.every(example => 
            example && 
            typeof example === 'object' &&
            typeof example.yanomami === 'string' &&
            typeof example.translation === 'string' &&
            example.yanomami.trim().length > 0 &&
            example.translation.trim().length > 0
        );

        if (!hasValidExamples) {
            console.log(`   ⚠️ Invalid examples found for word: ${entry.word}`);
            return false;
        }
    }

    return true;
}

// Função para formatar a resposta do assistente
function formatAssistantResponse(entry) {
    let response = `The word '${entry.word}' in Yanomami means '${entry.translation}'. It is a ${entry.grammar}.`;

    if (entry.related_forms && entry.related_forms.length > 0) {
        response += `\n\nRelated forms: ${entry.related_forms.join(', ')}`;
    }

    if (entry.examples && entry.examples.length > 0) {
        response += '\n\nHere are some examples:\n\n';
        response += entry.examples
            .map(ex => `- ${ex.yanomami}\n  Translation: ${ex.translation}`)
            .join('\n\n');
    }

    return response;
}

/**
 * Merge repeated outputs for the same query into a single entry
 * @param {Array} dataset - Array of dataset entries to be merged
 * @returns {Array} - Array with merged entries for duplicate queries
 */
function mergeRepeatedOutputs(dataset) {
    // Group entries by user query
    const groupedByQuery = {};
    
    for (const entry of dataset) {
        const userQuery = entry.messages[0].content;
        
        if (!groupedByQuery[userQuery]) {
            groupedByQuery[userQuery] = [];
        }
        
        groupedByQuery[userQuery].push(entry);
    }
    
    // Process each group of entries with the same query
    const mergedDataset = [];
    
    for (const query in groupedByQuery) {
        const entriesForQuery = groupedByQuery[query];
        
        // If there's only one entry for this query, add it as is
        if (entriesForQuery.length === 1) {
            mergedDataset.push(entriesForQuery[0]);
            continue;
        }
        
        // Merge multiple entries for the same query
        const mergedEntry = {
            messages: [
                { role: "user", content: query },
                { role: "assistant", content: "" }
            ]
        };
        
        // Combine all assistant responses with a clear separator
        const combinedContent = entriesForQuery.map(entry => 
            entry.messages.find(msg => msg.role === "assistant").content
        ).join("\n\n---\nAlternative interpretation:\n\n");
        
        // Set the combined content as the assistant's response
        mergedEntry.messages[1].content = combinedContent;
        
        // Add the merged entry to the result
        mergedDataset.push(mergedEntry);
    }
    
    return mergedDataset;
}

// Função para validar a entrada gerada
function validateEntry(entry, wordIndex) {
    // Implementar lógica de validação
    return entry && entry.word && entry.translation;
}

// Export functions and config
export {
    processChunk,
    isValidEntry,
    formatAssistantResponse,
    mergeRepeatedOutputs,
    validateEntry
};
