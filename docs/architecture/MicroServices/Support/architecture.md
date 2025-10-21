# 🧩 Support Microservice — P.I.T.C.H. Platform

## Overview

The **Support Microservice** is part of the **P.I.T.C.H. (Performance Intelligence Training & Coaching Hub)** ecosystem.  
It provides centralized access to FAQs, tutorials, documentation, AI-powered chat support, release notes, and direct communication tools for users and internal teams.

This service ensures users have 24/7 access to learning materials, help resources, and intelligent AI assistance, while also allowing automated meeting requests and support escalation when needed.

---

## 🎯 Core Responsibilities

| Feature | Description |
|----------|-------------|
| **FAQ** | Curated, searchable knowledge base of common questions. |
| **Documentation** | Technical and user-facing documentation. |
| **Contact Support** | Submit issues, feature requests, or escalation tickets. |
| **AI Support ChatBot** | Real-time AI assistant for instant user help. |
| **Release Notes** | Display product updates and version changes. |
| **Email Request** | Send emails to internal team members to request meetings. |

---

## 🧱 Architecture Overview

The Support Microservice follows a **layered microservice architecture**, adhering to IBM’s modular design patterns:

- **API Gateways** – Entry points for client applications.
- **Controllers** – Handle request/response cycles and validation.
- **Services** – Contain core business logic.
- **Repositories** – Data persistence layer.
- **Tables** – Underlying database schema representations.
- **Shared Infrastructure** – Redis cache, RabbitMQ event bus, centralized logging.


### Sequence Diagrams:
- AI CHAT
- Email Notifications
- FAQ Management
- Ticket Creation
- Release Notes


## Support Microservice — End-to-End Sequence Flow

This sequence diagram illustrates the full interaction flow within the **Support Microservice (Masroor)**, showing how a user request traverses through the architecture layers — from the API Gateway down to the repository layer and shared infrastructure.

It also demonstrates asynchronous communication with the **AI Engine**, **Notification Queue**, and shared services like **Redis**, **RabbitMQ**, and **Centralized Logging**.

```mermaid
sequenceDiagram
    autonumber

    participant U as User
    participant GW as API Gateway (FAQ / Docs / Contact / Chat / Release / Email)
    participant CTRL as Controller Layer
    participant SVC as Service Layer
    participant REPO as Repository Layer
    participant DB as PostgreSQL Tables
    participant AI as AI Engine
    participant Q as Notification Queue / SMTP
    participant C as Redis Cache Cluster
    participant BUS as RabbitMQ Event Bus
    participant LOG as Centralized Logger

    Note over U,LOG: Example Flow — Fetch FAQ or Trigger Support Action

    U->>GW: HTTP Request (e.g. GET /support/faq or POST /support/email)
    GW->>CTRL: Forward Request to Matching Controller
    CTRL->>SVC: Validate and Transform Request
    SVC->>C: Check Redis Cache (if cached data available)
    alt Cache Hit
        C-->>SVC: Return Cached Response
    else Cache Miss
        SVC->>REPO: Query Repository
        REPO->>DB: Execute SQL on Corresponding Table
        DB-->>REPO: Return Results
        REPO-->>SVC: Data Retrieved
        SVC->>C: Update Cache
    end

    alt FAQ or Docs Request
        SVC-->>CTRL: Return Fetched Content
    else ChatBot Request
        SVC->>AI: Send Message to AI Engine
        AI-->>SVC: AI Response with Confidence
        SVC->>DB: Store Chat Interaction Log
        SVC->>BUS: Publish ChatLog Event (async)
    else Release Notes
        SVC->>C: Check Cached GitHub Releases
        C-->>SVC: Miss → Fetch from GitHub API
        SVC->>DB: Optionally Store Metadata
    else Email / Meeting Request
        SVC->>Q: Send Email via Notification Queue
        Q-->>SVC: Status (SENT/FAILED)
        SVC->>DB: Log Email Activity
    end

    SVC->>LOG: Log Transaction and Status
    LOG-->>SVC: Logged OK

    SVC-->>CTRL: Response Ready
    CTRL-->>GW: Format HTTP Response
    GW-->>U: Return Final Response (JSON / 200 OK)

    Note over GW,DB: RabbitMQ handles async events like email delivery confirmations or chatbot analytics updates


---
## 🔄 Data Flow Summary

User interacts through the Support UI → routed via API Gateway.

Controllers handle input validation and mapping.

Services apply business logic (AI query, DB fetch, or email trigger).

Repositories read/write to the appropriate database tables.

Redis caches popular FAQs and tutorials.

RabbitMQ handles async tasks like notifications and logging.

Email Request Service integrates with SMTP / Mail APIs to schedule meetings.

## 🧠 Scalability & Reliability

Horizontally scalable service pods.

Shared caching (Redis) for low-latency reads.

Async message bus for high availability (RabbitMQ).

Centralized monitoring and logging.

Graceful fallbacks when AI endpoints fail.

## 🧰 Future Enhancements

Integration with Slack / MS Teams for instant meeting scheduling.

Personalized FAQ recommendations using ML.

Multi-language support for global teams.

API usage analytics dashboards.