import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";

// Use the WebSocket URL directly instead of deriving it from API_URL
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:8081/ws";

export type MessageCallback = (message: any) => void;

export interface WebSocketMessage {
  type:
    | "GAME_CREATE"
    | "GAME_JOIN"
    | "GAME_MOVE"
    | "GAME_MESSAGE"
    | "GAME_INVITE"
    | "GAME_STATE";
  userId: number;
  chatId?: number; // Optional for games (usually set to 0)
  username?: string;
  content: string;
  timestamp: string;
  gameId?: string; // Game-specific field
  action?: string; // Game-specific field
}

export interface ConnectionStatus {
  connected: boolean;
  lastAttempt: Date | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

class GameWebSocketService {
  private client: Client | null = null;
  private connectionStatus: ConnectionStatus = {
    connected: false,
    lastAttempt: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
  };
  private userId: number | null = null;
  private token: string | null = null;
  private subscriptions: Map<
    string,
    { id: string; callback: MessageCallback }
  > = new Map();

  // Singleton pattern
  private static instance: GameWebSocketService;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): GameWebSocketService {
    if (!GameWebSocketService.instance) {
      GameWebSocketService.instance = new GameWebSocketService();
    }
    return GameWebSocketService.instance;
  }

  /**
   * Connect to the WebSocket server specifically for games
   * @param userId User ID
   * @param token Auth token
   * @returns True if connection is successful or already connected
   */
  public async connect(userId: number, token: string): Promise<boolean> {
    console.log(`[GameWebSocket] Attempting to connect for user ${userId}...`);

    if (
      this.connectionStatus.connected &&
      this.client &&
      this.client.connected
    ) {
      console.log("[GameWebSocket] Already connected");
      return true;
    }

    this.userId = userId;
    this.token = token;

    return new Promise((resolve) => {
      try {
        this.connectionStatus.lastAttempt = new Date();
        console.log(
          `[GameWebSocket] Creating SockJS connection to ${WS_URL}?user_id=${userId}`
        );

        const socket = new SockJS(`${WS_URL}?user_id=${userId}&token=${token}`);
        this.client = new Client({
          webSocketFactory: () => socket,
          debug: (msg) => {
            // Always enable debug logs for troubleshooting
            console.debug("[GameWebSocket Debug]", msg);
          },
          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
        });

        this.client.onConnect = (frame) => {
          console.log("[GameWebSocket] Connected with frame:", frame);
          this.connectionStatus.connected = true;
          this.connectionStatus.reconnectAttempts = 0;

          // Register with server (only needed once per connection)
          this.registerUser(userId);

          resolve(true);
        };

        this.client.onStompError = (frame) => {
          console.error(
            "[GameWebSocket] STOMP Error:",
            frame.headers,
            frame.body
          );
          this.connectionStatus.connected = false;
          resolve(false);
        };

        this.client.onWebSocketClose = (event) => {
          console.log(
            "[GameWebSocket] Connection closed with code:",
            event.code,
            "reason:",
            event.reason
          );
          this.connectionStatus.connected = false;

          if (
            this.connectionStatus.reconnectAttempts <
            this.connectionStatus.maxReconnectAttempts
          ) {
            console.log(
              `[GameWebSocket] Will attempt to reconnect (${
                this.connectionStatus.reconnectAttempts + 1
              }/${this.connectionStatus.maxReconnectAttempts})`
            );
            this.connectionStatus.reconnectAttempts++;
          }
        };

        console.log("[GameWebSocket] Activating STOMP client...");
        this.client.activate();
      } catch (error) {
        console.error("[GameWebSocket] Connection failed with error:", error);
        this.connectionStatus.connected = false;
        resolve(false);
      }
    });
  }

  /**
   * Register user with the WebSocket server
   * @param userId
   */
  private registerUser(userId: number): void {
    if (!this.client || !this.connectionStatus.connected) {
      console.error("[GameWebSocket] Cannot register user - not connected");
      return;
    }

    try {
      const message: WebSocketMessage = {
        type: "GAME_MESSAGE",
        userId: userId,
        content: "Game client connected",
        timestamp: new Date().toISOString(),
      };

      this.client.publish({
        destination: "/app/register",
        body: JSON.stringify(message),
      });

      console.log("[GameWebSocket] User registered:", userId);
    } catch (error) {
      console.error("[GameWebSocket] Failed to register user:", error);
    }
  }

