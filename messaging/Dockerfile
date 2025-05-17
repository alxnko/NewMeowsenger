FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /app

# Copy pom.xml and source code from the 'meowsenger' subdirectory
COPY meowsenger/pom.xml .
COPY meowsenger/src ./src

# Build the application
RUN mvn clean package -DskipTests

# Run stage - using smaller JRE image
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=build /app/target/meowsenger-0.0.1-SNAPSHOT.jar app.jar

# Expose port (Cloud Run injects PORT env var)
# EXPOSE 8080 # No need to EXPOSE, Cloud Run handles this

# Command to run the application.
# Spring Boot will automatically pick up the PORT environment variable set by Cloud Run
# if server.port is not hardcoded in application.properties or passed as a different argument.
CMD ["java", "-jar", "app.jar"]