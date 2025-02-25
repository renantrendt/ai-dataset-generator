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
└── .dataset-generator.env  (Your API keys configuration)
```

### 2. Configure API Keys
Edit the `.dataset-generator.env` file in your workspace and add your API keys:
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

The tool supports both Claude and OpenAI APIs. After installation, you'll find a `.dataset-generator.env` file in your workspace. This custom environment file won't conflict with your existing `.env` files.

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
- The `.dataset-generator.env` file is automatically added to `.gitignore` to prevent committing your API keys
- Always keep your API keys private and never commit them to version control

## Customizing the Prompt Template

The tool provides a customizable prompt template that controls how the AI processes your input text. When you initialize a workspace, a `prompt-template.js` file is created in your home directory at `~/ai-dataset-generator/prompt-template.js`.

### Default Location
```
~/ai-dataset-generator/
└── prompt-template.js    (Customizable AI prompt template)
```

### Customization

The prompt template file contains two main functions:

1. `processChunk(chunk, template, anthropic)`: Controls how each text chunk is processed
2. `isValidEntry(entry)`: Validates the generated entries

Example customization:

```javascript
export async function processChunk(chunk, template, anthropic) {
    // Customize the prompt for your specific use case
    const prompt = `Given this text:

${chunk}

Create a Q&A pair following this template:
${template}

Make sure to include:
1. Key concepts and definitions
2. Example usage or applications
3. Related topics or connections

Respond only with the JSONL formatted entry.`;

    // Rest of the function...
}
```

### Use Cases

You can customize the prompt template for various purposes:

- **Language Learning**: Extract vocabulary, grammar, and usage examples
- **Technical Documentation**: Create Q&A pairs from technical manuals
- **Knowledge Base**: Convert articles into structured QA format
- **Training Data**: Generate specific types of training examples

The prompt template will be used for all future dataset generation tasks unless modified.

## License

MIT
