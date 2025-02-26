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

// Lê o arquivo do dicionário
const dictionaryPath = '/Users/renanserrano/CascadeProjects/Yanomami/AiDatasetGeneratorFineTunning/ai-dataset-generator/input/modified-dictionary.txt';
const content = fs.readFileSync(dictionaryPath, 'utf8');

// Lê a lista de palavras Yanomami validadas
const yanomamWordsPath = '/Users/renanserrano/CascadeProjects/Yanomami/AiDatasetGeneratorFineTunning/ai-dataset-generator/output/yanomami-words.txt';
let yanomamWords = new Set();

if (fs.existsSync(yanomamWordsPath)) {
    const wordsList = fs.readFileSync(yanomamWordsPath, 'utf8').split('\n');
    yanomamWords = new Set(wordsList.filter(word => word.trim().length > 0));
    console.log(`Carregadas ${yanomamWords.size} palavras Yanomami validadas.`);
} else {
    console.warn('⚠️ Arquivo yanomami-words.txt não encontrado. Todas as entradas serão processadas.');
}

// Extrai entradas do dicionário
const entries = content.split('\n\n').filter(entry => entry.trim().length > 0);

console.log(`Total de entradas no dicionário: ${entries.length}`);

// Inicializa cliente Anthropic
const anthropic = new Anthropic({
    apiKey: process.env.DATASET_GEN_ANTHROPIC_KEY
});

// Arquivo de saída JSONL
const outputFilePath = '/Users/renanserrano/CascadeProjects/Yanomami/AiDatasetGeneratorFineTunning/ai-dataset-generator/output/yanomami-dictionary-dataset.jsonl';
// Limpa ou cria o arquivo de saída
fs.writeFileSync(outputFilePath, '', 'utf8');

// Função para extrair a palavra Yanomami principal de uma entrada
function extractYanomamWord(entry) {
    // Pega a primeira linha da entrada
    const firstLine = entry.split('\n')[0].trim();
    
    // Tenta extrair apenas a palavra Yanomami (geralmente é a primeira palavra ou está antes de um ponto ou espaço)
    const match = firstLine.match(/^([a-zA-ZëëïöüÄËÏÖÜñÑ\-–]+)/);
    if (match && match[1]) {
        return match[1].trim();
    }
    
    // Se não conseguir extrair com regex, pega a primeira palavra
    const firstWord = firstLine.split(/\s+/)[0].replace(/[.,;:()]/, '').trim();
    return firstWord;
}

// Função para verificar se uma palavra está na lista de palavras Yanomami validadas
function isYanomamWord(word) {
    // Se não temos lista de palavras validadas, aceita todas
    if (yanomamWords.size === 0) return true;
    
    const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
    return cleanWord.length > 0 && yanomamWords.has(cleanWord);
}

// Função para verificar se uma entrada contém palavras Yanomami validadas
function containsYanomamWord(entry) {
    // Extrai a palavra principal
    const mainWord = extractYanomamWord(entry);
    
    // Verifica se a palavra principal é uma palavra Yanomami
    if (isYanomamWord(mainWord)) {
        return { isValid: true, word: mainWord };
    }
    
    // Se a palavra principal não for Yanomami, verifica outras palavras na entrada
    const words = entry.split(/\s+/);
    for (const word of words) {
        const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
        if (cleanWord.length > 0 && isYanomamWord(cleanWord)) {
            return { isValid: true, word: cleanWord };
        }
    }
    
    return { isValid: false, word: mainWord };
}

// Filtra entradas que contêm palavras Yanomami validadas
const validEntries = [];
const validWords = [];

entries.forEach(entry => {
    const { isValid, word } = containsYanomamWord(entry);
    if (isValid) {
        validEntries.push({ entry, word });
        validWords.push(word);
    }
});

console.log(`Entradas contendo palavras Yanomami validadas: ${validEntries.length}/${entries.length}`);
console.log(`Palavras Yanomami identificadas: ${validWords.length}`);

// Função para processar cada entrada do dicionário
async function processEntry(entryData, index, total) {
    const { entry, word } = entryData;
    console.log(`Processando entrada ${index+1}/${total}: ${word}`);
    
    try {
        const response = await anthropic.messages.create({
            model: process.env.DATASET_GEN_CLAUDE_MODEL || "claude-3-sonnet-20240229",
            max_tokens: 4000,
            temperature: 0.2,
            system: "You are a linguistic expert specializing in the Yanomami language. Your task is to analyze dictionary entries and extract structured information about Yanomami words.",
            messages: [
                {
                    role: "user",
                    content: `Extract information from this Yanomami dictionary entry and format it as a comprehensive explanation. If you're uncertain about any information, make reasonable inferences based on the context.

Dictionary entry:
${entry}

The main Yanomami word/phrase is: ${word}

Please identify:
1. The Yanomami word or phrase
2. English translation
3. Grammar classification (noun, verb, etc.)
4. Usage forms or variations
5. Example sentences (with translations)
6. Any cultural context or additional information

Format your response as a comprehensive explanation that would be helpful to someone learning Yanomami.`
                }
            ]
        });
        
        // Extract the AI's response
        const aiResponse = response.content[0].text.trim();
        
        // Create the JSONL entry in the required format for fine-tuning
        const jsonlEntry = {
            messages: [
                {
                    role: "human",
                    content: `What does '${word}' mean in Yanomami?`
                },
                {
                    role: "assistant",
                    content: aiResponse
                }
            ]
        };
        
        // Append to the output file
        fs.appendFileSync(outputFilePath, JSON.stringify(jsonlEntry) + '\n', 'utf8');
        
        console.log(`✅ Entrada processada com sucesso: ${word}`);
        
        // Pause to avoid hitting API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return true;
    } catch (error) {
        console.error(`❌ Erro ao processar entrada: ${error.message}`);
        return false;
    }
}

// Função para processar entradas em lotes
async function processBatch(entries, batchSize = 10) {
    let processedCount = 0;
    let successCount = 0;
    
    // Processa em lotes pequenos para evitar sobrecarga
    for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        console.log(`\nProcessando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(entries.length/batchSize)}`);
        
        // Processa cada entrada do lote
        for (let j = 0; j < batch.length; j++) {
            const success = await processEntry(batch[j], i + j, entries.length);
            processedCount++;
            if (success) successCount++;
            
            // Salva estatísticas a cada 10 entradas
            if (processedCount % 10 === 0) {
                console.log(`\n📊 Estatísticas:`);
                console.log(`   Entradas processadas: ${processedCount}/${entries.length} (${Math.round(processedCount/entries.length*100)}%)`);
                console.log(`   Taxa de sucesso: ${successCount}/${processedCount} (${Math.round(successCount/processedCount*100)}%)`);
                console.log(`   Arquivo de saída: ${outputFilePath}`);
            }
        }
    }
    
    return { processedCount, successCount };
}

// Executa o processamento
(async () => {
    try {
        console.log("🚀 Iniciando geração do dataset do dicionário Yanomami...");
        
        const { processedCount, successCount } = await processBatch(validEntries);
        
        console.log(`\n✨ Processamento concluído!`);
        console.log(`📊 Estatísticas finais:`);
        console.log(`   Total de entradas processadas: ${processedCount}/${validEntries.length}`);
        console.log(`   Taxa de sucesso: ${successCount}/${processedCount} (${Math.round(successCount/processedCount*100)}%)`);
        console.log(`   Dataset salvo em: ${outputFilePath}`);
    } catch (error) {
        console.error(`❌ Erro ao executar o script: ${error.message}`);
    }
})();
