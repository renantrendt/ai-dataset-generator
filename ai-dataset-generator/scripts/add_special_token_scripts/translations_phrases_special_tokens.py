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

def process_translations_file(input_file, output_file):
    """Process translations.jsonl file to add special tokens."""
    processed_count = 0
    with open(input_file, 'r', encoding='utf-8') as f_in, open(output_file, 'w', encoding='utf-8') as f_out:
        for line in tqdm(f_in, desc=f"Processing {os.path.basename(input_file)}"):
            data = json.loads(line)
            
            if 'messages' in data and len(data['messages']) >= 2:
                user_message = data['messages'][0]['content']
                assistant_message = data['messages'][1]['content']
                
                # Check if this is a meaning query
                if "mean" in user_message.lower() and "yanomami" in user_message.lower():
                    # Extract the Yanomami word
                    word_match = re.search(r"'([^']*)'", user_message)
                    if word_match:
                        yanomami_word = word_match.group(1)
                        
                        # Add query token to user message
                        data['messages'][0]['content'] = f"<QUERY>What does <WORD>{yanomami_word}</WORD> mean in Yanomami?</QUERY>"
                        
                        # Extract meaning and POS from assistant message
                        meaning_match = re.search(r"means '([^']*)'|in Yanomami means '([^']*)'|means \"([^\"]*)\"", assistant_message)
                        pos_match = re.search(r"It is an? ([A-Za-z]+( [A-Za-z]+)?)\.", assistant_message)
                        
                        # Extract examples
                        examples_section = ""
                        examples_match = re.search(r"Here are some examples:(.*?)(?:Related forms:|$)", assistant_message, re.DOTALL)
                        if examples_match:
                            examples_section = examples_match.group(1).strip()
                        
                        # Extract related forms
                        related_forms = ""
                        related_match = re.search(r"Related forms: (.*?)$", assistant_message)
                        if related_match:
                            related_forms = related_match.group(1).strip()
                        
                        # Get meaning from different possible match groups
                        meaning = ""
                        if meaning_match:
                            for group in meaning_match.groups():
                                if group:
                                    meaning = group
                                    break
                        else:
                            # Try a more general approach if the specific patterns don't match
                            first_sentence = assistant_message.split('.')[0]
                            if "means" in first_sentence:
                                meaning = first_sentence.split("means")[-1].strip(" '\".")
                        
                        pos = pos_match.group(1) if pos_match else ""
                        
                        # Create structured message
                        new_assistant_message = f"<WORD>{yanomami_word}</WORD> "
                        if pos:
                            new_assistant_message += f"<POS>{pos}</POS> "
                        new_assistant_message += f"<DEFINITION>{meaning}</DEFINITION>"
                        
                        # Add examples if available
                        if examples_section:
                            formatted_examples = ""
                            # Process each example to add specific tags
                            example_lines = examples_section.strip().split('\n')
                            for i in range(0, len(example_lines), 2):
                                if i+1 < len(example_lines):
                                    yanomami_example = example_lines[i].strip('- ').strip()
                                    translation = example_lines[i+1].strip().replace("Translation: ", "")
                                    formatted_examples += f"<EXAMPLE_YANOMAMI>{yanomami_example}</EXAMPLE_YANOMAMI> <EXAMPLE_TRANSLATION>{translation}</EXAMPLE_TRANSLATION>\n"
                            
                            new_assistant_message += f" <EXAMPLES>{formatted_examples.strip()}</EXAMPLES>"
                            
                        # Add related forms if available
                        if related_forms:
                            new_assistant_message += f" <RELATED_FORMS>{related_forms}</RELATED_FORMS>"
                        
                        # Update the assistant message
                        data['messages'][1]['content'] = new_assistant_message
                        processed_count += 1
            
            # Write the updated or original data with visible Unicode characters
            f_out.write(json.dumps(data, ensure_ascii=False) + '\n')
    
    return processed_count

def process_yanomami_to_english_file(input_file, output_file):
    """Process phrases-yanomami-to-english.jsonl file to add special tokens."""
    processed_count = 0
    with open(input_file, 'r', encoding='utf-8') as f_in, open(output_file, 'w', encoding='utf-8') as f_out:
        for line in tqdm(f_in, desc=f"Processing {os.path.basename(input_file)}"):
            data = json.loads(line)
            
            if 'messages' in data and len(data['messages']) >= 2:
                user_message = data['messages'][0]['content']
                assistant_message = data['messages'][1]['content']
                
                # Check if this is a translation query
                if "translate" in user_message.lower() and "yanomami" in user_message.lower():
                    # Extract the Yanomami phrase
                    phrase_match = re.search(r"\"([^\"]*)\"", user_message)
                    if phrase_match:
                        yanomami_phrase = phrase_match.group(1)
                        
                        # Add query token to user message
                        data['messages'][0]['content'] = f"<QUERY>Translate this Yanomami phrase to English: <YANOMAMI>{yanomami_phrase}</YANOMAMI></QUERY>"
                        
                        # Extract translation
                        translation_match = re.search(r"is '([^']*)'|is \"([^\"]*)\"", assistant_message)
                        literal_match = re.search(r"Literal: '([^']*)'|Literal: \"([^\"]*)\"", assistant_message)
                        
                        translation = ""
                        if translation_match:
                            for group in translation_match.groups():
                                if group:
                                    translation = group
                                    break
                        
                        literal = ""
                        if literal_match:
                            for group in literal_match.groups():
                                if group:
                                    literal = group
                                    break
                        
                        # Create structured message
                        new_assistant_message = f"<YANOMAMI>{yanomami_phrase}</YANOMAMI> <TRANSLATION>{translation}</TRANSLATION>"
                        if literal:
                            new_assistant_message += f" <LITERAL>{literal}</LITERAL>"
                        
                        # Update the assistant message
                        data['messages'][1]['content'] = new_assistant_message
                        processed_count += 1
            
            # Write the updated or original data with visible Unicode characters
            f_out.write(json.dumps(data, ensure_ascii=False) + '\n')
    
    return processed_count

