# AI Dataset Generator

A simple and efficient tool to generate AI fine-tuning datasets from text files. This tool processes text files and creates a JSONL dataset suitable for fine-tuning AI models.

## Installation

```bash
npm install -g ai-dataset-generator
```

## Usage

Follow these simple steps to generate your AI training dataset:

### 1. Initialize Workspace
After installation, initialize your workspace:
```bash
npx ai-dataset-generator init
```
The tool will create a workspace in your home directory at `~/ai-dataset-generator` with the following structure:

```
~/ai-dataset-generator/
├── input/                 (Place your text files here)
├── output/                (Generated datasets will be saved here)
├── dataset-template.jsonl   (Customizable example format)
└── .env.generator          (Your API keys configuration)
```

### Accessing the ai-dataset-generator Folder
In the GitHub repository, you can access the `ai-dataset-generator` folder, which contains the real use case files and scripts used to prepare the data. You can find the necessary commands to run them and understand how to utilize the dataset generator effectively.

### Customizing the Source Code

If you need to customize the behavior of the AI Dataset Generator, you can modify the source code files in the `src` directory:

- `index.js`: Contains the core functionality for processing text files and generating datasets
- `cli.js`: Handles command-line interface and arguments
- `init.js`: Initializes the workspace
- `setup.js`: Sets up the directory structure and environment
- `prompt-template.js`: Contains the templates used for generating prompts

To customize the source code:

1. Fork the repository or install the package locally
2. Make your changes to the files in the `src` directory
3. Test your changes with `npm run generate` or other commands
4. If you're developing a new feature, consider contributing back to the project via a pull request
5. Star the project on github
6. Contact me at https://www.renanserrano.com.br

### Running the Scripts

The `ai-dataset-generator/scripts` directory contains various scripts used for processing and translating Yanomami dictionary entries. To run the scripts, follow these steps:

1. **Run a Specific Script**: Navigate to the Scripts Directory, use Node.js to run the desired script. For example, to run the `7_translate_missing_words_with_claude.js` script, use the following command:
   ```bash
   node 7_translate_missing_words_with_claude.js
   ```

2. **Check for Required Files**: Ensure that the necessary input files are present in the appropriate directories as specified in the script comments.

3. **Monitor Output**: The scripts will generate output files in the `output` directory. Check these files for results and any generated logs.

### 2. Configure API Keys
Edit the `.env.generator` file in your workspace and add your API keys:
```env
DATASET_GEN_ANTHROPIC_KEY=your_anthropic_key_here
# or
DATASET_GEN_OPENAI_KEY=your_openai_key_here
```

### 3. Add Input Files
Place your text files in the `input` directory that was created during initialization.

### 4. Generate Dataset
Run the generator to create your dataset:
```bash
npx ai-dataset-generator generate
```

That's it! Your dataset will be generated in the `output` directory.

### Custom Paths (Optional)

If you want to use different directories:

```bash
npx ai-dataset-generator -i ./my-input-folder -o ./my-output/dataset.jsonl
```

Options:
- `-i, --input`: Custom input directory (default: ~/ai-dataset-generator/input)
- `-o, --output`: Custom output file path (default: ~/ai-dataset-generator/output/dataset.jsonl)
- `-n, --max-examples`: Generate an exact number of examples (e.g., --max-examples 1000)

### Controlling Dataset Size

You can specify the exact number of examples you want to generate using the `--max-examples` option:

```bash
# Generate exactly 1000 examples
npx ai-dataset-generator generate --max-examples 1000

# Generate 2000 examples with custom input/output paths
npx ai-dataset-generator generate -i ./my-texts -o ./dataset.jsonl --max-examples 2000
```

When you specify `--max-examples`:
- The tool will generate EXACTLY that number of examples
- Examples are distributed evenly across input files
- If a file doesn't have enough unique content, sentences will be reused to reach the target number

#### Recommended Numbers for Fine-tuning

For GPT-2 Small (124M parameters):
- Minimum recommended: 500-1000 examples
- Ideal: 2000-3000 examples
- Maximum effective: ~5000 examples

Choosing the right number of examples is important:
- Too few examples (<500) may lead to overfitting
- 2000-3000 examples provides a good balance of quality and training efficiency
- Beyond 5000 examples, returns diminish for models of this size


## Features

- 📁 Automatic workspace setup
- 🔑 Easy API key configuration
- 📝 Example dataset included
- 🔄 Processes all text files in the input directory
- ✂️ Smart text chunking for optimal training
- 🚀 Simple, zero-configuration usage

## API Configuration

The tool supports both Claude and OpenAI APIs. After installation, you'll find a `.env.generator` file in your workspace. This custom environment file won't conflict with your existing `.env` files.

```env
# AI Dataset Generator Configuration

#-------------------------------------------
# Claude AI (Default)
#-------------------------------------------
DATASET_GEN_ANTHROPIC_KEY=sk-ant-api03-example-key
# DATASET_GEN_CLAUDE_MODEL=claude-3-sonnet-20240229

#-------------------------------------------
# OpenAI (Alternative)
#-------------------------------------------
# DATASET_GEN_OPENAI_KEY=sk-example-key
# DATASET_GEN_OPENAI_MODEL=gpt-4-turbo-preview

# Additional Configuration
# DATASET_GEN_MAX_TOKENS=4096
# DATASET_GEN_FORMAT=jsonl
```

Edit this file and add your actual API keys.

## Dataset Format

The tool processes text files and generates a JSONL dataset suitable for fine-tuning AI models. You'll find a `dataset-template.jsonl` file in your workspace that you can customize for your specific needs.

### Example Formats

Here are some common formats you can use:

```jsonl
# Standard conversation format (Claude/ChatGPT style)
{"messages":[{"role":"user","content":"What is the capital of France?"},{"role":"assistant","content":"The capital of France is Paris."}]}

# Simple prompt-completion format
{"prompt":"Translate to Spanish: Hello","completion":"¡Hola!"}

# Context-based format
{"context":"Customer service conversation","input":"I need help with my order","output":"I'll be happy to help you with your order."}
```

### Customization Tips
- Modify the JSON structure to match your model's expected format
- Add additional fields that your model requires
- Include examples that represent your specific use case
- You can use any valid JSON format that your fine-tuning process expects

Check `dataset-template.jsonl` in your workspace for more examples and formats.

### Security Note
- The `.env.generator` file is automatically added to `.gitignore` to prevent committing your API keys
- Always keep your API keys private and never commit them to version control

## Customizing the AI Prompt

The tool provides a customizable prompt template that controls how the AI processes your input text. The template is located in the package's source directory at `src/prompt-template.js`.

To customize the prompt template:

1. Access the source code as described in the "Customizing the Source Code" section
2. Modify the `src/prompt-template.js` file according to your needs
3. The changes will be applied when you run the tool

### Structure of the Workspace

```
~/ai-dataset-generator/
├── input/                 (Place your text files here)
├── output/                (Generated datasets will be saved here)
├── dataset-template.jsonl   (Customizable example format)
└── .env.generator          (Your API keys configuration)
```

## License

MIT
