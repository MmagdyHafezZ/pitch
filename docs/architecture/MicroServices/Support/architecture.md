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