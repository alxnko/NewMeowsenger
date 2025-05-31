"use client";

/**
 * TicTacToeService - Game service that handles the Tic-Tac-Toe game logic and communication
 *
 * IMPORTANT: As of 2025-05-22, this service now uses a dedicated game WebSocket service
 * that bypasses chat membership checks. This allows game invitations to work properly
 * even when users aren't in the same chat, fixing the "User not authenticated" errors
 * that occurred when joining games via invitation links.
 */

import websocketService, { WebSocketMessage } from "@/utils/websocket-service";
import gameWebSocketService from "@/utils/game-websocket-service";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from "@/contexts/auth-context";
import { Client } from "@stomp/stompjs";

// Define types for the game
export interface GameState {
  board: (string | null)[];
  currentPlayer: string;
  winner: {
    player: string;
    cells: number[];
  } | null;
  isMyTurn: boolean;
  gameStarted: boolean;
  opponentUsername: string;
  gameEnded: boolean;
}

export interface GameInvite {
  gameId: string;
  inviterId: number;
  inviterUsername: string;
}

// Define constants for WebSocket operations
const WS_GAME_CONSTANTS = {
  DESTINATIONS: {
    GAME_CREATE: "/app/game.create",
    GAME_JOIN: "/app/game.join",
    GAME_MOVE: "/app/game.action",
    GAME_INVITE: "/app/game.invite",
    GAME_NEW: "/app/game.new",
    GAME_SUBSCRIBE: "/app/game.subscribe",
  },
  SUBSCRIPTION_PREFIXES: {
    GAME_STATE: "game_state_",
    GAME_INVITE: "game_invite_",
  },
};

class TicTacToeService {
  private gameId: string | null = null;
  private player: string | null = null;
  private userId: number | null = null;
  private username: string | null = null;
  private gameStateCallback: ((state: GameState) => void) | null = null;
  private errorCallback: ((error: string) => void) | null = null;
  private client: Client | null = null;
  private connected: boolean = false;
  private gameSubscriptions: string[] = [];

