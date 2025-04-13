import { useState, ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { ChatDetails, ChatMessage } from "@/contexts/chat-context";
import Button from "@/components/elements/button";
import Input from "@/components/elements/input";
import MessageList from "@/components/widgets/message-list";
import WebSocketStatus from "@/components/elements/websocket-status";

export interface ChatWidgetProps {
  chat: ChatDetails | null;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  onSendMessage: (message: string, replyToId?: number) => Promise<void>;
  onMarkAsRead: (messageId: number) => void;
  currentUserId: number;
  isConnected?: boolean;
  backUrl?: string;
  headerContent?: ReactNode;
}

export default function ChatWidget({
  chat,
  messages,
  loading,
  error,
  onSendMessage,
  onMarkAsRead,
  currentUserId,
  isConnected = true,
  backUrl = "/chats",
  headerContent,
}: ChatWidgetProps) {
  const { user } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="flex justify-center py-10 lowercase text-muted-foreground">
        {t("loading_conversation")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500 mb-4 lowercase">{error}</p>
        <Button as={Link} href={backUrl} variant="ghost" size="sm">
          {t("back_to_chats")}
        </Button>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="text-center py-10">
        <p className="mb-4 lowercase text-muted-foreground">
          {t("conversation_not_found")}
        </p>
        <Button as={Link} href={backUrl} variant="ghost" size="sm">
          {t("back_to_chats")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center justify-between pb-4 border-b dark:border-neutral-800">
        <div className="flex items-center space-x-3">
          <Button
            as={Link}
            href={backUrl}
            variant="light"
            size="sm"
            className="py-1"
          >
            ← {t("back")}
          </Button>
          <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center text-success font-medium">
            {chat.name[0].toLowerCase()}
          </div>
          {headerContent ? (
            headerContent
          ) : (
            <div>
              <div className="flex items-center">
                <h3 className="font-medium lowercase">{chat.name}</h3>
                {chat.isVerified && (
                  <span className="ml-1 text-success">✓</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground lowercase">
                {chat.isAdmin ? t("admin") : ""}
                {chat.isTester && chat.isAdmin ? " • " : ""}
                {chat.isTester ? t("tester") : ""}
              </p>
            </div>
          )}
        </div>

        {/* Connection status indicator */}
        <WebSocketStatus showText={true} size="sm" />
      </div>

      {/* Message list */}
      <div className="flex-1">
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          onSendMessage={onSendMessage}
          onMarkAsRead={onMarkAsRead}
          isConnected={isConnected}
          className="h-full"
        />
      </div>
    </div>
  );
}
