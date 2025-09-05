# Backend Testing Guide

Comprehensive testing strategy for the PITCH API using Jest, Supertest, and modern testing practices.

## Testing Stack

- **Jest** - Testing framework
- **Supertest** - HTTP assertions
- **Test Containers** - Integration testing with real databases
- **Factory Bot** - Test data generation
- **MSW** - API mocking for external services

## Test Structure

```
src/
├── __tests__/           # Global test utilities
│   ├── setup.ts
│   ├── factories/
│   └── fixtures/
├── auth/
│   ├── auth.service.spec.ts
│   ├── auth.controller.spec.ts
│   └── __tests__/
├── users/
│   ├── users.service.spec.ts
│   └── users.controller.spec.ts
└── test/               # E2E tests
    ├── app.e2e-spec.ts
    └── auth.e2e-spec.ts
```

## Test Configuration

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/*.e2e-spec.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}
```

### Test Setup
```typescript
// src/__tests__/setup.ts
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { join } from 'path'

const prisma = new PrismaClient()

beforeAll(async () => {
  // Set up test database
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/pitch_test'
  
  // Run migrations
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  })

  await prisma.$connect()
})

beforeEach(async () => {
  // Clean database before each test
  await cleanDatabase()
})

afterAll(async () => {
  await prisma.$disconnect()
})

async function cleanDatabase() {
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `

  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`)
      } catch (error) {
        console.log({ error })
      }
    }
  }
}
```

## Unit Testing

### Service Testing
```typescript
// src/users/users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { UsersService } from './users.service'
import { PrismaService } from '../prisma/prisma.service'
import { UserFactory } from '../__tests__/factories/user.factory'
import { ConflictException, NotFoundException } from '@nestjs/common'

describe('UsersService', () => {
  let service: UsersService
  let prisma: PrismaService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile()

    service = module.get<UsersService>(UsersService)
    prisma = module.get<PrismaService>(PrismaService)
  })

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const users = UserFactory.buildList(3)
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue(users)

      const result = await service.findAll()

      expect(result.data).toEqual(users)
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should handle pagination correctly', async () => {
      const users = UserFactory.buildList(5)
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue(users)

      await service.findAll({ page: 2, limit: 5 })

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        take: 5,
        skip: 5,
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should apply search filter', async () => {
      const users = UserFactory.buildList(2)
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue(users)

      await service.findAll({ search: 'john' })

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'john', mode: 'insensitive' } },
            { email: { contains: 'john', mode: 'insensitive' } },
          ],
        },
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const user = UserFactory.build()
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(user)

      const result = await service.findOne(user.id)

      expect(result).toEqual(user)
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: user.id },
      })
    })

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null)

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException
      )
    })
  })

  describe('create', () => {
    it('should create a new user', async () => {
      const userData = UserFactory.build()
      const createdUser = { ...userData, id: 'new-id', createdAt: new Date(), updatedAt: new Date() }
      
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null) // Email doesn't exist
      jest.spyOn(prisma.user, 'create').mockResolvedValue(createdUser)

      const result = await service.create(userData)

      expect(result).toEqual(createdUser)
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: userData.email,
          name: userData.name,
        }),
      })
    })

    it('should throw ConflictException when email already exists', async () => {
      const userData = UserFactory.build()
      const existingUser = UserFactory.build({ email: userData.email })
      
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(existingUser)

      await expect(service.create(userData)).rejects.toThrow(ConflictException)
    })
  })

  describe('update', () => {
    it('should update an existing user', async () => {
      const user = UserFactory.build()
      const updateData = { name: 'Updated Name' }
      const updatedUser = { ...user, ...updateData, updatedAt: new Date() }

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(user)
      jest.spyOn(prisma.user, 'update').mockResolvedValue(updatedUser)

      const result = await service.update(user.id, updateData)

      expect(result).toEqual(updatedUser)
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: updateData,
      })
    })

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null)

      await expect(service.update('non-existent-id', {})).rejects.toThrow(
        NotFoundException
      )
    })
  })

  describe('remove', () => {
    it('should delete an existing user', async () => {
      const user = UserFactory.build()
      
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(user)
      jest.spyOn(prisma.user, 'delete').mockResolvedValue(user)

      await service.remove(user.id)

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: user.id },
      })
    })

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null)

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException
      )
    })
  })
})
```

### Controller Testing
```typescript
// src/users/users.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { UserFactory } from '../__tests__/factories/user.factory'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'

describe('UsersController', () => {
  let controller: UsersController
  let service: UsersService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true })
    .compile()

    controller = module.get<UsersController>(UsersController)
    service = module.get<UsersService>(UsersService)
  })

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const users = UserFactory.buildList(3)
      const paginatedResult = {
        data: users,
        meta: {
          page: 1,
          limit: 10,
          total: 3,
          totalPages: 1,
        },
      }

      jest.spyOn(service, 'findAll').mockResolvedValue(paginatedResult)

      const result = await controller.findAll({ page: 1, limit: 10 })

      expect(result).toEqual(paginatedResult)
      expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 })
    })
  })

  describe('findOne', () => {
    it('should return a single user', async () => {
      const user = UserFactory.build()
      jest.spyOn(service, 'findOne').mockResolvedValue(user)

      const result = await controller.findOne(user.id)

      expect(result).toEqual(user)
      expect(service.findOne).toHaveBeenCalledWith(user.id)
    })
  })

  describe('create', () => {
    it('should create a new user', async () => {
      const createUserDto = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      }
      const createdUser = UserFactory.build(createUserDto)

      jest.spyOn(service, 'create').mockResolvedValue(createdUser)

      const result = await controller.create(createUserDto)

      expect(result).toEqual(createdUser)
      expect(service.create).toHaveBeenCalledWith(createUserDto)
    })
  })

  describe('update', () => {
    it('should update an existing user', async () => {
      const user = UserFactory.build()
      const updateUserDto = { name: 'Updated Name' }
      const updatedUser = { ...user, ...updateUserDto }

      jest.spyOn(service, 'update').mockResolvedValue(updatedUser)

      const result = await controller.update(user.id, updateUserDto)

      expect(result).toEqual(updatedUser)
      expect(service.update).toHaveBeenCalledWith(user.id, updateUserDto)
    })
  })

  describe('remove', () => {
    it('should delete a user', async () => {
      const user = UserFactory.build()
      jest.spyOn(service, 'remove').mockResolvedValue(undefined)

      await controller.remove(user.id)

      expect(service.remove).toHaveBeenCalledWith(user.id)
    })
  })
})
```

## Test Factories

### User Factory
```typescript
// src/__tests__/factories/user.factory.ts
import { Factory } from 'fishery'
import { User, UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

export const UserFactory = Factory.define<User>(({ sequence, params }) => ({
  id: params.id || `user-${sequence}`,
  email: params.email || `user${sequence}@example.com`,
  name: params.name || `User ${sequence}`,
  password: params.password || bcrypt.hashSync('password123', 10),
  role: params.role || UserRole.USER,
  createdAt: params.createdAt || new Date(),
  updatedAt: params.updatedAt || new Date(),
}))

// Usage examples:
// const user = UserFactory.build()
// const admin = UserFactory.build({ role: UserRole.ADMIN })
// const users = UserFactory.buildList(5)
```

### Project Factory
```typescript
// src/__tests__/factories/project.factory.ts
import { Factory } from 'fishery'
import { Project, ProjectStatus } from '@prisma/client'

export const ProjectFactory = Factory.define<Project>(({ sequence, params }) => ({
  id: params.id || `project-${sequence}`,
  title: params.title || `Project ${sequence}`,
  description: params.description || `Description for project ${sequence}`,
  status: params.status || ProjectStatus.DRAFT,
  ownerId: params.ownerId || `user-${sequence}`,
  createdAt: params.createdAt || new Date(),
  updatedAt: params.updatedAt || new Date(),
}))
```

## Integration Testing

### Database Testing with Test Containers
```typescript
// src/__tests__/test-database.ts
import { Test } from '@nestjs/testing'
import { GenericContainer, StartedTestContainer } from 'testcontainers'
import { PrismaService } from '../prisma/prisma.service'
import { execSync } from 'child_process'

export class TestDatabase {
  private container: StartedTestContainer
  private prismaService: PrismaService

  async start(): Promise<void> {
    // Start PostgreSQL container
    this.container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'test',
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
      })
      .withExposedPorts(5432)
      .start()

    const port = this.container.getMappedPort(5432)
    const databaseUrl = `postgresql://test:test@localhost:${port}/test`

    // Set environment variable
    process.env.DATABASE_URL = databaseUrl

    // Run migrations
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: databaseUrl },
    })

    // Create Prisma service
    const module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile()

    this.prismaService = module.get<PrismaService>(PrismaService)
    await this.prismaService.$connect()
  }

  async cleanup(): Promise<void> {
    if (this.prismaService) {
      await this.prismaService.$disconnect()
    }
    if (this.container) {
      await this.container.stop()
    }
  }

  async seed(): Promise<void> {
    // Add seed data for integration tests
    const users = await Promise.all([
      this.prismaService.user.create({
        data: UserFactory.build({ email: 'test1@example.com' }),
      }),
      this.prismaService.user.create({
        data: UserFactory.build({ email: 'test2@example.com' }),
      }),
    ])

    await Promise.all(
      users.map((user) =>
        this.prismaService.project.create({
          data: ProjectFactory.build({ ownerId: user.id }),
        })
      )
    )
  }

  get prisma(): PrismaService {
    return this.prismaService
  }
}
```

### Integration Test Example
```typescript
// src/users/users.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { UsersModule } from './users.module'
import { PrismaModule } from '../prisma/prisma.module'
import { TestDatabase } from '../__tests__/test-database'
import { UserFactory } from '../__tests__/factories/user.factory'
import * as request from 'supertest'

describe('Users Integration', () => {
  let app: INestApplication
  let testDb: TestDatabase

  beforeAll(async () => {
    testDb = new TestDatabase()
    await testDb.start()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [UsersModule, PrismaModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
    await testDb.cleanup()
  })

  beforeEach(async () => {
    await testDb.seed()
  })

  describe('/users (GET)', () => {
    it('should return paginated users', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .expect(200)

      expect(response.body).toHaveProperty('data')
      expect(response.body).toHaveProperty('meta')
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.meta).toHaveProperty('page')
      expect(response.body.meta).toHaveProperty('total')
    })

    it('should filter users by search query', async () => {
      const response = await request(app.getHttpServer())
        .get('/users?search=test1')
        .expect(200)

      expect(response.body.data.length).toBeGreaterThan(0)
      expect(
        response.body.data.some((user) =>
          user.email.includes('test1') || user.name.includes('test1')
        )
      ).toBe(true)
    })
  })

  describe('/users/:id (GET)', () => {
    it('should return a user by id', async () => {
      const user = await testDb.prisma.user.findFirst()

      const response = await request(app.getHttpServer())
        .get(`/users/${user.id}`)
        .expect(200)

      expect(response.body.id).toBe(user.id)
      expect(response.body.email).toBe(user.email)
      expect(response.body).not.toHaveProperty('password')
    })

    it('should return 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .get('/users/non-existent-id')
        .expect(404)
    })
  })

  describe('/users (POST)', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'newuser@example.com',
        name: 'New User',
        password: 'password123',
      }

      const response = await request(app.getHttpServer())
        .post('/users')
        .send(userData)
        .expect(201)

      expect(response.body.email).toBe(userData.email)
      expect(response.body.name).toBe(userData.name)
      expect(response.body).not.toHaveProperty('password')

      // Verify user was created in database
      const createdUser = await testDb.prisma.user.findUnique({
        where: { id: response.body.id },
      })
      expect(createdUser).toBeTruthy()
    })

    it('should return 409 for duplicate email', async () => {
      const existingUser = await testDb.prisma.user.findFirst()
      
      await request(app.getHttpServer())
        .post('/users')
        .send({
          email: existingUser.email,
          name: 'Duplicate User',
          password: 'password123',
        })
        .expect(409)
    })

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({})
        .expect(400)
    })
  })
})
```

## E2E Testing

### E2E Test Setup
```typescript
// test/app.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'
import { TestDatabase } from '../src/__tests__/test-database'
import * as request from 'supertest'

describe('AppController (e2e)', () => {
  let app: INestApplication
  let testDb: TestDatabase

  beforeEach(async () => {
    testDb = new TestDatabase()
    await testDb.start()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    await app.close()
    await testDb.cleanup()
  })

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!')
  })

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'healthy')
        expect(res.body).toHaveProperty('timestamp')
      })
  })
})
```

### Authentication E2E Tests
```typescript
// test/auth.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { AppModule } from '../src/app.module'
import { TestDatabase } from '../src/__tests__/test-database'
import { UserFactory } from '../src/__tests__/factories/user.factory'
import * as request from 'supertest'
import * as bcrypt from 'bcryptjs'

describe('Authentication (e2e)', () => {
  let app: INestApplication
  let testDb: TestDatabase

  beforeEach(async () => {
    testDb = new TestDatabase()
    await testDb.start()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    await app.close()
    await testDb.cleanup()
  })

  describe('/auth/signup (POST)', () => {
    it('should create a new user account', async () => {
      const signupData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      }

      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(signupData)
        .expect(201)

      expect(response.body).toHaveProperty('accessToken')
      expect(response.body).toHaveProperty('refreshToken')
      expect(response.body).toHaveProperty('user')
      expect(response.body.user.email).toBe(signupData.email)
      expect(response.body.user).not.toHaveProperty('password')
    })

    it('should reject duplicate email', async () => {
      const signupData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      }

      // Create user first time
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send(signupData)
        .expect(201)

      // Try to create again
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send(signupData)
        .expect(409)
    })
  })

  describe('/auth/signin (POST)', () => {
    beforeEach(async () => {
      // Create a test user
      await testDb.prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          password: await bcrypt.hash('password123', 10),
        },
      })
    })

    it('should authenticate with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200)

      expect(response.body).toHaveProperty('accessToken')
      expect(response.body).toHaveProperty('refreshToken')
      expect(response.body).toHaveProperty('user')
    })

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/signin')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401)
    })

    it('should reject non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/auth/signin')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401)
    })
  })

  describe('Protected routes', () => {
    let accessToken: string
    let user: any

    beforeEach(async () => {
      // Sign up and get token
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })

      accessToken = response.body.accessToken
      user = response.body.user
    })

    it('should allow access with valid token', async () => {
      await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
    })

    it('should deny access without token', async () => {
      await request(app.getHttpServer())
        .get('/users/profile')
        .expect(401)
    })

    it('should deny access with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
    })
  })
})
```

## Performance Testing

### Load Testing
```typescript
// src/__tests__/performance/load.spec.ts
import { Test } from '@nestjs/testing'
import { AppModule } from '../../app.module'
import { TestDatabase } from '../test-database'
import * as request from 'supertest'

describe('Performance Tests', () => {
  let testDb: TestDatabase
  let app: any

  beforeAll(async () => {
    testDb = new TestDatabase()
    await testDb.start()
    await testDb.seed()

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
    await testDb.cleanup()
  })

  it('should handle concurrent user requests', async () => {
    const concurrentRequests = 10
    const promises = []

    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        request(app.getHttpServer())
          .get('/users')
          .expect(200)
      )
    }

    const start = Date.now()
    await Promise.all(promises)
    const duration = Date.now() - start

    console.log(`${concurrentRequests} concurrent requests took ${duration}ms`)
    expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
  })

  it('should handle database queries efficiently', async () => {
    const start = Date.now()

    await request(app.getHttpServer())
      .get('/users?limit=100')
      .expect(200)

    const duration = Date.now() - start
    console.log(`Large query took ${duration}ms`)
    expect(duration).toBeLessThan(1000) // Should complete within 1 second
  })
})
```

## Mocking External Services

### MSW Setup for External APIs
```typescript
// src/__tests__/mocks/handlers.ts
import { rest } from 'msw'

export const handlers = [
  // Mock external email service
  rest.post('https://api.emailservice.com/send', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        messageId: 'mock-message-id',
      })
    )
  }),

  // Mock external payment API
  rest.post('https://api.payments.com/charge', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: 'mock-charge-id',
        status: 'succeeded',
        amount: 1000,
      })
    )
  }),

  // Error scenarios
  rest.post('https://api.emailservice.com/send-error', (req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({
        error: 'Internal server error',
      })
    )
  }),
]
```

```typescript
// src/__tests__/mocks/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

```typescript
// src/__tests__/setup.ts
import { server } from './mocks/server'

// Enable API mocking before tests
beforeAll(() => server.listen())

// Reset any runtime request handlers
afterEach(() => server.resetHandlers())

// Disable API mocking after tests
afterAll(() => server.close())
```

## Test Coverage and Reporting

### Coverage Configuration
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "test:all": "npm run test && npm run test:e2e"
  }
}
```

### CI/CD Integration
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: pitch_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run database migrations
        run: pnpm exec prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/pitch_test
      
      - name: Run unit tests
        run: pnpm test:coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/pitch_test
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run E2E tests
        run: pnpm test:e2e
```

## Best Practices

1. **Test Structure**: Follow AAA pattern (Arrange, Act, Assert)
2. **Test Isolation**: Each test should be independent
3. **Mock External Dependencies**: Don't rely on external services
4. **Use Factories**: Generate test data consistently
5. **Clean Database**: Reset state between tests
6. **Test Edge Cases**: Include error scenarios
7. **Performance Testing**: Test under load
8. **Coverage Goals**: Aim for 80%+ coverage
9. **Fast Tests**: Keep unit tests under 1 second
10. **Clear Test Names**: Describe what is being tested