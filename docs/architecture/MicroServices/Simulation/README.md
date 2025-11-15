# Simulation Microservice

> **Multi-modal sales training simulations with AI-powered feedback**

## 📖 Documentation

This microservice provides comprehensive simulation capabilities including text
chat, voice/video calls, media processing, transcription, and automated feedback
generation.

**Start here**: [📑 Documentation Index (INDEX.md)](./INDEX.md)

---

## 📚 Quick Links

| Document                                                   | Description                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [INDEX.md](./INDEX.md)                                     | **Main navigation hub** - Start here for organized access to all documentation |
| [SIMULATION_ARCHITECTURE.md](./SIMULATION_ARCHITECTURE.md) | Complete architectural specification with 19 sequence flows                    |
| [figures/](./figures/)                                     | All Mermaid sequence diagrams organized by category                            |
| [architecture.mmd](./architecture.mmd)                     | Detailed component architecture diagram                                        |
| [prisma.schema.md](./prisma.schema.md)                     | Database schema documentation (27 models)                                      |

---

## 🎯 What This Microservice Does

### Core Capabilities

1. **Session Orchestration** - Manage multi-turn conversations (text, voice,
   video)
2. **AI Chat** - LLM-powered responses with RAG over company knowledge
3. **Voice/Video** - WebRTC calls with STT, TTS, and recording
4. **Media Processing** - Upload and transcribe real sales call recordings
5. **Feedback Engine** - Automated scoring with coaching recommendations
6. **Analytics** - Benchmarks, leaderboards, and performance tracking

### Key Technologies

- **NestJS** - Microservice framework
- **PostgreSQL + pgvector** - Database with vector search
- **OpenAI GPT-4o** - Language model
- **Whisper/Azure** - Speech-to-text
- **ElevenLabs** - Text-to-speech
- **RabbitMQ** - Event bus
- **MinIO/S3** - Media storage

---

## 🚦 Current Status

**Architecture**: ✅ Complete (27 models, 19 flows, 6 phases planned)
**Implementation**: ⚠️ Not Started

This microservice is fully architected with:

- ✅ Complete database schema (Prisma)
- ✅ Comprehensive architectural documentation
- ✅ 19 detailed sequence diagrams
- ✅ Component architecture diagrams
- ✅ 6-phase implementation roadmap

---

## 🚀 Getting Started

### For Developers

1. Read the [INDEX.md](./INDEX.md) for organized navigation
2. Review [SIMULATION_ARCHITECTURE.md](./SIMULATION_ARCHITECTURE.md) for
   detailed architecture
3. Study sequence diagrams in [figures/](./figures/) for specific flows
4. Check [CLAUDE.md](../../../../CLAUDE.md) for architectural patterns
5. Start with Phase 1 implementation (Core Orchestration)

### For Architects

1. Review the component architecture: [architecture.mmd](./architecture.mmd)
2. Understand data models: [prisma.schema.md](./prisma.schema.md)
3. Study key flows: [figures/](./figures/)
4. Compare with User Management service (reference implementation)

### For Product Managers

1. Read the feature overview in
   [SIMULATION_ARCHITECTURE.md](./SIMULATION_ARCHITECTURE.md#features)
2. Review the implementation roadmap (6 phases)
3. Check sequence flows to understand user experiences

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    API Gateway                          │
│  (Authentication, Validation, Routing)                  │
└────────────────┬────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┬────────────────┐
    │            │            │                │
    ▼            ▼            ▼                ▼
┌────────┐  ┌────────┐  ┌─────────┐    ┌──────────┐
│Session │  │  Call  │  │Ingestion│    │ Feedback │
│Gateway │  │Gateway │  │ Gateway │    │ Gateway  │
└───┬────┘  └───┬────┘  └────┬────┘    └────┬─────┘
    │           │             │              │
    ▼           ▼             ▼              ▼
┌────────────────────────────────────────────────────┐
│              Application Services                  │
│  (Orchestration, LLM, WebRTC, Transcription,      │
│   Enrichment, Feedback, Scoring)                  │
└────────────────┬───────────────────────────────────┘
                 │
    ┌────────────┼────────────┬──────────────┐
    │            │            │              │
    ▼            ▼            ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│PostgreSQL│ │ pgvector │ │  Redis   │ │ RabbitMQ │
│   (DB)   │ │  (RAG)   │ │ (Cache)  │ │  (Bus)   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

---

## 📁 File Structure

```
simulation/
├── README.md                      ← You are here
├── INDEX.md                       ← 📑 Start here for documentation
├── SIMULATION_ARCHITECTURE.md     ← Complete architectural specification
├── architecture.mmd               ← Component architecture diagram
├── prisma.schema.md              ← Database schema documentation
└── figures/                       ← Mermaid sequence diagrams
    ├── README.md                  ← Diagram index and viewing guide
    ├── component-architecture.mmd ← High-level component diagram
    ├── session-flows.mmd          ← Session management flows
    ├── tool-flows.mmd             ← Tool invocation flows
    ├── call-flows.mmd             ← Voice/video call flows
    ├── media-flows.mmd            ← Media upload and transcription
    ├── feedback-flows.mmd         ← Scoring and feedback
    ├── report-flows.mmd           ← Report generation
    └── technical-flows.mmd        ← Advanced technical flows
```

---

## 🔗 Related Documentation

- **Project Guidelines**: [CLAUDE.md](../../../../CLAUDE.md)
- **Development Guide**: [DEVELOPER_GUIDE.md](../../../../DEVELOPER_GUIDE.md)
- **Reference Implementation**: [User Management Service](../User/)

---

## 📝 Next Steps

1. **Review Architecture** → Read [INDEX.md](./INDEX.md) and
   [SIMULATION_ARCHITECTURE.md](./SIMULATION_ARCHITECTURE.md)
2. **Understand Flows** → Study diagrams in [figures/](./figures/)
3. **Setup Database** → Run Prisma migrations (see implementation guide)
4. **Start Phase 1** → Implement core orchestration (session lifecycle)

---

**For detailed documentation navigation, see [INDEX.md](./INDEX.md)** 📑
