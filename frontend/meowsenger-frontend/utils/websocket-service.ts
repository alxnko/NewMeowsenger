import { Client, IFrame, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { generateMakeAdminSystemMessage, generateRemoveAdminSystemMessage, generateUpdateSettingsSystemMessage, generateAddUserSystemMessage, generateRemoveUserSystemMessage } from "./system-message-utils";

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
    | "USER_REMOVED"; // New type for user removal notifications
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
    MAX_RECONNECT_ATTEMPTS: 5,
    RECONNECT_DELAY: 5000,
    CONNECTION_TIMEOUT: 10000,
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

  // Base WebSocket URL
  private readonly WS_URL =
    process.env.NEXT_PUBLIC_WS_URL || "http://localhost:8081/ws";

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
      console.log("[WebSocket] Attempting to connect...");

      // Store username for messages
      this.setupUsername();

      // Create STOMP client
      this.setupClient(token);

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        console.error("[WebSocket] Connection timed out");
        this.cleanup();
        resolve(false);
      }, WS_CONSTANTS.CONNECTION.CONNECTION_TIMEOUT);

      // Configure client event handlers
      this.setupClientHandlers(resolve, token);

      // Activate the client
      try {
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
  private setupClient(token: string): void {
    this.client = new Client({
      webSocketFactory: () => new SockJS(this.WS_URL),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: (msg) => {
        if (process.env.NODE_ENV !== "production") {
          console.log("[STOMP]", msg);
          this.parseMessageForDebugging(msg);
        }
      },
      reconnectDelay: WS_CONSTANTS.CONNECTION.RECONNECT_DELAY,
      heartbeatIncoming: 30000,
      heartbeatOutgoing: 30000,
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
      console.log("[WebSocket] Using username from session:", username);
    } else if (typeof window !== "undefined") {
      const user = JSON.parse(
        sessionStorage.getItem(WS_CONSTANTS.STORAGE_KEYS.USER) || "{}"
      );
      if (user && user.username) {
        sessionStorage.setItem(
          WS_CONSTANTS.STORAGE_KEYS.USERNAME,
          user.username
        );
        console.log("[WebSocket] Stored username in session:", user.username);
      }
    }
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

      // Update connection status
      this.updateConnectionStatus(true);

      // Register user and handle subscriptions
      this.onSuccessfulConnection();

      // Setup heartbeat for connection monitoring
      this.setupHeartbeat();

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

    this.client.onWebSocketClose = () => {
      console.log("[WebSocket] Connection closed");
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

    // Set up a new heartbeat check
    this.heartbeatInterval = setInterval(() => {
      if (this.client && this.connected) {
        // Simple ping to verify connection is still alive
        this.client.publish({
          destination: "/app/ping",
          body: "{}",
          headers: { "content-type": "application/json" },
        });
      } else {
        clearInterval(this.heartbeatInterval!);
      }
    }, 45000); // 45 seconds
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
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `[WebSocket] Attempting to reconnect (${this.reconnectAttempts}/${WS_CONSTANTS.CONNECTION.MAX_RECONNECT_ATTEMPTS})...`
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
    }, WS_CONSTANTS.CONNECTION.RECONNECT_DELAY);
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
  public sendChatMessage(chatId: number, content: string): void {
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
    };

    this.sendOrQueueMessage(message, WS_CONSTANTS.DESTINATIONS.CHAT_SEND);
  }

  /**
   * Send a message with a reply
   */
  public sendReplyMessage(
    chatId: number,
    content: string,
    replyToId: number
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
    };

    this.sendOrQueueMessage(message, WS_CONSTANTS.DESTINATIONS.CHAT_SEND);
  }

  /**
   * Helper to send or queue a message
   */
  private sendOrQueueMessage(
    message: WebSocketMessage,
    destination: string
  ): void {
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
    const systemMsgData = generateRemoveUserSystemMessage(actorUsername, targetUsername);

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
    const systemMsgData = generateAddUserSystemMessage(actorUsername, targetUsername);

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
    const actorUsername = localStorage.getItem(WS_CONSTANTS.STORAGE_KEYS.USERNAME) || "System";

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
      isSystem: true // Mark as system message
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
   * Ensure a connection is established with the user ID
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
      console.log("[WebSocket] Connecting WebSocket with user ID:", userId);
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
            console.log(
              "[WebSocket] Recovered user ID from session storage:",
              user.id
            );
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
}

// Create a singleton instance
const websocketService = new WebSocketService();
export default websocketService;
