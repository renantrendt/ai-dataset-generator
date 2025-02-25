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
    const currentDirEnv = path.join(process.cwd(), '.dataset-generator.env');
    const inputDirEnv = path.join(path.dirname(inputDir), '.dataset-generator.env');
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const homeDirEnv = path.join(homeDir, 'ai-dataset-generator', '.dataset-generator.env');

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
        errors.push('❌ No API keys found. Please set either DATASET_GEN_ANTHROPIC_KEY or DATASET_GEN_OPENAI_KEY in .dataset-generator.env');
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
            console.log('\n💡 Tip: Check your .dataset-generator.env file in the workspace directory');
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
        
        const { processChunk, config: promptConfig } = await import(promptTemplatePath);
        // Atualizar config com valores do prompt-template
        config = promptConfig;

        // Load template
        const templatePath = path.join(path.dirname(inputDir), 'dataset-template.jsonl');
        const template = await fs.readFile(templatePath, 'utf-8');

        const dataset = [];
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
            const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim());
            const sentencesPerChunk = targetChunksPerFile ? Math.max(1, Math.ceil(sentences.length / targetChunksPerFile)) : null;
            const chunks = splitIntoChunks(content, targetChunksPerFile);
            
            // Log chunk info
            console.log(`   Generated ${chunks.length} chunks${maxExamples ? ` (Target: ${targetChunksPerFile} per file)` : ''}`);
            
            let processedChunks = 0;
            let skippedChunks = 0;
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                processedChunks++;
                console.log(`\n\n=== Processing Chunk ${processedChunks}/${chunks.length} ===`);
                
                try {
                    // Calcular lineStart baseado no índice do chunk
                    const lineStart = i * sentencesPerChunk;
                    const entry = await processChunk(chunk, template, anthropic, lineStart, file);
                    if (entry) {
                        dataset.push(entry);
                        totalChunks++;
                        console.log(`   ✨ Success! Total valid entries: ${totalChunks}`);
                    } else {
                        skippedChunks++;
                        console.log(`   ⚠️ Chunk skipped: Invalid or empty response`);
                        console.log(`   📈 Stats: ${skippedChunks} chunks skipped so far`);
                    }
                } catch (error) {
                    skippedChunks++;
                    console.log(`   ❌ Error processing chunk: ${error.message}`);
                    console.log(`   📈 Stats: ${skippedChunks} chunks skipped so far`);
                }
            }
            
            if (skippedChunks > 0) {
                console.log(`\n   ⚠️ Summary: ${skippedChunks}/${chunks.length} chunks were skipped`);
            }
            processedFiles++;
            
            // Generate coverage report for this file
            const usedLines = linesCoverage.get(file);
            const coverage = Math.round((usedLines.size / lines.length) * 100);
            console.log(`\n   📊 File Coverage:`);
            console.log(`      - ${usedLines.size}/${lines.length} lines used (${coverage}%)`);
            
            // Show unused line ranges and collect unused content
            const unusedRanges = [];
            const unusedContent = [];
            let start = null;
            
            for (let i = 0; i < lines.length; i++) {
                if (!usedLines.has(i)) {
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
        
        // Validar e salvar cada entrada
        const validEntries = dataset.filter(entry => {
            try {
                // Verifica se a entrada é válida e completa
                if (!entry || !entry.messages || entry.messages.length !== 2) return false;
                const content0 = entry.messages[0].content;
                const content1 = entry.messages[1].content;
                if (!content0 || !content1 || content0.includes('undefined') || content1.includes('undefined')) return false;
                if (content0.length < 10 || content1.length < 10) return false;
                return true;
            } catch (e) {
                return false;
            }
        });

        if (validEntries.length < dataset.length) {
            console.log(`⚠️ Removed ${dataset.length - validEntries.length} invalid entries`);
        }

        const jsonlContent = validEntries.map(entry => JSON.stringify(entry)).join('\n');
        await fs.writeFile(outputFile, jsonlContent);

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

function splitIntoChunks(text, targetChunks = null) {
    // Configurações do sliding window
    const OVERLAP_SIZE = Math.floor(config.chunkSize * 0.3); // 30% de overlap
    const EFFECTIVE_CHUNK_SIZE = config.chunkSize - OVERLAP_SIZE;

    // Dividir o texto em entradas do dicionário
    const entries = text.split(/\n(?=\d+\.)/).filter(entry => entry.trim());
    
    const chunks = [];
    let currentPosition = 0;

    while (currentPosition < entries.length) {
        let currentChunk = '';
        let entryCount = 0;
        let i = currentPosition;

        // Construir o chunk principal
        while (i < entries.length) {
            const nextEntry = entries[i];
            if (currentChunk.length + nextEntry.length > EFFECTIVE_CHUNK_SIZE && entryCount >= config.minSentences) {
                break;
            }
            currentChunk += (currentChunk ? '\n' : '') + nextEntry;
            entryCount++;
            i++;
        }

        // Adicionar overlap com próximas entradas
        let overlapText = '';
        let j = i;
        while (j < entries.length && overlapText.length < OVERLAP_SIZE) {
            overlapText += '\n' + entries[j];
            j++;
        }

        // Adicionar o chunk com overlap
        if (currentChunk) {
            chunks.push(currentChunk + overlapText);
        }

        // Avançar a posição, pulando apenas as entradas do chunk principal
        currentPosition += Math.max(1, entryCount);

        // Se temos um limite de chunks e já atingimos, parar
        if (targetChunks && chunks.length >= targetChunks) {
            break;
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
