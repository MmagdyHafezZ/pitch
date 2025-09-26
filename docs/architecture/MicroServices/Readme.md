Quick mapping to your feature list

Account Settings / User-plans → Identity & Plans

Manage Dashboard / Statistics → Analytics

Text chat AI / Multi-turn → Orchestrator + Text Chat AI

Feedback person → Feedback Engine

Voice/Video communication / Video recordings → Voice/Video + Media Ingestion

Scenario generator engine → Scenario Service

CRM / Client Persons → CRM Connector + People Graph

Email/Message drafting → Message Drafting

Multi language support → Translation

Upload real calls → Media Ingestion

Cross teams help / Contact external help / Guide Tutorial → Hub, Helpdesk,
Guides

LTI → LTI Advantage

Notes on Datastores (why Postgres vs Mongo)

Postgres: identities, plans, scorecards, scenarios, LTI keys—data with strong
relations/transactions.

MongoDB: CRM copies, transcripts, threads—flexible, large/variable documents.

Redis: sessions, rate limits, in-progress sim state.

pgvector (in Postgres): RAG embeddings to keep stack simple.
