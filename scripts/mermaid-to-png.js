#!/usr/bin/env node

/**
 * Mermaid to PNG Converter
 *
 * Converts all .mmd (Mermaid) files in a directory to PNG images.
 * Supports multi-diagram files by splitting them and converting individually.
 *
 * Usage:
 *   node scripts/mermaid-to-png.js [options]
 *
 * Options:
 *   -i, --input <dir>      Input directory containing .mmd files (default: current directory)
 *   -o, --output <dir>     Output directory for PNG files (default: ./png)
 *   -s, --scale <number>   Scale factor for output (default: 2)
 *   -b, --background       Background color (default: transparent)
 *   -c, --config <file>    Path to config file (default: mermaid-config.json)
 *   -h, --help             Show help
 *
 * Example:
 *   node scripts/mermaid-to-png.js -i ./docs/diagrams -o ./docs/diagrams/png -s 2
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Parse command line arguments
const args = process.argv.slice(2)
const config = {
  inputDir: process.cwd(),
  outputDir: path.join(process.cwd(), 'png'),
  scale: 2,
  background: 'transparent',
  configFile: null,
  verbose: true,
}

// Parse arguments
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '-i':
    case '--input':
      config.inputDir = path.resolve(args[++i])
      break
    case '-o':
    case '--output':
      config.outputDir = path.resolve(args[++i])
      break
    case '-s':
    case '--scale':
      config.scale = parseInt(args[++i], 10)
      break
    case '-b':
    case '--background':
      config.background = args[++i]
      break
    case '-c':
    case '--config':
      config.configFile = path.resolve(args[++i])
      break
    case '-h':
    case '--help':
      console.log(`
Mermaid to PNG Converter

Usage:
  node scripts/mermaid-to-png.js [options]

Options:
  -i, --input <dir>      Input directory containing .mmd files (default: current directory)
  -o, --output <dir>     Output directory for PNG files (default: ./png)
  -s, --scale <number>   Scale factor for output (default: 2)
  -b, --background       Background color (default: transparent)
  -c, --config <file>    Path to config file
  -h, --help             Show this help message

Examples:
  # Convert all .mmd files in current directory
  node scripts/mermaid-to-png.js

  # Convert files from specific directory
  node scripts/mermaid-to-png.js -i ./docs/diagrams -o ./docs/diagrams/png

  # Use custom scale and background
  node scripts/mermaid-to-png.js -i ./diagrams -s 3 -b white

  # Use config file
  node scripts/mermaid-to-png.js -c ./mermaid-config.json
      `)
      process.exit(0)
  }
}

// Load config file if specified
if (config.configFile && fs.existsSync(config.configFile)) {
  const fileConfig = JSON.parse(fs.readFileSync(config.configFile, 'utf8'))
  Object.assign(config, fileConfig)
}

// Validate mmdc is installed
try {
  execSync('which mmdc', { stdio: 'ignore' })
} catch (error) {
  console.error('❌ Error: mermaid-cli (mmdc) not found.')
  console.error('Install it with: npm install -g @mermaid-js/mermaid-cli')
  process.exit(1)
}

// Create output directory if it doesn't exist
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true })
  console.log(`✓ Created output directory: ${config.outputDir}`)
}

/**
 * Extract individual diagrams from a multi-diagram .mmd file
 */
function extractDiagrams(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')

  // Split by the pattern: ---\ntitle: "..."\n---
  const parts = content.split(/\n---\ntitle:/)

  // Extract theme config (should be at the start)
  const themeConfig = parts[0].split('\n---\n')[0] || parts[0]

  const diagrams = []

  // Process first diagram if it exists
  if (parts[0].includes('\n---\n')) {
    const firstParts = parts[0].split('\n---\ntitle:')
    if (firstParts.length > 1) {
      const titleAndDiagram = 'title:' + firstParts[1]
      const match = titleAndDiagram.match(/title:\s*"([^"]+)"\n---\n(.+)/s)
      if (match) {
        diagrams.push({
          title: match[1],
          content: themeConfig + '\n\n' + match[2].trim(),
        })
      }
    }
  }

  // Process remaining diagrams
  for (let i = 1; i < parts.length; i++) {
    const match = parts[i].match(/\s*"([^"]+)"\n---\n(.+?)(?=\n---\ntitle:|$)/s)
    if (match) {
      diagrams.push({
        title: match[1],
        content: themeConfig + '\n\n' + match[2].trim(),
      })
    }
  }

  // If no multi-diagram pattern found, treat as single diagram
  if (diagrams.length === 0) {
    // Remove any YAML frontmatter
    const cleanContent = content.replace(/---\ntitle:.*?\n---\n/s, '')
    diagrams.push({
      title: null,
      content: cleanContent.trim(),
    })
  }

  return diagrams
}

