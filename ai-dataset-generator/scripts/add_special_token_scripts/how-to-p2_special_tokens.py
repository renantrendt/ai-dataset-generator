#!/usr/bin/env python3
"""
Add Special Tokens to Yanomami Dataset
--------------------------------------
This script processes the Yanomami dataset files and adds special tokens to structure the data.
These special tokens help the model better understand the different parts of the data
(words, definitions, examples, translations, etc.)
"""

import os
import json
import re
from tqdm import tqdm
import argparse
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Special tokens to add
SPECIAL_TOKENS = [
    '<WORD>', '</WORD>', 
    '<POS>', '</POS>', 
    '<DEFINITION>', '</DEFINITION>', 
    '<EXAMPLES>', '</EXAMPLES>', 
    '<EXAMPLE_YANOMAMI>', '</EXAMPLE_YANOMAMI>',
    '<EXAMPLE_TRANSLATION>', '</EXAMPLE_TRANSLATION>',
    '<QUERY>', '</QUERY>',
    '<YANOMAMI>', '</YANOMAMI>', 
    '<TRANSLATION>', '</TRANSLATION>', 
    '<LITERAL>', '</LITERAL>',
    '<RELATED_FORMS>', '</RELATED_FORMS>',
    '<USAGE>', '</USAGE>',
    '<GRAMMATICAL>', '</GRAMMATICAL>'
]

