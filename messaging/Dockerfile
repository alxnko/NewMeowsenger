FROM maven:3.9.9-amazoncorretto-21-alpine AS build
WORKDIR /app

# Copy pom.xml and source code
COPY pom.xml .
COPY src ./src

# Build the application
RUN mvn clean package -DskipTests

# Run stage - using smaller JRE image
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copy JAR file from build stage
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]