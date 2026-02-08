# Session CRM Data - Complete Guide

## Overview

The CRM microservice now stores CRM data attached to AI simulation sessions.
This allows you to:

1. **View LIVE CRM data** from Salesforce (not stored)
2. **Select specific data** to attach to an AI session
3. **Save selected data** to database with `sessionId`
4. **Retrieve attached data** for a session
5. **Refresh attached data** from Salesforce
6. **Delete attached data** when session is deleted

## Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SESSION CRM DATA FLOW                           │
└─────────────────────────────────────────────────────────────────────┘

1. User creates session
2. User sees LIVE CRM data from Salesforce API
   ↓
   GET /api/crm/salesforce/contacts      (Live from Salesforce)
   GET /api/crm/salesforce/accounts      (Live from Salesforce)
   GET /api/crm/salesforce/opportunities (Live from Salesforce)

3. User selects data to attach to session
   ↓
   POST /api/v1/sessions/:sessionId/crm
   {
     contacts: [{ externalId: "003XXX", data: {...} }],
     accounts: [{ externalId: "001XXX", data: {...} }],
     ...
   }

4. Selected data saved to DB with sessionId
   - Contacts stored in `contacts` table
   - Accounts stored in `accounts` table
   - Activities created linking entities to session

5. Get attached data
   ↓
   GET /api/v1/sessions/:sessionId/crm

6. Refresh data from Salesforce
   ↓
   PUT /api/v1/sessions/:sessionId/crm/refresh

7. Delete when session ends
   ↓
   DELETE /api/v1/sessions/:sessionId/crm
```

## API Endpoints

### 1. View Live CRM Data (Salesforce API)

These endpoints fetch data **in real-time** from Salesforce (not stored):

```bash
# Get live contacts from Salesforce
GET /api/crm/salesforce/contacts?userId=user-123&limit=50

# Get live accounts
GET /api/crm/salesforce/accounts?userId=user-123&limit=50

# Get live opportunities
GET /api/crm/salesforce/opportunities?userId=user-123&limit=50

# Get live leads
GET /api/crm/salesforce/leads?userId=user-123&limit=50
```

**Response Example:**

```json
[
  {
    "Id": "003XXXXXXXXXXXXAAA",
    "FirstName": "John",
    "LastName": "Doe",
    "Email": "john@example.com",
    "Phone": "+1234567890",
    "Title": "VP Sales",
    "Account": {
      "Name": "Acme Corp"
    }
  }
]
```

### 2. Attach CRM Data to Session (Save to DB)

After viewing live data, user selects which entities to attach to the session:

```bash
POST /api/v1/sessions/:sessionId/crm
Content-Type: application/json
Authorization: Bearer <token>

{
  "orgId": "org-123",
  "contacts": [
    {
      "externalId": "003XXXXXXXXXXXXAAA",
      "data": {
        "Id": "003XXXXXXXXXXXXAAA",
        "FirstName": "John",
        "LastName": "Doe",
        "Email": "john@example.com",
        "Phone": "+1234567890",
        "Title": "VP Sales"
      }
    }
  ],
  "accounts": [
    {
      "externalId": "001XXXXXXXXXXXXAAA",
      "data": {
        "Id": "001XXXXXXXXXXXXAAA",
        "Name": "Acme Corporation",
        "Industry": "Technology",
        "Website": "https://acme.com"
      }
    }
  ],
  "opportunities": [],
  "leads": []
}
```

**Response:**

```json
{
  "success": true,
  "message": "CRM data attached to session successfully",
  "sessionId": "session-123",
  "data": {
    "contacts": [...],
    "accounts": [...],
    "opportunities": [],
    "leads": []
  }
}
```

### 3. Get Session CRM Data (From DB)

Retrieve all CRM data attached to a session:

```bash
GET /api/v1/sessions/:sessionId/crm
Authorization: Bearer <token>
```

**Response:**

```json
{
  "sessionId": "session-123",
  "contacts": [
    {
      "id": "contact-456",
      "userId": "user-123",
      "externalId": "003XXXXXXXXXXXXAAA",
      "provider": "SALESFORCE",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "title": "VP Sales",
      "createdAt": "2024-01-31T00:00:00Z",
      "lastSyncedAt": "2024-01-31T00:00:00Z"
    }
  ],
  "accounts": [...],
  "opportunities": [],
  "leads": [],
  "notes": [],
  "activities": [
    {
      "id": "activity-789",
      "type": "Session",
      "subject": "AI Simulation Session",
      "description": "Contact attached to session session-123",
      "status": "Completed",
      "createdAt": "2024-01-31T00:00:00Z"
    }
  ]
}
```

### 4. Refresh Session CRM Data

Fetch fresh data from Salesforce for all attached entities and update DB:

```bash
PUT /api/v1/sessions/:sessionId/crm/refresh
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Session CRM data refreshed successfully",
  "sessionId": "session-123"
}
```

### 5. Delete Session CRM Data

Delete all CRM data when session is deleted:

```bash
DELETE /api/v1/sessions/:sessionId/crm
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Session CRM data deleted successfully",
  "sessionId": "session-123"
}
```

## Complete Workflow Example

### Step 1: Connect to Salesforce (One-time setup)

```bash
# Get OAuth URL
GET /api/crm/salesforce/connect?userId=user-123

