#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const MICROSERVICES_DIR = '/Users/magdyhafez/Personal/PITCH/docs/architecture/MicroServices'
const OUTPUT_FILE = path.join(MICROSERVICES_DIR, 'overall-architecture.mmd')
const SIMPLE_OUTPUT_FILE = path.join(MICROSERVICES_DIR, 'simple-overall-architecture.mmd')

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
        // Note: Redis and RabbitMQ will use shared instances, so we redirect to shared names
        processedLine = processedLine.replace(/\bRedis\[/g, `SharedRedis[`)
        processedLine = processedLine.replace(/\bRabbitMQ\[/g, `SharedRabbitMQ[`)
        processedLine = processedLine.replace(/\bAPI\[/g, `${serviceName}API[`)
        processedLine = processedLine.replace(/\bCTRL\[/g, `${serviceName}CTRL[`)
        processedLine = processedLine.replace(/\bSVC\[/g, `${serviceName}SVC[`)
        processedLine = processedLine.replace(/\bREPO\[/g, `${serviceName}REPO[`)
        processedLine = processedLine.replace(/\bTable\[/g, `${serviceName}Table[`)
        processedLine = processedLine.replace(/\bDB\[/g, `${serviceName}DB[`)

        // Also handle Redis/RabbitMQ node definitions with different brackets
        processedLine = processedLine.replace(/\bRedis\[\(/g, `SharedRedis[(`)
        processedLine = processedLine.replace(/\bRabbitMQ\[\(/g, `SharedRabbitMQ[(`)

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

function generateOverallArchitecture(services) {
  // Generate the overall architecture
  let output = ''

  // Add improved theme with better colors and contrast
  output += `%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor':'#f8fafc',
  'primaryTextColor':'#1e293b',
  'primaryBorderColor':'#3b82f6',
  'lineColor':'#6366f1',
  'secondaryColor':'#f1f5f9',
  'secondaryTextColor':'#0f172a',
  'secondaryBorderColor':'#8b5cf6',
  'tertiaryColor':'#fef7ff',
  'tertiaryTextColor':'#581c87',
  'tertiaryBorderColor':'#a855f7',
  'background':'#ffffff',
  'mainBkg':'#f8fafc',
  'secondBkg':'#e2e8f0',
  'tertiaryBkg':'#f1f5f9',
  'noteBkgColor':'#fef3c7',
  'noteTextColor':'#92400e',
  'noteBorderColor':'#f59e0b'
}}}%%\n`

  output += 'flowchart LR\n'
  output += '    %% PITCH Platform - Overall Microservices Architecture\n'
  output += '    %% Organized for better readability and visual hierarchy\n\n'

  // Create main platform container
  output += '    subgraph PlatformCore["🎯 PITCH Platform Core"]\n'
  output += '        direction TB\n\n'

  // Group microservices by category for better organization
  output += '        %% Core Services Layer\n'
  output += '        subgraph CoreServices["📊 Core Services"]\n'
  output += '            direction LR\n'

  // Core business logic services
  const coreServices = ['Simulation', 'Analytics']
  for (const serviceName of coreServices) {
    if (services[serviceName]) {
      const serviceData = services[serviceName]
      output += `            subgraph ${serviceName}MS["🔬 ${serviceName}"]\n`
      output += '                direction TB\n'

      if (serviceData.content && serviceData.content.length > 0) {
        output += serviceData.content.join('\n') + '\n'
      } else {
        output += `                ${serviceName}API["API Gateway"]\n`
        output += `                ${serviceName}Logic["Business Logic"]\n`
        output += `                ${serviceName}Data["Data Layer"]\n`
        output += `                ${serviceName}API --> ${serviceName}Logic --> ${serviceName}Data\n`
      }
      output += `            end\n\n`
    }
  }
  output += '        end\n\n'

  // Integration services
  output += '        %% Integration Layer\n'
  output += '        subgraph IntegrationServices["🔗 Integration Services"]\n'
  output += '            direction LR\n'

  const integrationServices = ['LTI-Advantage', 'S3-Manager']
  for (const serviceName of integrationServices) {
    if (services[serviceName]) {
      const serviceData = services[serviceName]
      output += `            subgraph ${serviceName}MS["📡 ${serviceName}"]\n`
      output += '                direction TB\n'

      if (serviceData.content && serviceData.content.length > 0) {
        output += serviceData.content.join('\n') + '\n'
      } else {
        output += `                ${serviceName}API["API Gateway"]\n`
        output += `                ${serviceName}Logic["Business Logic"]\n`
        output += `                ${serviceName}Data["Data Layer"]\n`
        output += `                ${serviceName}API --> ${serviceName}Logic --> ${serviceName}Data\n`
      }
      output += `            end\n\n`
    }
  }
  output += '        end\n\n'

  // Support services
  output += '        %% Support Layer\n'
  output += '        subgraph SupportServices["🛠️ Support Services"]\n'
  output += '            direction LR\n'

  const supportServices = ['Support']
  for (const serviceName of supportServices) {
    if (services[serviceName]) {
      const serviceData = services[serviceName]
      output += `            subgraph ${serviceName}MS["💬 ${serviceName}"]\n`
      output += '                direction TB\n'

      if (serviceData.content && serviceData.content.length > 0) {
        output += serviceData.content.join('\n') + '\n'
      } else {
        output += `                ${serviceName}API["API Gateway"]\n`
        output += `                ${serviceName}Logic["Business Logic"]\n`
        output += `                ${serviceName}Data["Data Layer"]\n`
        output += `                ${serviceName}API --> ${serviceName}Logic --> ${serviceName}Data\n`
      }
      output += `            end\n\n`
    }
  }
  output += '        end\n\n'

  output += '    end\n\n'

  // Add shared infrastructure
  output += '    %% Shared Infrastructure\n'
  output += '    subgraph SharedInfra["Shared Infrastructure"]\n'
  output += '        SharedRedis[(Redis Cache Cluster)]\n'
  output += '        SharedRabbitMQ[(RabbitMQ Event Bus)]\n'
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
    output += `    ${service}MS -.-> SharedRedis\n`
    output += `    ${service}MS -.-> SharedRabbitMQ\n`
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
  output += '    SimulationMS -.->|simulation.* events| SharedRabbitMQ\n'
  output += '    SupportMS -.->|support.* events| SharedRabbitMQ\n'
  output += '    AnalyticsMS -.->|analytics.* events| SharedRabbitMQ\n'

  // Add inter-service communication through RabbitMQ
  output += '\n    %% Inter-Service Communication via RabbitMQ\n'
  output += '    SharedRabbitMQ -.->|event routing| SimulationMS\n'
  output += '    SharedRabbitMQ -.->|event routing| SupportMS\n'
  output += '    SharedRabbitMQ -.->|event routing| AnalyticsMS\n'
  if (serviceList.includes('LTI-Advantage')) {
    output += '    LTI-AdvantageMS -.->|lti.* events| SharedRabbitMQ\n'
    output += '    SharedRabbitMQ -.->|event routing| LTI-AdvantageMS\n'
  }
  if (serviceList.includes('S3-Manager')) {
    output += '    S3-ManagerMS -.->|storage.* events| SharedRabbitMQ\n'
    output += '    SharedRabbitMQ -.->|event routing| S3-ManagerMS\n'
  }

  // Add external API connections
  output += '\n    %% External API Connections\n'
  output += '    SimulationMS -.-> STTAPI\n'
  output += '    SimulationMS -.-> TTSAPI\n'
  output += '    SimulationMS -.-> LLMAPI\n'
  output += '    LTI-AdvantageMS -.-> LTI\n'

  return output
}

function generateSimpleArchitecture(services) {
  const serviceList = Object.keys(services)

  let output = `%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor':'#f8fafc',
  'primaryTextColor':'#1e293b',
  'primaryBorderColor':'#3b82f6',
  'lineColor':'#6366f1',
  'secondaryColor':'#f1f5f9',
  'secondaryTextColor':'#0f172a',
  'secondaryBorderColor':'#8b5cf6',
  'tertiaryColor':'#fef7ff',
  'tertiaryTextColor':'#581c87',
  'tertiaryBorderColor':'#a855f7',
  'background':'#ffffff',
  'mainBkg':'#f8fafc',
  'secondBkg':'#e2e8f0',
  'tertiaryBkg':'#f1f5f9',
  'noteBkgColor':'#fef3c7',
  'noteTextColor':'#92400e',
  'noteBorderColor':'#f59e0b'
}}}%%
flowchart TB
    %% PITCH Platform - Simplified Architecture Overview

    subgraph PitchPlatform["🎯 PITCH Platform - Simplified Overview"]
        direction TB

        %% Core Services
        subgraph CoreServices["📊 Core Services"]
            direction LR
            SimulationMS["🔬 Simulation<br/>Core Engine"]
            AnalyticsMS["📈 Analytics<br/>Data & Reporting"]
        end

        %% Integration Services
        subgraph IntegrationServices["🔗 Integration Services"]
            direction LR
            LTIAdvantageMS["📡 LTI-Advantage<br/>LMS Integration"]
            S3ManagerMS["🗄️ S3-Manager<br/>File Storage"]
        end

        %% Support Services
        subgraph SupportServices["🛠️ Support Services"]
            SupportMS["💬 Support<br/>Help & Documentation"]
        end

    end

    %% Shared Infrastructure
    subgraph SharedInfra["🏗️ Shared Infrastructure"]
        SharedRedis[("🔴 Redis<br/>Cache Cluster")]
        SharedRabbitMQ[("🐰 RabbitMQ<br/>Event Bus")]
        Postgres[("🐘 PostgreSQL<br/>Database")]
        Mongo[("🍃 MongoDB<br/>Document Store")]
        S3[("☁️ S3<br/>Object Storage")]
        Logger[("📝 Centralized<br/>Logging")]
    end

    %% External Services
    subgraph External["🌐 External Services"]
        LTIPlatform["🎓 LTI Platform"]
        STTService[("🎤 Speech-to-Text")]
        TTSService[("🔊 Text-to-Speech")]
        LLMService[("🤖 LLM API")]
    end

    %% Infrastructure Connections
    SimulationMS -.-> SharedRedis
    SimulationMS -.-> SharedRabbitMQ
    SimulationMS --> Postgres
    SimulationMS --> Mongo
    SimulationMS --> S3

    AnalyticsMS -.-> SharedRedis
    AnalyticsMS -.-> SharedRabbitMQ
    AnalyticsMS --> Postgres

    LTIAdvantageMS -.-> SharedRedis
    LTIAdvantageMS -.-> SharedRabbitMQ
    LTIAdvantageMS --> LTIPlatform

    S3ManagerMS -.-> SharedRedis
    S3ManagerMS -.-> SharedRabbitMQ
    S3ManagerMS --> S3

    SupportMS -.-> SharedRedis
    SupportMS -.-> SharedRabbitMQ
    SupportMS --> Postgres

    %% External API Connections
    SimulationMS -.-> STTService
    SimulationMS -.-> TTSService
    SimulationMS -.-> LLMService

    %% Event-Driven Communication
    SimulationMS -.->|"📡 simulation.*"| SharedRabbitMQ
    SupportMS -.->|"📡 support.*"| SharedRabbitMQ
    AnalyticsMS -.->|"📡 analytics.*"| SharedRabbitMQ
    LTIAdvantageMS -.->|"📡 lti.*"| SharedRabbitMQ
    S3ManagerMS -.->|"📡 storage.*"| SharedRabbitMQ

    %% Inter-Service Communication
    SharedRabbitMQ -.->|"📨 event routing"| SimulationMS
    SharedRabbitMQ -.->|"📨 event routing"| SupportMS
    SharedRabbitMQ -.->|"📨 event routing"| AnalyticsMS
    SharedRabbitMQ -.->|"📨 event routing"| LTIAdvantageMS
    SharedRabbitMQ -.->|"📨 event routing"| S3ManagerMS

    %% Shared Cache & Logging
    SimulationMS -.-> Logger
    AnalyticsMS -.-> Logger
    LTIAdvantageMS -.-> Logger
    S3ManagerMS -.-> Logger
    SupportMS -.-> Logger
`

  return output
}

function main() {
  try {
    console.log('🔄 Compiling microservice architectures...\n')

    // Generate detailed architecture
    const architectureFiles = findArchitectureFiles()
    console.log(`Found ${architectureFiles.length} microservices with architecture files:`)
    architectureFiles.forEach((file) => console.log(`  - ${file.service}`))

    const services = {}
    for (const file of architectureFiles) {
      const content = fs.readFileSync(file.path, 'utf8')
      services[file.service] = extractServiceDefinition(content, file.service)
    }

    const overallArchitecture = generateOverallArchitecture(services)
    const simpleArchitecture = generateSimpleArchitecture(services)

    fs.writeFileSync(OUTPUT_FILE, overallArchitecture)
    fs.writeFileSync(SIMPLE_OUTPUT_FILE, simpleArchitecture)

    console.log(`\n✅ Architecture compilation completed successfully!`)
    console.log(`📄 Detailed architecture: ${OUTPUT_FILE}`)
    console.log(`📄 Simple architecture: ${SIMPLE_OUTPUT_FILE}`)
    console.log('\n📋 To view the diagrams:')
    console.log('   1. Open files in a Mermaid-compatible viewer')
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
