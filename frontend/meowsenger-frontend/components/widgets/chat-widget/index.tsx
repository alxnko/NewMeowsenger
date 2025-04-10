import { useState, ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { ChatDetails, ChatMessage } from "@/contexts/chat-context";
import Button from "@/components/elements/button";
import Input from "@/components/elements/input";

export interface ChatWidgetProps {
  chat: ChatDetails | null;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  onSendMessage: (message: string) => Promise<void>;
  backUrl?: string;
  headerContent?: ReactNode;
}

export default function ChatWidget({
  chat,
  messages,
  loading,
  error,
  onSendMessage,
  backUrl = "/chats",
  headerContent,
}: ChatWidgetProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [message, setMessage] = useState("");

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      await onSendMessage(message);
      setMessage("");
    }
  };

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
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground lowercase">
            {t("no_messages")}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.author === user?.username
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg ${
                    msg.isSystem
                      ? "bg-neutral-100 dark:bg-neutral-800 italic text-center mx-auto"
                      : msg.author === user?.username
                        ? "bg-success text-white"
                        : "bg-neutral-100 dark:bg-neutral-800"
                  }`}
                >
                  {!msg.isSystem && msg.author !== user?.username && (
                    <div className="text-xs text-muted-foreground mb-1 lowercase">
                      {msg.author}
                    </div>
                  )}
                  <div className="break-words lowercase">
                    {msg.isDeleted ? (
                      <span className="italic text-muted-foreground">
                        {t("this_message_was_deleted")}
                      </span>
                    ) : (
                      msg.text
                    )}
                  </div>
                  <div className="text-xs text-right mt-1 opacity-70 lowercase">
                    {formatDistanceToNow(new Date(msg.time * 1000), {
                      addSuffix: true,
                    })}
                    {msg.isEdited && (
                      <span className="ml-1 italic">({t("edited")})</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <Input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("type_a_message")}
            className="flex-1"
            color="success"
            variant="bordered"
          />
          <Button
            type="submit"
            disabled={!message.trim()}
            color="success"
            size="md"
          >
            {t("send")}
          </Button>
        </form>
      </div>
    </div>
  );
}
