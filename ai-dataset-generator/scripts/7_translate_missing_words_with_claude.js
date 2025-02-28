import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.generator');
dotenv.config({ path: envPath });
console.log(`Loading environment variables from: ${envPath}`);

// Debug environment variables
console.log('Environment variables:');
console.log('DATASET_GEN_ANTHROPIC_KEY:', process.env.DATASET_GEN_ANTHROPIC_KEY ? 'Set (value hidden)' : 'Not set');
console.log('DATASET_GEN_CLAUDE_MODEL:', process.env.DATASET_GEN_CLAUDE_MODEL);

// Define file paths
const missingWordsFilePath = path.join(__dirname, '..', 'output', '6_words_missing_from_translations.jsonl');
const cleanedDatasetFilePath = path.join(__dirname, '..', 'output', '4_cleaned_dataset_merging_duplicated_prompts.jsonl');
const dictionaryFilePath = path.join(__dirname, '..', 'input', 'modified_dictionary.txt');
const skippedWordsFilePath = path.join(__dirname, '..', 'output', '7_skipped_words.jsonl');
const outputFilePath = path.join(__dirname, '..', 'output', '7_additional_dataset.jsonl');

// Initialize the AI client
const anthropic = new Anthropic({
    apiKey: process.env.DATASET_GEN_ANTHROPIC_KEY
});

// Add a check to ensure the API key is set
if (!anthropic.apiKey) {
    console.error('Error: Anthropic API key is not set. Please set the DATASET_GEN_ANTHROPIC_KEY environment variable.');
    process.exit(1);
}

// Create a write stream for skipped words
const skippedWordsStream = fs.createWriteStream(skippedWordsFilePath, { flags: 'a' });

// Variáveis para estatísticas
let totalTokens = 0;
let promptCount = 0;
let maxTokens = 0;
let minTokens = Infinity;

// Function to check if a word exists in the cleaned dataset
function checkIfWordExistsInCleanedDataset(word) {
    const cleanedDatasetContent = fs.readFileSync(cleanedDatasetFilePath, 'utf8');
    const lines = cleanedDatasetContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(`"${word}"`) || line.includes(`'${word}'`)) {
            console.log(`Word '${word}' found in cleaned dataset at line ${i+1}`);
            return true;
        }
    }
    
    return false;
}

// Function to get chunks around the word in the dictionary
function getChunksForWord(word) {
    const dictionaryContent = fs.readFileSync(dictionaryFilePath, 'utf8');
    const lines = dictionaryContent.split('\n');
    const chunks = [];
    const lineNumbers = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(word)) {
            // Limitar o tamanho do chunk a 1000 caracteres
            let chunk = line;
            if (chunk.length > 1000) {
                // Encontrar a posição da palavra no texto
                const wordIndex = chunk.indexOf(word);
                
                // Calcular os limites para o recorte
                const startIndex = Math.max(0, wordIndex - 400);
                const endIndex = Math.min(chunk.length, wordIndex + 600);
                
                // Recortar o chunk para manter a palavra no centro
                chunk = chunk.substring(startIndex, endIndex);
                
                // Adicionar indicadores de truncamento se necessário
                if (startIndex > 0) {
                    chunk = "... " + chunk;
                }
                if (endIndex < line.length) {
                    chunk = chunk + " ...";
                }
            }
            
            chunks.push(chunk);
            lineNumbers.push(i+1);
        }
    }
    
    // Return chunks along with their line numbers
    return chunks.map((chunk, idx) => `[Line ${lineNumbers[idx]}] ${chunk}`);
}

// Função para estimar o número de tokens em um texto
function estimateTokens(text) {
    // Estimativa aproximada: 1 token ~= 4 caracteres em inglês
    // Para outros idiomas ou textos com caracteres especiais, a estimativa pode variar
    return Math.ceil(text.length / 4);
}

