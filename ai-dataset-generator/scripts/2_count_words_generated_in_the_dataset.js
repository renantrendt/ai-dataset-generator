//Script generates a JSONL output that lists all the translated words generated in the dataset using the command terminal "npx generate" – not using AI.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the yanomami-words.txt file
const filePath = path.join(__dirname, '..', 'output', 'yanomami-words.txt');
// Path to the new file without duplicates
const uniqueFilePath = path.join(__dirname, '..', 'output', 'yanomami-words-unique.txt');

// Function to check for duplicate words and create a new file with unique words
function checkDuplicates() {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }

        // Divide the content into words
        const words = data.split('\n').map(word => word.trim()).filter(word => word.length > 0);
        
        // Create a set to count occurrences
        const wordCount = {};
        words.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });

        // Filter unique words
        const uniqueWords = Object.keys(wordCount);

        // Write unique words to a new file
        fs.writeFile(uniqueFilePath, uniqueWords.join('\n'), 'utf8', (err) => {
            if (err) {
                console.error('Error writing the file:', err);
                return;
            }
            console.log(`File with unique words created at: ${uniqueFilePath}`);
        });

        // Display duplicate words
        const duplicates = Object.entries(wordCount).filter(([word, count]) => count > 1);
        if (duplicates.length > 0) {
            console.log('Duplicate words found:');
            duplicates.forEach(([word, count]) => {
                console.log(`- ${word}: ${count} times`);
            });
        } else {
            console.log('No duplicate words found.');
        }
    });
}

// Execute the function
checkDuplicates();
