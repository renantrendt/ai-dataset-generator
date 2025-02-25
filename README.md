# AI Dataset Generator

A simple and efficient tool to generate AI fine-tuning datasets from text files. This tool processes text files and creates a JSONL dataset suitable for fine-tuning AI models.

## Installation

```bash
npm install -g ai-dataset-generator
```

After installation, the tool will create a workspace in your home directory at `~/ai-dataset-generator` with the following structure:

```
~/ai-dataset-generator/
├── input/                 (Place your text files here)
├── output/                (Generated datasets will be saved here)
├── dataset-template.jsonl   (Customizable example format)
└── .dataset-generator.env  (Your API keys configuration)
```

## Usage

1. Configure your API keys in the `.env` file
2. Place your text files in the `input` directory
3. Run the generator:
```bash
npx ai-dataset-generator
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

## License

MIT
