# Docker Setup Guide

This guide covers running the PITCH application using Docker containers across
different environments.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2.0+
- At least 4GB RAM available for Docker

## Architecture

The Docker setup includes:

- **Web Application** (Next.js) - Port 3000
- **API Server** (NestJS) - Port 3001
- **PostgreSQL Database** - Port 5432
- **MongoDB Database** - Port 27017
- **Redis Cache** - Port 6380
- **Nginx Reverse Proxy** (staging/prod) - Ports 80/443

## Environment Configurations

### Local Development

**File**: `docker-compose.local.yml`

Features:

- Hot reloading enabled
- Volume mounts for live code changes
- Development database credentials
- All services exposed on localhost

**Setup**:

```bash
# Copy environment template
cp .env.example .env.local

# Edit environment variables (optional for local development)
nano .env.local
```

**Usage**:

```bash
# Start all services
docker-compose -f docker-compose.local.yml up -d

# View logs
docker-compose -f docker-compose.local.yml logs -f

# Stop services
docker-compose -f docker-compose.local.yml down

# Rebuild and start
docker-compose -f docker-compose.local.yml up --build -d
```

**Access**:

- Web App: http://localhost:3000
- API: http://localhost:3001
- PostgreSQL: localhost:5432
- MongoDB: localhost:27017
- Redis: localhost:6380

### Staging Environment

**File**: `docker-compose.staging.yml`

Features:

- Environment variables for configuration
- Resource limits and health checks
- Nginx reverse proxy
- Centralized logging
- Auto-restart policies

**Setup**:

```bash
# Create environment file
cp .env.example .env.staging

# Edit environment variables
nano .env.staging

# Start services
docker-compose -f docker-compose.staging.yml up -d

# Check service health
docker-compose -f docker-compose.staging.yml ps
```

### Production Environment

**File**: `docker-compose.prod.yml`

Features:

- High availability with replicas
- Performance-optimized database settings
- SSL/TLS support via Nginx
- Monitoring with Prometheus/Grafana (optional)
- Persistent data volumes
- Resource limits and reservations

**Setup**:

```bash
# Create data directories
sudo mkdir -p /opt/pitch/data/{postgres,mongodb,mongodb-config,redis}
sudo chown -R 1001:1001 /opt/pitch/data

# Create environment file
cp .env.example .env.prod

# Start core services
docker-compose -f docker-compose.prod.yml up -d

# Start with monitoring (optional)
docker-compose -f docker-compose.prod.yml --profile monitoring up -d
```

## Environment Variables

### Required Variables

Create `.env.staging` or `.env.prod` with:

```env
# Database
POSTGRES_DB=pitch_app
POSTGRES_USER=pitch_user
POSTGRES_PASSWORD=secure_password_here

# MongoDB
MONGO_DB=pitch_app
MONGO_USER=pitch_user
MONGO_PASSWORD=secure_password_here

# Application
JWT_SECRET=your-super-secure-jwt-secret-key
NEXTAUTH_SECRET=your-nextauth-secret-key

# URLs
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXTAUTH_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com

# Optional
LOG_LEVEL=info
GRAFANA_ADMIN_PASSWORD=secure_grafana_password
```

## Database Setup

### PostgreSQL Initialization

The PostgreSQL container will automatically:

1. Create the specified database
2. Set up the user with proper permissions
3. Run any SQL scripts in `docker/postgres/init/`

### MongoDB Initialization

The MongoDB container will:

1. Create the root user
2. Initialize the specified database
3. Run any JS scripts in `docker/mongodb/init/`

### Prisma Migrations

The API container automatically runs:

```bash
prisma migrate deploy  # Apply pending migrations
prisma generate        # Generate Prisma client
```

## Common Commands

### Building Images

```bash
# Build all images
docker-compose -f docker-compose.local.yml build

# Build specific service
docker-compose -f docker-compose.local.yml build api

# Build without cache
docker-compose -f docker-compose.local.yml build --no-cache
```

### Managing Services

```bash
# Start specific services
docker-compose -f docker-compose.local.yml up -d postgres redis

# Restart a service
docker-compose -f docker-compose.local.yml restart api

# Scale services (prod only)
docker-compose -f docker-compose.prod.yml up -d --scale api=3 --scale web=2
```

### Logs and Debugging

