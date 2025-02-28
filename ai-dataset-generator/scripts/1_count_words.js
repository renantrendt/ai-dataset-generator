//Script generates a TXT output that lists all the Yanomami words in the "input folder file" using AI.

import fs from 'fs';
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
function loadEnvConfig() {
    // Try current directory first
    const currentDirEnv = path.join(process.cwd(), '.env.generator');
    const aiGenDirEnv = path.join(process.cwd(), 'ai-dataset-generator', '.env.generator');
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const homeDirEnv = path.join(homeDir, 'ai-dataset-generator', '.env.generator');

    // Try loading from different locations in order of preference
    const envPaths = [currentDirEnv, aiGenDirEnv, homeDirEnv];
    
    for (const envPath of envPaths) {
        try {
            if (fs.existsSync(envPath)) {
                dotenv.config({ path: envPath });
                return;
            }
        } catch (error) {
            // Continue to next path if current one fails
            continue;
        }
    }
}

// Load environment variables
loadEnvConfig();

// Reads the file
const content = fs.readFileSync('/Users/renanserrano/CascadeProjects/Yanomami/AiDatasetGeneratorFineTunning/ai-dataset-generator/input/modified-dictionary.txt', 'utf8');

// Extract Yanomami words
const entries = content.split('\n\n');

// Collect candidate words, removing symbols and numbers
const candidateWords = new Set();
entries.forEach(entry => {
    const words = entry.split(/\s+/); // Divide by spaces
    words.forEach(word => {
        // Remove symbols, numbers, and extra spaces
        word = word.replace(/[\[\]()\{\},;:.+\/]/g, '').trim();
        if (word.length === 0) return;
        
        // Unify letters with spaces between them
        word = word.replace(/\s+/g, '');
        
        candidateWords.add(word);
    });
});

console.log(`Total candidate words: ${candidateWords.size}`);

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.DATASET_GEN_ANTHROPIC_KEY
});

// Function to classify words in batches using Claude AI
async function classifyWordBatches(words, batchSize = 100) {
    const batches = [];
    const allWords = Array.from(words);
    
    // Divide into batches
    for (let i = 0; i < allWords.length; i += batchSize) {
        batches.push(allWords.slice(i, i + batchSize));
    }
    
    console.log(`Processing ${batches.length} batches of words...`);
    
    // Create the output file or clear it if it already exists
    const outputFilePath = '/Users/renanserrano/CascadeProjects/Yanomami/AiDatasetGeneratorFineTunning/ai-dataset-generator/output/yanomami-words.txt';
    fs.writeFileSync(outputFilePath, '', 'utf8');
    
    let totalYanomamWords = 0;
    
    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Processing batch ${i+1}/${batches.length} with ${batch.length} words...`);
        
        try {
            const response = await anthropic.messages.create({
                model: process.env.DATASET_GEN_CLAUDE_MODEL || "claude-3-sonnet-20240229",
                max_tokens: 4000,
                temperature: 0,
                system: "You are a language classifier that identifies indigenous Yanomami words from Spanish words. The Yanomami language is an indigenous language spoken in Venezuela and Brazil.",
                messages: [
                    {
                        role: "user",
                        content: `I have a list of words, some are Yanomami (indigenous) words and some are Spanish words. Please classify each word and return ONLY the Yanomami words as a comma-separated list.
                        
                        Words: ${batch.join(', ')}
                        
                        IMPORTANT: Return ONLY the Yanomami words as a comma-separated list with no additional explanation.`
                    }
                ]
            });
            
            // Process the response
            const result = response.content[0].text.trim();
            const filteredWords = result
                .split(',')
                .map(word => word.trim())
                .filter(word => word.length > 0);
            
            // Save the words from this batch immediately to the file
            if (filteredWords.length > 0) {
                fs.appendFileSync(outputFilePath, filteredWords.join('\n') + '\n', 'utf8');
                totalYanomamWords += filteredWords.length;
                console.log(`Yanomami words identified in this batch: ${filteredWords.length}`);
                console.log(`Total Yanomami words so far: ${totalYanomamWords}`);
            } else {
                console.log(`No Yanomami words identified in this batch.`);
            }
            
            // Wait a bit between batches to avoid API limitations
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`Error processing batch ${i+1}: ${error.message}`);
        }
    }
    
    return totalYanomamWords;
}

// Execute the process
(async () => {
    try {
        console.log("Starting Yanomami word classification...");
        const totalYanomamWords = await classifyWordBatches(candidateWords);
        
        // Display the total number of words
        console.log(`\nProcessing completed!`);
        console.log(`Total unique Yanomami words identified: ${totalYanomamWords}`);
        console.log(`List of Yanomami words saved to: /Users/renanserrano/CascadeProjects/Yanomami/AiDatasetGeneratorFineTunning/ai-dataset-generator/output/yanomami-words.txt`);
    } catch (error) {
        console.error(`Error executing the script: ${error.message}`);
    }
})();
