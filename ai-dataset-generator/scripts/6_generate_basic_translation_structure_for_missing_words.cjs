// This is a duplicated file of prompt-template.js

// Import necessary modules
const fs = require('fs');
const path = require('path');

// Define file paths
const dictionaryFilePath = path.join(__dirname, '..', 'input', 'modified_dictionary.txt');
const missingWordsFilePath = path.join(__dirname, '..', 'output', '5_14k_words_to_be_translated.jsonl');
const outputFilePath = path.join(__dirname, '..', 'output', '6_14k_words_to_be_translated.txt');

// Create a write stream for the output file
const outputStream = fs.createWriteStream(outputFilePath, { flags: 'a' });

// Function to create translation conversations based on missing words
function createTranslationConversations() {
    // Read the modified dictionary
    fs.readFile(dictionaryFilePath, 'utf8', (err, dictionaryData) => {
        if (err) {
            console.error('Error reading dictionary file:', err);
            return;
        }

        const dictionaryEntries = dictionaryData.split('\n').filter(entry => entry.trim().length > 0);

        // Read the missing words
        fs.readFile(missingWordsFilePath, 'utf8', (err, missingData) => {
            if (err) {
                console.error('Error reading missing words file:', err);
                return;
            }

            const missingWords = missingData.split('\n').filter(word => word.trim().length > 0);

            // Create translation conversations
            missingWords.forEach(word => {
                const dictionaryEntry = dictionaryEntries.find(entry => entry.includes(word));
                const translation = dictionaryEntry ? `Translate '${word}': ${dictionaryEntry}` : `No translation found for '${word}'`;
                // Write each translation to the output file
                outputStream.write(translation + '\n');
            });

            // Close the stream after all translations are written
            outputStream.end();
            console.log('Translations saved to:', outputFilePath);
        });
    });
}

// Execute the function
createTranslationConversations();
