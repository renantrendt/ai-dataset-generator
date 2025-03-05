#!/usr/bin/env python3
"""
Text Normalization for Yanomami Language
------------------------------------
This script provides functions to normalize Yanomami text by handling diacritical marks
and creating mappings between words with and without diacritical marks.
"""

import unicodedata
import re
import json
import os
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

def remove_diacritics(text):
    """
    Remove diacritical marks from text while preserving base characters.
    
    Args:
        text (str): Text with potential diacritical marks
        
    Returns:
        str: Text with diacritical marks removed
    """
    # Normalize the Unicode string to decompose characters with diacritics
    normalized = unicodedata.normalize('NFD', text)
    
    # Remove all diacritical marks (category 'Mn' = Mark, Nonspacing)
    result = ''.join(c for c in normalized if not unicodedata.category(c).startswith('Mn'))
    
    # Return the result normalized back to composed form
    return unicodedata.normalize('NFC', result)

def build_diacritic_mapping(dataset_dir):
    """
    Build a mapping between words with diacritical marks and their non-diacritical versions.
    
    Args:
        dataset_dir (str): Directory containing the dataset files
        
    Returns:
        dict: Mapping from non-diacritical to diacritical words
    """
    mapping = {}
    yanomami_words = set()
    
    # Find all jsonl files in the dataset directory
    jsonl_files = list(Path(dataset_dir).glob('**/*.jsonl'))
    
    for file_path in jsonl_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    data = json.loads(line)
                    if 'messages' in data:
                        for message in data['messages']:
                            if 'content' in message:
                                content = message['content']
                                
                                # Extract words between <WORD> tags
                                word_matches = re.findall(r'<WORD>([^<]+)</WORD>', content)
                                yanomami_words.update(word_matches)
                                
                                # Also extract words between <YANOMAMI> tags
                                yanomami_matches = re.findall(r'<YANOMAMI>([^<]+)</YANOMAMI>', content)
                                for match in yanomami_matches:
                                    # Split by spaces to get individual words
                                    words = match.split()
                                    yanomami_words.update(words)
                except Exception as e:
                    logger.warning(f"Error processing line in {file_path}: {e}")
    
    # Build the mapping
    for word in yanomami_words:
        normalized = remove_diacritics(word)
        if normalized != word:
            # Only add to mapping if the word actually contains diacritics
            if normalized not in mapping:
                mapping[normalized] = []
            if word not in mapping[normalized]:
                mapping[normalized].append(word)
    
    logger.info(f"Built mapping for {len(mapping)} unique words with diacritical marks")
    return mapping

def save_mapping(mapping, output_file):
    """
    Save the diacritic mapping to a JSON file.
    
    Args:
        mapping (dict): The mapping to save
        output_file (str): Path to save the mapping to
    """
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    logger.info(f"Saved mapping to {output_file}")

def load_mapping(mapping_file):
    """
    Load a diacritic mapping from a JSON file.
    
    Args:
        mapping_file (str): Path to the mapping file
        
    Returns:
        dict: The loaded mapping
    """
    with open(mapping_file, 'r', encoding='utf-8') as f:
        mapping = json.load(f)
    logger.info(f"Loaded mapping with {len(mapping)} entries from {mapping_file}")
    return mapping

def normalize_query(query, mapping=None):
    """
    Normalize a user query by attempting to replace non-diacritical words with their diacritical versions.
    
    Args:
        query (str): The user query
        mapping (dict, optional): A mapping from non-diacritical to diacritical words
        
    Returns:
        str: The normalized query
    """
    if not mapping:
        return query
    
    # Split the query into words
    words = re.findall(r'\b\w+\b', query)
    
    # Replace each word if it exists in the mapping
    for word in words:
        word_lower = word.lower()
        if word_lower in mapping:
            # Replace with the first diacritical version (most common)
            diacritical_word = mapping[word_lower][0]
            # Preserve case if possible
            if word.islower():
                replacement = diacritical_word
            elif word.isupper():
                replacement = diacritical_word.upper()
            elif word[0].isupper():
                replacement = diacritical_word.capitalize()
            else:
                replacement = diacritical_word
                
            # Replace the word in the query
            query = re.sub(r'\b' + re.escape(word) + r'\b', replacement, query)
    
    return query

def main():
    # Path to the dataset directory
    dataset_dir = "/Users/renanserrano/CascadeProjects/Yanomami/finetunning/yanomami_dataset"
    
    # Path to save the mapping
    output_file = "/Users/renanserrano/CascadeProjects/Yanomami/finetunning/diacritic_mapping.json"
    
    # Build the mapping
    mapping = build_diacritic_mapping(dataset_dir)
    
    # Save the mapping
    save_mapping(mapping, output_file)
    
    # Test the mapping with a few examples
    test_queries = [
        "What does wayoapi mean in Yanomami?",
        "Translate this Yanomami phrase to English: wayoapi ke ya"
    ]
    
    for query in test_queries:
        normalized = normalize_query(query, mapping)
        logger.info(f"Original: {query}")
        logger.info(f"Normalized: {normalized}")
        logger.info("---")

if __name__ == "__main__":
    main()
