import React, { memo } from "react";
import { tv } from "tailwind-variants";
import Link from "next/link";
import { formatDistance } from "date-fns";

const chatItemStyles = tv({
  base: "flex items-center p-3 rounded-lg transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer lowercase",
  variants: {
    active: {
      true: "bg-green-50 dark:bg-green-900/20",
      false: "",
    },
    isUnread: {
      true: "font-medium",
      false: "",
    },
  },
  defaultVariants: {
    active: false,
    isUnread: false,
  },
});

export interface ChatItemProps {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp?: Date;
  isGroup?: boolean;
  active?: boolean;
  isUnread?: boolean;
  className?: string;
}

export const ChatItem = memo(
  ({
    id,
    name,
    lastMessage,
    timestamp,
    isGroup = false,
    active = false,
    isUnread = false,
    className,
  }: ChatItemProps) => {
    const formattedTime = timestamp
      ? formatDistance(new Date(timestamp), new Date(), { addSuffix: true })
      : "";

    return (
      <Link
        href={`/chats/${isGroup ? "group" : "user"}/${id}`}
        className={chatItemStyles({ active, isUnread, className })}
      >
        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-200 flex items-center justify-center text-green-800">
          {name.charAt(0)}
        </div>
        <div className="ml-3 flex-1 min-w-0">
          <div className="flex justify-between">
            <p
              className={`text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate ${isUnread ? "text-green-600 dark:text-green-400" : ""}`}
            >
              {name}
            </p>
            {timestamp && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {formattedTime}
              </p>
            )}
          </div>
          {lastMessage && (
            <p
              className={`text-xs text-neutral-500 dark:text-neutral-400 truncate ${isUnread ? "text-neutral-700 dark:text-neutral-300" : ""}`}
            >
              {lastMessage}
            </p>
          )}
        </div>
      </Link>
    );
  }
);

ChatItem.displayName = "ChatItem";

export default ChatItem;
