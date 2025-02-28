// Script 11_generate_grammar_queries.js generate JSONL output with translation grammar queries in English to Yanomami using AI

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.generator
const envPath = path.join(__dirname, '..', '.env.generator');
dotenv.config({ path: envPath });
console.log(`Loading environment variables from: ${envPath}`);

// Debug environment variables
console.log('Environment variables:');
console.log('DATASET_GEN_ANTHROPIC_KEY:', process.env.DATASET_GEN_ANTHROPIC_KEY ? 'Set (value hidden)' : 'Not set');
console.log('DATASET_GEN_CLAUDE_MODEL:', process.env.DATASET_GEN_CLAUDE_MODEL);

// File paths
const dictionaryFilePath = path.join(__dirname, '..', 'output', '4_cleaned_dataset_merging_duplicated_prompts.jsonl');
const outputFilePath = path.join(__dirname, '..', 'output', '11_grammar_queries.jsonl');
const errorLogFilePath = path.join(__dirname, '..', 'output', '11_grammar_queries_errors.log');

// Create output stream
const outputStream = fs.createWriteStream(outputFilePath, { flags: 'a' });
const errorLogStream = fs.createWriteStream(errorLogFilePath, { flags: 'a' });

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.DATASET_GEN_ANTHROPIC_KEY
});

// Grammar query types
const QUERY_TYPES = {
  VERB_CONJUGATION: 'verb_conjugation',
  PLURAL_FORMATION: 'plural_formation'
};

// Target count for each query type
const TARGET_COUNT = {
  [QUERY_TYPES.VERB_CONJUGATION]: 100,
  [QUERY_TYPES.PLURAL_FORMATION]: 100
};

// Function to log errors
function logError(message, error = null) {
  const timestamp = new Date().toISOString();
  const errorMessage = `[${timestamp}] ${message}${error ? `: ${error.message}` : ''}`;
  console.error(errorMessage);
  errorLogStream.write(errorMessage + '\n');
}

