import { ReactNode, memo, useEffect } from "react";
import Link from "next/link";
import { IoMdArrowRoundBack } from "react-icons/io";
import { useLanguage } from "@/contexts/language-context";
import { ChatDetails, ChatMessage } from "@/contexts/chat-context";
import Button from "@/components/elements/button";
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

const ChatWidget = ({
  chat,
  messages = [],
  loading,
  error,
  onSendMessage,
  onMarkAsRead,
  currentUserId,
  isConnected = true,
  backUrl = "/chats",
  headerContent,
}: ChatWidgetProps) => {
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
    <div className="flex flex-col">
      <div className="flex items-center justify-between p-2 pt-1 border-b dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <Button
            as={Link}
            href={backUrl}
            isIconOnly
            variant="light"
            className="mr-2"
          >
            <IoMdArrowRoundBack className="text-xl" />
          </Button>
          {headerContent || (
            <h1 className="text-xl font-medium">{chat.name}</h1>
          )}
          <WebSocketStatus size="sm" />
        </div>
      </div>

      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        onSendMessage={onSendMessage}
        onMarkAsRead={onMarkAsRead}
        className="flex-1"
        isConnected={isConnected}
      />
    </div>
  );
};

export default memo(ChatWidget);
