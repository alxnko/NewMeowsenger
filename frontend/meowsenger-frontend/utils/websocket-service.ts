import { Client, IFrame, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  generateMakeAdminSystemMessage,
  generateRemoveAdminSystemMessage,
  generateUpdateSettingsSystemMessage,
  generateAddUserSystemMessage,
  generateRemoveUserSystemMessage,
} from "./system-message-utils";

export interface WebSocketMessage {
  type:
    | "CHAT"
    | "JOIN"
    | "LEAVE"
    | "SUBSCRIBE"
    | "ERROR"
    | "TYPING"
    | "READ"
    | "CHAT_UPDATE"
    | "ADMIN_STATUS_CHANGE" // New type for admin status change notifications
    | "USER_REMOVED" // New type for user removal notifications
    | "GAME_MESSAGE" // Game-related message types
    | "GAME_CREATE"
    | "GAME_JOIN"
    | "GAME_MOVE"
    | "GAME_INVITE"
    | "GAME_STATE";
  chatId: number;
  userId: number;
  content: string;
  timestamp: string;
  messageId?: number;

  // Enhanced message data fields
  username?: string; // Name of the message sender
  isEdited?: boolean; // Whether the message has been edited
  isDeleted?: boolean; // Whether the message has been deleted
  isSystem?: boolean; // Whether it's a system message
  replyTo?: number; // ID of message being replied to
  isForwarded?: boolean; // Whether message is forwarded from another chat
  isRead?: boolean; // Whether message has been read by recipient

  // Structured system message fields
  system_message_type?: string; // Type of system message
  system_message_params?: Record<string, string | number>; // Parameters for system message translation

  // Group chat related fields
  isGroup?: boolean; // Whether this is a group chat
  chatName?: string; // Name of the chat (for group notifications)

  // Update type for CHAT_UPDATE messages
  updateType?:
    | "NEW_CHAT"
    | "MEMBER_ADDED"
    | "MEMBER_REMOVED"
    | "ADMIN_CHANGED"
    | "SETTINGS_CHANGED" // New update type for settings changes
    | string;

  // Admin status change fields
  targetUserId?: number; // ID of the user whose admin status changed
  targetUsername?: string; // Username of the user whose admin status changed
  changedByUsername?: string; // Username of the user who changed the admin status
  isPromotion?: boolean; // Whether the user was promoted or demoted

  // User removal fields
  removedByUsername?: string; // Username of the user who removed someone

  // Chat settings change fields
  updateMessage?: string; // Message about what changed

  // Game-specific fields
  gameType?: string; // Type of game (tictactoe, etc.)
  gameId?: string; // ID of the game
  gameData?: any; // Game-specific data
  action?: string; // Game action (create, join, move, etc.)

  // Internal fields for message queue management
  __destination?: string; // Internal field for tracking destination when queuing messages
}

export type MessageCallback = (message: WebSocketMessage) => void;

/**
 * Constants for WebSocket operations
 */
const WS_CONSTANTS = {
  DESTINATIONS: {
    REGISTER: "/app/register",
    CHAT_SEND: "/app/chat.send",
    CHAT_FORWARD: "/app/chat.forward",
    CHAT_SUBSCRIBE: "/app/chat.subscribe",
    CHATS_SUBSCRIBE: "/app/chats.subscribe",
    CHAT_READ: "/app/chat.read",
    CHAT_EDIT: "/app/chat.edit",
    CHAT_DELETE: "/app/chat.delete",
    CHAT_TYPING: "/app/chat.typing",
    ADMIN_CHANGE: "/app/chat.admin-change",
    MEMBER_REMOVED: "/app/chat.member-removed",
    MEMBER_ADDED: "/app/chat.member-added",
    SETTINGS_CHANGED: "/app/chat.settings-changed",
    PING: "/app/ping",
  },
  SUBSCRIPTION_PREFIXES: {
    CHAT: "chat_",
    TYPING: "typing_",
    READ_RECEIPTS: "read_receipts_",
    CHAT_UPDATES: "chat_updates_",
    ADMIN_CHANGES: "admin_changes_",
    USER_REMOVALS: "user_removals_",
    MEMBER_ADDITIONS: "member_additions_",
  },
  CONNECTION: {
    MAX_RECONNECT_ATTEMPTS: 15, // Increased from 10
    RECONNECT_DELAY: 2000, // Decreased from 3000
    CONNECTION_TIMEOUT: 20000, // Keeps same as before
    PING_INTERVAL: 20000, // Decreased from 45000
    HEALTH_CHECK_INTERVAL: 60000, // New: interval to check connection health
  },
  STORAGE_KEYS: {
    WS_CONNECTED: "ws_connected",
    USERNAME: "username",
    USER: "user",
  },
};

class WebSocketService {
  private client: Client | null = null;
  private connected: boolean = false;
  private subscriptions: Map<
    string,
    { id: string; callback: MessageCallback }
  > = new Map();
  private messageQueue: WebSocketMessage[] = [];
  private userId: number | null = null;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastPingTime: number = 0;
  private lastPongTime: number = 0;
  private connectionToken: string | null = null; // Store token for reconnections

  // Base WebSocket URL - SockJS requires http/https URLs
  private readonly WS_URL = (() => {
    // Get the URL from env or use the default (ensure it points to correct port 8081)
    const envUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:8081/ws";

    // In production/deployed environments, ensure we use https if we're on a secure connection
    if (typeof window !== "undefined") {
      // Check if we should use HTTPS based on current page protocol
      if (window.location.protocol === "https:" && envUrl.startsWith("http:")) {
        return envUrl.replace("http:", "https:");
      }

      // If URL format is incorrect (user might have set ws:// or wss://), convert to http/https for SockJS
      if (envUrl.startsWith("ws:")) {
        return envUrl.replace("ws:", "http:");
      }
      if (envUrl.startsWith("wss:")) {
        return envUrl.replace("wss:", "https:");
      }
    }

    return envUrl;
  })();