/**
 * Create a clean filename from title
 */
function createFilename(baseName, title, index, totalDiagrams) {
  if (!title && totalDiagrams === 1) {
    return `${baseName}.mmd`
  }

  if (!title) {
    return `${baseName}-${index}.mmd`
  }

  // Clean the title to create filename
  const cleanTitle = title
    .replace(/Figure\s+/gi, 'figure-')
    .replace(/[^\w\s-]/g, '')
    .replace(/[-\s]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '')

  return `${baseName}-${cleanTitle}.mmd`
}

/**
 * Convert a single .mmd file to PNG
 */
function convertFile(inputPath, outputPath) {
  try {
    const cmd = `mmdc -i "${inputPath}" -o "${outputPath}" -b ${config.background} -s ${config.scale}`
    execSync(cmd, { stdio: 'ignore' })

    const stats = fs.statSync(outputPath)
    const sizeKB = (stats.size / 1024).toFixed(1)
    return { success: true, size: sizeKB }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Process a single .mmd file
 */
function processFile(filePath) {
  const baseName = path.basename(filePath, '.mmd')
  const diagrams = extractDiagrams(filePath)

  console.log(`\nProcessing: ${path.basename(filePath)}`)
  console.log(`  Found ${diagrams.length} diagram(s)`)

  const results = []
  const tempDir = path.join(config.outputDir, '.temp')

  // Create temp directory for intermediate files
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  diagrams.forEach((diagram, index) => {
    const tempMmdFile = path.join(tempDir, `temp-${baseName}-${index}.mmd`)
    const outputFilename = createFilename(baseName, diagram.title, index + 1, diagrams.length)
    const outputPngPath = path.join(config.outputDir, outputFilename.replace('.mmd', '.png'))

    // Write cleaned diagram to temp file
    fs.writeFileSync(tempMmdFile, diagram.content)

    // Convert to PNG
    const title = diagram.title || `Diagram ${index + 1}`
    console.log(`  Converting: ${title}`)

    const result = convertFile(tempMmdFile, outputPngPath)

    if (result.success) {
      console.log(`    ✓ ${path.basename(outputPngPath)} (${result.size} KB)`)
      results.push({ success: true, file: path.basename(outputPngPath) })
    } else {
      console.log(`    ✗ Failed`)
      results.push({ success: false, file: path.basename(outputPngPath) })
    }

    // Clean up temp file
    fs.unlinkSync(tempMmdFile)
  })

  // Clean up temp directory if empty
  try {
    fs.rmdirSync(tempDir)
  } catch (e) {
    // Directory not empty or doesn't exist, ignore
  }

  return results
}

/**
 * Main conversion function
 */
function convertAll() {
  console.log('\n🔄 Mermaid to PNG Converter\n')
  console.log(`Input directory:  ${config.inputDir}`)
  console.log(`Output directory: ${config.outputDir}`)
  console.log(`Scale factor:     ${config.scale}x`)
  console.log(`Background:       ${config.background}`)
  console.log('')

  // Find all .mmd files
  const files = fs
    .readdirSync(config.inputDir)
    .filter((file) => file.endsWith('.mmd'))
    .map((file) => path.join(config.inputDir, file))

  if (files.length === 0) {
    console.log('❌ No .mmd files found in input directory')
    process.exit(1)
  }

  console.log(`Found ${files.length} .mmd file(s)\n`)
  console.log('─'.repeat(60))

  let totalSuccess = 0
  let totalFailed = 0

  files.forEach((file) => {
    const results = processFile(file)
    results.forEach((r) => {
      if (r.success) totalSuccess++
      else totalFailed++
    })
  })

  console.log('\n' + '─'.repeat(60))
  console.log('\n✓ Conversion complete!\n')
  console.log(`  Successfully converted: ${totalSuccess}`)
  if (totalFailed > 0) {
    console.log(`  Failed: ${totalFailed}`)
  }
  console.log(`\n  Output location: ${config.outputDir}`)
  console.log('')
}

// Run the converter
try {
  convertAll()
} catch (error) {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
}
