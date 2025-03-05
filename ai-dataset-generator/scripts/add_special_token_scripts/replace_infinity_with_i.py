#!/usr/bin/env python3
"""
Script to replace the infinity character (∞) with the letter 'i' in text files.

Usage:
    python replace_infinity_with_i.py <input_file> [<output_file>]
    
    If output_file is not provided, the input file will be modified in-place.
"""

import sys
import os

def replace_infinity_with_i(input_file, output_file=None):
    """Replace all occurrences of the infinity character (∞) with 'i'.
    
    Args:
        input_file (str): Path to the input file
        output_file (str, optional): Path to the output file. If None, input file will be modified in-place.
    
    Returns:
        int: Number of replacements made
    """
    # Read the input file
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file {input_file}: {e}")
        return 0
    
    # Count and replace the infinity character
    replacement_count = content.count('∞')
    new_content = content.replace('∞', 'i')
    
    # If no replacements were made, inform and exit
    if replacement_count == 0:
        print(f"No infinity characters (∞) found in {input_file}")
        return 0
    
    # Write to output file or overwrite input file
    try:
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Replaced {replacement_count} infinity characters in {input_file} and saved to {output_file}")
        else:
            with open(input_file, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Replaced {replacement_count} infinity characters in {input_file} (in-place)")
        
        return replacement_count
    except Exception as e:
        print(f"Error writing to file: {e}")
        return 0

def process_directory(directory_path, recursive=False):
    """Process all files in a directory.
    
    Args:
        directory_path (str): Path to the directory
        recursive (bool): Whether to process subdirectories recursively
        
    Returns:
        int: Total number of replacements made
    """
    total_replacements = 0
    
    for item in os.listdir(directory_path):
        item_path = os.path.join(directory_path, item)
        
        if os.path.isfile(item_path):
            # Skip binary files or non-text files
            try:
                with open(item_path, 'r', encoding='utf-8') as f:
                    f.read(1024)  # Try to read a bit of the file
                replacements = replace_infinity_with_i(item_path)
                total_replacements += replacements
            except UnicodeDecodeError:
                print(f"Skipping binary or non-UTF-8 file: {item_path}")
            except Exception as e:
                print(f"Error processing file {item_path}: {e}")
        
        elif recursive and os.path.isdir(item_path):
            # Process subdirectory recursively
            subdirectory_replacements = process_directory(item_path, recursive=True)
            total_replacements += subdirectory_replacements
    
    return total_replacements

def main():
    """Main function to handle command line arguments."""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  For a single file:")
        print("    python replace_infinity_with_i.py <input_file> [<output_file>]")
        print("  For a directory:")
        print("    python replace_infinity_with_i.py --dir <directory_path> [--recursive]")
        return
    
    # Process directory
    if sys.argv[1] == "--dir":
        if len(sys.argv) < 3:
            print("Error: Directory path is required with --dir option")
            return
        
        directory_path = sys.argv[2]
        recursive = "--recursive" in sys.argv
        
        if not os.path.isdir(directory_path):
            print(f"Error: {directory_path} is not a valid directory")
            return
        
        print(f"Processing directory: {directory_path} {'(recursively)' if recursive else ''}")
        total_replacements = process_directory(directory_path, recursive)
        print(f"Total replacements made: {total_replacements}")
    
    # Process single file
    else:
        input_file = sys.argv[1]
        output_file = sys.argv[2] if len(sys.argv) > 2 else None
        
        if not os.path.isfile(input_file):
            print(f"Error: {input_file} is not a valid file")
            return
        
        replace_infinity_with_i(input_file, output_file)

if __name__ == "__main__":
    main()
