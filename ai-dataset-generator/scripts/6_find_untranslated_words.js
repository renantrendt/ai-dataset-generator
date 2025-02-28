import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Caminhos dos arquivos
const cleanedDatasetPath = path.join(__dirname, '..', 'output', '4_cleaned_dataset_merging_duplicated_prompts.jsonl');
const wordsToTranslatePath = path.join(__dirname, '..', 'output', '5_14k_words_to_be_translated.jsonl');
const outputPath = path.join(__dirname, '..', 'output', '6_words_missing_from_translations.jsonl');

// Função para normalizar palavras (remover hifens)
function normalizeWord(word) {
  // Remove hifens no início, meio ou fim da palavra
  return word.replace(/^–+|–+$/g, '').toLowerCase();
}

async function findMissingWords() {
  try {
    console.log('Starting processing...');
    
    // Ler o arquivo de palavras a serem traduzidas
    const wordsToTranslateContent = await fs.readFile(wordsToTranslatePath, 'utf8');
    const wordsToTranslate = wordsToTranslateContent.split('\n')
      .filter(word => word.trim() !== '')
      .map(word => {
        const normalized = normalizeWord(word.trim());
        return { original: word.trim(), normalized };
      });
    
    console.log(`Read ${wordsToTranslate.length} words from the words to be translated file.`);
    
    // Ler o arquivo de dataset limpo
    const cleanedDatasetContent = await fs.readFile(cleanedDatasetPath, 'utf8');
    const lines = cleanedDatasetContent.split('\n').filter(line => line.trim() !== '');
    
    // Conjunto para armazenar palavras normalizadas encontradas
    const foundNormalizedWords = new Set();
    
    // Processar cada linha do dataset
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        
        // Procurar apenas em mensagens do usuário
        const userMessages = entry.messages.filter(msg => msg.role === 'user');
        
        for (const message of userMessages) {
          const content = message.content;
          
          // Extrair palavras entre aspas simples
          const quotedWordsRegex = /'([^']+)'/g;
          let match;
          
          while ((match = quotedWordsRegex.exec(content)) !== null) {
            const quotedWord = match[1];
            const normalizedQuotedWord = normalizeWord(quotedWord);
            foundNormalizedWords.add(normalizedQuotedWord);
          }
        }
      } catch (error) {
        console.error('Error processing line:', line);
        console.error(error);
      }
    }
    
    console.log(`Found ${foundNormalizedWords.size} unique words in quotes in the user content.`);
    
    // Encontrar palavras que não estão entre aspas
    const missingWords = wordsToTranslate.filter(word => !foundNormalizedWords.has(word.normalized));
    
    console.log(`Found ${missingWords.length} words that are not in quotes.`);
    
    // Estatísticas
    console.log(`Percentage of missing words: ${(missingWords.length / wordsToTranslate.length * 100).toFixed(2)}%`);
    
    // Escrever as palavras não encontradas no arquivo de saída
    await fs.writeFile(outputPath, missingWords.map(word => word.original).join('\n'));
    
    console.log(`Missing words saved in: ${outputPath}`);
    
  } catch (error) {
    console.error('Error processing files:', error);
  }
}

findMissingWords();
