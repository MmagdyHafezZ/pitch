# Microservices Architecture Compiler

This tool automatically compiles individual microservice architecture diagrams
into a comprehensive overall architecture diagram.

## Overview

The PITCH platform consists of multiple microservices, each with their own
`architecture.mmd` file. This tool:

1. Scans all microservice directories for `architecture.mmd` files
2. Extracts and processes the architecture definitions
3. Generates a unified `overall-architecture.mmd` diagram showing all
   microservices and their relationships

## Current Microservices

- **Analytics** - Data analytics and reporting
- **LTI-Advantage** - Learning Tools Interoperability integration
- **S3-Manager** - File storage management
- **Simulation** - Core simulation engine
- **Support** - Customer support and documentation
- **UserManagement** - User authentication and management (if exists)

## Usage

### Quick Start

```bash
# Run the compilation script
node compile-architecture.js

# Or use npm script
npm run compile
```

### Watch Mode (if nodemon is installed)

```bash
npm run compile:watch
```

## Output

The script generates `overall-architecture.mmd` which includes:

- **Microservices**: Each service represented as a subgraph with API, Logic, and
  Data layers
- **Shared Infrastructure**: Redis, RabbitMQ, PostgreSQL, MongoDB, S3,
  Centralized Logging
- **External Services**: LTI Platform, Speech APIs, LLM APIs
- **Inter-service Communication**: Event-driven messaging and direct connections
- **Data Flow**: Database and storage connections

## Viewing the Diagram

1. **VS Code**: Install the Mermaid extension and open
   `overall-architecture.mmd`
2. **Online Editor**: Copy content to [mermaid.live](https://mermaid.live)
3. **Command Line**: Use mermaid-cli if installed:
   ```bash
   mmdc -i overall-architecture.mmd -o overall-architecture.png
   ```

## Customization

### Adding New Microservices

1. Create a new microservice directory
2. Add an `architecture.mmd` file following the existing pattern
3. Run the compilation script - it will automatically detect and include the new
   service

### Modifying the Overall Architecture

Edit `compile-architecture.js` to:

- Change the visual representation of services
- Add new shared infrastructure components
- Modify inter-service connection patterns
- Update external service integrations

## File Structure

```
MicroServices/
├── Analytics/
│   └── architecture.mmd
├── LTI-Advantage/
│   └── architecture.mmd
├── S3-Manager/
│   └── architecture.mmd
├── Simulation/
│   └── architecture.mmd
├── Support/
│   └── architecture.mmd
├── compile-architecture.js        # Main compilation script
├── package.json                  # NPM configuration
├── overall-architecture.mmd       # Generated output
├── ARCHITECTURE_COMPILER.md       # This documentation
└── README.md                     # Feature mapping documentation
```

## Development

The script is written in Node.js and uses only built-in modules for maximum
compatibility. No external dependencies are required for basic functionality.

### Script Functions

- `findArchitectureFiles()` - Discovers all architecture.mmd files
- `extractServiceDefinition()` - Parses individual service architectures
- `generateOverallArchitecture()` - Creates the unified diagram

## Contributing

When adding new microservices or modifying existing ones:

1. Follow the established Mermaid diagram patterns
2. Use consistent naming conventions
3. Update this documentation if new infrastructure components are added
4. Test the compilation script after changes
