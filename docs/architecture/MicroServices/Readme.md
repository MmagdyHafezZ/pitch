Quick mapping to your feature list

- Account Settings / User-plans → Identity & Plans ~ Magdy

- Manage Dashboard / Statistics → Analytics ~ Omar

- Cross teams help / Contact external help / Guide Tutorial → Hub, Helpdesk,
  Guides aka support ~ masroor

- Text chat AI / Multi-turn → Orchestrator + Text Chat AI -> Voice/Video
  communication / Video recordings → Voice/Video + Media Ingestion ~ Magdy ->
  feedback person → Feedback Engine ~ Magdy

- Scenario generator engine → Scenario Service ~ Abdelrahman

- CRM / Client Persons → CRM Connector + People Graph ~ Abdlerahman

- Email/Message drafting → Message Drafting ~ Aser

- Multi language support → Translation ~ Aser

- Upload real calls → Media Ingestion ~ Youssef

- LTI → LTI Advantage ~ Youssef

Notes on Datastores (why Postgres vs Mongo)

Postgres: identities, plans, scorecards, scenarios, LTI keys—data with strong
relations/transactions.

MongoDB: CRM copies, transcripts, threads—flexible, large/variable documents.

Redis: sessions, rate limits, in-progress sim state.

pgvector (in Postgres): RAG embeddings to keep stack simple.
