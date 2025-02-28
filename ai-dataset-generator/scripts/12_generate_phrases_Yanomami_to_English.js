// Script 12_generate_phrases_Yanomami_to_English.js generate JSONL output with translation phrases from Yanomami to English using AI

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Anthropic } from '@anthropic-ai/sdk';
import { createWriteStream } from 'fs';
import readline from 'readline';
import { fileURLToPath } from 'url';

// Setup __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.generator
const envPath = path.join(__dirname, '..', '.env.generator');
dotenv.config({ path: envPath });
console.log(`Loading environment variables from: ${envPath}`);

// Debug environment variables
console.log('Environment variables:');
console.log('DATASET_GEN_ANTHROPIC_KEY:', process.env.DATASET_GEN_ANTHROPIC_KEY ? 'Set (value hidden)' : 'Not set');
console.log('DATASET_GEN_CLAUDE_MODEL:', process.env.DATASET_GEN_CLAUDE_MODEL);

// Define file paths
const INPUT_FILE = path.join(__dirname, '../output/4_cleaned_dataset_merging_duplicated_prompts.jsonl');
const OUTPUT_FILE = path.join(__dirname, '../output/12_phrases_Yanomami_to_English.jsonl');
const ERROR_LOG_FILE = path.join(__dirname, '../output/12_phrases_Yanomami_to_English_errors.log');

// Create write streams for output and error log
const outputStream = createWriteStream(OUTPUT_FILE, { flags: 'a' });
const errorLogStream = createWriteStream(ERROR_LOG_FILE, { flags: 'a' });

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.DATASET_GEN_ANTHROPIC_KEY
});


// Add a check to ensure the API key is set
if (!anthropic.apiKey) {
  console.error('Error: Anthropic API key is not set. Please set the DATASET_GEN_ANTHROPIC_KEY environment variable.');
  process.exit(1);
}

// Use the specified Claude model or default to claude-3-sonnet
const CLAUDE_MODEL = process.env.DATASET_GEN_CLAUDE_MODEL || 'claude-3-sonnet-20240229';
console.log(`Using Claude model: ${CLAUDE_MODEL}`);


// Log errors to file
function logError(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  errorLogStream.write(logMessage);
  console.error(message);
}

