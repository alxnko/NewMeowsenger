import React, { useRef, useEffect, useState } from "react";
import { tv } from "tailwind-variants";
import Message from "@/components/elements/message";
import { Input } from "@/components/elements/input";
import { Button } from "@/components/elements/button";
import { ChatMessage, useChat } from "@/contexts/chat-context";
import { useAuth } from "@/contexts/auth-context";

const messageListStyles = tv({
  base: "flex flex-col max-h-[calc(100dvh-90px)]",
});

// Styles for the scroll button
const scrollButtonStyles = tv({
  base: "fixed bottom-24 right-[50%] left-[50%] rounded-full shadow-lg flex items-center justify-center p-2 transition-all",
  variants: {
    hasNewMessages: {
      true: "bg-green-500 text-white hover:bg-green-600",
      false:
        "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-600",
    },
  },
  defaultVariants: {
    hasNewMessages: false,
  },
});

// New typing indicator styles
const typingIndicatorStyles = tv({
  base: "flex items-center px-3 py-2 text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 rounded-md my-1 shadow-sm",
});

export interface MessageData {
  id: string | number;
  content: string;
  timestamp: Date;
  sender: {
    id: string | number;
    name: string;
  };
  isPending?: boolean;
  isRead?: boolean;
  isDeleted?: boolean;
  isEdited?: boolean;
  isSystem?: boolean;
  replyTo?: number;
}

export interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: number;
  onSendMessage: (message: string, replyToId?: number) => void;
  onMarkAsRead: (messageId: number) => void;
  className?: string;
  isConnected?: boolean;
}

