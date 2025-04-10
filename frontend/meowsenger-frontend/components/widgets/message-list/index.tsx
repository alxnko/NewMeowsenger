import React, { useRef, useEffect } from "react";
import { tv } from "tailwind-variants";
import Message from "@/components/elements/message";
import { Input } from "@/components/elements/input";
import { Button } from "@/components/elements/button";

const messageListStyles = tv({
  base: "flex flex-col h-full",
});

export interface MessageData {
  id: string;
  content: string;
  timestamp: Date;
  sender: {
    id: string;
    name: string;
  };
}

export interface MessageListProps {
  messages: MessageData[];
  currentUserId: string;
  onSendMessage: (message: string) => void;
  className?: string;
}

export const MessageList = ({
  messages,
  currentUserId,
  onSendMessage,
  className,
}: MessageListProps) => {
  const [newMessage, setNewMessage] = React.useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage("");
    }
  };

  return (
    <div className={messageListStyles({ className })}>
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length > 0 ? (
          messages.map((message) => (
            <Message
              key={message.id}
              content={message.content}
              timestamp={message.timestamp}
              sender={message.sender.name}
              isOwn={message.sender.id === currentUserId}
            />
          ))
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 lowercase">
            no messages yet. start the conversation!
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t dark:border-neutral-800">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="type a message..."
            className="flex-1"
            aria-label="Message input"
          />
          <Button type="submit" disabled={!newMessage.trim()}>
            send
          </Button>
        </form>
      </div>
    </div>
  );
};

export default MessageList;
