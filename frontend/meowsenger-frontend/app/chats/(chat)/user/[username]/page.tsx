"use client";

import { useEffect } from "react";
import { useChat } from "@/contexts/chat-context";
import { useAuth } from "@/contexts/auth-context";
import { useParams, useRouter } from "next/navigation";
import ChatWidget from "@/components/widgets/chat-widget";

export default function DirectChatPage() {
  const { username } = useParams();
  const {
    openChat,
    currentChat,
    currentMessages,
    loading,
    error,
    sendMessage,
  } = useChat();

  useEffect(() => {
    if (username) {
      openChat(username as string);
    }
  }, [username]);

  return (
    <ChatWidget
      chat={currentChat}
      messages={currentMessages}
      loading={loading}
      error={error}
      onSendMessage={sendMessage}
    />
  );
}
