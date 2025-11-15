# Project Scripts

This directory contains utility scripts for the PITCH project.

## Mermaid to PNG Converter

Convert Mermaid diagram files (`.mmd`) to PNG images for documentation and
presentations.

### Quick Start

```bash
# Install mermaid-cli globally (one-time setup)
npm install -g @mermaid-js/mermaid-cli

# Convert Simulation microservice diagrams
pnpm run diagrams:simulation

# Or use the bash wrapper directly
./scripts/convert-mermaid.sh --simulation
```

### Available Scripts

#### NPM Scripts (Recommended)

```bash
# Convert specific microservice diagrams
pnpm run diagrams:simulation  # Simulation microservice
pnpm run diagrams:user         # User Management microservice
pnpm run diagrams:support      # Support microservice
pnpm run diagrams:all          # All microservices

# Custom conversion with Node.js script
pnpm run diagrams:convert -- -i ./path/to/diagrams -o ./path/to/output
```

#### Direct Script Usage

**Bash Wrapper** (Recommended for most users):

```bash
# Basic usage
./scripts/convert-mermaid.sh -i <input-dir> -o <output-dir>

# With custom settings
./scripts/convert-mermaid.sh -i ./docs/figures -o ./docs/figures/png -s 3 -b white

# Using presets
./scripts/convert-mermaid.sh --simulation
./scripts/convert-mermaid.sh --user
./scripts/convert-mermaid.sh --support

# Show help
./scripts/convert-mermaid.sh --help
```

**Node.js Script** (Advanced usage):

```bash
# Basic usage
node scripts/mermaid-to-png.js -i <input-dir> -o <output-dir>

# With config file
node scripts/mermaid-to-png.js -c mermaid-config.json

# Custom options
node scripts/mermaid-to-png.js -i ./diagrams -o ./png -s 2 -b transparent

# Show help
node scripts/mermaid-to-png.js --help
```

### Configuration

#### Config File

Create a `mermaid-config.json` file (see `scripts/mermaid-config.example.json`):

```json
{
  "inputDir": "./docs/architecture/MicroServices/Simulation/figures",
  "outputDir": "./docs/architecture/MicroServices/Simulation/figures/png",
  "scale": 2,
  "background": "transparent",
  "verbose": true
}
```

Then use it:

```bash
node scripts/mermaid-to-png.js -c mermaid-config.json
```

#### Theme Configuration

The global Mermaid theme is configured in `.mermaidrc` at the project root. This
ensures consistent styling across all diagrams.

### Options

| Option                     | Description                           | Default           |
| -------------------------- | ------------------------------------- | ----------------- |
| `-i, --input <dir>`        | Input directory containing .mmd files | Current directory |
| `-o, --output <dir>`       | Output directory for PNG files        | `<input>/png`     |
| `-s, --scale <number>`     | Scale factor for output (1-4)         | `2`               |
| `-b, --background <color>` | Background color or "transparent"     | `transparent`     |
| `-c, --config <file>`      | Path to config file                   | None              |
| `-h, --help`               | Show help message                     | -                 |

### Features

✅ **Multi-diagram Support** - Automatically splits files containing multiple
diagrams (separated by YAML frontmatter)

✅ **Smart Naming** - Creates descriptive filenames from diagram titles

- `session-flows-figure-82-start-simulation-session.png`
- `feedback-flows-figure-810-generate-scorecard-with-rubric.png`

✅ **High Quality** - 2x scale by default for crisp rendering on all displays

✅ **Transparent Backgrounds** - Works on any background color

✅ **Batch Processing** - Convert entire directories in one command

✅ **Error Handling** - Gracefully handles conversion errors and provides clear
feedback

### Examples

#### Convert Current Directory

```bash
cd docs/architecture/MicroServices/Simulation/figures
node ../../../../../../scripts/mermaid-to-png.js
```

#### Convert with Custom Output

```bash
node scripts/mermaid-to-png.js \
  -i ./docs/diagrams \
  -o ./public/images/diagrams \
  -s 3 \
  -b white
```

#### Convert Multiple Directories

```bash
# Using NPM script
pnpm run diagrams:all

# Or manually
./scripts/convert-mermaid.sh --simulation
./scripts/convert-mermaid.sh --user
./scripts/convert-mermaid.sh --support
```

#### Use with CI/CD

```yaml
# .github/workflows/diagrams.yml
- name: Convert Mermaid Diagrams
  run: |
    npm install -g @mermaid-js/mermaid-cli
    pnpm run diagrams:all
```

### Troubleshooting

#### `mmdc: command not found`

Install mermaid-cli globally:

```bash
npm install -g @mermaid-js/mermaid-cli
```

#### `Error: Parse error on line X`

The Mermaid diagram has syntax errors. Validate it at
[Mermaid Live Editor](https://mermaid.live/).

#### Conversion Fails Silently

Check that:

1. The input file is valid Mermaid syntax
2. You have write permissions to the output directory
3. The `mmdc` command is in your PATH

#### PNG Quality Issues

Increase the scale factor:

```bash
./scripts/convert-mermaid.sh -i ./diagrams -s 3  # Higher quality
```

### File Structure

```
scripts/
├── README.md                    # This file
├── mermaid-to-png.js           # Node.js conversion script
├── convert-mermaid.sh          # Bash wrapper script
└── mermaid-config.example.json # Example configuration
```

### How It Works

1. **Scans** the input directory for `.mmd` files
2. **Extracts** individual diagrams from multi-diagram files
3. **Cleans** YAML frontmatter and normalizes content
4. **Converts** each diagram using `mmdc` (mermaid-cli)
5. **Outputs** PNG files with descriptive names
6. **Cleans up** temporary files

### Performance

- **Speed**: ~1-2 seconds per diagram (depending on complexity)
- **Memory**: ~50-100 MB per diagram
- **Disk**: Output PNGs are typically 50-250 KB each

### Contributing

When adding new diagrams:

1. Create `.mmd` files following the project theme (see `.mermaidrc`)
2. Use YAML frontmatter for multi-diagram files:
   ```mermaid
   ---
   title: "Figure X - Diagram Title"
   ---
   sequenceDiagram
       ...
   ```
3. Run the converter to generate PNGs
4. Commit both `.mmd` and `.png` files

---

## Other Scripts

### `secrets_allow.py`

Python script for managing allowed secrets in the codebase.

```bash
pnpm run secrets:allow
```

---

For more information, see the [main README](../README.md).
