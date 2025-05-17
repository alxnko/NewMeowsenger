# Development Guide

## Overview

This guide provides comprehensive information for developers working on the Meowsenger project. It covers setup, coding standards, and best practices for all services.

## Development Environment Setup

### 1. Prerequisites

- Node.js 18+
- Python 3.8+
- Java 17+
- PostgreSQL 14+
- Docker and Docker Compose
- Git
- VS Code (recommended)

### 2. Repository Setup

```bash
# Clone the repository
git clone https://github.com/your-org/meowsenger.git
cd meowsenger

# Install dependencies
# Frontend
cd frontend/meowsenger-frontend
npm install

# Backend
cd ../../backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt

# Messaging Service
cd ../messaging
mvn install
```

### 3. Environment Configuration

1. **Frontend (.env.local)**:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_WS_URL=ws://localhost:8080
   NEXT_PUBLIC_ENV=development
   ```

2. **Backend (.env)**:
   ```
   DEBUG=True
   SECRET_KEY=your-secret-key
   DATABASE_URL=postgresql://postgres:password@localhost:5432/meowsenger
   ```

3. **Messaging Service (application.yml)**:
   ```yaml
   server:
     port: 8080
   spring:
     datasource:
       url: jdbc:postgresql://localhost:5432/meowsenger
       username: postgres
       password: password
   ```

## Development Workflow

### 1. Running Services

#### Local Development
```bash
# Using provided scripts
./runDev.bat

# Or manually
# Frontend
cd frontend/meowsenger-frontend
npm run dev

# Backend
cd backend
python manage.py runserver

# Messaging Service
cd messaging
mvn spring-boot:run
```

#### Docker Development
```bash
docker-compose up --build
```

### 2. Database Management

```bash
# Create database
createdb meowsenger

# Run migrations
cd backend
python manage.py migrate

# Create superuser
python manage.py createsuperuser
```

## Coding Standards

### 1. Frontend (Next.js)

#### General
- Use TypeScript for all new code
- Follow ESLint configuration
- Use functional components
- Implement proper error handling

#### Components
```typescript
// Example component structure
import { FC } from 'react';
import { useTranslation } from 'next-i18next';

interface Props {
  // Props interface
}

export const Component: FC<Props> = ({ prop1, prop2 }) => {
  // Component logic
  return (
    // JSX
  );
};
```

#### Styling
- Use Tailwind CSS
- Follow mobile-first approach
- Use HeroUI components when available
- Maintain consistent spacing

### 2. Backend (Django)

#### Models
```python
# Example model
from django.db import models

class Model(models.Model):
    field = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
```

#### Views
```python
# Example view
from rest_framework import viewsets

class ViewSet(viewsets.ModelViewSet):
    queryset = Model.objects.all()
    serializer_class = ModelSerializer
```

#### Serializers
```python
# Example serializer
from rest_framework import serializers

class ModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Model
        fields = ['id', 'field', 'created_at']
```

### 3. Messaging Service (Spring Boot)

#### Controllers
```java
// Example controller
@RestController
@RequestMapping("/api")
public class Controller {
    @Autowired
    private Service service;

    @GetMapping("/endpoint")
    public ResponseEntity<?> method() {
        // Implementation
    }
}
```

#### Services
```java
// Example service
@Service
public class Service {
    @Autowired
    private Repository repository;

    public Result method() {
        // Implementation
    }
}
```

## Testing

### 1. Frontend Tests
```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

### 2. Backend Tests
```bash
# Run tests
python manage.py test

# Run with coverage
coverage run manage.py test
coverage report
```

### 3. Messaging Service Tests
```bash
# Run tests
mvn test

# Run with coverage
mvn verify
```

## Git Workflow

### 1. Branching Strategy
- `main`: Production-ready code
- `develop`: Development branch
- `feature/*`: Feature branches
- `bugfix/*`: Bug fix branches
- `release/*`: Release branches

### 2. Commit Guidelines
```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Testing
- `chore`: Maintenance

### 3. Pull Request Process
1. Create feature branch
2. Implement changes
3. Write tests
4. Update documentation
5. Create PR
6. Code review
7. Merge to develop

## Documentation

### 1. Code Documentation
- Use JSDoc for frontend
- Use docstrings for backend
- Use JavaDoc for messaging service

### 2. API Documentation
- Use OpenAPI/Swagger
- Document all endpoints
- Include request/response examples

### 3. Component Documentation
- Document props
- Include usage examples
- Document state management

## Performance Optimization

### 1. Frontend
- Implement code splitting
- Optimize images
- Use proper caching
- Minimize bundle size

### 2. Backend
- Optimize database queries
- Implement caching
- Use proper indexing
- Monitor performance

### 3. Messaging Service
- Optimize WebSocket connections
- Implement message batching
- Use proper thread management
- Monitor resource usage

## Security

### 1. Authentication
- Use JWT tokens
- Implement proper validation
- Secure password handling
- Session management

### 2. Authorization
- Role-based access control
- Resource ownership validation
- API endpoint protection
- WebSocket security

### 3. Data Protection
- Input validation
- SQL injection prevention
- XSS protection
- CSRF protection

## Monitoring and Logging

### 1. Frontend
- Error tracking
- Performance monitoring
- User analytics
- Console logging

### 2. Backend
- Request logging
- Error tracking
- Performance metrics
- Database monitoring

### 3. Messaging Service
- Connection monitoring
- Message tracking
- Error logging
- Resource monitoring

## Common Issues and Solutions

### 1. Development Issues
- Database connection problems
- WebSocket connection issues
- Build errors
- Dependency conflicts

### 2. Performance Issues
- Slow database queries
- Memory leaks
- Network latency
- Resource exhaustion

### 3. Security Issues
- Authentication failures
- Authorization errors
- Data validation issues
- Security vulnerabilities

## Resources

### 1. Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [Django Documentation](https://docs.djangoproject.com)
- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)

### 2. Tools
- VS Code Extensions
- Development Tools
- Testing Tools
- Monitoring Tools

### 3. References
- Coding Standards
- Best Practices
- Design Patterns
- Security Guidelines 