// Function to translate a phrase using Claude
async function translatePhrase(phrase) {
  try {
    console.log(`Translating phrase: "${phrase}"`);
    
    // Prepare system prompt for translation
    const systemPrompt = `You are an expert in Yanomami language translation. You will be asked to translate a phrase or sentence from Yanomami to English.

IMPORTANT INSTRUCTIONS:
1. DO NOT start your response with phrases like "Based on the information provided" or "According to the context".
2. DO NOT introduce yourself or use phrases like "As a Yanomami language expert..." or "In the Yanomami language...".
3. Go directly to the point without unnecessary introductions or presentations.
4. Start with the natural English translation, then provide the literal translation only if it's different.
5. If you're uncertain about any aspect of the translation, state this explicitly rather than making up information.
6. NEVER invent translations that aren't supported by your knowledge of Yanomami.
7. Your response will be used for fine-tuning a language model to assist with Yanomami language interpretation, so make it educational and clear.

FORMAT YOUR RESPONSE LIKE THIS:
"The natural English translation for '[Yanomami phrase]' is [natural translation].
Literal: [literal translation if different]."

EXAMPLES:
"The natural English translation for 'thë aheai' is 'the sun is rising'.
Literal: 'The sun rises'."

"The natural English translation for 'wa rii ha rãrini ãhi teshi ta thapa' is 'I'm going to the forest to hunt and bring back animal meat'.
Literal: 'I go to forest hunt animal meat bring'."

EXAMPLES OF BAD RESPONSES (DO NOT USE THESE FORMATS):
"As a Yanomami language expert, I can translate this phrase as..."
"In the Yanomami language, this phrase means..."
"Based on the information provided, the translation is..."
"Literal: [literal translation]. Natural English: [natural translation]."

Here is the Yanomami phrase to translate:
"${phrase}"`;

    // Create a message with Claude
    const response = await anthropic.messages.create({
      model: process.env.DATASET_GEN_CLAUDE_MODEL || 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Translate this Yanomami phrase to English: "${phrase}"`,
        },
      ],
    });

    // Extract the response content
    const translation = response.content[0].text;
    
    // Create the output object
    const outputObject = {
      messages: [
        {
          role: 'user',
          content: `Translate this Yanomami phrase to English: "${phrase}"`,
        },
        {
          role: 'assistant',
          content: translation,
        },
      ],
    };
    
    // Write to output file
    outputStream.write(JSON.stringify(outputObject) + '\n');
    console.log(`Successfully translated and saved to output file.`);
    
    // Return the translation
    return translation;
  } catch (error) {
    // Log the error
    logError(`Error translating phrase "${phrase}": ${error.message}`);
    if (error.response) {
      logError(`Response error details: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

// Function to process the input file and translate phrases
async function translatePhrases() {
  try {
    console.log(`Reading input file: ${INPUT_FILE}`);
    
    // Check if input file exists
    if (!fs.existsSync(INPUT_FILE)) {
      console.error(`Input file not found: ${INPUT_FILE}`);
      process.exit(1);
    }
    
    // Create readline interface
    const fileStream = fs.createReadStream(INPUT_FILE);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    
    // Regular expression to extract Yanomami phrases from examples
    const yanomamiFraseRegex = /- ([^:]+?)(?:\s*:\s*([^]+?))?(?:\n\s*Translation:|$)/g;
    
    // Keep track of processed phrases to avoid duplicates
    const processedPhrases = new Set();
    
    // Arrays to store all found phrases
    const allPhrases = [];
    
    console.log('Scanning input file for Yanomami phrases...');
    
    // First pass: collect all phrases
    for await (const line of rl) {
      try {
        // Parse the JSON line
        const entry = JSON.parse(line);
        
        // Extract the assistant's response
        if (entry.messages && entry.messages.length >= 2 && entry.messages[1].role === 'assistant' && entry.messages[1].content) {
          const assistantResponse = entry.messages[1].content;
          
          // Extract Yanomami phrases from examples
          const matches = [...assistantResponse.matchAll(yanomamiFraseRegex)];
          
          for (const match of matches) {
            const yanomamiFrase = match[1].trim();
            
            // Skip if phrase is too short or already processed
            if (yanomamiFrase.length < 3 || processedPhrases.has(yanomamiFrase)) {
              continue;
            }
            
            // Skip if the phrase doesn't look like Yanomami (basic heuristic)
            // This is a simple check - you might need to refine this
            if (!yanomamiFrase.match(/[ãõëïü]/i) && !yanomamiFrase.includes('thë') && !yanomamiFrase.includes('pë')) {
              continue;
            }
            
            // Add to processed phrases
            processedPhrases.add(yanomamiFrase);
            allPhrases.push(yanomamiFrase);
          }
        }
      } catch (error) {
        logError(`Error processing line: ${line}\nError: ${error.message}`);
      }
    }
    
    // Log the total number of phrases found
    console.log(`Found ${allPhrases.length} unique Yanomami phrases to translate.`);
    
    // Reset the file stream for the second pass
    fileStream.destroy();
    
    // Second pass: translate phrases with progress tracking
    let currentIndex = 0;
    
    for (const phrase of allPhrases) {
      currentIndex++;
      console.log(`[Progress: ${currentIndex}/${allPhrases.length}] (${Math.round(currentIndex/allPhrases.length*100)}%) - Translating phrase: "${phrase}"`);
      
      // Translate the phrase
      await translatePhrase(phrase);
      
      // Log remaining phrases
      const remaining = allPhrases.length - currentIndex;
      console.log(`Translation completed. ${remaining} phrases remaining.`);
      
      // Add a delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Translation process completed. Processed ${allPhrases.length} unique phrases.`);
  } catch (error) {
    logError(`Error in translatePhrases: ${error.message}`);
  } finally {
    // Close the streams
    outputStream.end();
    errorLogStream.end();
  }
}

// Main function
async function main() {
  console.log('Starting translation of complete phrases from Yanomami to English...');
  await translatePhrases();
  console.log('Translation process finished.');
}

// Run the main function
main().catch(error => {
  logError(`Unhandled error in main: ${error.message}`);
  process.exit(1);
});
