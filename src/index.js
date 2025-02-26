import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import { existsSync, copyFileSync } from 'fs';
import path from 'path';
import { glob } from 'glob';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações do processamento são importadas do prompt-template
let config = {
    chunkSize: 1000,
    minSentences: 3,
    maxSentences: 10
};

// Load environment variables from custom .env file
function loadEnvConfig(inputDir) {
    // Try current directory first
    const currentDirEnv = path.join(process.cwd(), '.env');
    const inputDirEnv = path.join(path.dirname(inputDir), '.env');
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const homeDirEnv = path.join(homeDir, 'ai-dataset-generator', '.env');

    // Try loading from different locations in order of preference
    const envPaths = [currentDirEnv, inputDirEnv, homeDirEnv];
    
    for (const envPath of envPaths) {
        try {
            if (existsSync(envPath)) {
                dotenv.config({ path: envPath });
                return;
            }
        } catch (error) {
            // Continue to next path if current one fails
            continue;
        }
    }
}

function validateApiConfig() {
    const errors = [];
    if (!process.env.DATASET_GEN_ANTHROPIC_KEY && !process.env.DATASET_GEN_OPENAI_KEY) {
        errors.push('❌ No API keys found. Please set either DATASET_GEN_ANTHROPIC_KEY or DATASET_GEN_OPENAI_KEY in .env');
    }
    if (process.env.DATASET_GEN_ANTHROPIC_KEY && !process.env.DATASET_GEN_ANTHROPIC_KEY.startsWith('sk-ant-')) {
        errors.push('❌ Invalid Claude API key format. Should start with "sk-ant-"');
    }
    if (process.env.DATASET_GEN_OPENAI_KEY && !process.env.DATASET_GEN_OPENAI_KEY.startsWith('sk-')) {
        errors.push('❌ Invalid OpenAI API key format. Should start with "sk-"');
    }
    return errors;
}

// Track which words we've used and which lines were processed
export const usedWords = new Set();
export const linesCoverage = new Map(); // Maps file paths to Set of used line numbers

export async function processFiles(inputDir, outputFile, maxExamples = null) {
    try {
        // Load and validate configuration
        loadEnvConfig(inputDir);
        const configErrors = validateApiConfig();
        if (configErrors.length > 0) {
            console.error('\n⚠️ Configuration Issues:');
            configErrors.forEach(error => console.error(error));
            console.log('\n💡 Tip: Check your .env file in the workspace directory');
            throw new Error('Invalid configuration');
        }

        console.log('\n🔍 Scanning input directory...');
        const files = await glob('**/*.txt', { 
            cwd: inputDir,
            absolute: true,
            ignore: ['**/*unused*.txt'] // Ignorar arquivos unused
        });

        if (files.length === 0) {
            console.log('\n⚠️ No text files found in input directory');
            console.log(`💡 Tip: Add .txt files to: ${inputDir}`);
            return { processedFiles: 0, totalChunks: 0, outputFile };
        }

        console.log(`\n📁 Found ${files.length} text file${files.length > 1 ? 's' : ''}`);
        
        // Initialize Anthropic client
        const anthropic = new Anthropic({
            apiKey: process.env.DATASET_GEN_ANTHROPIC_KEY
        });

        // Import the processChunk function from workspace
        const promptTemplatePath = path.join(path.dirname(inputDir), 'prompt-template.js');
        
        if (!existsSync(promptTemplatePath)) {
            throw new Error('Prompt template not found. Please run ai-dataset-generator init first.');
        }
        
        const { processChunk, config: promptConfig, mergeRepeatedOutputs } = await import(promptTemplatePath);
        // Atualizar config com valores do prompt-template
        config = promptConfig;

        // Load template
        const templatePath = path.join(path.dirname(inputDir), 'dataset-template.jsonl');
        const template = await fs.readFile(templatePath, 'utf-8');

        let processedFiles = 0;
        let totalChunks = 0;

        for (const file of files) {
            const fileName = path.basename(file);
            const progress = Math.round((processedFiles / files.length) * 100);
            if (progress % 10 === 0) {
                console.log(`\n⏳ Progress: ${progress}% (${processedFiles}/${files.length} files)`);
            }

            console.log(`\n📄 Processing: ${fileName}`);
            const content = await fs.readFile(file, 'utf-8');
            
            // Initialize line coverage for this file
            const lines = content.split('\n');
            linesCoverage.set(file, new Set());
            console.log(`   📊 File has ${lines.length} total lines`);
            // Calculate target chunks per file if maxExamples specified
            const targetChunksPerFile = maxExamples ? Math.ceil(maxExamples / files.length) : null;
            const chunks = splitIntoChunks(content, targetChunksPerFile);
            
            // Log chunk info
            console.log(`   Generated ${chunks.length} chunks${maxExamples ? ` (Target: ${targetChunksPerFile} per file)` : ''}`);
            
            let processedChunks = 0;
            let skippedChunks = 0;
            const skippedLines = [];
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                processedChunks++;
                console.log(`\n\n=== Processing Chunk ${processedChunks}/${chunks.length} ===`);
                
                try {
                    // Calcular lineStart baseado no índice do chunk
                    const lineStart = i * config.chunkSize;
                    const entries = await processChunk(chunk, template, anthropic, lineStart, file);
                    if (entries && entries.length > 0) {
                        // Write each entry to the JSONL file immediately
                        for (const entry of entries) {
                            try {
                                await fs.appendFile(outputFile, JSON.stringify(entry) + '\n');
                                totalChunks += 1;
                                console.log(`   ✨ Success! Added entry for: ${entry.messages[0].content}`);
                            } catch (error) {
                                console.log(`   ⚠️ Error writing entry to file: ${error.message}`);
                            }
                        }
                        console.log(`   Total valid entries: ${totalChunks}`);
                    } else {
                        skippedChunks++;
                        skippedLines.push(...Array.from({ length: config.chunkSize }, (_, j) => lineStart + j + 1));
                        console.log(`   ⚠️ Chunk skipped: Invalid or empty response`);
                        console.log(`   📈 Stats: ${skippedChunks} chunks skipped so far`);
                    }
                } catch (error) {
                    skippedChunks++;
                    skippedLines.push(...Array.from({ length: config.chunkSize }, (_, j) => lineStart + j + 1));
                    console.log(`   ❌ Error processing chunk: ${error.message}`);
                    console.log(`   📈 Stats: ${skippedChunks} chunks skipped so far`);
                }
            }
            
            if (skippedChunks > 0) {
                console.log(`
               ⚠️ Summary: ${skippedChunks}/${chunks.length} chunks were skipped`);
            }
            processedFiles++;
            
            // Generate coverage report for this file
            const usedLines = linesCoverage.get(file);
            const coverage = Math.round((usedLines.size / lines.length) * 100);

            console.log(`
               📊 File Coverage:`);
            console.log(`      - ${usedLines.size}/${lines.length} lines used (${coverage}%)`);
            console.log(`      - Skipped lines: ${skippedLines.join(', ')}`);

            // Add used lines info
            console.log(`      - Used lines: ${Array.from(usedLines).join(', ')}`);

            // Show unused line ranges and collect unused content
            const unusedRanges = [];
            const unusedContent = [];
            let start = null;
            
            for (let i = 0; i < lines.length; i++) {
                if (!usedLines.has(i) && !skippedLines.includes(i + 1)) {
                    if (start === null) start = i;
                    unusedContent.push(lines[i]);
                } else if (start !== null) {
                    unusedRanges.push([start, i - 1]);
                    start = null;
                }
            }
            if (start !== null) unusedRanges.push([start, lines.length - 1]);
            
            if (unusedRanges.length > 0) {
                console.log('      - Unused line ranges:');
                unusedRanges.forEach(([start, end]) => {
                    console.log(`        • Lines ${start + 1}-${end + 1}`);
                });
                
                // Save unused content to a new file with timestamp
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const fileName = path.basename(file, '.txt');
                const unusedFile = path.join(path.dirname(file), `${fileName}_unused_${timestamp}.txt`);
                await fs.writeFile(unusedFile, unusedContent.join('\n'));
                console.log(`      📄 Unused content saved to: ${path.basename(unusedFile)}`);
            }
        }

        console.log('\n💾 Saving dataset...');
        // Create output directory if it doesn't exist
        await fs.mkdir(path.dirname(outputFile), { recursive: true });

        return {
            processedFiles,
            totalChunks,
            outputFile
        };
    } catch (error) {
        if (error.message !== 'Invalid configuration') {
            console.error('\n❌ Error processing files:', error.message);
        }
        throw error;
    }
}

