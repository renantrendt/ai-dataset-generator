#!/usr/bin/env python3
"""
Remove Parentheses Adjacent to Angle Brackets
------------------------------------------
This script removes parentheses when they are adjacent to angle brackets in JSONL files.
It specifically targets patterns like '(<' or '>)' and removes the parentheses.
"""

import json
import re
import os
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

def remove_adjacent_parentheses(text):
    """
    Remove parentheses when they are adjacent to angle brackets.
    
    Args:
        text (str): The text to process
        
    Returns:
        str: The processed text with adjacent parentheses removed
    """
    # Replace '(<' with '<' and '>)' with '>'
    text = re.sub(r'\(<', '<', text)
    text = re.sub(r'>\)', '>', text)
    
    return text

def process_file(input_file, output_file=None):
    """
    Process a JSONL file to remove parentheses adjacent to angle brackets.
    
    Args:
        input_file (str): Path to the input JSONL file
        output_file (str, optional): Path to the output JSONL file. If None, overwrites the input file.
        
    Returns:
        int: Number of lines processed
    """
    if output_file is None:
        output_file = input_file
    
    temp_file = f"{output_file}.temp"
    
    processed_count = 0
    changed_count = 0
    
    with open(input_file, 'r', encoding='utf-8') as f_in, open(temp_file, 'w', encoding='utf-8') as f_out:
        for line_num, line in enumerate(f_in, 1):
            try:
                data = json.loads(line)
                original_line = line
                
                # Process each message in the conversation
                if 'messages' in data:
                    for message in data['messages']:
                        if 'content' in message:
                            original_content = message['content']
                            processed_content = remove_adjacent_parentheses(original_content)
                            
                            if original_content != processed_content:
                                message['content'] = processed_content
                                changed_count += 1
                
                # Write the processed data
                f_out.write(json.dumps(data, ensure_ascii=False) + '\n')
                processed_count += 1
                
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing JSON on line {line_num}: {e}")
                # Write the original line if there's an error
                f_out.write(line)
    
    # Replace the original file with the processed file
    if os.path.exists(temp_file):
        os.replace(temp_file, output_file)
        logger.info(f"Processed {processed_count} lines in {input_file}")
        logger.info(f"Changed {changed_count} messages")
    
    return processed_count, changed_count

def main():
    parser = argparse.ArgumentParser(description='Remove parentheses adjacent to angle brackets in JSONL files')
    parser.add_argument('files', nargs='+', help='JSONL files to process')
    parser.add_argument('--output-dir', help='Output directory for processed files')
    
    args = parser.parse_args()
    
    total_processed = 0
    total_changed = 0
    
    for input_file in args.files:
        if args.output_dir:
            # Create the output directory if it doesn't exist
            os.makedirs(args.output_dir, exist_ok=True)
            
            # Get the filename from the input path
            filename = os.path.basename(input_file)
            
            # Create the output file path
            output_file = os.path.join(args.output_dir, filename)
        else:
            output_file = None
        
        logger.info(f"Processing {input_file}...")
        processed, changed = process_file(input_file, output_file)
        total_processed += processed
        total_changed += changed
    
    logger.info(f"Total processed: {total_processed} lines")
    logger.info(f"Total changed: {total_changed} messages")

if __name__ == "__main__":
    main()