```bash
# View all logs
docker-compose -f docker-compose.local.yml logs

# Follow specific service logs
docker-compose -f docker-compose.local.yml logs -f api

# Execute commands in running container
docker-compose -f docker-compose.local.yml exec api sh
docker-compose -f docker-compose.local.yml exec postgres psql -U pitch_user -d pitch_local
```

### Data Management

```bash
# Create database backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U pitch_user pitch_app > backup.sql

# Restore database backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U pitch_user -d pitch_app < backup.sql

# Clear all data (destructive!)
docker-compose -f docker-compose.local.yml down -v
```

## Performance Tuning

### Production Optimizations

**PostgreSQL**:

- Connection pooling (max_connections=200)
- Memory settings optimized for container limits
- WAL settings for better write performance

**MongoDB**:

- WiredTiger storage engine with compression
- Memory cache size configured
- Journal compression enabled

**Redis**:

- Append-only file persistence
- Memory policy for cache eviction
- Connection pooling

**Application**:

- Multi-stage Docker builds for smaller images
- Node.js process optimization
- Resource limits and health checks

### Resource Requirements

**Minimum (Local)**:

- 2 CPU cores
- 4GB RAM
- 10GB disk space

**Recommended (Production)**:

- 4+ CPU cores
- 8GB+ RAM
- 50GB+ SSD storage
- Load balancer for high availability

## SSL/TLS Setup

For staging/production environments:

1. Place SSL certificates in `docker/nginx/ssl/`:

   ```
   docker/nginx/ssl/
   ├── cert.pem
   ├── private.key
   └── ca-bundle.crt
   ```

2. Configure Nginx in `docker/nginx/staging.conf` or `docker/nginx/prod.conf`

3. Update environment variables with HTTPS URLs

## Monitoring

### Built-in Health Checks

All services include health checks:

- PostgreSQL: `pg_isready`
- MongoDB: `mongosh ping`
- Redis: `redis-cli ping`
- API: HTTP endpoint `/health`
- Web: HTTP endpoint `/api/health`

### Prometheus Metrics (Production)

Enable monitoring profile:

```bash
docker-compose -f docker-compose.prod.yml --profile monitoring up -d
```

Access:

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3010

## Troubleshooting

### Common Issues

**Permission Denied**:

```bash
# Fix data directory permissions
sudo chown -R 1001:1001 /opt/pitch/data
```

**Out of Memory**:

```bash
# Check container resource usage
docker stats

# Increase Docker memory limits
# Docker Desktop: Settings > Resources > Memory
```

**Database Connection Failed**:

```bash
# Check if database is ready
docker-compose -f docker-compose.local.yml exec postgres pg_isready

# Verify environment variables
docker-compose -f docker-compose.local.yml exec api env | grep DATABASE_URL
```

**Build Failures**:

```bash
# Clear Docker build cache
docker system prune -a

# Rebuild from scratch
docker-compose -f docker-compose.local.yml build --no-cache
```

### Debugging Steps

1. Check service status:

   ```bash
   docker-compose -f docker-compose.local.yml ps
   ```

2. View service logs:

   ```bash
   docker-compose -f docker-compose.local.yml logs service-name
   ```

3. Execute interactive shell:

   ```bash
   docker-compose -f docker-compose.local.yml exec service-name sh
   ```

4. Test database connections:

   ```bash
   # PostgreSQL
   docker-compose -f docker-compose.local.yml exec postgres psql -U pitch_user -d pitch_local -c "SELECT version();"

   # MongoDB
   docker-compose -f docker-compose.local.yml exec mongodb mongosh --eval "db.runCommand('ping')"
   ```

## Security Considerations

- Change default passwords in production
- Use strong JWT secrets (32+ characters)
- Enable SSL/TLS for external traffic
- Regularly update container images
- Monitor container logs for suspicious activity
- Limit container resources to prevent DoS
- Use Docker secrets for sensitive data in production

## Backup Strategy

### Automated Backups

Create a backup script:

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U pitch_user pitch_app > "postgres_backup_${DATE}.sql"
docker-compose -f docker-compose.prod.yml exec mongodb mongodump --uri="mongodb://pitch_user:password@localhost:27017/pitch_app" --out="mongodb_backup_${DATE}"
```

Add to crontab for daily backups:

```bash
0 2 * * * /path/to/backup.sh
```