def process_phrases_file(input_file, output_file):
    """Process phrases-english-to-yanomami.jsonl file to add special tokens."""
    processed_count = 0
    with open(input_file, 'r', encoding='utf-8') as f_in, open(output_file, 'w', encoding='utf-8') as f_out:
        for line in tqdm(f_in, desc=f"Processing {os.path.basename(input_file)}"):
            data = json.loads(line)
            
            if 'messages' in data and len(data['messages']) >= 2:
                user_message = data['messages'][0]['content']
                assistant_message = data['messages'][1]['content']
                
                # Extract the English phrase - try both double and single quotes
                phrase_match = re.search(r"\"([^\"]*)\"|\'([^\']*)\'|how do you say ([^\s]+) in", user_message)
                if phrase_match:
                    # Get the first non-None group
                    english_phrase = next((g for g in phrase_match.groups() if g is not None), "")
                    
                    # Add query token to user message
                    data['messages'][0]['content'] = f"<QUERY>How do you say <TRANSLATION>{english_phrase}</TRANSLATION> in Yanomami?</QUERY>"
                    
                    # Extract Yanomami translation with multiple patterns
                    yanomami_phrase = ""
                    # Try various patterns
                    patterns = [
                        r"In Yanomami, \"([^\"]*)\"",
                        r"In Yanomami, '([^']*)'",
                        r"in Yanomami is '([^']*)'",
                        r"in Yanomami is \"([^\"]*)\"",
                        r"The .* in Yanomami is '([^']*)'",
                    ]

                    for pattern in patterns:
                        match = re.search(pattern, assistant_message)
                        if match:
                            yanomami_phrase = match.group(1)
                            break

                    # Last resort: just take the last word in quotes if nothing else matched
                    if not yanomami_phrase:
                        last_quote = re.findall(r"'([^']*)'|\"([^\"]*)\"", assistant_message)
                        if last_quote:
                            yanomami_phrase = last_quote[-1][0] if last_quote[-1][0] else last_quote[-1][1]
                    # Create structured message
                    new_assistant_message = f"<TRANSLATION>{english_phrase}</TRANSLATION> <YANOMAMI>{yanomami_phrase}</YANOMAMI>"
                    
                    # Extract examples section if available
                    examples_section = ""
                    examples_match = re.search(r"Examples?:(.*?)(?:$|\n\n)", assistant_message, re.DOTALL | re.IGNORECASE)
                    if examples_match:
                        examples_section = examples_match.group(1).strip()
                    
                    # Add examples if available
                    if examples_section:
                        formatted_examples = ""
                        # Process each example to add specific tags
                        example_lines = examples_section.strip().split('\n')
                        for i in range(0, len(example_lines), 2):
                            if i+1 < len(example_lines):
                                yanomami_example = example_lines[i].strip('- ').strip()
                                translation = example_lines[i+1].strip().replace("Translation: ", "")
                                formatted_examples += f"<EXAMPLE_YANOMAMI>{yanomami_example}</EXAMPLE_YANOMAMI> <EXAMPLE_TRANSLATION>{translation}</EXAMPLE_TRANSLATION>\n"
                        
                        new_assistant_message += f" <EXAMPLES>{formatted_examples.strip()}</EXAMPLES>"
                    
                    # Update the assistant message
                    data['messages'][1]['content'] = new_assistant_message
                    processed_count += 1
            
            # Write the updated or original data with visible Unicode characters
            f_out.write(json.dumps(data, ensure_ascii=False) + '\n')
    
    return processed_count