export const MessageList = ({
  messages,
  currentUserId,
  onSendMessage,
  onMarkAsRead,
  className,
  isConnected = true,
}: MessageListProps) => {
  const [newMessage, setNewMessage] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<MessageData | undefined>(
    undefined
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(0); // Has to be 0 to scroll to the bottom on first load
  const { user } = useAuth();
  const { currentChat, typingUsers, sendTypingIndicator } = useChat();
  const typingTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastTypingTimestamp = useRef<number>(0);
  const inputChangeDebounce = useRef<NodeJS.Timeout | undefined>(undefined);
  const [prevMessageIds, setPrevMessageIds] = useState<Set<number>>(new Set());

  // State for scroll button and unread count
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: behavior,
        block: "end",
      });
    }
    // Reset unread count when scrolling to bottom
    setUnreadCount(0);
  };

  // Check if scrolled to bottom
  const isAtBottom = () => {
    const container = messageContainerRef.current;
    if (!container) return true;

    const threshold = 300; // pixels from bottom to be considered "at bottom"
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    );
  };

  // Track message IDs to detect new messages vs confirmed messages
  useEffect(() => {
    // Create a set of message IDs from the current messages
    const currentMessageIds = new Set(messages.map((msg) => msg.id));

    // Find any confirmed messages (non-pending) that have replaced pending ones
    const confirmedMessageIds = new Set<number>();

    messages.forEach((msg) => {
      if (!msg.isPending && !prevMessageIds.has(msg.id)) {
        // This is a new confirmed message from server
        // Check if it replaces a pending message from current user
        const pendingMessage = messages.find(
          (m) =>
            m.isPending && m.author === user?.username && m.text === msg.text
        );

        if (pendingMessage) {
          confirmedMessageIds.add(pendingMessage.id as number);
        }
      }
    });

    setPrevMessageIds(currentMessageIds);

    // If we detected any confirmed messages, adjust prevMessagesLength
    // to avoid treating them as new messages for scrolling
    if (confirmedMessageIds.size > 0) {
      prevMessagesLength.current = messages.length - confirmedMessageIds.size;
    }
  }, [messages, user?.username]);

  // Track new messages and update scroll/unread state
  useEffect(() => {
    const container = messageContainerRef.current;
    if (!container) return;

    // Special case for first load - always scroll to bottom
    if (prevMessagesLength.current === 0) {
      scrollToBottom();
      prevMessagesLength.current = messages.length;
      return;
    }

    // No new messages
    if (messages.length <= prevMessagesLength.current) {
      prevMessagesLength.current = messages.length;
      return;
    }

    // If already at bottom, scroll to bottom automatically
    if (isAtBottom()) {
      scrollToBottom();
    } else {
      // Otherwise, increment unread count
      const newMessages = messages.length - prevMessagesLength.current;
      setUnreadCount((prev) => prev + newMessages);
    }

    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom when someone is typing if user is already at the bottom
  useEffect(() => {
    if (currentlyTypingUsers.length > 0 && isAtBottom()) {
      scrollToBottom();
    }
  }, [typingUsers]); // React to changes in the typing users

  // Monitor scroll position to show/hide scroll button
  useEffect(() => {
    const container = messageContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Only show the scroll button when we're not at the bottom
      const scrollPosition =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const shouldShowButton = scrollPosition > 100; // Lower threshold to show button earlier when scrolling up
      setShowScrollButton(shouldShowButton);
    };

    // Add the scroll event listener
    container.addEventListener("scroll", handleScroll);

    // Run once on mount to set initial state
    handleScroll();

    // Also update button visibility when messages change
    const messageUpdateCheck = setInterval(handleScroll, 300);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      clearInterval(messageUpdateCheck);
    };
  }, []);

  // Mark messages as read when they appear in the viewport
  useEffect(() => {
    if (!messageContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = Number(
              entry.target.getAttribute("data-message-id")
            );
            if (messageId && !isNaN(messageId)) {
              onMarkAsRead(messageId);
              // Disconnect observation of this message once marked as read
              observer.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    // Observe all message elements that aren't by the current user and aren't read yet
    const messageElements =
      messageContainerRef.current.querySelectorAll("[data-message-id]");
    messageElements.forEach((el) => {
      const messageId = Number(el.getAttribute("data-message-id"));
      const message = messages.find((m) => m.id === messageId);
      if (
        message &&
        String(message.author) !== String(currentUserId) &&
        !message.isRead
      ) {
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [messages, currentUserId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      // Save scroll position information before updating
      const container = messageContainerRef.current;
      const wasAtBottom = isAtBottom();

      // Send the message
      onSendMessage(newMessage, Number(replyTo?.id));
      setNewMessage("");
      setReplyTo(undefined);

      // Manually scroll only if we were already at the bottom or close to it
      if (wasAtBottom) {
        // Use requestAnimationFrame to ensure DOM is updated first
        requestAnimationFrame(() => {
          // Use a second RAF to ensure the browser has had time to process the first one
          requestAnimationFrame(() => {
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          });
        });
      }
    }
  };

  const handleReply = (message: MessageData) => {
    setReplyTo(message);
  };

  const cancelReply = () => {
    setReplyTo(undefined);
  };

  // Handle typing indicator with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    // Clear existing debounce timeout
    if (inputChangeDebounce.current) {
      clearTimeout(inputChangeDebounce.current);
    }

    // Only process typing indicators if there's content and a chat is open
    if (value.trim() && currentChat) {
      // Debounce the typing indicator logic
      inputChangeDebounce.current = setTimeout(() => {
        const now = Date.now();
        // Only send typing indicator every 3 seconds to reduce traffic further
        if (now - lastTypingTimestamp.current > 3000) {
          sendTypingIndicator(currentChat.id);
          lastTypingTimestamp.current = now;
        }
      }, 300); // Wait 300ms before processing to reduce frequent state updates

      // Auto-clear typing status after inactivity
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
      typingTimeout.current = setTimeout(() => {
        // Typing stopped - no need to do anything as the backend
        // will timeout typing status automatically
      }, 5000);
    }
  };

  // Convert ChatMessage to MessageData format for rendering
  const messageDataList: MessageData[] = messages.map((msg) => ({
    id: msg.id,
    content: msg.text,
    timestamp: new Date(msg.time * 1000), // Convert Unix timestamp to Date
    sender: {
      id: msg.author,
      name: typeof msg.author === "string" ? msg.author : `User ${msg.author}`,
    },
    isPending: msg.isPending,
    isRead: msg.isRead,
    isDeleted: msg.isDeleted,
    isEdited: msg.isEdited,
    isSystem: msg.isSystem,
    replyTo: msg.replyTo,
  }));

  // Filter out typing users who are currently typing and not the current user
  const currentlyTypingUsers = typingUsers.filter(
    (user) => user.userId !== currentUserId
  );

  return (
    <div className={messageListStyles({ className })}>
      <div
        className="flex-1 overflow-y-auto p-4 relative"
        ref={messageContainerRef}
      >
        {messageDataList.length > 0 ? (
          messageDataList.map((message) => {
            return (
              <div key={message.id} data-message-id={message.id}>
                <Message
                  content={message.content}
                  timestamp={message.timestamp}
                  sender={message.sender.name}
                  isOwn={message.sender.name === user?.username}
                  isPending={message.isPending}
                  isRead={message.isRead}
                  isEdited={message.isEdited}
                  isSystem={message.isSystem}
                  replyTo={message.replyTo}
                  onReply={() => handleReply(message)}
                />
              </div>
            );
          })
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 lowercase">
            no messages yet. start the conversation!
          </div>
        )}

        {/* Typing indicator */}
        {currentlyTypingUsers.length > 0 && (
          <div className={typingIndicatorStyles()}>
            {currentlyTypingUsers.length === 1 ? (
              <>
                <div className="flex space-x-1 mr-2">
                  <span className="animate-bounce text-green-500 dark:text-green-400">
                    •
                  </span>
                  <span className="animate-bounce delay-75 text-green-500 dark:text-green-400">
                    •
                  </span>
                  <span className="animate-bounce delay-150 text-green-500 dark:text-green-400">
                    •
                  </span>
                </div>
                <span>{currentlyTypingUsers[0].username} is typing...</span>
              </>
            ) : (
              <>
                <div className="flex space-x-1 mr-2">
                  <span className="animate-bounce text-green-500 dark:text-green-400">
                    •
                  </span>
                  <span className="animate-bounce delay-75 text-green-500 dark:text-green-400">
                    •
                  </span>
                  <span className="animate-bounce delay-150 text-green-500 dark:text-green-400">
                    •
                  </span>
                </div>
                <span>{currentlyTypingUsers.length} people are typing...</span>
              </>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />

        {/* Scroll-to-bottom button */}
        {showScrollButton && (
          <Button
            className={scrollButtonStyles({ hasNewMessages: unreadCount > 0 })}
            isIconOnly
            aria-label="Scroll to bottom"
            onClick={() => scrollToBottom()}
            size="sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M8 4a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.293V4.5A.5.5 0 0 1 8 4z" />
            </svg>

            {unreadCount > 0 && unreadCount > 99 ? "99+" : unreadCount}
          </Button>
        )}
      </div>

      {replyTo && (
        <div className="px-3 pt-2 border-t dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900">
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            Replying to {replyTo.sender.name}: "{replyTo.content}"
          </div>
          <Button variant="ghost" size="sm" onClick={cancelReply}>
            ✕
          </Button>
        </div>
      )}

      <div className="pt-3 border-t dark:border-neutral-800">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={handleInputChange}
            placeholder={isConnected ? "type a message..." : "reconnecting..."}
            className="flex-1"
            aria-label="Message input"
            disabled={!isConnected}
          />
          <Button type="submit" disabled={!newMessage.trim() || !isConnected}>
            send
          </Button>
        </form>
      </div>
    </div>
  );
};

export default MessageList;
