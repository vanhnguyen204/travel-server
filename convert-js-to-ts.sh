#!/bin/bash

# Function to rename JavaScript files to TypeScript
rename_js_to_ts() {
  for file in "$1"/*.js; do
    if [ -e "$file" ]; then
      new_file="${file%.js}.ts"
      mv "$file" "$new_file"
      echo "Renamed $file to $new_file"
    fi
  done

  # Recursively process subdirectories, excluding node_modules
  for dir in "$1"/*; do
    if [ -d "$dir" ] && [ "${dir##*/}" != "node_modules" ]; then
      rename_js_to_ts "$dir"
    fi
  done
}

# Check if a directory is provided as an argument
if [ -z "$1" ]; then
  echo "Usage: $0 <directory>"
  exit 1
fi

# Check if the provided path is a directory
if [ ! -d "$1" ]; then
  echo "Error: '$1' is not a directory."
  exit 1
fi

# Call the function to rename files
rename_js_to_ts "$1"