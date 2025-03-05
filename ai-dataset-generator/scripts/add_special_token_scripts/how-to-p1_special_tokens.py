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
        for line in tqdm(f_in, desc=f"Processing {os.path.basename(input_file)}"):
            data = json.loads(line)
            
            if 'messages' in data and len(data['messages']) >= 2:
                user_message = data['messages'][0]['content']
                assistant_message = data['messages'][1]['content']
                
                # Check if this is a how-to query, usage comparison query, or context query
                if ("how" in user_message.lower() or "when should i use" in user_message.lower() or "in what context" in user_message.lower()) and "yanomami" in user_message.lower():
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
                    if "in what context" in user_message.lower():
                        # For 'in what context' queries
                        context_pattern_match = re.search(r"in what context(?:s)? (?:is|are) (?:the )?(?:word |phrase |expression |term |concept )?['\"]*([^'\"]+)['\"]*", user_message, re.IGNORECASE)
                        if context_pattern_match:
                            word = context_pattern_match.group(1).strip()
                            data['messages'][0]['content'] = f"<QUERY>In what context is the word <WORD>{word}</WORD> used in Yanomami?</QUERY>"
                        else:
                            # Try another pattern
                            context_pattern_match = re.search(r"in what context(?:s)? (?:is|are) (?:the )?(?:word |phrase |expression |term |concept )?([^\?]+)", user_message, re.IGNORECASE)
                            if context_pattern_match:
                                word = context_pattern_match.group(1).strip()
                                data['messages'][0]['content'] = f"<QUERY>In what context is the word <WORD>{word}</WORD> used in Yanomami?</QUERY>"
                            else:
                                # If we couldn't extract the word but have yanomami_word
                                if yanomami_word:
                                    data['messages'][0]['content'] = f"<QUERY>In what context is the word <WORD>{yanomami_word}</WORD> used in Yanomami?</QUERY>"
                                else:
                                    data['messages'][0]['content'] = f"<QUERY>{user_message}</QUERY>"
                    elif "when should i use" in user_message.lower():
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
                    
                    # Special handling for 'in what context' queries
                    if "in what context" in user_message.lower():
                        # Extract the word from the query
                        context_pattern_match = re.search(r"in what context(?:s)? (?:is|are) (?:the )?(?:word |phrase |expression |term |concept )?['\"]*([^'\"]+)['\"]*", user_message, re.IGNORECASE)
                        if not context_pattern_match:
                            context_pattern_match = re.search(r"in what context(?:s)? (?:is|are) (?:the )?(?:word |phrase |expression |term |concept )?([^\?]+)", user_message, re.IGNORECASE)
                        
                        if context_pattern_match or yanomami_word:
                            word = context_pattern_match.group(1).strip() if context_pattern_match else yanomami_word
                            
                            # Create structured message
                            new_assistant_message = f"<WORD>{word}</WORD>"
                            
                            # Try to extract part of speech
                            pos_match = re.search(f"'{word}'\s+is\s+an?\s+([A-Za-z]+)", assistant_message, re.IGNORECASE)
                            if pos_match:
                                pos = pos_match.group(1).strip()
                                new_assistant_message += f" <POS>{pos}</POS>"
                            
                            # Try to extract definition
                            def_match = re.search(f"'{word}'\s+means\s+['\"]*([^'\"]+)['\"]*", assistant_message, re.IGNORECASE)
                            if def_match:
                                definition = def_match.group(1).strip()
                                new_assistant_message += f" <DEFINITION>{definition}</DEFINITION>"
                            
                            # Add contexts section
                            new_assistant_message += "\n\n<USAGE>The word is used in the following contexts:</USAGE>\n\n"
                            
                            # Extract contexts and examples
                            contexts = []
                            context_matches = re.findall(r"Context \d+:([^\n]*(?:\n[^\n]+)*?)(?:Context \d+:|$)", assistant_message, re.DOTALL)
                            if context_matches:
                                for context in context_matches:
                                    contexts.append(context.strip())
                            else:
                                # Try to extract examples directly
                                example_matches = re.findall(r"- Yanomami: ([^\n]+)\n- Translation: ([^\n]+)", assistant_message)
                                if example_matches:
                                    for yanomami, translation in example_matches:
                                        new_assistant_message += f"<EXAMPLE_YANOMAMI>{yanomami.strip()}</EXAMPLE_YANOMAMI> <EXAMPLE_TRANSLATION>{translation.strip()}</EXAMPLE_TRANSLATION>\n"
                            
                            # Process each context
                            for context in contexts:
                                lines = context.strip().split('\n')
                                for i in range(0, len(lines), 3):  # Each context has 3 lines: Yanomami, Translation, Usage
                                    if i+1 < len(lines):
                                        yanomami_line = lines[i].strip('- ').strip()
                                        if yanomami_line.startswith("Yanomami: "):
                                            yanomami_line = yanomami_line[len("Yanomami: "):].strip()
                                        
                                        translation_line = ""
                                        if i+1 < len(lines):
                                            translation_line = lines[i+1].strip('- ').strip()
                                            if translation_line.startswith("Translation: "):
                                                translation_line = translation_line[len("Translation: "):].strip()
                                        
                                        new_assistant_message += f"<EXAMPLE_YANOMAMI>{yanomami_line}</EXAMPLE_YANOMAMI> <EXAMPLE_TRANSLATION>{translation_line}</EXAMPLE_TRANSLATION>\n"
                            
                            # Update the assistant message
                            data['messages'][1]['content'] = new_assistant_message
                            processed_count += 1
                    
                    # Special handling for 'when should I use' queries
                    elif "when should i use" in user_message.lower():
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
                            
                            # Check if the assistant's response already has proper formatting
                            if f"<WORD>{word1}</WORD>" in assistant_message and f"<WORD>{word2}</WORD>" in assistant_message:
                                # Already formatted, keep as is
                                new_assistant_message = assistant_message
                            else:
                                # Check for the specific pattern "When deciding between 'word1' and 'word2' in Yanomami"
                                deciding_pattern = re.search(f"When deciding between '({word1})' and '({word2})' in Yanomami:", assistant_message)
                                if deciding_pattern:
                                    # Replace the pattern with special tokens
                                    new_assistant_message = assistant_message.replace(
                                        f"When deciding between '{word1}' and '{word2}' in Yanomami:", 
                                        f"When deciding between <WORD>{word1}</WORD> and <WORD>{word2}</WORD> in Yanomami:"
                                    )
                                    
                                    # Replace all other occurrences of the words with special tokens
                                    new_assistant_message = re.sub(f"'({word1})'", f"<WORD>{word1}</WORD>", new_assistant_message)
                                    new_assistant_message = re.sub(f"'({word2})'", f"<WORD>{word2}</WORD>", new_assistant_message)
                                    
                                    # Extract and tag meanings
                                    meaning_pattern1 = re.search(f"'{word1}' means '([^']+)'", assistant_message)
                                    if meaning_pattern1:
                                        meaning1 = meaning_pattern1.group(1)
                                        new_assistant_message = new_assistant_message.replace(
                                            f"'{word1}' means '{meaning1}'", 
                                            f"<WORD>{word1}</WORD> <DEFINITION>{meaning1}</DEFINITION>"
                                        )
                                    
                                    meaning_pattern2 = re.search(f"'{word2}' means '([^']+)'", assistant_message)
                                    if meaning_pattern2:
                                        meaning2 = meaning_pattern2.group(1)
                                        new_assistant_message = new_assistant_message.replace(
                                            f"'{word2}' means '{meaning2}'", 
                                            f"<WORD>{word2}</WORD> <DEFINITION>{meaning2}</DEFINITION>"
                                        )
                                    
                                    # Extract and tag usage instructions
                                    usage_pattern = re.search(f"Use '{word1}' when ([^.]+)\. Use '{word2}' when ([^.]+)", assistant_message)
                                    if usage_pattern:
                                        usage1 = usage_pattern.group(1)
                                        usage2 = usage_pattern.group(2)
                                        new_assistant_message = new_assistant_message.replace(
                                            f"Use '{word1}' when {usage1}. Use '{word2}' when {usage2}",
                                            f"<USAGE>Use <WORD>{word1}</WORD> when {usage1}. Use <WORD>{word2}</WORD> when {usage2}.</USAGE>"
                                        )
                                else:
                                    # Create structured message with proper formatting
                                    new_assistant_message = f"When deciding between <WORD>{word1}</WORD> and <WORD>{word2}</WORD> in Yanomami:\n\n"
                            
                            # Only add formatting if we're creating a new message
                            if new_assistant_message != assistant_message:
                                # Add first word with definition
                                new_assistant_message += f"1. <WORD>{word1}</WORD> "
                            if meaning1:
                                new_assistant_message += f"<DEFINITION>{meaning1}</DEFINITION>\n\n"
                            else:
                                # Try to extract from numbered lists
                                list_match = re.search(f"1\.\s*'{word1}'\s+means\s+['\"]*([^'\"\n]+)['\"]*", assistant_message, re.IGNORECASE)
                                if list_match:
                                    meaning1 = list_match.group(1).strip()
                                    new_assistant_message += f"<DEFINITION>{meaning1}</DEFINITION>\n\n"
                                else:
                                    new_assistant_message += "\n\n"
                            
                            # Only add formatting if we're creating a new message
                            if new_assistant_message != assistant_message:
                                # Add second word with definition
                                new_assistant_message += f"2. <WORD>{word2}</WORD> "
                            if meaning2:
                                new_assistant_message += f"<DEFINITION>{meaning2}</DEFINITION>\n\n"
                            else:
                                # Try to extract from numbered lists
                                list_match = re.search(f"\d\.\s*'{word2}'\s+means\s+['\"]*([^'\"\n]+)['\"]*", assistant_message, re.IGNORECASE)
                                if list_match:
                                    meaning2 = list_match.group(1).strip()
                                    new_assistant_message += f"<DEFINITION>{meaning2}</DEFINITION>\n\n"
                                else:
                                    new_assistant_message += "\n\n"
                            
                            # Only add formatting if we're creating a new message
                            if new_assistant_message != assistant_message:
                                # Try to extract POS information
                                pos1 = ""
                                pos2 = ""
                                pos_match1 = re.search(f"'{word1}'\s+is\s+an?\s+([A-Za-z]+)", assistant_message, re.IGNORECASE)
                                if pos_match1:
                                    pos1 = pos_match1.group(1).strip()
                                    new_assistant_message = new_assistant_message.replace(f"<WORD>{word1}</WORD> ", f"<WORD>{word1}</WORD> <POS>{pos1}</POS> ")
                                
                                pos_match2 = re.search(f"'{word2}'\s+is\s+an?\s+([A-Za-z]+)", assistant_message, re.IGNORECASE)
                                if pos_match2:
                                    pos2 = pos_match2.group(1).strip()
                                    new_assistant_message = new_assistant_message.replace(f"<WORD>{word2}</WORD> ", f"<WORD>{word2}</WORD> <POS>{pos2}</POS> ")
                            
                            # Only add formatting if we're creating a new message
                            if new_assistant_message != assistant_message:
                                # Add usage guidance
                                if usage_context:
                                    new_assistant_message += f"<USAGE>{usage_context}</USAGE>\n"
                                else:
                                    # Extract usage from numbered list format
                                    usage_match = re.search(f"Use\s+'{word1}'\s+when\s+([^\n\.]+)\.\s+Use\s+'{word2}'\s+when\s+([^\n\.]+)", assistant_message, re.IGNORECASE)
                                    if usage_match:
                                        usage1 = usage_match.group(1).strip()
                                        usage2 = usage_match.group(2).strip()
                                        new_assistant_message += f"<USAGE>Use <WORD>{word1}</WORD> when {usage1}. Use <WORD>{word2}</WORD> when {usage2}.</USAGE>\n"
                                    else:
                                        # Add generic usage guidance
                                        new_assistant_message += f"<USAGE>Use <WORD>{word1}</WORD> when referring to {meaning1 or 'its meaning'}. Use <WORD>{word2}</WORD> when referring to {meaning2 or 'its meaning'}.</USAGE>\n"
                                    
                            # Only add formatting if we're creating a new message
                            if new_assistant_message != assistant_message:
                                # Look for examples in the response
                                word1_examples = re.search(f"Examples with '{word1}':(.*?)(?:Examples with|$)", assistant_message, re.DOTALL | re.IGNORECASE)
                                if word1_examples:
                                    formatted_examples = ""
                                    example_lines = word1_examples.group(1).strip().split('\n')
                                    for i in range(0, len(example_lines), 2):
                                        if i < len(example_lines) and example_lines[i].strip():
                                            yanomami_example = example_lines[i].strip('- ').strip()
                                            translation = ""
                                            if i+1 < len(example_lines):
                                                translation = example_lines[i+1].strip().replace("Translation: ", "")
                                            formatted_examples += f"<EXAMPLE_YANOMAMI>{yanomami_example}</EXAMPLE_YANOMAMI> <EXAMPLE_TRANSLATION>{translation}</EXAMPLE_TRANSLATION>\n"
                                    
                                    if formatted_examples:
                                        new_assistant_message += f"\n\nExamples with <WORD>{word1}</WORD>:\n{formatted_examples.strip()}"
                                
                                # Try to find examples for the second word
                                word2_examples = re.search(f"Examples with '{word2}':(.*?)(?:\n\n|$)", assistant_message, re.DOTALL | re.IGNORECASE)
                                if word2_examples:
                                    formatted_examples = ""
                                    example_lines = word2_examples.group(1).strip().split('\n')
                                    for i in range(0, len(example_lines), 2):
                                        if i < len(example_lines) and example_lines[i].strip():
                                            yanomami_example = example_lines[i].strip('- ').strip()
                                            translation = ""
                                            if i+1 < len(example_lines):
                                                translation = example_lines[i+1].strip().replace("Translation: ", "")
                                            formatted_examples += f"<EXAMPLE_YANOMAMI>{yanomami_example}</EXAMPLE_YANOMAMI> <EXAMPLE_TRANSLATION>{translation}</EXAMPLE_TRANSLATION>\n"
                                    
                                    if formatted_examples:
                                        new_assistant_message += f"\n\nExamples with <WORD>{word2}</WORD>:\n{formatted_examples.strip()}"
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
    input_file = os.path.join(args.input_dir, 'how-to.jsonl')
    output_file = os.path.join(args.output_dir, 'how-to.jsonl')
    if os.path.exists(input_file):
        processed = process_how_to_file(input_file, output_file)
        logger.info(f"Processed {processed} entries in {os.path.basename(input_file)}")
        total_processed += processed
    

    logger.info(f"Total processed entries: {total_processed}")
    logger.info(f"Processed dataset saved to {args.output_dir}")

if __name__ == "__main__":
    main()