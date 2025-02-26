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
    const currentDirEnv = path.join(process.cwd(), '.env');
    const aiGenDirEnv = path.join(process.cwd(), 'ai-dataset-generator', '.env');
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const homeDirEnv = path.join(homeDir, 'ai-dataset-generator', '.env');

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

// Lê o arquivo
const content = fs.readFileSync('/Users/renanserrano/CascadeProjects/Yanomami/AiDatasetGeneratorFineTunning/ai-dataset-generator/input/modified-dictionary.txt', 'utf8');

// Extrai palavras Yanomami
const entries = content.split('\n\n');

// Coleta palavras candidatas, removendo símbolos e números
const candidateWords = new Set();
entries.forEach(entry => {
    const words = entry.split(/\s+/); // Divide por espaços
    words.forEach(word => {
        // Remove símbolos, números e espaços extras
        word = word.replace(/[\[\]()\{\},;:.+\/]/g, '').trim();
        if (word.length === 0) return;
        
        // Unifica letras com espaço entre elas
        word = word.replace(/\s+/g, '');
        
        candidateWords.add(word);
    });
});

console.log(`Total de palavras candidatas: ${candidateWords.size}`);

// Inicializa cliente Anthropic
const anthropic = new Anthropic({
    apiKey: process.env.DATASET_GEN_ANTHROPIC_KEY
});

// Função para classificar palavras em lotes usando Claude AI
async function classifyWordBatches(words, batchSize = 100) {
    const batches = [];
    const allWords = Array.from(words);
    
    // Divide em lotes
    for (let i = 0; i < allWords.length; i += batchSize) {
        batches.push(allWords.slice(i, i + batchSize));
    }
    
    console.log(`Processando ${batches.length} lotes de palavras...`);
    
    // Cria o arquivo de saída ou limpa se já existir
    const outputFilePath = '/Users/renanserrano/CascadeProjects/Yanomami/AiDatasetGeneratorFineTunning/ai-dataset-generator/output/yanomami-words.txt';
    fs.writeFileSync(outputFilePath, '', 'utf8');
    
    let totalYanomamWords = 0;
    
    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Processando lote ${i+1}/${batches.length} com ${batch.length} palavras...`);
        
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
            
            // Salva as palavras deste lote imediatamente no arquivo
            if (filteredWords.length > 0) {
                fs.appendFileSync(outputFilePath, filteredWords.join('\n') + '\n', 'utf8');
                totalYanomamWords += filteredWords.length;
                console.log(`Palavras Yanomami identificadas neste lote: ${filteredWords.length}`);
                console.log(`Total de palavras Yanomami até agora: ${totalYanomamWords}`);
            } else {
                console.log(`Nenhuma palavra Yanomami identificada neste lote.`);
            }
            
            // Aguarde um pouco entre lotes para evitar limitações de API
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`Erro ao processar lote ${i+1}: ${error.message}`);
        }
    }
    
    return totalYanomamWords;
}

// Executa o processo
(async () => {
    try {
        console.log("Iniciando classificação de palavras Yanomami vs. Espanhol...");
        const totalYanomamWords = await classifyWordBatches(candidateWords);
        
        // Exibe o total de palavras
        console.log(`\nProcessamento concluído!`);
        console.log(`Total de palavras Yanomami únicas identificadas: ${totalYanomamWords}`);
        console.log(`Lista de palavras Yanomami salva em: /Users/renanserrano/CascadeProjects/Yanomami/AiDatasetGeneratorFineTunning/ai-dataset-generator/output/yanomami-words.txt`);
    } catch (error) {
        console.error(`Erro ao executar o script: ${error.message}`);
    }
})();
