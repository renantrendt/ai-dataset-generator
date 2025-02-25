#!/usr/bin/env node

import { Command } from 'commander';
import { processFiles } from './index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultInputDir = path.join(process.cwd(), 'ai-dataset-generator', 'input');
const defaultOutputDir = path.join(process.cwd(), 'ai-dataset-generator', 'output');

const program = new Command();

program
    .name('ai-dataset-generator')
    .description('Generate AI fine-tuning datasets from text files')
    .version('1.0.0')

program
    .command('init')
    .description('Initialize workspace in the specified directory')
    .argument('[directory]', 'Directory to initialize workspace in (defaults to ./ai-dataset-generator in current directory)')
    .action(async (directory) => {
        const initScript = path.join(__dirname, 'init.js');
        const { spawn } = await import('child_process');
        const args = [initScript];
        if (directory) args.push(directory);
        
        const init = spawn('node', args, { stdio: 'inherit' });
        init.on('exit', (code) => process.exit(code));
    });

program
    .command('generate')
    .description('Generate dataset from input files')
    .option('-i, --input <directory>', 'Input directory containing text files', defaultInputDir)
    .option('-o, --output <file>', 'Output JSONL file path', path.join(defaultOutputDir, `dataset_${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`))
    .option('-n, --max-examples <number>', 'Maximum number of examples to generate', parseInt)
    .action(async (options) => {
        try {
            console.log('🔍 Looking for text files...');
            const result = await processFiles(options.input, options.output, options.maxExamples);
            
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
