import React, { useEffect, useState, memo, useCallback, useMemo } from "react";
import { tv } from "tailwind-variants";
import { useChat } from "@/contexts/chat-context";
import clsx from "clsx";
import { MessageMenu } from "@/components/elements/message-menu";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { formatRelativeTime, translateSystemMessage } from "@/utils/message-utils";

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
  systemMessageType?: string;
  systemMessageParams?: Record<string, string | number>;
  replyTo?: number;
  replyMessage?: {
    text: string;
    author: string;
  };
  messageId?: number;
  onReply?: () => void;
  onEdit?: () => void;
  className?: string;
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
    systemMessageType,
    systemMessageParams,
    replyTo,
    replyMessage,
    messageId,
    onReply,
    onEdit,
    className,
    isRead = false,
  }: MessageProps) => {
    const { editMessage, deleteMessage } = useChat();
    const { isAdmin } = useAuth();
    const { t } = useLanguage();

    // Memoize the formatted time to avoid unnecessary calculations
    const formattedTime = useMemo(
      () =>
        timestamp
          ? formatRelativeTime(timestamp, t)
          : "",
      [timestamp, t]
    );

    // Memoize event handlers
    const handleEdit = useCallback(() => {
      if (onEdit) {
        onEdit();
      } else if (editMessage && messageId) {
        editMessage(messageId, content);
      }
    }, [editMessage, messageId, content, onEdit]);

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
            {replyMessage.author === sender
              ? t("replying_to_self")
              : t("reply_to_user", { user: replyMessage.author })}
            :
          </span>
          <div className="text-xs opacity-75 truncate">{replyMessage.text}</div>
        </div>
      );
    }, [replyTo, replyMessage, isSystem, isOwn, sender, t]);

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
            {isDeleted
              ? t("message_deleted")
              : isSystem
                ? translateSystemMessage(content, t, systemMessageType, systemMessageParams)
                : content}
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
                {isEdited && !isDeleted && (
                  <span title={t("edited")}>{t("edited_short")}</span>
                )}
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