// Função para criar um prompt otimizado
function createOptimizedPrompt(word, chunks) {
    // Template básico do prompt
    const promptTemplate = `Translate the Yanomami word '${word}' based on these dictionary entries:
{CHUNKS}

Return ONLY a JSON array:
[{
  "word": "yanomami_word",
  "translation": "english_translation",
  "grammar": "grammatical_category",
  "related_forms": ["related_words"],
  "examples": [{"yanomami":"example","translation":"translation"}]
}]

Grammar categories: Noun, Verb (Transitive), Verb (Intransitive), Adjective, Adverb, Pronoun, Particle, Prefix, Suffix, Interjection.`;

    // Inserir os chunks e verificar o tamanho
    const fullPrompt = promptTemplate.replace('{CHUNKS}', chunks.join('\n'));
    
    // Se o prompt for muito grande, limitar o número de chunks
    if (estimateTokens(fullPrompt) > 1500) {
        // Encontrar os chunks mais relevantes (que contêm exatamente o word)
        const mostRelevantChunks = chunks.filter(chunk => 
            chunk.includes(` ${word} `) || 
            chunk.includes(` ${word},`) || 
            chunk.includes(` ${word}.`) || 
            chunk.includes(` ${word}:`) ||
            chunk.includes(`${word} `)
        );
        
        // Se ainda houver chunks relevantes, usar apenas esses
        if (mostRelevantChunks.length > 0) {
            return promptTemplate.replace('{CHUNKS}', mostRelevantChunks.join('\n'));
        }
        
        // Caso contrário, usar apenas os primeiros chunks até atingir um limite razoável
        let optimizedChunks = [];
        let currentSize = 0;
        const targetSize = 1000; // Tamanho alvo em tokens
        
        for (const chunk of chunks) {
            const chunkSize = estimateTokens(chunk);
            if (currentSize + chunkSize <= targetSize) {
                optimizedChunks.push(chunk);
                currentSize += chunkSize;
            } else {
                break;
            }
        }
        
        return promptTemplate.replace('{CHUNKS}', optimizedChunks.join('\n'));
    }
    
    return fullPrompt;
}

