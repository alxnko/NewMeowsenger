import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  memo,
} from "react";
import { tv } from "tailwind-variants";
import Message from "@/components/elements/message";
import { Input } from "@/components/elements/input";
import { Button } from "@/components/elements/button";
import { ChatMessage, useChat } from "@/contexts/chat-context";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import clsx from "clsx";
import { BiSolidSend } from "react-icons/bi";
import { FiX } from "react-icons/fi";

// Styles remain the same
const messageListStyles = tv({
  base: "flex flex-col min-h-[calc(100dvh-90px)] max-h-[calc(100dvh-90px)]",
});

// Styles for the scroll button
const scrollButtonStyles = tv({
  base: "fixed right-[50%] left-[50%] rounded-full shadow-lg flex items-center justify-center p-2 transition-all",
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

// Typing indicator styles with simplified animation
const typingIndicatorStyles = tv({
  base: "flex items-center px-3 py-2 text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 rounded-md my-1 shadow-sm",
});

// Loading indicator styles
const loadingIndicatorStyles = tv({
  base: "flex items-center justify-center p-2 text-sm text-neutral-500 dark:text-neutral-400",
});

// Edit indicator styles
const editIndicatorStyles = tv({
  base: "flex items-center px-3 py-2 text-xs text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/60 border border-amber-100 dark:border-amber-800 rounded-md my-1 shadow-sm",
});

// Constants for typing debounce values
const TYPING_INDICATOR_INTERVAL = 2000; // How often to send typing notifications
const TYPING_INDICATOR_TIMEOUT = 5000; // How long typing status should remain active
const SCROLL_THROTTLE_MS = 150; // Throttle scroll events
const SCROLL_TOP_THRESHOLD = 100; // Threshold in pixels from the top to trigger loading older messages

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
  isForwarded?: boolean;
  systemMessageType?: string;
  systemMessageParams?: Record<string, string | number>;
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

// Memoized Message component to prevent unnecessary renders
const MemoizedMessage = memo(
  ({
    message,
    username,
    onReply,
    onEdit,
  }: {
    message: MessageData & {
      messageId: number;
      replyMessage?: {
        text: string;
        author: string;
      };
    };
    username: string | undefined;
    onReply: (message: MessageData) => void;
    onEdit: (message: MessageData) => void;
  }) => {
    // Correctly determine if the message is from the current user
    const isOwnMessage = Boolean(username && message.sender.name === username);

    return (
      <Message
        content={message.content}
        timestamp={message.timestamp}
        sender={message.sender.name}
        isOwn={isOwnMessage}
        isPending={message.isPending}
        isRead={message.isRead}
        isEdited={message.isEdited}
        isForwarded={message.isForwarded}
        isSystem={message.isSystem}
        systemMessageType={message.systemMessageType}
        systemMessageParams={message.systemMessageParams}
        replyTo={message.replyTo}
        replyMessage={message.replyMessage}
        messageId={message.messageId}
        onReply={() => onReply(message)}
        onEdit={() => onEdit(message)}
      />
    );
  }
);

MemoizedMessage.displayName = "MemoizedMessage";

export const MessageList = memo(
  ({
    messages = [],
    currentUserId,
    onSendMessage,
    onMarkAsRead,
    className,
    isConnected = true,
  }: MessageListProps) => {
    const [newMessage, setNewMessage] = useState("");
    const [replyTo, setReplyTo] = useState<MessageData | undefined>(undefined);
    const [editMessage, setEditMessage] = useState<MessageData | undefined>(
      undefined
    );
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messageContainerRef = useRef<HTMLDivElement>(null);
    const prevMessagesLength = useRef(0);
    const { user } = useAuth();
    const {
      currentChat,
      typingUsers,
      sendTypingIndicator,
      loadOlderMessages,
      isLoadingOlderMessages,
      hasMoreMessages,
      editMessage: updateMessage,
    } = useChat();
    const { t } = useLanguage();
    const typingTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
    const lastTypingTimestamp = useRef<number>(0);
    const inputChangeDebounce = useRef<NodeJS.Timeout | undefined>(undefined);
    const shouldSendTypingRef = useRef<boolean>(true);
    const [prevMessageIds, setPrevMessageIds] = useState<Set<number>>(
      new Set()
    );
    const scrollHandlerRef = useRef<NodeJS.Timeout | null>(null);
    const lastScrollPositionRef = useRef<number>(0);
    const scrollHeightBeforeLoadRef = useRef<number>(0);

    // State for scroll button and unread count
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Prevent loading messages multiple times in succession
    const isLoadingRef = useRef(false);

    // Ensure messages is always an array
    const safeMessages = Array.isArray(messages) ? messages : [];

    // Create a map of messages for faster lookup
    const messagesMap = useMemo(() => {
      const map = new Map();
      safeMessages.forEach((msg) => {
        map.set(msg.id, msg);
      });
      return map;
    }, [safeMessages]);

    // Get reply message info
    const getReplyMessageInfo = useCallback(
      (replyId: number) => {
        const msg = messagesMap.get(replyId);
        if (!msg) return undefined;

        return {
          text: msg.text,
          author: msg.author,
        };
      },
      [messagesMap]
    );

    // Memoize message data conversion to avoid recalculation on every render
    const messageDataList = useMemo(
      () =>
        safeMessages.map((msg) => ({
          id: msg.id,
          content: msg.text,
          timestamp: new Date(msg.time * 1000),
          sender: {
            id: msg.author,
            name:
              typeof msg.author === "string"
                ? msg.author
                : `User ${msg.author}`,
          },
          isPending: msg.isPending,
          isRead: msg.isRead,
          isDeleted: msg.isDeleted,
          isEdited: msg.isEdited,
          isSystem: msg.isSystem,
          isForwarded: msg.isForwarded,
          systemMessageType: msg.system_message_type,
          systemMessageParams: msg.system_message_params,
          replyTo: msg.replyTo,
          messageId: msg.id,
          replyMessage: msg.replyTo
            ? getReplyMessageInfo(msg.replyTo)
            : undefined,
        })),
      [safeMessages, getReplyMessageInfo]
    );

    // Set input focus when editing message
    useEffect(() => {
      if (editMessage) {
        setNewMessage(editMessage.content);
      }
    }, [editMessage]);

    // Memoized functions to prevent recreating them on each render
    const scrollToBottom = useCallback(
      (behavior: ScrollBehavior = "smooth") => {
        if (messagesEndRef.current) {
          // Using scrollIntoView with messagesEndRef is more reliable for scrolling
          // This provides consistent behavior across different browsers and situations
          messagesEndRef.current.scrollIntoView({
            behavior: behavior,
            block: "end",
          });

          // Also explicitly set scrollTop as a fallback to ensure scroll happens
          const container = messageContainerRef.current;
          if (container) {
            // Use RAF to ensure this happens after any layout calculations
            requestAnimationFrame(() => {
              container.scrollTop = container.scrollHeight;
            });
          }
        }
        // Reset unread count when scrolling to bottom
        setUnreadCount(0);
      },
      []
    );

    // Check if scrolled to bottom
    const isAtBottom = useCallback(() => {
      const container = messageContainerRef.current;
      if (!container) return true;

      const threshold = 300; // pixels from bottom to be considered "at bottom"
      return (
        container.scrollHeight - container.scrollTop - container.clientHeight <
        threshold
      );
    }, []);

    // Check if scrolled near top to load older messages
    const isNearTop = useCallback(() => {
      const container = messageContainerRef.current;
      if (!container) return false;

      return container.scrollTop < SCROLL_TOP_THRESHOLD;
    }, []);

    // Handle loading more messages when scrolling to the top
    const handleLoadMoreMessages = useCallback(async () => {
      if (isLoadingRef.current || !hasMoreMessages || isLoadingOlderMessages)
        return;

      isLoadingRef.current = true;

      // Store current scroll height and position
      const container = messageContainerRef.current;
      if (container) {
        scrollHeightBeforeLoadRef.current = container.scrollHeight;
        lastScrollPositionRef.current = container.scrollTop;
      }

      try {
        // Load older messages
        await loadOlderMessages();

        // After messages are loaded, restore scroll position
        requestAnimationFrame(() => {
          if (container && scrollHeightBeforeLoadRef.current > 0) {
            // Calculate new position: maintain same view of messages
            const newScrollHeight = container.scrollHeight;
            const scrollDifference =
              newScrollHeight - scrollHeightBeforeLoadRef.current;
            container.scrollTop =
              lastScrollPositionRef.current + scrollDifference;
          }

          // Reset the ref
          isLoadingRef.current = false;
        });
      } catch (error) {
        console.error("Error loading more messages:", error);
        isLoadingRef.current = false;
      }
    }, [hasMoreMessages, isLoadingOlderMessages, loadOlderMessages]);

    // Track message IDs to detect new messages vs confirmed messages
    useEffect(() => {
      const currentMessageIds = new Set(messages.map((msg) => msg.id));
      const confirmedMessageIds = new Set<number>();

      messages.forEach((msg) => {
        if (!msg.isPending && !prevMessageIds.has(msg.id)) {
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
        scrollToBottom("auto"); // Use "auto" for better initial performance
        prevMessagesLength.current = messages.length;
        return;
      }

      // No new messages
      if (messages.length <= prevMessagesLength.current) {
        prevMessagesLength.current = messages.length;
        return;
      }

      // Check if there are any non-pending messages from the current user among the new messages
      // This means a message was confirmed by the server
      const newMessages = messages.slice(prevMessagesLength.current);
      const hasConfirmedUserMessage = newMessages.some(
        (msg) => !msg.isPending && msg.author === user?.username
      );

      // If we found a confirmed user message, always scroll to bottom to show it
      // This ensures the sender scrolls to their new message
      if (hasConfirmedUserMessage) {
        scrollToBottom();
      } else if (isAtBottom()) {
        // For other cases (messages from others), only scroll if already at bottom
        scrollToBottom();
      } else {
        // Otherwise, increment unread count
        const newMessagesCount = messages.length - prevMessagesLength.current;
        setUnreadCount((prev) => prev + newMessagesCount);
      }

      prevMessagesLength.current = messages.length;
    }, [messages.length, isAtBottom, scrollToBottom, user?.username]);

    // Scroll to bottom when someone is typing if user is already at the bottom
    useEffect(() => {
      if (typingUsers.length > 0 && isAtBottom()) {
        scrollToBottom();
      }
    }, [typingUsers, isAtBottom, scrollToBottom]);

    // Scroll handler with improved throttling and lazy loading support
    useEffect(() => {
      const container = messageContainerRef.current;
      if (!container) return;

      const handleScroll = () => {
        if (scrollHandlerRef.current) return; // Already processing

        scrollHandlerRef.current = setTimeout(() => {
          // Check for showing scroll-to-bottom button
          const scrollPosition =
            container.scrollHeight -
            container.scrollTop -
            container.clientHeight;
          const shouldShowButton = scrollPosition > 100;
          setShowScrollButton(shouldShowButton);

          // Check if we need to load more messages (near top)
          if (
            isNearTop() &&
            hasMoreMessages &&
            !isLoadingOlderMessages &&
            !isLoadingRef.current
          ) {
            handleLoadMoreMessages();
          }

          scrollHandlerRef.current = null;
        }, SCROLL_THROTTLE_MS);
      };

      container.addEventListener("scroll", handleScroll);
      handleScroll(); // Initial check

      return () => {
        container.removeEventListener("scroll", handleScroll);
        if (scrollHandlerRef.current) {
          clearTimeout(scrollHandlerRef.current);
        }
      };
    }, [
      isNearTop,
      hasMoreMessages,
      isLoadingOlderMessages,
      handleLoadMoreMessages,
    ]);

    // Optimized message read tracking with IntersectionObserver
    useEffect(() => {
      if (!messageContainerRef.current) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const messagesToMark = new Set<number>();

          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const messageId = Number(
                entry.target.getAttribute("data-message-id")
              );
              if (messageId && !isNaN(messageId)) {
                messagesToMark.add(messageId);
                observer.unobserve(entry.target);
              }
            }
          });

          if (messagesToMark.size > 0) {
            // Batch mark messages as read to reduce function calls
            messagesToMark.forEach(onMarkAsRead);
          }
        },
        { threshold: 0.5, rootMargin: "0px 0px 100px 0px" } // Expand the bottom margin to mark messages as read earlier
      );

      // Only observe messages that need to be marked as read
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
    }, [messages, currentUserId, onMarkAsRead]);

    const handleSendMessage = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim()) {
          const container = messageContainerRef.current;
          // Always scroll to bottom after sending a message, regardless of current position
          // This ensures consistent behavior for both sender and receiver

          if (editMessage) {
            // Update existing message
            updateMessage(Number(editMessage.id), newMessage);
            setEditMessage(undefined);
          } else {
            // Send new message
            onSendMessage(newMessage, Number(replyTo?.id));
          }

          setNewMessage("");
          setReplyTo(undefined);

          // Use requestAnimationFrame to ensure the DOM has updated
          // before attempting to scroll to the bottom
          requestAnimationFrame(() => {
            scrollToBottom("auto");
          });
        }
      },
      [
        newMessage,
        replyTo,
        editMessage,
        onSendMessage,
        updateMessage,
        scrollToBottom,
      ]
    );

    const handleReply = useCallback(
      (message: MessageData) => {
        setReplyTo(message);
        // Clear any edit state when replying
        if (editMessage) {
          setEditMessage(undefined);
          setNewMessage("");
        }
      },
      [editMessage]
    );

    const handleEdit = useCallback(
      (message: MessageData) => {
        setEditMessage(message);
        // Clear any reply state when editing
        if (replyTo) {
          setReplyTo(undefined);
        }
      },
      [replyTo]
    );

    const cancelReply = useCallback(() => {
      setReplyTo(undefined);
    }, []);

    const cancelEdit = useCallback(() => {
      setEditMessage(undefined);
      setNewMessage("");
    }, []);

    // Optimized input change handler with better debouncing
    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewMessage(value);

        if (inputChangeDebounce.current) {
          clearTimeout(inputChangeDebounce.current);
        }

        // Only process typing indicator logic if necessary
        if (value.trim() && currentChat && !editMessage) {
          inputChangeDebounce.current = setTimeout(() => {
            const now = Date.now();
            const timeSinceLastTyping = now - lastTypingTimestamp.current;

            if (
              shouldSendTypingRef.current &&
              timeSinceLastTyping > TYPING_INDICATOR_INTERVAL
            ) {
              lastTypingTimestamp.current = now;
              shouldSendTypingRef.current = false;

              // Send typing indicator
              sendTypingIndicator(currentChat.id);

              // Reset the flag after interval
              setTimeout(() => {
                shouldSendTypingRef.current = true;
              }, TYPING_INDICATOR_INTERVAL);
            }

            if (typingTimeout.current) {
              clearTimeout(typingTimeout.current);
            }

            typingTimeout.current = setTimeout(() => {
              // Auto-clearing timeout
            }, TYPING_INDICATOR_TIMEOUT);
          }, 100);
        }
      },
      [currentChat, sendTypingIndicator, editMessage]
    );

    // Filter typing users once and memoize
    const currentlyTypingUsers = useMemo(
      () => typingUsers.filter((user) => user.userId !== currentUserId),
      [typingUsers, currentUserId]
    );

    // Memoize typing indicator component
    const typingIndicator = useMemo(() => {
      if (currentlyTypingUsers.length === 0) return null;

      const dotIndicator = (
        <span className="text-green-500 dark:text-green-400 inline-block">
          •••
        </span>
      );

      return (
        <div className={typingIndicatorStyles()}>
          {currentlyTypingUsers.length === 1 ? (
            <>
              <div className="flex mr-2">{dotIndicator}</div>
              <span>
                {currentlyTypingUsers[0].username} {t("is_typing")}
              </span>
            </>
          ) : (
            <>
              <div className="flex mr-2">{dotIndicator}</div>
              <span>
                {t("are_typing", { count: currentlyTypingUsers.length })}
              </span>
            </>
          )}
        </div>
      );
    }, [currentlyTypingUsers, t]);

    // Edit indicator component
    const editIndicator = useMemo(() => {
      if (!editMessage) return null;

      return (
        <div className={editIndicatorStyles()}>
          <span>{t("editing_message", { message: editMessage.content })}</span>
        </div>
      );
    }, [editMessage, t]);

    // Memoize scroll button click handler
    const handleScrollButtonClick = useCallback(
      () => scrollToBottom(),
      [scrollToBottom]
    );

    // Loading indicator for older messages
    const loadingIndicator = useMemo(() => {
      if (!isLoadingOlderMessages) return null;

      return (
        <div className={loadingIndicatorStyles()}>
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary mx-auto mr-2"></div>
          <span>{t("loading_older_messages")}</span>
        </div>
      );
    }, [isLoadingOlderMessages, t]);

    // Helper to truncate message
    const getSnippet = (msg: string, max = 60) =>
      msg.length > max ? msg.slice(0, max) + "…" : msg;

    return (
      <div className={messageListStyles({ className })}>
        <div
          className={clsx(
            "flex-1 overflow-y-auto relative will-change-transform"
          )}
          ref={messageContainerRef}
        >
          {/* Loading indicator for older messages */}
          {loadingIndicator}

          {/* Load more button (only shown when there are more messages and not currently loading) */}
          {hasMoreMessages &&
            !isLoadingOlderMessages &&
            messageDataList.length > 0 && (
              <div className="flex justify-center my-2">
                <Button
                  size="sm"
                  variant="light"
                  onClick={handleLoadMoreMessages}
                  disabled={isLoadingOlderMessages}
                >
                  {t("load_older_messages")}
                </Button>
              </div>
            )}

          {messageDataList.length > 0 ? (
            messageDataList.map((message) => (
              <div key={message.id} data-message-id={message.id}>
                <MemoizedMessage
                  message={message}
                  username={user?.username}
                  onReply={handleReply}
                  onEdit={handleEdit}
                />
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 lowercase">
              {t("no_messages")}
            </div>
          )}

          {typingIndicator}

          {showScrollButton && (
            <Button
              className={clsx(
                scrollButtonStyles({ hasNewMessages: unreadCount > 0 }),
                replyTo || editMessage ? "bottom-32" : "bottom-16"
              )}
              isIconOnly
              aria-label={t("scroll_to_bottom")}
              onClick={handleScrollButtonClick}
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
          <div ref={messagesEndRef} />
        </div>

        {/* Reply indicator (now above the input bar) */}
        {replyTo && (
          <div className="px-4 pt-2 border-t border-b dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 flex items-center justify-between">
            <div className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
              <span className="font-medium text-green-600 dark:text-green-400">
                {t("replying_to")} {replyTo.sender.name}:
              </span>
              <span className="ml-2 text-neutral-500 dark:text-neutral-400">
                {getSnippet(replyTo.content)}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={cancelReply}>
              <FiX />
            </Button>
          </div>
        )}

        {/* Edit indicator (if editing) - moved above input */}
        {editMessage && (
          <div className="px-4 pt-2 border-t border-b dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 flex items-center justify-between">
            <div className="text-sm text-amber-600 dark:text-amber-400 truncate">
              {t("editing_message", {
                message: getSnippet(editMessage.content),
              })}
            </div>
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              <FiX />
            </Button>
          </div>
        )}

        {/* Message input */}
        <div className="p-2 pb-0 border-t dark:border-neutral-800">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              placeholder={
                editMessage ? t("edit_your_message") : t("type_a_message")
              }
              className="flex-1"
              disabled={!isConnected}
            />
            <Button type="submit" disabled={!isConnected || !newMessage.trim()}>
              <BiSolidSend />
            </Button>
          </form>
        </div>
      </div>
    );
  }
);

MessageList.displayName = "MessageList";

export default MessageList;
