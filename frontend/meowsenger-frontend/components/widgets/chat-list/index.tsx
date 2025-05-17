"use client";

import React, { useCallback, memo, FC } from "react";
import { tv } from "tailwind-variants";
import ChatItem from "@/components/elements/chat-item";
import { Input } from "@/components/elements/input";
import { ChatBlock } from "@/contexts/chat-context";
import { useLanguage } from "@/contexts/language-context";

const chatListStyles = tv({
  base: "flex flex-col h-full",
});

export interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp?: Date;
  isGroup?: boolean;
  isUnread?: boolean;
}

export interface ChatListProps {
  chats: Chat[] | ChatBlock[];
  activeChat?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

interface OptimizedChatItemProps {
  chat: ChatBlock;
  isActive: boolean;
}

// Import the utility function for translating system messages
import { translateSystemMessage } from "@/utils/message-utils";

// Memoized chat item component to prevent unnecessary re-renders
const OptimizedChatItem: FC<OptimizedChatItemProps> = memo(
  ({ chat, isActive }) => {
    const { t } = useLanguage();

    // Format timestamp from lastUpdate string
    const lastUpdate = chat.lastUpdate ? new Date(chat.lastUpdate) : undefined;

    // Extract text and system message details from lastMessage object
    let lastMessageText = "";
    let isSystem = false;
    let systemMessageType = undefined;
    let systemMessageParams = undefined;

    if (typeof chat.lastMessage === "string") {
      lastMessageText = chat.lastMessage;
    } else if (chat.lastMessage) {
      lastMessageText = chat.lastMessage.text || "";
      isSystem = chat.lastMessage.isSystem || false;
      systemMessageType = chat.lastMessage.system_message_type;
      systemMessageParams = chat.lastMessage.system_message_params;
    }

    // Translate the message if needed
    if (lastMessageText) {
      // Always translate system messages, with or without structured data
      if (isSystem) {
        lastMessageText = translateSystemMessage(
          lastMessageText,
          t,
          systemMessageType,
          systemMessageParams
        );
      } else if (lastMessageText === "no messages") {
        // Special case for "no messages"
        lastMessageText = t("no_messages_short");
      }
    } else {
      // If no message, use the default "no messages" translation
      lastMessageText = t("no_messages_short");
    }

    return (
      <ChatItem
        id={String(chat.isGroup ? chat.id : chat.name)}
        name={chat.name}
        lastMessage={lastMessageText}
        timestamp={lastUpdate}
        isGroup={chat.isGroup}
        active={isActive}
        isUnread={chat.isUnread}
      />
    );
  },
  // Custom comparison function to minimize re-renders
  (prevProps, nextProps) => {
    // Only re-render if relevant props change
    return (
      prevProps.chat.id === nextProps.chat.id &&
      prevProps.chat.name === nextProps.chat.name &&
      JSON.stringify(prevProps.chat.lastMessage) ===
        JSON.stringify(nextProps.chat.lastMessage) &&
      prevProps.chat.lastUpdate === nextProps.chat.lastUpdate &&
      prevProps.chat.isUnread === nextProps.chat.isUnread &&
      prevProps.isActive === nextProps.isActive
    );
  }
);

export const ChatList = memo(
  ({ chats, activeChat, onSearch, className }: ChatListProps) => {
    const { t } = useLanguage();

    const handleSearchChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (onSearch) {
          onSearch(e.target.value);
        }
      },
      [onSearch]
    );

    return (
      <div className={chatListStyles({ className })}>
        <div className="p-3 border-b dark:border-neutral-800">
          <Input
            type="search"
            placeholder={t("search_chats")}
            size="sm"
            onChange={handleSearchChange}
            startContent={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            }
          />
        </div>{" "}
        <div className="flex-1 overflow-y-auto p-2">
          {chats.length > 0 ? (
            chats.map((chat) => {
              // Handle both ChatBlock and Chat interfaces
              if ("secret" in chat) {
                // It's a ChatBlock
                return (
                  <OptimizedChatItem
                    key={chat.id}
                    chat={chat as ChatBlock}
                    isActive={
                      activeChat === String(chat.isGroup ? chat.id : chat.name)
                    }
                  />
                );
              } else {
                // It's a Chat
                return (
                  <ChatItem
                    key={chat.id}
                    id={chat.id}
                    name={chat.name}
                    lastMessage={chat.lastMessage}
                    timestamp={chat.timestamp}
                    isGroup={chat.isGroup}
                    active={activeChat === chat.id}
                    isUnread={chat.isUnread}
                  />
                );
              }
            })
          ) : (
            <div className="p-4 text-center text-neutral-500 dark:text-neutral-400 lowercase">
              {t("no_chats_available")}
            </div>
          )}
        </div>
      </div>
    );
  }
);

ChatList.displayName = "ChatList";

export default ChatList;