// Function to process each missing word
async function processMissingWords() {
    const missingWordsData = fs.readFileSync(missingWordsFilePath, 'utf8');
    const missingWordsLines = missingWordsData.split('\n').filter(word => word.trim().length > 0);
    
    for (let i = 0; i < missingWordsLines.length; i++) {
        const word = missingWordsLines[i];
        console.log(`\n📤 ========== Processing word: ${word} (${i+1}/${missingWordsLines.length}) ==========`);
        console.log(`Word found at line ${i+1} in ${missingWordsFilePath}`);

        // Check if the word exists in the cleaned dataset
        const existsInCleanedDataset = checkIfWordExistsInCleanedDataset(word);
        console.log(`Word found in cleaned dataset: ${existsInCleanedDataset ? 'Yes' : 'No'}`);
        
        if (existsInCleanedDataset) {
            console.log(`Skipping word '${word}' as it already exists in the cleaned dataset.`);
            continue;
        }

        // Get chunks for the word
        const chunks = getChunksForWord(word);
        if (chunks.length === 0) {
            console.log(`No chunks found in dictionary for word: ${word}`);
            skippedWordsStream.write(JSON.stringify({ word }) + '\n');
            continue;
        }
        
        console.log(`Found ${chunks.length} chunks in dictionary for word: ${word}`);
        console.log(`Dictionary lines:${chunks.map(chunk => `\n${chunk}`)}`);

        // Send to Claude
        try {
            // Criar prompt otimizado
            const promptContent = createOptimizedPrompt(word, chunks);
            
            // Estimar tokens no prompt
            const estimatedTokens = estimateTokens(promptContent);
            console.log(`\n📊 Estimated tokens in prompt: ${estimatedTokens}`);
            
            // Atualizar estatísticas
            totalTokens += estimatedTokens;
            promptCount++;
            maxTokens = Math.max(maxTokens, estimatedTokens);
            minTokens = Math.min(minTokens, estimatedTokens);
            
            // Calcular e mostrar média atual
            const avgTokens = Math.round(totalTokens / promptCount);
            console.log(`📊 Token stats - Avg: ${avgTokens}, Min: ${minTokens}, Max: ${maxTokens}, Total prompts: ${promptCount}`);
            
            console.log(`\n📤 Text sent to AI, waiting for response...`);
            
            const response = await anthropic.messages.create({
                model: process.env.DATASET_GEN_CLAUDE_MODEL || 'claude-3-sonnet-20240229',
                messages: [{
                    role: 'user',
                    content: promptContent
                }],
                max_tokens: 4096,
                temperature: 0.2
            });

            const aiResponse = response.content[0].text.trim();
            console.log(`\n📥 Response from AI for: '${word}':`);
            console.log(`${aiResponse}`);
            
            // Process AI response and save to output file
            try {
                // First, try to clean up the response to ensure it's valid JSON
                let cleanedResponse = aiResponse.trim();
                
                // Sometimes the AI might include markdown code block markers
                if (cleanedResponse.startsWith('```json')) {
                    cleanedResponse = cleanedResponse.replace(/^```json\n/, '').replace(/\n```$/, '');
                } else if (cleanedResponse.startsWith('```')) {
                    cleanedResponse = cleanedResponse.replace(/^```\n/, '').replace(/\n```$/, '');
                }
                
                // Check if the response is a valid JSON array
                if (!cleanedResponse.startsWith('[') || !cleanedResponse.endsWith(']')) {
                    throw new Error('Response is not a valid JSON array');
                }
                
                const parsedEntries = JSON.parse(cleanedResponse);
                
                // Process each entry individually
                for (const entry of parsedEntries) {
                    // Ensure examples and related_forms exist to prevent errors
                    if (!entry.examples) {
                        entry.examples = [];
                    }
                    
                    if (!entry.related_forms) {
                        entry.related_forms = [];
                    }
                    
                    const jsonlEntry = {
                        messages: [
                            {
                                role: 'user',
                                content: `What does '${entry.word}' mean in Yanomami?`
                            },
                            {
                                role: 'assistant',
                                content: `The word '${entry.word}' in Yanomami means '${entry.translation}'. It is ${entry.grammar === 'Noun' || /^[aeiou]/i.test(entry.grammar) ? 'an' : 'a'} ${entry.grammar}.${entry.examples.length > 0 ? `\n\nHere are some examples:\n\n${entry.examples.map(ex => `- ${ex.yanomami}\n  Translation: ${ex.translation}`).join('\n\n')}` : ''}${entry.related_forms.length > 0 ? `\n\nRelated forms: ${entry.related_forms.join(', ')}` : ''}`
                            }
                        ]
                    };
                    
                    // Write each entry as a separate line
                    fs.appendFileSync(outputFilePath, JSON.stringify(jsonlEntry) + '\n');
                    console.log(`Saved translation for '${entry.word}'`);
                }
            } catch (parseError) {
                console.error(`Error processing word '${word}': ${parseError.message}`);
                // Save the raw response to a debug file for inspection
                const debugFilePath = path.join(__dirname, '..', 'output', '7_debug_responses.txt');
                fs.appendFileSync(debugFilePath, `\n\n=== DEBUG FOR WORD: ${word} ===\n${aiResponse}\n=== END DEBUG ===\n\n`);
                
                // Add to skipped words
                skippedWordsStream.write(JSON.stringify({ word, error: parseError.message }) + '\n');
            }

        } catch (error) {
            console.error(`Error processing word '${word}': ${error.message}`);
            skippedWordsStream.write(JSON.stringify({ word, error: error.message }) + '\n');
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000)); // 500 requests per second
    }
}

// Execute the function
processMissingWords().then(() => {
    console.log("\n===== Processing complete =====");
    console.log(`📊 Final token statistics:`);
    console.log(`Total prompts sent: ${promptCount}`);
    console.log(`Average tokens per prompt: ${Math.round(totalTokens / promptCount)}`);
    console.log(`Minimum tokens in a prompt: ${minTokens}`);
    console.log(`Maximum tokens in a prompt: ${maxTokens}`);
    console.log(`Total tokens sent: ${totalTokens}`);
});
