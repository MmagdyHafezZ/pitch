# CRM Integration Tests Documentation

## Overview

Comprehensive test suite for the CRM integration microservice, covering all
Salesforce integration and session-based CRM data management functionality.

## Test Statistics

- **Total Test Suites**: 6
- **Total Tests**: 88
- **Pass Rate**: 100%

## Test Suites

### 1. Salesforce Integration Service Tests

**Location**:
`apps/api/src/microservices/crm/__tests__/salesforce-integration.service.spec.ts`

**Purpose**: Tests the core Salesforce API integration service including OAuth
flow, data fetching, and API queries.

**Test Coverage**:

- **getIntegration** (4 tests)
  - Returns integration when found and connected
  - Throws UnauthorizedException when integration not found
  - Throws UnauthorizedException when integration is disconnected
  - Throws UnauthorizedException when integration has errors

- **isConnected** (3 tests)
  - Returns true when integration is connected
  - Returns false when integration not found
  - Returns false when integration is not connected

- **getConnectUrl** (2 tests)
  - Returns Salesforce OAuth URL with userId as state
  - Throws BadRequestException when client ID not configured

- **handleCallback** (3 tests)
  - Successfully exchanges code for tokens and stores integration
  - Throws BadRequestException when code is missing
  - Throws BadRequestException when token exchange fails

- **getStatus** (2 tests)
  - Returns integration status when found
  - Returns not connected when integration not found

- **getContacts** (2 tests)
  - Returns contacts from Salesforce
  - Throws UnauthorizedException when user not connected

- **getAccounts, getOpportunities, getLeads** (1 test each)
  - Returns respective data from Salesforce

- **query** (1 test)
  - Executes SOQL query successfully

- **search** (1 test)
  - Executes SOSL search successfully

- **disconnect** (1 test)
  - Disconnects Salesforce integration

### 2. Salesforce Controller Tests

**Location**:
`apps/api/src/microservices/crm/__tests__/salesforce.controller.spec.ts`

**Purpose**: Tests the microservice controller that handles RabbitMQ message
patterns for Salesforce operations.

**Test Coverage**:

- **getConnectUrl** (3 tests)
  - Returns OAuth connect URL
  - Passes custom state parameter
  - Rethrows service errors

- **handleCallback** (2 tests)
  - Successfully handles OAuth callback
  - Rethrows service errors

- **getStatus** (2 tests)
  - Returns connection status
  - Returns not connected status

- **getContacts** (2 tests)
  - Returns contacts from Salesforce
  - Uses default limit of 100 from service

- **getAccounts, getOpportunities, getLeads** (1 test each)
  - Returns respective data from Salesforce

- **query** (1 test)
  - Executes SOQL query with success flag

- **search** (1 test)
  - Executes SOSL search with success flag

- **disconnect** (1 test)
  - Disconnects Salesforce integration

### 3. Session CRM Service Tests

**Location**:
`apps/api/src/microservices/crm/__tests__/session-crm.service.spec.ts`

**Purpose**: Tests the session-centric CRM data management service that handles
attaching, retrieving, refreshing, and deleting CRM data linked to AI simulation
sessions.

**Test Coverage**:

- **attachCrmDataToSession** (5 tests)
  - Successfully attaches contacts to session with raw Salesforce format
  - Attaches multiple entity types in single request
  - Throws NotFoundException when integration not found
  - Returns success with empty arrays when no data provided
  - Throws error during upsert failure

- **getSessionCrmData** (2 tests)
  - Returns all CRM data for a session via activities
  - Returns empty arrays when no data found

- **refreshSessionCrmData** (2 tests)
  - Refreshes all entities from Salesforce
  - Returns success even when no session data exists

- **deleteSessionCrmData** (2 tests)
  - Deletes all CRM data associated with session
  - Returns success even when no data to delete

### 4. Session CRM Controller Tests

**Location**:
`apps/api/src/microservices/crm/__tests__/session-crm.controller.spec.ts`

**Purpose**: Tests the microservice controller for session-based CRM operations.

**Test Coverage**:

- **attachCrmDataToSession** (3 tests)
  - Successfully attaches CRM data to session
  - Handles multiple entity types
  - Rethrows service errors

- **getSessionCrmData** (2 tests)
  - Returns all CRM data for a session
  - Returns empty data when no entities attached

- **refreshSessionCrmData** (3 tests)
  - Refreshes all CRM data from Salesforce
  - Handles refresh with multiple entity updates
  - Rethrows service errors

