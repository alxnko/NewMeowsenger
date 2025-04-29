import { ReactNode, memo } from "react";
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
  messages,
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
    <div className="flex flex-col h-full">
      <div className="fixed top-0 right-4 left-1 h-14 flex items-center justify-between border-b dark:border-neutral-800">
        <div className="flex items-center space-x-3">
          <Button as={Link} href={backUrl} variant="light" isIconOnly>
            <IoMdArrowRoundBack />
          </Button>
          <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center text-success font-medium">
            {chat.name[0].toLowerCase()}
          </div>
          {headerContent ? (
            headerContent
          ) : (
            <div>
              <div className="flex items-center">
                <h3 className="font-medium lowercase truncate max-w-[calc(100vw-250px)]">
                  {chat.name}
                </h3>
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
        <WebSocketStatus size="sm" />
      </div>

      {/* Message list */}
      <div className="flex-1">
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          onSendMessage={onSendMessage}
          onMarkAsRead={onMarkAsRead}
          isConnected={isConnected}
          className="h-full mt-10"
        />
      </div>
    </div>
  );
};

export default memo(ChatWidget);