function splitIntoChunks(text) {
    // Capture everything in the text
    const entries = text.split('\n').map(line => ({
        content: line.trim(),
    })).filter(entry => entry.content.length > 0);

    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;
    const MAX_CHUNK_SIZE = 4096; // Safe limit for tokens

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        // Check if the current entry fits in the chunk
        if (currentSize + entry.content.length > MAX_CHUNK_SIZE) {
            // If the chunk is too large, split it into smaller parts
            while (currentSize + entry.content.length > MAX_CHUNK_SIZE) {
                const splitPoint = MAX_CHUNK_SIZE - currentSize;
                const splitEntry = entry.content.slice(0, splitPoint);
                currentChunk.push({ content: splitEntry });
                chunks.push(currentChunk.map(e => e.content).join('\n'));
                currentChunk = [];
                currentSize = 0;
                entry.content = entry.content.slice(splitPoint); // Remainder of the entry
            }
        }
        
        // Add entry to the current chunk
        currentChunk.push(entry);
        currentSize += entry.content.length;

        // If it's the last entry, add the final chunk
        if (i === entries.length - 1 && currentChunk.length > 0) {
            chunks.push(currentChunk.map(e => e.content).join('\n'));
        }
    }
    
    return chunks;
}

export async function validateDataset(datasetPath) {
    try {
        console.log('\n🔍 Validating dataset format...');
        const content = await fs.readFile(datasetPath, 'utf-8');
        const lines = content.trim().split('\n');
        
        let isValid = true;
        let lineNumber = 1;

        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                const valid = Array.isArray(parsed.messages) &&
                             parsed.messages.length === 2 &&
                             parsed.messages[0].role === 'user' &&
                             parsed.messages[1].role === 'assistant';
                
                if (!valid) {
                    console.error(`❌ Invalid format at line ${lineNumber}`);
                    isValid = false;
                }
            } catch {
                console.error(`❌ Invalid JSON at line ${lineNumber}`);
                isValid = false;
            }
            lineNumber++;
        }

        if (isValid) {
            console.log('✅ Dataset format is valid');
        } else {
            console.log('\n💡 Tip: Check dataset-template.jsonl for the correct format');
        }

        return isValid;
    } catch (error) {
        console.error('❌ Error validating dataset:', error.message);
        return false;
    }
}
