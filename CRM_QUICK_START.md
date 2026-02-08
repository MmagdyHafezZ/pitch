# CRM Integration Quick Start

## TL;DR

**Two types of APIs:**

1. **Live Data** (`/api/crm/salesforce/*`) - Fetch from Salesforce in real-time,
   NOT stored
2. **Session Data** (`/api/v1/sessions/:sessionId/crm`) - Saved to local DB,
   linked to AI session

## 60-Second Setup

### 1. Environment Variables (.env)

```bash
# Salesforce OAuth
SALESFORCE_CLIENT_ID=your_client_id_here
SALESFORCE_CLIENT_SECRET=your_client_secret_here
SALESFORCE_REDIRECT_URI=http://localhost:8000/api/crm/salesforce/callback

# Database (already configured)
CRM_DATABASE_URL="postgresql://pitch_user:pitch_password@localhost:5435/pitch_crm?schema=public"
```

### 2. Start Server

```bash
pnpm dev
```

### 3. Test in Swagger

Open: `http://localhost:8000/docs`

## The 4-Step Flow

### Step 1: Connect Salesforce

```http
GET /api/crm/salesforce/connect
```

→ Redirects to Salesforce OAuth → User authorizes → Tokens saved

### Step 2: View Live Data

```http
GET /api/crm/salesforce/contacts?limit=50
GET /api/crm/salesforce/accounts?limit=50
GET /api/crm/salesforce/opportunities?limit=50
GET /api/crm/salesforce/leads?limit=50
```

→ Returns **raw Salesforce JSON** (NOT stored in DB)

### Step 3: Attach to Session

```http
POST /api/v1/sessions/:sessionId/crm
Content-Type: application/json

{
  "contacts": [/* paste raw Salesforce contacts here */],
  "accounts": [/* paste raw Salesforce accounts here */],
  "opportunities": [],
  "leads": []
}
```

→ Saves to DB with `sessionId` link

### Step 4: Retrieve/Refresh/Delete

```http
GET    /api/v1/sessions/:sessionId/crm          # Get saved data
PUT    /api/v1/sessions/:sessionId/crm/refresh  # Update from Salesforce
DELETE /api/v1/sessions/:sessionId/crm          # Remove when session deleted
```

## API Quick Reference

### Salesforce APIs (Live Data - NOT Stored)

| Method | Endpoint                            | Purpose                    |
| ------ | ----------------------------------- | -------------------------- |
| GET    | `/api/crm/salesforce/connect`       | Get OAuth URL              |
| GET    | `/api/crm/salesforce/callback`      | OAuth callback (automatic) |
| GET    | `/api/crm/salesforce/status`        | Check connection           |
| GET    | `/api/crm/salesforce/contacts`      | Fetch live contacts        |
| GET    | `/api/crm/salesforce/accounts`      | Fetch live accounts        |
| GET    | `/api/crm/salesforce/opportunities` | Fetch live opportunities   |
| GET    | `/api/crm/salesforce/leads`         | Fetch live leads           |
| POST   | `/api/crm/salesforce/query`         | Custom SOQL query          |
| POST   | `/api/crm/salesforce/search`        | SOSL search                |
| DELETE | `/api/crm/salesforce/disconnect`    | Disconnect                 |

### Session CRM APIs (Persistent Storage)

| Method | Endpoint                                  | Purpose                 |
| ------ | ----------------------------------------- | ----------------------- |
| POST   | `/api/v1/sessions/:sessionId/crm`         | Attach data to session  |
| GET    | `/api/v1/sessions/:sessionId/crm`         | Get session data        |
| PUT    | `/api/v1/sessions/:sessionId/crm/refresh` | Refresh from Salesforce |
| DELETE | `/api/v1/sessions/:sessionId/crm`         | Delete session data     |

## Data Format

### What You Receive (Salesforce API Response)

```json
{
  "success": true,
  "count": 2,
  "contacts": [
    {
      "attributes": {
        "type": "Contact",
        "url": "/services/data/v58.0/sobjects/Contact/003XXXXX"
      },
      "Id": "003XXXXX",
      "FirstName": "John",
      "LastName": "Doe",
      "Email": "john@example.com",
      "Phone": "+1234567890",
      "Title": "CEO",
      "AccountId": "001XXXXX",
      "Account": {
        "attributes": { "type": "Account", "url": "..." },
        "Name": "Acme Corp"
      },
      "CreatedDate": "2026-01-22T01:20:49.000+0000"
    }
  ]
}
```

### What You Send (POST to Session)

**IMPORTANT:** Pass the same format you received!

```json
{
  "orgId": "org-123",
  "contacts": [
    {
      "attributes": { "type": "Contact", "url": "..." },
      "Id": "003XXXXX",
      "FirstName": "John",
      "LastName": "Doe",
      "Email": "john@example.com",
      "Phone": "+1234567890",
      "Title": "CEO",
      "AccountId": "001XXXXX",
      "Account": {
        "attributes": { "type": "Account", "url": "..." },
        "Name": "Acme Corp"
      },
      "CreatedDate": "2026-01-22T01:20:49.000+0000"
    }
  ],
  "accounts": [],
  "opportunities": [],
  "leads": []
}
```

**The system will:**

