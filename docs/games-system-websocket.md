# Game WebSocket System Architecture

## Overview

The game WebSocket system in Meowsenger is designed to handle game-related real-time communications separately from chat messaging. This separation ensures games can be played without requiring players to be in the same chat, allowing for a more flexible and scalable game experience.

## Components

### 1. Dedicated GameSocketController

A standalone controller that handles all game-related WebSocket messages:

- Game creation
- Player joining
- Game moves and actions
- Game invitations
- Game state updates

This controller bypasses chat membership checks that are normally enforced in the chat messaging system.

### 2. Dedicated Game WebSocket Service

Frontend service that maintains a separate WebSocket connection specifically for games:

- Handles game-specific message routing
- Manages game subscriptions
- Provides resilient connection handling with exponential backoff
- Ensures game messages don't interfere with chat messaging

### 3. Special Message Handling

The system uses special techniques to identify and process game messages:

- Game messages use `chatId = 0` as a flag to indicate they are not chat-specific
- Message types start with `GAME_` prefix for clear identification
- Custom message routing to game-specific topics

## Message Flow

1. **Game Creation**:

   - Client generates a unique game ID (UUID)
   - Client sends a message to `/app/game.create` with player info
   - Server broadcasts to `/topic/game.[gameId]`

2. **Game Join**:

   - Client subscribes to `/topic/game.[gameId]`
   - Client sends join message to `/app/game.join`
   - Server broadcasts join message to all subscribers

3. **Game Actions**:

   - Player sends action to `/app/game.action`
   - Server broadcasts action to all game subscribers
   - UI updates based on the received actions

4. **Game Invitations**:
   - Sender generates game invitation
   - Message sent to recipient's personal queue
   - Recipient receives invitation with link to join

## Security Considerations

Although game messages bypass chat membership checks, the system still implements security measures:

- User authentication is still required
- Only validated WebSocket sessions can send messages
- Server-side validation of game actions
- Rate limiting to prevent abuse

## Implementation Details

### Backend Classes

- `GameSocketController`: Handles WebSocket endpoints for games
- `WebSocketMessage`: Updated with game-specific message types and fields
- `WebSocketService`: Enhanced with methods for game message handling

### Frontend Services

- `GameWebSocketService`: Dedicated service for game communication
- `TicTacToeService`: Game-specific implementation that uses the dedicated WebSocket service

## Best Practices

1. Always specify a game ID for all game-related messages
2. Use `chatId = 0` for all game messages
3. Subscribe to game topics before attempting to send messages
4. Implement exponential backoff for connection retries
5. Use proper error handling and display feedback to users

## Testing Game WebSocket Communications

1. Monitor WebSocket connections in browser developer tools
2. Use the Network tab to observe WebSocket frames
3. Check server logs for connection and message handling
4. Implement thorough error logging on both client and server

## Common Issues and Solutions

1. **Authentication Failures**: Ensure token is available and valid before connecting
2. **Subscription Errors**: Subscribe to game topics before sending messages
3. **Connection Timeouts**: Implement proper retry logic with reasonable limits
4. **Message Processing Errors**: Validate message format on both client and server
5. **Cross-Origin Issues**: Ensure proper CORS configuration in backend

## Future Enhancements

1. **Game State Persistence**: Store game state in database to allow resuming interrupted games
2. **Spectator Mode**: Allow non-players to watch ongoing games
3. **Tournament System**: Create multi-round competitions with brackets
4. **Game Statistics**: Track and display player statistics and game history
5. **Advanced Game Types**: Support more complex games with extended state management
6. **Game Replay**: Record game moves to allow playback of completed games
7. **Multi-device Synchronization**: Allow seamlessly switching devices during gameplay

## Conclusion

This independent game WebSocket architecture provides several key benefits:

- **Improved Performance**: Separating game traffic from chat messaging reduces congestion
- **Better Scalability**: Game services can be scaled independently from chat services
- **Enhanced User Experience**: Players can play games with anyone, not just chat members
- **Simplified Implementation**: Game logic doesn't need to handle chat membership concerns
- **Future-proof Design**: New games can be added without modifying the chat system

By maintaining this separation of concerns, Meowsenger provides a robust platform for both messaging and gaming experiences that can evolve independently while still being integrated in the same application.
