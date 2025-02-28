import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// File paths
const inputFilePath = path.join(__dirname, '..', 'output', '4_cleaned_dataset_merging_duplicated_prompts.jsonl');
const outputFilePath = path.join(__dirname, '..', 'output', '10_comparison_queries.jsonl');

// Regular expressions to extract information
const wordRegex = /'([^']+)'/; // Matches the first word in single quotes
const meaningRegex = /means '([^']+)'/; // Matches the meaning in single quotes after "means"
const grammarRegex = /It is an? ([^\.]+)\./; // Matches the grammar category

async function generateGrammarQueries() {
  try {
    console.log('Starting grammar queries generation...');
    
    // Read the input file
    const inputContent = await fs.readFile(inputFilePath, 'utf8');
    const lines = inputContent.split('\n').filter(line => line.trim() !== '');
    
    console.log(`Read ${lines.length} entries from the input file.`);
    
    // Map to store word information
    const wordInfoMap = new Map();
    // Map to store related words
    const relatedWordsMap = new Map();
    // Map to store words by grammar category
    const grammarCategoryMap = new Map();
    
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
          relatedForms,
          fullDescription: assistantContent
        });
        
        // Store words by grammar category
        if (!grammarCategoryMap.has(grammar)) {
          grammarCategoryMap.set(grammar, []);
        }
        grammarCategoryMap.get(grammar).push(yanomami_word);
        
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
    console.log(`Found ${grammarCategoryMap.size} grammar categories.`);
    
    // Generate grammar queries
    const grammarQueries = [];
    
    // 1. Generate verb conjugation queries
    const verbs = [...(grammarCategoryMap.get('verb') || []), 
                   ...(grammarCategoryMap.get('transitive verb') || []),
                   ...(grammarCategoryMap.get('intransitive verb') || [])];
    
    for (const verb of verbs) {
      if (wordInfoMap.has(verb)) {
        const verbInfo = wordInfoMap.get(verb);
        
        let conjugationResponse = `The verb '${verb}' in Yanomami means '${verbInfo.meaning}'.\n\n`;
        conjugationResponse += `Yanomami verbs have different conjugation patterns than English. Here's how '${verb}' is conjugated:\n\n`;
        
        // Create a generic conjugation pattern based on available information
        conjugationResponse += "1. Present tense:\n";
        conjugationResponse += "   - 1st person singular (I): ya " + verb + "\n";
        conjugationResponse += "   - 2nd person singular (you): wa " + verb + "\n";
        conjugationResponse += "   - 3rd person singular (he/she/it): a " + verb + "\n";
        conjugationResponse += "   - 1st person plural (we): yamaki " + verb + "\n";
        conjugationResponse += "   - 2nd person plural (you all): wamaki " + verb + "\n";
        conjugationResponse += "   - 3rd person plural (they): pë " + verb + "\n\n";
        
        conjugationResponse += "2. Past tense:\n";
        conjugationResponse += "   - 1st person singular (I): ya " + verb + " ma\n";
        conjugationResponse += "   - 2nd person singular (you): wa " + verb + " ma\n";
        conjugationResponse += "   - 3rd person singular (he/she/it): a " + verb + " ma\n";
        conjugationResponse += "   - 1st person plural (we): yamaki " + verb + " ma\n";
        conjugationResponse += "   - 2nd person plural (you all): wamaki " + verb + " ma\n";
        conjugationResponse += "   - 3rd person plural (they): pë " + verb + " ma\n\n";
        
        conjugationResponse += "3. Future tense:\n";
        conjugationResponse += "   - 1st person singular (I): ya " + verb + " pë\n";
        conjugationResponse += "   - 2nd person singular (you): wa " + verb + " pë\n";
        conjugationResponse += "   - 3rd person singular (he/she/it): a " + verb + " pë\n";
        conjugationResponse += "   - 1st person plural (we): yamaki " + verb + " pë\n";
        conjugationResponse += "   - 2nd person plural (you all): wamaki " + verb + " pë\n";
        conjugationResponse += "   - 3rd person plural (they): pë " + verb + " pë\n\n";
        
        // Add examples if available
        if (verbInfo.examples.length > 0) {
          conjugationResponse += "Examples of the verb in use:\n\n";
          conjugationResponse += verbInfo.examples.map((ex, index) => 
            `Example ${index + 1}:\n- Yanomami: ${ex.yanomami}\n- Translation: ${ex.translation}`
          ).join('\n\n');
        }
        
        conjugationResponse += "\n\nNote: Yanomami verb conjugation can vary based on dialect and context. This is a simplified representation.";
        
        grammarQueries.push(JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `How is the verb '${verb}' conjugated in Yanomami?`
            },
            {
              role: 'assistant',
              content: conjugationResponse
            }
          ]
        }));
      }
    }
    
    // 2. Generate comparison between related words
    for (const [word, relatedSet] of relatedWordsMap.entries()) {
      const relatedWords = Array.from(relatedSet);
      
      // Only proceed if we have information for both words
      if (wordInfoMap.has(word) && relatedWords.some(related => wordInfoMap.has(related))) {
        for (const relatedWord of relatedWords) {
          if (wordInfoMap.has(relatedWord)) {
            const wordInfo = wordInfoMap.get(word);
            const relatedInfo = wordInfoMap.get(relatedWord);
            
            let comparisonText = `Differences between '${word}' and '${relatedWord}' in Yanomami:\n\n`;
            
            // Compare meanings
            comparisonText += `1. Meaning:\n`;
            comparisonText += `   - '${word}' means '${wordInfo.meaning}'\n`;
            comparisonText += `   - '${relatedWord}' means '${relatedInfo.meaning}'\n\n`;
            
            // Compare grammar categories
            comparisonText += `2. Grammatical category:\n`;
            comparisonText += `   - '${word}' is ${
              /^[aeiou]/i.test(wordInfo.grammar) ? 'an' : 'a'
            } ${wordInfo.grammar}\n`;
            comparisonText += `   - '${relatedWord}' is ${
              /^[aeiou]/i.test(relatedInfo.grammar) ? 'an' : 'a'
            } ${relatedInfo.grammar}\n\n`;
            
            // Compare usage
            comparisonText += `3. Usage:\n`;
            comparisonText += `   - '${word}' is used when ${wordInfo.meaning.includes(',') ? 
              'referring to ' + wordInfo.meaning.split(',')[0].trim() : 
              'expressing ' + wordInfo.meaning}\n`;
            comparisonText += `   - '${relatedWord}' is used when ${relatedInfo.meaning.includes(',') ? 
              'referring to ' + relatedInfo.meaning.split(',')[0].trim() : 
              'expressing ' + relatedInfo.meaning}\n\n`;
            
            // Examples if available
            if (wordInfo.examples.length > 0 || relatedInfo.examples.length > 0) {
              comparisonText += `4. Examples:\n\n`;
              
              if (wordInfo.examples.length > 0) {
                comparisonText += `With '${word}':\n`;
                comparisonText += wordInfo.examples.slice(0, 2).map(ex => 
                  `- ${ex.yanomami}\n  Translation: ${ex.translation}`
                ).join('\n\n');
                comparisonText += '\n\n';
              }
              
              if (relatedInfo.examples.length > 0) {
                comparisonText += `With '${relatedWord}':\n`;
                comparisonText += relatedInfo.examples.slice(0, 2).map(ex => 
                  `- ${ex.yanomami}\n  Translation: ${ex.translation}`
                ).join('\n\n');
              }
            }
            
            grammarQueries.push(JSON.stringify({
              messages: [
                {
                  role: 'user',
                  content: `What is the difference between '${word}' and '${relatedWord}' in Yanomami?`
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
    
    // 3. Generate plural formation queries for nouns
    const nouns = [...(grammarCategoryMap.get('noun') || [])];
    
    for (const noun of nouns) {
      if (wordInfoMap.has(noun)) {
        const nounInfo = wordInfoMap.get(noun);
        
        let pluralResponse = `To form the plural of '${noun}' in Yanomami:\n\n`;
        
        // Create a generic plural formation explanation
        pluralResponse += "In the Yanomami language, plural formation generally follows these rules:\n\n";
        pluralResponse += "1. For nouns referring to people or animate beings, the suffix 'pë' is added.\n";
        pluralResponse += `   Singular: ${noun}\n`;
        pluralResponse += `   Plural: ${noun} pë\n\n`;
        
        pluralResponse += "2. For inanimate nouns, the plural is often indicated by context, without changing the word.\n\n";
        
        pluralResponse += "3. In some cases, quantifiers can be used before the noun to indicate plurality.\n";
        pluralResponse += `   Example: 'mori ${noun}' (many/several ${nounInfo.meaning})\n\n`;
        
        // Add examples if available
        if (nounInfo.examples.length > 0) {
          pluralResponse += "Examples of usage:\n\n";
          pluralResponse += nounInfo.examples.map((ex, index) => 
            `Example ${index + 1}:\n- Yanomami: ${ex.yanomami}\n- Translation: ${ex.translation}`
          ).join('\n\n');
        }
        
        pluralResponse += "\n\nNote: Plural formation in Yanomami may vary according to dialect and specific context.";
        
        grammarQueries.push(JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `How is the plural of '${noun}' formed in Yanomami?`
            },
            {
              role: 'assistant',
              content: pluralResponse
            }
          ]
        }));
      }
    }
    
    // Write to output file
    await fs.writeFile(outputFilePath, grammarQueries.join('\n'));
    
    console.log(`\nGrammar queries generation complete!`);
    console.log(`Generated ${grammarQueries.length} grammar queries.`);
    console.log(`Output saved to: ${outputFilePath}`);
    
  } catch (error) {
    console.error('Error generating grammar queries:', error);
  }
}

// Run the function
generateGrammarQueries();
