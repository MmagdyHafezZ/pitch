# CRM Microservice

## Overview

The CRM Microservice manages customer relationship operations and external CRM
integrations within the system. It provides a unified interface for connecting
to third-party CRM platforms (currently Salesforce, with HubSpot planned) and
accessing their data in real-time.

## Architecture Pattern

The CRM microservice follows the same architectural pattern as other
microservices in the Pitch application:

```
HTTP Request → API Gateway Controller → RabbitMQ Message → CRM Controller → Service Layer → External API/Database
```

### Components

- **API Gateway Controllers**: Handle HTTP requests and validation (in
  `apps/api/src/gateway/controllers/crm/`)
- **CRM Controllers**: Listen for RabbitMQ messages (in
  `apps/api/src/microservices/crm/controllers/`)
- **Services**: Encapsulate business logic and external API interactions
- **Repositories**: Data persistence layer (if needed)
- **Prisma Schema**: Database models and migrations

## Features

### 1. Salesforce Integration

- **OAuth 2.0 Authentication**: Secure authorization flow with automatic token
  refresh
- **Real-time Data Access**: Fetch contacts, accounts, opportunities, and leads
  directly from Salesforce
- **Custom Queries**: Execute custom SOQL (Salesforce Object Query Language)
  queries
- **Search**: Perform SOSL (Salesforce Object Search Language) searches
- **Token Management**: Stores OAuth tokens securely in PostgreSQL database

### 2. Integration Management

- **Connection Status**: Track integration status (CONNECTED, DISCONNECTED,
  ERROR, EXPIRED)
- **Multiple Providers**: Designed to support multiple CRM providers per user
- **Automatic Token Refresh**: Handles expired access tokens automatically using
  refresh tokens

## Database Schema

The CRM microservice uses a dedicated PostgreSQL database (`pitch_crm`) with the
following models:

### Integration Model

```prisma
model Integration {
  id               String              @id @default(cuid())
  userId           String
  provider         IntegrationProvider // SALESFORCE, HUBSPOT
  status           IntegrationStatus   @default(CONNECTED)

  // OAuth tokens
  accessToken      String?
  refreshToken     String?
  expiresAt        DateTime?
  instanceUrl      String?             // Salesforce instance URL

  // Provider-specific data
  providerId       String?
  providerEmail    String?
  providerData     Json?

  // Metadata
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  @@unique([userId, provider])
}
```

## API Endpoints

All endpoints are exposed through the API Gateway at `/api/crm/salesforce/`:

### Connection Management

- `GET /connect` - Get Salesforce OAuth authorization URL
- `GET /callback` - OAuth callback handler (called by Salesforce)
- `GET /status` - Get connection status
- `DELETE /disconnect` - Disconnect integration

### Data Access

- `GET /contacts` - Fetch contacts from Salesforce
- `GET /accounts` - Fetch accounts from Salesforce
- `GET /opportunities` - Fetch opportunities from Salesforce
- `GET /leads` - Fetch leads from Salesforce

### Custom Operations

- `POST /query` - Execute custom SOQL query
- `POST /search` - Perform SOSL search

## Message Patterns

The CRM microservice communicates via RabbitMQ using these patterns:

```typescript
{
  SALESFORCE_CONNECT: 'salesforce.connect',
  SALESFORCE_CALLBACK: 'salesforce.callback',
  SALESFORCE_GET_STATUS: 'salesforce.getStatus',
  SALESFORCE_GET_CONTACTS: 'salesforce.getContacts',
  SALESFORCE_GET_ACCOUNTS: 'salesforce.getAccounts',
  SALESFORCE_GET_OPPORTUNITIES: 'salesforce.getOpportunities',
  SALESFORCE_GET_LEADS: 'salesforce.getLeads',
  SALESFORCE_QUERY: 'salesforce.query',
  SALESFORCE_SEARCH: 'salesforce.search',
  SALESFORCE_DISCONNECT: 'salesforce.disconnect',
}
```

## Environment Variables

Required environment variables in `.env`:

```bash
# CRM Database
CRM_DATABASE_URL=postgresql://pitch_user:pitch_admin@localhost:5437/pitch_crm

# Salesforce Configuration
SALESFORCE_CLIENT_ID=your_consumer_key
SALESFORCE_CLIENT_SECRET=your_consumer_secret
SALESFORCE_REDIRECT_URI=http://localhost:8000/api/crm/salesforce/callback
```

## Development Setup

### 1. Start Database

```bash
docker compose up -d postgres-crm
```

### 2. Run Migrations

```bash
cd apps/api
npx prisma migrate deploy --schema=./src/microservices/crm/prisma/schema.prisma
```

### 3. Generate Prisma Client

```bash
pnpm db:generate:crm
```

### 4. Start Server

```bash
pnpm dev
```

### 5. View Database (Optional)

```bash
pnpm db:studio:crm
# Opens at http://localhost:5555
```

## Salesforce Setup

### Create Connected App

1. Login to Salesforce (or create free developer account at
   https://developer.salesforce.com/signup)
2. Go to Setup → App Manager → New Connected App
3. Configure:
   - **Name**: Pitch CRM Integration
   - **Enable OAuth Settings**: Checked
   - **Callback URL**: `http://localhost:8000/api/crm/salesforce/callback`
   - **Selected OAuth Scopes**: `api`, `refresh_token`, `id`
   - **Require Proof Key for Code Exchange (PKCE)**: Unchecked
4. Save and copy the Consumer Key and Consumer Secret to your `.env` file

### OAuth Settings

After saving, edit policies:

- **Permitted Users**: All users may self-authorize
- **IP Relaxation**: Relax IP restrictions
- **Refresh Token Policy**: Refresh token is valid until revoked

## Testing

### Using Swagger UI

1. Open http://localhost:8000/docs
2. Navigate to "Salesforce CRM Integration" section
3. Test endpoints:
   - `GET /connect` with `userId: test-user` → Returns authorization URL
   - Open URL in browser → Login and authorize
   - `GET /status` → Check connection status
   - `GET /contacts` → Fetch contacts from Salesforce

### Using curl

```bash
# Get authorization URL
curl -X GET "http://localhost:8000/api/crm/salesforce/connect?userId=test-user"

# After authorization, check status
curl -X GET "http://localhost:8000/api/crm/salesforce/status?userId=test-user"

# Fetch contacts
curl -X GET "http://localhost:8000/api/crm/salesforce/contacts?userId=test-user&limit=10"
```

## Future Enhancements

- HubSpot integration
- Custom field mapping
- Webhook support for real-time updates
- Bulk data operations
- Advanced filtering and pagination
- Integration health monitoring

## Related Documentation

- [User Management Microservice](../UserManagement/architecture.md)
- [Microservices Architecture](../Readme.md)
- [API Gateway Documentation](../../../../apps/api/docs/architecture/README.md)