  /**
   * Send a game message to the server
   * @param message Message to send
   * @param destination Destination endpoint (e.g. "/app/game.action")
   * @returns True if message was sent successfully
   */
  public async sendMessage(
    message: WebSocketMessage,
    destination: string
  ): Promise<boolean> {
    if (!this.client || !this.connectionStatus.connected) {
      console.error("[GameWebSocket] Cannot send message - not connected");

      // Try to reconnect if we have credentials
      if (this.userId && this.token) {
        console.log(
          "[GameWebSocket] Attempting to reconnect before sending message"
        );
        const reconnected = await this.connect(this.userId, this.token);
        if (!reconnected) {
          return false;
        }
      } else {
        return false;
      }
    }

    try {
      // Always ensure game messages are properly identified (with chatId=0)
      if (message.chatId === undefined) {
        message.chatId = 0;
      }

      // Ensure the correct message type
      if (!message.type.startsWith("GAME_")) {
        message.type = "GAME_MESSAGE" as any;
      }

      console.log(
        `[GameWebSocket] Sending message to ${destination}:`,
        JSON.stringify(message)
      );

      this.client!.publish({
        destination: destination,
        body: JSON.stringify(message),
      });

      console.log(
        `[GameWebSocket] Message sent successfully to ${destination}`
      );
      return true;
    } catch (error) {
      console.error("[GameWebSocket] Failed to send message:", error);
      return false;
    }
  }

  /**
   * Subscribe to game updates
   * @param gameId
   * @param callback
   * @returns Subscription ID or empty string if failed
   */
  public subscribeToGame(gameId: string, callback: MessageCallback): string {
    if (!this.client || !this.connectionStatus.connected) {
      console.error("[GameWebSocket] Cannot subscribe - not connected");
      return "";
    }

    const subscriptionKey = `game_${gameId}`;

    // Check if already subscribed
    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`[GameWebSocket] Already subscribed to game ${gameId}`);
      return this.subscriptions.get(subscriptionKey)!.id;
    }

    try {
      // Subscribe to the game-specific topic
      const destination = `/topic/game.${gameId}`;

      const subscription = this.client.subscribe(
        destination,
        (message: IMessage) => {
          try {
            const body = JSON.parse(message.body);
            callback(body);
          } catch (e) {
            console.error("[GameWebSocket] Error parsing game message:", e);
          }
        },
        { id: subscriptionKey }
      );

      this.subscriptions.set(subscriptionKey, {
        id: subscription.id,
        callback,
      });

      console.log(`[GameWebSocket] Subscribed to game ${gameId}`);

      // Now also send a subscription request to the server to register properly
      this.sendSubscriptionRequest(gameId);

      return subscription.id;
    } catch (error) {
      console.error("[GameWebSocket] Error subscribing to game:", error);
      return "";
    }
  }

  /**
   * Send explicit subscription request to the server for game events
   */
  private async sendSubscriptionRequest(gameId: string): Promise<void> {
    if (!this.userId) {
      console.error(
        "[GameWebSocket] Cannot subscribe - user not authenticated"
      );
      return;
    }

    try {
      console.log(
        `[GameWebSocket] Sending subscription request for game ${gameId}`
      );

      // Use the dedicated game.subscribe endpoint which bypasses chat membership checks
      await this.sendMessage(
        {
          type: "GAME_MESSAGE",
          userId: this.userId,
          chatId: 0, // chatId 0 indicates this is a game message
          content: gameId,
          timestamp: new Date().toISOString(),
        },
        "/app/game.subscribe"
      );

      console.log(
        `[GameWebSocket] Subscription request sent for game ${gameId}`
      );
    } catch (error) {
      console.error(
        "[GameWebSocket] Error sending subscription request:",
        error
      );
    }
  }

  /**
   * Unsubscribe from a game
   * @param gameId Game ID
   * @returns True if unsubscribed successfully
   */
  public unsubscribeFromGame(gameId: string): boolean {
    const subscriptionKey = `game_${gameId}`;

    if (
      !this.subscriptions.has(subscriptionKey) ||
      !this.client ||
      !this.connectionStatus.connected
    ) {
      return false;
    }

    try {
      const subscriptionId = this.subscriptions.get(subscriptionKey)!.id;
      this.client.unsubscribe(subscriptionId);
      this.subscriptions.delete(subscriptionKey);
      console.log(`[GameWebSocket] Unsubscribed from game ${gameId}`);
      return true;
    } catch (error) {
      console.error("[GameWebSocket] Error unsubscribing from game:", error);
      return false;
    }
  }

  /**
   * Get connection status
   * @returns Current connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    if (this.client) {
      this.client.deactivate();
      this.connectionStatus.connected = false;
      this.subscriptions.clear();
      console.log("[GameWebSocket] Disconnected");
    }
  }
}

// Create singleton instance
const gameWebSocketService = GameWebSocketService.getInstance();
export default gameWebSocketService;
