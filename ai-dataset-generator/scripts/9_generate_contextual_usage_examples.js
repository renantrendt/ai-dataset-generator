import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// File paths
const inputFilePath = path.join(__dirname, '..', 'output', '4_cleaned_dataset_merging_duplicated_prompts.jsonl');
const outputFilePath = path.join(__dirname, '..', 'output', '9_contextual_usage_examples.jsonl');

// Regular expressions to extract information
const wordRegex = /'([^']+)'/; // Matches the first word in single quotes
const meaningRegex = /means '([^']+)'/; // Matches the meaning in single quotes after "means"
const grammarRegex = /It is an? ([^\.]+)\./; // Matches the grammar category

async function generateContextualUsageExamples() {
  try {
    console.log('Starting contextual usage examples generation...');
    
    // Read the input file
    const inputContent = await fs.readFile(inputFilePath, 'utf8');
    const lines = inputContent.split('\n').filter(line => line.trim() !== '');
    
    console.log(`Read ${lines.length} entries from the input file.`);
    
    // Map to store word information
    const wordInfoMap = new Map();
    // Map to store related words
    const relatedWordsMap = new Map();
    
    // First pass: Extract word information
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const assistantContent = entry.messages.find(msg => msg.role === 'assistant')?.content;
        
        if (!assistantContent) continue;
        
        // Extract the Yanomami word
        const wordMatch = wordRegex.exec(assistantContent);
        if (!wordMatch) continue;
        
        const yanomami_word = wordMatch[1];
        
        // Extract the meaning
        const meaningMatch = meaningRegex.exec(assistantContent);
        if (!meaningMatch) continue;
        
        const meaning = meaningMatch[1];
        
        // Extract the grammar category
        const grammarMatch = grammarRegex.exec(assistantContent);
        const grammar = grammarMatch ? grammarMatch[1] : 'word';
        
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
        
        // Extract related forms if available
        const relatedFormsMatch = assistantContent.match(/Related forms: ([^\.]+)/);
        const relatedForms = relatedFormsMatch 
          ? relatedFormsMatch[1].split(', ').map(form => form.trim())
          : [];
        
        // Store word information
        wordInfoMap.set(yanomami_word, {
          meaning,
          grammar,
          examples,
          relatedForms
        });
        
        // Store related words relationships
        for (const relatedForm of relatedForms) {
          if (!relatedWordsMap.has(relatedForm)) {
            relatedWordsMap.set(relatedForm, new Set());
          }
          relatedWordsMap.get(relatedForm).add(yanomami_word);
          
          if (!relatedWordsMap.has(yanomami_word)) {
            relatedWordsMap.set(yanomami_word, new Set());
          }
          relatedWordsMap.get(yanomami_word).add(relatedForm);
        }
        
      } catch (error) {
        console.error('Error processing line:', error);
      }
    }
    
    console.log(`Extracted information for ${wordInfoMap.size} words.`);
    
    // Generate contextual usage examples
    const contextualExamples = [];
    
    // 1. Generate "How to use X in a sentence" examples
    for (const [word, info] of wordInfoMap.entries()) {
      if (info.examples.length > 0) {
        const response = `To use the word '${word}' in a Yanomami sentence, you can follow these examples:\n\n`;
        
        const examplesText = info.examples.map((ex, index) => 
          `Example ${index + 1}:\n- Yanomami: ${ex.yanomami}\n- Translation: ${ex.translation}`
        ).join('\n\n');
        
        const usageNote = `\n\nThe word '${word}' means '${info.meaning}' and is ${
          /^[aeiou]/i.test(info.grammar) ? 'an' : 'a'
        } ${info.grammar}. ${
          info.grammar.includes('Verb') 
            ? `When using this verb, remember that Yanomami verbs typically ${
                info.grammar.includes('Transitive') 
                  ? 'require an object' 
                  : 'do not require an object'
              }.` 
            : ''
        }`;
        
        contextualExamples.push(JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `How do I use the word '${word}' in a Yanomami sentence?`
            },
            {
              role: 'assistant',
              content: response + examplesText + usageNote
            }
          ]
        }));
      }
    }
    
    // 2. Generate "In what context is X used" examples
    for (const [word, info] of wordInfoMap.entries()) {
      if (info.examples.length > 0 || info.meaning.includes(',')) {
        let contextDescription = `The word '${word}' in Yanomami is used in the following contexts:\n\n`;
        
        // If the meaning has multiple parts (separated by commas)
        if (info.meaning.includes(',')) {
          const meaningParts = info.meaning.split(',').map(part => part.trim());
          contextDescription += meaningParts.map((part, index) => 
            `${index + 1}. When referring to ${part}`
          ).join('\n');
          contextDescription += '\n\n';
        }
        
        // Add examples with context explanation
        if (info.examples.length > 0) {
          contextDescription += 'Examples of contextual usage:\n\n';
          contextDescription += info.examples.map((ex, index) => 
            `Context ${index + 1}:\n- Yanomami: ${ex.yanomami}\n- Translation: ${ex.translation}\n- Usage: This example shows ${word} used to ${
              info.grammar.includes('Verb') ? 'express an action' : 'describe or identify something'
            }`
          ).join('\n\n');
        }
        
        contextualExamples.push(JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `In what context is the word '${word}' used in Yanomami?`
            },
            {
              role: 'assistant',
              content: contextDescription
            }
          ]
        }));
      }
    }
    
    // 3. Generate "When to use X instead of Y" examples for related words
    for (const [word, relatedSet] of relatedWordsMap.entries()) {
      const relatedWords = Array.from(relatedSet);
      
      // Only proceed if we have information for both words
      if (wordInfoMap.has(word) && relatedWords.some(related => wordInfoMap.has(related))) {
        for (const relatedWord of relatedWords) {
          if (wordInfoMap.has(relatedWord)) {
            const wordInfo = wordInfoMap.get(word);
            const relatedInfo = wordInfoMap.get(relatedWord);
            
            let comparisonText = `When deciding between '${word}' and '${relatedWord}' in Yanomami:\n\n`;
            
            // Compare meanings
            comparisonText += `1. '${word}' means '${wordInfo.meaning}', while '${relatedWord}' means '${relatedInfo.meaning}'.\n\n`;
            
            // Compare grammar categories if different
            if (wordInfo.grammar !== relatedInfo.grammar) {
              comparisonText += `2. '${word}' is ${
                /^[aeiou]/i.test(wordInfo.grammar) ? 'an' : 'a'
              } ${wordInfo.grammar}, while '${relatedWord}' is ${
                /^[aeiou]/i.test(relatedInfo.grammar) ? 'an' : 'a'
              } ${relatedInfo.grammar}.\n\n`;
            }
            
            // Usage guidance
            comparisonText += `Use '${word}' when you want to express ${wordInfo.meaning}. `;
            comparisonText += `Use '${relatedWord}' when you want to express ${relatedInfo.meaning}.\n\n`;
            
            // Examples if available
            if (wordInfo.examples.length > 0 && relatedInfo.examples.length > 0) {
              comparisonText += `Examples with '${word}':\n`;
              comparisonText += wordInfo.examples.slice(0, 2).map(ex => 
                `- ${ex.yanomami}\n  Translation: ${ex.translation}`
              ).join('\n\n');
              
              comparisonText += `\n\nExamples with '${relatedWord}':\n`;
              comparisonText += relatedInfo.examples.slice(0, 2).map(ex => 
                `- ${ex.yanomami}\n  Translation: ${ex.translation}`
              ).join('\n\n');
            }
            
            contextualExamples.push(JSON.stringify({
              messages: [
                {
                  role: 'user',
                  content: `When should I use '${word}' instead of '${relatedWord}' in Yanomami?`
                },
                {
                  role: 'assistant',
                  content: comparisonText
                }
              ]
            }));
          }
        }
      }
    }
    
    // Write to output file
    await fs.writeFile(outputFilePath, contextualExamples.join('\n'));
    
    console.log(`\nContextual usage examples generation complete!`);
    console.log(`Generated ${contextualExamples.length} contextual usage examples.`);
    console.log(`Output saved to: ${outputFilePath}`);
    
  } catch (error) {
    console.error('Error generating contextual usage examples:', error);
  }
}

// Run the function
generateContextualUsageExamples();
