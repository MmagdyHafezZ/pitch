# Salesforce Integration Architecture

## Overview

The Salesforce integration follows the same microservices architecture pattern
as the UserManagement microservice, using RabbitMQ for inter-service
communication.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Frontend (Next.js)                          │
│                     http://localhost:3000                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP Request
                             │ Authorization: Bearer <JWT>
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Gateway Service (Port 8000)                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │        SalesforceGatewayController                            │  │
│  │  - GET  /api/v1/integrations/salesforce/connect              │  │
│  │  - GET  /api/v1/integrations/salesforce/callback             │  │
│  │  - GET  /api/v1/integrations/salesforce/status               │  │
│  │  - GET  /api/v1/integrations/salesforce/contacts             │  │
│  │  - GET  /api/v1/integrations/salesforce/accounts             │  │
│  │  - POST /api/v1/integrations/salesforce/query                │  │
│  │  - DELETE /api/v1/integrations/salesforce/disconnect         │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
└────────────────────────────────┼────────────────────────────────────┘
                                 │
                                 │ RabbitMQ Message
                                 │ Queue: crm_queue
                                 │ Pattern: salesforce.*
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     CRM Microservice (RabbitMQ)                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │          SalesforceController (@MessagePattern)               │  │
│  │  - salesforce.connect                                         │  │
│  │  - salesforce.callback                                        │  │
│  │  - salesforce.getStatus                                       │  │
│  │  - salesforce.getContacts                                     │  │
│  │  - salesforce.getAccounts                                     │  │
│  │  - salesforce.query                                           │  │
│  │  - salesforce.disconnect                                      │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
│                               │                                      │
│                               ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │        SalesforceIntegrationService                           │  │
│  │  - getConnectUrl()                                            │  │
│  │  - handleCallback()                                           │  │
│  │  - getStatus()                                                │  │
│  │  - getContacts()                                              │  │
│  │  - getAccounts()                                              │  │
│  │  - query()                                                    │  │
│  │  - refreshTokenIfNeeded()                                     │  │
│  │  - disconnect()                                               │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
└────────────────────────────────┼────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│    PostgreSQL (CRM DB)       │  │    Salesforce API            │
│  ┌────────────────────────┐  │  │  - OAuth 2.0                 │
│  │  Integration Model     │  │  │  - REST API v58.0            │
│  │  - userId              │  │  │  - SOQL Queries              │
│  │  - provider            │  │  │  - SOSL Search               │
│  │  - accessToken         │  │  │                              │
│  │  - refreshToken        │  │  │  Objects:                    │
│  │  - expiresAt           │  │  │  - Contacts                  │
│  │  - instanceUrl         │  │  │  - Accounts                  │
│  │  - status              │  │  │  - Opportunities             │
│  └────────────────────────┘  │  │  - Leads                     │
└──────────────────────────────┘  └──────────────────────────────┘
```

## Data Flow

### 1. User Connects Salesforce

```
User clicks "Connect Salesforce"
    ↓
Frontend → GET /api/v1/integrations/salesforce/connect
    ↓
Gateway validates JWT token
    ↓
Gateway sends RabbitMQ message: salesforce.connect
    ↓
CRM Microservice receives message
    ↓
SalesforceIntegrationService.getConnectUrl()
    ↓
Returns OAuth URL to Gateway
    ↓
Gateway returns to Frontend
    ↓
Frontend redirects user to Salesforce
    ↓
User logs in and grants permissions
    ↓
Salesforce redirects to callback URL with code
    ↓
Gateway → GET /api/v1/integrations/salesforce/callback?code=xxx&state=userId
    ↓
Gateway sends RabbitMQ message: salesforce.callback
    ↓
CRM Microservice receives message
    ↓
SalesforceIntegrationService.handleCallback()
    ↓
Exchanges code for access_token & refresh_token
    ↓
Stores tokens in PostgreSQL (Integration table)
    ↓
Returns success
```

### 2. User Gets Salesforce Data

```
Frontend → GET /api/v1/integrations/salesforce/contacts
    ↓
Gateway validates JWT token
    ↓
Gateway sends RabbitMQ message: salesforce.getContacts
    ↓
CRM Microservice receives message
    ↓
SalesforceIntegrationService.getContacts()
    ↓
Gets Integration from PostgreSQL
    ↓
Checks if token expired
    ↓
If expired → refreshTokenIfNeeded()
    ↓
Makes request to Salesforce API with access_token
    ↓
Salesforce returns contacts
    ↓
Returns to Gateway
    ↓