  /**
   * Initialize the WebSocket connection
   */
  public connect(userId: number, token: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Clear any existing timeouts
      this.clearTimers();

      if (this.client && this.connected) {
        console.log("[WebSocket] Already connected");
        resolve(true);
        return;
      }

      this.userId = userId;
      this.connectionToken = token; // Store token for reconnections
      console.log("[WebSocket] Attempting to connect...");

      // Use the preconfigured URL - SockJS requires http/https, not ws/wss
      const sockjsUrl = this.WS_URL;
      console.log(
        `[WebSocket] Using SockJS URL: ${sockjsUrl} (SockJS will handle protocol upgrade)`
      );

      // Store username for messages
      this.setupUsername();

      // Create STOMP client with enhanced URL
      this.setupClient(token, sockjsUrl);

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        console.error("[WebSocket] Connection timed out");
        this.cleanup();
        resolve(false);
      }, WS_CONSTANTS.CONNECTION.CONNECTION_TIMEOUT);

      // Configure client event handlers
      this.setupClientHandlers(resolve, token);

      // Reset ping/pong times
      this.lastPingTime = Date.now();
      this.lastPongTime = Date.now();

      // Activate the client
      try {
        console.log("[WebSocket] Activating client...");
        this.client?.activate();
      } catch (error) {
        console.error("[WebSocket] Failed to activate client:", error);
        this.updateConnectionStatus(false);
        this.cleanup();
        resolve(false);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    if (this.client && this.connected) {
      this.client.deactivate();
      this.connected = false;
      this.subscriptions.clear();
      this.clearTimers();
      this.updateConnectionStatus(false);
    }
  }

  /**
   * Clear all timers to prevent memory leaks
   */
  private clearTimers(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.client = null;
    this.connected = false;
    this.clearTimers();
  }

  /**
   * Set up the STOMP client
   */
  private setupClient(token: string, wsURL: string = this.WS_URL): void {
    console.log(`[WebSocket] Setting up client with URL: ${wsURL}`);

    // Generate a unique client ID to prevent connection confusion
    const clientId = `meowsenger-client-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 10)}`;

    this.client = new Client({
      webSocketFactory: () => {
        // Add timestamp and client ID parameters
        // The timestamp is crucial to prevent caching issues with Cloud Run
        const sockjsUrl = `${wsURL}?t=${Date.now()}&clientId=${clientId}`;
        console.log(`[WebSocket] Creating SockJS connection to: ${sockjsUrl}`);

        try {
          // Configure SockJS specifically for Cloud Run
          // Only use transports that work well with Cloud Run
          const socket = new SockJS(sockjsUrl, null, {
            transports: ["websocket", "xhr-streaming"],
            timeout: 30000, // Increased timeout for Cloud Run latency
          });

          // Enhanced error handling with detailed logging
          socket.onerror = (error) => {
            console.error("[SockJS] Connection error:", error);
          };

          socket.onclose = (event) => {
            console.log(
              `[SockJS] Connection closed with code: ${event?.code}, reason: ${
                event?.reason || "Unknown"
              }`
            );
            // Log detailed information about the close event
            if (event?.code) {
              switch (event.code) {
                case 1000:
                  console.log("[SockJS] Normal closure");
                  break;
                case 1001:
                  console.log("[SockJS] Remote going away");
                  break;
                case 1002:
                  console.log("[SockJS] Protocol error");
                  break;
                case 1003:
                  console.log("[SockJS] Unsupported data");
                  break;
                case 1005:
                  console.log("[SockJS] No status code");
                  break;
                case 1006:
                  console.log(
                    "[SockJS] Abnormal closure - likely a Cloud Run timeout"
                  );
                  break;
                case 1007:
                  console.log("[SockJS] Invalid frame payload data");
                  break;
                case 1008:
                  console.log("[SockJS] Policy violation");
                  break;
                case 1009:
                  console.log("[SockJS] Message too big");
                  break;
                case 1010:
                  console.log("[SockJS] Missing extension");
                  break;
                case 1011:
                  console.log("[SockJS] Internal error");
                  break;
                case 1012:
                  console.log("[SockJS] Service restart");
                  break;
                case 1013:
                  console.log("[SockJS] Try again later");
                  break;
                case 1014:
                  console.log("[SockJS] Bad gateway");
                  break;
                case 1015:
                  console.log("[SockJS] TLS handshake failure");
                  break;
                default:
                  console.log(`[SockJS] Unknown close code: ${event.code}`);
              }
            }
          };

          // Add diagnostic open handler
          socket.onopen = () => {
            console.log("[SockJS] Connection opened successfully");
          };

          return socket;
        } catch (error) {
          console.error("[SockJS] Error creating socket:", error);
          throw error;
        }
      },
      connectHeaders: {
        Authorization: `Bearer ${token}`, // Include token in connection headers
        "X-Client-ID": clientId, // Add client ID for debugging
      },
      debug: (msg) => {
        this.parseMessageForDebugging(msg);
      },
      reconnectDelay: WS_CONSTANTS.CONNECTION.RECONNECT_DELAY,
      heartbeatIncoming: 25000, // Increased from default 10000
      heartbeatOutgoing: 25000, // Increased from default 10000
    });
  }

  /**
   * Parse STOMP messages for debugging
   */
  private parseMessageForDebugging(msg: string): void {
    if (msg.includes("MESSAGE") && msg.includes("destination:")) {
      try {
        const bodyStart = msg.indexOf("body:");
        if (bodyStart !== -1) {
          const body = msg.substring(bodyStart + 5).trim();
          const parsedBody = JSON.parse(body);
          console.log("[STOMP] Received message body:", parsedBody);
        }
      } catch (error) {
        console.error("[STOMP] Error parsing message body:", error);
      }
    }
  }

  /**
   * Set up username from session storage
   */
  private setupUsername(): void {
    const username = sessionStorage.getItem(WS_CONSTANTS.STORAGE_KEYS.USERNAME);
    if (username) {
      return;
    }

    // Check localStorage as a fallback
    const localUsername = localStorage.getItem(
      WS_CONSTANTS.STORAGE_KEYS.USERNAME
    );
    if (localUsername) {
      console.log(
        "[WebSocket] Using username from local storage:",
        localUsername
      );
      sessionStorage.setItem(WS_CONSTANTS.STORAGE_KEYS.USERNAME, localUsername);
      return;
    }

    // Try to get username from user object in session storage
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(
          sessionStorage.getItem(WS_CONSTANTS.STORAGE_KEYS.USER) || "{}"
        );
        if (user && user.username) {
          sessionStorage.setItem(
            WS_CONSTANTS.STORAGE_KEYS.USERNAME,
            user.username
          );
          console.log("[WebSocket] Stored username in session:", user.username);
          return;
        }
      } catch (e) {
        console.error("[WebSocket] Error parsing user from session storage", e);
      }
    }

    // Try to get username from user object in local storage as last resort
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(
          localStorage.getItem(WS_CONSTANTS.STORAGE_KEYS.USER) || "{}"
        );
        if (user && user.username) {
          sessionStorage.setItem(
            WS_CONSTANTS.STORAGE_KEYS.USERNAME,
            user.username
          );
          console.log(
            "[WebSocket] Stored username from local storage:",
            user.username
          );
          return;
        }
      } catch (e) {
        console.error("[WebSocket] Error parsing user from local storage", e);
      }
    }

    console.warn("[WebSocket] Could not determine username from storage");
  }

  /**
   * Set up client event handlers
   */
  private setupClientHandlers(
    resolve: (value: boolean) => void,
    token: string
  ): void {
    if (!this.client) return;

    this.client.onConnect = (frame: IFrame) => {
      if (this.connectionTimeout) clearTimeout(this.connectionTimeout);

      console.log("[WebSocket] Connected successfully");
      this.connected = true;
      this.reconnectAttempts = 0;
      this.lastPongTime = Date.now(); // Connection is a successful "pong"

      // Update connection status
      this.updateConnectionStatus(true);

      // Register user and handle subscriptions
      this.onSuccessfulConnection();

      // Setup heartbeat for connection monitoring
      this.setupHeartbeat();

      // Setup health check
      this.setupHealthCheck();

      resolve(true);
    };

    this.client.onStompError = (frame: IFrame) => {
      if (this.connectionTimeout) clearTimeout(this.connectionTimeout);

      console.error(
        "[WebSocket] Connection error:",
        frame.headers["message"],
        "Additional details:",
        frame.body
      );

      this.connected = false;
      this.cleanup();
      this.updateConnectionStatus(false);
      resolve(false);
    };

    this.client.onWebSocketClose = (event) => {
      console.log(
        `[WebSocket] Connection closed: code=${event?.code}, reason=${event?.reason}`
      );
      this.connected = false;
      this.updateConnectionStatus(false);
      this.attemptReconnection(token);
    };
  }

  /**
   * Set up heartbeat to monitor connection health
   */
  private setupHeartbeat(): void {
    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Subscribe to pong responses from server
    if (this.client && this.connected) {
      this.client.subscribe("/topic/pong", (message: IMessage) => {
        try {
          const pong = JSON.parse(message.body);
          this.lastPongTime = Date.now();
          console.debug("[WebSocket] Received pong:", pong);
        } catch (error) {
          console.error("[WebSocket] Error parsing pong message:", error);
        }
      });
    }

    // Set up a new heartbeat check
    this.heartbeatInterval = setInterval(() => {
      if (this.client && this.connected) {
        try {
          this.lastPingTime = Date.now();
          // Simple ping to verify connection is still alive
          this.client.publish({
            destination: WS_CONSTANTS.DESTINATIONS.PING,
            body: JSON.stringify({
              timestamp: this.lastPingTime,
              clientId: `${this.userId}-${Math.random()
                .toString(36)
                .substring(2, 10)}`,
            }),
            headers: { "content-type": "application/json" },
          });
          console.debug(
            `[WebSocket] Ping sent at ${new Date(
              this.lastPingTime
            ).toISOString()}`
          );
        } catch (error) {
          console.error("[WebSocket] Error sending ping:", error);
          // If ping fails, consider the connection failed
          this.reconnectIfNeeded();
        }
      } else {
        clearInterval(this.heartbeatInterval!);
      }
    }, WS_CONSTANTS.CONNECTION.PING_INTERVAL);
  }

  /**
   * Set up health check to detect stale connections
   */
  private setupHealthCheck(): void {
    // Clear any existing health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Set up a new health check interval
    this.healthCheckInterval = setInterval(() => {
      if (!this.connected) {
        clearInterval(this.healthCheckInterval!);
        return;
      }

      // Check if we've received any messages recently
      const now = Date.now();
      const timeSinceLastPing = now - this.lastPingTime;
      const timeSinceLastPong = now - this.lastPongTime;

      // If we haven't received any message in a while, reconnect
      if (timeSinceLastPong > 2 * WS_CONSTANTS.CONNECTION.PING_INTERVAL) {
        console.warn(
          `[WebSocket] No activity detected for ${timeSinceLastPong}ms, checking connection...`
        );

        // Test the connection
        this.testConnection()
          .then((isConnected) => {
            if (!isConnected) {
              console.error(
                "[WebSocket] Connection test failed, forcing reconnection"
              );
              this.forceReconnect();
            } else {
              console.log("[WebSocket] Connection test succeeded");
              this.lastPongTime = Date.now(); // Update last pong time
            }
          })
          .catch((error) => {
            console.error("[WebSocket] Connection test error:", error);
            this.forceReconnect();
          });
      }
    }, WS_CONSTANTS.CONNECTION.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Force reconnection even if client thinks it's connected
   */
  private forceReconnect(): void {
    console.log("[WebSocket] Forcing reconnection");

    // Clean up existing connection
    if (this.client) {
      try {
        this.client.deactivate();
      } catch (error) {
        console.error("[WebSocket] Error deactivating client:", error);
      }
    }

    this.client = null;
    this.connected = false;
    this.updateConnectionStatus(false);

    // Attempt reconnection with stored credentials
    if (this.userId && this.connectionToken) {
      this.attemptReconnection(this.connectionToken);
    }
  }

  /**
   * Check if reconnection is needed and trigger it
   */
  private reconnectIfNeeded(): void {
    if (!this.connected && this.userId && this.connectionToken) {
      this.attemptReconnection(this.connectionToken);
    }
  }

  /**
   * Handle tasks after successful connection
   */
  private onSuccessfulConnection(): void {
    if (!this.userId) return;

    // Register the user
    this.registerUser(this.userId);

    // Resubscribe to previous topics
    this.resubscribe();

    // Send any queued messages
    this.sendQueuedMessages();
  }

  /**
   * Update connection status and notify other tabs
   */
  private updateConnectionStatus(isConnected: boolean): void {
    const status = isConnected ? "true" : "false";
    sessionStorage.setItem(WS_CONSTANTS.STORAGE_KEYS.WS_CONNECTED, status);

    // Dispatch storage event to notify other tabs
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: WS_CONSTANTS.STORAGE_KEYS.WS_CONNECTED,
        newValue: status,
      })
    );
  }

  /**
   * Attempt to reconnect to the WebSocket server
   */
  private attemptReconnection(token: string): void {
    if (
      this.reconnectAttempts >= WS_CONSTANTS.CONNECTION.MAX_RECONNECT_ATTEMPTS
    ) {
      console.error("[WebSocket] Max reconnection attempts reached");

      // Still try one more time after a longer delay
      setTimeout(() => {
        console.log(
          "[WebSocket] Making one final reconnection attempt after max attempts"
        );
        this.reconnectAttempts = 0;
        if (this.userId) {
          this.connect(this.userId, token);
        }
      }, 10000); // Wait 10 seconds before the final attempt

      return;
    }

    this.reconnectAttempts++;
    const baseDelay = WS_CONSTANTS.CONNECTION.RECONNECT_DELAY;
    // Use exponential backoff with some jitter to avoid thundering herd
    const delay = Math.min(
      baseDelay *
        Math.pow(1.5, this.reconnectAttempts - 1) *
        (0.9 + Math.random() * 0.2),
      30000 // Max 30 seconds
    );

    console.log(
      `[WebSocket] Attempting to reconnect (${this.reconnectAttempts}/${
        WS_CONSTANTS.CONNECTION.MAX_RECONNECT_ATTEMPTS
      }) in ${Math.round(delay)}ms...`
    );

    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Try to reconnect after a delay
    this.reconnectTimer = setTimeout(() => {
      if (this.userId) {
        this.connect(this.userId, token).catch((err) =>
          console.error("[WebSocket] Failed to reconnect:", err)
        );
      }
    }, delay);
  }

  /**
   * Register the user with WebSocket service
   */
  private registerUser(userId: number): void {
    if (!this.client || !this.connected) return;

    const message: WebSocketMessage = {
      type: "JOIN",
      userId: userId,
      chatId: 0, // Not used for registration
      content: "User connecting",
      timestamp: new Date().toISOString(),
    };

    this.client.publish({
      destination: WS_CONSTANTS.DESTINATIONS.REGISTER,
      body: JSON.stringify(message),
    });
  }

  /**
   * Subscribe to a chat room
   * @returns The subscription ID
   */
  public subscribeToChatRoom(
    chatId: number,
    callback: MessageCallback
  ): string {
    if (!this.userId) {
      console.error("[WebSocket] User ID not set");
      return "";
    }

    const subscriptionKey = `${WS_CONSTANTS.SUBSCRIPTION_PREFIXES.CHAT}${chatId}`;

    // Return existing subscription if present
    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!.id;
    }

    // Store callback for later if not connected
    if (!this.client || !this.connected) {
      console.warn(
        "[WebSocket] Not connected. Will subscribe when connection is established."
      );
      this.subscriptions.set(subscriptionKey, {
        id: subscriptionKey,
        callback,
      });
      return subscriptionKey;
    }

    // Subscribe to user-specific destination
    const userDestination = `/user/${this.userId}/queue/chat.${chatId}`;
    console.log(`[WebSocket] Subscribing to: ${userDestination}`);

    const userSubscription = this.client.subscribe(
      userDestination,
      this.createMessageHandler(callback, chatId, "user-specific")
    );

    // Also subscribe to broadcast topic as fallback
    const broadcastDestination = `/topic/user.${this.userId}.chat.${chatId}`;
    console.log(
      `[WebSocket] Subscribing to broadcast: ${broadcastDestination}`
    );

    this.client.subscribe(
      broadcastDestination,
      this.createMessageHandler(callback, chatId, "broadcast")
    );

    // Store the subscription
    this.subscriptions.set(subscriptionKey, {
      id: userSubscription.id,
      callback,
    });

    // Notify the server about subscription
    this.sendSubscribeMessage(chatId);

    return userSubscription.id;
  }

  /**
   * Create a message handler function for subscriptions
   */
  private createMessageHandler(
    callback: MessageCallback,
    chatId: number,
    channel: string
  ): (message: IMessage) => void {
    return (message: IMessage) => {
      try {
        console.log(
          `[WebSocket] Received message on ${channel} channel for chat ${chatId}`
        );

        // Update lastPongTime to indicate the connection is still alive
        this.lastPongTime = Date.now();

        const receivedMessage: WebSocketMessage = JSON.parse(message.body);
        callback(receivedMessage);
      } catch (error) {
        console.error("[WebSocket] Error parsing message:", error);
      }
    };
  }

  /**
   * Subscribe to multiple chat rooms at once
   */
  public subscribeToMultipleChats(
    chatIds: number[],
    callback: MessageCallback
  ): void {
    if (!this.client || !this.connected || !this.userId) {
      console.warn(
        "[WebSocket] Not connected. Cannot subscribe to multiple chats."
      );
      return;
    }

    // Subscribe to each chat individually
    chatIds.forEach((chatId) => {
      this.subscribeToChatRoom(chatId, callback);
    });

    // Send a batch subscription message to the server
    this.client.publish({
      destination: WS_CONSTANTS.DESTINATIONS.CHATS_SUBSCRIBE,
      body: JSON.stringify(chatIds),
    });
  }

  /**
   * Unsubscribe from a chat room
   */
  public unsubscribeFromChatRoom(chatId: number): void {
    // Unsubscribe from main chat messages
    const chatSubscriptionKey = `${WS_CONSTANTS.SUBSCRIPTION_PREFIXES.CHAT}${chatId}`;
    if (this.subscriptions.has(chatSubscriptionKey)) {
      if (this.client && this.connected) {
        const { id } = this.subscriptions.get(chatSubscriptionKey)!;
        this.client.unsubscribe(id);
      }
      this.subscriptions.delete(chatSubscriptionKey);
    }

    // Unsubscribe from typing indicators
    const typingSubscriptionKey = `${WS_CONSTANTS.SUBSCRIPTION_PREFIXES.TYPING}${chatId}`;
    if (this.subscriptions.has(typingSubscriptionKey)) {
      if (this.client && this.connected) {
        const { id } = this.subscriptions.get(typingSubscriptionKey)!;
        this.client.unsubscribe(id);
      }
      this.subscriptions.delete(typingSubscriptionKey);
    }
  }

  /**
   * Subscribe to read receipts
   */
  public subscribeToReadReceipts(
    userId: number,
    callback: MessageCallback
  ): string {
    return this.simpleSubscribe(
      `/user/${userId}/queue/read-receipts`,
      `${WS_CONSTANTS.SUBSCRIPTION_PREFIXES.READ_RECEIPTS}${userId}`,
      callback,
      "read receipt"
    );
  }

  /**
   * Subscribe to chat updates
   */
  public subscribeToChatUpdates(
    userId: number,
    callback: MessageCallback
  ): string {
    const subscriptionKey = `${WS_CONSTANTS.SUBSCRIPTION_PREFIXES.CHAT_UPDATES}${userId}`;

    if (!this.client || !this.connected) {
      console.warn(
        "[WebSocket] Not connected. Will subscribe when connection is established."
      );
      this.subscriptions.set(subscriptionKey, {
        id: subscriptionKey,
        callback,
      });
      return subscriptionKey;
    }

    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!.id;
    }

    // Subscribe to user-specific destination
    const userDestination = `/user/${userId}/queue/chat-updates`;
    console.log(`[WebSocket] Subscribing to chat updates: ${userDestination}`);

    const userSubscription = this.client.subscribe(
      userDestination,
      (message: IMessage) => {
        try {
          console.log("[WebSocket] Received chat update notification");
          // Update lastPongTime to indicate the connection is still alive
          this.lastPongTime = Date.now();

          const receivedMessage: WebSocketMessage = JSON.parse(message.body);
          callback(receivedMessage);
        } catch (error) {
          console.error(
            "[WebSocket] Error parsing chat update message:",
            error
          );
        }
      }
    );

    // Also subscribe to broadcast topic as fallback
    const broadcastDestination = `/topic/user.${userId}.chat-updates`;
    this.client.subscribe(broadcastDestination, (message: IMessage) => {
      try {
        // Update lastPongTime to indicate the connection is still alive
        this.lastPongTime = Date.now();

        const receivedMessage: WebSocketMessage = JSON.parse(message.body);
        callback(receivedMessage);
      } catch (error) {
        console.error(
          "[WebSocket] Error parsing chat update broadcast:",
          error
        );
      }
    });

    this.subscriptions.set(subscriptionKey, {
      id: userSubscription.id,
      callback,
    });

    return userSubscription.id;
  }

  /**
   * Subscribe to admin status changes
   */
  public subscribeToAdminStatusChanges(
    userId: number,
    callback: MessageCallback
  ): string {
    return this.chatUpdateSubscribe(
      userId,
      `${WS_CONSTANTS.SUBSCRIPTION_PREFIXES.ADMIN_CHANGES}${userId}`,
      callback,
      "ADMIN_CHANGED",
      "admin status change"
    );
  }

  /**
   * Subscribe to user removal notifications
   */
  public subscribeToUserRemovals(
    userId: number,
    callback: MessageCallback
  ): string {
    return this.chatUpdateSubscribe(
      userId,
      `${WS_CONSTANTS.SUBSCRIPTION_PREFIXES.USER_REMOVALS}${userId}`,
      callback,
      "MEMBER_REMOVED",
      "user removal"
    );
  }

  /**
   * Subscribe to member add notifications
   */
  public subscribeToMemberAdditions(
    userId: number,
    callback: MessageCallback
  ): string {
    return this.chatUpdateSubscribe(
      userId,
      `${WS_CONSTANTS.SUBSCRIPTION_PREFIXES.MEMBER_ADDITIONS}${userId}`,
      callback,
      "MEMBER_ADDED",
      "member addition"
    );
  }

  /**
   * Generic function for subscribing to chat updates
   */
  private chatUpdateSubscribe(
    userId: number,
    subscriptionKey: string,
    callback: MessageCallback,
    updateType: string,
    logPrefix: string
  ): string {
    if (!this.client || !this.connected) {
      console.warn(
        `[WebSocket] Not connected. Will subscribe to ${logPrefix} when connection is established.`
      );
      this.subscriptions.set(subscriptionKey, {
        id: subscriptionKey,
        callback,
      });
      return subscriptionKey;
    }

    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!.id;
    }

    // Subscribe to user-specific destination
    const userDestination = `/user/${userId}/queue/chat-updates`;
    console.log(`[WebSocket] Subscribing to ${logPrefix}: ${userDestination}`);

    const userSubscription = this.client.subscribe(
      userDestination,
      (message: IMessage) => {
        try {
          // Update lastPongTime to indicate the connection is still alive
          this.lastPongTime = Date.now();

          const receivedMessage: WebSocketMessage = JSON.parse(message.body);

          if (
            (receivedMessage.type === "CHAT_UPDATE" &&
              receivedMessage.updateType === updateType) ||
            this.isRelevantSystemMessage(receivedMessage, updateType)
          ) {
            console.log(
              `[WebSocket] Processing ${logPrefix} notification:`,
              receivedMessage
            );
            callback(receivedMessage);
          }
        } catch (error) {
          console.error(
            `[WebSocket] Error parsing ${logPrefix} message:`,
            error
          );
        }
      }
    );

    // Also subscribe to broadcast topic as fallback
    const broadcastDestination = `/topic/user.${userId}.chat-updates`;
    this.client.subscribe(broadcastDestination, (message: IMessage) => {
      try {
        // Update lastPongTime to indicate the connection is still alive
        this.lastPongTime = Date.now();

        const receivedMessage: WebSocketMessage = JSON.parse(message.body);

        if (
          (receivedMessage.type === "CHAT_UPDATE" &&
            receivedMessage.updateType === updateType) ||
          this.isRelevantSystemMessage(receivedMessage, updateType)
        ) {
          console.log(
            `[WebSocket] Processing ${logPrefix} from broadcast:`,
            receivedMessage
          );
          callback(receivedMessage);
        }
      } catch (error) {
        console.error(
          `[WebSocket] Error parsing ${logPrefix} broadcast:`,
          error
        );
      }
    });

    this.subscriptions.set(subscriptionKey, {
      id: userSubscription.id,
      callback,
    });

    return userSubscription.id;
  }

  /**
   * Check if a system message is relevant to a certain update type
   */
  private isRelevantSystemMessage(
    message: WebSocketMessage,
    updateType: string
  ): boolean {
    if (message.type !== "CHAT" || !message.isSystem || !message.content) {
      return false;
    }

    switch (updateType) {
      case "MEMBER_REMOVED":
        return (
          message.content.includes("removed") &&
          message.content.includes("from the group")
        );
      case "MEMBER_ADDED":
        return (
          message.content.includes("added") &&
          message.content.includes("to the group")
        );
      case "ADMIN_CHANGED":
        return (
          (message.content.includes("made") &&
            message.content.includes("an admin")) ||
          message.content.includes("removed admin rights from")
        );
      default:
        return false;
    }
  }

  /**
   * Generic simple subscription function
   */
  private simpleSubscribe(
    destination: string,
    subscriptionKey: string,
    callback: MessageCallback,
    logPrefix: string
  ): string {
    if (!this.client || !this.connected) {
      console.warn(
        `[WebSocket] Not connected. Will subscribe to ${logPrefix} when connection is established.`
      );
      this.subscriptions.set(subscriptionKey, {
        id: subscriptionKey,
        callback,
      });
      return subscriptionKey;
    }

    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!.id;
    }

    console.log(`[WebSocket] Subscribing to ${logPrefix}: ${destination}`);

    const subscription = this.client.subscribe(
      destination,
      (message: IMessage) => {
        try {
          // Update lastPongTime to indicate the connection is still alive
          this.lastPongTime = Date.now();

          const receivedMessage: WebSocketMessage = JSON.parse(message.body);
          callback(receivedMessage);
        } catch (error) {
          console.error(
            `[WebSocket] Error parsing ${logPrefix} message:`,
            error
          );
        }
      }
    );

    this.subscriptions.set(subscriptionKey, {
      id: subscription.id,
      callback,
    });

    return subscription.id;
  }

  /**
   * Subscribe to typing indicators for a chat
   */
  public subscribeToTypingIndicators(
    chatId: number,
    callback: MessageCallback
  ): string {
    const destination = `/topic/chat.${chatId}/typing`;
    const subscriptionKey = `${WS_CONSTANTS.SUBSCRIPTION_PREFIXES.TYPING}${chatId}`;

    return this.simpleSubscribe(
      destination,
      subscriptionKey,
      callback,
      "typing indicator"
    );
  }

  /**
   * Send a subscription message to the server
   */
  private sendSubscribeMessage(chatId: number): void {
    if (!this.client || !this.connected || !this.userId) return;

    const message: WebSocketMessage = {
      type: "SUBSCRIBE",
      userId: this.userId,
      chatId: chatId,
      content: "User subscribing to chat",
      timestamp: new Date().toISOString(),
    };

    this.client.publish({
      destination: WS_CONSTANTS.DESTINATIONS.CHAT_SUBSCRIBE,
      body: JSON.stringify(message),
    });
  }

  /**
   * Send a chat message
   */
  public sendChatMessage = async (
    userId: number,
    chatId: number,
    message: string,
    replyTo?: number,
    isForwarded: boolean = false
  ): Promise<boolean> => {
    if (!this.client || !this.connected) {
      console.error("WebSocket not connected. Cannot send message");
      return false;
    }

    try {
      console.log(
        `Sending${isForwarded ? " forwarded" : ""} message via WebSocket`
      );

      // Use different endpoints for regular and forwarded messages
      const endpoint = isForwarded
        ? WS_CONSTANTS.DESTINATIONS.CHAT_FORWARD
        : WS_CONSTANTS.DESTINATIONS.CHAT_SEND;

      this.client.publish({
        destination: endpoint,
        body: JSON.stringify({
          type: "CHAT",
          chatId: chatId,
          userId: userId,
          content: message,
          timestamp: new Date(),
          replyTo: replyTo,
          isForwarded: isForwarded,
        }),
      });
      return true;
    } catch (error) {
      console.error("Error sending message via WebSocket:", error);
      return false;
    }
  };

  /**
   * Send a message with a reply
   */
  public sendReplyMessage(
    chatId: number,
    content: string,
    replyToId: number,
    isForwarded: boolean = false
  ): void {
    if (!this.userId) {
      console.error("[WebSocket] User ID not set");
      return;
    }

    const message: WebSocketMessage = {
      type: "CHAT",
      userId: this.userId,
      chatId: chatId,
      content: content,
      timestamp: new Date().toISOString(),
      replyTo: replyToId,
      isForwarded: isForwarded,
    };

    const destination = isForwarded
      ? WS_CONSTANTS.DESTINATIONS.CHAT_FORWARD
      : WS_CONSTANTS.DESTINATIONS.CHAT_SEND;

    this.sendOrQueueMessage(message, destination);
  }

  /**
   * Helper to send or queue a message
   */
  private sendOrQueueMessage(
    message: WebSocketMessage,
    destination: string
  ): void {
    // Handle forwarded messages appropriately
    if (
      message.isForwarded &&
      destination === WS_CONSTANTS.DESTINATIONS.CHAT_SEND
    ) {
      console.log("[WebSocket] Forwarding message, changing endpoint");
      destination = WS_CONSTANTS.DESTINATIONS.CHAT_FORWARD;
    }

    if (!this.client || !this.connected) {
      // Queue the message for sending when connected
      this.messageQueue.push({ ...message, __destination: destination as any });
      console.warn("[WebSocket] Not connected. Message queued.");
      return;
    }

    this.client.publish({
      destination: destination,
      body: JSON.stringify(message),
    });
  }

  /**
   * Send any queued messages
   */
  private sendQueuedMessages(): void {
    if (!this.client || !this.connected) return;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        const destination =
          (message as any).__destination || WS_CONSTANTS.DESTINATIONS.CHAT_SEND;
        delete (message as any).__destination;

        this.client.publish({
          destination: destination,
          body: JSON.stringify(message),
        });
      }
    }
  }

  /**
   * Mark a message as read
   */
  public markMessageAsRead(messageId: number): void {
    if (!this.client || !this.connected || !this.userId) return;

    const message: WebSocketMessage = {
      type: "CHAT",
      userId: this.userId,
      chatId: 0, // Not used for this message type
      content: "Mark as read",
      timestamp: new Date().toISOString(),
      messageId: messageId,
    };

    this.client.publish({
      destination: WS_CONSTANTS.DESTINATIONS.CHAT_READ,
      body: JSON.stringify(message),
    });
  }
  /**
   * Send admin status change notification
   */
  public sendAdminStatusChange(
    chatId: number,
    targetUserId: number,
    targetUsername: string,
    isPromotion: boolean
  ): void {
    if (!this.client || !this.connected || !this.userId) {
      console.warn(
        "[WebSocket] Not connected. Cannot send admin status change."
      );
      return;
    }

    const actorUsername =
      sessionStorage.getItem(WS_CONSTANTS.STORAGE_KEYS.USERNAME) || "User";

    // Generate structured system message
    const systemMsgData = isPromotion
      ? generateMakeAdminSystemMessage(actorUsername, targetUsername)
      : generateRemoveAdminSystemMessage(actorUsername, targetUsername);

    const message: WebSocketMessage = {
      type: "CHAT_UPDATE",
      userId: this.userId,
      username: actorUsername,
      chatId: chatId,
      content: systemMsgData.content || "",
      timestamp: new Date().toISOString(),
      updateType: "ADMIN_CHANGED",
      targetUserId: targetUserId,
      targetUsername: targetUsername,
      isPromotion: isPromotion,
      system_message_type: systemMsgData.system_message_type,
      system_message_params: systemMsgData.system_message_params,
    };

    this.client.publish({
      destination: WS_CONSTANTS.DESTINATIONS.ADMIN_CHANGE,
      body: JSON.stringify(message),
    });

    console.log("[WebSocket] Sent admin status change request:", message);
  }
  /**
   * Send member removed notification
   */
  public sendMemberRemoved(
    chatId: number,
    targetUserId: number,
    targetUsername: string
  ): void {
    if (!this.client || !this.connected || !this.userId) {
      console.warn(
        "[WebSocket] Not connected. Cannot send member removed notification."
      );
      return;
    }

    const actorUsername =
      sessionStorage.getItem(WS_CONSTANTS.STORAGE_KEYS.USERNAME) || "User";

    // Generate structured system message
    const systemMsgData = generateRemoveUserSystemMessage(
      actorUsername,
      targetUsername
    );

    const message: WebSocketMessage = {
      type: "CHAT_UPDATE",
      userId: this.userId,
      username: actorUsername,
      chatId: chatId,
      content: systemMsgData.content || "",
      timestamp: new Date().toISOString(),
      updateType: "MEMBER_REMOVED",
      targetUserId: targetUserId,
      targetUsername: targetUsername,
      system_message_type: systemMsgData.system_message_type,
      system_message_params: systemMsgData.system_message_params,
    };

    this.client.publish({
      destination: WS_CONSTANTS.DESTINATIONS.MEMBER_REMOVED,
      body: JSON.stringify(message),
    });

    console.log("[WebSocket] Sent member removal request:", message);
  }
  /**
   * Send member added notification
   */
  public sendMemberAdded(
    chatId: number,
    targetUserId: number,
    targetUsername: string
  ): void {
    if (!this.client || !this.connected || !this.userId) {
      console.warn(
        "[WebSocket] Not connected. Cannot send member added notification."
      );
      return;
    }

    const actorUsername =
      sessionStorage.getItem(WS_CONSTANTS.STORAGE_KEYS.USERNAME) || "User";

    // Generate structured system message
    const systemMsgData = generateAddUserSystemMessage(
      actorUsername,
      targetUsername
    );

    const message: WebSocketMessage = {
      type: "CHAT_UPDATE",
      userId: this.userId,
      username: actorUsername,
      chatId: chatId,
      content: systemMsgData.content || "",
      timestamp: new Date().toISOString(),
      updateType: "MEMBER_ADDED",
      targetUserId: targetUserId,
      targetUsername: targetUsername,
      system_message_type: systemMsgData.system_message_type,
      system_message_params: systemMsgData.system_message_params,
    };

    this.client.publish({
      destination: WS_CONSTANTS.DESTINATIONS.MEMBER_ADDED,
      body: JSON.stringify(message),
    });

    console.log("[WebSocket] Sent member added notification:", message);
  }

  /**
   * Send chat settings change notification
   */
  public sendChatSettingsChanged(
    chatId: number,
    chatName: string,
    description: string,
    updateMessage: string
  ): void {
    if (!this.client || !this.connected || !this.userId) {
      console.warn(
        "[WebSocket] Not connected. Cannot send settings change notification."
      );
      return;
    }

    // Get the current username to use as the actor
    const actorUsername =
      localStorage.getItem(WS_CONSTANTS.STORAGE_KEYS.USERNAME) || "System";

    // Generate a structured system message for settings update
    const systemMsgData = generateUpdateSettingsSystemMessage(actorUsername);

    const message: WebSocketMessage = {
      type: "CHAT_UPDATE",
      userId: this.userId,
      chatId: chatId,
      content: systemMsgData.content || description,
      updateMessage: updateMessage,
      timestamp: new Date().toISOString(),
      updateType: "SETTINGS_CHANGED",
      chatName: chatName,
      // Add structured system message data
      system_message_type: systemMsgData.system_message_type,
      system_message_params: systemMsgData.system_message_params,
      isSystem: true, // Mark as system message
    };

    this.client.publish({
      destination: WS_CONSTANTS.DESTINATIONS.SETTINGS_CHANGED,
      body: JSON.stringify(message),
    });

    console.log("[WebSocket] Sent chat settings change notification:", message);
  }

  /**
   * Send a typing indicator notification
   */
  public sendTypingIndicator(chatId: number): void {
    if (!this.client || !this.connected || !this.userId) return;

    const message: WebSocketMessage = {
      type: "TYPING",
      userId: this.userId,
      chatId: chatId,
      content: "",
      timestamp: new Date().toISOString(),
    };

    this.client.publish({
      destination: WS_CONSTANTS.DESTINATIONS.CHAT_TYPING,
      body: JSON.stringify(message),
      headers: { "content-type": "application/json;minimal=true" },
    });
  }

  /**
   * Edit a message
   */
  public editMessage(messageId: number, chatId: number, content: string): void {
    if (!this.client || !this.connected || !this.userId) return;

    const message: WebSocketMessage = {
      type: "CHAT",
      userId: this.userId,
      chatId: chatId,
      messageId: messageId,
      content: content,
      timestamp: new Date().toISOString(),
    };

    this.client.publish({
      destination: WS_CONSTANTS.DESTINATIONS.CHAT_EDIT,
      body: JSON.stringify(message),
    });
  }

  /**
   * Delete a message
   */
  public deleteMessage(messageId: number, chatId: number): void {
    if (!this.client || !this.connected || !this.userId) return;

    const message: WebSocketMessage = {
      type: "CHAT",
      userId: this.userId,
      chatId: chatId,
      messageId: messageId,
      content: "",
      timestamp: new Date().toISOString(),
    };

    this.client.publish({
      destination: WS_CONSTANTS.DESTINATIONS.CHAT_DELETE,
      body: JSON.stringify(message),
    });
  }

  /**
   * Resubscribe to all previously subscribed topics
   */
  private resubscribe(): void {
    if (!this.client || !this.connected || !this.userId) return;

    this.subscriptions.forEach((subscription, key) => {
      const { callback } = subscription;

      // Extract subscription type and ID
      const [prefix, ...rest] = key.split("_");
      const id = rest.join("_");

      switch (prefix) {
        case WS_CONSTANTS.SUBSCRIPTION_PREFIXES.CHAT.slice(0, -1):
          this.resubscribeToChatRoom(key, parseInt(id, 10), callback);
          break;
        case WS_CONSTANTS.SUBSCRIPTION_PREFIXES.READ_RECEIPTS.slice(0, -1):
          this.resubscribeToReadReceipts(parseInt(id, 10), callback);
          break;
        case WS_CONSTANTS.SUBSCRIPTION_PREFIXES.TYPING.slice(0, -1):
          this.resubscribeToTypingIndicators(parseInt(id, 10), callback);
          break;
        case WS_CONSTANTS.SUBSCRIPTION_PREFIXES.CHAT_UPDATES.slice(0, -1):
        case WS_CONSTANTS.SUBSCRIPTION_PREFIXES.ADMIN_CHANGES.slice(0, -1):
        case WS_CONSTANTS.SUBSCRIPTION_PREFIXES.USER_REMOVALS.slice(0, -1):
        case WS_CONSTANTS.SUBSCRIPTION_PREFIXES.MEMBER_ADDITIONS.slice(0, -1):
          this.resubscribeToChatUpdates(parseInt(id, 10), key, callback);
          break;
      }
    });
  }

  /**
   * Resubscribe to a chat room
   */
  private resubscribeToChatRoom(
    key: string,
    chatId: number,
    callback: MessageCallback
  ): void {
    if (!this.client || !this.connected || !this.userId || isNaN(chatId))
      return;

    console.log(`[WebSocket] Resubscribing to chat ${chatId}`);

    // Subscribe to user-specific destination
    const userDestination = `/user/${this.userId}/queue/chat.${chatId}`;
    console.log(
      `[WebSocket] Resubscribing to user-specific destination: ${userDestination}`
    );

    const userSubscription = this.client.subscribe(
      userDestination,
      this.createMessageHandler(callback, chatId, "user-specific")
    );

    // Also subscribe to broadcast topic as fallback
    const broadcastDestination = `/topic/user.${this.userId}.chat.${chatId}`;
    console.log(
      `[WebSocket] Resubscribing to broadcast destination: ${broadcastDestination}`
    );

    this.client.subscribe(
      broadcastDestination,
      this.createMessageHandler(callback, chatId, "broadcast")
    );

    // Update subscription ID
    this.subscriptions.set(key, { id: userSubscription.id, callback });

    // Send subscription message to server
    this.sendSubscribeMessage(chatId);
  }

  /**
   * Resubscribe to read receipts
   */
  private resubscribeToReadReceipts(
    userId: number,
    callback: MessageCallback
  ): void {
    if (!this.client || !this.connected || isNaN(userId)) return;

    const key = `${WS_CONSTANTS.SUBSCRIPTION_PREFIXES.READ_RECEIPTS}${userId}`;
    const destination = `/user/${userId}/queue/read-receipts`;

    const newSubscription = this.client.subscribe(
      destination,
      (message: IMessage) => {
        try {
          const receivedMessage: WebSocketMessage = JSON.parse(message.body);
          callback(receivedMessage);
        } catch (error) {
          console.error(
            "[WebSocket] Error parsing read receipt message:",
            error
          );
        }
      }
    );

    // Update subscription ID
    this.subscriptions.set(key, { id: newSubscription.id, callback });
  }

  /**
   * Resubscribe to typing indicators
   */
  private resubscribeToTypingIndicators(
    chatId: number,
    callback: MessageCallback
  ): void {
    if (!this.client || !this.connected || isNaN(chatId)) return;

    const key = `${WS_CONSTANTS.SUBSCRIPTION_PREFIXES.TYPING}${chatId}`;
    const destination = `/topic/chat.${chatId}/typing`;

    const newSubscription = this.client.subscribe(
      destination,
      (message: IMessage) => {
        try {
          const receivedMessage: WebSocketMessage = JSON.parse(message.body);
          callback(receivedMessage);
        } catch (error) {
          console.error("[WebSocket] Error parsing typing indicator:", error);
        }
      }
    );

    // Update subscription ID
    this.subscriptions.set(key, { id: newSubscription.id, callback });
  }

  /**
   * Resubscribe to chat updates
   */ private resubscribeToChatUpdates(
    userId: number,
    key: string,
    callback: MessageCallback
  ): void {
    if (!this.client || !this.connected || isNaN(userId)) return;

    console.log(`[WebSocket] Resubscribing to chat updates for user ${userId}`);

    // All these notifications use the same endpoint
    const destination = `/user/${userId}/queue/chat-updates`;
    const broadcastDestination = `/topic/user.${userId}.chat-updates`;

    const newSubscription = this.client.subscribe(
      destination,
      (message: IMessage) => {
        try {
          const receivedMessage: WebSocketMessage = JSON.parse(message.body);
          callback(receivedMessage);
        } catch (error) {
          console.error("[WebSocket] Error parsing chat update:", error);
        }
      }
    );

    // Also subscribe to broadcast
    this.client.subscribe(broadcastDestination, (message: IMessage) => {
      try {
        const receivedMessage: WebSocketMessage = JSON.parse(message.body);
        callback(receivedMessage);
      } catch (error) {
        console.error(
          "[WebSocket] Error parsing chat update broadcast:",
          error
        );
      }
    });

    // Update subscription ID
    this.subscriptions.set(key, { id: newSubscription.id, callback });
  }

  /**
   * Get current connection status and user ID
   */
  public getConnectionStatus(): { connected: boolean; userId: number | null } {
    return { connected: this.connected, userId: this.userId };
  }

  /**
   * Test WebSocket connectivity with a simple message
   * This can be used to diagnose connection issues
   */
  public testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.client || !this.connected) {
        console.error("[WebSocket] Cannot test: not connected");
        resolve(false);
        return;
      }

      try {
        const subscription = this.client.subscribe("/topic/test", (message) => {
          console.log("[WebSocket] Test response received:", message.body);
          subscription.unsubscribe();
          resolve(true);
        });

        console.log("[WebSocket] Sending test message");
        this.client.publish({
          destination: "/app/test",
          body: "Test message from client at " + new Date().toISOString(),
        });

        // Set a timeout in case we don't get a response
        setTimeout(() => {
          console.error("[WebSocket] Test timed out");
          subscription.unsubscribe();
          resolve(false);
        }, 5000);
      } catch (error) {
        console.error("[WebSocket] Test error:", error);
        resolve(false);
      }
    });
  }

  /**
   * Send a message to a specific WebSocket destination
   * @param message The message to send
   * @param destination Optional custom destination, defaults to '/app/chat.send'
   * @returns Promise<boolean> indicating if the message was sent
   */
  public async sendMessage(
    message: WebSocketMessage,
    destination: string = "/app/chat.send"
  ): Promise<boolean> {
    try {
      if (!this.connected) {
        console.error("[WebSocket] Cannot send message - not connected");
        return false;
      }

      if (!this.client) {
        console.error(
          "[WebSocket] Cannot send message - client not initialized"
        );
        return false;
      }

      // Send the message to the specified destination
      this.client.publish({
        destination,
        body: JSON.stringify(message),
      });

      return true;
    } catch (error) {
      console.error("[WebSocket] Error sending message:", error);
      return false;
    }
  }

  /**
   * Get available chats for the current user
   * @returns Promise<Array<{id: number, name: string}>> List of available chats
   */
  public async getAvailableChats(): Promise<
    Array<{ id: number; name: string }>
  > {
    try {
      // First try to get chats from local storage
      const storedChats = localStorage.getItem("recentChats");
      if (storedChats) {
        return JSON.parse(storedChats);
      }

      // If no stored chats, return a default chat
      // In a real implementation, this would make an API call
      return [{ id: 1, name: "General" }];
    } catch (error) {
      console.error("[WebSocket] Error getting available chats:", error);
      return [{ id: 1, name: "General" }]; // Default fallback
    }
  }

  /**
   * Send a game message
   * @param userId The user ID sending the message
   * @param gameId The game ID
   * @param content The message content (should be JSON stringified game data)
   * @param gameType The type of game (e.g., "tictactoe")
   * @param action The game action (e.g., "create", "join", "move")
   * @returns Promise<boolean> success indicator
   */
  public async sendGameMessage(
    userId: number,
    gameId: string,
    content: string,
    gameType: string = "tictactoe",
    action: string = "message"
  ): Promise<boolean> {
    try {
      if (!this.connected) {
        console.error("[WebSocket] Cannot send game message: not connected");
        return false;
      }

      const message: WebSocketMessage = {
        type: "GAME_MESSAGE",
        userId: userId,
        chatId: 0, // Use 0 as a special value for game messages
        content: content,
        timestamp: new Date().toISOString(),
        gameType: gameType,
        gameId: gameId,
        action: action,
      };

      // Send to the appropriate game destination
      let destination = `/app/game.${action.toLowerCase()}`;

      // Queue the message so it can be retried if needed
      this.sendOrQueueMessage(message, destination);

      return true;
    } catch (error) {
      console.error("[WebSocket] Error sending game message:", error);
      return false;
    }
  }

  /**
   * Subscribe to game events
   * @param gameId The game ID to subscribe to
   * @param callback The callback to invoke when a game event is received
   * @returns The subscription ID
   */
  public subscribeToGameEvents(
    gameId: string,
    callback: MessageCallback
  ): string {
    const subscriptionKey = `game_${gameId}`;

    // Check if we're already subscribed
    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`[WebSocket] Already subscribed to game ${gameId}`);
      return this.subscriptions.get(subscriptionKey)!.id;
    }

    try {
      // Subscribe to the game-specific topic
      const destination = `/topic/game.${gameId}`;

      const subscription = this.client?.subscribe(
        destination,
        (message) => {
          try {
            const body = JSON.parse(message.body);
            callback(body);
          } catch (e) {
            console.error("[WebSocket] Error parsing game event:", e);
          }
        },
        { id: subscriptionKey }
      );

      if (subscription) {
        this.subscriptions.set(subscriptionKey, {
          id: subscription.id,
          callback,
        });

        console.log(`[WebSocket] Subscribed to game ${gameId}`);
        return subscription.id;
      } else {
        console.error(`[WebSocket] Failed to subscribe to game ${gameId}`);
        return "";
      }
    } catch (error) {
      console.error("[WebSocket] Error subscribing to game events:", error);
      return "";
    }
  }

  /**
   * Unsubscribe from game events
   * @param gameId The game ID to unsubscribe from
   */
  public unsubscribeFromGameEvents(gameId: string): void {
    const subscriptionKey = `game_${gameId}`;

    try {
      if (this.subscriptions.has(subscriptionKey)) {
        const subscription = this.subscriptions.get(subscriptionKey)!;
        this.client?.unsubscribe(subscription.id);
        this.subscriptions.delete(subscriptionKey);
        console.log(`[WebSocket] Unsubscribed from game ${gameId}`);
      }
    } catch (error) {
      console.error("[WebSocket] Error unsubscribing from game events:", error);
    }
  }

  /**
   * Ensure we have a connection, attempting to connect if needed
   */
  public async ensureConnected(
    userId?: number,
    token?: string
  ): Promise<boolean> {
    // Already connected with correct userId
    if (
      this.connected &&
      this.userId &&
      (userId === undefined || this.userId === userId)
    ) {
      console.log("[WebSocket] Already connected with correct user ID");
      return true;
    }

    // If userId and token are provided, try to connect
    if (userId !== undefined && token) {
      try {
        return await this.connect(userId, token);
      } catch (error) {
        console.error("[WebSocket] Connection error:", error);
        return false;
      }
    }

    // Try to recover userId from session storage if it wasn't provided
    if (!this.userId && userId === undefined) {
      const userJson = sessionStorage.getItem(WS_CONSTANTS.STORAGE_KEYS.USER);
      if (userJson) {
        try {
          const user = JSON.parse(userJson);
          if (user && user.id && user.token) {
            return await this.connect(user.id, user.token);
          }
        } catch (e) {
          console.error(
            "[WebSocket] Failed to parse user from session storage:",
            e
          );
        }
      }
    }

    console.error("[WebSocket] Not connected and no credentials available");
    return false;
  }

  /**
   * Test connection to help diagnose Cloud Run issues
   */
  public async testCloudRunConnection(): Promise<boolean> {
    try {
      // First, try a simple HTTP fetch to the debug endpoint
      const wsUrl = this.WS_URL.replace("http://", "https://");
      const debugUrl = `${wsUrl.split("/ws")[0]}/websocket-debug/health`;

      console.log(`[WebSocket] Testing HTTP connection to ${debugUrl}`);

      const response = await fetch(debugUrl);
      const data = await response.json();

      console.log(`[WebSocket] HTTP test result: ${response.status}`, data);

      if (!response.ok) {
        return false;
      }

      // Now test the WebSocket connection itself
      return this.testConnection();
    } catch (error) {
      console.error("[WebSocket] Cloud Run connection test failed:", error);
      return false;
    }
  }
}

// Create a singleton instance
const websocketService = new WebSocketService();
export default websocketService;
