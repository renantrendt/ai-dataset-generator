import unicodedata
import json
import os
import re

def normalize_yanomami_text(text):
    """Remove diacritical marks and replace special Yanomami characters."""
    # First remove standard diacritics
    text = ''.join(c for c in unicodedata.normalize('NFD', text)
                  if unicodedata.category(c) != 'Mn')
    
    # Then replace special Yanomami characters
    replacements = {
        'ɨ': 'i',  # Latin Small Letter I with Stroke → i
        'Ɨ': 'I',  # Latin Capital Letter I with Stroke → I
        'ã': 'a',  # a with tilde
        'ẽ': 'e',  # e with tilde
        'ĩ': 'i',  # i with tilde
        'õ': 'o',  # o with tilde
        'ũ': 'u',  # u with tilde
    }
    
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)
    
    return text

def process_dataset(input_file, output_file):
    """Process the dataset to create a version with and without diacritics."""
    try:
        # Load the original data
        with open(input_file, 'r', encoding='utf-8') as f:
            original_data = [json.loads(line) for line in f]
        
        print(f"Loaded {len(original_data)} items from {input_file}")
        
        # Create versions without diacritics
        no_diacritics_data = []
        for item in original_data:
            # Create a copy of the item
            new_item = item.copy()
            
            # Process all text in the messages
            if 'messages' in new_item:
                for message in new_item['messages']:
                    if 'content' in message:
                        # Only normalize the user's query, not the assistant's response
                        if message['role'] == 'user':
                            # Extract the word inside <WORD> tags to normalize it
                            content = message['content']
                            # Find all words inside <WORD> tags
                            word_pattern = re.compile(r'<WORD>([^<]+)</WORD>')
                            matches = word_pattern.findall(content)
                            
                            for match in matches:
                                normalized = normalize_yanomami_text(match)
                                if normalized != match:
                                    # Replace only the word, keeping the tags
                                    content = content.replace(f"<WORD>{match}</WORD>", 
                                                             f"<WORD>{normalized}</WORD>")
                            
                            message['content'] = content
            
            no_diacritics_data.append(new_item)
        
        # Combine both datasets
        combined_data = original_data + no_diacritics_data
        
        # Save the combined dataset
        with open(output_file, 'w', encoding='utf-8') as f:
            for item in combined_data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        
        print(f"Original data count: {len(original_data)}")
        print(f"Combined data count: {len(combined_data)}")
        print(f"Saved combined dataset to {output_file}")
        
        # Show examples of normalization
        print("\n=== EXAMPLES OF TEXT NORMALIZATION ===")
        examples = ["pë", "napë", "hëtëmou", "Yanomamɨ", "Watorikɨ", "hãrõ", "ĩhĩ"]
        for example in examples:
            normalized = normalize_yanomami_text(example)
            print(f"{example} → {normalized}")
        
    except Exception as e:
        print(f"Error: {e}")

# Find the translations file
data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
translations_file = None

for root, dirs, files in os.walk(data_dir):
    for file in files:
        if file == 'ok-translations.jsonl':
            translations_file = os.path.join(root, file)
            break

if translations_file:
    output_file = os.path.join(os.path.dirname(translations_file), 'combined-translations.jsonl')
    print(f"Found translations file: {translations_file}")
    process_dataset(translations_file, output_file)
else:
    print("Could not find ok-translations.jsonl file. Please specify the correct path.")

# Demo with sample data if file not found
if not translations_file:
    print("\n=== DEMO WITH SAMPLE DATA ===")
    sample_data = [
        {"messages": [{"role": "user", "content": "<QUERY>What does <WORD>pë</WORD> mean in Yanomami?</QUERY>"}, 
                    {"role": "assistant", "content": "<WORD>pë</WORD> <POS>Suffix</POS> <DEFINITION>plural marker</DEFINITION>"}]},
        {"messages": [{"role": "user", "content": "<QUERY>What does <WORD>napë</WORD> mean in Yanomami?</QUERY>"}, 
                    {"role": "assistant", "content": "<WORD>napë</WORD> <POS>Noun</POS> <DEFINITION>foreigner, non-indigenous person</DEFINITION>"}]},
        {"messages": [{"role": "user", "content": "<QUERY>What does <WORD>Yanomamɨ</WORD> mean?</QUERY>"}, 
                    {"role": "assistant", "content": "<WORD>Yanomamɨ</WORD> <POS>Noun</POS> <DEFINITION>The Yanomami people or language</DEFINITION>"}]}
    ]
    
    # Create versions without diacritics
    no_diacritics_data = []
    for item in sample_data:
        # Create a copy of the item
        new_item = item.copy()
        
        # Process all text in the messages
        if 'messages' in new_item:
            for message in new_item['messages']:
                if 'content' in message and message['role'] == 'user':
                    # Extract the word inside <WORD> tags to normalize it
                    content = message['content']
                    # Find all words inside <WORD> tags
                    word_pattern = re.compile(r'<WORD>([^<]+)</WORD>')
                    matches = word_pattern.findall(content)
                    
                    for match in matches:
                        normalized = normalize_yanomami_text(match)
                        if normalized != match:
                            # Replace only the word, keeping the tags
                            content = content.replace(f"<WORD>{match}</WORD>", 
                                                     f"<WORD>{normalized}</WORD>")
                    
                    message['content'] = content
        
        no_diacritics_data.append(new_item)
    
    print("\n=== ORIGINAL SAMPLE DATA ===")
    for item in sample_data:
        print(json.dumps(item, ensure_ascii=False))
    
    print("\n=== NORMALIZED SAMPLE DATA ===")
    for item in no_diacritics_data:
        print(json.dumps(item, ensure_ascii=False))
