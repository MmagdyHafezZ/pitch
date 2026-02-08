# CRM Integration Guide

## Overview

The CRM integration allows your application to connect to Salesforce, view live
CRM data, and attach selected data to AI simulation sessions for persistence.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  API Gateway    │────▶│ RabbitMQ MQ  │────▶│ CRM Microservice│
│  (HTTP/REST)    │◀────│  (Messages)  │◀────│   (Business)    │
└─────────────────┘     └──────────────┘     └─────────────────┘
                                                      │
                                                      ▼
                                              ┌──────────────────┐
                                              │  PostgreSQL DB   │
                                              │  - integrations  │
                                              │  - contacts      │
                                              │  - accounts      │
                                              │  - opportunities │
                                              │  - leads         │
                                              │  - activities    │
                                              │  - notes         │
                                              └──────────────────┘
                                                      ▲
                                                      │
                                              ┌──────────────────┐
                                              │  Salesforce API  │
                                              │  (Live Data)     │
                                              └──────────────────┘
```

## Data Flow

### 1. **Connect to Salesforce**

- User clicks "Connect Salesforce"
- App redirects to Salesforce OAuth
- User authorizes
- Salesforce redirects back with code
- App exchanges code for access & refresh tokens
- **Tokens stored in `integrations` table**

### 2. **View Live CRM Data**

- User requests contacts, accounts, opportunities, or leads
- App fetches **live data** directly from Salesforce API
- Data is **NOT stored** in local database
- Data shown to user for selection

### 3. **Attach Data to Session**

- User selects specific CRM records from live view
- User clicks "Attach to Session"
- App saves **selected data** to local DB with `sessionId`
- Raw Salesforce data stored in `customFields` (JSON)
- Structured fields extracted for querying

### 4. **Retrieve Session Data**

- App queries local DB by `sessionId`
- Returns all CRM data attached to that session
- Includes raw Salesforce format in `customFields`

### 5. **Refresh Session Data**

- App fetches fresh data from Salesforce for each attached entity
- Updates local DB with new values
- Maintains `sessionId` link

### 6. **Delete Session Data**

- When AI session is deleted
- All attached CRM data is removed from DB

## API Endpoints

### Salesforce Integration

#### 1. Connect to Salesforce

```http
GET /api/crm/salesforce/connect
Authorization: Bearer <token>
```

**Response:**

```json
{
  "authUrl": "https://login.salesforce.com/services/oauth2/authorize?...",
  "message": "Redirect user to this URL to connect Salesforce"
}
```

**Usage:**

- Redirect user to `authUrl`
- Salesforce will redirect back to callback URL after authorization

#### 2. OAuth Callback (Automatic)

```http
GET /api/crm/salesforce/callback?code=xxx&state=userId
```

**Note:** This is called automatically by Salesforce after user authorizes.

#### 3. Check Connection Status

```http
GET /api/crm/salesforce/status
Authorization: Bearer <token>
```

**Response:**

```json
{
  "connected": true,
  "status": "CONNECTED",
  "providerEmail": "user@company.com",
  "instanceUrl": "https://yourorg.my.salesforce.com",
  "createdAt": "2026-01-27T...",
  "updatedAt": "2026-01-31T..."
}
```

#### 4. Get Live Contacts

```http
GET /api/crm/salesforce/contacts?limit=50
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "count": 21,
  "contacts": [
    {
      "attributes": {
        "type": "Contact",
        "url": "/services/data/v58.0/sobjects/Contact/003fj00000cqBmIAAU"
      },
      "Id": "003fj00000cqBmIAAU",
      "FirstName": "Sean",
      "LastName": "Forbes",
      "Email": "sean@edge.com",
      "Phone": "(512) 757-6000",
      "Title": "CFO",
      "AccountId": "001fj00000dw13hAAA",
      "Account": {
        "attributes": {
          "type": "Account",
          "url": "/services/data/v58.0/sobjects/Account/001fj00000dw13hAAA"
        },
        "Name": "Edge Communications"
      },
      "CreatedDate": "2026-01-22T01:20:49.000+0000"
    }
  ]
}
```

#### 5. Get Live Accounts

```http
GET /api/crm/salesforce/accounts?limit=50
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "count": 13,
  "accounts": [
    {
      "attributes": {
        "type": "Account",
        "url": "/services/data/v58.0/sobjects/Account/001fj00000dw13hAAA"
      },
      "Id": "001fj00000dw13hAAA",
      "Name": "Edge Communications",
      "Industry": "Electronics",
      "Type": "Customer - Direct",
      "Phone": "(512) 757-6000",
      "Website": "http://edgecomm.com",
      "BillingCity": "Austin",
      "BillingState": "TX",
      "BillingCountry": "United States",
      "CreatedDate": "2026-01-22T01:20:49.000+0000"
    }
  ]
}
```

#### 6. Get Live Opportunities

```http
GET /api/crm/salesforce/opportunities?limit=50
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "count": 32,
  "opportunities": [
    {
      "attributes": {
        "type": "Opportunity",
        "url": "/services/data/v58.0/sobjects/Opportunity/006fj000008TAp1AAG"
      },
      "Id": "006fj000008TAp1AAG",
      "Name": "United Oil Office Portable Generators",
      "StageName": "Negotiation/Review",
      "Amount": 125000,
      "CloseDate": "2025-11-17",
      "Probability": 90,
      "AccountId": "001fj00000dw13mAAA",
      "Account": {
        "attributes": {
          "type": "Account",
          "url": "/services/data/v58.0/sobjects/Account/001fj00000dw13mAAA"
        },
        "Name": "United Oil & Gas Corp."
      },
      "CreatedDate": "2026-01-22T01:20:49.000+0000"
    }
  ]
}
```

#### 7. Get Live Leads

```http
GET /api/crm/salesforce/leads?limit=50
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "count": 22,
  "leads": [
    {
      "attributes": {
        "type": "Lead",
        "url": "/services/data/v58.0/sobjects/Lead/00Qfj000009EWNpEAO"
      },
      "Id": "00Qfj000009EWNpEAO",
      "FirstName": "Bertha",
      "LastName": "Boxer",
      "Company": "Farmers Coop. of Florida",
      "Email": "bertha@fcof.net",
      "Phone": "(850) 644-4200",
      "Status": "Working - Contacted",
      "LeadSource": "Web",
      "CreatedDate": "2026-01-22T01:20:49.000+0000"
    }
  ]
}
```

#### 8. Custom SOQL Query

```http
POST /api/crm/salesforce/query
Authorization: Bearer <token>
Content-Type: application/json

