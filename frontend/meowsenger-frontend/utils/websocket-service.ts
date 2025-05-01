import { Client, IFrame, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";

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
}

export type MessageCallback = (message: WebSocketMessage) => void;

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
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  // Base WebSocket URL
  private readonly WS_URL =
    process.env.NEXT_PUBLIC_WS_URL || "http://localhost:8081/ws";

  /**
   * Initialize the WebSocket connection
   */
  public connect(userId: number, token: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.client && this.connected) {
        console.log("[WebSocket] Already connected");
        resolve(true);
        return;
      }

      this.userId = userId;
      console.log("[WebSocket] Attempting to connect...");

      // Store username in session storage for WebSocket messages
      const username = sessionStorage.getItem("username");
      if (username) {
        console.log("[WebSocket] Using username from session:", username);
      } else if (typeof window !== "undefined") {
        // Try to get username from auth context and store it
        const user = JSON.parse(sessionStorage.getItem("user") || "{}");
        if (user && user.username) {
          sessionStorage.setItem("username", user.username);
          console.log("[WebSocket] Stored username in session:", user.username);
        }
      }

      // Create a new STOMP client over SockJS
      this.client = new Client({
        webSocketFactory: () => new SockJS(this.WS_URL),
        connectHeaders: {
          Authorization: `Bearer ${token}`,
        },
        debug: (msg) => {
          console.log("[STOMP]", msg);
          // Log all received message bodies for debugging
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
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 30000,
        heartbeatOutgoing: 30000,
      });

      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        console.error("[WebSocket] Connection timed out");
        this.client = null;
        this.connected = false;
        resolve(false);
      }, 10000); // 10 seconds timeout

      this.client.onConnect = (frame: IFrame) => {
        clearTimeout(connectionTimeout);
        console.log("[WebSocket] Connected successfully");
        this.connected = true;

        // Update session storage and notify other tabs
        sessionStorage.setItem("ws_connected", "true");
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "ws_connected",
            newValue: "true",
          })
        );

        // Register the user
        this.registerUser(userId);

        // Resubscribe to previous topics
        this.resubscribe();

        // Send any queued messages
        this.sendQueuedMessages();

        resolve(true);
      };

      this.client.onStompError = (frame: IFrame) => {
        clearTimeout(connectionTimeout);
        console.error(
          "[WebSocket] Connection error:",
          frame.headers["message"]
        );
        console.error("Additional details: " + frame.body);
        this.connected = false;
        this.client = null;

        // Update session storage and notify other tabs
        sessionStorage.setItem("ws_connected", "false");
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "ws_connected",
            newValue: "false",
          })
        );

        resolve(false);
      };

      this.client.onWebSocketClose = () => {
        console.log("WebSocket connection closed");
        this.connected = false;

        // Update connection status
        sessionStorage.setItem("ws_connected", "false");
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "ws_connected",
            newValue: "false",
          })
        );

        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          console.log(
            `Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`
          );

          // Try to reconnect after a delay
          setTimeout(() => {
            if (this.userId && token) {
              this.connect(this.userId, token).catch((err) =>
                console.error("Failed to reconnect:", err)
              );
            }
          }, 5000);
        } else {
          console.error("Max reconnection attempts reached.");
        }
      };

      try {
        this.client.activate();
      } catch (error) {
        console.error("Failed to activate WebSocket client:", error);

        // Update connection status
        sessionStorage.setItem("ws_connected", "false");
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "ws_connected",
            newValue: "false",
          })
        );

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

      // Update connection status
      sessionStorage.setItem("ws_connected", "false");
      window.dispatchEvent(
        new StorageEvent("storage", { key: "ws_connected", newValue: "false" })
      );
    }
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
      destination: "/app/register",
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
      console.error("User ID not set");
      return "";
    }

    const subscriptionKey = `chat_${chatId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!.id;
    }

    if (!this.client || !this.connected) {
      console.warn(
        "WebSocket not connected. Will subscribe when connection is established."
      );
      // Store the subscription intent to resubscribe when connected
      this.subscriptions.set(subscriptionKey, {
        id: subscriptionKey,
        callback,
      });
      return subscriptionKey;
    }

    // Subscribe to the user-specific destination
    const userDestination = `/user/${this.userId}/queue/chat.${chatId}`;
    console.log(`Subscribing to user-specific destination: ${userDestination}`);

    const userSubscription = this.client.subscribe(
      userDestination,
      (message: IMessage) => {
        try {
          console.log(
            `Received message on user-specific channel for chat ${chatId}`
          );
          const receivedMessage: WebSocketMessage = JSON.parse(message.body);
          callback(receivedMessage);
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      }
    );

    // Also subscribe to the broadcast topic as a fallback
    const broadcastDestination = `/topic/user.${this.userId}.chat.${chatId}`;
    console.log(
      `Subscribing to broadcast destination: ${broadcastDestination}`
    );

    const broadcastSubscription = this.client.subscribe(
      broadcastDestination,
      (message: IMessage) => {
        try {
          console.log(
            `Received message on broadcast channel for chat ${chatId}`
          );
          const receivedMessage: WebSocketMessage = JSON.parse(message.body);
          callback(receivedMessage);
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      }
    );

    // Store the primary subscription for later use or unsubscribing
    this.subscriptions.set(subscriptionKey, {
      id: userSubscription.id,
      callback,
    });

    // Notify the server about subscription
    this.sendSubscribeMessage(chatId);

    return userSubscription.id;
  }

  /**
   * Subscribe to multiple chat rooms at once
   */
  public subscribeToMultipleChats(
    chatIds: number[],
    callback: MessageCallback
  ): void {
    if (!this.client || !this.connected || !this.userId) return;

    // Subscribe to each chat individually
    chatIds.forEach((chatId) => {
      this.subscribeToChatRoom(chatId, callback);
    });

    // Also send a batch subscription message to the server
    this.client.publish({
      destination: "/app/chats.subscribe",
      body: JSON.stringify(chatIds),
    });
  }

  /**
   * Unsubscribe from a chat room
   */
  public unsubscribeFromChatRoom(chatId: number): void {
    // Unsubscribe from main chat messages
    const chatSubscriptionKey = `chat_${chatId}`;
    if (this.subscriptions.has(chatSubscriptionKey)) {
      if (this.client && this.connected) {
        const { id } = this.subscriptions.get(chatSubscriptionKey)!;
        this.client.unsubscribe(id);
      }
      this.subscriptions.delete(chatSubscriptionKey);
    }

    // Unsubscribe from typing indicators
    const typingSubscriptionKey = `typing_${chatId}`;
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
    if (!this.client || !this.connected) {
      console.warn(
        "WebSocket not connected. Will subscribe when connection is established."
      );
      return "";
    }

    const destination = `/user/${userId}/queue/read-receipts`;
    const subscriptionKey = `read_receipts_${userId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!.id;
    }

    const subscription = this.client.subscribe(
      destination,
      (message: IMessage) => {
        try {
          const receivedMessage: WebSocketMessage = JSON.parse(message.body);
          callback(receivedMessage);
        } catch (error) {
          console.error("Error parsing read receipt message:", error);
        }
      }
    );

    this.subscriptions.set(subscriptionKey, { id: subscription.id, callback });
    return subscription.id;
  }

  /**
   * Subscribe to chat updates like new chats, added to group, etc.
   */
  public subscribeToChatUpdates(
    userId: number,
    callback: MessageCallback
  ): string {
    if (!this.client || !this.connected) {
      console.warn(
        "WebSocket not connected. Will subscribe when connection is established."
      );
      return "";
    }

    const subscriptionKey = `chat_updates_${userId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!.id;
    }

    // Subscribe to the user-specific destination for chat updates
    const userDestination = `/user/${userId}/queue/chat-updates`;
    console.log(`Subscribing to chat updates: ${userDestination}`);

    const userSubscription = this.client.subscribe(
      userDestination,
      (message: IMessage) => {
        try {
          console.log("Received chat update notification");
          const receivedMessage: WebSocketMessage = JSON.parse(message.body);
          callback(receivedMessage);
        } catch (error) {
          console.error("Error parsing chat update message:", error);
        }
      }
    );

    // Also subscribe to the broadcast topic as a fallback
    const broadcastDestination = `/topic/user.${userId}.chat-updates`;

    this.client.subscribe(broadcastDestination, (message: IMessage) => {
      try {
        const receivedMessage: WebSocketMessage = JSON.parse(message.body);
        callback(receivedMessage);
      } catch (error) {
        console.error("Error parsing chat update message:", error);
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
    if (!this.client || !this.connected) {
      console.warn(
        "WebSocket not connected. Will subscribe when connection is established."
      );
      const subscriptionKey = `admin_changes_${userId}`;
      this.subscriptions.set(subscriptionKey, {
        id: subscriptionKey,
        callback,
      });
      return subscriptionKey;
    }

    const subscriptionKey = `admin_changes_${userId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!.id;
    }

    // Subscribe to both user-specific chat-updates queue and regular chat messages
    // This ensures we receive both the CHAT_UPDATE notification and the system message
    const updateDestination = `/user/${userId}/queue/chat-updates`;
    const userSubscription = this.client.subscribe(
      updateDestination,
      (message: IMessage) => {
        try {
          const receivedMessage: WebSocketMessage = JSON.parse(message.body);
          console.log("Received admin-related message:", receivedMessage);

          // Only process CHAT_UPDATE messages with updateType ADMIN_CHANGED
          if (
            receivedMessage.type === "CHAT_UPDATE" &&
            receivedMessage.updateType === "ADMIN_CHANGED"
          ) {
            console.log(
              "Processing admin status change notification:",
              receivedMessage
            );
            callback(receivedMessage);
          }
        } catch (error) {
          console.error("Error parsing admin status change message:", error);
        }
      }
    );

    // Also subscribe to broadcast topic as fallback
    const broadcastDestination = `/topic/user.${userId}.chat-updates`;
    this.client.subscribe(broadcastDestination, (message: IMessage) => {
      try {
        const receivedMessage: WebSocketMessage = JSON.parse(message.body);
        if (
          receivedMessage.type === "CHAT_UPDATE" &&
          receivedMessage.updateType === "ADMIN_CHANGED"
        ) {
          console.log(
            "Processing admin status change from broadcast:",
            receivedMessage
          );
          callback(receivedMessage);
        }
      } catch (error) {
        console.error("Error parsing admin status broadcast:", error);
      }
    });

    this.subscriptions.set(subscriptionKey, {
      id: userSubscription.id,
      callback,
    });
    return userSubscription.id;
  }

  /**
   * Subscribe to user removal notifications
   */
  public subscribeToUserRemovals(
    userId: number,
    callback: MessageCallback
  ): string {
    if (!this.client || !this.connected) {
      console.warn(
        "WebSocket not connected. Will subscribe when connection is established."
      );
      const subscriptionKey = `user_removals_${userId}`;
      this.subscriptions.set(subscriptionKey, {
        id: subscriptionKey,
        callback,
      });
      return subscriptionKey;
    }

    const subscriptionKey = `user_removals_${userId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!.id;
    }

    // Subscribe to user-specific destination for chat updates
    // This includes member add/remove notifications
    const userDestination = `/user/${userId}/queue/chat-updates`;
    console.log(
      `Subscribing to user removal notifications: ${userDestination}`
    );

    const userSubscription = this.client.subscribe(
      userDestination,
      (message: IMessage) => {
        try {
          const receivedMessage: WebSocketMessage = JSON.parse(message.body);
          console.log("Received chat update message:", receivedMessage);

          // Process both MEMBER_REMOVED updates and regular CHAT messages about removals
          if (
            (receivedMessage.type === "CHAT_UPDATE" &&
              receivedMessage.updateType === "MEMBER_REMOVED") ||
            (receivedMessage.type === "CHAT" &&
              receivedMessage.isSystem === true &&
              receivedMessage.content &&
              receivedMessage.content.includes("removed") &&
              receivedMessage.content.includes("from the group"))
          ) {
            console.log("Detected user removal notification:", receivedMessage);
            callback(receivedMessage);
          }
        } catch (error) {
          console.error("Error parsing user removal message:", error);
        }
      }
    );

    // Also subscribe to the broadcast topic as fallback
    const broadcastDestination = `/topic/user.${userId}.chat-updates`;
    this.client.subscribe(broadcastDestination, (message: IMessage) => {
      try {
        const receivedMessage: WebSocketMessage = JSON.parse(message.body);

        if (
          (receivedMessage.type === "CHAT_UPDATE" &&
            receivedMessage.updateType === "MEMBER_REMOVED") ||
          (receivedMessage.type === "CHAT" &&
            receivedMessage.isSystem === true &&
            receivedMessage.content &&
            receivedMessage.content.includes("removed") &&
            receivedMessage.content.includes("from the group"))
        ) {
          console.log(
            "Detected user removal notification from broadcast:",
            receivedMessage
          );
          callback(receivedMessage);
        }
      } catch (error) {
        console.error("Error parsing user removal broadcast:", error);
      }
    });

    this.subscriptions.set(subscriptionKey, {
      id: userSubscription.id,
      callback,
    });
    return userSubscription.id;
  }

  /**
   * Subscribe to member add notifications
   */
  public subscribeToMemberAdditions(
    userId: number,
    callback: MessageCallback
  ): string {
    if (!this.client || !this.connected) {
      console.warn(
        "WebSocket not connected. Will subscribe when connection is established."
      );
      const subscriptionKey = `member_additions_${userId}`;
      this.subscriptions.set(subscriptionKey, {
        id: subscriptionKey,
        callback,
      });
      return subscriptionKey;
    }

    const subscriptionKey = `member_additions_${userId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!.id;
    }

    // Subscribe to user-specific destination for member additions
    // This uses the same queue as other chat updates
    const userDestination = `/user/${userId}/queue/chat-updates`;
    console.log(
      `Subscribing to member addition notifications: ${userDestination}`
    );

    const userSubscription = this.client.subscribe(
      userDestination,
      (message: IMessage) => {
        try {
          const receivedMessage: WebSocketMessage = JSON.parse(message.body);
          console.log("Received chat update message:", receivedMessage);

          // Process both MEMBER_ADDED updates and regular CHAT messages about additions
          if (
            (receivedMessage.type === "CHAT_UPDATE" &&
              receivedMessage.updateType === "MEMBER_ADDED") ||
            (receivedMessage.type === "CHAT" &&
              receivedMessage.isSystem === true &&
              receivedMessage.content &&
              receivedMessage.content.includes("added") &&
              receivedMessage.content.includes("to the group"))
          ) {
            console.log(
              "Detected member addition notification:",
              receivedMessage
            );
            callback(receivedMessage);
          }
        } catch (error) {
          console.error("Error parsing member addition message:", error);
        }
      }
    );

    // Also subscribe to the broadcast topic as fallback
    const broadcastDestination = `/topic/user.${userId}.chat-updates`;
    this.client.subscribe(broadcastDestination, (message: IMessage) => {
      try {
        const receivedMessage: WebSocketMessage = JSON.parse(message.body);

        if (
          (receivedMessage.type === "CHAT_UPDATE" &&
            receivedMessage.updateType === "MEMBER_ADDED") ||
          (receivedMessage.type === "CHAT" &&
            receivedMessage.isSystem === true &&
            receivedMessage.content &&
            receivedMessage.content.includes("added") &&
            receivedMessage.content.includes("to the group"))
        ) {
          console.log(
            "Detected member addition notification from broadcast:",
            receivedMessage
          );
          callback(receivedMessage);
        }
      } catch (error) {
        console.error("Error parsing member addition broadcast:", error);
      }
    });

    this.subscriptions.set(subscriptionKey, {
      id: userSubscription.id,
      callback,
    });
    return userSubscription.id;
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
      destination: "/app/chat.subscribe",
      body: JSON.stringify(message),
    });
  }

  /**
   * Send a chat message
   */
  public sendChatMessage(chatId: number, content: string): void {
    if (!this.userId) {
      console.error("User ID not set");
      return;
    }

    const message: WebSocketMessage = {
      type: "CHAT",
      userId: this.userId,
      chatId: chatId,
      content: content,
      timestamp: new Date().toISOString(),
    };

    if (!this.client || !this.connected) {
      // Queue the message for sending when connected
      this.messageQueue.push(message);
      console.warn("WebSocket not connected. Message queued.");
      return;
    }

    this.client.publish({
      destination: "/app/chat.send",
      body: JSON.stringify(message),
    });
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
      destination: "/app/chat.read",
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
      console.warn("WebSocket not connected. Cannot send admin status change.");
      return;
    }

    const message: WebSocketMessage = {
      type: "CHAT_UPDATE",
      userId: this.userId,
      username: sessionStorage.getItem("username") || undefined, // Get username from session storage
      chatId: chatId,
      content: isPromotion
        ? `made ${targetUsername} an admin`
        : `removed admin rights from ${targetUsername}`,
      timestamp: new Date().toISOString(),
      updateType: "ADMIN_CHANGED",
      targetUserId: targetUserId,
      targetUsername: targetUsername,
      isPromotion: isPromotion,
    };

    // Send directly to the new direct admin change endpoint
    this.client.publish({
      destination: "/app/chat.admin-change",
      body: JSON.stringify(message),
    });

    console.log("Sent admin status change request via WebSocket:", message);
  }

  // Deprecated: Use sendAdminStatusChange instead
  private sendAdminStatusChanged(
    chatId: number,
    targetUserId: number,
    targetUsername: string,
    isPromotion: boolean
  ): void {
    console.warn(
      "This method is deprecated, use sendAdminStatusChange instead"
    );
    this.sendAdminStatusChange(
      chatId,
      targetUserId,
      targetUsername,
      isPromotion
    );
  }

  /**
   * Send member removed notification
   * This should be called after a successful API call to remove a member
   */
  public sendMemberRemoved(
    chatId: number,
    targetUserId: number,
    targetUsername: string
  ): void {
    if (!this.client || !this.connected || !this.userId) {
      console.warn(
        "WebSocket not connected. Cannot send member removed notification."
      );
      return;
    }

    const message: WebSocketMessage = {
      type: "CHAT_UPDATE",
      userId: this.userId,
      username: sessionStorage.getItem("username") || undefined, // Get username from session storage
      chatId: chatId,
      content: `removed ${targetUsername} from the group`,
      timestamp: new Date().toISOString(),
      updateType: "MEMBER_REMOVED",
      targetUserId: targetUserId,
      targetUsername: targetUsername,
    };

    // Send directly to the member-removed endpoint
    // which will process the request completely in the backend
    this.client.publish({
      destination: "/app/chat.member-removed",
      body: JSON.stringify(message),
    });

    console.log("Sent member removal request:", message);
  }

  /**
   * Send member added notification
   * This should be called after a successful API call to add a member
   */
  public sendMemberAdded(
    chatId: number,
    targetUserId: number,
    targetUsername: string
  ): void {
    if (!this.client || !this.connected || !this.userId) {
      console.warn(
        "WebSocket not connected. Cannot send member added notification."
      );
      return;
    }

    const message: WebSocketMessage = {
      type: "CHAT_UPDATE",
      userId: this.userId,
      username: sessionStorage.getItem("username") || undefined, // Get username from session storage
      chatId: chatId,
      content: `added ${targetUsername} to the group`,
      timestamp: new Date().toISOString(),
      updateType: "MEMBER_ADDED",
      targetUserId: targetUserId,
      targetUsername: targetUsername,
    };

    // Send to the dedicated member-added endpoint
    this.client.publish({
      destination: "/app/chat.member-added",
      body: JSON.stringify(message),
    });

    console.log("Sent member added notification:", message);
  }

  /**
   * Send chat settings change notification
   * This should be called after a successful UI update to notify all members about the changes
   */
  public sendChatSettingsChanged(
    chatId: number,
    chatName: string,
    description: string,
    updateMessage: string
  ): void {
    if (!this.client || !this.connected || !this.userId) {
      console.warn(
        "WebSocket not connected. Cannot send settings change notification."
      );
      return;
    }

    const message: WebSocketMessage = {
      type: "CHAT_UPDATE",
      userId: this.userId,
      chatId: chatId,
      content: description, // Use content field for description
      updateMessage: updateMessage, // Message about what changed
      timestamp: new Date().toISOString(),
      updateType: "SETTINGS_CHANGED",
      chatName: chatName, // New chat name
    };

    // Send to the chat's settings channel
    this.client.publish({
      destination: "/app/chat.settings-changed",
      body: JSON.stringify(message),
    });

    console.log("Sent chat settings change notification:", message);
  }

  /**
   * Send a typing indicator notification
   */
  public sendTypingIndicator(chatId: number): void {
    if (!this.client || !this.connected || !this.userId) return;

    // Create a lighter-weight typing indicator message
    const message: WebSocketMessage = {
      type: "TYPING",
      userId: this.userId,
      chatId: chatId,
      content: "", // Empty content to reduce payload size
      timestamp: new Date().toISOString(),
    };

    // Use sendString instead of publish with JSON.stringify to reduce overhead
    this.client.publish({
      destination: "/app/chat.typing",
      body: JSON.stringify(message),
      headers: { "content-type": "application/json;minimal=true" },
    });
  }

  /**
   * Subscribe to typing indicators for a chat
   */
  public subscribeToTypingIndicators(
    chatId: number,
    callback: MessageCallback
  ): string {
    if (!this.client || !this.connected) {
      console.warn(
        "WebSocket not connected. Cannot subscribe to typing indicators."
      );
      return "";
    }

    const destination = `/topic/chat.${chatId}/typing`;
    const subscriptionKey = `typing_${chatId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!.id;
    }

    const subscription = this.client.subscribe(
      destination,
      (message: IMessage) => {
        try {
          const receivedMessage: WebSocketMessage = JSON.parse(message.body);
          callback(receivedMessage);
        } catch (error) {
          console.error("Error parsing typing indicator:", error);
        }
      }
    );

    this.subscriptions.set(subscriptionKey, { id: subscription.id, callback });
    return subscription.id;
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
      destination: "/app/chat.edit",
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
      destination: "/app/chat.delete",
      body: JSON.stringify(message),
    });
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
      console.error("User ID not set");
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

    if (!this.client || !this.connected) {
      // Queue the message for sending when connected
      this.messageQueue.push(message);
      console.warn("WebSocket not connected. Reply message queued.");
      return;
    }

    this.client.publish({
      destination: "/app/chat.send",
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
        this.client.publish({
          destination: "/app/chat.send",
          body: JSON.stringify(message),
        });
      }
    }
  }

  /**
   * Resubscribe to all previously subscribed topics
   */
  private resubscribe(): void {
    if (!this.client || !this.connected || !this.userId) return;

    this.subscriptions.forEach((subscription, key) => {
      const { callback } = subscription;

      // Extract chatId from subscription key
      if (key.startsWith("chat_")) {
        const chatId = parseInt(key.replace("chat_", ""), 10);
        if (!isNaN(chatId)) {
          console.log(`Resubscribing to chat ${chatId}`);

          // Subscribe to chat room using user-specific destination
          const userDestination = `/user/${this.userId}/queue/chat.${chatId}`;
          console.log(
            `Resubscribing to user-specific destination: ${userDestination}`
          );

          const userSubscription = this.client!.subscribe(
            userDestination,
            (message: IMessage) => {
              try {
                console.log(
                  `Received message on user-specific channel for chat ${chatId}`
                );
                const receivedMessage: WebSocketMessage = JSON.parse(
                  message.body
                );
                callback(receivedMessage);
              } catch (error) {
                console.error("Error parsing message:", error);
              }
            }
          );

          // Also subscribe to the broadcast topic as a fallback
          const broadcastDestination = `/topic/user.${this.userId}.chat.${chatId}`;
          console.log(
            `Resubscribing to broadcast destination: ${broadcastDestination}`
          );

          this.client!.subscribe(broadcastDestination, (message: IMessage) => {
            try {
              console.log(
                `Received message on broadcast channel for chat ${chatId}`
              );
              const receivedMessage: WebSocketMessage = JSON.parse(
                message.body
              );
              callback(receivedMessage);
            } catch (error) {
              console.error("Error parsing message:", error);
            }
          });

          // Update subscription ID
          this.subscriptions.set(key, { id: userSubscription.id, callback });

          // Send subscription message to server
          this.sendSubscribeMessage(chatId);
        }
      } else if (key.startsWith("read_receipts_")) {
        // Handle read receipts subscription
        const userId = parseInt(key.replace("read_receipts_", ""), 10);
        if (!isNaN(userId)) {
          const newSubscription = this.client!.subscribe(
            `/user/${userId}/queue/read-receipts`,
            (message: IMessage) => {
              try {
                const receivedMessage: WebSocketMessage = JSON.parse(
                  message.body
                );
                callback(receivedMessage);
              } catch (error) {
                console.error("Error parsing read receipt message:", error);
              }
            }
          );

          // Update subscription ID
          this.subscriptions.set(key, { id: newSubscription.id, callback });
        }
      } else if (key.startsWith("typing_")) {
        // Handle typing indicators which still use broadcast topic pattern
        const chatId = parseInt(key.replace("typing_", ""), 10);
        if (!isNaN(chatId)) {
          const newSubscription = this.client!.subscribe(
            `/topic/chat.${chatId}/typing`,
            (message: IMessage) => {
              try {
                const receivedMessage: WebSocketMessage = JSON.parse(
                  message.body
                );
                callback(receivedMessage);
              } catch (error) {
                console.error("Error parsing typing indicator:", error);
              }
            }
          );

          // Update subscription ID
          this.subscriptions.set(key, { id: newSubscription.id, callback });
        }
      } else if (
        key.startsWith("chat_updates_") ||
        key.startsWith("admin_changes_") ||
        key.startsWith("user_removals_") ||
        key.startsWith("member_additions_")
      ) {
        // Handle all chat updates including admin status changes, user removals, and member additions
        const userId = parseInt(
          key.replace(
            /^(chat_updates_|admin_changes_|user_removals_|member_additions_)/,
            ""
          ),
          10
        );
        if (!isNaN(userId)) {
          console.log(`Resubscribing to chat updates for user ${userId}`);

          // All these notifications use the same endpoint
          const destination = `/user/${userId}/queue/chat-updates`;

          const newSubscription = this.client!.subscribe(
            destination,
            (message: IMessage) => {
              try {
                const receivedMessage: WebSocketMessage = JSON.parse(
                  message.body
                );

                // For admin_changes_ we only want ADMIN_CHANGED updates
                if (
                  key.startsWith("admin_changes_") &&
                  !(
                    receivedMessage.type === "CHAT_UPDATE" &&
                    receivedMessage.updateType === "ADMIN_CHANGED"
                  )
                ) {
                  return;
                }

                // For user_removals_ we only want MEMBER_REMOVED updates
                if (
                  key.startsWith("user_removals_") &&
                  !(
                    receivedMessage.type === "CHAT_UPDATE" &&
                    receivedMessage.updateType === "MEMBER_REMOVED"
                  )
                ) {
                  return;
                }

                // For member_additions_ we only want MEMBER_ADDED updates
                if (
                  key.startsWith("member_additions_") &&
                  !(
                    receivedMessage.type === "CHAT_UPDATE" &&
                    receivedMessage.updateType === "MEMBER_ADDED"
                  )
                ) {
                  return;
                }

                callback(receivedMessage);
              } catch (error) {
                console.error("Error parsing chat update message:", error);
              }
            }
          );

          // Update subscription ID
          this.subscriptions.set(key, { id: newSubscription.id, callback });

          // Also subscribe to broadcast topic as fallback
          const broadcastDestination = `/topic/user.${userId}.chat-updates`;
          this.client!.subscribe(broadcastDestination, (message: IMessage) => {
            try {
              const receivedMessage: WebSocketMessage = JSON.parse(
                message.body
              );

              // Apply same filtering as above
              if (
                key.startsWith("admin_changes_") &&
                !(
                  receivedMessage.type === "CHAT_UPDATE" &&
                  receivedMessage.updateType === "ADMIN_CHANGED"
                )
              ) {
                return;
              }

              if (
                key.startsWith("user_removals_") &&
                !(
                  receivedMessage.type === "CHAT_UPDATE" &&
                  receivedMessage.updateType === "MEMBER_REMOVED"
                )
              ) {
                return;
              }

              if (
                key.startsWith("member_additions_") &&
                !(
                  receivedMessage.type === "CHAT_UPDATE" &&
                  receivedMessage.updateType === "MEMBER_ADDED"
                )
              ) {
                return;
              }

              callback(receivedMessage);
            } catch (error) {
              console.error("Error parsing chat update message:", error);
            }
          });
        }
      }
    });
  }

  /**
   * Get current connection status and user ID
   */
  public getConnectionStatus(): { connected: boolean; userId: number | null } {
    return { connected: this.connected, userId: this.userId };
  }

  /**
   * Ensure a connection is established with the user ID
   * This is a helper method to make sure the userId is set before sending messages
   */
  public async ensureConnected(
    userId?: number,
    token?: string
  ): Promise<boolean> {
    // If we already have a connection with the correct userId, we're good
    if (
      this.connected &&
      this.userId &&
      (userId === undefined || this.userId === userId)
    ) {
      console.log("WebSocket already connected with correct user ID");
      return true;
    }

    // If userId and token are provided, try to connect
    if (userId !== undefined && token) {
      console.log("Reconnecting WebSocket with user ID:", userId);
      try {
        return await this.connect(userId, token);
      } catch (error) {
        console.error("Failed to connect WebSocket:", error);
        return false;
      }
    }

    // Try to recover userId from session storage if it wasn't provided
    if (!this.userId && userId === undefined) {
      const storedUserId = sessionStorage.getItem("userId");
      const storedToken = sessionStorage.getItem("token");

      if (storedUserId && storedToken) {
        const parsedUserId = parseInt(storedUserId, 10);
        if (!isNaN(parsedUserId)) {
          console.log("Reconnecting with stored user ID:", parsedUserId);
          try {
            return await this.connect(parsedUserId, storedToken);
          } catch (error) {
            console.error("Failed to connect with stored credentials:", error);
            return false;
          }
        }
      }
    }

    console.error("WebSocket not connected and no credentials available");
    return false;
  }
}

// Export as singleton
const websocketService = new WebSocketService();
export default websocketService;
