# Messaging Service Documentation

## Overview

The messaging service is built using Spring Boot and handles real-time communication between clients. It manages WebSocket connections, message routing, and real-time updates.

## Technology Stack

- **Framework**: Spring Boot
- **WebSocket**: Spring WebSocket
- **Database**: PostgreSQL
- **Message Broker**: (Optional) RabbitMQ/Redis
- **Security**: Spring Security

## Project Structure

```
messaging/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/meowsenger/
│   │   │       ├── config/        # Configuration classes
│   │   │       ├── controller/    # WebSocket controllers
│   │   │       ├── model/         # Data models
│   │   │       ├── service/       # Business logic
│   │   │       └── repository/    # Data access
│   │   └── resources/
│   │       └── application.yml    # Configuration
│   └── test/                      # Test files
└── pom.xml                        # Maven configuration
```

## WebSocket Endpoints

### 1. Chat Messages
```java
@MessageMapping("/chat/{chatId}")
public void handleMessage(Message message, @DestinationVariable String chatId) {
    // Handle incoming messages
}
```

### 2. User Status
```java
@MessageMapping("/user/status")
public void handleUserStatus(UserStatus status) {
    // Handle user status updates
}
```

### 3. Typing Indicators
```java
@MessageMapping("/chat/{chatId}/typing")
public void handleTyping(TypingEvent event, @DestinationVariable String chatId) {
    // Handle typing indicators
}
```

## Message Types

### 1. Chat Message
```java
public class Message {
    private String id;
    private String chatId;
    private String senderId;
    private String content;
    private MessageType type;
    private LocalDateTime timestamp;
    private MessageStatus status;
}
```

### 2. User Status
```java
public class UserStatus {
    private String userId;
    private StatusType status;
    private LocalDateTime lastSeen;
}
```

### 3. Typing Event
```java
public class TypingEvent {
    private String userId;
    private String chatId;
    private boolean isTyping;
}
```

## WebSocket Configuration

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
               .setAllowedOrigins("*")
               .withSockJS();
    }
}
```

## Security

### 1. WebSocket Authentication
```java
@Configuration
public class WebSocketSecurityConfig extends AbstractSecurityWebSocketMessageBrokerConfigurer {
    @Override
    protected void configureInbound(MessageSecurityMetadataSourceRegistry messages) {
        messages
            .simpDestMatchers("/ws/**").authenticated()
            .anyMessage().authenticated();
    }
}
```

### 2. Token Validation
```java
@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {
    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        // Validate token and user
    }
}
```

## Message Flow

1. **Client Connection**:
   ```
   Client -> WebSocket Handshake -> Authentication -> Connection Established
   ```

2. **Message Sending**:
   ```
   Client -> WebSocket -> Message Controller -> Message Service -> Recipients
   ```

3. **Status Updates**:
   ```
   Client -> WebSocket -> Status Controller -> Status Service -> Subscribers
   ```

## Error Handling

1. **Connection Errors**:
   - Handle connection failures
   - Implement reconnection logic
   - Log connection issues

2. **Message Errors**:
   - Validate message format
   - Handle delivery failures
   - Implement retry mechanism

## Performance Optimization

1. **Connection Management**:
   - Implement connection pooling
   - Handle connection limits
   - Monitor connection health

2. **Message Processing**:
   - Use async processing
   - Implement message batching
   - Optimize message routing

## Development Setup

1. **Prerequisites**:
   - Java 17 or higher
   - Maven
   - PostgreSQL

2. **Building**:
   ```bash
   mvn clean install
   ```

3. **Running**:
   ```bash
   mvn spring-boot:run
   ```

## Environment Variables

Required environment variables:
- `SERVER_PORT`: WebSocket server port
- `DATABASE_URL`: Database connection string
- `JWT_SECRET`: JWT secret key
- `ALLOWED_ORIGINS`: CORS allowed origins

## Testing

1. **Unit Tests**:
   ```bash
   mvn test
   ```

2. **Integration Tests**:
   ```bash
   mvn verify
   ```

## Monitoring

1. **Health Checks**:
   - WebSocket connection status
   - Message processing metrics
   - System resource usage

2. **Logging**:
   - Connection events
   - Message processing
   - Error tracking

## Deployment

1. **Containerization**:
   - Docker support
   - Docker Compose integration
   - Kubernetes ready

2. **Scaling**:
   - Horizontal scaling support
   - Load balancing
   - Session management

## Best Practices

1. **Code Organization**:
   - Follow Spring Boot conventions
   - Use proper package structure
   - Implement clean architecture

2. **Error Handling**:
   - Use proper exception handling
   - Implement retry mechanisms
   - Log errors appropriately

3. **Security**:
   - Validate all inputs
   - Implement proper authentication
   - Use secure WebSocket configuration 