# User opens URL in browser, logs in, authorizes

# Check connection status
GET /api/crm/salesforce/status?userId=user-123
```

### Step 2: Create AI Session

```bash
# User creates simulation session (via simulation service)
POST /api/v1/sessions
{
  "type": "sales_pitch",
  "scenario": "cold_call",
  "userId": "user-123"
}

# Response
{
  "id": "session-123",
  "type": "sales_pitch",
  "scenario": "cold_call"
}
```

### Step 3: View Live CRM Data

```bash
# User sees real-time data from Salesforce
GET /api/crm/salesforce/contacts?userId=user-123&limit=50

# Response: Array of live contacts from Salesforce
[
  { "Id": "003AAA", "FirstName": "John", "LastName": "Doe", ... },
  { "Id": "003BBB", "FirstName": "Jane", "LastName": "Smith", ... }
]
```

### Step 4: User Selects Data to Attach

```bash
# User picks John Doe and attaches to session
POST /api/v1/sessions/session-123/crm
{
  "orgId": "org-123",
  "contacts": [
    {
      "externalId": "003AAA",
      "data": { "Id": "003AAA", "FirstName": "John", "LastName": "Doe", ... }
    }
  ],
  "accounts": [],
  "opportunities": [],
  "leads": []
}

# Data is now saved in DB with sessionId
```

### Step 5: AI Session Runs

During the session, the simulation service can:

```bash
# Add notes about the session
POST /api/v1/sessions/session-123/notes
{
  "title": "Performance Feedback",
  "content": "User handled objections well",
  "contactId": "contact-456"
}

# Create activities
POST /api/v1/sessions/session-123/activities
{
  "type": "Call",
  "subject": "Practice cold call",
  "description": "AI simulation feedback",
  "contactId": "contact-456",
  "status": "Completed"
}
```

### Step 6: Retrieve Session Data

```bash
# Get all CRM data for this session
GET /api/v1/sessions/session-123/crm

# Response includes everything attached to this session
{
  "sessionId": "session-123",
  "contacts": [...],  # Contacts attached to session
  "accounts": [...],  # Accounts attached to session
  "notes": [...],     # Notes for this session
  "activities": [...] # Activities for this session
}
```

### Step 7: Refresh Data (Optional)

```bash
# If user wants updated data from Salesforce
PUT /api/v1/sessions/session-123/crm/refresh

# Fetches fresh data from Salesforce, updates DB
```

### Step 8: Session Ends

```bash
# When session is deleted, CRM data is also deleted
DELETE /api/v1/sessions/session-123/crm

