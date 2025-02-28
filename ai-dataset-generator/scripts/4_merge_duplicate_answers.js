//Script generates a JSONL output that merge duplicated translations generate at the dataset using the command terminal "npx generate" – NOT using AI

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the file with duplicates
const duplicatesFilePath = path.join(__dirname, '..', 'output', 'dataset_2025-02-26T11-00-33-047Z.jsonl');
// Path to the new file with merged answers
const mergedFilePath = path.join(__dirname, '..', 'output', 'merged_answers-from-original.jsonl');

// Function to merge duplicate answers
function mergeDuplicateAnswers() {
    fs.readFile(duplicatesFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }

        // Divide the content into lines
        const lines = data.split('\n').filter(line => line.trim().length > 0);
        const mergedAnswers = {};

        // Process each line of the dataset
        lines.forEach(line => {
            const entry = JSON.parse(line);
            const userPrompt = entry.messages[0].content;
            const assistantResponse = entry.messages[1].content;

            // Extract the word from the user's question
            const wordMatch = userPrompt.match(/'([^']+)'/);
            if (wordMatch) {
                const word = wordMatch[1];
                if (!mergedAnswers[word]) {
                    mergedAnswers[word] = [];
                }
                mergedAnswers[word].push(assistantResponse);
            }
        });

        // Create the content for the output file
        const outputContent = Object.entries(mergedAnswers).map(([word, responses]) => {
            const combinedResponse = `It can be ${responses.join(' and also it can be ')}.`;
            return JSON.stringify({ messages: [{ role: 'user', content: `What does '${word}' mean in Yanomami?` }, { role: 'assistant', content: combinedResponse }] });
        }).join('\n');

        // Write the merged answers to a new file
        fs.writeFile(mergedFilePath, outputContent, 'utf8', (err) => {
            if (err) {
                console.error('Error writing the file:', err);
                return;
            }
            console.log('Merged answers saved to:', mergedFilePath);
        });
    });
}

// Execute the function
mergeDuplicateAnswers();