- Extract `Id` → stored as `externalId`
- Parse structured fields → stored in DB columns
- Store entire raw object → stored in `customFields` (JSON)
- Link to session → stored as `sessionId`

### What You Get Back (GET Session Data)

```json
{
  "sessionId": "session-abc123",
  "contacts": [
    {
      "id": "clm1xyz...", // Internal DB ID
      "userId": "user-123",
      "externalId": "003XXXXX", // Salesforce Contact Id
      "provider": "SALESFORCE",
      "sessionId": "session-abc123", //  Session link
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "title": "CEO",
      "company": "Acme Corp",
      "customFields": {
        //  Complete raw Salesforce object
        "attributes": { "type": "Contact", "url": "..." },
        "Id": "003XXXXX",
        "FirstName": "John",
        "LastName": "Doe",
        "Email": "john@example.com",
        "Phone": "+1234567890",
        "Title": "CEO",
        "AccountId": "001XXXXX",
        "Account": {
          "attributes": { "type": "Account", "url": "..." },
          "Name": "Acme Corp"
        },
        "CreatedDate": "2026-01-22T01:20:49.000+0000"
      },
      "lastSyncedAt": "2026-01-31T12:00:00Z",
      "createdAt": "2026-01-31T10:00:00Z",
      "updatedAt": "2026-01-31T12:00:00Z"
    }
  ],
  "accounts": [],
  "opportunities": [],
  "leads": [],
  "notes": [],
  "activities": []
}
```

## JavaScript Example

```javascript
// 1. Connect Salesforce
const { authUrl } = await fetch('/api/crm/salesforce/connect', {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json())

window.location.href = authUrl // User authorizes

// 2. Get live contacts
const { contacts } = await fetch('/api/crm/salesforce/contacts?limit=50', {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json())

// 3. User selects contacts [0, 3, 5]
const selected = [contacts[0], contacts[3], contacts[5]]

// 4. Attach to session (pass raw Salesforce objects)
const result = await fetch(`/api/v1/sessions/${sessionId}/crm`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    orgId: 'org-123',
    contacts: selected, //  Raw Salesforce format
    accounts: [],
    opportunities: [],
    leads: [],
  }),
}).then((r) => r.json())

console.log('Saved:', result.data.contacts.length, 'contacts')

// 5. Get session data
const sessionData = await fetch(`/api/v1/sessions/${sessionId}/crm`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json())

console.log('Session contacts:', sessionData.contacts)
console.log('Raw SF data:', sessionData.contacts[0].customFields)

// 6. Refresh (update from Salesforce)
await fetch(`/api/v1/sessions/${sessionId}/crm/refresh`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${token}` },
})

// 7. Delete (when session deleted)
await fetch(`/api/v1/sessions/${sessionId}/crm`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` },
})
```

## Common Mistakes

### DON'T: Transform data before sending

```javascript
// BAD - Don't do this!
const transformed = contacts.map((c) => ({
  externalId: c.Id,
  data: c,
}))
```

### DO: Send raw Salesforce format

```javascript
// GOOD - Do this!
const payload = {
  contacts: contacts, // Raw format from Salesforce
  accounts: [],
  opportunities: [],
  leads: [],
}
```

## Troubleshooting

| Error                       | Solution                                                |
| --------------------------- | ------------------------------------------------------- |
| "Integration not connected" | Call `/api/crm/salesforce/connect` first                |
| "Failed to fetch data"      | Check `/api/crm/salesforce/status`, reconnect if needed |
| "Session not found"         | Verify sessionId exists                                 |
| Empty arrays on GET         | POST data first to attach CRM records                   |

## Key Concepts

1. **Two Data Sources:**
   - **Salesforce API** = Live, real-time, NOT stored
   - **Local DB** = Persisted, linked to sessions

2. **Session-Centric:**
   - CRM data is tied to AI simulation sessions
   - Delete CRM data when session is deleted

3. **Raw Format:**
   - Accept Salesforce format as-is
   - Store complete object in `customFields`
   - Extract fields for querying

4. **Refresh:**
   - Data can become stale
   - Use refresh endpoint to update from Salesforce
   - Maintains sessionId link

## Database Tables

- `integrations` - OAuth tokens (per user)
- `contacts` - Salesforce contacts (linked to sessions)
- `accounts` - Salesforce accounts (linked to sessions)
- `opportunities` - Salesforce opportunities (linked to sessions)
- `leads` - Salesforce leads (linked to sessions)
- `activities` - Links entities to sessions
- `notes` - Notes attached to CRM entities and sessions

All tables have:

- `userId` - Owner
- `externalId` - Salesforce ID
- `sessionId` - Link to AI session
- `customFields` - Raw Salesforce object (JSON)
- `lastSyncedAt` - Last refresh time

## Next Steps

- Read full guide: [CRM_INTEGRATION_GUIDE.md](./CRM_INTEGRATION_GUIDE.md)
- Test in Swagger: `http://localhost:8000/docs`
- Check database: `pnpm prisma:studio` (from apps/api)
- View logs: Watch terminal output

## Support

If you encounter issues:

1. Check Swagger docs: `http://localhost:8000/docs`
2. View server logs in terminal
3. Check database with Prisma Studio
4. Verify environment variables in `.env`
5. Ensure Salesforce Connected App is configured correctly