Gateway returns to Frontend
```

## Message Patterns

### Shared Backend (`@pitch/shared-backend`)

```typescript
export const CRM_SERVICE_PATTERNS = {
  SALESFORCE_CONNECT: 'salesforce.connect',
  SALESFORCE_CALLBACK: 'salesforce.callback',
  SALESFORCE_GET_STATUS: 'salesforce.getStatus',
  SALESFORCE_GET_CONTACTS: 'salesforce.getContacts',
  SALESFORCE_GET_ACCOUNTS: 'salesforce.getAccounts',
  SALESFORCE_GET_OPPORTUNITIES: 'salesforce.getOpportunities',
  SALESFORCE_GET_LEADS: 'salesforce.getLeads',
  SALESFORCE_SYNC_CONTACTS: 'salesforce.syncContacts',
  SALESFORCE_QUERY: 'salesforce.query',
  SALESFORCE_SEARCH: 'salesforce.search',
  SALESFORCE_DISCONNECT: 'salesforce.disconnect',
}
```

## Components

### Gateway Layer

- **File**:
  `apps/api/src/gateway/controllers/crm/salesforce-gateway.controller.ts`
- **Responsibility**:
  - Receives HTTP requests
  - Validates JWT tokens
  - Forwards to CRM microservice via RabbitMQ
  - Returns responses to client
- **Pattern**: Same as `AuthGatewayController`

### CRM Microservice Layer

- **Controller**:
  `apps/api/src/microservices/crm/controllers/salesforce.controller.ts`
  - Receives RabbitMQ messages via `@MessagePattern`
  - Delegates to service layer
  - Pattern: Same as `AuthController`

- **Service**:
  `apps/api/src/microservices/crm/services/salesforce-integration.service.ts`
  - Business logic
  - OAuth token management
  - Salesforce API calls
  - Database operations

### Database Layer

- **Schema**: `apps/api/src/microservices/crm/prisma/schema.prisma`
- **Model**: `Integration`
  - Stores OAuth tokens
  - Tracks connection status
  - Manages sync settings

## Security

### Token Storage

- Access tokens stored in PostgreSQL
- Tokens should be encrypted at rest (TODO: implement encryption)
- Refresh tokens used for automatic renewal

### Token Refresh

- Automatic refresh before expiration (5-minute buffer)
- Handles expired tokens gracefully
- Updates status on refresh failure

### Authentication

- All endpoints (except callback) require JWT authentication
- JWT validated by Gateway
- UserId extracted from JWT claims

## Comparison with UserManagement

| Aspect                  | UserManagement          | Salesforce Integration         |
| ----------------------- | ----------------------- | ------------------------------ |
| Gateway Controller      | `AuthGatewayController` | `SalesforceGatewayController`  |
| Microservice Controller | `AuthController`        | `SalesforceController`         |
| Service                 | `AuthService`           | `SalesforceIntegrationService` |
| Queue                   | `user_queue`            | `crm_queue`                    |
| Message Patterns        | `USER_SERVICE_PATTERNS` | `CRM_SERVICE_PATTERNS`         |
| Database                | User DB                 | CRM DB                         |
| Pattern                 | ✅ Same                 | ✅ Same                        |

## File Structure

```
pitch/
├── packages/
│   └── shared-backend/
│       └── src/interfaces/
│           └── message-patterns.interface.ts    # CRM_SERVICE_PATTERNS
│
├── apps/api/src/
│   ├── gateway/
│   │   ├── controllers/crm/
│   │   │   └── salesforce-gateway.controller.ts # HTTP endpoints
│   │   └── gateway.module.ts                    # Register controller
│   │
│   └── microservices/crm/
│       ├── controllers/
│       │   └── salesforce.controller.ts         # @MessagePattern handlers
│       ├── services/
│       │   ├── prisma.service.ts                # Database client
│       │   └── salesforce-integration.service.ts # Business logic
│       ├── prisma/
│       │   └── schema.prisma                    # Integration model
│       └── crm.module.ts                        # Register providers
│
└── docs/
    └── architecture/
        └── SALESFORCE_INTEGRATION_ARCHITECTURE.md # This file
```

## Environment Variables

```bash
# Salesforce OAuth
SALESFORCE_CLIENT_ID=your_consumer_key
SALESFORCE_CLIENT_SECRET=your_consumer_secret
SALESFORCE_REDIRECT_URI=http://localhost:3001/api/v1/integrations/salesforce/callback

# Database
CRM_DATABASE_URL=postgresql://user:pass@localhost:5432/crm

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@localhost:5672

# JWT
JWT_SECRET=your_jwt_secret
```

## Future Enhancements

1. **Token Encryption**: Encrypt tokens at rest in database
2. **Webhooks**: Real-time updates from Salesforce
3. **Batch Sync**: Scheduled background sync jobs
4. **More Objects**: Support for Tasks, Events, Cases, etc.
5. **Two-way Sync**: Push data from Pitch to Salesforce
6. **Field Mapping**: Custom field mapping configuration
7. **Error Retry**: Exponential backoff for API failures
8. **Rate Limiting**: Respect Salesforce API limits
9. **Audit Logging**: Track all Salesforce operations
10. **Multi-org Support**: Connect multiple Salesforce orgs per user

## References

- [Salesforce OAuth 2.0 Documentation](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm)
- [Salesforce REST API](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/)
- [SOQL Reference](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/)
- [NestJS Microservices](https://docs.nestjs.com/microservices/basics)
- [RabbitMQ](https://www.rabbitmq.com/documentation.html)