# All activities, notes, and links to this session are removed
```

## Integration with Simulation Service

The simulation service can interact with CRM data:

```typescript
// In simulation service, after session is created
async attachCrmDataToSession(sessionId: string, userId: string, selectedData: any) {
  return this.crmService.send('session.attachCrmData', {
    userId,
    sessionId,
    ...selectedData,
  });
}

// Get CRM data for session
async getSessionCrmData(sessionId: string, userId: string) {
  return this.crmService.send('session.getCrmData', {
    userId,
    sessionId,
  });
}

// When session is deleted
async deleteSession(sessionId: string, userId: string) {
  // Delete CRM data first
  await this.crmService.send('session.deleteCrmData', {
    userId,
    sessionId,
  });

  // Then delete session
  await this.deleteSessionFromDb(sessionId);
}
```

## Database Schema

### Contact (with sessionId link)

```prisma
model Contact {
  id            String    @id
  userId        String
  orgId         String?

  // Salesforce tracking
  integrationId String?
  externalId    String?   // Salesforce ID
  provider      IntegrationProvider?

  // Contact info
  firstName     String
  lastName      String
  email         String?

  // Linked to session via Activity
  activities    Activity[]  // Activities link this contact to sessions
}
```

### Activity (links entities to sessions)

```prisma
model Activity {
  id          String    @id
  userId      String
  sessionId   String?   // Links to AI session!

  type        String    // "Session", "Call", "Meeting", etc.
  subject     String
  status      String

  // Can link to any CRM entity
  contactId     String?
  accountId     String?
  opportunityId String?
  leadId        String?

  contact       Contact?
  account       Account?
  opportunity   Opportunity?
  lead          Lead?
}
```

## Key Points

1. **Live Data**: Salesforce endpoints return real-time data (not stored)
2. **User Selects**: User chooses which entities to attach to session
3. **Saved with SessionId**: Selected data stored in DB with `sessionId`
4. **Activities Link**: Activities table links CRM entities to sessions
5. **Cascade Delete**: When session deleted, CRM data also deleted
6. **Refreshable**: Can update stored data from Salesforce anytime

## Testing

### Via Swagger UI

1. Open http://localhost:8000/docs
2. Navigate to **"Salesforce Integration"** section
   - Test live data endpoints
3. Navigate to **"Session CRM Data"** section
   - Test attach, get, refresh, delete

### Via curl

```bash
# 1. View live data
curl "http://localhost:8000/api/crm/salesforce/contacts?userId=user-123" \
  -H "Authorization: Bearer $TOKEN"

# 2. Attach to session
curl -X POST "http://localhost:8000/api/v1/sessions/session-123/crm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contacts": [{"externalId": "003AAA", "data": {...}}]
  }'

# 3. Get session data
curl "http://localhost:8000/api/v1/sessions/session-123/crm" \
  -H "Authorization: Bearer $TOKEN"

# 4. Refresh
curl -X PUT "http://localhost:8000/api/v1/sessions/session-123/crm/refresh" \
  -H "Authorization: Bearer $TOKEN"

# 5. Delete
curl -X DELETE "http://localhost:8000/api/v1/sessions/session-123/crm" \
  -H "Authorization: Bearer $TOKEN"
```

## Environment Setup

```bash
# CRM Database
CRM_DATABASE_URL=postgresql://pitch_user:pitch_admin@localhost:5437/pitch_crm

# Salesforce OAuth
SALESFORCE_CLIENT_ID=your_consumer_key
SALESFORCE_CLIENT_SECRET=your_consumer_secret
SALESFORCE_REDIRECT_URI=http://localhost:8000/api/crm/salesforce/callback
```

## Quick Start

```bash
# Start server
pnpm dev

# View database
pnpm db:studio:crm  # http://localhost:5555

# Test in Swagger
open http://localhost:8000/docs
```

---

**The CRM microservice now works exactly how you described:**

1. User sees **LIVE** data from Salesforce API
2. User selects data to **ATTACH** to session
3. Data is **SAVED** to DB with `sessionId`
4. Can **GET**, **REFRESH**, and **DELETE** session data

Perfect for AI simulation sessions!
