import { Client, IFrame, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";

export interface WebSocketMessage {
  type: "CHAT" | "JOIN" | "LEAVE" | "SUBSCRIBE" | "ERROR";
  chatId: number;
  userId: number;
  content: string;
  timestamp: string;
  messageId?: number;
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
    return new Promise((resolve, reject) => {
      if (this.client) {
        this.disconnect();
      }

      this.userId = userId;

      this.client = new Client({
        webSocketFactory: () => new SockJS(this.WS_URL),
        connectHeaders: {
          Authorization: `Bearer ${token}`,
        },
        debug: function (str: any) {
          console.log("STOMP: " + str);
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
      });

      this.client.onConnect = (frame: IFrame) => {
        console.log("WebSocket Connected: " + frame);
        this.connected = true;
        this.reconnectAttempts = 0;

        // Store connection status in sessionStorage
        sessionStorage.setItem("ws_connected", "true");
        // Trigger an event to notify other components
        window.dispatchEvent(
          new StorageEvent("storage", { key: "ws_connected", newValue: "true" })
        );

        // Register the user
        this.registerUser(userId);

        // Resubscribe to previously subscribed topics
        this.resubscribe();

        // Send any queued messages
        this.sendQueuedMessages();

        resolve(true);
      };

      this.client.onStompError = (frame: IFrame) => {
        console.error("WebSocket Error: " + frame.headers["message"]);
        console.error("Additional details: " + frame.body);

        // Update connection status
        sessionStorage.setItem("ws_connected", "false");
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "ws_connected",
            newValue: "false",
          })
        );

        reject(new Error(frame.headers["message"]));
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

        reject(error);
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
    const destination = `/topic/chat.${chatId}`;
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

    // Subscribe to the chat room
    const subscription = this.client.subscribe(
      destination,
      (message: IMessage) => {
        try {
          const receivedMessage: WebSocketMessage = JSON.parse(message.body);
          callback(receivedMessage);
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      }
    );

    // Store the subscription for later use or unsubscribing
    this.subscriptions.set(subscriptionKey, { id: subscription.id, callback });

    // Notify the server about subscription
    this.sendSubscribeMessage(chatId);

    return subscription.id;
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
    const subscriptionKey = `chat_${chatId}`;

    if (!this.subscriptions.has(subscriptionKey)) {
      return;
    }

    if (this.client && this.connected) {
      const { id } = this.subscriptions.get(subscriptionKey)!;
      this.client.unsubscribe(id);
    }

    this.subscriptions.delete(subscriptionKey);
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
    if (!this.client || !this.connected) return;

    this.subscriptions.forEach((subscription, key) => {
      const { callback } = subscription;

      // Extract chatId from subscription key
      if (key.startsWith("chat_")) {
        const chatId = parseInt(key.replace("chat_", ""), 10);
        if (!isNaN(chatId)) {
          // Subscribe to chat room
          const newSubscription = this.client!.subscribe(
            `/topic/chat.${chatId}`,
            (message: IMessage) => {
              try {
                const receivedMessage: WebSocketMessage = JSON.parse(
                  message.body
                );
                callback(receivedMessage);
              } catch (error) {
                console.error("Error parsing message:", error);
              }
            }
          );

          // Update subscription ID
          this.subscriptions.set(key, { id: newSubscription.id, callback });

          // Send subscription message to server
          this.sendSubscribeMessage(chatId);
        }
      } else if (key.startsWith("read_receipts_")) {
        // Handle other subscription types if needed
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
      }
    });
  }
}

// Export as singleton
const websocketService = new WebSocketService();
export default websocketService;
