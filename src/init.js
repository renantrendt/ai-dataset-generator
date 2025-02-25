#!/usr/bin/env node

import { mkdirp } from 'mkdirp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function initializeWorkspace(customDir) {
    // If no custom directory is provided, use current working directory
    const baseDir = customDir ? 
        path.resolve(customDir) : 
        path.join(process.cwd(), 'ai-dataset-generator');
    
    console.log('🚀 Initializing AI Dataset Generator workspace...\n');

    try {
        // Create workspace directories
        await mkdirp(path.join(baseDir, 'input'));
        await mkdirp(path.join(baseDir, 'output'));
        
        // Copy template files
        const templatePath = path.join(__dirname, '..', 'dataset-template.jsonl');
        const envTemplatePath = path.join(__dirname, '..', '.env.generator');
        const promptTemplatePath = path.join(__dirname, 'prompt-template.js');
        
        // Create and copy template files to the workspace directory
        await fs.copyFile(templatePath, path.join(baseDir, 'dataset-template.jsonl'));
        await fs.copyFile(promptTemplatePath, path.join(baseDir, 'prompt-template.js'));
        console.log('📄 Created prompt template file');
        
        // Only copy env file if it doesn't exist
        const envPath = path.join(baseDir, '.dataset-generator.env');
        const parentEnvPath = path.join(path.dirname(baseDir), '.dataset-generator.env');
        
        try {
            // First check if env file exists in workspace
            await fs.access(envPath);
            console.log('ℹ️  Using existing .dataset-generator.env in workspace');
        } catch {
            try {
                // Then check if it exists in parent directory
                await fs.access(parentEnvPath);
                console.log('ℹ️  Using existing .dataset-generator.env from parent directory');
                await fs.copyFile(parentEnvPath, envPath);
            } catch {
                // If no env file exists, create new one in workspace
                await fs.copyFile(envTemplatePath, envPath);
                console.log('✨ Created new .dataset-generator.env file in workspace');
            }
        }

        console.log('\n✅ Workspace initialized successfully!');
        console.log('\nWorkspace structure created at:', baseDir);
        console.log(`
📁 ai-dataset-generator/
  ├── input/                 (Place your text files here)
  ├── output/                (Generated datasets will be saved here)
  ├── dataset-template.jsonl (Example format)
  └── .dataset-generator.env (API configuration)
`);
        console.log('\n📝 Next steps:');
        console.log('1. Configure your API keys in .dataset-generator.env');
        console.log('2. Add your text files to the input directory');
        console.log('3. Run: npx ai-dataset-generator generate\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

// Get custom directory from command line args if provided
const customDir = process.argv[2];
initializeWorkspace(customDir);
