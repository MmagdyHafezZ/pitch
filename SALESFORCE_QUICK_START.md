# Salesforce Integration - Quick Start Guide

## Prerequisites

- Docker and Docker Compose installed
- Salesforce account (free developer account available at
  https://developer.salesforce.com/signup)
- Node.js and pnpm installed

## Setup Instructions

### Step 1: Create Salesforce Connected App

1. Login to your Salesforce account
2. Navigate to **Setup** (gear icon in top right)
3. In Quick Find, search for **App Manager**
4. Click **New Connected App**
5. Fill in the required fields:
   - **Connected App Name**: `Pitch CRM Integration`
   - **API Name**: `Pitch_CRM_Integration` (auto-filled)
   - **Contact Email**: Your email address

6. In the **API (Enable OAuth Settings)** section:
   - Check **Enable OAuth Settings**
   - **Callback URL**: `http://localhost:8000/api/crm/salesforce/callback`
   - **Selected OAuth Scopes**: Add `api`, `refresh_token`, and `id`
   - **Require Proof Key for Code Exchange (PKCE)**: LEAVE UNCHECKED

7. Click **Save** and then **Continue**
8. Click **Manage Consumer Details** to view your credentials
9. Copy the **Consumer Key** and **Consumer Secret**

### Step 2: Edit OAuth Policies

1. From the Connected App detail page, click **Edit Policies**
2. Set the following:
   - **Permitted Users**: All users may self-authorize
   - **IP Relaxation**: Relax IP restrictions
   - **Refresh Token Policy**: Refresh token is valid until revoked
3. Click **Save**

### Step 3: Configure Environment Variables

Edit `.env` in the project root and add:

```bash
SALESFORCE_CLIENT_ID=your_consumer_key_here
SALESFORCE_CLIENT_SECRET=your_consumer_secret_here
SALESFORCE_REDIRECT_URI=http://localhost:8000/api/crm/salesforce/callback
```

### Step 4: Setup Database

Run these commands in order:

```bash
# Start PostgreSQL database
docker compose up -d postgres-crm

# Wait for database to be ready
sleep 5

# Run migrations
cd apps/api
npx prisma migrate deploy --schema=./src/microservices/crm/prisma/schema.prisma

# Generate Prisma client
cd ../..
pnpm db:generate:crm
```

### Step 5: Start the Application

```bash
pnpm dev
```

Look for this log message to confirm the database is connected:

```
Salesforce Integration Service initialized with Prisma database
```

## Testing the Integration

### Option 1: Using Swagger UI (Recommended)

1. Open your browser to http://localhost:8000/docs
2. Find the **Salesforce CRM Integration** section
3. Test the endpoints in this order:

#### a. Connect to Salesforce

- Click on `GET /api/crm/salesforce/connect`
- Click **Try it out**
- Enter `userId`: `test-user`
- Click **Execute**
- Copy the `authUrl` from the response
- Paste it in a new browser tab
- Login to Salesforce and click **Allow**
- You should be redirected back to the app (the callback will handle the token
  exchange)

#### b. Check Connection Status

- Click on `GET /api/crm/salesforce/status`
- Click **Try it out**
- Enter `userId`: `test-user`
- Click **Execute**
- You should see status: `CONNECTED` and your Salesforce details

#### c. Fetch Salesforce Data

- Try these endpoints with `userId: test-user`:
  - `GET /api/crm/salesforce/contacts` - Get all contacts
  - `GET /api/crm/salesforce/accounts` - Get all accounts
  - `GET /api/crm/salesforce/opportunities` - Get all opportunities
  - `GET /api/crm/salesforce/leads` - Get all leads

### Option 2: Using curl

```bash
# Step 1: Get authorization URL
curl "http://localhost:8000/api/crm/salesforce/connect?userId=test-user"

# Step 2: Open the returned authUrl in a browser, login, and authorize

# Step 3: Check status
curl "http://localhost:8000/api/crm/salesforce/status?userId=test-user"

# Step 4: Fetch contacts
curl "http://localhost:8000/api/crm/salesforce/contacts?userId=test-user&limit=10"

# Step 5: Fetch accounts
curl "http://localhost:8000/api/crm/salesforce/accounts?userId=test-user&limit=10"
```

### Option 3: View Database with Prisma Studio

```bash
pnpm db:studio:crm
```

Open http://localhost:5555 in your browser to view the Integration table and
stored OAuth tokens.

## Available API Endpoints

### Connection Management

- `GET /api/crm/salesforce/connect?userId={userId}` - Get OAuth authorization
  URL
- `GET /api/crm/salesforce/callback?code={code}&state={state}` - OAuth callback
  (handled automatically)
- `GET /api/crm/salesforce/status?userId={userId}` - Get connection status
- `DELETE /api/crm/salesforce/disconnect?userId={userId}` - Disconnect
  integration

### Data Retrieval

- `GET /api/crm/salesforce/contacts?userId={userId}&limit={limit}` - Get
  contacts
- `GET /api/crm/salesforce/accounts?userId={userId}&limit={limit}` - Get
  accounts
- `GET /api/crm/salesforce/opportunities?userId={userId}&limit={limit}` - Get
  opportunities
- `GET /api/crm/salesforce/leads?userId={userId}&limit={limit}` - Get leads

### Advanced Operations

- `POST /api/crm/salesforce/query` - Execute custom SOQL query

  ```json
  {
    "userId": "test-user",
    "soql": "SELECT Id, Name, Email FROM Contact WHERE Email != null LIMIT 5"
  }
  ```

- `POST /api/crm/salesforce/search` - Execute SOSL search
  ```json
  {
    "userId": "test-user",
    "searchQuery": "FIND {Acme} IN ALL FIELDS RETURNING Account(Id, Name), Contact(Id, Name)"
  }
  ```

## Adding Test Data in Salesforce

If your Salesforce account is empty:

1. Login to https://login.salesforce.com
2. Click the **App Launcher** (9 dots icon)
3. Search for and open **Sales** app
4. Create test data:
   - **Accounts**: Click Accounts tab → New → Fill in Account Name → Save
   - **Contacts**: Click Contacts tab → New → Fill in Name and Email → Save
   - **Opportunities**: Click Opportunities tab → New → Fill in details → Save
   - **Leads**: Click Leads tab → New → Fill in details → Save

## Architecture

The Salesforce integration follows the standard microservices pattern used
throughout the Pitch application:

```
┌─────────┐     ┌─────────────┐     ┌──────────┐     ┌──────────────┐     ┌────────────┐
│ Client  │────▶│   Gateway   │────▶│ RabbitMQ │────▶│ CRM Service  │────▶│ Salesforce │
│ (HTTP)  │     │ Controller  │     │          │     │  Controller  │     │    API     │
└─────────┘     └─────────────┘     └──────────┘     └──────────────┘     └────────────┘
                                                              │
                                                              ▼
                                                      ┌───────────────┐
                                                      │  PostgreSQL   │
                                                      │   Database    │
                                                      │ (OAuth Tokens)│
                                                      └───────────────┘
```

## Troubleshooting

### Error: "redirect_uri_mismatch"

- Ensure the callback URL in Salesforce Connected App matches exactly:
  `http://localhost:8000/api/crm/salesforce/callback`
- Ensure `SALESFORCE_REDIRECT_URI` in `.env` matches the same URL

### Error: "Table integrations does not exist"

- Run migrations:
  `cd apps/api && npx prisma migrate deploy --schema=./src/microservices/crm/prisma/schema.prisma`
- Regenerate client: `pnpm db:generate:crm`

### Error: "Salesforce integration not connected"

- You need to authorize first using the `/connect` endpoint
- Follow the OAuth flow to get tokens stored in the database

### OAuth Error 1800

- Go to Salesforce Connected App → Edit Policies
- Set "Permitted Users" to "All users may self-authorize"
- Set "IP Relaxation" to "Relax IP restrictions"
- Ensure PKCE is UNCHECKED

## Next Steps

- Review the full architecture documentation:
  `docs/architecture/MicroServices/CRM/README.md`
- Explore the Salesforce API capabilities:
  https://developer.salesforce.com/docs/apis
- Add custom SOQL queries for your specific use case
- Implement webhook listeners for real-time updates (future enhancement)

## Support

For issues or questions, refer to:

- Main README: `README.md`
- API Documentation: http://localhost:8000/docs (when server is running)
- Salesforce Developer Docs: https://developer.salesforce.com/docs
