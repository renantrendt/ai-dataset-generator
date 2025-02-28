//Script generates a JSONL output that removes duplicated words listed in the file "5_14kwords..." It also normalizes the words and double-checks if they are not already present in the file "4_cleaned..." – NOT using AI

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// File paths
const cleanedDatasetPath = path.join(__dirname, '..', 'output', '4_cleaned_dataset_merging_duplicated_prompts.jsonl');
const wordsToTranslatePath = path.join(__dirname, '..', 'output', '5_14k_words_to_be_translated.jsonl');
const outputPath = path.join(__dirname, '..', 'output', '6_words_missing_from_translations.jsonl');

// Function to normalize words (remove hyphens)
function normalizeWord(word) {
  // Remove hyphens at the beginning, middle or end of the word
  return word.replace(/^–+|–+$/g, '').toLowerCase();
}

async function findMissingWords() {
  try {
    console.log('Starting processing...');
    
    // Read the file of words to be translated
    const wordsToTranslateContent = await fs.readFile(wordsToTranslatePath, 'utf8');
    const wordsToTranslate = wordsToTranslateContent.split('\n')
      .filter(word => word.trim() !== '')
      .map(word => {
        const normalized = normalizeWord(word.trim());
        return { original: word.trim(), normalized };
      });
    
    console.log(`Read ${wordsToTranslate.length} words from the words to be translated file.`);
    
    // Read the cleaned dataset file
    const cleanedDatasetContent = await fs.readFile(cleanedDatasetPath, 'utf8');
    const lines = cleanedDatasetContent.split('\n').filter(line => line.trim() !== '');
    
    // Set to store found normalized words
    const foundNormalizedWords = new Set();
    
    // Process each line of the dataset
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        
        // Search only in user messages
        const userMessages = entry.messages.filter(msg => msg.role === 'user');
        
        for (const message of userMessages) {
          const content = message.content;
          
          // Extract words between single quotes
          const quotedWordsRegex = /'([^']+)'/g;
          let match;
          
          while ((match = quotedWordsRegex.exec(content)) !== null) {
            const quotedWord = match[1];
            const normalizedQuotedWord = normalizeWord(quotedWord);
            foundNormalizedWords.add(normalizedQuotedWord);
          }
        }
      } catch (error) {
        console.error('Error processing line:', line);
        console.error(error);
      }
    }
    
    console.log(`Found ${foundNormalizedWords.size} unique words in quotes in the user content.`);
    
    // Find words that are not in quotes
    const missingWords = wordsToTranslate.filter(word => !foundNormalizedWords.has(word.normalized));
    
    console.log(`Found ${missingWords.length} words that are not in quotes.`);
    
    // Statistics
    console.log(`Percentage of missing words: ${(missingWords.length / wordsToTranslate.length * 100).toFixed(2)}%`);
    
    // Write the missing words to the output file
    await fs.writeFile(outputPath, missingWords.map(word => word.original).join('\n'));
    
    console.log(`Missing words saved in: ${outputPath}`);
    
  } catch (error) {
    console.error('Error processing files:', error);
  }
}

findMissingWords();