// Generate grammar queries
async function generateGrammarQueries() {
  try {
    console.log('Starting grammar queries generation with Claude...');
    
    // Read the dictionary file
    const dictionaryContent = await fs.promises.readFile(dictionaryFilePath, 'utf8');
    const dictionaryEntries = dictionaryContent.split('\n').filter(line => line.trim() !== '');
    
    console.log(`Read ${dictionaryEntries.length} entries from the dictionary file.`);
    
    // Extract word information
    const wordInfoMap = new Map();
    const grammarCategoryMap = new Map();
    
    for (const entry of dictionaryEntries) {
      try {
        const parsedEntry = JSON.parse(entry);
        const assistantContent = parsedEntry.messages.find(msg => msg.role === 'assistant')?.content;
        
        if (!assistantContent) continue;
        
        // Extract the Yanomami word
        const wordMatch = assistantContent.match(/'([^']+)'/);
        if (!wordMatch) continue;
        
        const yanomami_word = wordMatch[1];
        
        // Extract grammar category - atualizado para corresponder ao formato do arquivo
        const grammarMatch = assistantContent.match(/It is an? ([^\.]+)\.|It is a ([^\.]+)\.|It can be The word '[^']+' in Yanomami means '[^']+'\. It is an? ([^\.]+)\./);
        
        let grammar = 'word';
        if (grammarMatch) {
            // Pega o primeiro grupo que não for undefined
            grammar = grammarMatch[1] || grammarMatch[2] || grammarMatch[3] || 'word';
        }
        
        // Normaliza a categoria gramatical para facilitar a busca
        let normalizedGrammar = grammar.toLowerCase();
        
        // Log para depuração
        if (normalizedGrammar.includes('verb')) {
            console.log(`Found verb: ${yanomami_word}, grammar: ${grammar}`);
            
            // Categoriza o verbo como transitivo ou intransitivo
            if (normalizedGrammar.includes('transitive')) {
                normalizedGrammar = 'verb (transitive)';
            } else if (normalizedGrammar.includes('intransitive')) {
                normalizedGrammar = 'verb (intransitive)';
            } else {
                normalizedGrammar = 'verb';
            }
        } else if (normalizedGrammar.includes('noun')) {
            console.log(`Found noun: ${yanomami_word}, grammar: ${grammar}`);
            normalizedGrammar = 'noun';
        }
        
        // Store word information
        wordInfoMap.set(yanomami_word, {
          description: assistantContent,
          grammar: grammar,
          normalizedGrammar: normalizedGrammar
        });
        
        // Store words by grammar category
        if (!grammarCategoryMap.has(normalizedGrammar)) {
          grammarCategoryMap.set(normalizedGrammar, []);
        }
        grammarCategoryMap.get(normalizedGrammar).push(yanomami_word);
        
      } catch (error) {
        logError(`Error processing dictionary entry`, error);
      }
    }
    
    console.log(`Extracted information for ${wordInfoMap.size} words.`);
    console.log(`Found ${grammarCategoryMap.size} grammar categories.`);
    
    // Prepare queries
    const queries = [];
    
    // 1. Verb conjugation queries
    const verbs = [
      ...(grammarCategoryMap.get('verb') || []),
      ...(grammarCategoryMap.get('verb (transitive)') || []),
      ...(grammarCategoryMap.get('verb (intransitive)') || [])
    ];
    
    console.log(`Found ${verbs.length} verbs for conjugation queries.`);
    
    // Take enough verbs to reach target count, or all available if not enough
    const verbsNeeded = Math.min(verbs.length, TARGET_COUNT[QUERY_TYPES.VERB_CONJUGATION]);
    const verbSample = verbs.slice(0, verbsNeeded);
    
    for (const verb of verbSample) {
      queries.push({
        type: QUERY_TYPES.VERB_CONJUGATION,
        word: verb,
        query: `How is the verb '${verb}' conjugated in Yanomami?`,
        wordInfo: wordInfoMap.get(verb)
      });
    }
    
    console.log(`Generated ${verbSample.length} verb conjugation queries out of target ${TARGET_COUNT[QUERY_TYPES.VERB_CONJUGATION]}.`);
    if (verbSample.length < TARGET_COUNT[QUERY_TYPES.VERB_CONJUGATION]) {
      console.log(`Warning: Could not reach target count for verb conjugation queries. Missing ${TARGET_COUNT[QUERY_TYPES.VERB_CONJUGATION] - verbSample.length} queries.`);
    }
    
    // 2. Plural formation queries
    const nouns = [...(grammarCategoryMap.get('noun') || [])];
    
    console.log(`Found ${nouns.length} nouns for plural formation queries.`);
    
    // Take enough nouns to reach target count, or all available if not enough
    const nounsNeeded = Math.min(nouns.length, TARGET_COUNT[QUERY_TYPES.PLURAL_FORMATION]);
    const nounSample = nouns.slice(0, nounsNeeded);
    
    for (const noun of nounSample) {
      queries.push({
        type: QUERY_TYPES.PLURAL_FORMATION,
        word: noun,
        query: `How is the plural of '${noun}' formed in Yanomami?`,
        wordInfo: wordInfoMap.get(noun)
      });
    }
    
    console.log(`Generated ${nounSample.length} plural formation queries out of target ${TARGET_COUNT[QUERY_TYPES.PLURAL_FORMATION]}.`);
    if (nounSample.length < TARGET_COUNT[QUERY_TYPES.PLURAL_FORMATION]) {
      console.log(`Warning: Could not reach target count for plural formation queries. Missing ${TARGET_COUNT[QUERY_TYPES.PLURAL_FORMATION] - nounSample.length} queries.`);
    }
    
    console.log(`Prepared ${queries.length} grammar queries.`);
    
    // Process queries with Claude
    let processedCount = 0;
    let successCount = 0;
    const successByType = {
      [QUERY_TYPES.VERB_CONJUGATION]: 0,
      [QUERY_TYPES.PLURAL_FORMATION]: 0
    };
    
    for (const query of queries) {
      try {
        processedCount++;
        console.log(`\n📤 Processing query ${processedCount}/${queries.length}: ${query.query}`);
        
        // Prepare system prompt based on query type
        let systemPrompt = '';
        
        switch (query.type) {
          case QUERY_TYPES.VERB_CONJUGATION:
            systemPrompt = `You are an expert in Yanomami language grammar. You will be asked about verb conjugation in Yanomami. 
            
I will provide you with information about a Yanomami verb. Use this information to answer questions about how the verb is conjugated.

IMPORTANT INSTRUCTIONS:
1. DO NOT start your response with phrases like "Based on the information provided" or "According to the context".
2. DO NOT introduce yourself or use phrases like "As a Yanomami language expert..." or "In the Yanomami language...".
3. Go directly to the point without unnecessary introductions or presentations.
4. Respond directly and confidently with the information.
5. If the information provided is insufficient to determine the exact conjugation pattern, acknowledge this limitation clearly but still provide the most accurate information possible.
6. Only provide information that can be reasonably inferred from the context provided.
7. If you're uncertain about any aspect of the conjugation, state this explicitly rather than making up information.
8. Structure your response clearly with sections for different tenses/aspects if possible.
9. Include examples from the provided context when available.
10. NEVER invent conjugation patterns that aren't supported by the provided information.
11. Your response will be used for fine-tuning a language model to assist with Yanomami language interpretation, so make it educational and clear.

EXAMPLES OF GOOD RESPONSES:
✅ "The verb '${query.word}' is conjugated as follows:"
✅ "'${query.word}' conjugation patterns:"

EXAMPLES OF BAD RESPONSES (DO NOT USE THESE FORMATS):
❌ "As a Yanomami language expert, I can explain how '${query.word}' is conjugated."
❌ "In the Yanomami language, '${query.word}' is a verb that..."
❌ "Based on the information provided, the verb '${query.word}'..."

Here is the information about the verb '${query.word}':

${query.wordInfo.description}`;
            break;
            
          case QUERY_TYPES.PLURAL_FORMATION:
            systemPrompt = `You are an expert in Yanomami language grammar. You will be asked about plural formation in Yanomami.

I will provide you with information about a Yanomami noun. Use this information to answer questions about how the plural form is created.

IMPORTANT INSTRUCTIONS:
1. DO NOT start your response with phrases like "Based on the information provided" or "According to the context".
2. DO NOT introduce yourself or use phrases like "As a Yanomami language expert..." or "In the Yanomami language...".
3. Go directly to the point without unnecessary introductions or presentations.
4. Respond directly and confidently with the information.
5. If the information provided is insufficient to determine the exact plural formation, acknowledge this limitation clearly but still provide the most accurate information possible.
6. Only provide information that can be reasonably inferred from the context provided.
7. If you're uncertain about any aspect of plural formation, state this explicitly rather than making up information.
8. Include examples from the provided context when available.
9. NEVER invent plural formation rules that aren't supported by the provided information.
10. Your response will be used for fine-tuning a language model to assist with Yanomami language interpretation, so make it educational and clear.

EXAMPLES OF GOOD RESPONSES:
✅ "The plural of '${query.word}' is formed by:"
✅ "To form the plural of '${query.word}':"

EXAMPLES OF BAD RESPONSES (DO NOT USE THESE FORMATS):
❌ "As a Yanomami language expert, I can explain how to form the plural of '${query.word}'."
❌ "In the Yanomami language, the plural of '${query.word}' is..."
❌ "Based on the information provided, the noun '${query.word}'..."

Here is the information about the noun '${query.word}':

${query.wordInfo.description}`;
            break;
        }
        
        console.log(`📤 Sending query to Claude, waiting for response...`);
        
        // Call Claude API
        const response = await anthropic.messages.create({
          model: process.env.DATASET_GEN_CLAUDE_MODEL || 'claude-3-sonnet-20240229',
          max_tokens: 1000,
          temperature: 0.2,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: query.query
            }
          ]
        });
        
        const aiResponse = response.content[0].text.trim();
        console.log(`📥 Response from Claude received ${aiResponse.length}`);
        console.log(`${aiResponse}`); // Print just the beginning
        
        // Create JSONL entry
        const jsonlEntry = {
          messages: [
            {
              role: 'user',
              content: query.query
            },
            {
              role: 'assistant',
              content: aiResponse
            }
          ]
        };
        
        // Write to output stream
        outputStream.write(JSON.stringify(jsonlEntry) + '\n');
        console.log(`✅ Saved response for query: "${query.query}"`);
        successCount++;
        successByType[query.type]++;
        
        // Log progress for each type
        console.log(`Progress - Verb conjugation: ${successByType[QUERY_TYPES.VERB_CONJUGATION]}/${TARGET_COUNT[QUERY_TYPES.VERB_CONJUGATION]} (${Math.round(successByType[QUERY_TYPES.VERB_CONJUGATION] / TARGET_COUNT[QUERY_TYPES.VERB_CONJUGATION] * 100)}%)`);
        console.log(`Progress - Plural formation: ${successByType[QUERY_TYPES.PLURAL_FORMATION]}/${TARGET_COUNT[QUERY_TYPES.PLURAL_FORMATION]} (${Math.round(successByType[QUERY_TYPES.PLURAL_FORMATION] / TARGET_COUNT[QUERY_TYPES.PLURAL_FORMATION] * 100)}%)`);
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        logError(`Error processing query "${query.query}"`, error);
      }
    }
    
    console.log(`\n===== Grammar queries generation complete! =====`);
    console.log(`Processed ${processedCount} queries.`);
    console.log(`Successfully generated ${successCount} responses.`);
    console.log(`Verb conjugation queries: ${successByType[QUERY_TYPES.VERB_CONJUGATION]}/${TARGET_COUNT[QUERY_TYPES.VERB_CONJUGATION]} (${Math.round(successByType[QUERY_TYPES.VERB_CONJUGATION] / TARGET_COUNT[QUERY_TYPES.VERB_CONJUGATION] * 100)}%)`);
    console.log(`Plural formation queries: ${successByType[QUERY_TYPES.PLURAL_FORMATION]}/${TARGET_COUNT[QUERY_TYPES.PLURAL_FORMATION]} (${Math.round(successByType[QUERY_TYPES.PLURAL_FORMATION] / TARGET_COUNT[QUERY_TYPES.PLURAL_FORMATION] * 100)}%)`);
    console.log(`Output saved to: ${outputFilePath}`);
    
    // Close streams
    outputStream.end();
    errorLogStream.end();
    
  } catch (error) {
    logError('Error generating grammar queries with Claude', error);
    
    // Close streams
    outputStream.end();
    errorLogStream.end();
  }
}

// Run the function
generateGrammarQueries();
