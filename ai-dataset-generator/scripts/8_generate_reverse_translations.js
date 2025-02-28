// Script generate JSONL output with queries in English on how to say specific phrases in Yanomami – NOT using AI

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// File paths
const inputFilePath = path.join(__dirname, '..', 'output', '4_cleaned_dataset_merging_duplicated_prompts.jsonl');
const outputFilePath = path.join(__dirname, '..', 'output', '8_reverse_translations.jsonl');

// Regular expressions to extract information
const wordRegex = /'([^']+)'/; // Matches the first word in single quotes
const meaningRegex = /means '([^']+)'/; // Matches the meaning in single quotes after "means"
const grammarRegex = /It is an? ([^\.]+)\./; // Matches the grammar category

async function generateReverseTranslations() {
  try {
    console.log('Starting reverse translation generation...');
    
    // Read the input file
    const inputContent = await fs.readFile(inputFilePath, 'utf8');
    const lines = inputContent.split('\n').filter(line => line.trim() !== '');
    
    console.log(`Read ${lines.length} entries from the input file.`);
    
    // Map to store grouped translations by meaning
    const translationsByMeaning = new Map();
    let processedCount = 0;
    let skippedCount = 0;
    
    // Process each line
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const assistantContent = entry.messages.find(msg => msg.role === 'assistant')?.content;
        
        if (!assistantContent) {
          console.log('Skipping entry without assistant content');
          skippedCount++;
          continue;
        }
        
        // Extract the Yanomami word
        const wordMatch = wordRegex.exec(assistantContent);
        if (!wordMatch) {
          console.log('Could not find Yanomami word in:', assistantContent.substring(0, 100) + '...');
          skippedCount++;
          continue;
        }
        const yanomami_word = wordMatch[1];
        
        // Extract the meaning
        const meaningMatch = meaningRegex.exec(assistantContent);
        if (!meaningMatch) {
          console.log('Could not find meaning for word:', yanomami_word);
          skippedCount++;
          continue;
        }
        const meaning = meaningMatch[1].toLowerCase().trim();
        
        // Extract the grammar category
        const grammarMatch = grammarRegex.exec(assistantContent);
        const grammar = grammarMatch ? grammarMatch[1] : 'word'; // Default to "word" if not found
        
        // Extract examples if available
        const examples = [];
        const exampleMatches = assistantContent.match(/- ([^\n]+)\n  Translation: ([^\n]+)/g);
        
        if (exampleMatches) {
          for (const exampleMatch of exampleMatches) {
            const [yanomami, translation] = exampleMatch.split('\n  Translation: ');
            examples.push({
              yanomami: yanomami.replace('- ', ''),
              translation: translation
            });
          }
        }
        
        // Group by meaning
        if (!translationsByMeaning.has(meaning)) {
          translationsByMeaning.set(meaning, {
            words: new Set(),
            grammars: new Set(),
            examples: [],
            meanings: new Set([meaning])
          });
        }
        
        const translationGroup = translationsByMeaning.get(meaning);
        translationGroup.words.add(yanomami_word);
        translationGroup.grammars.add(grammar);
        
        // Add examples without duplicates
        for (const example of examples) {
          // Check if this example is already included
          const isDuplicate = translationGroup.examples.some(
            ex => ex.yanomami === example.yanomami && ex.translation === example.translation
          );
          
          if (!isDuplicate) {
            translationGroup.examples.push(example);
          }
        }
        
        processedCount++;
        
        // Log progress
        if (processedCount % 100 === 0) {
          console.log(`Processed ${processedCount} entries...`);
        }
      } catch (error) {
        console.error('Error processing line:', error);
        skippedCount++;
      }
    }
    
    console.log(`\nGrouped into ${translationsByMeaning.size} unique meanings.`);
    
    // Create the final reverse translations
    const reverseTranslations = [];
    
    for (const [meaning, data] of translationsByMeaning.entries()) {
      // Sort words and examples for consistent output
      const sortedWords = Array.from(data.words).sort();
      const sortedGrammars = Array.from(data.grammars).sort();
      
      // Limit examples to a reasonable number (max 5)
      const limitedExamples = data.examples.slice(0, 5);
      
      // Create a comprehensive response
      let responseContent = '';
      
      if (sortedWords.length === 1) {
        // Single word translation
        responseContent = `The ${sortedGrammars[0].toLowerCase()} '${meaning}' in Yanomami is '${sortedWords[0]}'.`;
      } else {
        // Multiple words for the same meaning
        responseContent = `The ${sortedGrammars[0].toLowerCase()} '${meaning}' in Yanomami can be expressed as: ${sortedWords.map(w => `'${w}'`).join(', ')}.`;
        
        if (sortedGrammars.length > 1) {
          responseContent += `\n\nThese words can function as: ${sortedGrammars.join(', ')}.`;
        }
      }
      
      // Add examples if available
      if (limitedExamples.length > 0) {
        responseContent += '\n\nHere are some examples:\n\n' + 
          limitedExamples.map(ex => `- ${ex.translation}\n  In Yanomami: ${ex.yanomami}`).join('\n\n');
      }
      
      // Create the reverse translation entry
      const reverseEntry = {
        messages: [
          {
            role: 'user',
            content: `How do you say '${meaning}' in Yanomami?`
          },
          {
            role: 'assistant',
            content: responseContent
          }
        ]
      };
      
      reverseTranslations.push(JSON.stringify(reverseEntry));
    }
    
    // Write to output file
    await fs.writeFile(outputFilePath, reverseTranslations.join('\n'));
    
    console.log(`\nReverse translation generation complete!`);
    console.log(`Successfully processed: ${processedCount} entries`);
    console.log(`Skipped: ${skippedCount} entries`);
    console.log(`Generated: ${reverseTranslations.length} unique reverse translations`);
    console.log(`Output saved to: ${outputFilePath}`);
    
  } catch (error) {
    console.error('Error generating reverse translations:', error);
  }
}

// Run the function
generateReverseTranslations();
