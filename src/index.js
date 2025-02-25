import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

const MAX_CHUNK_SIZE = 4096; // Safe chunk size for Claude
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function processFiles(inputDir, outputFile) {
    try {
        // Find all text files in the input directory
        const files = await glob('**/*.txt', { 
            cwd: inputDir,
            absolute: true 
        });

        const dataset = [];

        for (const file of files) {
            const content = await fs.readFile(file, 'utf-8');
            const chunks = splitIntoChunks(content);
            
            for (const chunk of chunks) {
                // Create a dataset entry for each chunk
                const entry = {
                    messages: [
                        {
                            role: 'user',
                            content: chunk
                        },
                        {
                            role: 'assistant',
                            content: chunk // For basic dataset, using same content
                        }
                    ]
                };
                dataset.push(entry);
            }
        }

        // Write the dataset to JSONL file
        const jsonlContent = dataset.map(entry => JSON.stringify(entry)).join('\n');
        await fs.writeFile(outputFile, jsonlContent);

        return {
            processedFiles: files.length,
            totalChunks: dataset.length,
            outputFile
        };
    } catch (error) {
        console.error('Error processing files:', error);
        throw error;
    }
}

function splitIntoChunks(text) {
    const chunks = [];
    let currentChunk = '';
    const sentences = text.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= MAX_CHUNK_SIZE) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
        } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = sentence;
        }
    }
    
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
}

export async function validateDataset(datasetPath) {
    try {
        const content = await fs.readFile(datasetPath, 'utf-8');
        const lines = content.trim().split('\n');
        
        return lines.every(line => {
            try {
                const parsed = JSON.parse(line);
                return Array.isArray(parsed.messages) &&
                       parsed.messages.length === 2 &&
                       parsed.messages[0].role === 'user' &&
                       parsed.messages[1].role === 'assistant';
            } catch {
                return false;
            }
        });
    } catch (error) {
        console.error('Error validating dataset:', error);
        return false;
    }
}
