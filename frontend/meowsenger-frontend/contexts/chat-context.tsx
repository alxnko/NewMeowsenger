import {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./auth-context";
import { chatApi, GroupResponse } from "@/utils/api-client";
import websocketService, { WebSocketMessage } from "@/utils/websocket-service";
import { useToast } from "./toast-context";
import { useRouter } from "next/navigation"; // Import router for redirection

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
  messageKey?: string; // Added for deduplication
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
  // Supporting both naming conventions for compatibility during transition
  // In the future, we should standardize on one naming convention
}

export interface ChatDetails extends ChatBlock {
  desc: string;
  users: ChatUser[];
  admins: string[];
}

// Constants for lazy loading
const MESSAGES_BATCH_SIZE = 30; // Number of messages to load per batch

interface ChatContextType {
  chats: ChatBlock[];
  currentChat: ChatDetails | null;
  currentMessages: ChatMessage[];
  loading: boolean;
  error: string | null;
  typingUsers: { userId: number; username: string }[];
  fetchChats: () => Promise<void>;
  openChat: (chatId: string | number) => Promise<void>;
  createGroup: (
    name: string,
    members?: string[]
  ) => Promise<GroupResponse | undefined>;
  addMember: (
    chatId: number,
    userId: number,
    username: string
  ) => Promise<boolean>;
  removeMember: (username: string, message: string) => Promise<void>;
  addAdmin: (username: string, message: string) => Promise<void>;
  removeAdmin: (username: string, message: string) => Promise<void>;
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
  loadOlderMessages: () => Promise<boolean>;
  isLoadingOlderMessages: boolean;
  hasMoreMessages: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const router = useRouter(); // Add router for redirections
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
  // States for lazy loading
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  // Store oldest message ID for pagination
  const oldestMessageIdRef = useRef<number | null>(null);

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
    }, 5000);

    return () => clearInterval(cleanupInterval);
  }, [recentJoinEvents]);

  // Show errors as toasts when they change
  useEffect(() => {
    if (error) {
      showToast(error, "error");
      // Clear the error after showing it as a toast
      setTimeout(() => {
        setError(null);
      }, 100);
    }
  }, [error, showToast]);

  // Set up WebSocket listeners for admin status changes, user removals, and member additions in one place
  useEffect(() => {
    if (!token || !user || !user.id || !wsConnected) return;

    console.log("Setting up unified WebSocket listeners for user events");

    // Subscribe to admin status changes
    const adminStatusChangeSub = websocketService.subscribeToAdminStatusChanges(
      user.id,
      handleAdminStatusChange
    );

    // Subscribe to user removals
    const userRemovalSub = websocketService.subscribeToUserRemovals(
      user.id,
      handleMemberRemoved
    );

    // Subscribe to member additions
    const memberAdditionSub = websocketService.subscribeToMemberAdditions(
      user.id,
      handleMemberAdded
    );

    // Cleanup on unmount or when dependencies change
    return () => {
      console.log("Cleaning up WebSocket subscriptions");
      // No need to explicitly unsubscribe as the WebSocket service handles this internally
    };
  }, [token, user, wsConnected]);

  // Handle admin status change notification from WebSocket
  const handleAdminStatusChange = useCallback(
    (message: WebSocketMessage) => {
      console.log("Received admin status change:", message);

      if (!currentChat) return;

      // If this is about the current chat
      if (message.chatId === currentChat.id) {
        // Update the user list to reflect the new admin status
        setCurrentChat((prev) => {
          if (!prev) return null;

          const updatedUsers = prev.users.map((u) => {
            if (
              u.id === message.targetUserId ||
              u.username === message.targetUsername
            ) {
              return {
                ...u,
                isAdmin: message.isPromotion ?? false,
              };
            }
            return u;
          });

          return {
            ...prev,
            users: updatedUsers,
          };
        });

        // Add a system notification to the chat messages
        if (message.content) {
          const systemMessage: ChatMessage = {
            id: message.messageId || Date.now(),
            text: message.content,
            author: "System",
            time: Math.floor(
              message.timestamp
                ? new Date(message.timestamp).getTime() / 1000
                : Date.now() / 1000
            ),
            isDeleted: false,
            isEdited: false,
            isSystem: true,
            isForwarded: false,
          };

          // Add this message if it doesn't already exist
          setCurrentMessages((prev) => {
            // Check if we already have this message (by ID or content)
            const exists = prev.some(
              (m) =>
                (message.messageId && m.id === message.messageId) ||
                (m.isSystem && m.text === message.content)
            );
            if (exists) return prev;

            return [...prev, systemMessage];
          });
        }
      }

      // Always refresh the chat list to ensure everything is up to date
      fetchChats();
    },
    [currentChat]
  );

  // Handle member removed notification from WebSocket
  const handleMemberRemoved = useCallback(
    (message: WebSocketMessage) => {
      console.log("Received member removed notification:", message);

      if (!currentChat || !user) return;

      // If this is about the current chat
      if (message.chatId === currentChat.id) {
        // Update the user list to remove the user
        setCurrentChat((prev) => {
          if (!prev) return null;

          const updatedUsers = prev.users.filter(
            (u) =>
              u.id !== message.targetUserId &&
              u.username !== message.targetUsername
          );

          return {
            ...prev,
            users: updatedUsers,
          };
        });

        // Add a system notification to the chat messages
        if (message.content) {
          const systemMessage: ChatMessage = {
            id: message.messageId || Date.now(),
            text: message.content,
            author: "System",
            time: Math.floor(
              message.timestamp
                ? new Date(message.timestamp).getTime() / 1000
                : Date.now() / 1000
            ),
            isDeleted: false,
            isEdited: false,
            isSystem: true,
            isForwarded: false,
          };

          // Add this message if it doesn't already exist
          setCurrentMessages((prev) => {
            // Check if we already have this message (by ID or content)
            const exists = prev.some(
              (m) =>
                (message.messageId && m.id === message.messageId) ||
                (m.isSystem && m.text === message.content)
            );
            if (exists) return prev;

            return [...prev, systemMessage];
          });
        }

        // If I'm the one being removed, close this chat
        if (
          (message.targetUserId && message.targetUserId === user.id) ||
          (message.targetUsername && message.targetUsername === user.username)
        ) {
          // Show notification
          showToast(`You were removed from ${currentChat.name}`, "info");

          // Close the chat
          setCurrentChat(null);
          setCurrentMessages([]);

          // Refresh the chat list to remove this chat
          fetchChats();
        }
      }

      // Always refresh the chat list to ensure everything is up to date
      fetchChats();
    },
    [currentChat, user, showToast]
  );

  // Handle member added notification from WebSocket
  const handleMemberAdded = useCallback(
    (message: WebSocketMessage) => {
      console.log("Received member added notification:", message);

      if (!currentChat) return;

      // If this is about the current chat
      if (message.chatId === currentChat.id) {
        // Update the user list to add the new member
        if (message.targetUsername && message.targetUserId) {
          setCurrentChat((prev) => {
            if (!prev) return null;

            // Check if user already exists
            const userExists = prev.users.some(
              (u) =>
                u.id === message.targetUserId ||
                u.username === message.targetUsername
            );

            if (userExists) return prev;

            // Add the new user with properties that match the ChatUser interface
            const newUser: ChatUser = {
              id: message.targetUserId || 0, // Ensure we have a number (not undefined)
              username: message.targetUsername || "",
              is_admin: false, // Use the snake_case property name as defined in the interface
              is_verified: false,
              is_tester: false,
            };

            return {
              ...prev,
              users: [...prev.users, newUser],
            };
          });
        }

        // Add a system notification to the chat messages
        if (message.content) {
          // Generate a unique key for deduplication
          const messageKey = `member_added_${message.targetUserId}_${Date.now().toString().substring(0, 8)}`;

          const systemMessage: ChatMessage = {
            id: message.messageId || Date.now(),
            text: message.content,
            author: "System",
            time: Math.floor(
              message.timestamp
                ? new Date(message.timestamp).getTime() / 1000
                : Date.now() / 1000
            ),
            isDeleted: false,
            isEdited: false,
            isSystem: true,
            isForwarded: false,
            messageKey, // Add key for deduplication
          };

          // Add this message if it doesn't already exist
          setCurrentMessages((prev) => {
            // Check if we already have this message (by ID, content, or key)
            const exists = prev.some(
              (m) =>
                (message.messageId && m.id === message.messageId) ||
                (m.isSystem && m.text === message.content) ||
                (m.messageKey && m.messageKey === messageKey)
            );
            if (exists) return prev;

            return [...prev, systemMessage];
          });
        }

        // When a member is added, refresh the chat to get the full updated member list
        if (message.updateType === "MEMBER_ADDED") {
          // Refresh the chat after a short delay to ensure backend consistency
          setTimeout(() => openChat(currentChat.id), 500);
        }
      }

      // Always refresh the chat list to ensure everything is up to date
      fetchChats();
    },
    [currentChat]
  );

  // Handle WebSocket chat update messages (new chats, added to groups)
  const handleChatUpdateMessage = useCallback(
    (message: WebSocketMessage) => {
      console.log("Received chat update message:", message);

      if (message.type === "CHAT_UPDATE") {
        // Refresh the chat list to show the new/updated chat
        fetchChats();

        // Show a notification to the user
        if (message.updateType === "NEW_CHAT") {
          showToast(`You were added to ${message.chatName}`, "info");
        } else if (message.updateType === "MEMBER_ADDED") {
          showToast(message.content, "info");
        }
      }
    },
    [showToast]
  );

  // Connect to WebSocket when user is authenticated
  useEffect(() => {
    if (!token || !user || !user.id) return;

    const connectWebSocket = async () => {
      try {
        const connected = await websocketService.connect(user.id, token);
        setWsConnected(connected);
        console.log("WebSocket connected:", connected);

        // Subscribe to chat updates (new chats, added to groups, etc.)
        if (connected) {
          websocketService.subscribeToChatUpdates(
            user.id,
            handleChatUpdateMessage
          );
        }
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
  }, [token, user, handleChatUpdateMessage]);

  // Set up periodic chat list refresh to catch new chats
  useEffect(() => {
    if (!token) return;

    // Fetch chats initially
    fetchChats();

    // Set up periodic polling as a fallback to WebSocket
    const interval = setInterval(() => {
      fetchChats();
    }, 10000);

    return () => clearInterval(interval);
  }, [token]);

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

        // Handle system messages about user removal immediately - redirect if it's about current user
        if (
          message.isSystem &&
          user?.username &&
          message.content.includes(`removed ${user.username} from the group`)
        ) {
          // User has been removed from this group
          setCurrentChat(null);
          setCurrentMessages([]);

          // Show notification only once
          const removalKey = `removed_from_${message.chatId}`;
          const storedRemoval = sessionStorage.getItem(removalKey);

          if (!storedRemoval) {
            sessionStorage.setItem(removalKey, Date.now().toString());
            showToast("You have been removed from this group", "info");
          }

          // Redirect to chats page
          router.push("/chats");
          return;
        }

        // Handle system messages about other users being removed
        if (
          message.isSystem &&
          message.content &&
          message.content.includes("removed") &&
          message.content.includes("from the group")
        ) {
          console.log(
            "Detected system message about user removal:",
            message.content
          );

          // If it's the current chat, update the UI to reflect the member removal
          if (currentChat && message.chatId === currentChat.id) {
            // Extract the username of the removed user from the message
            const contentParts = message.content.split(" ");
            const removedUserIndex =
              contentParts.findIndex((part) => part === "removed") + 1;

            if (
              removedUserIndex > 0 &&
              removedUserIndex < contentParts.length
            ) {
              const removedUsername = contentParts[removedUserIndex];

              // Update the current chat by removing the user from users array
              setCurrentChat((prevChat) => {
                if (!prevChat) return null;
                return {
                  ...prevChat,
                  users: prevChat.users.filter(
                    (u) => u.username !== removedUsername
                  ),
                };
              });
            }
          }

          // Add the system message to the chat feed
          setCurrentMessages((prev) => [...prev, newMessage]);

          // Refresh chats list to update member counts
          fetchChats();
          return;
        }

        // Handle admin status change messages - refresh immediately
        if (
          message.isSystem &&
          user?.username &&
          (message.content.includes(`made ${user.username} an admin`) ||
            message.content.includes(
              `removed admin rights from ${user.username}`
            ))
        ) {
          // Admin status has changed for current user - refresh the chat
          if (currentChat) {
            openChat(currentChat.id);
          }
        }

        setCurrentMessages((prevMessages) => {
          // First, check if this message is from the current user
          const isFromCurrentUser = message.userId === user?.id;

          if (isFromCurrentUser) {
            // Find all pending messages from the current user
            const pendingMessages = prevMessages.filter(
              (msg) => msg.isPending && msg.author === user.username
            );

            if (pendingMessages.length > 0) {
              // Try to find an exact content match first
              const exactMatchIndex = prevMessages.findIndex(
                (msg) =>
                  msg.isPending &&
                  msg.author === user.username &&
                  msg.text === message.content
              );

              if (exactMatchIndex !== -1) {
                const updatedMessages = [...prevMessages];
                updatedMessages[exactMatchIndex] = newMessage;
                return updatedMessages;
              }

              // If no exact match, take the oldest pending message as a fallback
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
              // If the message exists, replace it with the updated version
              const updatedMessages = [...prevMessages];
              updatedMessages[existingMessageIndex] = newMessage;
              return updatedMessages;
            }
          }

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
      } else if (message.type === "CHAT_UPDATE") {
        // Handle chat update messages like member removed/added/etc.
        if (message.updateType === "MEMBER_REMOVED") {
          // If it's about the current user, handle removal
          if (
            user?.username &&
            (message.targetUserId === user.id ||
              message.targetUsername === user.username ||
              (message.content && message.content.includes(user.username)))
          ) {
            // Current user was removed from this chat - clear current chat state
            setCurrentChat(null);
            setCurrentMessages([]);

            // Show notification only once
            const removalKey = `removed_from_${message.chatId}`;
            const storedRemoval = sessionStorage.getItem(removalKey);

            if (!storedRemoval) {
              sessionStorage.setItem(removalKey, Date.now().toString());
              showToast("You have been removed from this group", "info");
            }

            // Redirect to chats page
            router.push("/chats");
          }
          // If it's about another user, update the member list
          else if (currentChat && message.chatId === currentChat.id) {
            console.log("Another user was removed, updating member list");

            // Create a system message about the removal
            const systemMessage: ChatMessage = {
              id: message.messageId || Date.now(),
              text:
                message.content ||
                `${message.username || "Someone"} removed ${message.targetUsername || "a user"} from the group`,
              author: "System",
              time: new Date(message.timestamp).getTime() / 1000,
              isDeleted: false,
              isEdited: false,
              isSystem: true,
              isForwarded: false,
            };

            // Add the system message to the chat
            setCurrentMessages((prev) => [...prev, systemMessage]);

            // Update the member list
            if (message.targetUsername) {
              setCurrentChat((prevChat) => {
                if (!prevChat) return null;
                return {
                  ...prevChat,
                  users: prevChat.users.filter(
                    (u) => u.username !== message.targetUsername
                  ),
                };
              });
            } else if (message.targetUserId) {
              setCurrentChat((prevChat) => {
                if (!prevChat) return null;
                return {
                  ...prevChat,
                  users: prevChat.users.filter(
                    (u) => u.id !== message.targetUserId
                  ),
                };
              });
            }
          }

          // Always refresh chats list to update any affected chats
          fetchChats();
        } else if (
          message.updateType === "MEMBER_ADDED" &&
          currentChat &&
          message.chatId === currentChat.id
        ) {
          console.log("User was added to chat, updating UI");

          // Create a system message about the addition
          const systemMessage: ChatMessage = {
            id: message.messageId || Date.now(),
            text:
              message.content ||
              `${message.username || "Someone"} added ${message.targetUsername || "a user"} to the group`,
            author: "System",
            time: new Date(message.timestamp).getTime() / 1000,
            isDeleted: false,
            isEdited: false,
            isSystem: true,
            isForwarded: false,
          };

          // Add the system message to the chat
          setCurrentMessages((prev) => [...prev, systemMessage]);

          // Refresh the chat to get the updated member list
          openChat(currentChat.id);

          // Always refresh chats list
          fetchChats();
        } else if (message.updateType === "ADMIN_CHANGED") {
          // Admin status has changed - refresh the chat to update UI
          if (currentChat && message.chatId === currentChat.id) {
            // Check if this is about the current user
            if (
              user?.username &&
              message.content &&
              message.content.includes(
                `removed admin rights from ${user.username}`
              )
            ) {
              console.log("Current user lost admin rights");
              // Force refresh the chat details immediately
              openChat(currentChat.id);
              // Show notification to the user
              showToast("You are no longer an admin in this group", "info");
            } else if (
              user?.username &&
              message.content &&
              message.content.includes(`made ${user.username} an admin`)
            ) {
              console.log("Current user became an admin");
              // Force refresh the chat details
              openChat(currentChat.id);
              // Show notification to the user
              showToast("You are now an admin in this group", "success");
            } else {
              // Admin change for someone else, just refresh the chat
              openChat(currentChat.id);
            }
          }
        }
      }
    },
    [user, router, currentChat, showToast]
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

    // Reset lazy loading state when opening a new chat
    setHasMoreMessages(true);
    setIsLoadingOlderMessages(false);
    oldestMessageIdRef.current = null;

    try {
      let response;

      // If it's a number, it's a group chat ID
      if (typeof chatIdOrName === "number") {
        // Use the updated API with limit parameter to get only the initial batch of messages
        response = await chatApi.getGroup(
          token,
          chatIdOrName,
          MESSAGES_BATCH_SIZE
        );
      } else {
        // Get only the initial batch of messages for direct chat
        response = await chatApi.getChat(
          token,
          chatIdOrName,
          MESSAGES_BATCH_SIZE
        );
      }

      if (response.status) {
        setCurrentChat(response.chat);

        // Store the initial messages
        const initialMessages = response.messages || [];
        setCurrentMessages(initialMessages);

        // Set the oldest message ID for pagination if we have messages
        if (initialMessages.length > 0) {
          // Find the oldest message by ID
          const oldestMsg = initialMessages.reduce(
            (oldest, current) => (oldest.id < current.id ? oldest : current),
            initialMessages[0]
          );
          oldestMessageIdRef.current = oldestMsg.id;

          // Use the has_more flag from the API response
          setHasMoreMessages(response.has_more || false);
        } else {
          setHasMoreMessages(false);
        }

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
      console.error("Error opening chat:", err);

      // Check if it's a 404 error (user not found)
      const errorMessage =
        err instanceof Error ? err.message : "Failed to open chat";
      const is404 =
        errorMessage.includes("404") ||
        errorMessage.includes("User not found") ||
        errorMessage.toLowerCase().includes("not exist");

      if (is404 && typeof chatIdOrName === "string") {
        // Create a user-friendly error message
        const notFoundMessage = `User "${chatIdOrName}" doesn't exist.`;

        // Show the error toast
        showToast(notFoundMessage, "error");

        // Redirect to /chats page
        router.push("/chats");
      } else {
        // For other errors, just set the error state
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Load older messages function for lazy loading
  const loadOlderMessages = async (): Promise<boolean> => {
    if (
      !token ||
      !currentChat ||
      isLoadingOlderMessages ||
      !hasMoreMessages ||
      oldestMessageIdRef.current === null
    ) {
      return false;
    }

    setIsLoadingOlderMessages(true);

    try {
      // Fetch older messages using the oldest message ID as reference
      const chatId = currentChat.id; // Always use the chat ID, not the name
      const response = await chatApi.getOlderMessages(
        token,
        chatId,
        oldestMessageIdRef.current,
        MESSAGES_BATCH_SIZE
      );

      if (response.status && response.messages) {
        // If no messages returned, we've reached the end
        if (response.messages.length === 0) {
          setHasMoreMessages(false);
          return false;
        }

        // Update the oldest message ID reference
        if (response.messages.length > 0) {
          const newOldestMsg = response.messages.reduce(
            (oldest, current) => (oldest.id < current.id ? oldest : current),
            response.messages[0]
          );
          oldestMessageIdRef.current = newOldestMsg.id;
        }

        // Prepend the older messages to the current messages
        setCurrentMessages((prevMessages) => {
          // Create a set of existing message IDs for faster lookup
          const existingIds = new Set(prevMessages.map((msg) => msg.id));

          // Filter out any duplicate messages
          const newMessages = response.messages.filter(
            (msg) => !existingIds.has(msg.id)
          );

          // Sort all messages by time to ensure correct order
          return [...newMessages, ...prevMessages].sort(
            (a, b) => a.time - b.time
          );
        });

        // Use the has_more flag from the API response if available
        setHasMoreMessages(
          response.has_more !== undefined
            ? response.has_more
            : response.messages.length >= MESSAGES_BATCH_SIZE
        );

        return true;
      }

      return false;
    } catch (err) {
      console.error("Error loading older messages:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load older messages"
      );
      return false;
    } finally {
      setIsLoadingOlderMessages(false);
    }
  };

  const createGroup = async (
    name: string,
    members: string[] = []
  ): Promise<GroupResponse | undefined> => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await chatApi.createGroup(token, name, members);

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

  /**
   * Add a member to a chat
   */
  const addMember = async (
    chatId: number,
    userId: number,
    username: string
  ): Promise<boolean> => {
    if (!token || !currentChat) return false;

    setLoading(true);
    setError(null);

    try {
      const response = await chatApi.addMember(token, chatId, username, "");

      if (response.status) {
        // Create optimistic system message to show immediately
        const systemMessage: ChatMessage = {
          id: Date.now(),
          text: `${user?.username} added ${username} to the group`,
          author: "System",
          time: Math.floor(Date.now() / 1000),
          isDeleted: false,
          isEdited: false,
          isSystem: true,
          isForwarded: false,
          isPending: true,
        };

        // Add system message to chat immediately for better UX
        setCurrentMessages((prev) => [...prev, systemMessage]);

        // Update the member list optimistically
        setCurrentChat((prevChat) => {
          if (!prevChat) return null;

          // Check if user already exists
          const userExists = prevChat.users.some(
            (u) => u.id === userId || u.username === username
          );

          if (userExists) return prevChat;

          // Add the new user to the list
          return {
            ...prevChat,
            users: [
              ...prevChat.users,
              {
                id: userId,
                username: username,
                is_admin: false,
              },
            ],
          };
        });

        // Notify via WebSocket if connected
        if (wsConnected && user) {
          websocketService.sendMemberAdded(chatId, userId, username);
        }

        // Refresh current chat after adding a member to ensure we have the latest state
        await openChat(chatId);

        showToast(`Added ${username} to the chat`, "success");
        return true;
      } else {
        setError("Failed to add member");
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (username: string, message: string) => {
    if (!token || !currentChat) return;

    setLoading(true);
    setError(null);

    try {
      // Find the target user to get their ID before removal
      const targetUser = currentChat.users.find((u) => u.username === username);
      const targetUserId = targetUser?.id;

      const response = await chatApi.removeMember(
        token,
        currentChat.id,
        username,
        message
      );

      if (response.status) {
        // Create optimistic system message to show immediately
        const systemMessage: ChatMessage = {
          id: Date.now(),
          text: `${user?.username} removed ${username} from the group`,
          author: "System",
          time: Math.floor(Date.now() / 1000),
          isDeleted: false,
          isEdited: false,
          isSystem: true,
          isForwarded: false,
          isPending: true,
        };

        // Add system message to chat immediately for better UX
        setCurrentMessages((prev) => [...prev, systemMessage]);

        // Update the member list optimistically
        setCurrentChat((prevChat) => {
          if (!prevChat) return null;
          return {
            ...prevChat,
            users: prevChat.users.filter((u) => u.username !== username),
          };
        });

        // Notify via WebSocket if connected
        if (wsConnected && user && targetUserId) {
          websocketService.sendMemberRemoved(
            currentChat.id,
            targetUserId,
            username
          );
        } else if (wsConnected && user) {
          // If we couldn't find the user ID, use the WebSocket endpoint that can handle just usernames
          websocketService.sendMemberRemoved(
            currentChat.id,
            0, // Backend will resolve from username
            username
          );
        }

        // Refresh current chat after removing a member to ensure we have the latest state
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

  const addAdmin = async (username: string, message: string) => {
    if (!token || !currentChat || !user) return;

    try {
      // Find the target user in the chat member list to get their ID
      const targetUser = currentChat.users.find((u) => u.username === username);

      if (!targetUser) {
        showToast(`User ${username} not found in this chat`, "error");
        return;
      }

      // Send websocket message to change admin status
      if (wsConnected) {
        console.log(`Adding admin ${username} via WebSocket`);

        // Create system message content
        const systemMessage = `${user.username} made ${username} an admin`;

        // Add optimistic message to chat
        const optimisticMsg: ChatMessage = {
          id: Date.now(),
          text: systemMessage,
          author: "System",
          time: Math.floor(Date.now() / 1000),
          isDeleted: false,
          isEdited: false,
          isSystem: true,
          isForwarded: false,
          isPending: true,
        };

        // Add the message optimistically
        setCurrentMessages((prev) => [...prev, optimisticMsg]);

        // Also update the admin status in current chat
        setCurrentChat((prevChat) => {
          if (!prevChat) return null;

          return {
            ...prevChat,
            admins: [...prevChat.admins, username],
          };
        });

        // Send WebSocket message to change admin status
        websocketService.sendAdminStatusChange(
          currentChat.id,
          targetUser.id,
          username,
          true // isPromotion = true
        );

        // Show confirmation toast
        showToast(`${username} is now an admin`, "success");
      } else {
        // Fallback to REST API if WebSocket is not connected
        setLoading(true);
        const response = await chatApi.addAdmin(
          token,
          currentChat.id,
          username,
          message
        );

        if (response.status) {
          // Refresh the chat to get updated admin status
          await openChat(currentChat.id);
        } else {
          showToast("Failed to make user an admin", "error");
        }
        setLoading(false);
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to make user an admin",
        "error"
      );
    }
  };

  const removeAdmin = async (username: string, message: string) => {
    if (!token || !currentChat || !user) return;

    try {
      // Find the target user in the chat member list to get their ID
      const targetUser = currentChat.users.find((u) => u.username === username);

      if (!targetUser) {
        showToast(`User ${username} not found in this chat`, "error");
        return;
      }

      // Send websocket message to change admin status
      if (wsConnected) {
        console.log(`Removing admin ${username} via WebSocket`);

        // Create system message content
        const systemMessage = `${user.username} removed admin rights from ${username}`;

        // Add optimistic message to chat
        const optimisticMsg: ChatMessage = {
          id: Date.now(),
          text: systemMessage,
          author: "System",
          time: Math.floor(Date.now() / 1000),
          isDeleted: false,
          isEdited: false,
          isSystem: true,
          isForwarded: false,
          isPending: true,
        };

        // Add the message optimistically
        setCurrentMessages((prev) => [...prev, optimisticMsg]);

        // Also update the admin status in current chat
        setCurrentChat((prevChat) => {
          if (!prevChat) return null;

          return {
            ...prevChat,
            admins: prevChat.admins.filter((admin) => admin !== username),
          };
        });

        // Send WebSocket message to change admin status
        websocketService.sendAdminStatusChange(
          currentChat.id,
          targetUser.id,
          username,
          false // isPromotion = false
        );

        // Show confirmation toast
        showToast(`${username} is no longer an admin`, "success");
      } else {
        // Fallback to REST API if WebSocket is not connected
        setLoading(true);
        const response = await chatApi.removeAdmin(
          token,
          currentChat.id,
          username,
          message
        );

        if (response.status) {
          // Refresh the chat to get updated admin status
          await openChat(currentChat.id);
        } else {
          showToast("Failed to remove admin status", "error");
        }
        setLoading(false);
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to remove admin status",
        "error"
      );
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
        isPending: true,
      });

      setCurrentMessages((prev) => [...prev, optimisticMessage]);

      // Ensure WebSocket connection is established with the correct user ID
      const isConnected = await websocketService.ensureConnected(
        user.id,
        token
      );

      // Send via WebSocket if connected
      if (isConnected) {
        console.log(
          `Sending message via WebSocket to chat ${currentChat.id}: "${text}"`
        );
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
        addAdmin,
        removeAdmin,
        leaveGroup,
        saveSettings,
        sendMessage,
        editMessage,
        deleteMessage,
        markMessageAsRead,
        sendTypingIndicator,
        loadOlderMessages,
        isLoadingOlderMessages,
        hasMoreMessages,
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