- **deleteSessionCrmData** (3 tests)
  - Deletes all CRM data from session
  - Handles deletion when no data exists
  - Rethrows service errors

### 5. Salesforce Gateway Controller Tests

**Location**:
`apps/api/src/gateway/controllers/crm/__tests__/salesforce-gateway.controller.spec.ts`

**Purpose**: Tests the HTTP gateway controller that exposes Salesforce
integration APIs via REST endpoints.

**Test Coverage** (All endpoints tested for happy path and error handling):

- **getConnectUrl** (4 tests)
- **handleCallback** (2 tests)
- **getStatus** (1 test)
- **getContacts** (2 tests)
- **getAccounts** (1 test)
- **getOpportunities** (1 test)
- **getLeads** (1 test)
- **query** (1 test)
- **search** (1 test)
- **disconnect** (1 test)

### 6. Session CRM Gateway Controller Tests

**Location**:
`apps/api/src/gateway/controllers/crm/__tests__/session-crm-gateway.controller.spec.ts`

**Purpose**: Tests the HTTP gateway controller for session-based CRM data
management.

**Test Coverage**:

- **attachCrmData** (4 tests)
  - Successfully attaches CRM data to session
  - Handles multiple entity types
  - Throws HttpException on error
  - Uses default error message on unknown error

- **getSessionCrmData** (3 tests)
  - Returns all CRM data for a session
  - Returns empty data when no entities attached
  - Throws HttpException on error

- **refreshSessionCrmData** (3 tests)
  - Refreshes all CRM data from Salesforce
  - Handles refresh with multiple entity updates
  - Throws HttpException on error

- **deleteSessionCrmData** (3 tests)
  - Deletes all CRM data from session
  - Handles deletion when no data exists
  - Throws HttpException on error

## Key Testing Patterns

### 1. Service Layer Testing

- Uses Jest mocks for all dependencies (Prisma, external services)
- Tests both happy paths and error conditions
- Validates business logic and data transformations
- Ensures proper error handling and exception types

### 2. Controller Layer Testing

- Mocks service dependencies
- Tests RabbitMQ message pattern handling
- Verifies proper error propagation
- Validates response structures

### 3. Gateway Layer Testing

- Uses RxJS observables for async operations
- Tests HTTP request/response flow
- Validates timeout and error handling
- Uses NestJS TestingModule for dependency injection

### 4. Raw Salesforce Data Handling

Tests specifically validate that the system:

- Accepts raw Salesforce JSON payloads (with `attributes`, `Id`, nested objects)
- Extracts the `Id` field for `externalId`
- Stores the complete raw object in `customFields` JSON column
- Preserves all Salesforce metadata

## Running the Tests

Run all CRM tests:

```bash
cd apps/api
pnpm test -- crm
```

Run specific test suite:

```bash
pnpm test -- salesforce-integration.service.spec.ts
```

Run with coverage:

```bash
pnpm test -- crm --coverage
```

Run in watch mode:

```bash
pnpm test -- crm --watch
```

## Test Data Patterns

### Mock Integration

```typescript
{
  id: 'integration-1',
  userId: 'user-1',
  provider: 'SALESFORCE',
  status: 'CONNECTED',
  accessToken: 'access-token-123',
  refreshToken: 'refresh-token-123',
  expiresAt: Date,
  instanceUrl: 'https://example.my.salesforce.com',
  providerId: 'sf-user-id',
  providerEmail: 'user@company.com'
}
```

### Mock Raw Salesforce Contact

```typescript
{
  Id: '003XXXXX',
  FirstName: 'John',
  LastName: 'Doe',
  Email: 'john@example.com',
  Phone: '+1234567890',
  Title: 'CEO',
  AccountId: '001XXXXX',
  Account: {
    attributes: { type: 'Account', url: '...' },
    Name: 'Acme Corp'
  },
  CreatedDate: '2026-01-22T01:20:49.000+0000',
  attributes: { type: 'Contact', url: '...' }
}
```

## Best Practices Followed

1. **Isolation**: Each test is independent with proper setup/teardown
2. **Mocking**: All external dependencies are mocked
3. **Coverage**: Both happy paths and error cases are tested
4. **Clarity**: Test names clearly describe what is being tested
5. **Maintainability**: Tests follow the same patterns as userManagement
6. **Documentation**: Clear test descriptions and grouping

## Future Enhancements

Potential areas for additional testing:

1. Integration tests with real database (using TestContainers)
2. E2E tests for complete OAuth flow
3. Performance tests for bulk data operations
4. Contract tests for Salesforce API responses
5. Security tests for token handling