def process_comparison_file(input_file, output_file):
    """Process comparison.jsonl file to add special tokens."""
    processed_count = 0
    with open(input_file, 'r', encoding='utf-8') as f_in, open(output_file, 'w', encoding='utf-8') as f_out:
        for line in tqdm(f_in, desc=f"Processing {os.path.basename(input_file)}"):
            data = json.loads(line)
            
            if 'messages' in data and len(data['messages']) >= 2:
                user_message = data['messages'][0]['content']
                assistant_message = data['messages'][1]['content']
                
                # Check if this is a comparison query
                if "difference between" in user_message.lower() and "yanomami" in user_message.lower():
                    # Extract the words being compared - handle different formats
                    words = []
                    
                    # Try to find words in quotes first (both single and double quotes)
                    quote_matches = re.findall(r"'([^']*)'|\"([^\"]*)\"", user_message)
                    for match in quote_matches:
                        if isinstance(match, tuple):
                            # Get the first non-empty group
                            word = next((g for g in match if g), "")
                            if word:
                                words.append(word)
                        else:
                            words.append(match)
                    
                    # If we don't have enough words with quotes, try to find them without quotes
                    if len(words) < 2:
                        # Try to extract words from pattern like "difference between X and Y"
                        unquoted_match = re.search(r"difference between\s+['\"]*([^'\"]+)['\"]*\s+and\s+['\"]*([^'\"]+)['\"]*", user_message, re.IGNORECASE)
                        if unquoted_match:
                            words = [unquoted_match.group(1).strip(), unquoted_match.group(2).strip()]
                    
                    if len(words) >= 2:
                        word1 = words[0]
                        word2 = words[1]
                        
                        # Add query token to user message
                        data['messages'][0]['content'] = f"<QUERY>What is the difference between '{word1}' and '{word2}' in Yanomami?</QUERY>"
                        
                        # Try to parse the response directly if it's already in a structured format
                        if "<WORD>" in assistant_message:
                            # The message is already formatted, keep it as is
                            data['messages'][1]['content'] = assistant_message
                            processed_count += 1
                            f_out.write(json.dumps(data, ensure_ascii=False) + '\n')
                            continue
                        
                        # Extract definitions with various patterns
                        definition1 = ""
                        definition2 = ""
                        
                        # Try different patterns for definitions
                        def_patterns = [
                            f"'{word1}' means '([^']*)'|'{word1}' means \"([^\"]*)\"",
                            f"- '{word1}' means '([^']*)'|'{word1}' is a ([^\\n]*)",
                            f"'{word1}' is an? ([^\\n,]*)",
                            f"'{word1}'\\s+means\\s+([^\\n.]*)",
                            f"{word1}\\s+means\\s+'([^']*)'|{word1}\\s+means\\s+\"([^\"]*)\"",
                            f"{word1}\\s+means\\s+([^\\n.]*)"
                        ]
                        
                        for pattern in def_patterns:
                            def1_match = re.search(pattern, assistant_message, re.IGNORECASE)
                            if def1_match:
                                for group in def1_match.groups():
                                    if group:
                                        definition1 = group.strip()
                                        break
                                if definition1:
                                    break
                        
                        # Same for word2
                        def_patterns = [
                            f"'{word2}' means '([^']*)'|'{word2}' means \"([^\"]*)\"",
                            f"- '{word2}' means '([^']*)'|'{word2}' is a ([^\\n]*)",
                            f"'{word2}' is an? ([^\\n,]*)",
                            f"'{word2}'\\s+means\\s+([^\\n.]*)",
                            f"{word2}\\s+means\\s+'([^']*)'|{word2}\\s+means\\s+\"([^\"]*)\"",
                            f"{word2}\\s+means\\s+([^\\n.]*)"
                        ]
                        
                        for pattern in def_patterns:
                            def2_match = re.search(pattern, assistant_message, re.IGNORECASE)
                            if def2_match:
                                for group in def2_match.groups():
                                    if group:
                                        definition2 = group.strip()
                                        break
                                if definition2:
                                    break
                        
                        # If still not found, look for patterns in the "Meaning" section
                        if not definition1 or not definition2:
                            meaning_section = re.search(r"1\.\s*Meaning:(.*?)(?:2\.|$)", assistant_message, re.DOTALL)
                            if meaning_section:
                                meaning_text = meaning_section.group(1).strip()
                                
                                # Look for word1 definition in meaning section
                                if not definition1:
                                    for pattern in def_patterns[:3]:  # Use the first 3 patterns
                                        def1_match = re.search(pattern, meaning_text)
                                        if def1_match:
                                            for group in def1_match.groups():
                                                if group:
                                                    definition1 = group.strip()
                                                    break
                                            if definition1:
                                                break
                                    
                                    # If still not found, try extracting from bullet points
                                    if not definition1:
                                        bullet_match = re.search(f"- '{word1}'[^\\n]*'([^']*)'|- '{word1}'[^\\n]*\"([^\"]*)\"", meaning_text)
                                        if bullet_match:
                                            for group in bullet_match.groups():
                                                if group:
                                                    definition1 = group.strip()
                                                    break
                                
                                # Look for word2 definition in meaning section
                                if not definition2:
                                    for pattern in def_patterns[:3]:  # Use the first 3 patterns
                                        def2_match = re.search(pattern, meaning_text)
                                        if def2_match:
                                            for group in def2_match.groups():
                                                if group:
                                                    definition2 = group.strip()
                                                    break
                                            if definition2:
                                                break
                                    
                                    # If still not found, try extracting from bullet points
                                    if not definition2:
                                        bullet_match = re.search(f"- '{word2}'[^\\n]*'([^']*)'|- '{word2}'[^\\n]*\"([^\"]*)\"", meaning_text)
                                        if bullet_match:
                                            for group in bullet_match.groups():
                                                if group:
                                                    definition2 = group.strip()
                                                    break
                        
                        # Extract grammatical categories
                        pos1 = ""
                        pos2 = ""
                        
                        # Try different patterns for POS
                        pos_patterns = [
                            f"'{word1}' is an? ([A-Za-z]+(?: \\([A-Za-z]+\\))?)",
                            f"{word1} is an? ([A-Za-z]+(?: \\([A-Za-z]+\\))?)",
                            f"- '{word1}' is an? ([A-Za-z]+(?: \\([A-Za-z]+\\))?)"
                        ]
                        
                        # Check in grammatical section first
                        grammatical_section = re.search(r"2\.\s*Grammatical category:(.*?)(?:3\.|$)", assistant_message, re.DOTALL)
                        if grammatical_section:
                            grammatical_text = grammatical_section.group(1).strip()
                            
                            for pattern in pos_patterns:
                                pos1_match = re.search(pattern, grammatical_text, re.IGNORECASE)
                                if pos1_match:
                                    pos1 = pos1_match.group(1).strip()
                                    break
                            
                            pos_patterns = [
                                f"'{word2}' is an? ([A-Za-z]+(?: \\([A-Za-z]+\\))?)",
                                f"{word2} is an? ([A-Za-z]+(?: \\([A-Za-z]+\\))?)",
                                f"- '{word2}' is an? ([A-Za-z]+(?: \\([A-Za-z]+\\))?)"
                            ]
                            
                            for pattern in pos_patterns:
                                pos2_match = re.search(pattern, grammatical_text, re.IGNORECASE)
                                if pos2_match:
                                    pos2 = pos2_match.group(1).strip()
                                    break
                        
                        # If not found in grammatical section, look in the whole text
                        if not pos1:
                            for pattern in pos_patterns:
                                pos1_match = re.search(pattern, assistant_message, re.IGNORECASE)
                                if pos1_match:
                                    pos1 = pos1_match.group(1).strip()
                                    break
                        
                        if not pos2:
                            pos_patterns = [
                                f"'{word2}' is an? ([A-Za-z]+(?: \\([A-Za-z]+\\))?)",
                                f"{word2} is an? ([A-Za-z]+(?: \\([A-Za-z]+\\))?)",
                                f"- '{word2}' is an? ([A-Za-z]+(?: \\([A-Za-z]+\\))?)"
                            ]
                            
                            for pattern in pos_patterns:
                                pos2_match = re.search(pattern, assistant_message, re.IGNORECASE)
                                if pos2_match:
                                    pos2 = pos2_match.group(1).strip()
                                    break
                        
                        # Extract usage information
                        usage1 = ""
                        usage2 = ""
                        
                        usage_section = re.search(r"3\.\s*Usage:(.*?)(?:4\.|$)", assistant_message, re.DOTALL)
                        if usage_section:
                            usage_text = usage_section.group(1).strip()
                            
                            # Try different patterns for usage
                            usage_patterns = [
                                f"'{word1}' is used ([^\\n]*?)(?:'{word2}'|$)",
                                f"- '{word1}' is used ([^\\n]*)",
                                f"{word1} is used ([^\\n]*)"
                            ]
                            
                            for pattern in usage_patterns:
                                usage1_match = re.search(pattern, usage_text, re.IGNORECASE | re.DOTALL)
                                if usage1_match:
                                    usage1 = usage1_match.group(1).strip()
                                    break
                            
                            usage_patterns = [
                                f"'{word2}' is used ([^\\n]*)",
                                f"- '{word2}' is used ([^\\n]*)",
                                f"{word2} is used ([^\\n]*)"
                            ]
                            
                            for pattern in usage_patterns:
                                usage2_match = re.search(pattern, usage_text, re.IGNORECASE | re.DOTALL)
                                if usage2_match:
                                    usage2 = usage2_match.group(1).strip()
                                    break
                        
                        # Extract examples
                        examples_section = ""
                        examples_match = re.search(r"4\.\s*Examples:(.*?)$", assistant_message, re.DOTALL)
                        if examples_match:
                            examples_section = examples_match.group(1).strip()
                        
                        # Create structured message
                        new_assistant_message = f"<WORD>{word1}</WORD> "
                        if pos1:
                            new_assistant_message += f"<POS>{pos1}</POS> "
                        if definition1:
                            new_assistant_message += f"<DEFINITION>{definition1}</DEFINITION>"
                        if usage1:
                            new_assistant_message += f" <USAGE>{usage1}</USAGE>"
                        
                        new_assistant_message += f"\n<WORD>{word2}</WORD> "
                        if pos2:
                            new_assistant_message += f"<POS>{pos2}</POS> "
                        if definition2:
                            new_assistant_message += f"<DEFINITION>{definition2}</DEFINITION>"
                        if usage2:
                            new_assistant_message += f" <USAGE>{usage2}</USAGE>"
                        
                        # Add examples if available
                        if examples_section:
                            formatted_examples = ""
                            
                            # Try to find examples by word
                            word1_examples_match = re.search(f"With '{word1}':(.*?)(?:With '{word2}':|$)", examples_section, re.DOTALL)
                            word2_examples_match = re.search(f"With '{word2}':(.*?)$", examples_section, re.DOTALL)
                            
                            # Process examples for word1
                            if word1_examples_match:
                                word1_examples = word1_examples_match.group(1).strip()
                                example_lines = word1_examples.split('\n')
                                for i in range(0, len(example_lines), 2):
                                    if i+1 < len(example_lines) and example_lines[i].strip():
                                        yanomami_example = example_lines[i].strip('- ').strip()
                                        translation = ""
                                        if "Translation:" in example_lines[i+1]:
                                            translation = example_lines[i+1].strip().replace("Translation: ", "")
                                        else:
                                            translation = example_lines[i+1].strip()
                                        formatted_examples += f"<EXAMPLE_YANOMAMI>{yanomami_example}</EXAMPLE_YANOMAMI> <EXAMPLE_TRANSLATION>{translation}</EXAMPLE_TRANSLATION>\n"
                            
                            # Process examples for word2
                            if word2_examples_match:
                                word2_examples = word2_examples_match.group(1).strip()
                                example_lines = word2_examples.split('\n')
                                for i in range(0, len(example_lines), 2):
                                    if i+1 < len(example_lines) and example_lines[i].strip():
                                        yanomami_example = example_lines[i].strip('- ').strip()
                                        translation = ""
                                        if "Translation:" in example_lines[i+1]:
                                            translation = example_lines[i+1].strip().replace("Translation: ", "")
                                        else:
                                            translation = example_lines[i+1].strip()
                                        formatted_examples += f"<EXAMPLE_YANOMAMI>{yanomami_example}</EXAMPLE_YANOMAMI> <EXAMPLE_TRANSLATION>{translation}</EXAMPLE_TRANSLATION>\n"
                            
                            # If no examples found with the "With 'word':" pattern, try to extract examples directly
                            if not formatted_examples:
                                example_lines = examples_section.split('\n')
                                for i in range(0, len(example_lines), 2):
                                    if i+1 < len(example_lines) and example_lines[i].strip():
                                        yanomami_example = example_lines[i].strip('- ').strip()
                                        translation = ""
                                        if i+1 < len(example_lines):
                                            if "Translation:" in example_lines[i+1]:
                                                translation = example_lines[i+1].strip().replace("Translation: ", "")
                                            else:
                                                translation = example_lines[i+1].strip()
                                            formatted_examples += f"<EXAMPLE_YANOMAMI>{yanomami_example}</EXAMPLE_YANOMAMI> <EXAMPLE_TRANSLATION>{translation}</EXAMPLE_TRANSLATION>\n"
                            
                            if formatted_examples:
                                new_assistant_message += f"\n<EXAMPLES>{formatted_examples.strip()}</EXAMPLES>"
                        
                        # Update the assistant message
                        data['messages'][1]['content'] = new_assistant_message
                        processed_count += 1
            
            # Write the updated or original data with visible Unicode characters
            f_out.write(json.dumps(data, ensure_ascii=False) + '\n')
    
    return processed_count

