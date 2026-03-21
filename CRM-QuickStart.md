# Quick Start Guide - Salesforce Integration

## Overview

This guide will help you quickly set up and test the Salesforce integration in
the Pitch application.

## Prerequisites

- Docker and Docker Compose
- Node.js and pnpm
- Salesforce account (free at https://developer.salesforce.com/signup)

## Setup (3 Steps)

### 1. Setup Salesforce Connected App

Follow the detailed instructions in `SALESFORCE_QUICK_START.md` to:

- Create a Connected App in Salesforce
- Get your Consumer Key and Consumer Secret
- Configure OAuth settings

### 2. Configure Environment

Add to `.env` in project root:

```bash
SALESFORCE_CLIENT_ID=your_consumer_key
SALESFORCE_CLIENT_SECRET=your_consumer_secret
SALESFORCE_REDIRECT_URI=http://localhost:8000/api/crm/salesforce/callback
```

### 3. Setup Database and Start Server

```bash
# Start database
docker compose up -d postgres-crm
sleep 5

# Run migrations
cd apps/api
npx prisma migrate deploy --schema=./src/microservices/crm/prisma/schema.prisma

# Generate Prisma client
cd ../..
pnpm db:generate:crm

# Start server
pnpm dev
```

## Test the Integration

### Using Swagger UI

1. Open http://localhost:8000/docs
2. Navigate to "Salesforce CRM Integration" section
3. Test in this order:
   - `GET /connect` → Get authorization URL
   - Open URL in browser → Login and authorize
   - `GET /status` → Verify connection
   - `GET /contacts` → Fetch data from Salesforce

### View Database

```bash
pnpm db:studio:crm
```

Opens Prisma Studio at http://localhost:5555 to view stored OAuth tokens.

## What Gets Stored?

Only OAuth tokens are stored locally in PostgreSQL:

- Access token (for API calls)
- Refresh token (for automatic renewal)
- Token expiration time
- Salesforce instance URL

All contact, account, and opportunity data is fetched in real-time from
Salesforce.

## Available Endpoints

- `GET /api/crm/salesforce/connect` - Get OAuth URL
- `GET /api/crm/salesforce/status` - Connection status
- `GET /api/crm/salesforce/contacts` - Fetch contacts
- `GET /api/crm/salesforce/accounts` - Fetch accounts
- `GET /api/crm/salesforce/opportunities` - Fetch opportunities
- `GET /api/crm/salesforce/leads` - Fetch leads
- `POST /api/crm/salesforce/query` - Custom SOQL query
- `POST /api/crm/salesforce/search` - SOSL search
- `DELETE /api/crm/salesforce/disconnect` - Disconnect

## Troubleshooting

### Database table not found

```bash
cd apps/api
npx prisma migrate deploy --schema=./src/microservices/crm/prisma/schema.prisma
cd ../..
pnpm db:generate:crm
```

### Redirect URI mismatch

Ensure callback URL in Salesforce matches:
`http://localhost:8000/api/crm/salesforce/callback`

### OAuth Error 1800

In Salesforce Connected App:
