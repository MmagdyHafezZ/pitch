# Database Guide

Comprehensive guide for database schema, migrations, and data management using Prisma ORM with multiple database systems.

## Database Architecture

The PITCH API uses a multi-database approach:

- **PostgreSQL** - Primary database for user data and authentication
- **MongoDB** - Business logic and document storage
- **Redis** - Caching and session management

## Database Setup

### Environment Configuration

```env
# PostgreSQL (User microservice)
DATABASE_URL="postgresql://username:password@localhost:5432/pitch_users"

# MongoDB (Business microservice)
MONGODB_URL="mongodb://localhost:27017/pitch_business"

# Redis (Caching)
REDIS_URL="redis://localhost:6380"

# Test databases
TEST_DATABASE_URL="postgresql://username:password@localhost:5432/pitch_test"
TEST_MONGODB_URL="mongodb://localhost:27017/pitch_business_test"
```

### Docker Setup

Start databases using Docker Compose:

```bash
# Start all databases
docker-compose up -d postgresql mongodb redis

# View running containers
docker ps
```

## Migrations

### Creating Migrations

```bash
# Create and apply a new migration
npx prisma migrate dev --name add_users_table

# Apply migrations without generating a new one
npx prisma migrate dev

# Reset database (destructive - development only)
npx prisma migrate reset

# Deploy migrations to production
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

### Migration Files Structure

```
prisma/
├── migrations/
│   ├── 20240115100000_init/
│   │   └── migration.sql
│   ├── 20240116120000_add_projects/
│   │   └── migration.sql
│   └── migration_lock.toml
└── schema.prisma
```

### Example Migration

```sql
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

## Prisma Client Usage

### Client Generation

```bash
# Generate Prisma client
npx prisma generate

# Watch for schema changes
npx prisma generate --watch
```

### Basic Operations

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

const prisma = globalThis.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export { prisma };
```

### CRUD Operations

```typescript
// Create
const user = await prisma.user.create({
  data: {
    email: 'john@example.com',
    name: 'John Doe',
    password: await hash('password123'),
    role: 'USER',
  },
});

// Read
const users = await prisma.user.findMany({
  where: {
    role: 'USER',
  },
  include: {
    projects: true,
  },
  orderBy: {
    createdAt: 'desc',
  },
});

const user = await prisma.user.findUnique({
  where: {
    email: 'john@example.com',
  },
});

// Update
const updatedUser = await prisma.user.update({
  where: {
    id: userId,
  },
  data: {
    name: 'John Smith',
    updatedAt: new Date(),
  },
});

// Delete
await prisma.user.delete({
  where: {
    id: userId,
  },
});

// Upsert
const user = await prisma.user.upsert({
  where: {
    email: 'john@example.com',
  },
  create: {
    email: 'john@example.com',
    name: 'John Doe',
    password: hashedPassword,
  },
  update: {
    name: 'John Doe',
  },
});
```

### Advanced Queries

```typescript
// Complex filtering
const projects = await prisma.project.findMany({
  where: {
    AND: [
      {
        status: 'ACTIVE',
      },
      {
        OR: [
          {
            title: {
              contains: 'important',
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: 'urgent',
              mode: 'insensitive',
            },
          },
        ],
      },
    ],
  },
  include: {
    owner: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    tasks: {
      where: {
        status: 'TODO',
      },
      orderBy: {
        priority: 'desc',
      },
    },
  },
});

// Aggregation
const stats = await prisma.project.aggregate({
  where: {
    ownerId: userId,
  },
  _count: {
    id: true,
  },
  _avg: {
    tasksCount: true,
  },
});

// Group by
const projectsByStatus = await prisma.project.groupBy({
  by: ['status'],
  _count: {
    id: true,
  },
  having: {
    id: {
      _count: {
        gt: 0,
      },
    },
  },
});

// Raw queries (when needed)
const result = await prisma.$queryRaw`
  SELECT p.*, COUNT(t.id) as task_count
  FROM projects p
  LEFT JOIN tasks t ON p.id = t.project_id
  WHERE p.owner_id = ${userId}
  GROUP BY p.id
  ORDER BY task_count DESC
  LIMIT 10
`;
```

### Transactions

```typescript
// Sequential transactions
const result = await prisma.$transaction(async (tx) => {
  // Create user
  const user = await tx.user.create({
    data: {
      email: 'john@example.com',
      name: 'John Doe',
      password: hashedPassword,
    },
  });

  // Create initial project
  const project = await tx.project.create({
    data: {
      title: 'Welcome Project',
      description: 'Your first project',
      ownerId: user.id,
    },
  });

  // Create sample task
  await tx.task.create({
    data: {
      title: 'Complete profile',
      projectId: project.id,
      assignedToId: user.id,
    },
  });

  return { user, project };
});

// Batch transactions
await prisma.$transaction([
  prisma.user.create({ data: userData1 }),
  prisma.user.create({ data: userData2 }),
  prisma.project.create({ data: projectData }),
]);
```

## Database Seeding

### Seed Script

```typescript
// prisma/seed.ts
import { PrismaClient, UserRole, ProjectStatus } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@pitch.com' },
    update: {},
    create: {
      email: 'admin@pitch.com',
      name: 'Admin User',
      password: await hash('admin123', 10),
      role: UserRole.ADMIN,
    },
  });

  // Create regular users
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'john@example.com' },
      update: {},
      create: {
        email: 'john@example.com',
        name: 'John Doe',
        password: await hash('password123', 10),
        role: UserRole.USER,
      },
    }),
    prisma.user.upsert({
      where: { email: 'jane@example.com' },
      update: {},
      create: {
        email: 'jane@example.com',
        name: 'Jane Smith',
        password: await hash('password123', 10),
        role: UserRole.USER,
      },
    }),
  ]);

  // Create sample projects
  const projects = await Promise.all(
    users.flatMap((user) =>
      [
        {
          title: `${user.name}'s Project 1`,
          description: 'A sample project for development',
          status: ProjectStatus.ACTIVE,
          ownerId: user.id,
        },
        {
          title: `${user.name}'s Project 2`,
          description: 'Another sample project',
          status: ProjectStatus.DRAFT,
          ownerId: user.id,
        },
      ].map((projectData) => prisma.project.create({ data: projectData })),
    ),
  );

  console.log('Database seeded successfully!');
  console.log(
    `Created ${users.length + 1} users and ${projects.length} projects`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Running Seeds

```bash
# Run seed script
npx prisma db seed

# Add to package.json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

## Database Administration

### Prisma Studio

```bash
# Open visual database browser
npx prisma studio
```

### Database Inspection

```bash
# Pull existing database schema
npx prisma db pull

# Validate schema against database
npx prisma validate

# View database structure
npx prisma format
```

### Backup and Restore

```bash
# Backup database
pg_dump -h localhost -U username -d pitch_production > backup.sql

# Restore database
psql -h localhost -U username -d pitch_production < backup.sql

# Backup with Docker
docker exec postgres pg_dump -U username pitch_production > backup.sql
```

## Performance Optimization

### Indexes

```prisma
model User {
  id    String @id @default(cuid())
  email String @unique
  name  String?

  // Composite index
  @@index([email, name])

  // Partial index
  @@index([email], where: { deletedAt: null })
}

model Project {
  id        String @id @default(cuid())
  title     String
  ownerId   String
  createdAt DateTime @default(now())

  // Index for queries
  @@index([ownerId, createdAt])
  @@index([title], type: Hash) // PostgreSQL specific
}
```

### Query Optimization

```typescript
// Use select to limit fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
  },
});

// Use pagination
const projects = await prisma.project.findMany({
  take: 10,
  skip: page * 10,
  orderBy: { createdAt: 'desc' },
});

// Use cursor-based pagination for better performance
const projects = await prisma.project.findMany({
  take: 10,
  cursor: lastProjectId ? { id: lastProjectId } : undefined,
  orderBy: { createdAt: 'desc' },
});

// Optimize relations with selective inclusion
const projectsWithTasks = await prisma.project.findMany({
  include: {
    tasks: {
      where: { status: 'TODO' },
      take: 5,
      orderBy: { priority: 'desc' },
    },
    _count: {
      select: { tasks: true },
    },
  },
});
```

### Connection Pooling

```javascript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")

  // Connection pool settings
  connectionLimit = 20
  poolTimeout = 20
}
```

## Testing

### Test Database Setup

```bash
# Create test database
createdb pitch_test

# Set test environment
export NODE_ENV=test
export DATABASE_URL="postgresql://username:password@localhost:5432/pitch_test"

# Run migrations on test database
npx prisma migrate deploy
```

### Test Utilities

```typescript
// src/lib/test-utils.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function cleanDatabase() {
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `;

  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      try {
        await prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "public"."${tablename}" CASCADE;`,
        );
      } catch (error) {
        console.log({ error });
      }
    }
  }
}

export async function seedTestData() {
  // Create test users, projects, etc.
  const testUser = await prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashed_password',
    },
  });

  return { testUser };
}
```

## Monitoring and Maintenance

### Database Monitoring

```typescript
// src/lib/db-monitor.ts
import { prisma } from './prisma';

export async function getDatabaseStats() {
  const [userCount, projectCount, taskCount] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.task.count(),
  ]);

  return {
    users: userCount,
    projects: projectCount,
    tasks: taskCount,
    timestamp: new Date().toISOString(),
  };
}

export async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}
```

### Maintenance Tasks

```bash
# Analyze database performance
ANALYZE;

# Update table statistics
VACUUM ANALYZE;

# Reindex tables
REINDEX DATABASE pitch_production;

# Check database size
SELECT pg_size_pretty(pg_database_size('pitch_production'));
```

## Best Practices

1. **Schema Design**
   - Use appropriate data types for each field
   - Implement proper constraints and validations
   - Design indexes based on query patterns

2. **Migrations**
   - Always backup before running migrations
   - Test migrations on staging first
   - Use descriptive migration names

3. **Security**
   - Never store plain text passwords
   - Use environment variables for connection strings
   - Implement proper access controls

4. **Performance**
   - Use database indexes strategically
   - Implement connection pooling
   - Monitor slow queries
   - Use pagination for large datasets

5. **Monitoring**
   - Set up database health checks
   - Monitor connection pool usage
   - Track query performance metrics
   - Set up alerts for failures
