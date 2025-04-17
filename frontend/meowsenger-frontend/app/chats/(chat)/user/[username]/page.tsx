"use client";

import { useEffect, useState, useCallback } from "react";
import { useChat } from "@/contexts/chat-context";
import { useAuth } from "@/contexts/auth-context";
import { useParams } from "next/navigation";
import ChatWidget from "@/components/widgets/chat-widget";

export default function DirectChatPage() {
  const { username } = useParams();
  const { user } = useAuth();
  const {
    openChat,
    currentChat,
    currentMessages,
    loading,
    error,
    sendMessage,
    markMessageAsRead,
  } = useChat();

  // Track if we have a WebSocket connection
  const [isConnected, setIsConnected] = useState(false);

  // Handle WebSocket connection status changes
  const handleConnectionChange = useCallback((event: StorageEvent) => {
    if (event.key === "ws_connected") {
      setIsConnected(event.newValue === "true");
    }
  }, []);

  useEffect(() => {
    // Set connected status from WebSocket context
    const wsStatus = sessionStorage.getItem("ws_connected");
    setIsConnected(wsStatus === "true");

    // Listen for WebSocket connection status changes
    window.addEventListener("storage", handleConnectionChange);
    return () => window.removeEventListener("storage", handleConnectionChange);
  }, [handleConnectionChange]);

  // Open chat when username changes
  useEffect(() => {
    if (username && typeof username === "string") {
      openChat(username);
    }
  }, [username]);

  if (!user) {
    return <div className="p-4">Please log in to view this chat.</div>;
  }

  return (
    <ChatWidget
      chat={currentChat}
      messages={currentMessages}
      loading={loading}
      error={error}
      onSendMessage={sendMessage}
      onMarkAsRead={markMessageAsRead}
      currentUserId={user.id}
      isConnected={isConnected}
    />
  );
}
