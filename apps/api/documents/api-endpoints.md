# API Endpoints Documentation

Comprehensive documentation for all REST API endpoints and tRPC procedures.

## Authentication

### Base URL
- **Development**: `http://localhost:3001`
- **Staging**: `https://api-staging.yourdomain.com`
- **Production**: `https://api.yourdomain.com`

### Authentication Headers
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## REST API Endpoints

### Health Check

#### GET /health
Check API health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": "connected",
  "redis": "connected"
}
```

### Authentication

#### POST /auth/signin
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clw123456789",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Invalid credentials
- `422` - Validation error

#### POST /auth/signup
Register a new user account.

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "Jane Doe"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clw123456790",
    "email": "newuser@example.com",
    "name": "Jane Doe",
    "role": "USER"
  }
}
```

#### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST /auth/logout
Logout and invalidate tokens.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "message": "Successfully logged out"
}
```

### Users

#### GET /users/profile
Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": "clw123456789",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "USER",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

#### PUT /users/profile
Update current user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "John Smith",
  "email": "johnsmith@example.com"
}
```

**Response:**
```json
{
  "id": "clw123456789",
  "email": "johnsmith@example.com",
  "name": "John Smith",
  "role": "USER",
  "updatedAt": "2024-01-15T10:35:00.000Z"
}
```

#### GET /users
Get list of users (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by name or email
- `role` (optional): Filter by role

**Response:**
```json
{
  "data": [
    {
      "id": "clw123456789",
      "email": "user1@example.com",
      "name": "User One",
      "role": "USER",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

#### GET /users/:id
Get user by ID (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `id`: User ID

**Response:**
```json
{
  "id": "clw123456789",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "USER",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

#### DELETE /users/:id
Delete user by ID (Admin only).

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `id`: User ID

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

### Projects

#### GET /projects
Get list of projects for current user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status

**Response:**
```json
{
  "data": [
    {
      "id": "clp123456789",
      "title": "Project Alpha",
      "description": "A sample project",
      "status": "ACTIVE",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "owner": {
        "id": "clw123456789",
        "name": "John Doe"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

#### POST /projects
Create a new project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "New Project",
  "description": "Project description",
  "status": "DRAFT"
}
```

**Response:**
```json
{
  "id": "clp123456790",
  "title": "New Project",
  "description": "Project description",
  "status": "DRAFT",
  "createdAt": "2024-01-15T10:40:00.000Z",
  "updatedAt": "2024-01-15T10:40:00.000Z",
  "ownerId": "clw123456789"
}
```

#### GET /projects/:id
Get project by ID.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `id`: Project ID

**Response:**
```json
{
  "id": "clp123456789",
  "title": "Project Alpha",
  "description": "A sample project",
  "status": "ACTIVE",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "owner": {
    "id": "clw123456789",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### PUT /projects/:id
Update project by ID.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `id`: Project ID

**Request Body:**
```json
{
  "title": "Updated Project Title",
  "description": "Updated description",
  "status": "COMPLETED"
}
```

**Response:**
```json
{
  "id": "clp123456789",
  "title": "Updated Project Title",
  "description": "Updated description",
  "status": "COMPLETED",
  "updatedAt": "2024-01-15T10:45:00.000Z"
}
```

#### DELETE /projects/:id
Delete project by ID.

**Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `id`: Project ID

**Response:**
```json
{
  "message": "Project deleted successfully"
}
```

## tRPC Procedures

### Usage
```typescript
import { trpc } from '@/lib/trpc'

// In React component
const { data: users } = trpc.users.list.useQuery()
const createUser = trpc.users.create.useMutation()
```

### User Procedures

#### users.list
Get list of users.

**Input:**
```typescript
{
  page?: number
  limit?: number
  search?: string
  role?: UserRole
}
```

**Output:**
```typescript
{
  data: User[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
```

#### users.byId
Get user by ID.

**Input:**
```typescript
{
  id: string
}
```

**Output:**
```typescript
User | null
```

#### users.create
Create new user.

**Input:**
```typescript
{
  email: string
  name: string
  password: string
  role?: UserRole
}
```

**Output:**
```typescript
User
```

#### users.update
Update user.

**Input:**
```typescript
{
  id: string
  data: {
    email?: string
    name?: string
    role?: UserRole
  }
}
```

**Output:**
```typescript
User
```

#### users.delete
Delete user.

**Input:**
```typescript
{
  id: string
}
```

**Output:**
```typescript
{ success: boolean }
```

### Project Procedures

#### projects.list
Get projects for current user.

**Input:**
```typescript
{
  page?: number
  limit?: number
  status?: ProjectStatus
}
```

**Output:**
```typescript
{
  data: Project[]
  meta: PaginationMeta
}
```

#### projects.byId
Get project by ID.

**Input:**
```typescript
{
  id: string
}
```

**Output:**
```typescript
Project | null
```

#### projects.create
Create new project.

**Input:**
```typescript
{
  title: string
  description?: string
  status?: ProjectStatus
}
```

**Output:**
```typescript
Project
```

#### projects.update
Update project.

**Input:**
```typescript
{
  id: string
  data: {
    title?: string
    description?: string
    status?: ProjectStatus
  }
}
```

**Output:**
```typescript
Project
```

#### projects.delete
Delete project.

**Input:**
```typescript
{
  id: string
}
```

**Output:**
```typescript
{ success: boolean }
```

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/users/create"
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `BAD_REQUEST` | 400 | Invalid request |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |

## Rate Limiting

### Limits
- **General API**: 100 requests per minute per IP
- **Authentication**: 10 requests per minute per IP
- **File uploads**: 5 requests per minute per user

### Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705320600
```

## Pagination

### Standard Pagination
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Cursor-based Pagination (for real-time data)
```json
{
  "data": [...],
  "meta": {
    "cursor": "eyJpZCI6IjEyMyIsImNyZWF0ZWRBdCI6IjIwMjQtMDEtMTUifQ==",
    "hasMore": true,
    "limit": 20
  }
}
```

## Webhooks

### Webhook Events
- `user.created`
- `user.updated` 
- `user.deleted`
- `project.created`
- `project.updated`
- `project.deleted`

### Webhook Payload
```json
{
  "event": "user.created",
  "data": {
    "id": "clw123456789",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "webhook_id": "whk_123456789"
}
```

## API Versioning

### URL Versioning
```
GET /v1/users
GET /v2/users
```

### Header Versioning
```http
API-Version: v1
Accept: application/vnd.api+json;version=1
```

## OpenAPI/Swagger Documentation

Interactive API documentation available at:
- **Development**: `http://localhost:3001/api/docs`
- **Staging**: `https://api-staging.yourdomain.com/api/docs`

## Postman Collection

Download the Postman collection: [Download Link](./postman-collection.json)

### Environment Variables
```json
{
  "baseUrl": "http://localhost:3001",
  "authToken": "{{jwt_token}}"
}
```