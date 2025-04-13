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
  markMessageAsRead: (messageId: number) => void;
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
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === "CHAT") {
      // Convert WebSocket message to UI message format
      const newMessage: ChatMessage = {
        id: message.messageId || Date.now(),
        text: message.content,
        author: message.userId.toString(), // We'll need to fetch the username
        time: new Date(message.timestamp).getTime() / 1000, // Convert to seconds
        isDeleted: false,
        isEdited: false,
        isSystem: false,
        isForwarded: false,
      };

      setCurrentMessages((prevMessages) => [...prevMessages, newMessage]);
    }
  }, []);

  // Subscribe to current chat WebSocket updates
  useEffect(() => {
    if (!wsConnected || !currentChat || !user) return;

    // Subscribe to the current chat
    websocketService.subscribeToChatRoom(
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

      setCurrentMessages((prev) => [...prev, optimisticMessage]);

      // Send via WebSocket if connected
      if (wsConnected) {
        websocketService.sendChatMessage(currentChat.id, text);
      } else {
        // Fall back to REST API if WebSocket not connected
        const to = currentChat.isGroup ? currentChat.id : currentChat.name;
        await chatApi.sendMessage(token, to, text, replyTo);
      }

      // Update the optimistic message to no longer be pending
      setCurrentMessages((prev) =>
        prev.map((msg) =>
          msg.id === optimisticId ? { ...msg, isPending: false } : msg
        )
      );
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
        fetchChats,
        openChat,
        createGroup,
        addMember,
        removeMember,
        leaveGroup,
        saveSettings,
        sendMessage,
        markMessageAsRead,
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
