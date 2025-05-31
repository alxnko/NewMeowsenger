# Meowsenger Game System

## Overview

The Meowsenger Game System provides a framework for adding multiplayer games to the messaging platform. Games are based on WebSockets for real-time interaction and integrated with the user authentication system, ensuring only authorized users can participate.

## Features

- **Game Rooms**: Users can create, join, and manage game rooms
- **Player Management**: Room owners can kick players and control who joins
- **Game Types**: Support for various game types with different player requirements
- **WebSocket Integration**: Real-time game state updates for all players
- **Invite System**: Players can generate invite codes to share with friends

## Architecture

The game system follows a client-server architecture:

1. **Backend (Spring Boot)**:
   - Manages game rooms and player connections
   - Processes game actions and maintains game state
   - Broadcasts state updates to clients via WebSockets
2. **Frontend (Next.js)**:
   - Renders game UI based on game state
   - Captures and sends player actions to the server
   - Displays real-time updates from other players

## Game Room Lifecycle

1. **Creation**: A user creates a game room, specifying:
   - Game type (e.g., "tic-tac-toe")
   - Room name
   - Maximum and minimum number of players
2. **Waiting for Players**:
   - Players join the room via direct link or invite code
   - Room is in the `WAITING_FOR_PLAYERS` state until enough players join
3. **Game Start**:
   - Room owner starts the game when ready
   - Game state is initialized, and room enters the `IN_PROGRESS` state
4. **Game Play**:
   - Players take turns performing actions
   - Game state is updated and broadcast to all players
5. **Game End**:
   - Game ends based on game-specific end conditions
   - Room enters the `FINISHED` state
   - Results are broadcast to all players

## Implementation Details

### Game Types

Each game type should implement:

1. **State Management**: Define and maintain game state
2. **Turn Management**: Control who can make moves when
3. **Move Validation**: Ensure players can only make valid moves
4. **End Conditions**: Detect when the game is over and determine the winner

### API Endpoints

#### REST Endpoints

- `POST /api/games/rooms`: Create a new game room
- `GET /api/games/rooms`: Get all active game rooms
- `GET /api/games/rooms/type/{gameType}`: Get rooms of a specific game type
- `GET /api/games/rooms/{roomId}`: Get a specific game room
- `POST /api/games/rooms/{roomId}/join`: Join a game room
- `POST /api/games/rooms/join/code/{inviteCode}`: Join a room by invite code
- `POST /api/games/rooms/{roomId}/leave`: Leave a game room
- `POST /api/games/rooms/{roomId}/kick/{playerId}`: Kick a player (owner only)
- `POST /api/games/rooms/{roomId}/start`: Start the game (owner only)
- `POST /api/games/rooms/{roomId}/cancel`: Cancel the game (owner only)
- `GET /api/games/user/rooms`: Get all rooms for the current user

#### WebSocket Endpoints

- `/app/game.create`: Create a new game room
- `/app/game.join`: Join a game room
- `/app/game.join.code`: Join by invite code
- `/app/game.leave`: Leave a game room
- `/app/game.start`: Start a game
- `/app/game.action`: Send a game action

#### Subscription Topics

- `/user/queue/games`: Personal game updates
- `/user/queue/games/updates`: Game room updates
- `/user/queue/games/messages`: Game event messages
- `/user/queue/games/kicked`: Notification when kicked
- `/user/queue/games/state/{roomId}`: Game state updates
- `/user/queue/games/ended/{roomId}`: Game end notification

## Extending the System

To add a new game type:

1. Register a new game type identifier (e.g., "chess")
2. Implement game-specific state management logic in `DefaultGameService`
3. Create necessary game-specific DTOs for state representation
4. Implement frontend UI for the game

## Best Practices

- **Security**: Always verify that the user making an action is authorized
- **State Management**: Keep game state JSON serializable for WebSocket transmission
- **Error Handling**: Provide clear error messages for invalid actions
- **Scaling**: Design games to be stateless where possible, storing state in the database

## Example: Adding a New Game

Here's how to add a new game type like "Rock-Paper-Scissors":

1. Define the game state structure
2. Implement move validation and winner determination logic
3. Update the DefaultGameService to handle the new game type
4. Create frontend components to render the game UI
5. Test the game with multiple players

## Frontend Integration

The frontend should:

1. Use WebSocket connection for real-time updates
2. Subscribe to relevant game topics
3. Render game UI based on game state
4. Capture user inputs and send as game actions

## Known Limitations

- Currently, there is no persistent game history
- Games are lost if the server restarts during play
- Limited support for reconnecting after disconnection