{
  "soql": "SELECT Id, Name FROM Account WHERE Industry = 'Technology' LIMIT 10"
}
```

#### 9. Salesforce Search (SOSL)

```http
POST /api/crm/salesforce/search
Authorization: Bearer <token>
Content-Type: application/json

{
  "searchQuery": "FIND {John*} IN NAME FIELDS RETURNING Contact(Id, FirstName, LastName, Email)"
}
```

#### 10. Disconnect Salesforce

```http
DELETE /api/crm/salesforce/disconnect
Authorization: Bearer <token>
```

### Session CRM Data (Persistent Storage)

#### 1. Attach CRM Data to Session

```http
POST /api/v1/sessions/:sessionId/crm
Authorization: Bearer <token>
Content-Type: application/json

{
  "orgId": "org-abc123",
  "contacts": [
    {
      "attributes": {
        "type": "Contact",
        "url": "/services/data/v58.0/sobjects/Contact/003fj00000cqBmIAAU"
      },
      "Id": "003fj00000cqBmIAAU",
      "FirstName": "Sean",
      "LastName": "Forbes",
      "Email": "sean@edge.com",
      "Phone": "(512) 757-6000",
      "Title": "CFO",
      "AccountId": "001fj00000dw13hAAA",
      "Account": {
        "attributes": {
          "type": "Account",
          "url": "/services/data/v58.0/sobjects/Account/001fj00000dw13hAAA"
        },
        "Name": "Edge Communications"
      },
      "CreatedDate": "2026-01-22T01:20:49.000+0000"
    }
  ],
  "accounts": [
    {
      "attributes": {
        "type": "Account",
        "url": "/services/data/v58.0/sobjects/Account/001fj00000dw13hAAA"
      },
      "Id": "001fj00000dw13hAAA",
      "Name": "Edge Communications",
      "Industry": "Electronics",
      "Type": "Customer - Direct",
      "Phone": "(512) 757-6000",
      "Website": "http://edgecomm.com",
      "BillingCity": "Austin",
      "BillingState": "TX",
      "BillingCountry": "United States",
      "CreatedDate": "2026-01-22T01:20:49.000+0000"
    }
  ],
  "opportunities": [],
  "leads": []
}
```

**Important:** Pass the exact JSON structure you receive from Salesforce APIs.
The system will:

- Extract `Id` field as `externalId`
- Parse structured fields for database columns
- Store entire raw object in `customFields` (JSON column)
- Link to session via `sessionId`

**Response:**

```json
{
  "success": true,
  "message": "CRM data attached to session successfully",
  "sessionId": "session-abc123",
  "data": {
    "contacts": [
      {
        "id": "clm1...",
        "userId": "user-123",
        "orgId": "org-abc123",
        "integrationId": "int-xyz",
        "externalId": "003fj00000cqBmIAAU",
        "provider": "SALESFORCE",
        "sessionId": "session-abc123",
        "firstName": "Sean",
        "lastName": "Forbes",
        "email": "sean@edge.com",
        "phone": "(512) 757-6000",
        "title": "CFO",
        "company": "Edge Communications",
        "customFields": { /* raw Salesforce object */ },
        "lastSyncedAt": "2026-01-31T...",
        "createdAt": "2026-01-31T...",
        "updatedAt": "2026-01-31T..."
      }
    ],
    "accounts": [...],
    "opportunities": [],
    "leads": []
  }
}
```

#### 2. Get Session CRM Data

```http
GET /api/v1/sessions/:sessionId/crm
Authorization: Bearer <token>
```

**Response:**

```json
{
  "sessionId": "session-abc123",
  "contacts": [
    {
      "id": "clm1...",
      "userId": "user-123",
      "externalId": "003fj00000cqBmIAAU",
      "provider": "SALESFORCE",
      "sessionId": "session-abc123",
      "firstName": "Sean",
      "lastName": "Forbes",
      "email": "sean@edge.com",
      "phone": "(512) 757-6000",
      "title": "CFO",
      "company": "Edge Communications",
      "customFields": {
        "attributes": { "type": "Contact", "url": "..." },
        "Id": "003fj00000cqBmIAAU",
        "FirstName": "Sean",
        "LastName": "Forbes",
        "Email": "sean@edge.com",
        "Phone": "(512) 757-6000",
        "Title": "CFO",
        "AccountId": "001fj00000dw13hAAA",
        "Account": {
          "attributes": { "type": "Account", "url": "..." },
          "Name": "Edge Communications"
        },
        "CreatedDate": "2026-01-22T01:20:49.000+0000"
      },
      "lastSyncedAt": "2026-01-31T...",
      "createdAt": "2026-01-31T...",
      "updatedAt": "2026-01-31T..."
    }
  ],
  "accounts": [...],
  "opportunities": [...],
  "leads": [...],
  "notes": [...],
  "activities": [...]
}
```

#### 3. Refresh Session CRM Data

```http
PUT /api/v1/sessions/:sessionId/crm/refresh
Authorization: Bearer <token>
```

**What it does:**

- Fetches fresh data from Salesforce for each attached entity
- Updates database with new values
- Maintains `sessionId` link

**Response:**

```json
{
  "success": true,
  "message": "Session CRM data refreshed successfully",
  "sessionId": "session-abc123"
}
```

#### 4. Delete Session CRM Data

```http
DELETE /api/v1/sessions/:sessionId/crm
Authorization: Bearer <token>
```

**When to use:**

- When deleting an AI simulation session
- When user wants to clear CRM data for a session

**Response:**

```json
{
  "success": true,
  "message": "Session CRM data deleted successfully",
  "sessionId": "session-abc123"
}
```

## Database Schema

### Integration Table

```prisma
model Integration {
  id            String   @id @default(cuid())
  userId        String
  provider      IntegrationProvider // SALESFORCE
  status        IntegrationStatus   // CONNECTED, DISCONNECTED, ERROR, EXPIRED
  accessToken   String?
  refreshToken  String?
  expiresAt     DateTime?
  instanceUrl   String?
  providerId    String?
  providerEmail String?
  providerData  Json?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([userId, provider])
  @@map("integrations")
}
```

### Contact Table

```prisma
model Contact {
  id            String    @id @default(cuid())
  userId        String
  orgId         String?
  integrationId String?
  externalId    String?   // Salesforce Contact Id
  provider      IntegrationProvider?
  sessionId     String?   //  Link to AI session

  // Structured fields
  firstName     String?
  lastName      String?
  email         String?
  phone         String?
  title         String?
  company       String?

  // Raw Salesforce data
  customFields  Json?     //  Complete Salesforce object

  lastSyncedAt  DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([userId, externalId, provider])
  @@index([sessionId])
  @@map("contacts")
}
```

Similar structure for `Account`, `Opportunity`, `Lead` tables.

### Activity Table (Session Links)

```prisma
model Activity {
  id          String   @id @default(cuid())
  userId      String
  orgId       String?
  sessionId   String?  //  Link to AI session

  type        String?  // "Session"
  subject     String?  // "AI Simulation Session"
  description String?
  status      String?  // "Completed"

  // Links to CRM entities
  contactId      String?
  accountId      String?
  opportunityId  String?
  leadId         String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([sessionId])
  @@map("activities")
}
```

## Complete Usage Example

### Step 1: Connect to Salesforce

```javascript
// 1. Get connect URL
const response = await fetch('/api/crm/salesforce/connect', {
  headers: {
    Authorization: `Bearer ${userToken}`,
  },
})
const { authUrl } = await response.json()