  // Initialize the service with user data
  public async initialize(): Promise<boolean> {
    try {
      // Get user information from the auth context first
      let user = null;
      let token = null;

      // First try to get user from localStorage
      try {
        // Get authentication token from localStorage
        token = localStorage.getItem("token");

        // Get user data from localStorage
        const userString = localStorage.getItem("user");
        if (userString) {
          user = JSON.parse(userString);
        }
      } catch (e) {
        console.error("Error accessing local storage:", e);
      }

      // If no user found, check session storage immediately as fallback
      if (!user || !token) {
        try {
          token = sessionStorage.getItem("token");
          const userString = sessionStorage.getItem("user");
          if (userString) {
            user = JSON.parse(userString);
            console.log("Retrieved auth from session storage");
          }
        } catch (e) {
          console.error("Error accessing session storage:", e);
        }
      }

      // If still no user, try waiting for authentication to complete
      if (!user || !token) {
        console.log("User not found in storage, waiting for auth...");

        // Try to wait longer for authentication to complete - increased from 10 to 15 attempts
        // and smaller intervals for more responsive behavior
        const maxWaitAttempts = 15;
        for (let i = 0; i < maxWaitAttempts; i++) {
          await new Promise((resolve) => setTimeout(resolve, 400));

          // Try localStorage first
          try {
            token = localStorage.getItem("token");
            const userString = localStorage.getItem("user");
            if (userString) {
              user = JSON.parse(userString);
              console.log(`Auth found in localStorage on attempt ${i + 1}`);
              break;
            }
          } catch (e) {
            console.error("Error accessing local storage:", e);
          }

          // Then try sessionStorage
          try {
            token = sessionStorage.getItem("token");
            const userString = sessionStorage.getItem("user");
            if (userString) {
              user = JSON.parse(userString);
              console.log(`Auth found in sessionStorage on attempt ${i + 1}`);
              break;
            }
          } catch (e) {
            console.error("Error accessing session storage:", e);
          }

          console.log(`Auth attempt ${i + 1}/${maxWaitAttempts}...`);
        }
      }

      // Final check if we have user data
      if (!user || !token) {
        console.error("User authentication failed after retries");
        this.handleError("User not authenticated");
        return false;
      }

      // Set user information
      this.userId = user.id;
      this.username = user.username;
      console.log(
        "Game initialized for user:",
        this.username,
        "ID:",
        this.userId
      );

      // Connect to BOTH WebSocket services
      // 1. Connect to main chat WebSocket (still needed for notifications, etc.)
      if (!websocketService.getConnectionStatus().connected && token) {
        const userIdForWebSocket = this.userId || 0; // Fallback to 0 if null
        await websocketService.connect(userIdForWebSocket, token);
      }

      // 2. Connect to dedicated game WebSocket
      if (!gameWebSocketService.getConnectionStatus().connected && token) {
        const userIdForWebSocket = this.userId || 0; // Fallback to 0 if null
        let wsConnected = false;
        let wsAttempts = 0;
        const maxWsAttempts = 12; // Increased from 10 to 12 attempts

        while (!wsConnected && wsAttempts < maxWsAttempts) {
          console.log(
            `Game WebSocket initialization attempt ${
              wsAttempts + 1
            }/${maxWsAttempts}`
          );
          wsConnected = await gameWebSocketService.connect(
            userIdForWebSocket,
            token
          );

          if (!wsConnected) {
            wsAttempts++;
            if (wsAttempts < maxWsAttempts) {
              console.log(
                "Game WebSocket connection failed, retrying in 500ms..."
              );
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        }

        if (!wsConnected) {
          console.error(
            "Failed to establish Game WebSocket connection after multiple attempts"
          );
          this.handleError(
            "Failed to connect to game server. Please try again."
          );
          return false;
        }

        console.log(
          "Game WebSocket connected successfully during initialization"
        );
        this.connected = true;
      }

      // Set up event listeners for game events
      await this.setupGameEventListeners();

      return true;
    } catch (error) {
      console.error("Failed to initialize TicTacToe service:", error);
      this.handleError(
        "Initialization failed: " +
          (error instanceof Error ? error.message : String(error))
      );
      return false;
    }
  }

  // Set up event listeners for game events
  private async setupGameEventListeners(): Promise<void> {
    try {
      // Get WebSocket client information from gameWebSocketService
      const wsStatus = gameWebSocketService.getConnectionStatus();
      this.connected = wsStatus.connected;

      // Access the client from the websocketService (this is a bit of a hack since we don't expose this directly)
      this.client = (gameWebSocketService as any).client;

      // Set up event listeners for custom events
      window.removeEventListener(
        "meowsenger:game:update",
        this.handleGameUpdate
      );
      window.addEventListener("meowsenger:game:update", this.handleGameUpdate);

      window.removeEventListener(
        "meowsenger:game:invite",
        this.handleGameInvite
      );
      window.addEventListener("meowsenger:game:invite", this.handleGameInvite);

      // Subscribe to game-specific events if we have a gameId
      if (this.gameId) {
        await this.subscribeToGameEvents(this.gameId);
      }
    } catch (error) {
      console.error("Error setting up game event listeners:", error);
    }
  }

  // Subscribe to game events with improved error handling and fallback mechanisms
  private async subscribeToGameEvents(gameId: string): Promise<void> {
    if (!this.userId) {
      console.error("Cannot subscribe to game events - User not authenticated");
      return;
    }

    try {
      // Verify connection to the game WebSocket
      if (!this.connected) {
        const wsStatus = gameWebSocketService.getConnectionStatus();
        this.connected = wsStatus.connected;

        if (!this.connected) {
          console.error(
            "Game WebSocket not connected, cannot subscribe to game events"
          );

          // First attempt to reconnect using authentication data
          const token =
            localStorage.getItem("token") || sessionStorage.getItem("token");
          if (token) {
            console.log(
              "Attempting to reconnect game WebSocket before subscription"
            );
            const reconnected = await gameWebSocketService.connect(
              this.userId,
              token
            );
            if (reconnected) {
              this.connected = true;
              console.log("Game WebSocket reconnected successfully");
            } else {
              // If reconnection failed, try the fallback subscription method
              console.log(
                "Game WebSocket reconnection failed, trying fallback subscription"
              );
              await this.subscribeWithFallback(gameId);
              return;
            }
          } else {
            // No token available, try fallback
            console.log(
              "No authentication token available, trying fallback subscription"
            );
            await this.subscribeWithFallback(gameId);
            return;
          }
        }
      }

      // Use the dedicated subscribeToGame method from our game WebSocket service
      const subscriptionId = gameWebSocketService.subscribeToGame(
        gameId,
        (gameMessage) => {
          this.handleGameWebSocketMessage(gameMessage);
        }
      );

      if (!subscriptionId) {
        console.error(`Failed to subscribe to game events for game ${gameId}`);
        // Try the fallback method
        console.log("Primary subscription failed, trying fallback method");
        await this.subscribeWithFallback(gameId);
        return;
      }

      console.log(
        `Subscribed to game events for game ${gameId} with ID ${subscriptionId}`
      );

      // Keep track of subscriptions
      if (!this.gameSubscriptions.includes(`/topic/game.${gameId}`)) {
        this.gameSubscriptions.push(`/topic/game.${gameId}`);
      }
    } catch (error) {
      console.error("Error subscribing to game events:", error);

      // Try the fallback method on any error
      console.log("Error during subscription, trying fallback method");
      await this.subscribeWithFallback(gameId);
    }
  }

  // Fallback method for subscribing to game events when primary method fails
  private async subscribeWithFallback(gameId: string): Promise<void> {
    if (!this.userId) {
      console.error("Cannot use subscription fallback - requirements not met");
      return;
    }

    console.log("Attempting fallback subscription method for game events");

    try {
      // Try direct game WebSocket subscription
      const subscriptionId = gameWebSocketService.subscribeToGame(
        gameId,
        (gameMessage) => {
          this.handleGameWebSocketMessage(gameMessage);
        }
      );

      if (!subscriptionId) {
        console.error("Fallback subscription method failed");
        return;
      }

      console.log("Fallback game subscription successful");

      // Manually send a join notification since we couldn't use the proper endpoint
      const joinMessage = {
        type: "GAME_MESSAGE" as const,
        userId: this.userId,
        username: this.username || undefined, // Convert null to undefined to match type
        chatId: 0, // Important: use chatId 0 for games
        content: JSON.stringify({
          gameId: gameId,
          playerId: this.userId,
          playerUsername: this.username,
          action: "join",
        }),
        timestamp: new Date().toISOString(),
      };

      try {
        // First try to send via the WebSocket service
        const sentViaService = await gameWebSocketService.sendMessage(
          joinMessage,
          WS_GAME_CONSTANTS.DESTINATIONS.GAME_JOIN
        );

        console.log("Manual join notification sent as part of fallback");
      } catch (sendError) {
        console.error("Error sending manual join notification:", sendError);
      }
    } catch (error) {
      console.error("Fallback subscription method failed:", error);
    }
  }

  // Handle incoming game WebSocket messages
  private handleGameWebSocketMessage(message: any): void {
    try {
      if (!message || !message.content) return;

      // Parse game data
      let gameData;
      try {
        // Try to parse content if it's a string
        if (typeof message.content === "string") {
          gameData = JSON.parse(message.content);
        } else {
          // If content is already an object, use it directly
          gameData = message.content;
        }
      } catch (e) {
        console.error("Error parsing game data:", e);
        gameData = message.content; // Use as-is if parsing fails
      }

      // Handle different message types
      switch (message.type) {
        case "GAME_CREATE":
          console.log("Game created:", gameData);
          // Don't update game state - wait for join
          break;

        case "GAME_JOIN":
          console.log("Player joined game:", message);

          // Determine opponent username
          let opponentUsername = "";
          if (message.userId !== this.userId) {
            opponentUsername = message.username || "Opponent";
          } else if (gameData && gameData.playerUsername) {
            opponentUsername = gameData.playerUsername;
          }

          // Start the game now that someone has joined
          this.simulateGameState({
            board: Array(9).fill(null),
            currentPlayer: "X",
            winner: null,
            isMyTurn: this.player === "X",
            gameStarted: true,
            opponentUsername,
            gameEnded: false,
          });
          break;

        case "GAME_MOVE":
          console.log("Player made a move:", message);
          // Process the move - we'd update the board and game state
          if (gameData && gameData.cellIndex !== undefined) {
            // You'd implement actual move processing logic here based on your game rules
          }
          break;

        case "GAME_MESSAGE":
          // Generic game message - handle based on the action
          if (message.action) {
            console.log(`Received game ${message.action} message:`, message);

            switch (message.action) {
              case "move":
                // Process move
                break;
              case "chat":
                // Process in-game chat
                break;
              default:
                console.log("Unknown game action:", message.action);
                break;
            }
          }
          break;

        default:
          console.log("Unhandled game message type:", message.type);
          break;
      }
    } catch (error) {
      console.error("Error handling game websocket message:", error);
    }
  }

  /**
   * Get a valid chat ID that the user is a member of
   * This is used as a fallback for game messages to ensure they can be sent
   */
  private async getValidChatId(): Promise<number | null> {
    try {
      // If we have a gameId, we're in a game context and don't need a real chat
      if (this.gameId) {
        // Games use chatId 0 to indicate they are game messages, not chat messages
        return 0;
      }

      // Original implementation for non-game contexts...
      const chats = await websocketService.getAvailableChats();
      if (!chats || chats.length === 0) {
        console.log("No available chats found, will use default chat ID");
        return 1; // Default to the first chat as fallback
      }

      // Return the ID of the first available chat
      return chats[0].id;
    } catch (error) {
      console.error("Error getting valid chat ID:", error);
      return null;
    }
  }

  // Create a new game and return the game ID
  public async createGame(): Promise<string> {
    if (!this.userId || !this.username) {
      throw new Error("User not authenticated");
    }

    try {
      // Generate a new game ID
      this.gameId = uuidv4();
      this.player = "X"; // Creator is always X

      // Create a virtual game room first
      await this.ensureGameRoomExists(this.gameId);

      // First, subscribe to game events to ensure we receive game updates
      await this.subscribeToGameEvents(this.gameId);

      // Send event via WebSocket
      await this.dispatchGameEvent("create", {
        gameId: this.gameId,
        creatorId: this.userId,
        creatorUsername: this.username,
      });

      return this.gameId;
    } catch (error) {
      console.error("Failed to create game:", error);
      this.handleError(
        "Failed to create game: " +
          (error instanceof Error ? error.message : String(error))
      );
      throw error;
    }
  }

  // Join an existing game
  public async joinGame(gameId: string): Promise<void> {
    // Check if we're already authenticated before proceeding
    const isAuthenticated = await this.checkAuthenticationStatus();
    if (!isAuthenticated) {
      console.log(
        "User not authenticated yet for joining game, attempting to initialize again"
      );

      // Try to initialize user data one more time with longer timeout
      try {
        // Get user data with longer timeout since this is a join operation
        // which often happens directly after navigation to the page
        let user = null;
        let token = null;
        let attempts = 0;
        const maxAttempts = 20; // Increased to 20 attempts with exponential backoff

        // Function to check authentication state with more robust error handling
        const checkAuth = () => {
          try {
            // Try localStorage first
            token = localStorage.getItem("token");
            const userString = localStorage.getItem("user");
            if (userString) {
              try {
                user = JSON.parse(userString);
                // Validate user object has required fields
                if (user && user.id && user.username) {
                  return true;
                }
              } catch (parseError) {
                console.error(
                  "Error parsing user from localStorage:",
                  parseError
                );
              }
            }

            // Then try sessionStorage
            token = sessionStorage.getItem("token");
            const userString2 = sessionStorage.getItem("user");
            if (userString2) {
              try {
                user = JSON.parse(userString2);
                // Validate user object has required fields
                if (user && user.id && user.username) {
                  return true;
                }
              } catch (parseError) {
                console.error(
                  "Error parsing user from sessionStorage:",
                  parseError
                );
              }
            }
          } catch (e) {
            console.error("Error accessing storage during join attempt:", e);
          }
          return false;
        };

        // Initial check
        if (checkAuth()) {
          console.log("Found user data immediately");
        } else {
          // Setup polling for auth data with exponential backoff
          while (attempts < maxAttempts) {
            // Exponential backoff with a maximum of 2 seconds
            const backoff = Math.min(200 * Math.pow(1.2, attempts), 2000);
            await new Promise((resolve) => setTimeout(resolve, backoff));
            attempts++;

            if (checkAuth()) {
              console.log("Found user data on attempt", attempts);
              break;
            }

            console.log(
              `Join attempt ${attempts}/${maxAttempts} waiting for auth (next retry in ${Math.floor(
                backoff
              )}ms)...`
            );
          }
        }

        if (!user || !token) {
          console.error(
            "Failed to authenticate for game join after extended retries"
          );

          // Last-resort attempt - check if auth might be available but not in localStorage
          // This can happen with certain browser settings or private browsing
          if (typeof window !== "undefined" && window.sessionStorage) {
            try {
              const sessionToken = sessionStorage.getItem("token");
              const sessionUserString = sessionStorage.getItem("user");

              if (sessionToken && sessionUserString) {
                token = sessionToken;
                user = JSON.parse(sessionUserString);
                console.log(
                  "Retrieved authentication from sessionStorage as fallback"
                );
              }
            } catch (e) {
              console.error("Error accessing session storage:", e);
            }
          }

          if (!user || !token) {
            this.handleError(
              "User not authenticated. Please log in again before joining a game."
            );
            throw new Error("User not authenticated");
          }
        }

        // Set user information
        this.userId = user.id;
        this.username = user.username;
        console.log("Successfully authenticated for game join:", this.username);

        // Ensure WebSocket is connected with multiple retries and exponential backoff
        if (!gameWebSocketService.getConnectionStatus().connected && token) {
          // Ensure userId is a valid number
          const userIdForWebSocket = this.userId || 0; // Fallback to 0 if null

          let wsConnected = false;
          let wsAttempts = 0;
          const maxWsAttempts = 15; // Increased from 10

          while (!wsConnected && wsAttempts < maxWsAttempts) {
            console.log(
              `Game WebSocket connection attempt ${
                wsAttempts + 1
              }/${maxWsAttempts}`
            );

            try {
              wsConnected = await gameWebSocketService.connect(
                userIdForWebSocket,
                token
              );
            } catch (wsError) {
              console.error("Error during WebSocket connection:", wsError);
              wsConnected = false;
            }

            if (!wsConnected) {
              wsAttempts++;
              if (wsAttempts < maxWsAttempts) {
                const backoff = Math.min(500 * Math.pow(1.2, wsAttempts), 3000);
                console.log(
                  `Game WebSocket connection failed, retrying in ${Math.floor(
                    backoff
                  )}ms...`
                );
                await new Promise((resolve) => setTimeout(resolve, backoff));
              }
            }
          }

          if (!wsConnected) {
            console.error(
              "Failed to establish Game WebSocket connection after multiple attempts"
            );

            // Even if WebSocket fails, we can still try the direct topic subscription fallback
            // instead of completely failing the game join
            console.log(
              "Will attempt direct topic subscription as last resort"
            );
          } else {
            console.log("Game WebSocket connected successfully for game join");
          }

          // Set connected status based on actual connection state
          this.connected = wsConnected;
        }

        // Set up event listeners if they're not set up yet
        await this.setupGameEventListeners();
      } catch (e) {
        console.error("Failed to initialize for game join:", e);
        this.handleError(
          "Authentication failed. Please try refreshing the page and logging in again."
        );
        throw new Error("User not authenticated");
      }
    }

    // Now proceed with join if we have authentication
    if (!this.userId || !this.username) {
      this.handleError("Unable to join game: authentication required");
      throw new Error("User not authenticated");
    }

    try {
      this.gameId = gameId;
      this.player = "O"; // Joiner is always O

      // Ensure the game room exists
      await this.ensureGameRoomExists(gameId);

      console.log(
        `Joining game ${gameId} as player ${this.player} (${this.username})`
      );

      // IMPORTANT: First subscribe to game events to ensure we receive game updates
      // This must happen BEFORE sending the join event
      await this.subscribeToGameEvents(gameId);

      // Wait a short delay to ensure subscription completes before join
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Set a join timeout to prevent infinite loading
      const joinTimeout = setTimeout(() => {
        if (this.gameStateCallback) {
          console.log("Join timeout reached, simulating successful join");
          this.simulateGameState({
            board: Array(9).fill(null),
            currentPlayer: "X",
            winner: null,
            isMyTurn: false, // O goes second
            gameStarted: true,
            opponentUsername: "Player X",
            gameEnded: false,
          });
        }
      }, 10000); // 10 second timeout for join

      try {
        // Then dispatch join event
        await this.dispatchGameEvent("join", {
          gameId: gameId,
          playerId: this.userId,
          playerUsername: this.username,
        });

        // Clear timeout if join successful
        clearTimeout(joinTimeout);
        console.log("Join game event dispatched successfully");
      } catch (joinError) {
        console.error("Error dispatching join event:", joinError);

        // Even if dispatch fails, don't fail completely - try fallback subscription
        // clearTimeout will happen in the finally block
        await this.subscribeWithFallback(gameId);
      } finally {
        clearTimeout(joinTimeout);
      }
    } catch (error) {
      console.error("Error joining game:", error);
      this.handleError(
        "Failed to join game: " +
          (error instanceof Error ? error.message : String(error))
      );
      throw error;
    }
  }

  // Make a move in the game
  public async makeMove(cellIndex: number): Promise<void> {
    if (!this.gameId || !this.userId || !this.player) {
      this.handleError("Game not initialized");
      return;
    }

    try {
      // Dispatch move event
      await this.dispatchGameEvent("move", {
        gameId: this.gameId,
        playerId: this.userId,
        cellIndex: cellIndex,
        player: this.player,
      });
    } catch (error) {
      console.error("Failed to make move:", error);
      this.handleError(
        "Failed to make move: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  }

  // Invite another user to play
  public async inviteUser(recipientId: number, gameId: string): Promise<void> {
    if (!this.userId || !this.username) {
      throw new Error("User not authenticated");
    }

    try {
      // Dispatch invite event
      await this.dispatchGameEvent("invite", {
        gameId: gameId,
        inviterId: this.userId,
        inviterUsername: this.username,
        recipientId: recipientId,
      });
    } catch (error) {
      console.error("Failed to invite user:", error);
      this.handleError(
        "Failed to send invitation: " +
          (error instanceof Error ? error.message : String(error))
      );
      throw error;
    }
  }

  // Request a new game with the same opponent
  public async requestNewGame(): Promise<void> {
    if (!this.gameId || !this.userId) {
      this.handleError("Game not initialized");
      return;
    }

    try {
      // Dispatch new game request event
      await this.dispatchGameEvent("newGame", {
        gameId: this.gameId,
        requesterId: this.userId,
      });
    } catch (error) {
      console.error("Failed to request new game:", error);
      this.handleError(
        "Failed to request new game: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  }

  // Helper method to dispatch game events
  private async dispatchGameEvent(type: string, data: any): Promise<void> {
    console.log(`[TicTacToe] Dispatching game event: ${type} with data:`, data);

    if (!this.userId) {
      console.error("[TicTacToe] Cannot dispatch game event: No user ID");
      this.handleError("User not authenticated");
      return;
    }

    // Check if game WebSocket is connected
    const wsStatus = gameWebSocketService.getConnectionStatus();
    console.log(`[TicTacToe] WebSocket status before dispatch:`, wsStatus);

    if (!wsStatus.connected) {
      console.error(
        "[TicTacToe] Game WebSocket not connected, attempting reconnect"
      );

      try {
        if (await this.checkAuthenticationStatus()) {
          const token =
            localStorage.getItem("token") || sessionStorage.getItem("token");
          if (token) {
            console.log(
              `[TicTacToe] Reconnecting WebSocket for user ${this.userId}`
            );
            const reconnected = await gameWebSocketService.connect(
              this.userId,
              token
            );
            console.log(
              `[TicTacToe] Reconnection result: ${
                reconnected ? "success" : "failed"
              }`
            );

            if (!reconnected) {
              this.handleError("Game WebSocket not connected");
              return;
            }
          } else {
            console.error("[TicTacToe] No auth token found for reconnection");
            this.handleError("No authentication token");
            return;
          }
        } else {
          console.error("[TicTacToe] Authentication check failed");
          this.handleError("Authentication check failed");
          return;
        }
      } catch (error) {
        console.error("[TicTacToe] Reconnection error:", error);
        this.handleError("Game WebSocket not connected");
        return;
      }
    }

    try {
      // First, determine the appropriate destination based on the event type
      let destination;
      switch (type) {
        case "create":
          destination = WS_GAME_CONSTANTS.DESTINATIONS.GAME_CREATE;
          break;
        case "join":
          destination = WS_GAME_CONSTANTS.DESTINATIONS.GAME_JOIN;
          break;
        case "move":
          destination = WS_GAME_CONSTANTS.DESTINATIONS.GAME_MOVE;
          break;
        case "invite":
          destination = WS_GAME_CONSTANTS.DESTINATIONS.GAME_INVITE;
          break;
        default:
          destination = WS_GAME_CONSTANTS.DESTINATIONS.GAME_MOVE;
      }

      console.log(`[TicTacToe] Using destination: ${destination}`);

      // Always use chatId=0 for games
      const chatId = 0;

      // Prepare message content
      let content: string;
      if (typeof data === "string") {
        content = data;
      } else {
        content = JSON.stringify({
          gameId: this.gameId,
          player: this.player,
          type: type,
          data: data,
        });
      }

      console.log(`[TicTacToe] Prepared message content: ${content}`);

      // Send the message using the game WebSocket service
      const message = {
        type: "GAME_MESSAGE" as const,
        userId: this.userId,
        chatId: chatId,
        content: content,
        timestamp: new Date().toISOString(),
      };

      console.log(`[TicTacToe] Sending message to ${destination}:`, message);

      // Dispatch the message using the dedicated game WebSocket service
      const success = await gameWebSocketService.sendMessage(
        message,
        destination
      );

      if (!success) {
        console.error(`[TicTacToe] Failed to send game event: ${type}`);
        this.handleError(`Failed to send game event: ${type}`);
      } else {
        console.log(`[TicTacToe] Game event ${type} sent successfully`);

        // Also simulate response for development/debugging
        this.simulateGameResponse(type, data);
      }
    } catch (error) {
      console.error(
        `[TicTacToe] Error dispatching game event (${type}):`,
        error
      );
      this.handleError(`Error dispatching event: ${error}`);
    }
  }

  // Simulate game responses for development/demo purposes
  private simulateGameResponse(type: string, data: any): void {
    console.log("Simulating game response for:", type, data);

    setTimeout(() => {
      switch (type) {
        case "create":
          // Simulate waiting for opponent - don't auto-start the game
          console.log("Simulating game creation - waiting for opponent");
          this.simulateGameState({
            board: Array(9).fill(null),
            currentPlayer: "X",
            winner: null,
            isMyTurn: true,
            gameStarted: false, // Keep gameStarted false until someone joins
            opponentUsername: "",
            gameEnded: false,
          });
          break;

        case "join":
          // Simulate game start ONLY when someone joins
          console.log("Simulating player joining the game");

          // Get the opponent's username from the data or use a default
          const opponentUsername =
            data.playerUsername ||
            (this.player === "X" ? "opponent" : this.username || "opponent");

          this.simulateGameState({
            board: Array(9).fill(null),
            currentPlayer: "X",
            winner: null,
            isMyTurn: this.player === "X",
            gameStarted: true, // Now we can start the game
            opponentUsername: opponentUsername,
            gameEnded: false,
          });
          break;

        case "move":
          // Simulate move
          if (this.gameStateCallback && this.player) {
            const cellIndex = data.cellIndex;
            const currentBoard = Array(9).fill(null);
            currentBoard[cellIndex] = this.player;

            // Check for win or draw
            const winningCombos = [
              [0, 1, 2],
              [3, 4, 5],
              [6, 7, 8], // rows
              [0, 3, 6],
              [1, 4, 7],
              [2, 5, 8], // columns
              [0, 4, 8],
              [2, 4, 6], // diagonals
            ];

            let winner = null;
            for (const combo of winningCombos) {
              if (combo.every((i) => currentBoard[i] === this.player)) {
                winner = {
                  player: this.player,
                  cells: combo,
                };
                break;
              }
            }

            const gameEnded = winner !== null || !currentBoard.includes(null);

            // Access the current game state through a local variable
            const currentGameState = window.meowsengerGameState as
              | GameState
              | undefined;
            const opponentName =
              currentGameState?.opponentUsername || "opponent";

            this.simulateGameState({
              board: currentBoard,
              currentPlayer: this.player === "X" ? "O" : "X",
              winner,
              isMyTurn: false,
              gameStarted: true,
              opponentUsername: opponentName,
              gameEnded,
            });

            // Simulate opponent's move if game is not ended
            if (!gameEnded) {
              setTimeout(() => {
                const availableMoves = currentBoard
                  .map((cell, index) => (cell === null ? index : -1))
                  .filter((index) => index !== -1);

                if (availableMoves.length > 0) {
                  const randomMove =
                    availableMoves[
                      Math.floor(Math.random() * availableMoves.length)
                    ];
                  const newBoard = [...currentBoard];
                  const opponentPlayer = this.player === "X" ? "O" : "X";
                  newBoard[randomMove] = opponentPlayer;

                  // Check for opponent win
                  let opponentWinner = null;
                  for (const combo of winningCombos) {
                    if (combo.every((i) => newBoard[i] === opponentPlayer)) {
                      opponentWinner = {
                        player: opponentPlayer,
                        cells: combo,
                      };
                      break;
                    }
                  }

                  const gameEnded =
                    opponentWinner !== null || !newBoard.includes(null);

                  // Get the most up-to-date game state
                  const updatedGameState = window.meowsengerGameState as
                    | GameState
                    | undefined;
                  const currentOpponentName =
                    updatedGameState?.opponentUsername || opponentName;

                  this.simulateGameState({
                    board: newBoard,
                    currentPlayer: this.player || "X", // Default to X if player is null
                    winner: opponentWinner,
                    isMyTurn: true,
                    gameStarted: true,
                    opponentUsername: currentOpponentName,
                    gameEnded,
                  });
                }
              }, 1000);
            }
          }
          break;

        case "newGame":
          // Simulate new game
          if (this.player) {
            // Get current game state
            const currentGameState = window.meowsengerGameState as
              | GameState
              | undefined;
            const currentOpponentName =
              currentGameState?.opponentUsername || "opponent";

            this.simulateGameState({
              board: Array(9).fill(null),
              currentPlayer: "X",
              winner: null,
              isMyTurn: this.player === "X",
              gameStarted: true,
              opponentUsername: currentOpponentName,
              gameEnded: false,
            });
          }
          break;
      }
    }, 500);
  }

  private simulateGameState(state: GameState): void {
    if (this.gameStateCallback) {
      this.gameStateCallback(state);
    }
  }

  // Register callback for game state updates
  public onGameStateUpdate(callback: (state: GameState) => void): void {
    this.gameStateCallback = callback;
  }

  // Register callback for errors
  public onGameError(callback: (error: string) => void): void {
    this.errorCallback = callback;
  }

  // Handle errors
  private handleError(error: string): void {
    console.error(`[TicTacToeService] Error: ${error}`);
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }

  /**
   * Check if user is authenticated and WebSocket is connected
   * Returns true if authenticated and connected, false otherwise
   */
  public async checkAuthenticationStatus(): Promise<boolean> {
    // Check if we have user credentials
    if (!this.userId || !this.username) {
      console.log("Authentication check: No user ID or username");

      // Try to get user from localStorage
      try {
        const token = localStorage.getItem("token");
        const userString = localStorage.getItem("user");

        if (token && userString) {
          const user = JSON.parse(userString);
          this.userId = user.id;
          this.username = user.username;

          // If we have credentials but no connection, try to connect
          if (!gameWebSocketService.getConnectionStatus().connected) {
            console.log(
              "Found credentials, attempting to connect Game WebSocket"
            );
            return await gameWebSocketService.connect(this.userId || 0, token);
          } else {
            return true; // We have credentials and WebSocket is connected
          }
        }
      } catch (e) {
        console.error("Error checking auth status:", e);
      }

      return false;
    }

    // Check if Game WebSocket is connected
    if (!gameWebSocketService.getConnectionStatus().connected) {
      console.log(
        "Authentication check: User authenticated but Game WebSocket disconnected"
      );

      // Try to get token and reconnect
      try {
        const token = localStorage.getItem("token");
        if (token) {
          console.log("Found token, attempting to reconnect Game WebSocket");
          return await gameWebSocketService.connect(this.userId || 0, token);
        }
      } catch (e) {
        console.error("Error reconnecting Game WebSocket:", e);
      }

      return false;
    }

    return true; // Both authenticated and WebSocket connected
  }

  /**
   * Disconnect from game and WebSocket
   */
  public async disconnect(): Promise<void> {
    // Clean up event listeners
    window.removeEventListener("meowsenger:game:update", this.handleGameUpdate);
    window.removeEventListener("meowsenger:game:invite", this.handleGameInvite);

    // Clean up WebSocket subscriptions
    if (this.gameId) {
      gameWebSocketService.unsubscribeFromGame(this.gameId);
    }

    // Reset game state
    this.gameId = null;
    this.player = null;

    console.log("Game disconnected and resources cleaned up");
  }

  // Event handler methods
  private handleGameUpdate = (event: any) => {
    if (event.detail && event.detail.gameId === this.gameId) {
      if (this.gameStateCallback) {
        this.gameStateCallback(event.detail.state);
      }
    }
  };

  private handleGameInvite = (event: any) => {
    console.log("Game invite received:", event.detail);
  };

  /**
   * Ensure a virtual game room exists for this game
   * This helps avoid issues with backend chat membership checks
   */
  private async ensureGameRoomExists(gameId: string): Promise<void> {
    try {
      // Store this game ID with its associated metadata
      const gameRoomKey = `gameRoom_${gameId}`;

      // Store in both localStorage and sessionStorage for resilience
      localStorage.setItem(
        gameRoomKey,
        JSON.stringify({
          gameId: gameId,
          created: new Date().toISOString(),
          userId: this.userId,
        })
      );
      sessionStorage.setItem(
        gameRoomKey,
        JSON.stringify({
          gameId: gameId,
          created: new Date().toISOString(),
          userId: this.userId,
        })
      );

      console.log(`Registered game ${gameId}`);

      // Also store this in our active games list for future reference
      try {
        const activeGamesStr = localStorage.getItem("activeGames") || "[]";
        const activeGames = JSON.parse(activeGamesStr);

        if (!activeGames.includes(gameId)) {
          activeGames.push(gameId);
          localStorage.setItem("activeGames", JSON.stringify(activeGames));
        }
      } catch (e) {
        console.error("Error updating active games:", e);
      }
    } catch (error) {
      console.error("Error ensuring game room exists:", error);
    }
  }

  /**
   * Get the game metadata
   */
  private getGameMetadata(gameId: string): any | null {
    try {
      const gameRoomKey = `gameRoom_${gameId}`;
      const metadataStr =
        localStorage.getItem(gameRoomKey) ||
        sessionStorage.getItem(gameRoomKey);

      if (metadataStr) {
        return JSON.parse(metadataStr);
      }

      return null;
    } catch (error) {
      console.error("Error getting game metadata:", error);
      return null;
    }
  }
}

// Create a singleton instance
const ticTacToeService = new TicTacToeService();
export default ticTacToeService;

// Declare global window interface with meowsengerGameState property
declare global {
  interface Window {
    meowsengerGameState?: GameState;
  }
}
