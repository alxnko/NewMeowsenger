# Meowsenger Messaging Service

## Environment Configuration

This Spring Boot application uses standard Spring configuration mechanisms to handle environment variables. Unlike Node.js applications, Spring Boot doesn't natively use `.env` files but instead looks for environment variables directly from the system.

### Configuration Files

1. **Main Configuration Files**:

   - `application.properties`: Default configuration for all environments
   - `application-prod.properties`: Production-specific configuration
   - `application-docker.properties`: Docker-specific configuration

2. **Environment Variable Files**:
   - `.env.deploy`: Contains environment variables for deployment
   - `.env.local`: Contains environment variables for local development
   - `.env`: Base environment variables

### How to Use Environment Variables

Spring Boot handles environment variables in the following ways:

1. **System Environment Variables**: Environment variables set on the host system are automatically available
2. **Property Placeholders**: Variables can be referenced in properties files using `${VARIABLE_NAME:default}` syntax
3. **Spring Boot Profiles**: Use `SPRING_PROFILES_ACTIVE` to select which profile to use

### Deployment Process

During deployment:

1. The `.env.deploy` file is used as a reference for deploying to Cloud Run
2. Environment variables are set directly in the Cloud Run service
3. Spring Boot reads these variables directly from the environment

### Local Development

For local development:

1. Copy `.env.local` to `.env` for local settings
2. Run the application with `./mvnw spring-boot:run`
3. Or set environment variables manually before running

### Important Variables

| Variable                     | Description             | Default                 |
| ---------------------------- | ----------------------- | ----------------------- |
| `SPRING_PROFILES_ACTIVE`     | Active Spring profile   | `production`            |
| `PORT`                       | Server port             | `8080`                  |
| `BACKEND_URL`                | URL for the backend API | `http://localhost:8000` |
| `SPRING_DATASOURCE_URL`      | Database connection URL | JDBC PostgreSQL URL     |
| `SPRING_DATASOURCE_USERNAME` | Database username       | `postgres`              |
| `SPRING_DATASOURCE_PASSWORD` | Database password       | `postgres`              |
| `ALLOWED_ORIGINS`            | CORS allowed origins    | Frontend URL            |
