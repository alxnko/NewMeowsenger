import React, { useEffect, useState } from "react";
import { tv } from "tailwind-variants";
import { formatDistance } from "date-fns";
import { useChat } from "@/contexts/chat-context";
import clsx from "clsx";

const messageStyles = tv({
  base: "rounded-lg p-3 max-w-[80%] lowercase relative",
  variants: {
    isOwn: {
      true: "bg-green-100 dark:bg-green-900/30 ml-auto",
      false: "bg-neutral-100 dark:bg-neutral-800 mr-auto",
    },
    isPending: {
      true: "opacity-60",
    },
    isSystem: {
      true: "bg-blue-50 dark:bg-blue-900/20 mx-auto text-center italic text-xs py-2 max-w-[90%]",
    },
    isDeleted: {
      true: "bg-neutral-50 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400 italic",
    },
  },
  defaultVariants: {
    isOwn: false,
    isPending: false,
    isSystem: false,
    isDeleted: false,
  },
  compoundVariants: [
    {
      isSystem: true,
      class: "min-w-0",
    },
    {
      isDeleted: false,
      isSystem: false,
      class: "min-w-[200px]",
    },
  ],
});

const replyStyles = tv({
  base: "text-xs border-l-2 px-2 py-1 mb-2 truncate",
  variants: {
    isOwn: {
      true: "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20",
      false:
        "border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/20",
    },
  },
  defaultVariants: {
    isOwn: false,
  },
});

export interface MessageProps {
  content: string;
  timestamp: Date;
  sender: string;
  isOwn?: boolean;
  isPending?: boolean;
  isRead?: boolean;
  isDeleted?: boolean;
  isEdited?: boolean;
  isSystem?: boolean;
  replyTo?: number;
  onReply?: () => void;
  className?: string;
}

export const Message = ({
  content,
  timestamp,
  sender,
  isOwn = false,
  isPending = false,
  isRead = false,
  isDeleted = false,
  isEdited = false,
  isSystem = false,
  replyTo,
  onReply,
  className,
}: MessageProps) => {
  const { currentMessages } = useChat();
  const [replyMessage, setReplyMessage] = useState<string | null>(null);
  const [replyAuthor, setReplyAuthor] = useState<string | null>(null);

  // Find the message this is replying to (if any)
  useEffect(() => {
    if (replyTo && currentMessages) {
      const foundMessage = currentMessages.find((msg) => msg.id === replyTo);
      if (foundMessage) {
        setReplyMessage(foundMessage.text);
        setReplyAuthor(foundMessage.author);
      }
    }
  }, [replyTo, currentMessages]);

  const formattedTime = timestamp
    ? formatDistance(new Date(timestamp), new Date(), { addSuffix: true })
    : "";

  return (
    <div className="flex flex-col mb-4">
      <div
        className={messageStyles({
          isOwn,
          isPending,
          isSystem,
          isDeleted,
          className,
        })}
        onClick={!isSystem && !isDeleted ? onReply : undefined}
      >
        {/* Reply reference display */}
        {replyTo && replyMessage && !isSystem && (
          <div className={replyStyles({ isOwn })}>
            <span className="font-medium text-xs">
              {replyAuthor === sender
                ? "Replying to self"
                : `Reply to ${replyAuthor}`}
              :
            </span>
            <div className="text-xs opacity-75 truncate">{replyMessage}</div>
          </div>
        )}

        {/* Show the sender name only for messages from others, not your own */}
        {!isOwn && !isSystem && (
          <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
            {sender}
          </div>
        )}

        <p className="text-sm text-neutral-900 dark:text-neutral-100">
          {content}
          {isEdited && !isDeleted && (
            <span
              className="text-xs text-neutral-500 dark:text-neutral-400 ml-1"
              title="Edited"
            >
              (edited)
            </span>
          )}
        </p>

        {!isSystem && (
          <div
            className={clsx(
              "text-xs text-neutral-500 dark:text-neutral-400 mt-1 text-right flex items-center space-x-1",
              isOwn && "justify-end"
            )}
          >
            <span className="text-[10px]">{formattedTime}</span>
          </div>
        )}

        {/* Message actions - only show on hover for non-system messages */}
        {!isSystem && !isDeleted && !isPending && (
          <div className="absolute top-0 right-0 -mt-6 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-neutral-800 rounded-full shadow-sm">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReply?.();
              }}
              className="p-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              title="Reply"
            >
              ↩️
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;