def process_how_to_file(input_file, output_file):
    """Process how-to.jsonl file to add special tokens."""
    processed_count = 0
    with open(input_file, 'r', encoding='utf-8') as f_in, open(output_file, 'w', encoding='utf-8') as f_out:
        for line in tqdm(f_in, desc=f"Processing {os.path.basename(input_file)}"):
            data = json.loads(line)
            
            if 'messages' in data and len(data['messages']) >= 2:
                user_message = data['messages'][0]['content']
                assistant_message = data['messages'][1]['content']
                
                # Check if this is a how-to query or a usage comparison query
                if ("how" in user_message.lower() or "when should i use" in user_message.lower()) and "yanomami" in user_message.lower():
                    # Extract the Yanomami word if present - check for multiple patterns
                    yanomami_word = ""
                    
                    # Pattern 1: Word in quotes
                    word_match = re.search(r"'([^']*)'|\"([^\"]*)\"", user_message)
                    if word_match:
                        yanomami_word = next((g for g in word_match.groups() if g is not None), "")
                    
                    # Pattern 2: Word after 'word' without quotes
                    if not yanomami_word:
                        word_pattern_match = re.search(r"the word ([^\s'\"]+)", user_message, re.IGNORECASE)
                        if word_pattern_match:
                            yanomami_word = word_pattern_match.group(1)
                    
                    # Pattern 3: Words in 'When should I use X instead of Y' pattern
                    if not yanomami_word and "when should i use" in user_message.lower():
                        usage_pattern_match = re.search(r"when should i use ['\"]*([^'\"]+)['\"]*\s+instead of\s+['\"]*([^'\"]+)['\"]*", user_message, re.IGNORECASE)
                        if usage_pattern_match:
                            # Get both words
                            word1 = usage_pattern_match.group(1).strip()
                            word2 = usage_pattern_match.group(2).strip()
                            yanomami_word = word1  # Use the first word as the primary word
                    
                    # Extract the concept/question based on query type
                    if "when should i use" in user_message.lower():
                        # For 'when should I use' queries
                        usage_pattern_match = re.search(r"when should i use ['\"]*([^'\"]+)['\"]*\s+instead of\s+['\"]*([^'\"]+)['\"]*", user_message, re.IGNORECASE)
                        if usage_pattern_match:
                            word1 = usage_pattern_match.group(1).strip()
                            word2 = usage_pattern_match.group(2).strip()
                            data['messages'][0]['content'] = f"<QUERY>When should I use <WORD>{word1}</WORD> instead of <WORD>{word2}</WORD> in Yanomami?</QUERY>"
                        else:
                            # If we couldn't extract both words but have yanomami_word
                            if yanomami_word:
                                data['messages'][0]['content'] = f"<QUERY>When should I use <WORD>{yanomami_word}</WORD> in Yanomami?</QUERY>"
                            else:
                                data['messages'][0]['content'] = f"<QUERY>{user_message}</QUERY>"
                    else:
                        # For 'how' queries
                        concept_match = re.search(r"how (do|does|to|can|would) ([^?]*)", user_message, re.IGNORECASE)
                        if concept_match:
                            concept = concept_match.group(2).strip()
                            
                            # Add query token to user message with word tag if available
                            if yanomami_word:
                                data['messages'][0]['content'] = f"<QUERY>How {concept_match.group(1)} I use the word <WORD>{yanomami_word}</WORD> in a Yanomami sentence?</QUERY>"
                            else:
                                data['messages'][0]['content'] = f"<QUERY>How {concept_match.group(1)} {concept}?</QUERY>"
                        
                    # Extract examples for both query types
                    examples_section = ""
                    examples_match = re.search(r"Here are some examples:(.*?)$", assistant_message, re.DOTALL)
                    if examples_match:
                        examples_section = examples_match.group(1).strip()
                    
                    # Create structured message based on query type
                    new_assistant_message = ""
                    
                    # Special handling for 'when should I use' queries
                    if "when should i use" in user_message.lower():
                        usage_pattern_match = re.search(r"when should i use ['\"]*([^'\"]+)['\"]*\s+instead of\s+['\"]*([^'\"]+)['\"]*", user_message, re.IGNORECASE)
                        if usage_pattern_match:
                            word1 = usage_pattern_match.group(1).strip()
                            word2 = usage_pattern_match.group(2).strip()
                            
                            # Extract meanings
                            meaning1 = ""
                            meaning2 = ""
                            
                            # Try to extract meanings with various patterns
                            meaning_patterns = [
                                f"'{word1}' means ['\"]*([^'\"]+)['\"]*",
                                f"{word1} means ['\"]*([^'\"]+)['\"]*",
                                f"'{word1}' is used to ([^\\n,\.]*)",
                                f"{word1} is used to ([^\\n,\.]*)",
                                f"'{word1}' is an? ([^\\n,\.]*)",
                                f"{word1} is an? ([^\\n,\.]*)"
                            ]
                            
                            for pattern in meaning_patterns:
                                meaning_match = re.search(pattern, assistant_message, re.IGNORECASE)
                                if meaning_match:
                                    meaning1 = meaning_match.group(1).strip()
                                    break
                            
                            # If we still don't have a meaning, try a more general pattern
                            if not meaning1:
                                sections = assistant_message.split('\n')
                                for section in sections:
                                    if word1.lower() in section.lower() and 'means' in section.lower():
                                        parts = section.split('means')
                                        if len(parts) > 1:
                                            meaning1 = parts[1].strip().strip('\'",.').strip()
                                            break
                            
                            meaning_patterns = [
                                f"'{word2}' means ['\"]*([^'\"]+)['\"]*",
                                f"{word2} means ['\"]*([^'\"]+)['\"]*",
                                f"'{word2}' is used to ([^\\n,\.]*)",
                                f"{word2} is used to ([^\\n,\.]*)",
                                f"'{word2}' is an? ([^\\n,\.]*)",
                                f"{word2} is an? ([^\\n,\.]*)"
                            ]
                            
                            for pattern in meaning_patterns:
                                meaning_match = re.search(pattern, assistant_message, re.IGNORECASE)
                                if meaning_match:
                                    meaning2 = meaning_match.group(1).strip()
                                    break
                                    
                            # If we still don't have a meaning, try a more general pattern
                            if not meaning2:
                                sections = assistant_message.split('\n')
                                for section in sections:
                                    if word2.lower() in section.lower() and 'means' in section.lower():
                                        parts = section.split('means')
                                        if len(parts) > 1:
                                            meaning2 = parts[1].strip().strip('\'",.').strip()
                                            break
                            
                            # Extract usage context
                            usage_context = ""
                            context_match = re.search(r"You should use ['\"]*([^'\"]+)['\"]*\s+when\s+([^\\n\.]*)", assistant_message, re.IGNORECASE)
                            if context_match:
                                usage_context = context_match.group(2).strip()
                            
                            # Create structured message with proper formatting
                            new_assistant_message = "When deciding between these words in Yanomami:\n\n"
                            
                            # Add first word with definition
                            new_assistant_message += f"<WORD>{word1}</WORD> "
                            if meaning1:
                                new_assistant_message += f"<DEFINITION>{meaning1}</DEFINITION>\n\n"
                            else:
                                new_assistant_message += "\n\n"
                            
                            # Add second word with definition
                            new_assistant_message += f"<WORD>{word2}</WORD> "
                            if meaning2:
                                new_assistant_message += f"<DEFINITION>{meaning2}</DEFINITION>\n\n"
                            else:
                                new_assistant_message += "\n\n"
                            
                            # Add usage guidance
                            if usage_context:
                                new_assistant_message += f"<USAGE>{usage_context}</USAGE>\n"
                            else:
                                # Add generic usage guidance
                                new_assistant_message += f"<USAGE>Use {word1} when referring to {meaning1 or 'its meaning'}. Use {word2} when referring to {meaning2 or 'its meaning'}.</USAGE>\n"
                        else:
                            # If we couldn't extract both words but have yanomami_word
                            if yanomami_word:
                                new_assistant_message = f"<WORD>{yanomami_word}</WORD> "
                                
                                # Try to extract meaning
                                meaning_match = re.search(f"'{yanomami_word}' means ['\"]*([^'\"]+)['\"]*|{yanomami_word} means ['\"]*([^'\"]+)['\"]*", assistant_message, re.IGNORECASE)
                                if meaning_match:
                                    meaning = next((g for g in meaning_match.groups() if g is not None), "")
                                    new_assistant_message += f"<DEFINITION>{meaning}</DEFINITION> "
                                
                                # Try to extract usage context
                                context_match = re.search(f"You should use ['\"]*{yanomami_word}['\"]*\s+when\s+([^\\n\.]*)", assistant_message, re.IGNORECASE)
                                if context_match:
                                    usage_context = context_match.group(1).strip()
                                    new_assistant_message += f"<USAGE>{usage_context}</USAGE> "
                    else:
                        # Standard how-to query handling
                        # Create structured message with the word
                        if yanomami_word:
                            new_assistant_message = f"<WORD>{yanomami_word}</WORD>"  # Use the extracted word
                        else:
                            # Try to extract Yanomami word from assistant response
                            # Pattern 1: Word in quotes in the first line
                            yanomami_in_response = re.search(r"'([^']*)'|\"([^\"]*)\"", assistant_message.split('\n')[0])
                            if yanomami_in_response:
                                extracted_word = next((g for g in yanomami_in_response.groups() if g is not None), "")
                                new_assistant_message = f"<WORD>{extracted_word}</WORD>"  # Use word from response
                            else:
                                # Pattern 2: Word after "the word" in the response
                                word_pattern_match = re.search(r"the word '([^']*)'|the word \"([^\"]*)\"|(The word '[^']*')", assistant_message)
                                if word_pattern_match:
                                    extracted_word = next((g for g in word_pattern_match.groups() if g is not None), "")
                                    # Clean up any extra text
                                    if extracted_word.startswith("The word '"):
                                        extracted_word = re.search(r"The word '([^']*)'|The word \"([^\"]*)\"|", extracted_word).group(1)
                                    new_assistant_message = f"<WORD>{extracted_word}</WORD>"  # Use word from response
                                else:
                                    # Last resort: Try to find the word in the meaning section
                                    meaning_match = re.search(r"The word '([^']*)' means|The word \"([^\"]*)\" means", assistant_message)
                                    if meaning_match:
                                        extracted_word = next((g for g in meaning_match.groups() if g is not None), "")
                                        new_assistant_message = f"<WORD>{extracted_word}</WORD>"  # Use word from meaning section
                                    else:
                                        if 'concept' in locals():
                                            new_assistant_message = f"<WORD>{concept}</WORD>"  # Fallback to concept
                                        else:
                                            new_assistant_message = "<RESPONSE>"  # Generic fallback
                        
                        # Extract grammatical information and part of speech if available
                        grammatical_info = ""
                        
                        # Try to extract part of speech
                        pos_info = ""
                        pos_match = re.search(r"is an? ([A-Za-z]+( \([A-Za-z]+\))?)", assistant_message)
                        if pos_match:
                            pos_info = pos_match.group(1).strip()
                            new_assistant_message += f" <POS>{pos_info}</POS>"
                        
                        # Try to extract definition/meaning
                        definition = ""
                        def_match = re.search(r"means '([^']*)'|means \"([^\"]*)\"|\'([^']*)\'\s+and is an?|\"([^\"]*)\"\s+and is an?", assistant_message)
                        if def_match:
                            definition = next((g for g in def_match.groups() if g is not None), "")
                            new_assistant_message += f" <DEFINITION>{definition}</DEFINITION>"
                        
                        # Extract grammatical information
                        grammar_match = re.search(r"In Yanomami grammar,(.*?)(?:Here are some examples:|$)", assistant_message, re.DOTALL)
                        if grammar_match:
                            grammatical_info = grammar_match.group(1).strip()
                            new_assistant_message += f" <GRAMMATICAL>{grammatical_info}</GRAMMATICAL>"
                        
                        # Try to extract usage information
                        usage_info = ""
                        usage_match = re.search(r"When using this (verb|word), remember that ([^.]*)\.", assistant_message)
                        if usage_match:
                            usage_info = usage_match.group(2).strip()
                            new_assistant_message += f" <USAGE>{usage_info}</USAGE>"
                        
                        # Add examples if available
                        if examples_section:
                            formatted_examples = ""
                            # Process each example to add specific tags
                            example_lines = examples_section.strip().split('\n')
                            for i in range(0, len(example_lines), 2):
                                if i+1 < len(example_lines) and example_lines[i].strip():
                                    yanomami_example = example_lines[i].strip('- ').strip()
                                    translation = example_lines[i+1].strip().replace("Translation: ", "")
                                    formatted_examples += f"<EXAMPLE_YANOMAMI>{yanomami_example}</EXAMPLE_YANOMAMI> <EXAMPLE_TRANSLATION>{translation}</EXAMPLE_TRANSLATION>\n"
                            
                            if formatted_examples:
                                new_assistant_message += f" <EXAMPLES>{formatted_examples.strip()}</EXAMPLES>"
                            else:
                                # If no structured examples found, use the whole response as examples
                                new_assistant_message += f" <EXAMPLES>{assistant_message}</EXAMPLES>"
                        
                        # Update the assistant message
                        data['messages'][1]['content'] = new_assistant_message
                        processed_count += 1
            
            # Write the updated or original data with visible Unicode characters
            f_out.write(json.dumps(data, ensure_ascii=False) + '\n')
    
    return processed_count

