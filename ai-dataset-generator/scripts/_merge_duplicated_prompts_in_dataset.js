import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o arquivo yanomami-words.txt
const filePath = path.join(__dirname, '..', 'output', 'yanomami-words.txt');
// Caminho para o novo arquivo sem duplicatas
const uniqueFilePath = path.join(__dirname, '..', 'output', 'yanomami-words-unique.txt');

// Função para verificar palavras duplicadas e criar um novo arquivo com palavras únicas
function checkDuplicates() {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }

        // Divide o conteúdo em palavras
        const words = data.split('\n').map(word => word.trim()).filter(word => word.length > 0);
        
        // Cria um conjunto para contar as ocorrências
        const wordCount = {};
        words.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });

        // Filtra as palavras únicas
        const uniqueWords = Object.keys(wordCount);

        // Escreve as palavras únicas em um novo arquivo
        fs.writeFile(uniqueFilePath, uniqueWords.join('\n'), 'utf8', (err) => {
            if (err) {
                console.error('Error writing the file:', err);
                return;
            }
            console.log(`Arquivo com palavras únicas criado em: ${uniqueFilePath}`);
        });

        // Exibe as palavras duplicadas
        const duplicates = Object.entries(wordCount).filter(([word, count]) => count > 1);
        if (duplicates.length > 0) {
            console.log('Palavras duplicadas encontradas:');
            duplicates.forEach(([word, count]) => {
                console.log(`- ${word}: ${count} vezes`);
            });
        } else {
            console.log('Nenhuma palavra duplicada encontrada.');
        }
    });
}

// Executa a função
checkDuplicates();
