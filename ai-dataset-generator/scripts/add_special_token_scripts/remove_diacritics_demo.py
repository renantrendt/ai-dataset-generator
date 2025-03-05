import unicodedata
import json
import os

def remove_diacritics(text):
    """Remove diacritical marks from text."""
    return ''.join(c for c in unicodedata.normalize('NFD', text)
                  if unicodedata.category(c) != 'Mn')

# Find the translations file
data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
for root, dirs, files in os.walk(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))):
    for file in files:
        if file.endswith('translations.jsonl') or file == 'ok-translations.jsonl':
            translations_file = os.path.join(root, file)
            break

# If we didn't find the file, use a sample
sample_data = [
    {"query": "O que significa pë em Yanomami?", "response": "pë é um sufixo que indica plural em Yanomami."},
    {"query": "Como se diz napë em português?", "response": "napë significa 'não-indígena' ou 'estrangeiro' em português."},
    {"query": "Traduza hëtëmou para português", "response": "hëtëmou significa 'estar com fome' em português."}
]

try:
    # Try to load real data if found
    if 'translations_file' in locals():
        with open(translations_file, 'r', encoding='utf-8') as f:
            original_data = [json.loads(line) for line in f]
            # Only use first 5 items for demo
            original_data = original_data[:5]
    else:
        original_data = sample_data
        print("Using sample data as translations file wasn't found.")
        
    print("\n=== ORIGINAL DATA SAMPLE ===")
    for item in original_data:
        print(json.dumps(item, ensure_ascii=False))
    
    # Create versions without diacritics
    no_diacritics_data = []
    for item in original_data:
        # Create a copy of the item
        new_item = item.copy()
        
        # Modify the query/input
        if 'query' in new_item:
            new_item['query'] = remove_diacritics(new_item['query'])
        
        no_diacritics_data.append(new_item)
    
    print("\n=== DATA WITHOUT DIACRITICS ===")
    for item in no_diacritics_data:
        print(json.dumps(item, ensure_ascii=False))
    
    # Show combined dataset
    combined_data = original_data + no_diacritics_data
    
    print(f"\nOriginal data count: {len(original_data)}")
    print(f"Combined data count: {len(combined_data)}")
    
    # Show examples of words with diacritics removed
    print("\n=== EXAMPLES OF DIACRITICS REMOVAL ===")
    examples = ["pë", "napë", "hëtëmou", "Yanomamɨ", "Watorikɨ"]
    for example in examples:
        print(f"{example} → {remove_diacritics(example)}")
        
except Exception as e:
    print(f"Error: {e}")
