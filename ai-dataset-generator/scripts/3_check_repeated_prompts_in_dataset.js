//Script generates a JSONL output that lists all the duplicated translations generated in the dataset using the command terminal "npx generate" –  not using AI.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the dataset_2025-02-26T11-00-33-047Z.jsonl file
const datasetFilePath = path.join(__dirname, '..', 'output', 'dataset_2025-02-26T11-00-33-047Z.jsonl');
// Path to the new file with duplicate lines
const duplicatesFilePath = path.join(__dirname, '..', 'output', 'dataset_duplicates.jsonl');

// Function to check for duplicate lines in the dataset
function checkDuplicatesInDataset() {
    fs.readFile(datasetFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }

        // Divide the content into lines
        const lines = data.split('\n').filter(line => line.trim().length > 0);
        const wordCount = {};
        const duplicateLines = [];

        // Process each line of the dataset
        lines.forEach(line => {
            const entry = JSON.parse(line);
            entry.messages.forEach(message => {
                if (message.role === 'user') {
                    const userPrompt = message.content;
                    // Extract words between single quotes from the prompt
                    const words = userPrompt.match(/'([^']+)'/g);
                    if (words) {
                        words.forEach(word => {
                            // Remove quotes and count the word
                            const cleanWord = word.replace(/'/g, '');
                            wordCount[cleanWord] = (wordCount[cleanWord] || 0) + 1;
                            // If the word has already been seen, add the line to the set of duplicates
                            if (wordCount[cleanWord] > 1) {
                                duplicateLines.push(line);
                            }
                        });
                    }
                }
            });
        });

        // Write the duplicate lines to a new file
        fs.writeFile(duplicatesFilePath, duplicateLines.join('\n'), 'utf8', (err) => {
            if (err) {
                console.error('Error writing the file:', err);
                return;
            }
            console.log('Duplicate lines saved to:', duplicatesFilePath);
        });
    });
}

// Execute the function
checkDuplicatesInDataset();
