import React, { useEffect, useState, memo, useCallback, useMemo } from "react";
import { tv } from "tailwind-variants";
import { useChat } from "@/contexts/chat-context";
import clsx from "clsx";
import { MessageMenu } from "@/components/elements/message-menu";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import {
  formatRelativeTime,
  translateSystemMessage,
} from "@/utils/message-utils";
import ForwardModal from "@/components/elements/forward-modal";
import { FiEdit2, FiCornerUpRight } from "react-icons/fi";

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
    isForwarded: {
      true: "border-l-4 border-green-400 dark:border-green-600",
    },
  },
  defaultVariants: {
    isOwn: false,
    isPending: false,
    isSystem: false,
    isDeleted: false,
    isForwarded: false,
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
  base: "text-xs border-green-400 dark:border-green-600 bg-green-50/60 dark:bg-green-900/30 border-l-2 px-3 py-2 mb-2 rounded-md shadow-sm relative overflow-hidden",
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
  isForwarded?: boolean;
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
    isForwarded = false,
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
    const { editMessage, deleteMessage, sendMessage, forwardMessage } =
      useChat();
    const { isAdmin } = useAuth();
    const { t } = useLanguage();
    const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);

    // Memoize the formatted time to avoid unnecessary calculations
    const formattedTime = useMemo(
      () => (timestamp ? formatRelativeTime(timestamp, t) : ""),
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
      // Open the forward modal
      setIsForwardModalOpen(true);
    }, []);

    // Handle forwarding to selected chats
    const handleForwardToChats = useCallback(
      async (chatIds: number[]) => {
        if (!sendMessage) return;

        // Create a promise for each chat to forward to
        try {
          // Use the chat context's forwardMessage function, which optimally handles forwarding
          await forwardMessage(content, chatIds);
        } catch (error) {
          console.error("Error forwarding messages:", error);
        }
      },
      [content, forwardMessage]
    );

    // Optimized render with useMemo for complex parts
    const replyComponent = useMemo(() => {
      if (!replyTo || !replyMessage || isSystem) return null;

      return (
        <div className={replyStyles()}>
          <span className="font-medium text-xs text-green-700 dark:text-green-400 flex items-center">
            {replyMessage.author === sender
              ? t("replying_to_self")
              : t("reply_to_user", { user: replyMessage.author })}
          </span>
          <div className="text-xs opacity-80 mt-1 pr-2">
            {replyMessage.text}
          </div>
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

    // Forwarded indicator
    const forwardedIndicator = useMemo(() => {
      if (!isForwarded || isSystem) return null;

      return (
        <div className="text-xs text-neutral-600 dark:text-neutral-300 mb-3 py-1 italic flex items-center font-medium">
          <FiCornerUpRight
            className="mr-1.5 text-green-600 dark:text-green-400"
            size={14}
          />
          {t("forwarded_message")}
        </div>
      );
    }, [isForwarded, isSystem, t]);

    const messageMenu = useMemo(() => {
      if (isSystem || isDeleted || isPending) return null;

      return (
        <div
          className={clsx(
            "absolute top-0 z-20",
            // Improved mobile visibility with touch-specific classes
            "opacity-0 hover:opacity-100 touch:opacity-100",
            // Increased touch target and positioning
            "w-10 h-10 flex items-center justify-center",
            isOwn ? "left-[-40px]" : "right-[-40px]"
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
      <>
        <div
          className={clsx(
            "flex flex-col mb-4 relative",
            isOwn ? "mr-4" : "ml-4"
          )}
        >
          <div
            className={messageStyles({
              isOwn,
              isPending,
              isSystem,
              isDeleted,
              isForwarded,
              className,
            })}
          >
            {replyComponent}
            {senderComponent}
            {forwardedIndicator}
            <p className={`text-sm text-neutral-900 dark:text-neutral-100`}>
              {isDeleted
                ? t("message_deleted")
                : isSystem
                ? translateSystemMessage(
                    content,
                    t,
                    systemMessageType,
                    systemMessageParams
                  )
                : content}
            </p>

            {!isSystem && (
              <div
                className={clsx(
                  "text-xs text-neutral-500 dark:text-neutral-400 mt-1 text-right flex items-center space-x-1 justify-end",
                  isOwn ? "flex-row-reverse" : "flex-row"
                )}
              >
                <span className="text-[10px]">{formattedTime}</span>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center">
                  {isEdited && !isDeleted && (
                    <span title={t("edited")} className="flex items-center">
                      <FiEdit2
                        className="mr-1 text-green-600 dark:text-green-300"
                        size={10}
                      />
                    </span>
                  )}
                </div>
              </div>
            )}

            {messageMenu}
          </div>
        </div>

        {/* Forward Modal */}
        <ForwardModal
          isOpen={isForwardModalOpen}
          onClose={() => setIsForwardModalOpen(false)}
          message={{ text: content, id: messageId }}
          onForward={handleForwardToChats}
        />
      </>
    );
  }
);

Message.displayName = "Message";

export default Message;