def process_grammar_file(input_file, output_file):
    """Process grammar.jsonl file to add special tokens."""
    processed_count = 0
    with open(input_file, 'r', encoding='utf-8') as f_in, open(output_file, 'w', encoding='utf-8') as f_out:
        for line in tqdm(f_in, desc=f"Processing {os.path.basename(input_file)}"):
            data = json.loads(line)
            
            if 'messages' in data and len(data['messages']) >= 2:
                user_message = data['messages'][0]['content']
                assistant_message = data['messages'][1]['content']
                
                # Extract Yanomami word if present
                yanomami_word = ""
                word_match = re.search(r"'([^']*)'|\"([^\"]*)\"", user_message)
                if word_match:
                    yanomami_word = next((g for g in word_match.groups() if g is not None), "")
                
                # Add query token to user message
                data['messages'][0]['content'] = f"<QUERY>{user_message}</QUERY>"
                
                # Extract examples if available
                examples_section = ""
                examples_match = re.search(r"Here are some examples:(.*?)$", assistant_message, re.DOTALL)
                if examples_match:
                    examples_section = examples_match.group(1).strip()
                
                # Create structured message based on query type
                new_assistant_message = ""
                
                # Check if this is a plural formation query
                if "plural" in user_message.lower():
                    # Extract singular and plural forms
                    singular_match = re.search(r"Singular:\s*([^\n]+)", assistant_message)
                    plural_match = re.search(r"Plural:\s*([^\n]+)", assistant_message)
                    
                    if singular_match and plural_match:
                        singular = singular_match.group(1).strip()
                        plural = plural_match.group(1).strip()
                        
                        # Add word tags if we have a word
                        if yanomami_word:
                            new_assistant_message = f"<WORD>{yanomami_word}</WORD> "
                        
                        # Add grammatical explanation
                        explanation = assistant_message
                        if singular_match and plural_match:
                            # Extract just the explanation part
                            explanation_match = re.search(r"^(.*?)(?:Singular:|$)", assistant_message, re.DOTALL)
                            if explanation_match:
                                explanation = explanation_match.group(1).strip()
                        
                        new_assistant_message += f"<GRAMMATICAL>{explanation}</GRAMMATICAL>"
                        
                        # Add examples section with singular and plural forms
                        if singular and plural:
                            new_assistant_message += f" <EXAMPLES><EXAMPLE_YANOMAMI>{singular}</EXAMPLE_YANOMAMI> <EXAMPLE_TRANSLATION>{plural}</EXAMPLE_TRANSLATION></EXAMPLES>"
                    else:
                        # If we couldn't extract specific forms, use the whole response
                        new_assistant_message = f"<GRAMMATICAL>{assistant_message}</GRAMMATICAL>"
                
                # Check if this is a verb conjugation query
                elif "conjugated" in user_message.lower() or "conjugation" in user_message.lower():
                    # Try to extract the verb
                    verb = ""
                    verb_match = re.search(r"verb '([^']*)'|verb \"([^\"]*)\"|", user_message)
                    if verb_match:
                        verb = next((g for g in verb_match.groups() if g is not None), "")
                    
                    # Add word tag if we have a verb
                    if verb:
                        new_assistant_message = f"<WORD>{verb}</WORD> "
                    
                    # Check if it's actually a verb
                    if "not a verb" in assistant_message.lower() or "is an adverb" in assistant_message.lower():
                        # Extract part of speech
                        pos = ""
                        pos_match = re.search(r"it is an? ([^,.]+)", assistant_message.lower())
                        if pos_match:
                            pos = pos_match.group(1).strip()
                            new_assistant_message += f"<POS>{pos}</POS> "
                    
                    # Add grammatical explanation
                    new_assistant_message += f"<GRAMMATICAL>{assistant_message}</GRAMMATICAL>"
                
                # Default case for other grammar queries
                else:
                    # Remove examples section from grammatical content if it exists
                    grammatical_content = assistant_message
                    if examples_section:
                        grammatical_content = assistant_message.replace(f"Here are some examples:{examples_section}", "").strip()
                    
                    new_assistant_message = f"<GRAMMATICAL>{grammatical_content}</GRAMMATICAL>"
                
                # Add examples if available
                if examples_section:
                    formatted_examples = ""
                    # Process each example to add specific tags
                    example_lines = examples_section.strip().split('\n')
                    for i in range(0, len(example_lines), 2):
                        if i+1 < len(example_lines) and example_lines[i].strip():
                            yanomami_example = example_lines[i].strip('- ').strip()
                            translation = ""
                            if "Translation:" in example_lines[i+1]:
                                translation = example_lines[i+1].strip().replace("Translation: ", "")
                            else:
                                translation = example_lines[i+1].strip()
                            formatted_examples += f"<EXAMPLE_YANOMAMI>{yanomami_example}</EXAMPLE_YANOMAMI> <EXAMPLE_TRANSLATION>{translation}</EXAMPLE_TRANSLATION>\n"
                    
                    if formatted_examples:
                        new_assistant_message += f" <EXAMPLES>{formatted_examples.strip()}</EXAMPLES>"
                
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
    
    # Process translations.jsonl
    input_file = os.path.join(args.input_dir, 'translations.jsonl')
    output_file = os.path.join(args.output_dir, 'translations.jsonl')
    if os.path.exists(input_file):
        processed = process_translations_file(input_file, output_file)
        logger.info(f"Processed {processed} entries in {os.path.basename(input_file)}")
        total_processed += processed
    
    # Process yanomami-to-english.jsonl
    input_file = os.path.join(args.input_dir, 'phrases-yanomami-to-english.jsonl')
    output_file = os.path.join(args.output_dir, 'phrases-yanomami-to-english.jsonl')
    if os.path.exists(input_file):
        processed = process_yanomami_to_english_file(input_file, output_file)
        logger.info(f"Processed {processed} entries in {os.path.basename(input_file)}")
        total_processed += processed
    
    # Process phrases.jsonl
    input_file = os.path.join(args.input_dir, 'phrases-english-to-yanomami.jsonl')
    output_file = os.path.join(args.output_dir, 'phrases-english-to-yanomami.jsonl')
    if os.path.exists(input_file):
        processed = process_phrases_file(input_file, output_file)
        logger.info(f"Processed {processed} entries in {os.path.basename(input_file)}")
        total_processed += processed
    
    # Process comparison.jsonl
    input_file = os.path.join(args.input_dir, 'comparison.jsonl')
    output_file = os.path.join(args.output_dir, 'comparison.jsonl')
    if os.path.exists(input_file):
        processed = process_comparison_file(input_file, output_file)
        logger.info(f"Processed {processed} entries in {os.path.basename(input_file)}")
        total_processed += processed
    
    # Process how-to.jsonl
    input_file = os.path.join(args.input_dir, 'how-to.jsonl')
    output_file = os.path.join(args.output_dir, 'how-to.jsonl')
    if os.path.exists(input_file):
        processed = process_how_to_file(input_file, output_file)
        logger.info(f"Processed {processed} entries in {os.path.basename(input_file)}")
        total_processed += processed
    
    # Process grammar.jsonl
    input_file = os.path.join(args.input_dir, 'grammar.jsonl')
    output_file = os.path.join(args.output_dir, 'grammar.jsonl')
    if os.path.exists(input_file):
        processed = process_grammar_file(input_file, output_file)
        logger.info(f"Processed {processed} entries in {os.path.basename(input_file)}")
        total_processed += processed
    
    logger.info(f"Total processed entries: {total_processed}")
    logger.info(f"Processed dataset saved to {args.output_dir}")

if __name__ == "__main__":
    main()