// 2. Redirect user
window.location.href = authUrl

// 3. Salesforce redirects back to /api/crm/salesforce/callback
// 4. Tokens are stored automatically
```

### Step 2: View Live Data

```javascript
// Fetch live contacts from Salesforce
const response = await fetch('/api/crm/salesforce/contacts?limit=100', {
  headers: {
    Authorization: `Bearer ${userToken}`,
  },
})
const { contacts } = await response.json()

// Show to user for selection
console.log(contacts) // Raw Salesforce format with attributes, Id, etc.
```

### Step 3: Attach to Session

```javascript
// User selects contacts to attach
const selectedContacts = [
  contacts[0], // Raw Salesforce object
  contacts[5], // Raw Salesforce object
]

// Attach to session
const response = await fetch(`/api/v1/sessions/${sessionId}/crm`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${userToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    orgId: 'org-123',
    contacts: selectedContacts, // Pass raw Salesforce objects
    accounts: [],
    opportunities: [],
    leads: [],
  }),
})

const result = await response.json()
console.log('Attached:', result.data)
```

### Step 4: Retrieve Session Data

```javascript
// Get all CRM data for session
const response = await fetch(`/api/v1/sessions/${sessionId}/crm`, {
  headers: {
    Authorization: `Bearer ${userToken}`,
  },
})

