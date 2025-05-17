# Backend Documentation

## Overview

The backend service of Meowsenger is built using Django with Django REST Framework. It handles user management, authentication, and business logic for the application.

## Technology Stack

- **Framework**: Django with Django REST Framework
- **Database**: PostgreSQL
- **Authentication**: JWT-based
- **API**: RESTful
- **WebSocket**: Django Channels (via ASGI)

## Project Structure

```
backend/
├── meowsenger_backend/
│   ├── migrations/      # Database migrations
│   ├── models.py        # Database models
│   ├── serializers.py   # DRF serializers
│   ├── urls.py         # URL routing
│   ├── views/          # View handlers
│   │   ├── auth_views.py
│   │   └── chat_views.py
│   ├── settings.py     # Django settings
│   ├── wsgi.py         # WSGI configuration
│   └── asgi.py         # ASGI configuration
└── requirements.txt    # Python dependencies
```

## Models

### User Model
```python
class User(AbstractUser):
    # Custom user fields
    avatar = models.ImageField()
    status = models.CharField()
    last_seen = models.DateTimeField()
```

### Chat Models
```python
class Chat(models.Model):
    # Chat room/group information
    name = models.CharField()
    type = models.CharField()  # private/group
    members = models.ManyToManyField(User)
    created_at = models.DateTimeField()
```

### Message Model
```python
class Message(models.Model):
    # Message information
    chat = models.ForeignKey(Chat)
    sender = models.ForeignKey(User)
    content = models.TextField()
    timestamp = models.DateTimeField()
    status = models.CharField()  # sent/delivered/read
```

## API Endpoints

### Authentication
- `POST /api/auth/register/`: User registration
- `POST /api/auth/login/`: User login
- `POST /api/auth/logout/`: User logout
- `GET /api/auth/me/`: Get current user info

### Chat
- `GET /api/chats/`: List user's chats
- `POST /api/chats/`: Create new chat
- `GET /api/chats/{id}/`: Get chat details
- `PUT /api/chats/{id}/`: Update chat
- `DELETE /api/chats/{id}/`: Delete chat

### Messages
- `GET /api/chats/{id}/messages/`: Get chat messages
- `POST /api/chats/{id}/messages/`: Send message
- `PUT /api/messages/{id}/`: Edit message
- `DELETE /api/messages/{id}/`: Delete message

### Users
- `GET /api/users/`: List users
- `GET /api/users/{id}/`: Get user details
- `PUT /api/users/{id}/`: Update user
- `GET /api/users/search/`: Search users

## Authentication

The backend uses JWT (JSON Web Tokens) for authentication:

1. **Token Generation**:
   - Access token (short-lived)
   - Refresh token (long-lived)

2. **Token Validation**:
   - Signature verification
   - Expiration check
   - User validation

## WebSocket Support

The backend supports WebSocket connections for real-time features:

1. **Connection Types**:
   - Chat messages
   - User status updates
   - Typing indicators

2. **Authentication**:
   - Token-based WebSocket authentication
   - Connection validation

## Database

### PostgreSQL Configuration
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'meowsenger',
        'USER': 'postgres',
        'PASSWORD': 'password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

### Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

## Security

1. **Authentication**:
   - JWT token-based auth
   - Password hashing
   - Session management

2. **Authorization**:
   - Role-based access control
   - Permission checks
   - Resource ownership validation

3. **Data Protection**:
   - Input validation
   - SQL injection prevention
   - XSS protection

## Development Setup

1. **Environment Setup**:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   ```

2. **Database Setup**:
   ```bash
   python manage.py migrate
   python manage.py createsuperuser
   ```

3. **Running the Server**:
   ```bash
   python manage.py runserver
   ```

## Environment Variables

Required environment variables:
- `DEBUG`: Debug mode
- `SECRET_KEY`: Django secret key
- `DATABASE_URL`: Database connection string
- `ALLOWED_HOSTS`: Allowed host names
- `CORS_ALLOWED_ORIGINS`: CORS allowed origins

## Testing

1. **Running Tests**:
   ```bash
   python manage.py test
   ```

2. **Test Coverage**:
   ```bash
   coverage run manage.py test
   coverage report
   ```

## Deployment

1. **Production Settings**:
   - Set `DEBUG=False`
   - Configure proper `ALLOWED_HOSTS`
   - Set up proper database credentials
   - Configure static files

2. **WSGI/ASGI**:
   - Use production-grade WSGI/ASGI server
   - Configure proper workers
   - Set up reverse proxy

## Monitoring

1. **Logging**:
   - Configure proper logging
   - Set up log rotation
   - Monitor error logs

2. **Performance**:
   - Monitor response times
   - Track database queries
   - Monitor memory usage 