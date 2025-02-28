#!/usr/bin/env node

import { mkdirp } from 'mkdirp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

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
        await mkdirp(path.join(baseDir, 'src'));
        await mkdirp(path.join(baseDir, 'scripts'));
        
        // Copy template files
        const templatePath = path.join(__dirname, '..', 'dataset-template.jsonl');
        const envTemplatePath = path.join(__dirname, '..', '.env.generator');
        const readmePath = path.join(__dirname, '..', 'README.md');
        
        // Create and copy template files to the workspace directory
        await fs.copyFile(templatePath, path.join(baseDir, 'dataset-template.jsonl'));
        
        // Copy README.md
        try {
            await fs.copyFile(readmePath, path.join(baseDir, 'README.md'));
            console.log('📄 Copied README.md to workspace');
        } catch (error) {
            console.log('⚠️ Could not copy README.md:', error.message);
        }
        
        // Only copy env file if it doesn't exist
        const envPath = path.join(baseDir, '.env.generator');
        const parentEnvPath = path.join(path.dirname(baseDir), '.env.generator');
        
        try {
            // First check if env file exists in workspace
            await fs.access(envPath);
            console.log('ℹ️  Using existing .env.generator in workspace');
        } catch {
            try {
                // Then check if it exists in parent directory
                await fs.access(parentEnvPath);
                console.log('ℹ️  Using existing .env.generator from parent directory');
                await fs.copyFile(parentEnvPath, envPath);
            } catch {
                // If no env file exists, create new one in workspace
                await fs.copyFile(envTemplatePath, envPath);
                console.log('✨ Created new .env.generator file in workspace');
            }
        }

        // Copy all src files to the user's workspace
        const srcDir = path.join(__dirname, '..');
        const srcFiles = await glob('src/**/*.js', { cwd: srcDir, absolute: true });
        
        for (const file of srcFiles) {
            const relativePath = path.relative(srcDir, file);
            const destPath = path.join(baseDir, relativePath);
            
            // Create directory if it doesn't exist
            await mkdirp(path.dirname(destPath));
            
            // Copy the file
            await fs.copyFile(file, destPath);
            console.log(`📄 Copied ${relativePath} to workspace`);
        }

        // Copy all scripts to the user's workspace
        const scriptsDir = path.join(srcDir, 'ai-dataset-generator', 'scripts');
        try {
            await fs.access(scriptsDir);
            const scriptFiles = await glob('**/*.{js,cjs}', { cwd: scriptsDir, absolute: true });
            
            for (const file of scriptFiles) {
                const relativePath = path.relative(scriptsDir, file);
                const destPath = path.join(baseDir, 'scripts', relativePath);
                
                // Create directory if it doesn't exist
                await mkdirp(path.dirname(destPath));
                
                // Copy the file
                await fs.copyFile(file, destPath);
                console.log(`📄 Copied scripts/${relativePath} to workspace`);
            }
        } catch (error) {
            console.log('⚠️ Could not copy scripts:', error.message);
        }

        // Copy example files from input directory
        const inputDir = path.join(srcDir, 'ai-dataset-generator', 'input');
        try {
            await fs.access(inputDir);
            const inputFiles = await glob('**/*', { cwd: inputDir, absolute: true, nodir: true });
            
            for (const file of inputFiles) {
                const relativePath = path.relative(inputDir, file);
                const destPath = path.join(baseDir, 'input', relativePath);
                
                // Create directory if it doesn't exist
                await mkdirp(path.dirname(destPath));
                
                // Copy the file
                await fs.copyFile(file, destPath);
                console.log(`📄 Copied input/${relativePath} to workspace`);
            }
        } catch (error) {
            console.log('ℹ️ No example input files to copy');
        }

        // Copy example files from output directory
        const outputDir = path.join(srcDir, 'ai-dataset-generator', 'output');
        try {
            await fs.access(outputDir);
            const outputFiles = await glob('**/*', { cwd: outputDir, absolute: true, nodir: true });
            
            for (const file of outputFiles) {
                const relativePath = path.relative(outputDir, file);
                const destPath = path.join(baseDir, 'output', relativePath);
                
                // Create directory if it doesn't exist
                await mkdirp(path.dirname(destPath));
                
                // Copy the file
                await fs.copyFile(file, destPath);
                console.log(`📄 Copied output/${relativePath} to workspace`);
            }
        } catch (error) {
            console.log('ℹ️ No example output files to copy');
        }

        console.log('\n✅ Workspace initialized successfully!');
        console.log('\nWorkspace structure created at:', baseDir);
        console.log(`
  ├── input/                 (Place your text files here)
  ├── output/                (Generated datasets will be saved here)
  ├── src/                   (Source code)
  ├── scripts/               (Utility scripts)
  ├── dataset-template.jsonl (Example format)
  ├── README.md              (Documentation)
  └── .env.generator         (API configuration)
`);
        console.log('\n📝 Next steps:');
        console.log('1. Configure your API keys in .env.generator');
        console.log('2. Add your text files to the input directory');
        console.log('3. Run: npx ai-dataset-generator generate\n');
        console.log('📘 Note: To customize templates, edit the src/prompt-template.js file in the package\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

// Get custom directory from command line args if provided
const customDir = process.argv[2];
initializeWorkspace(customDir);