def process_how_to_file(input_file, output_file):
    """Process how-to.jsonl file to add special tokens."""
    processed_count = 0
    with open(input_file, 'r', encoding='utf-8') as f_in, open(output_file, 'w', encoding='utf-8') as f_out:
        lines = f_in.readlines()
        for line in tqdm(lines, desc=f"Processing {os.path.basename(input_file)}"):
            data = json.loads(line)
            
            if 'messages' in data and len(data['messages']) >= 2:
                user_message = data['messages'][0]['content']
                assistant_message = data['messages'][1]['content']
                
                # Check if this is a how-to query, usage comparison query, or context query
                if ('how' in user_message.lower() or 'when should i use' in user_message.lower() or 'in what context' in user_message.lower()) and 'yanomami' in user_message.lower():
                    # Extract the Yanomami word if present - check for multiple patterns
                    yanomami_word = ''
                    
                    # Pattern 1: Word in quotes
                    word_match = re.search(r"'([^']*)'|\"([^\"]*)\"", user_message)
                    if word_match:
                        yanomami_word = next((g for g in word_match.groups() if g is not None), '')
                    
                    # Pattern 2: Word after 'word' without quotes
                    if not yanomami_word:
                        word_pattern_match = re.search(r'the word ([^\s\'\"]+)', user_message, re.IGNORECASE)
                        if word_pattern_match:
                            yanomami_word = word_pattern_match.group(1)
                    
                    # Pattern 3: Words in 'When should I use X instead of Y' pattern
                    if not yanomami_word and 'when should i use' in user_message.lower():
                        usage_pattern_match = re.search(r'when should i use ["\']*(.*?)["\']*\s+instead of\s+["\']*(.*?)["\']*', user_message, re.IGNORECASE)
                        if usage_pattern_match:
                            # Get both words
                            word1 = usage_pattern_match.group(1).strip()
                            word2 = usage_pattern_match.group(2).strip()
                            yanomami_word = word1  # Use the first word as the primary word
                    
                    # Extract the concept/question based on query type
                    if 'in what context' in user_message.lower():
                        context_pattern_match = re.search(r'in what context(?:s)? (?:is|are) (?:the )?(?:word|phrase|expression|term|concept)?\s*["\']?([^"\']+)["\']?', user_message, re.IGNORECASE)
                        if context_pattern_match:
                            word = context_pattern_match.group(1).strip()
                            data['messages'][0]['content'] = f'<QUERY>In what context is the word <WORD>{word}</WORD> used in Yanomami?</QUERY>'
                        else:
                            if yanomami_word:
                                data['messages'][0]['content'] = f'<QUERY>In what context is the word <WORD>{yanomami_word}</WORD> used in Yanomami?</QUERY>'
                            else:
                                data['messages'][0]['content'] = f'<QUERY>{user_message}</QUERY>'
                    elif 'when should i use' in user_message.lower():
                        usage_pattern_match = re.search(r'when should i use ["\']*(.*?)["\']*\s+instead of\s+["\']*(.*?)["\']*', user_message, re.IGNORECASE)
                        if usage_pattern_match:
                            word1 = usage_pattern_match.group(1).strip()
                            word2 = usage_pattern_match.group(2).strip()
                            data['messages'][0]['content'] = f'<QUERY>When should I use <WORD>{word1}</WORD> instead of <WORD>{word2}</WORD> in Yanomami?</QUERY>'
                        else:
                            if yanomami_word:
                                data['messages'][0]['content'] = f'<QUERY>When should I use <WORD>{yanomami_word}</WORD> in Yanomami?</QUERY>'
                            else:
                                data['messages'][0]['content'] = f'<QUERY>{user_message}</QUERY>'
                
                # Process all entries regardless of query type
                # First, tag the user query appropriately
                if 'when should i use' in user_message.lower():
                    # Extract words from the user message
                    usage_pattern_match = re.search(r"when should i use ['\"]?(.*?)['\"]? instead of ['\"]?(.*?)['\"]? in yanomami", user_message.lower(), re.IGNORECASE)
                    if usage_pattern_match:
                        word1 = usage_pattern_match.group(1).strip()
                        word2 = usage_pattern_match.group(2).strip()
                        data['messages'][0]['content'] = f'<QUERY>When should I use <WORD>{word1}</WORD> instead of <WORD>{word2}</WORD> in Yanomami?</QUERY>'
                        
                        # Now process the assistant message
                        # First check if it already has special tokens
                        if '<WORD>' in assistant_message:
                            # Already has tokens, leave it as is
                            continue
                            
                        # Extract meanings from the assistant message
                        # Pattern for "word1 means definition1, while word2 means definition2"
                        meaning_pattern = re.search(f"'{word1}' means '([^']+)'.*while.*'{word2}' means '([^']+)'", assistant_message)
                        meaning1 = ""
                        meaning2 = ""
                        
                        if meaning_pattern:
                            meaning1 = meaning_pattern.group(1).strip()
                            meaning2 = meaning_pattern.group(2).strip()
                        else:
                            # Try alternative pattern
                            alt_pattern = re.search(f"1\. '{word1}' means '([^']+)'.*while.*'{word2}' means '([^']+)'", assistant_message)
                            if alt_pattern:
                                meaning1 = alt_pattern.group(1).strip()
                                meaning2 = alt_pattern.group(2).strip()
                        
                        # Extract part of speech if available
                        pos_pattern = re.search(f"'({word1})'\\s+is\\s+a\\s+([^,\\.]+)\\s*,\\s*while\\s+'({word2})'\\s+is\\s+a\\s+([^,\\.]+)", assistant_message)
                        pos1 = ""
                        pos2 = ""
                        
                        if pos_pattern:
                            pos1 = pos_pattern.group(2).strip()
                            pos2 = pos_pattern.group(4).strip()
                        
                        # Extract usage instructions
                        usage_pattern = re.search(f"Use\\s+'({word1})'\\s+when\\s+([^\\.]+)\\.\\s+Use\\s+'({word2})'\\s+when\\s+([^\\.]+)", assistant_message)
                        usage1 = ""
                        usage2 = ""
                        
                        if usage_pattern:
                            usage1 = usage_pattern.group(2).strip()
                            usage2 = usage_pattern.group(4).strip()
                        
                        # Extract examples
                        examples1 = []
                        examples1_match = re.search(f"Examples with '({word1})':(.*?)(?:Examples with|$)", assistant_message, re.DOTALL)
                        if examples1_match:
                            examples_text = examples1_match.group(2).strip()
                            example_pairs = re.findall(r'- ([^\n]+)\n\s*Translation: ([^\n]+)', examples_text)
                            for yanomami, translation in example_pairs:
                                examples1.append((yanomami.strip(), translation.strip()))
                        
                        examples2 = []
                        examples2_match = re.search(f"Examples with '({word2})':(.*?)(?:\n\n|$)", assistant_message, re.DOTALL)
                        if examples2_match:
                            examples_text = examples2_match.group(2).strip()
                            example_pairs = re.findall(r'- ([^\n]+)\n\s*Translation: ([^\n]+)', examples_text)
                            for yanomami, translation in example_pairs:
                                examples2.append((yanomami.strip(), translation.strip()))
                        
                        # Create the formatted assistant message
                        new_assistant_message = f"When deciding between <WORD>{word1}</WORD> and <WORD>{word2}</WORD> in Yanomami:\n\n"
                        
                        # Add definitions
                        if pos1 and pos2:
                            new_assistant_message += f"1. <WORD>{word1}</WORD> is a <POS>{pos1}</POS> and <DEFINITION>{meaning1}</DEFINITION>, while <WORD>{word2}</WORD> is a <POS>{pos2}</POS> and <DEFINITION>{meaning2}</DEFINITION>.\n\n"
                        else:
                            new_assistant_message += f"1. <WORD>{word1}</WORD> <DEFINITION>{meaning1}</DEFINITION>, while <WORD>{word2}</WORD> <DEFINITION>{meaning2}</DEFINITION>.\n\n"
                        
                        # Add usage instructions if available
                        if usage1 and usage2:
                            new_assistant_message += f"<USAGE>Use <WORD>{word1}</WORD> when {usage1}. Use <WORD>{word2}</WORD> when {usage2}.</USAGE>\n\n"
                        
                        # Add examples for word1
                        if examples1:
                            new_assistant_message += f"Examples with <WORD>{word1}</WORD>:\n"
                            for yanomami, translation in examples1:
                                new_assistant_message += f"<EXAMPLE_YANOMAMI>{yanomami}</EXAMPLE_YANOMAMI>\n<EXAMPLE_TRANSLATION>{translation}</EXAMPLE_TRANSLATION>\n\n"
                        
                        # Add examples for word2
                        if examples2:
                            new_assistant_message += f"Examples with <WORD>{word2}</WORD>:\n"
                            for yanomami, translation in examples2:
                                new_assistant_message += f"<EXAMPLE_YANOMAMI>{yanomami}</EXAMPLE_YANOMAMI>\n<EXAMPLE_TRANSLATION>{translation}</EXAMPLE_TRANSLATION>\n\n"
                        
                        # Update the assistant message
                        data['messages'][1]['content'] = new_assistant_message
                        processed_count += 1
                    else:
                        # Handle case where only one word is mentioned
                        single_word_match = re.search(r'when should i use ["\']*(.*?)["\']* in yanomami', user_message.lower(), re.IGNORECASE)
                        if single_word_match and yanomami_word:
                            # Try to extract meaning and usage for the single word
                            meaning_match = re.search(f"'{yanomami_word}'\\s+means\\s+'([^']+)'", assistant_message)
                            meaning = ""
                            if meaning_match:
                                meaning = meaning_match.group(1).strip()
                            
                            # Create a simpler formatted message for single word
                            new_assistant_message = f"<WORD>{yanomami_word}</WORD> <DEFINITION>{meaning}</DEFINITION>\n\n"
                            
                            # Update the assistant message
                            data['messages'][1]['content'] = new_assistant_message
                            processed_count += 1
                
                # Write the updated or original data with visible Unicode characters
                f_out.write(json.dumps(data, ensure_ascii=False) + '\n')
    
    return processed_count

def main():
    """Main function to process all dataset files."""
    parser = argparse.ArgumentParser(description='Add special tokens to Yanomami dataset files.')
    parser.add_argument('--input_dir', type=str, default='yanomami_dataset', 
                        help='Directory containing the original dataset files')
    parser.add_argument('--output_dir', type=str, default='yanomami_dataset_with_tokens', 
                        help='Directory to save the processed dataset files')
    args = parser.parse_args()
    
    # Create output directory if it doesn't exist
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Process each file type
    total_processed = 0
  
    # Process how-to.jsonl
    input_file = os.path.join(args.input_dir, 'how-to-p2.jsonl')
    output_file = os.path.join(args.output_dir, 'how-to-p2.jsonl')
    if os.path.exists(input_file):
        processed = process_how_to_file(input_file, output_file)
        logger.info(f"Processed {processed} entries in {os.path.basename(input_file)}")
        total_processed += processed
    

    logger.info(f"Total processed entries: {total_processed}")
    logger.info(f"Processed dataset saved to {args.output_dir}")

if __name__ == "__main__":
    main()