const sessionData = await response.json()
console.log('Session contacts:', sessionData.contacts)
console.log('Raw Salesforce data:', sessionData.contacts[0].customFields)
```

### Step 5: Refresh Data

```javascript
// Refresh all attached CRM data from Salesforce
const response = await fetch(`/api/v1/sessions/${sessionId}/crm/refresh`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${userToken}`,
  },
})

const result = await response.json()
console.log('Refreshed:', result)
```

### Step 6: Delete Session Data

```javascript
// When deleting session
const response = await fetch(`/api/v1/sessions/${sessionId}/crm`, {
  method: 'DELETE',
  headers: {
    Authorization: `Bearer ${userToken}`,
  },
})

const result = await response.json()
console.log('Deleted:', result)
```

## Error Handling

### Common Errors

**401 Unauthorized**

```json
{
  "statusCode": 401,
  "message": "Salesforce integration not connected"
}
```

**Solution:** User needs to connect Salesforce first.

**404 Not Found**

```json
{
  "statusCode": 404,
  "message": "Integration not found"
}
```

**Solution:** User needs to connect Salesforce first.

**500 Internal Server Error**

```json
{
  "statusCode": 500,
  "message": "Failed to fetch data from Salesforce"
}
```

**Solution:** Check Salesforce connection status, may need to reconnect.

## Testing via Swagger

1. Navigate to `http://localhost:8000/docs`
2. Authorize with Bearer token (from login)
3. Test Salesforce endpoints:
   - `/api/crm/salesforce/connect` → Get OAuth URL
   - Open URL in browser → Authorize
   - `/api/crm/salesforce/status` → Check connected
   - `/api/crm/salesforce/contacts` → Get live contacts
   - Copy raw response
4. Test Session CRM endpoints:
   - `POST /api/v1/sessions/:sessionId/crm` → Paste raw contacts
   - `GET /api/v1/sessions/:sessionId/crm` → View saved data
   - `PUT /api/v1/sessions/:sessionId/crm/refresh` → Refresh
   - `DELETE /api/v1/sessions/:sessionId/crm` → Clean up

## Best Practices

1. **Always pass raw Salesforce format** - Don't transform the data before
   sending to POST endpoint
2. **Store complete objects** - customFields preserves all Salesforce data
3. **Use sessionId for scoping** - All CRM data tied to specific AI sessions
4. **Refresh periodically** - Salesforce data changes, use refresh endpoint
5. **Clean up on delete** - Always delete CRM data when session is deleted
6. **Handle token expiry** - Check status, reconnect if needed
7. **Respect Salesforce API limits** - Use limit parameter, paginate results

## Troubleshooting

### "Integration not connected"

- User hasn't connected Salesforce
- Token expired
- Solution: Call `/api/crm/salesforce/connect` again

### "Failed to fetch data"

- Salesforce API error
- Network issue
- Token invalid
- Solution: Check `/api/crm/salesforce/status`, reconnect if needed

### "Session not found"

- Invalid sessionId
- Session deleted
- Solution: Verify sessionId exists

### "No data attached"

- GET returns empty arrays
- Nothing attached yet
- Solution: POST data first

## Architecture Patterns

This implementation follows the same patterns as `userManagement`:

1. **Gateway Pattern**: HTTP endpoints in gateway forward to microservice via
   RabbitMQ
2. **Microservice Pattern**: Business logic in CRM microservice
3. **Database Pattern**: Each microservice has own database and Prisma schema
4. **Error Handling**: Consistent error format with status codes
5. **Authentication**: Bearer token required, userId extracted from token
6. **Logging**: Structured logging at each layer
7. **Validation**: DTOs and schema validation
8. **Documentation**: Swagger/OpenAPI docs for all endpoints

## Summary

- **Live Data**: Fetch from Salesforce API, don't store locally
- **Attach to Session**: Save selected data to local DB with sessionId
- **Raw Format**: Accept and store complete Salesforce objects
- **Refresh**: Update from Salesforce, keep sessionId link
- **Clean Up**: Delete when session deleted
- **Best Practices**: Follow userManagement patterns
