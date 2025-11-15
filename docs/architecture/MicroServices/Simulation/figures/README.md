# Simulation Microservice - Sequence Diagrams

This directory contains all Mermaid sequence diagrams for the Simulation
Microservice architecture flows.

## 🖼️ Pre-rendered PNG Images

All diagrams have been pre-rendered as high-quality PNG images for easy viewing.
**Browse them in the [png/](./png/) folder**.

### Quick Links to PNGs

**Architecture Diagrams:**

- [Architecture Overview](./png/architecture.png) - Main system architecture
- [Component Architecture (Figure 8.1)](./png/component-architecture.png) -
  Detailed component diagram
- [Documentation Map](./png/documentation-map.png) - Documentation structure

**Sequence Diagrams:** All 19 figures are available with descriptive filenames:

- Session Management:
  [8.2](./png/session-flows-figure-82-start-simulation-session.png),
  [8.3](./png/session-flows-figure-83-advance-turn-text-chat.png),
  [8.7](./png/session-flows-figure-87-end-simulation-session.png)
- Tool Integration: [8.4](./png/tool-flows-figure-84-tool-call-draft-email.png)
- Voice/Video: [8.5](./png/call-flows-figure-85-start-voicevideo-call.png),
  [8.6](./png/call-flows-figure-86-process-real-time-speech-stt.png)
- Media Processing:
  [8.8](./png/media-flows-figure-88-upload-real-call-recording.png),
  [8.9](./png/media-flows-figure-89-process-uploaded-recording-transcription.png)
- Feedback:
  [8.10](./png/feedback-flows-figure-810-generate-scorecard-with-rubric.png),
  [8.11](./png/feedback-flows-figure-811-retrieve-scorecard-details.png),
  [8.12](./png/feedback-flows-figure-812-create-or-update-rubric.png)
- Reporting: [8.14](./png/report-flows-figure-814-generate-pdf-report.png)
- Technical: [8.13](./png/technical-flows-figure-813-semantic-search-rag.png),
  [8.15](./png/technical-flows-figure-815-detect-and-redact-pii.png),
  [8.16](./png/technical-flows-figure-816-voice-activity-detection-vad.png),
  [8.17](./png/technical-flows-figure-817-handle-multi-speaker-diarization.png),
  [8.18](./png/technical-flows-figure-818-benchmark-tracking-and-leaderboards.png),
  [8.19](./png/technical-flows-figure-819-stream-llm-response-with-sse.png)

---

## Mermaid Source Files (.mmd)

The source files below contain the Mermaid diagram code. Each file may contain
multiple diagrams.

### [session-flows.mmd](./session-flows.mmd)

Session lifecycle and turn management flows:

- **Figure 8.2**: Start Simulation Session
- **Figure 8.3**: Advance Turn - Text Chat
- **Figure 8.7**: End Simulation Session

### [tool-flows.mmd](./tool-flows.mmd)

Tool invocation and integration flows:

- **Figure 8.4**: Tool Call - Draft Email

### [call-flows.mmd](./call-flows.mmd)

Voice and video call management flows:

- **Figure 8.5**: Start Voice/Video Call
- **Figure 8.6**: Process Real-Time Speech (STT)

### [media-flows.mmd](./media-flows.mmd)

Media upload and transcription flows:

- **Figure 8.8**: Upload Real Call Recording
- **Figure 8.9**: Process Uploaded Recording (Transcription)

### [feedback-flows.mmd](./feedback-flows.mmd)

Scoring and feedback generation flows:

- **Figure 8.10**: Generate Scorecard with Rubric
- **Figure 8.11**: Retrieve Scorecard Details
- **Figure 8.12**: Create or Update Rubric

### [report-flows.mmd](./report-flows.mmd)

Report generation flows:

- **Figure 8.14**: Generate PDF Report

### [technical-flows.mmd](./technical-flows.mmd)

Advanced technical implementation flows:

- **Figure 8.13**: Semantic Search (RAG)
- **Figure 8.15**: Detect and Redact PII
- **Figure 8.16**: Voice Activity Detection (VAD)
- **Figure 8.17**: Handle Multi-Speaker Diarization
- **Figure 8.18**: Benchmark Tracking and Leaderboards
- **Figure 8.19**: Stream LLM Response with SSE

## Viewing the Diagrams

### 🖼️ Pre-rendered PNG Images (Recommended)

All diagrams are available as high-quality PNG images in the **[png/](./png/)**
folder. Simply open them in any image viewer or web browser.

### Editing Mermaid Source Files

If you want to view or edit the source `.mmd` files:

#### Online

- [Mermaid Live Editor](https://mermaid.live/) - Interactive editor and
  previewer
- GitHub's built-in Mermaid rendering (in markdown files)

#### VS Code Extensions

- **Markdown Preview Mermaid Support** by Matt Bierner
- **Mermaid Markdown Syntax Highlighting** by Bpruitt-goddard

#### Command Line

Install the Mermaid CLI tool:

```bash
npm install -g @mermaid-js/mermaid-cli
```

Generate PNG/SVG from diagrams:

```bash
mmdc -i session-flows.mmd -o output.png -b transparent -s 2
```

**Note**: All PNG files in the [png/](./png/) folder were generated using this
tool.

## Diagram Conventions

All diagrams use consistent color theming:

- **Primary (Blue)**: Main flow components (controllers, services)
- **Secondary (Orange)**: External services and APIs
- **Tertiary (Purple)**: Data stores and repositories
- **Notes (Yellow)**: Important annotations and explanations

### Participants

- **Gateways**: API entry points (Session Gateway, Call Gateway, etc.)
- **Controllers**: Request handlers (Session Controller, Turn Controller, etc.)
- **Services**: Business logic (Orchestrator Service, LLM Service, etc.)
- **Repositories**: Data access layer (Session Repository, Message Repository,
  etc.)
- **External**: Third-party services (Whisper API, ElevenLabs, etc.)

### Flow Patterns

- **Solid arrows** (`->>`, `-->>`) : Synchronous calls and responses
- **Notes**: Contextual information and decision points
- **Alt/Opt blocks**: Conditional logic and error handling
- **Loops**: Iterative processes

## Integration with Main Documentation

These diagrams are referenced in
[SIMULATION_ARCHITECTURE.md](../SIMULATION_ARCHITECTURE.md) and provide visual
representations of the sequence flows described in the architectural
documentation.
