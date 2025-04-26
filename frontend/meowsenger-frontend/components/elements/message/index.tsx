import React, { useEffect, useState, memo, useCallback, useMemo } from "react";
import { tv } from "tailwind-variants";
import { formatDistance } from "date-fns";
import { useChat } from "@/contexts/chat-context";
import clsx from "clsx";
import { MessageMenu } from "@/components/elements/message-menu";
import { useAuth } from "@/contexts/auth-context";

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

// Custom hook to find message info to reduce calculations in the component
function useMessageInfo(replyTo?: number, content?: string, sender?: string) {
  const { currentMessages } = useChat();

  // Find the reply message once and memoize it
  const replyInfo = useMemo(() => {
    if (!replyTo || !currentMessages)
      return { replyMessage: null, replyAuthor: null };

    const foundMessage = currentMessages.find((msg) => msg.id === replyTo);
    if (foundMessage) {
      return {
        replyMessage: foundMessage.text,
        replyAuthor: foundMessage.author,
      };
    }
    return { replyMessage: null, replyAuthor: null };
  }, [replyTo, currentMessages]);

  // Find the current message ID
  const messageId = useMemo(() => {
    if (!content || !sender || !currentMessages) return undefined;

    const foundMessage = currentMessages.find(
      (msg) => msg.text === content && msg.author === sender
    );
    return foundMessage?.id;
  }, [content, sender, currentMessages]);

  return {
    ...replyInfo,
    messageId,
  };
}

export const Message = memo(
  ({
    content,
    timestamp,
    sender,
    isOwn = false,
    isPending = false,
    isDeleted = false,
    isEdited = false,
    isSystem = false,
    replyTo,
    onReply,
    className,
    isRead = false,
  }: MessageProps) => {
    const { editMessage, deleteMessage } = useChat();
    const { isAdmin } = useAuth();

    // Use the custom hook to get message data
    const { replyMessage, replyAuthor, messageId } = useMessageInfo(
      replyTo,
      content,
      sender
    );

    // Memoize the formatted time to avoid unnecessary calculations
    const formattedTime = useMemo(
      () =>
        timestamp
          ? formatDistance(new Date(timestamp), new Date(), { addSuffix: true })
          : "",
      [timestamp]
    );

    // Memoize event handlers
    const handleEdit = useCallback(() => {
      if (editMessage && messageId) {
        editMessage(messageId, content);
      }
    }, [editMessage, messageId, content]);

    const handleDelete = useCallback(() => {
      if (deleteMessage && messageId) {
        deleteMessage(messageId);
      }
    }, [deleteMessage, messageId]);

    const handleForward = useCallback(() => {
      // Implement forwarding logic here
      console.log("Forward message:", content);
    }, [content]);

    // Optimized render with useMemo for complex parts
    const replyComponent = useMemo(() => {
      if (!replyTo || !replyMessage || isSystem) return null;

      return (
        <div className={replyStyles({ isOwn })}>
          <span className="font-medium text-xs">
            {replyAuthor === sender
              ? "Replying to self"
              : `Reply to ${replyAuthor}`}
            :
          </span>
          <div className="text-xs opacity-75 truncate">{replyMessage}</div>
        </div>
      );
    }, [replyTo, replyMessage, isSystem, isOwn, replyAuthor, sender]);

    const senderComponent = useMemo(() => {
      if (isOwn || isSystem) return null;

      return (
        <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
          {sender}
        </div>
      );
    }, [isOwn, isSystem, sender]);

    const messageMenu = useMemo(() => {
      if (isSystem || isDeleted || isPending) return null;

      return (
        <div
          className={clsx(
            "absolute top-0 group-hover:opacity-100 transition-opacity",
            isOwn ? "left-[-36px]" : "right-[-36px]"
          )}
        >
          <MessageMenu
            isOwn={isOwn}
            isAdmin={isAdmin}
            messageContent={content}
            onReply={onReply}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onForward={handleForward}
          />
        </div>
      );
    }, [
      isSystem,
      isDeleted,
      isPending,
      isOwn,
      isAdmin,
      content,
      onReply,
      handleEdit,
      handleDelete,
      handleForward,
    ]);

    return (
      <div className={clsx("flex flex-col mb-4", isOwn ? "mr-4" : "ml-4")}>
        <div
          className={messageStyles({
            isOwn,
            isPending,
            isSystem,
            isDeleted,
            className,
          })}
        >
          {replyComponent}
          {senderComponent}

          <p className={`text-sm text-neutral-900 dark:text-neutral-100`}>
            {content}
          </p>

          {!isSystem && (
            <div
              className={clsx(
                "text-xs text-neutral-500 dark:text-neutral-400 mt-1 text-right flex items-center space-x-1 justify-between",
                isOwn ? "flex-row-reverse" : "flex-row"
              )}
            >
              <span className="text-[10px]">{formattedTime}</span>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {isEdited && !isDeleted && <span title="Edited">(edited)</span>}
              </div>
            </div>
          )}

          {messageMenu}
        </div>
      </div>
    );
  }
);

Message.displayName = "Message";

export default Message;
