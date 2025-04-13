import React, { useRef, useEffect } from "react";
import { tv } from "tailwind-variants";
import Message from "@/components/elements/message";
import { Input } from "@/components/elements/input";
import { Button } from "@/components/elements/button";
import { ChatMessage } from "@/contexts/chat-context";

const messageListStyles = tv({
  base: "flex flex-col max-h-[calc(100dvh-90px)]",
});

export interface MessageData {
  id: string | number;
  content: string;
  timestamp: Date;
  sender: {
    id: string | number;
    name: string;
  };
  isPending?: boolean;
  isRead?: boolean;
}

export interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: number;
  onSendMessage: (message: string, replyToId?: number) => void;
  onMarkAsRead: (messageId: number) => void;
  className?: string;
  isConnected?: boolean;
}

export const MessageList = ({
  messages,
  currentUserId,
  onSendMessage,
  onMarkAsRead,
  className,
  isConnected = true,
}: MessageListProps) => {
  const [newMessage, setNewMessage] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<number | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(messages.length);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      scrollToBottom();
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  // Mark messages as read when they appear in the viewport
  useEffect(() => {
    if (!messageContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = Number(
              entry.target.getAttribute("data-message-id")
            );
            if (messageId && !isNaN(messageId)) {
              onMarkAsRead(messageId);
              // Disconnect observation of this message once marked as read
              observer.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    // Observe all message elements that aren't by the current user and aren't read yet
    const messageElements =
      messageContainerRef.current.querySelectorAll("[data-message-id]");
    messageElements.forEach((el) => {
      const messageId = Number(el.getAttribute("data-message-id"));
      const message = messages.find((m) => m.id === messageId);
      if (
        message &&
        String(message.author) !== String(currentUserId) &&
        !message.isRead
      ) {
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [messages, currentUserId, onMarkAsRead]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage, replyTo);
      setNewMessage("");
      setReplyTo(undefined);
    }
  };

  const handleReply = (messageId: number) => {
    setReplyTo(messageId);
  };

  const cancelReply = () => {
    setReplyTo(undefined);
  };

  // Convert ChatMessage to MessageData format for rendering
  const messageDataList: MessageData[] = messages.map((msg) => ({
    id: msg.id,
    content: msg.text,
    timestamp: new Date(msg.time * 1000), // Convert Unix timestamp to Date
    sender: {
      id: msg.author,
      name: typeof msg.author === "string" ? msg.author : `User ${msg.author}`,
    },
    isPending: msg.isPending,
    isRead: msg.isRead,
  }));

  return (
    <div className={messageListStyles({ className })}>
      <div className="flex-1 overflow-y-auto p-4" ref={messageContainerRef}>
        {messageDataList.length > 0 ? (
          messageDataList.map((message) => (
            <div key={message.id} data-message-id={message.id}>
              <Message
                content={message.content}
                timestamp={message.timestamp}
                sender={message.sender.name}
                isOwn={String(message.sender.id) === String(currentUserId)}
                isPending={message.isPending}
                isRead={message.isRead}
                onReply={() => handleReply(Number(message.id))}
              />
            </div>
          ))
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 lowercase">
            no messages yet. start the conversation!
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {replyTo && (
        <div className="px-3 pt-2 border-t dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900">
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            Replying to message #{replyTo}
          </div>
          <Button variant="ghost" size="sm" onClick={cancelReply}>
            ✕
          </Button>
        </div>
      )}

      <div className="pt-3 border-t dark:border-neutral-800">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isConnected ? "type a message..." : "reconnecting..."}
            className="flex-1"
            aria-label="Message input"
            disabled={!isConnected}
          />
          <Button type="submit" disabled={!newMessage.trim() || !isConnected}>
            send
          </Button>
        </form>
      </div>
    </div>
  );
};

export default MessageList;
