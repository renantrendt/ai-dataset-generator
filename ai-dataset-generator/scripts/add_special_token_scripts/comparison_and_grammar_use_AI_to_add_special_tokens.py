// Script para adicionar tokens especiais ao texto usando a API do Anthropic (Claude)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente do arquivo .env.generator
dotenv.config({ path: '.env.generator' });

// Obtém o diretório do módulo atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurações do processamento
export const config = {
    maxRetries: 3     // Número máximo de tentativas em caso de erro
};

/**
 * Processa uma linha JSON usando a API do Claude para adicionar tokens especiais
 * @param {string} line - Linha JSON a ser processada
 * @param {Anthropic} anthropic - Instância do cliente Anthropic
 * @param {number} lineNumber - Número da linha sendo processada (para logs)
 * @returns {Promise<string>} - Linha processada com tokens especiais
 */
async function processLine(line, anthropic, lineNumber) {
    let currentTry = 1;
    
    while (currentTry <= config.maxRetries) {
        try {
            console.log(`   📤 Enviando conteúdo para Claude (linha ${lineNumber}, tentativa ${currentTry}/${config.maxRetries})`);
            console.log(`   📜 Conteúdo enviado: ${line}`); // Log do conteúdo enviado
            
            // Cria o prompt para o Claude
            const prompt = `You are an expert in natural language processing and text markup. Your task is to add special XML tags to the text below, which contains information about words in Yanomami.

The text follows a specific format that compares two words in Yanomami, including their meanings, grammatical categories, uses, and examples.

Add the following XML tags to the text:
- <WORD>palavra_yanomami</WORD> - to mark words in Yanomami
- <POS>categoria_gramatical</POS> - for grammatical categories (Noun, Verb, Adjective, etc.)
- <DEFINITION>definição</DEFINITION> - for word definitions
- <EXAMPLES>exemplos</EXAMPLES> - for the examples section
- <EXAMPLE_YANOMAMI>exemplo_em_yanomami</EXAMPLE_YANOMAMI> - for examples in Yanomami
- <EXAMPLE_TRANSLATION>example_translation</EXAMPLE_TRANSLATION> - for example translations
- <YANOMAMI>yanomami_text</YANOMAMI> - for other Yanomami phrases
- <TRANSLATION>translation</TRANSLATION> - for translations
- <LITERAL>literal_translation</LITERAL> - for literal translations
- <RELATED_FORMS>related_forms</RELATED_FORMS> - for related forms
- <USAGE>usage</USAGE> - for usage information
- <GRAMMATICAL>grammatical_information</GRAMMATICAL> - for additional grammar information

Rules:
1. Preserve the format and original structure of the text
2. Do not add or remove information
3. Apply the tags consistently and accurately
4. Ensure that all tags are correctly closed
5. Do not use nested tags of the same type

Here is the text to mark:

${line}

Reply ONLY with the text marked, without additional explanations.`;

            // Cria uma promessa que rejeita após 60 segundos
            let timeoutId;
            const timeout = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error('Requisição à API expirou após 60 segundos'));
                }, 60000);
            });

            // Faz a requisição à API
            const apiRequest = anthropic.messages.create({
                model: process.env.DATASET_GEN_CLAUDE_MODEL || "claude-3-sonnet-20240229",
                max_tokens: 4096,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1
            });

            // Compete entre o timeout e a requisição à API
            const response = await Promise.race([apiRequest, timeout]);
            clearTimeout(timeoutId); // Limpa o timeout se a requisição for bem-sucedida

            // Log da resposta recebida da API
            console.log(`   📥 Resposta recebida da API: ${JSON.stringify(response)}`);

            // Verifica se a resposta é válida
            if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
                throw new Error('Resposta da API não está no formato esperado.');
            }

            // Extrai e retorna o texto processado
            const processedText = response.content[0].text.trim();
            console.log(`   📥 Resposta recebida de Claude para linha ${lineNumber}`);
            return processedText;
            
        } catch (error) {
            console.error(`   ⚠️ Erro na tentativa ${currentTry}/${config.maxRetries} para linha ${lineNumber}: ${error.message}`);
            
            if (currentTry < config.maxRetries) {
                // Espera um tempo antes de tentar novamente (backoff exponencial)
                const waitTime = Math.pow(2, currentTry) * 3000; // Aumentou o tempo de espera para 3 segundos
                console.log(`   ⏱️ Aguardando ${waitTime/1000} segundos antes de tentar novamente...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                currentTry++;
            } else {
                console.error(`   ❌ Máximo de tentativas atingido para linha ${lineNumber}, mantendo conteúdo original`);
                return line; // Retorna a linha original após esgotar as tentativas
            }
        }
    }
    
    // Caso todas as tentativas falhem
    return line;
}

/**
 * Verifica quais linhas já foram processadas no arquivo de saída
 * @param {string} outputFilePath - Caminho do arquivo de saída
 * @returns {Promise<number>} - Número de linhas já processadas
 */
async function checkProcessedLines(outputFilePath) {
    try {
        // Verifica se o arquivo de saída existe
        if (!fs.existsSync(outputFilePath)) {
            return 0; // Arquivo não existe, nenhuma linha processada
        }
        
        // Lê o arquivo de saída
        const outputContent = fs.readFileSync(outputFilePath, 'utf8');
        
        // Conta as linhas não vazias
        const processedLines = outputContent.split('\n').filter(line => line.trim()).length;
        
        console.log(`   🔍 Encontradas ${processedLines} linhas já processadas`);
        return processedLines;
    } catch (error) {
        console.error(`   ⚠️ Erro ao verificar linhas processadas: ${error.message}`);
        return 0; // Em caso de erro, assume que nenhuma linha foi processada
    }
}

/**
 * Processa um arquivo JSONL usando a API do Claude para adicionar tokens especiais
 * @param {string} inputFilePath - Caminho para o arquivo JSONL de entrada
 * @param {string} outputFilePath - Caminho para salvar a saída processada
 * @param {Anthropic} anthropic - Instância do cliente Anthropic
 * @returns {Promise<void>}
 */
async function processFile(inputFilePath, outputFilePath, anthropic) {
    try {
        console.log(`\n📄 Processando arquivo: ${inputFilePath}`);
        
        // Lê o arquivo de entrada
        const fileContent = fs.readFileSync(inputFilePath, 'utf8');
        
        // Divide o conteúdo por linhas para processar cada objeto JSON
        const lines = fileContent.split('\n').filter(line => line.trim());
        
        // Verifica quantas linhas já foram processadas
        const processedLines = await checkProcessedLines(outputFilePath);
        
        // Se todas as linhas já foram processadas, não faz nada
        if (processedLines >= lines.length) {
            console.log(`   ✅ Todas as ${lines.length} linhas já foram processadas anteriormente`);
            return;
        }
        
        // Cria um fluxo de escrita para o arquivo de saída (modo append se já existirem linhas processadas)
        const outputStream = fs.createWriteStream(outputFilePath, { flags: processedLines > 0 ? 'a' : 'w' });
        
        console.log(`   🔄 Continuando processamento a partir da linha ${processedLines + 1} de ${lines.length}`);
        
        // Inicializa contadores e variáveis de progresso
        let successCount = 0;
        let errorCount = 0;
        let startTime = Date.now();
        let lastProgressUpdate = startTime;
        
        // Processa as linhas individualmente, começando de onde parou
        for (let i = processedLines; i < lines.length; i++) {
            try {
                // Mostra progresso a cada 5 segundos
                const currentTime = Date.now();
                if (currentTime - lastProgressUpdate > 5000) {
                    const progress = Math.round(((i - processedLines) / (lines.length - processedLines)) * 100);
                    const elapsedMinutes = Math.round((currentTime - startTime) / 60000);
                    console.log(`   📊 Progresso: ${progress}% (${i + 1}/${lines.length}) - Tempo decorrido: ${elapsedMinutes} minutos`);
                    lastProgressUpdate = currentTime;
                }
                
                // Parse a linha original como JSON
                const jsonObj = JSON.parse(lines[i]);
                
                // Verifica se o objeto tem a estrutura esperada
                if (!jsonObj.messages || !Array.isArray(jsonObj.messages)) {
                    console.warn(`   ⚠️ Linha ${i + 1}: Formato inesperado, mantendo original`);
                    outputStream.write(lines[i] + '\n');
                    errorCount++;
                    continue;
                }
                
                // Encontra as mensagens do usuário e do assistente
                const userMessage = jsonObj.messages.find(msg => msg.role === 'user');
                const assistantMessage = jsonObj.messages.find(msg => msg.role === 'assistant');
                
                if (!userMessage || !assistantMessage) {
                    console.warn(`   ⚠️ Linha ${i + 1}: Mensagens incompletas, mantendo original`);
                    outputStream.write(lines[i] + '\n');
                    errorCount++;
                    continue;
                }
                
                // Adiciona tokens especiais à consulta do usuário
                const wordsInQuery = userMessage.content.match(/'([^']+)'/g) || [];
                wordsInQuery.forEach(word => {
                    const cleanWord = word.replace(/'/g, '');
                    userMessage.content = userMessage.content.replace(word, `<WORD>${cleanWord}</WORD>`);
                });
                
                try {
                    // Processa a resposta do assistente usando Claude
                    const processedContent = await processLine(assistantMessage.content, anthropic, i + 1);
                    assistantMessage.content = processedContent;
                    
                    // Escreve a linha processada no fluxo de saída
                    const processedJsonLine = JSON.stringify(jsonObj);
                    outputStream.write(processedJsonLine + '\n');
                    console.log(`   ✅ Linha ${i + 1} processada com sucesso`);
                    successCount++;
                } catch (apiError) {
                    console.error(`   ⚠️ Erro na API ao processar linha ${i + 1}: ${apiError.message}`);
                    console.log(`   🔄 Tentando novamente em 5 segundos...`);
                    
                    // Espera 5 segundos antes de tentar novamente
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    try {
                        // Segunda tentativa
                        const processedContent = await processLine(assistantMessage.content, anthropic, i + 1);
                        assistantMessage.content = processedContent;
                        
                        // Escreve a linha processada no fluxo de saída
                        const processedJsonLine = JSON.stringify(jsonObj);
                        outputStream.write(processedJsonLine + '\n');
                        console.log(`   ✅ Linha ${i + 1} processada com sucesso na segunda tentativa`);
                        successCount++;
                    } catch (retryError) {
                        console.error(`   ❌ Falha na segunda tentativa para linha ${i + 1}: ${retryError.message}`);
                        outputStream.write(lines[i] + '\n'); // Mantém a linha original em caso de erro
                        errorCount++;
                    }
                }
            } catch (error) {
                console.error(`   ❌ Erro ao processar linha ${i + 1}: ${error.message}`);
                outputStream.write(lines[i] + '\n'); // Mantém a linha original em caso de erro
                errorCount++;
            }
        }
        
        // Calcula o tempo total de processamento
        const totalTime = Math.round((Date.now() - startTime) / 60000);
        
        // Exibe resumo do processamento
        console.log(`\n📊 Resumo do processamento:`);
        console.log(`   ✅ Linhas processadas com sucesso: ${successCount}`);
        console.log(`   ❌ Linhas com erro: ${errorCount}`);
        console.log(`   🕒 Tempo total: ${totalTime} minutos`);
        console.log(`   💾 Arquivo de saída: ${outputFilePath}`);
        
        // Fecha o fluxo de escrita após o processamento
        outputStream.end();
        console.log(`\n✅ Processamento concluído com sucesso!`);
        
    } catch (error) {
        console.error(`\n❌ Erro ao processar arquivo: ${error.message}`);
        throw error;
    }
}

/**
 * Verifica se um diretório existe e o cria se não existir
 * @param {string} dir - Caminho do diretório a ser verificado/criado
 * @returns {void}
 */
function ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Diretório criado: ${dir}`);
    }
}

