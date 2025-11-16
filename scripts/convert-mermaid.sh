#!/bin/bash

# Mermaid to PNG Converter - Bash Wrapper
#
# This script provides a convenient wrapper around the Node.js mermaid-to-png converter
# with support for common use cases and configuration presets.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32/
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
INPUT_DIR=""
OUTPUT_DIR=""
SCALE=2
BACKGROUND="transparent"
CONFIG_FILE=""

# Function to print colored output
print_color() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Function to show usage
show_usage() {
    cat << EOF
$(print_color $BLUE "Mermaid to PNG Converter")

Convert all Mermaid (.mmd) files in a directory to PNG images.

$(print_color $YELLOW "USAGE:")
    $0 [OPTIONS]

$(print_color $YELLOW "OPTIONS:")
    -i, --input DIR       Input directory containing .mmd files
    -o, --output DIR      Output directory for PNG files (default: <input>/png)
    -s, --scale NUMBER    Scale factor for output (default: 2)
    -b, --background      Background color (default: transparent)
    -c, --config FILE     Path to config file
    -h, --help            Show this help message

$(print_color $YELLOW "COMMON PRESETS:")
    --simulation          Convert Simulation microservice diagrams
    --user                Convert User Management microservice diagrams
    --support             Convert Support microservice diagrams

$(print_color $YELLOW "EXAMPLES:")
    # Convert files in current directory
    $0 -i ./diagrams -o ./diagrams/png

    # Convert with custom scale
    $0 -i ./docs/figures -s 3

    # Convert Simulation microservice diagrams
    $0 --simulation

    # Convert with white background
    $0 -i ./diagrams -b white

    # Use config file
    $0 -c ./mermaid-config.json

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--input)
            INPUT_DIR="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -s|--scale)
            SCALE="$2"
            shift 2
            ;;
        -b|--background)
            BACKGROUND="$2"
            shift 2
            ;;
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        --simulation)
            INPUT_DIR="$PROJECT_ROOT/docs/architecture/MicroServices/Simulation/figures"
            OUTPUT_DIR="$PROJECT_ROOT/docs/architecture/MicroServices/Simulation/figures/png"
            shift
            ;;
        --user)
            INPUT_DIR="$PROJECT_ROOT/docs/architecture/MicroServices/User/figures"
            OUTPUT_DIR="$PROJECT_ROOT/docs/architecture/MicroServices/User/figures/png"
            shift
            ;;
        --support)
            INPUT_DIR="$PROJECT_ROOT/docs/architecture/MicroServices/Support/figures"
            OUTPUT_DIR="$PROJECT_ROOT/docs/architecture/MicroServices/Support/figures/png"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_color $RED "Error: Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate input directory
if [ -z "$INPUT_DIR" ]; then
    print_color $RED "Error: Input directory not specified"
    print_color $YELLOW "Use -i or --input to specify the input directory"
    echo ""
    show_usage
    exit 1
fi

if [ ! -d "$INPUT_DIR" ]; then
    print_color $RED "Error: Input directory does not exist: $INPUT_DIR"
    exit 1
fi

# Set default output directory if not specified
if [ -z "$OUTPUT_DIR" ]; then
    OUTPUT_DIR="$INPUT_DIR/png"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_color $RED "Error: Node.js is not installed"
    echo "Please install Node.js: https://nodejs.org/"
    exit 1
fi

# Check if mmdc is installed
if ! command -v mmdc &> /dev/null; then
    print_color $RED "Error: mermaid-cli (mmdc) is not installed"
    echo ""
    print_color $YELLOW "Install it with:"
    echo "  npm install -g @mermaid-js/mermaid-cli"
    echo ""
    exit 1
fi

# Build the command
CMD="node \"$SCRIPT_DIR/mermaid-to-png.js\" -i \"$INPUT_DIR\" -o \"$OUTPUT_DIR\" -s $SCALE -b $BACKGROUND"

if [ -n "$CONFIG_FILE" ]; then
    CMD="$CMD -c \"$CONFIG_FILE\""
fi

# Execute the conversion
print_color $BLUE "Starting conversion..."
echo ""

eval $CMD

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    print_color $GREEN "✓ Conversion completed successfully!"
else
    print_color $RED "✗ Conversion failed with exit code: $EXIT_CODE"
    exit $EXIT_CODE
fi

exit 0
