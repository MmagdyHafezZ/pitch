#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const MICROSERVICES_DIR = '/Users/magdyhafez/Personal/PITCH/docs/architecture/MicroServices'
const OUTPUT_FILE = path.join(MICROSERVICES_DIR, 'overall-architecture.mmd')

function findArchitectureFiles() {
  const files = []
  const dirs = fs.readdirSync(MICROSERVICES_DIR, { withFileTypes: true })

  for (const dir of dirs) {
    if (dir.isDirectory()) {
      const archFile = path.join(MICROSERVICES_DIR, dir.name, 'architecture.mmd')
      if (fs.existsSync(archFile)) {
        files.push({
          service: dir.name,
          path: archFile,
        })
      }
    }
  }

  return files
}

function extractServiceDefinition(content, serviceName) {
  const lines = content.split('\n')
  const result = {
    theme: '',
    content: [],
    rawContent: '',
  }

  // Extract theme configuration
  const themeStart = lines.findIndex((line) => line.includes('%%{init:'))
  const themeEnd = lines.findIndex((line) => line.includes('}}}%%'))
  if (themeStart >= 0 && themeEnd >= 0) {
    result.theme = lines.slice(themeStart, themeEnd + 1).join('\n')
  }

  // Extract flowchart content (everything after flowchart declaration)
  const flowchartStart = lines.findIndex((line) => line.includes('flowchart'))
  if (flowchartStart >= 0) {
    const flowchartContent = lines.slice(flowchartStart + 1)

    // Store the raw content for detailed inclusion
    result.rawContent = flowchartContent.join('\n')

    // Process each line and store with proper indentation and namespacing
    for (const line of flowchartContent) {
      if (line.trim()) {
        let processedLine = line

        // Namespace common conflicting elements to avoid duplicates
        processedLine = processedLine.replace(/\bRedis\[/g, `${serviceName}Redis[`)
        processedLine = processedLine.replace(/\bRabbitMQ\[/g, `${serviceName}RabbitMQ[`)
        processedLine = processedLine.replace(/\bAPI\[/g, `${serviceName}API[`)
        processedLine = processedLine.replace(/\bCTRL\[/g, `${serviceName}CTRL[`)
        processedLine = processedLine.replace(/\bSVC\[/g, `${serviceName}SVC[`)
        processedLine = processedLine.replace(/\bREPO\[/g, `${serviceName}REPO[`)
        processedLine = processedLine.replace(/\bTable\[/g, `${serviceName}Table[`)
        processedLine = processedLine.replace(/\bDB\[/g, `${serviceName}DB[`)

        // Namespace subgraph declarations
        processedLine = processedLine.replace(/subgraph API\[/g, `subgraph ${serviceName}API[`)
        processedLine = processedLine.replace(/subgraph CTRL\[/g, `subgraph ${serviceName}CTRL[`)
        processedLine = processedLine.replace(/subgraph SVC\[/g, `subgraph ${serviceName}SVC[`)
        processedLine = processedLine.replace(/subgraph REPO\[/g, `subgraph ${serviceName}REPO[`)
        processedLine = processedLine.replace(/subgraph Table\[/g, `subgraph ${serviceName}Table[`)
        processedLine = processedLine.replace(/subgraph DB\[/g, `subgraph ${serviceName}DB[`)

        // Add extra indentation for inclusion in overall subgraph
        result.content.push('        ' + processedLine)
      } else {
        result.content.push('')
      }
    }
  }

  return result
}

function generateOverallArchitecture() {
  const architectureFiles = findArchitectureFiles()
  console.log(`Found ${architectureFiles.length} microservices with architecture files:`)
  architectureFiles.forEach((file) => console.log(`  - ${file.service}`))

  const services = {}
  let commonTheme = ''

  // Parse each service's architecture
  for (const file of architectureFiles) {
    const content = fs.readFileSync(file.path, 'utf8')
    services[file.service] = extractServiceDefinition(content, file.service)

    // Use the first theme found as the common theme
    if (!commonTheme && services[file.service].theme) {
      commonTheme = services[file.service].theme
    }
  }

  // Generate the overall architecture
  let output = ''

  // Add theme
  if (commonTheme) {
    output += commonTheme + '\n'
  }

  output += 'flowchart TB\n'
  output += '    %% Overall Microservices Architecture\n\n'

  // Create main microservices subgraph
  output += '    subgraph PitchPlatform["PITCH Platform - Microservices Architecture"]\n\n'

  // Add each microservice as a subgraph with detailed content
  for (const [serviceName, serviceData] of Object.entries(services)) {
    output += `        %% ${serviceName} Microservice\n`
    output += `        subgraph ${serviceName}MS["${serviceName} Microservice"]\n`

    // Include the detailed architecture content from the original file
    if (serviceData.content && serviceData.content.length > 0) {
      output += serviceData.content.join('\n') + '\n'
    } else {
      // Fallback to simplified representation if no detailed content
      output += `            ${serviceName}API["${serviceName}<br/>API Gateway"]\n`
      output += `            ${serviceName}Logic["${serviceName}<br/>Business Logic"]\n`
      output += `            ${serviceName}Data["${serviceName}<br/>Data Layer"]\n`
      output += `            ${serviceName}API --> ${serviceName}Logic\n`
      output += `            ${serviceName}Logic --> ${serviceName}Data\n`
    }

    output += `        end\n\n`
  }

  output += '    end\n\n'

  // Add shared infrastructure
  output += '    %% Shared Infrastructure\n'
  output += '    subgraph SharedInfra["Shared Infrastructure"]\n'
  output += '        Redis[(Redis Cache Cluster)]\n'
  output += '        RabbitMQ[(RabbitMQ Event Bus)]\n'
  output += '        Postgres[(PostgreSQL Database)]\n'
  output += '        Mongo[(MongoDB Database)]\n'
  output += '        S3[(S3 Storage)]\n'
  output += '        Logger[(Centralized Logging)]\n'
  output += '    end\n\n'

  // Add external services
  output += '    %% External Services\n'
  output += '    subgraph External["External Services"]\n'
  output += '        LTI[LTI Platform]\n'
  output += '        STTAPI[(Speech-to-Text API)]\n'
  output += '        TTSAPI[(Text-to-Speech API)]\n'
  output += '        LLMAPI[(LLM API)]\n'
  output += '    end\n\n'

  // Add inter-service connections to shared infrastructure
  output += '    %% Shared Infrastructure Connections\n'
  const serviceList = Object.keys(services)
  for (const service of serviceList) {
    // Connect each service to shared infrastructure
    output += `    ${service}MS -.-> Redis\n`
    output += `    ${service}MS -.-> RabbitMQ\n`
    output += `    ${service}MS -.-> Logger\n`
  }

  output += '\n    %% Database and Storage Connections\n'
  for (const service of serviceList) {
    // Service-specific database connections
    if (service === 'Simulation') {
      output += `    ${service}MS --> Postgres\n`
      output += `    ${service}MS --> Mongo\n`
      output += `    ${service}MS --> S3\n`
    } else if (service === 'S3-Manager') {
      output += `    ${service}MS --> S3\n`
    } else if (service === 'UserManagement') {
      output += `    ${service}MS --> Postgres\n`
    } else if (service === 'Support') {
      output += `    ${service}MS --> Postgres\n`
    } else if (service === 'Analytics') {
      output += `    ${service}MS --> Postgres\n`
      output += `    ${service}MS --> Mongo\n`
    } else if (service === 'LTI-Advantage') {
      output += `    ${service}MS --> External\n`
    }
  }

  // Add event-driven communication
  output += '\n    %% Event-Driven Communication\n'
  output += '    SimulationMS -.->|simulation.* events| RabbitMQ\n'
  output += '    SupportMS -.->|support.* events| RabbitMQ\n'
  output += '    UserManagementMS -.->|user.* events| RabbitMQ\n'
  output += '    AnalyticsMS -.->|analytics.* events| RabbitMQ\n'

  // Add external API connections
  output += '\n    %% External API Connections\n'
  output += '    SimulationMS -.-> STTAPI\n'
  output += '    SimulationMS -.-> TTSAPI\n'
  output += '    SimulationMS -.-> LLMAPI\n'
  output += '    LTI-AdvantageMS -.-> LTI\n'

  return output
}

function main() {
  try {
    console.log('🔄 Compiling microservice architectures...\n')

    const overallArchitecture = generateOverallArchitecture()

    fs.writeFileSync(OUTPUT_FILE, overallArchitecture)

    console.log(`\n✅ Overall architecture compiled successfully!`)
    console.log(`📄 Output file: ${OUTPUT_FILE}`)
    console.log('\n📋 To view the diagram:')
    console.log('   1. Open the file in a Mermaid-compatible viewer')
    console.log('   2. Use VS Code with Mermaid extension')
    console.log('   3. Use online Mermaid editor at https://mermaid.live')
  } catch (error) {
    console.error('❌ Error compiling architectures:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { generateOverallArchitecture, findArchitectureFiles }
