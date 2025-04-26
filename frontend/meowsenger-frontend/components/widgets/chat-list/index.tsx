"use client";

import React, { useCallback, memo } from "react";
import { tv } from "tailwind-variants";
import ChatItem from "@/components/elements/chat-item";
import { Input } from "@/components/elements/input";

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
  chats: Chat[];
  activeChat?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

export const ChatList = memo(
  ({ chats, activeChat, onSearch, className }: ChatListProps) => {
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
            placeholder="search chats"
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
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {chats.length > 0 ? (
            chats.map((chat) => (
              <ChatItem
                key={chat.id}
                id={chat.isGroup ? chat.id : chat.name}
                name={chat.name}
                lastMessage={chat.lastMessage}
                timestamp={chat.timestamp}
                isGroup={chat.isGroup}
                active={chat.id === activeChat}
                isUnread={chat.isUnread}
              />
            ))
          ) : (
            <div className="p-4 text-center text-neutral-500 dark:text-neutral-400 lowercase">
              no chats available
            </div>
          )}
        </div>
      </div>
    );
  }
);

ChatList.displayName = "ChatList";

export default ChatList;
