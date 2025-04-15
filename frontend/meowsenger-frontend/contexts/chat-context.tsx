import {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "./auth-context";
import { chatApi, GroupResponse } from "@/utils/api-client";
import websocketService, { WebSocketMessage } from "@/utils/websocket-service";
import { useToast } from "./toast-context";

// Chat types
export interface ChatMessage {
  id: number;
  text: string;
  author: string;
  time: number;
  isDeleted: boolean;
  isEdited: boolean;
  isSystem: boolean;
  replyTo?: number;
  isForwarded: boolean;
  isPending?: boolean; // Added for messages in sending state
  isRead?: boolean; // Added for tracking read status
}

export interface LastMessage {
  text: string;
  author: string;
  isSystem?: boolean;
}

export interface ChatBlock {
  id: number;
  name: string;
  secret: string;
  isVerified: boolean;
  isAdmin: boolean;
  isTester: boolean;
  lastMessage: LastMessage;
  url: string | number;
  type: "g" | "u";
  isGroup: boolean;
  lastUpdate: string;
  isUnread: boolean;
}

export interface ChatUser {
  id: number;
  username: string;
  is_verified?: boolean;
  is_tester?: boolean;
  is_admin?: boolean;
}

export interface ChatDetails extends ChatBlock {
  desc: string;
  users: ChatUser[];
  admins: string[];
}

interface ChatContextType {
  chats: ChatBlock[];
  currentChat: ChatDetails | null;
  currentMessages: ChatMessage[];
  loading: boolean;
  error: string | null;
  typingUsers: { userId: number; username: string }[];
  fetchChats: () => Promise<void>;
  openChat: (chatId: string | number) => Promise<void>;
  createGroup: (name: string) => Promise<GroupResponse | undefined>;
  addMember: (username: string, message: string) => Promise<void>;
  removeMember: (username: string, message: string) => Promise<void>;
  leaveGroup: (message: string) => Promise<void>;
  saveSettings: (
    name: string,
    description: string,
    message: string
  ) => Promise<void>;
  sendMessage: (text: string, replyTo?: number) => Promise<void>;
  editMessage: (messageId: number, newText: string) => Promise<void>;
  deleteMessage: (messageId: number) => Promise<void>;
  markMessageAsRead: (messageId: number) => void;
  sendTypingIndicator: (chatId: number) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [chats, setChats] = useState<ChatBlock[]>([]);
  const [currentChat, setCurrentChat] = useState<ChatDetails | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<
    { userId: number; username: string }[]
  >([]);
  // Track recent join/leave events to prevent duplicates
  const [recentJoinEvents, setRecentJoinEvents] = useState<Map<string, number>>(
    new Map()
  );
  const { showToast } = useToast();

  // Clean up old join events periodically (every 30 seconds)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const newMap = new Map(recentJoinEvents);
      let changed = false;

      // Remove entries older than 10 seconds
      Array.from(newMap.entries()).forEach(([key, timestamp]) => {
        if (now - timestamp > 10000) {
          newMap.delete(key);
          changed = true;
        }
      });

      // Only update state if something changed
      if (changed) {
        setRecentJoinEvents(newMap);
      }
    }, 30000);

    return () => clearInterval(cleanupInterval);
  }, [recentJoinEvents]);

  // Show errors as toasts when they change
  useEffect(() => {
    if (error) {
      showToast(error, "error");
    }
  }, [error, showToast]);

  // Connect to WebSocket when user is authenticated
  useEffect(() => {
    if (!token || !user || !user.id) return;

    const connectWebSocket = async () => {
      try {
        const connected = await websocketService.connect(user.id, token);
        setWsConnected(connected);
        console.log("WebSocket connected:", connected);
      } catch (err) {
        console.error("WebSocket connection error:", err);
        setError("Failed to connect to real-time messaging service");
      }
    };

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      websocketService.disconnect();
      setWsConnected(false);
    };
  }, [token, user]);

  // Set up WebSocket listeners for read receipts
  useEffect(() => {
    if (!token || !user || !user.id || !wsConnected) return;

    // Subscribe to read receipts for the current user
    websocketService.subscribeToReadReceipts(user.id, (message) => {
      if (message.type === "CHAT" && message.messageId) {
        // Update the read status of the message in UI
        setCurrentMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.id === message.messageId) {
              return { ...msg, isRead: true };
            }
            return msg;
          })
        );
      }
    });
  }, [token, user, wsConnected]);

  // Handle WebSocket messages for the current chat
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      console.log("Received WebSocket message:", message);
      
      if (message.type === "CHAT") {
        // Convert WebSocket message to UI message format with all the enhanced data
        const newMessage: ChatMessage = {
          id: message.messageId || Date.now(),
          text: message.content,
          author: message.username || message.userId.toString(),
          time: new Date(message.timestamp).getTime() / 1000, // Convert to seconds
          isDeleted: message.isDeleted || false,
          isEdited: message.isEdited || false,
          isSystem: message.isSystem || false,
          isForwarded: message.isForwarded || false,
          replyTo: message.replyTo,
          isRead: message.isRead || false,
          isPending: false, // Messages from WebSocket are confirmed
        };

        setCurrentMessages((prevMessages) => {
          // Debug logging to diagnose the issue
          console.log("Processing incoming message:", {
            id: newMessage.id,
            text: newMessage.text,
            author: newMessage.author,
          });
          
          // First, check if this message is from the current user
          const isFromCurrentUser = message.userId === user?.id;
          
          if (isFromCurrentUser) {
            console.log("Message is from current user, checking for pending messages...");
            // Find all pending messages from the current user
            const pendingMessages = prevMessages.filter(
              (msg) => msg.isPending && msg.author === user.username
            );
            
            console.log(`Found ${pendingMessages.length} pending messages`);
            
            if (pendingMessages.length > 0) {
              // Try to find an exact content match first
              const exactMatchIndex = prevMessages.findIndex(
                (msg) => 
                  msg.isPending && 
                  msg.author === user.username &&
                  msg.text === message.content
              );
              
              if (exactMatchIndex !== -1) {
                console.log("Found exact match for pending message, replacing");
                const updatedMessages = [...prevMessages];
                updatedMessages[exactMatchIndex] = newMessage;
                return updatedMessages;
              }
              
              // If no exact match, take the oldest pending message as a fallback
              // This handles cases where the text might have been modified by the server
              console.log("No exact match, replacing oldest pending message");
              const oldestPendingIndex = prevMessages.findIndex(
                (msg) => msg.isPending && msg.author === user.username
              );
              
              if (oldestPendingIndex !== -1) {
                const updatedMessages = [...prevMessages];
                updatedMessages[oldestPendingIndex] = newMessage;
                return updatedMessages;
              }
            }
          }

          // Check if this is an existing message being updated (edit/delete)
          if (message.messageId) {
            const existingMessageIndex = prevMessages.findIndex(
              (msg) => msg.id === message.messageId
            );

            if (existingMessageIndex !== -1) {
              console.log("Found existing message, updating");
              // If the message exists, replace it with the updated version
              const updatedMessages = [...prevMessages];
              updatedMessages[existingMessageIndex] = newMessage;
              return updatedMessages;
            }
          }

          console.log("No matching message found, adding as new");
          // If it's a completely new message (from another user or system), add it to the list
          return [...prevMessages, newMessage];
        });
      } else if (message.type === "TYPING") {
        // Handle typing indicator
        setTypingUsers((prev) => {
          const userExists = prev.some(
            (user) => user.userId === message.userId
          );
          if (userExists) {
            return prev;
          } else {
            return [
              ...prev,
              {
                userId: message.userId,
                username: message.username || message.userId.toString(),
              },
            ];
          }
        });

        // Remove typing indicator after a delay
        setTimeout(() => {
          setTypingUsers((prev) =>
            prev.filter((user) => user.userId !== message.userId)
          );
        }, 3000); // Adjust the delay as needed
      }
    },
    [user?.username, user?.id]
  );

  // Subscribe to current chat WebSocket updates
  useEffect(() => {
    if (!wsConnected || !currentChat || !user) return;

    // Subscribe to the current chat
    websocketService.subscribeToChatRoom(
      currentChat.id,
      handleWebSocketMessage
    );

    // Subscribe to typing indicators for the current chat
    websocketService.subscribeToTypingIndicators(
      currentChat.id,
      handleWebSocketMessage
    );

    // Cleanup when changing chats or unmounting
    return () => {
      if (currentChat) {
        websocketService.unsubscribeFromChatRoom(currentChat.id);
      }
    };
  }, [currentChat, wsConnected, user, handleWebSocketMessage]);

  // Subscribe to all chats for notifications
  useEffect(() => {
    if (!wsConnected || !user || chats.length === 0) return;

    // Get all chat IDs
    const chatIds = chats.map((chat) => chat.id);

    // Subscribe to all chats for notifications
    websocketService.subscribeToMultipleChats(chatIds, (message) => {
      // Only process messages for chats other than the current one
      if (currentChat && message.chatId === currentChat.id) return;

      if (message.type === "CHAT") {
        // Update the chat list to show a new message indicator
        setChats((prevChats) =>
          prevChats.map((chat) => {
            if (chat.id === message.chatId) {
              return {
                ...chat,
                isUnread: true,
                lastMessage: {
                  text: message.content,
                  author: message.userId.toString(),
                },
                lastUpdate: new Date().toISOString(),
              };
            }
            return chat;
          })
        );
      }
    });
  }, [chats, wsConnected, user, currentChat]);

  // Poll for new chats every 10 seconds if user is authenticated
  useEffect(() => {
    if (!token) return;

    const fetchInitialChats = async () => {
      await fetchChats();
    };

    fetchInitialChats();

    const interval = setInterval(fetchChats, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchChats = async () => {
    if (!token) return;

    try {
      const response = await chatApi.getChats(token, chats.length, lastUpdate);

      if (response.status && response.data?.length > 0) {
        setChats(response.data);
        if (response.time) {
          setLastUpdate(response.time);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch chats");
      console.error("Error fetching chats:", err);
    }
  };

  const openChat = async (chatIdOrName: string | number) => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      let response;

      // If it's a number, it's a group chat ID
      if (typeof chatIdOrName === "number") {
        response = await chatApi.getGroup(token, chatIdOrName);
      } else {
        // Otherwise it's a username for a direct chat
        response = await chatApi.getChat(token, chatIdOrName);
      }

      if (response.status) {
        setCurrentChat(response.chat);
        setCurrentMessages(response.messages || []);

        // Subscribe to WebSocket updates for this chat if WebSocket is connected
        if (wsConnected && user) {
          websocketService.subscribeToChatRoom(
            response.chat.id,
            handleWebSocketMessage
          );
        }
      } else {
        setError("Failed to open chat");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open chat");
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (
    name: string
  ): Promise<GroupResponse | undefined> => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await chatApi.createGroup(token, name);

      if (response.status) {
        // Refresh the chat list after creating a group
        await fetchChats();
        return response;
      } else {
        setError("Failed to create group");
        return undefined;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
      return undefined;
    } finally {
      setLoading(false);
    }
  };

  const addMember = async (username: string, message: string) => {
    if (!token || !currentChat) return;

    setLoading(true);
    setError(null);

    try {
      const response = await chatApi.addMember(
        token,
        currentChat.id,
        username,
        message
      );

      if (response.status) {
        // Refresh current chat after adding a member
        await openChat(currentChat.id);
      } else {
        setError("Failed to add member");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (username: string, message: string) => {
    if (!token || !currentChat) return;

    setLoading(true);
    setError(null);

    try {
      const response = await chatApi.removeMember(
        token,
        currentChat.id,
        username,
        message
      );

      if (response.status) {
        // Refresh current chat after removing a member
        await openChat(currentChat.id);
      } else {
        setError("Failed to remove member");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setLoading(false);
    }
  };

  const leaveGroup = async (message: string) => {
    if (!token || !currentChat) return;

    setLoading(true);
    setError(null);

    try {
      const response = await chatApi.leaveGroup(token, currentChat.id, message);

      if (response.status) {
        // Unsubscribe from the WebSocket for this chat
        if (wsConnected) {
          websocketService.unsubscribeFromChatRoom(currentChat.id);
        }

        setCurrentChat(null);
        setCurrentMessages([]);
        await fetchChats();
      } else {
        setError("Failed to leave group");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave group");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (
    name: string,
    description: string,
    message: string
  ) => {
    if (!token || !currentChat) return;

    setLoading(true);
    setError(null);

    try {
      const response = await chatApi.saveSettings(
        token,
        currentChat.id,
        name,
        description,
        message
      );

      if (response.status) {
        // Refresh current chat after saving settings
        await openChat(currentChat.id);
      } else {
        setError("Failed to save settings");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text: string, replyTo?: number) => {
    if (!token || !currentChat || !user) return;

    setLoading(true);
    setError(null);

    try {
      // Immediately add the optimistic message to UI
      const optimisticId = Date.now();
      const optimisticMessage: ChatMessage = {
        id: optimisticId,
        text,
        author: user.username,
        time: Math.floor(Date.now() / 1000),
        isDeleted: false,
        isEdited: false,
        isSystem: false,
        isForwarded: false,
        replyTo,
        isPending: true, // Flag to indicate the message is being sent
      };

      // Log the optimistic message for debugging
      console.log("Creating optimistic message:", {
        id: optimisticId,
        text,
        author: user.username,
        isPending: true
      });

      setCurrentMessages((prev) => [...prev, optimisticMessage]);

      // Ensure WebSocket connection is established with the correct user ID
      const isConnected = await websocketService.ensureConnected(
        user.id,
        token
      );

      // Send via WebSocket if connected
      if (isConnected) {
        console.log(`Sending message via WebSocket to chat ${currentChat.id}: "${text}"`);
        if (replyTo) {
          // Use the reply-specific method if replying to a message
          websocketService.sendReplyMessage(currentChat.id, text, replyTo);
        } else {
          // Regular message send
          websocketService.sendChatMessage(currentChat.id, text);
        }
      } else {
        console.log("WebSocket not connected, falling back to REST API");
        // Fall back to REST API if WebSocket not connected
        const to = currentChat.isGroup ? currentChat.id : currentChat.name;
        await chatApi.sendMessage(token, to, text, replyTo);
      }

      // We no longer need to update the optimistic message to non-pending here
      // Because the WebSocket callback will handle this when the message is confirmed
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");

      // Remove the failed optimistic message
      setCurrentMessages((prev) =>
        prev.filter((msg) => !(msg.isPending && msg.text === text))
      );
    } finally {
      setLoading(false);
    }
  };

  const editMessage = async (messageId: number, newText: string) => {
    if (!currentChat || !user || !token) return;

    try {
      // Optimistically update the message in the UI
      setCurrentMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (msg.id === messageId) {
            return {
              ...msg,
              text: newText,
              isEdited: true,
            };
          }
          return msg;
        })
      );

      // Ensure WebSocket connection is established with the correct user ID
      const isConnected = await websocketService.ensureConnected(
        user.id,
        token
      );

      if (isConnected) {
        console.log(`Editing message ${messageId} via WebSocket`);
        // Send the edit via WebSocket
        websocketService.editMessage(messageId, currentChat.id, newText);
      } else {
        console.warn("WebSocket not connected, edit may not be synchronized");
        // Could implement a REST API fallback for edits here
      }
    } catch (error) {
      setError("Failed to edit message");
      console.error("Error editing message:", error);
    }
  };

  const deleteMessage = async (messageId: number) => {
    if (!currentChat || !user || !token) return;

    try {
      // Optimistically update the message in the UI
      setCurrentMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (msg.id === messageId) {
            return {
              ...msg,
              text: "This message was deleted",
              isDeleted: true,
            };
          }
          return msg;
        })
      );

      // Ensure WebSocket connection is established with the correct user ID
      const isConnected = await websocketService.ensureConnected(
        user.id,
        token
      );

      if (isConnected) {
        console.log(`Deleting message ${messageId} via WebSocket`);
        // Send the delete via WebSocket
        websocketService.deleteMessage(messageId, currentChat.id);
      } else {
        console.warn("WebSocket not connected, delete may not be synchronized");
        // Could implement a REST API fallback for deletes here
      }
    } catch (error) {
      setError("Failed to delete message");
      console.error("Error deleting message:", error);
    }
  };

  // Send typing indicator when user is typing
  const sendTypingIndicator = useCallback(
    (chatId: number) => {
      if (!wsConnected) return;
      websocketService.sendTypingIndicator(chatId);
    },
    [wsConnected]
  );

  const markMessageAsRead = (messageId: number) => {
    if (!wsConnected || !user) return;

    websocketService.markMessageAsRead(messageId);

    // Update UI optimistically
    setCurrentMessages((prevMessages) =>
      prevMessages.map((msg) => {
        if (msg.id === messageId) {
          return { ...msg, isRead: true };
        }
        return msg;
      })
    );
  };

  return (
    <ChatContext.Provider
      value={{
        chats,
        currentChat,
        currentMessages,
        loading,
        error,
        typingUsers,
        fetchChats,
        openChat,
        createGroup,
        addMember,
        removeMember,
        leaveGroup,
        saveSettings,
        sendMessage,
        editMessage,
        deleteMessage,
        markMessageAsRead,
        sendTypingIndicator,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => {
  const context = useContext(ChatContext);

  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }

  return context;
};
