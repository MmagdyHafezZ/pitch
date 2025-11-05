# CRM Microservice

## Overview
The CRM Microservice manages all customer relationship operations within the system. It handles contact and company management, deal pipelines, activities, tasks, notes, and reporting.
- API Gateways for entry routing and authentication.
- Controllers for handling HTTP requests and validation.
- Services for encapsulating business logic.
- Repositories for data persistence.
- Tables for underlying database storage.

## Features
1. Contact & Company Management
- Create, update, and delete contacts or companies.
- Associate contacts with companies.
- Manage relationships via ContactCompany cross-references.
2. Deal & Pipeline Management
- Create and update deals tied to companies or contacts.
- Support for multiple pipelines and stages per organization.
- Automated stage tracking for deal progression.
3. Activities & Tasks
- Log calls, meetings, and emails as activities.
- Assign tasks to users or teams.
- Track completion and upcoming deadlines.
4. Notes
- Add and edit notes related to contacts, deals, or companies.
- Full-text search support for note contents.
5. Email Integration
- Inbound and outbound synchronization with IMAP or third-party APIs.
- Threaded email storage (EmailThread / EmailMessage tables).
- Mapping to related CRM entities (contact, deal, or company).
6. Webhooks
- Inbound webhooks for third-party CRM updates.
- Outbound webhooks for notifying other systems on entity changes.
- Payload signing and replay prevention for security.
7. Reporting
- Aggregated insights for deals, pipelines, and user activity.
- Supports both ad-hoc and scheduled report generation.