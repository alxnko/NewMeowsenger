# Game Implementation Guide for Meowsenger

This guide explains how to implement new multiplayer games for Meowsenger using the independent game WebSocket system.

## Overview

Meowsenger's game system is built on a dedicated WebSocket connection separate from the chat messaging system. This allows games to operate independently without requiring players to be in the same chat.

## Implementation Structure

A new game should follow this folder structure:

```
frontend/meowsenger-frontend/app/games/[game-name]/
├── page.tsx                # Main game page
├── components/             # Game UI components
│   ├── GameBoard.tsx       # Main game board/interaction component
│   ├── GameInvite.tsx      # Component for inviting friends
│   └── GameInviteMessage.tsx # For displaying invites in chats
└── services/
    └── [Game]Service.ts    # Game-specific service
```

## Step 1: Create the Game Service

The game service handles the game logic and WebSocket communication. It should:

1. Connect to the dedicated game WebSocket service
2. Handle game state and player actions
3. Manage game events (create, join, move, etc.)

Example template:

```typescript
"use client";

import gameWebSocketService, {
  WebSocketMessage,
} from "@/utils/game-websocket-service";
import { v4 as uuidv4 } from "uuid";

// Define game-specific types
export interface GameState {
  // Your game state definition
  gameStarted: boolean;
  gameEnded: boolean;
  isMyTurn: boolean;
  opponentUsername: string;
  // Game-specific fields
}

class GameNameService {
  private gameId: string | null = null;
  private userId: number | null = null;
  private username: string | null = null;
  private gameStateCallback: ((state: GameState) => void) | null = null;
  private errorCallback: ((error: string) => void) | null = null;

  // Initialize the service
  public async initialize(): Promise<boolean> {
    // Load user data from storage
    // Connect to the game WebSocket
    // Set up event listeners
  }

  // Create a new game
  public async createGame(): Promise<string> {
    // Generate a new game ID
    // Set up initial game state
    // Send create event via WebSocket
  }

  // Join an existing game
  public async joinGame(gameId: string): Promise<void> {
    // Set game ID
    // Subscribe to game events
    // Send join event via WebSocket
  }

  // Make a game move
  public async makeMove(moveData: any): Promise<void> {
    // Send move event via WebSocket
  }

  // Register callback for game state updates
  public onGameStateUpdate(callback: (state: GameState) => void): void {
    this.gameStateCallback = callback;
  }

  // Register callback for errors
  public onGameError(callback: (error: string) => void): void {
    this.errorCallback = callback;
  }

  // Clean up resources
  public async disconnect(): Promise<void> {
    // Unsubscribe from game events
    // Clean up resources
  }
}

// Create a singleton instance
const gameNameService = new GameNameService();
export default gameNameService;
```

## Step 2: Create the Game UI Components

### Main Game Page (page.tsx)

The main game page handles:

- URL parameters (for joining games)
- Authentication state
- Connection state
- Game state management

Example template:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/contexts/language-context";
import { useAuth } from "@/contexts/auth-context";
import gameNameService, { GameState } from "./services/GameNameService";
import GameBoard from "./components/GameBoard";
import GameInvite from "./components/GameInvite";

export default function GamePage() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const { user } = useAuth();

  // Game state
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);

  // Get gameId from URL
  const urlGameId = searchParams?.get("id");

  useEffect(() => {
    // Register callbacks with the service
    gameNameService.onGameStateUpdate((state) => {
      setGameState(state);
      setConnecting(false);

      // Store the game state for access by the service
      if (typeof window !== "undefined") {
        window.meowsengerGameState = state;
      }
    });

    gameNameService.onGameError((errorMsg) => {
      setError(errorMsg);
    });

    // Initialize the game
    async function initGame() {
      try {
        const initialized = await gameNameService.initialize();

        if (initialized) {
          if (urlGameId) {
            // Join existing game
            setGameId(urlGameId);
            await gameNameService.joinGame(urlGameId);
          } else {
            // Create new game
            const newGameId = await gameNameService.createGame();
            setGameId(newGameId);
          }
        }
      } catch (error) {
        setError(`Failed to initialize game: ${error}`);
        setConnecting(false);
      }
    }

    initGame();

    // Clean up
    return () => {
      if (typeof window !== "undefined") {
        delete window.meowsengerGameState;
      }
      gameNameService.disconnect().catch(console.error);
    };
  }, [urlGameId]);

  // Game UI logic: handle loading/error/game states
}
```

### Game Board Component

This component renders the game UI and handles player interactions.

### Game Invite Components

Create both `GameInvite.tsx` (for sharing game links) and `GameInviteMessage.tsx` (for displaying invites in chats).

## Step 3: Add Game to Navigation

Update the games list in `app/games/page.tsx` to include your new game.

## Step 4: Add Translations

Add game-specific translations to all language files:

```typescript
// frontend/meowsenger-frontend/contexts/lang-en.ts
const en = {
  // ... existing translations

  // Your game translations
  your_game_name: "your game name",
  your_game_description: "short description of your game",
  // Game-specific messages
};
```

## Best Practices

1. **Error Handling**: Implement thorough error handling with user-friendly messages
2. **Loading States**: Show appropriate loading states during connection/initialization
3. **Cleanup**: Always clean up resources when the game component unmounts
4. **Authentication**: Handle authentication properly, with retries if needed
5. **Responsive Design**: Ensure the game UI works on both desktop and mobile
6. **Consistent Styling**: Use Meowsenger's design system (lowercase text, colors, etc.)
7. **Accessibility**: Include keyboard navigation and screen reader support

## WebSocket Message Types

Use the following message types for game communication:

- `GAME_CREATE`: Creating a new game
- `GAME_JOIN`: Joining an existing game
- `GAME_MOVE`: Making a move or action
- `GAME_INVITE`: Inviting another player
- `GAME_STATE`: Updating game state

## Testing Your Game

1. Test game creation and joining via direct URL
2. Test game invitations through chat
3. Test gameplay with multiple users
4. Test error scenarios (disconnection, invalid moves)
5. Test on different devices and screen sizes

## Troubleshooting Common Issues

1. **WebSocket Connection Failures**: Check authentication and connection initialization
2. **Game State Synchronization**: Ensure all players see the same game state
3. **Invitation Problems**: Verify invitation format and handling
4. **Authentication Issues**: Implement proper retry logic for authentication
5. **Memory Leaks**: Clean up all event listeners and subscriptions
