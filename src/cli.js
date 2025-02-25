#!/usr/bin/env node

import { Command } from 'commander';
import { processFiles } from './index.js';
import path from 'path';

const homeDir = process.env.HOME || process.env.USERPROFILE;
const baseDir = path.join(homeDir, 'ai-dataset-generator');
const defaultInputDir = path.join(baseDir, 'input');
const defaultOutputDir = path.join(baseDir, 'output');

const program = new Command();

program
    .name('ai-dataset-generator')
    .description('Generate AI fine-tuning datasets from text files')
    .version('1.0.0')
    .option('-i, --input <directory>', 'Input directory containing text files', defaultInputDir)
    .option('-o, --output <file>', 'Output JSONL file path', path.join(defaultOutputDir, 'dataset.jsonl'))
    .action(async (options) => {
        try {
            console.log('🔍 Looking for text files...');
            const result = await processFiles(options.input, options.output);
            
            console.log('\n✨ Dataset Generation Complete!');
            console.log('───────────────────────────');
            console.log(`📚 Processed ${result.processedFiles} files`);
            console.log(`📊 Generated ${result.totalChunks} training examples`);
            console.log(`📁 Dataset saved to: ${result.outputFile}`);
            console.log('\n💡 Tip: Check example-dataset.jsonl in your workspace for the expected format');
        } catch (error) {
            console.error('\n❌ Error:', error.message);
            console.log('\n💡 Tip: Make sure you have text files in the input directory:');
            console.log(`   ${defaultInputDir}`);
            process.exit(1);
        }
    });

program.parse();
