# Deployment Guide

## Overview

This guide covers the deployment process for Meowsenger's microservices architecture. The application consists of three main services: frontend, backend, and messaging service, all containerized using Docker.

## Prerequisites

- Docker and Docker Compose
- Git
- Node.js (for local development)
- Java 17+ (for local development)
- Python 3.8+ (for local development)
- PostgreSQL (for local development)

## Architecture

```
                    ┌─────────────┐
                    │   Nginx     │
                    │  Reverse    │
                    │   Proxy     │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐  ┌────────▼───────┐  ┌──────▼──────┐
│   Frontend   │  │    Backend     │  │  Messaging  │
│  (Next.js)   │  │   (Django)     │  │  (Spring)   │
└───────┬──────┘  └────────┬───────┘  └──────┬──────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │ PostgreSQL  │
                    └─────────────┘
```

## Docker Configuration

### 1. Frontend Service

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### 2. Backend Service

```dockerfile
# backend/Dockerfile
FROM python:3.8-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
```

### 3. Messaging Service

```dockerfile
# messaging/Dockerfile
FROM openjdk:17-slim
WORKDIR /app
COPY target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
```

## Docker Compose Configuration

```yaml
# compose.yaml
version: "3.8"

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
      - NEXT_PUBLIC_WS_URL=http://messaging:8080
    depends_on:
      - backend
      - messaging

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/meowsenger
      - SECRET_KEY=your-secret-key
    depends_on:
      - db

  messaging:
    build: ./messaging
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/meowsenger
      - JWT_SECRET=your-jwt-secret
    depends_on:
      - db

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=meowsenger
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Deployment Steps

### 1. Local Development

1. **Clone the repository**:

   ```bash
   git clone https://github.com/your-org/meowsenger.git
   cd meowsenger
   ```

2. **Build and run services**:

   ```bash
   docker-compose up --build
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - WebSocket: ws://localhost:8080

### 2. Production Deployment

1. **Environment Setup**:

   - Set up production environment variables
   - Configure SSL certificates
   - Set up proper database credentials

2. **Build and Deploy**:

   ```bash
   # Build images
   docker-compose -f docker-compose.prod.yml build

   # Deploy services
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Database Migration**:

   ```bash
   # Backend migrations
   docker-compose exec backend python manage.py migrate

   # Create superuser
   docker-compose exec backend python manage.py createsuperuser
   ```

## Network Configuration

### 1. Local Network Access

Use the provided `setupNetwork.bat` script to configure local network access:

```bash
./setupNetwork.bat
```

### 2. Production Network

1. **Configure Nginx**:

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://frontend:3000;
       }

       location /api {
           proxy_pass http://backend:8000;
       }

       location /ws {
           proxy_pass http://messaging:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```

2. **SSL Configuration**:
   - Use Let's Encrypt for SSL certificates
   - Configure automatic renewal
   - Force HTTPS

## Monitoring

### 1. Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f messaging
```

### 2. Health Checks

- Frontend: http://localhost:3000/health
- Backend: http://localhost:8000/health
- Messaging: http://localhost:8080/health

## Backup and Recovery

### 1. Database Backup

```bash
# Backup
docker-compose exec db pg_dump -U postgres meowsenger > backup.sql

# Restore
docker-compose exec db psql -U postgres meowsenger < backup.sql
```

### 2. Volume Backup

```bash
# Backup volumes
docker run --rm -v meowsenger_postgres_data:/source -v $(pwd):/backup alpine tar -czf /backup/postgres_data.tar.gz -C /source .

# Restore volumes
docker run --rm -v meowsenger_postgres_data:/target -v $(pwd):/backup alpine sh -c "cd /target && tar -xzf /backup/postgres_data.tar.gz"
```

## Scaling

### 1. Horizontal Scaling

```bash
# Scale services
docker-compose up -d --scale frontend=3 --scale backend=3 --scale messaging=3
```

### 2. Load Balancing

- Use Nginx as load balancer
- Configure sticky sessions for WebSocket
- Implement health checks

## Troubleshooting

### 1. Common Issues

1. **Database Connection**:

   - Check database credentials
   - Verify network connectivity
   - Check database logs

2. **WebSocket Connection**:

   - Verify WebSocket URL
   - Check authentication
   - Monitor connection logs

3. **Service Health**:
   - Check service logs
   - Verify environment variables
   - Check resource usage

### 2. Debug Commands

```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs -f [service]

# Access service shell
docker-compose exec [service] sh

# Check network
docker network inspect meowsenger_default
```

## Security Considerations

1. **Environment Variables**:

   - Use secure secrets management
   - Rotate credentials regularly
   - Use different credentials for dev/prod

2. **Network Security**:

   - Configure proper firewall rules
   - Use SSL/TLS
   - Implement rate limiting

3. **Container Security**:
   - Use non-root users
   - Scan for vulnerabilities
   - Keep images updated
