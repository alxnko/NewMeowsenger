import {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { useAuth } from "./auth-context";
import { chatApi, GroupResponse } from "@/utils/api-client";

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
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [chats, setChats] = useState<ChatBlock[]>([]);
  const [currentChat, setCurrentChat] = useState<ChatDetails | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(0);

  const { user } = useAuth();

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
    if (!token || !currentChat) return;

    setLoading(true);
    setError(null);

    try {
      // For direct chat, we use username, for group chat we use group id
      const to = currentChat.isGroup ? currentChat.id : currentChat.name;

      const response = await chatApi.sendMessage(token, to, text, replyTo);

      if (response.status) {
        // Instead of calling openChat which causes infinite reloads,
        // manually add the new message to the currentMessages state
        if (response.message) {
          // If the API returns the new message, add it to the current messages
          const newMessage: ChatMessage = {
            id: Date.now(), // Temporary ID until we get a real one from the API
            text: text,
            author: user?.username || "You",
            time: Math.floor(Date.now() / 1000), // Current time in seconds
            isDeleted: false,
            isEdited: false,
            isSystem: false,
            isForwarded: false,
            replyTo: replyTo,
          };

          setCurrentMessages((prevMessages) => [...prevMessages, newMessage]);
        }
      } else {
        setError("Failed to send message");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setLoading(false);
    }
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