/**
 * Função principal para processar arquivos com tokens especiais
 * @param {string[]} [specificFiles] - Arquivos específicos para processar (opcional)
 */
async function main(specificFiles) {
    try {
        console.log('🚀 Iniciando adição de tokens especiais usando Claude...');
        
        // Define diretórios de entrada e saída
        const inputDir = path.resolve(__dirname, '../ai-dataset-generator/input/add_special_token');
        const outputDir = path.resolve(__dirname, '../ai-dataset-generator/output/with_special_tokens_claude');
        
        // Verifica se o diretório de entrada existe
        if (!fs.existsSync(inputDir)) {
            console.error(`❌ Diretório de entrada não encontrado: ${inputDir}`);
            console.log(`📁 Criando diretório de entrada...`);
            ensureDirectoryExists(inputDir);
            console.log(`ℹ️ Coloque seus arquivos JSONL no diretório de entrada e execute novamente.`);
            return;
        }
        
        // Cria o diretório de saída se não existir
        ensureDirectoryExists(outputDir);
        
        // Verifica a chave da API
        if (!process.env.DATASET_GEN_ANTHROPIC_KEY) {
            console.error(`❌ Chave da API Anthropic não encontrada no arquivo .env.generator`);
            console.log(`ℹ️ Crie um arquivo .env.generator na raiz do projeto com a variável DATASET_GEN_ANTHROPIC_KEY`);
            return;
        }
        
        // Inicializa o cliente Anthropic
        const anthropic = new Anthropic({
            apiKey: process.env.DATASET_GEN_ANTHROPIC_KEY
        });
        
        // Define o modelo a ser usado (padrão: claude-3-sonnet-20240229)
        const modelName = process.env.DATASET_GEN_CLAUDE_MODEL || 'claude-3-sonnet-20240229';
        console.log(`🤖 Usando modelo: ${modelName}`);
        
        // Determina quais arquivos processar
        let filesToProcess = [];
        
        if (specificFiles && specificFiles.length > 0) {
            // Processa apenas os arquivos especificados
            filesToProcess = specificFiles.map(file => {
                // Adiciona a extensão .jsonl se não estiver presente
                if (!file.endsWith('.jsonl')) {
                    return `${file}.jsonl`;
                }
                return file;
            }).filter(file => {
                const exists = fs.existsSync(path.join(inputDir, file));
                if (!exists) {
                    console.warn(`⚠️ Arquivo não encontrado: ${file}`);
                }
                return exists;
            });
        } else {
            // Obtém todos os arquivos JSONL no diretório de entrada
            filesToProcess = fs.readdirSync(inputDir)
                .filter(file => file.endsWith('.jsonl'));
        }
        
        if (filesToProcess.length === 0) {
            console.log('⚠️ Nenhum arquivo JSONL encontrado para processar.');
            return;
        }
        
        console.log(`📋 Encontrado(s) ${filesToProcess.length} arquivo(s) JSONL para processar:`);
        filesToProcess.forEach(file => console.log(`   - ${file}`));
        
        // Processa cada arquivo
        for (const file of filesToProcess) {
            const inputFilePath = path.join(inputDir, file);
            const outputFilePath = path.join(outputDir, file);
            await processFile(inputFilePath, outputFilePath, anthropic);
        }
        
        console.log('🎉 Todos os arquivos foram processados com sucesso!');
        
    } catch (error) {
        console.error(`❌ Erro na função principal: ${error.message}`);
        process.exit(1);
    }
}

// Processa argumentos da linha de comando
const args = process.argv.slice(2);

// Se houver argumentos, usa-os como nomes de arquivos específicos para processar
if (args.length > 0) {
    console.log(`ℹ️ Processando arquivos específicos: ${args.join(', ')}`);
    main(args);
} else {
    // Caso contrário, processa todos os arquivos no diretório
    main();
}
