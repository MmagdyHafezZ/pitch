# PITCH Platform - Microservices Architecture

Welcome to the PITCH Platform microservices architecture documentation. This
directory contains the complete architectural blueprints for our distributed
system.

## 🏗️ Architecture Diagrams

### 📊 Overall Architecture Views

- **[📋 Detailed Architecture](./overall-architecture.mmd)** - Complete view
  with all microservice internals, data flows, and infrastructure
- **[🔍 Simple Architecture](./simple-overall-architecture.mmd)** - High-level
  overview with clean service organization

### 🔧 Individual Microservice Architectures

| Service              | Owner   | Purpose                                                                               | Architecture                                   |
| -------------------- | ------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **🔬 Simulation**    | Magdy   | Core simulation engine, AI chat, voice/video communication, media ingestion, feedback | [📄 Details](./Simulation/architecture.mmd)    |
| **📈 Analytics**     | Omar    | Dashboard, statistics, data analysis & reporting                                      | [📄 Details](./Analytics/architecture.mmd)     |
| **📡 LTI-Advantage** | Youssef | Learning Tools Interoperability integration                                           | [📄 Details](./LTI-Advantage/architecture.mmd) |
| **🗄️ S3-Manager**    | -       | File storage management and operations                                                | [📄 Details](./S3-Manager/architecture.mmd)    |
| **💬 Support**       | Masroor | Help desk, guides, documentation, contact support                                     | [📄 Details](./Support/architecture.mmd)       |

## 🏗️ Infrastructure Overview

### Shared Components

- **🔴 Redis Cache Cluster** - Shared caching layer for all services
- **🐰 RabbitMQ Event Bus** - Centralized message broker for inter-service
  communication
- **🐘 PostgreSQL** - Primary relational database
- **🍃 MongoDB** - Document storage for unstructured data
- **☁️ S3 Storage** - Object storage for files and media
- **📝 Centralized Logging** - Platform-wide logging and monitoring

### External Integrations

- **🎓 LTI Platform** - Learning Management System integration
- **🎤 Speech-to-Text APIs** - Whisper/Azure STT
- **🔊 Text-to-Speech APIs** - ElevenLabs/Azure TTS
- **🤖 LLM APIs** - Large Language Model services

## 🔄 Automated Architecture Compilation

The architecture diagrams are automatically compiled and updated on every
commit. See [Automated Compilation Guide](./AUTOMATED_COMPILATION.md) for
details.

### Quick Commands

```bash
# Compile architectures manually
npm run compile:architecture

# Watch for changes (if nodemon installed)
npm run compile:watch
```

## 📋 Feature Mapping

Quick mapping of platform features to microservices:

| Feature                       | Microservice     | Owner       |
| ----------------------------- | ---------------- | ----------- |
| Account Settings / User Plans | Identity & Plans | Magdy       |
| Dashboard / Statistics        | Analytics        | Omar        |
| Help / Contact / Guides       | Support          | Masroor     |
| AI Chat / Voice/Video         | Simulation       | Magdy       |
| Feedback Engine               | Simulation       | Magdy       |
| Scenario Generator            | Scenario Service | Abdelrahman |
| CRM / People Graph            | CRM Connector    | Abdelrahman |
| Message Drafting              | Message Drafting | Aser        |
| Multi-language Support        | Translation      | Aser        |
| Media Upload                  | Media Ingestion  | Youssef     |
| LTI Integration               | LTI-Advantage    | Youssef     |

## 🛠️ Development

### Adding New Microservices

1. Create directory: `docs/architecture/MicroServices/YourService/`
2. Add: `docs/architecture/MicroServices/YourService/architecture.mmd`
3. Follow existing patterns and conventions
4. Commit changes - overall architecture updates automatically

### Tools & Utilities

- **[🔧 Architecture Compiler](./compile-architecture.js)** - Main compilation
  script
- **[📚 Compiler Documentation](./ARCHITECTURE_COMPILER.md)** - Detailed usage
  guide
- **[⚙️ Automation Guide](./AUTOMATED_COMPILATION.md)** - Git hooks and CI
  integration

## 📖 Documentation

- **[Architecture Compiler Guide](./ARCHITECTURE_COMPILER.md)** - How to use the
  compilation tools
- **[Automated Compilation](./AUTOMATED_COMPILATION.md)** - Git hooks and
  automation setup

## 🎯 Viewing Architecture Diagrams

1. **VS Code**: Install Mermaid extension and open `.mmd` files
2. **Online**: Copy content to [mermaid.live](https://mermaid.live)
3. **CLI**: Use `mmdc` if mermaid-cli is installed

---

_This architecture documentation is automatically maintained and updated on
every commit._
