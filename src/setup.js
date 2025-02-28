#!/usr/bin/env node

import { mkdirp } from 'mkdirp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(__dirname, '..');

const FOLDER_STRUCTURE = {
    'input': 'Place your text files here',
    'output': 'Generated datasets will be saved here',
};

const ENV_FILENAME = '.env.generator';

async function setup() {
    try {
        // Create base directory in user's home
        const homeDir = process.env.HOME || process.env.USERPROFILE;
        const baseDir = path.join(homeDir, 'ai-dataset-generator');
        
        // Create directory structure
        for (const [folder, description] of Object.entries(FOLDER_STRUCTURE)) {
            const folderPath = path.join(baseDir, folder);
            await mkdirp(folderPath);
            
            // Create README in each folder
            await fs.writeFile(
                path.join(folderPath, 'README.md'),
                `# ${folder.charAt(0).toUpperCase() + folder.slice(1)} Directory\n\n${description}`
            );
        }

        // Copy dataset template
        const templateSrc = path.join(packageRoot, 'dataset-template.jsonl');
        const templateDest = path.join(baseDir, 'dataset-template.jsonl');
        await fs.copyFile(templateSrc, templateDest);

        // Copy .env.generator to custom env file if it doesn't exist
        const envPath = path.join(baseDir, ENV_FILENAME);
        const envGeneratorPath = path.join(packageRoot, '.env.generator');
        
        try {
            await fs.access(envPath);
            console.log(`\n🔑 Found existing ${ENV_FILENAME} file, skipping creation`);
        } catch {
            const envContent = await fs.readFile(envGeneratorPath, 'utf-8');
            await fs.writeFile(envPath, envContent);
            console.log(`\n🔑 Created ${ENV_FILENAME} file with example API keys`);
        }

        console.log(`\n✨ Created AI Dataset Generator workspace at: ${baseDir}`);
        console.log('📁 Directory structure:');
        console.log(`   ${baseDir}/`);
        console.log('   ├── input/     (Place your text files here)');
        console.log('   ├── output/    (Generated datasets will be saved here)');
        console.log('   ├── dataset-template.jsonl  (Example format - customize this!)');
        console.log(`   └── ${ENV_FILENAME}    (Configure your API keys here)`);
        
        console.log('\n💡 Next steps:');
        console.log(`   1. Edit ${ENV_FILENAME} file and add your API keys`);
        console.log('   2. Place your text files in the input directory');
        console.log('   3. Run: npx ai-dataset-generator');
    } catch (error) {
        console.error('Error setting up workspace:', error);
    }
}

setup();
