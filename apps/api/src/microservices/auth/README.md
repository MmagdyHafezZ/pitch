# Authentication Microservice

A comprehensive JWT-based authentication microservice built with NestJS, Prisma, and RabbitMQ.

## Features

- **User Registration & Login** - Secure user authentication
- **JWT Tokens** - Access and refresh token implementation
- **Password Security** - Bcrypt hashing with salt rounds
- **Database Integration** - Prisma ORM with PostgreSQL
- **Microservice Architecture** - RabbitMQ message patterns
- **API docs** - Swagger/OpenAPI integration
- **TypeScript** - Full type safety

## Architecture

### Database Schema

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Message Patterns

- `auth.register` - User registration
- `auth.login` - User authentication
- `auth.logout` - User logout
- `auth.refresh` - Token refresh
- `auth.getUser` - Get user profile
- `auth.validateUser` - Validate user credentials

### HTTP Endpoints

#### Authentication Routes (`/api/v1/auth`)

| Method | Endpoint    | Description              | Auth Required |
| ------ | ----------- | ------------------------ | ------------- |
| POST   | `/register` | Register new user        | No            |
| POST   | `/login`    | Login user               | No            |
| POST   | `/refresh`  | Refresh access token     | No            |
| POST   | `/logout`   | Logout user              | Yes           |
| GET    | `/me`       | Get current user profile | Yes           |
| GET    | `/validate` | Validate token           | Yes           |

## Setup Instructions

### 1. Environment Variables

Add to your `.env` file:

```env
# Auth Database
AUTH_DATABASE_URL="postgresql://username:password@localhost:5432/pitch_auth_db"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-here"
JWT_REFRESH_EXPIRES_IN="7d"

# RabbitMQ (if not already configured)
RABBITMQ_URL="amqp://admin:admin123@localhost:5672"
```

### 2. Database Setup

```bash
# Navigate to auth microservice
cd src/microservices/auth

# Generate Prisma client
npx prisma generate --schema=./prisma/schema.prisma

# Create database and run migrations
npx prisma db push --schema=./prisma/schema.prisma

# Optional: Open Prisma Studio
npx prisma studio --schema=./prisma/schema.prisma
```

### 3. Start the Application

The auth microservice will automatically start when you run the main application:

```bash
# From the API root directory
pnpm run start:dev
```

## Usage Examples

### Frontend Integration

The frontend can use these endpoints through the API gateway:

```typescript
// Register
const registerResponse = await fetch('/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword',
    name: 'John Doe',
  }),
});

// Login
const loginResponse = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword',
  }),
});

const { token, refreshToken, user } = await loginResponse.json();

// Protected requests
const profileResponse = await fetch('/api/v1/auth/me', {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
```

### Microservice Communication

Other microservices can validate users:

```typescript
// In another microservice
@Injectable()
export class SomeService {
  constructor(@Inject('AUTH_SERVICE') private authService: ClientProxy) {}

  async validateUser(userId: string) {
    return this.authService.send('auth.getUser', { userId });
  }
}
```

## Security Features

- **Password Hashing** - Bcrypt with 12 salt rounds
- **JWT Tokens** - Signed with configurable secrets
- **Token Expiration** - Configurable access and refresh token lifetimes
- **Refresh Token Rotation** - New refresh tokens on each refresh
- **Token Cleanup** - Automatic cleanup of expired tokens
- **Input Validation** - DTOs with class-validator
- **Account Status** - User deactivation support

## Error Handling

The service provides detailed error messages:

- **409 Conflict** - User already exists
- **401 Unauthorized** - Invalid credentials or tokens
- **404 Not Found** - User not found
- **400 Bad Request** - Invalid input data

## Guards and Decorators

### JWT Auth Guard

```typescript
@UseGuards(JwtAuthGuard)
@Controller('protected')
export class ProtectedController {
  // All routes require authentication
}
```

### Public Routes

```typescript
@Public() // Skip authentication
@Post('login')
async login() {
  // This route is public
}
```

### Current User

```typescript
@Get('profile')
async getProfile(@CurrentUser() user: UserResponseDto) {
  return user; // Automatically injected authenticated user
}
```

## Development

### Database Schema Changes

When modifying the Prisma schema:

```bash
cd src/microservices/auth

# Apply changes to database
npx prisma db push --schema=./prisma/schema.prisma

# Generate new client
npx prisma generate --schema=./prisma/schema.prisma
```

### Adding New Endpoints

1. Add message pattern to `auth.controller.ts`
2. Implement business logic in `auth.service.ts`
3. Add HTTP endpoint to `auth-gateway.controller.ts`
4. Update DTOs if needed

## Testing

```bash
# Test registration
curl -X POST http://localhost:8001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'

# Test login
curl -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## Production Considerations

- Use strong JWT secrets (minimum 256-bit)
- Configure appropriate token expiration times
- Set up database connection pooling
- Implement rate limiting
- Add request logging
- Configure HTTPS only
- Set up proper CORS policies
- Monitor authentication events
