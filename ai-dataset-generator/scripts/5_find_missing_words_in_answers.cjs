//Script generates a JSONL output that list all the words from the dictionary that is not at "4_cleaned..." – NOT using AI

const fs = require('fs');
const path = require('path');

// Path to the file with unique words
const uniqueWordsFilePath = path.join(__dirname, '..', 'output', '1_count_words.txt');
// Path to the file with merged answers
const mergedAnswersFilePath = path.join(__dirname, '..', 'output', '4_cleaned_dataset_merging_duplicated_prompts.jsonl');
// Path to the new file with missing words
const missingWordsFilePath = path.join(__dirname, '..', 'output', '5_14k_words_to_be_translated.jsonl');

// Function to find missing words in answers
function findMissingWordsInAnswers() {
    // Reads the unique words file
    fs.readFile(uniqueWordsFilePath, 'utf8', (err, uniqueData) => {
        if (err) {
            console.error('Error reading unique words file:', err);
            return;
        }

        const uniqueWords = uniqueData.split('\n').filter(word => word.trim().length > 0);

        // Reads the merged answers file
        fs.readFile(mergedAnswersFilePath, 'utf8', (err, mergedData) => {
            if (err) {
                console.error('Error reading merged answers file:', err);
                return;
            }

            const mergedLines = mergedData.split('\n').filter(line => line.trim().length > 0);
            const mergedText = mergedLines.join(' '); // Combines all lines into a single text

            // Finds missing words
            const missingWords = uniqueWords.filter(word => !mergedText.includes(word));

            // Writes missing words to a new file
            fs.writeFile(missingWordsFilePath, missingWords.join('\n'), 'utf8', (err) => {
                if (err) {
                    console.error('Error writing missing words file:', err);
                    return;
                }
                console.log('Missing words not in answers saved to:', missingWordsFilePath);
            });
        });
    });
}

// Executes the function
findMissingWordsInAnswers();
