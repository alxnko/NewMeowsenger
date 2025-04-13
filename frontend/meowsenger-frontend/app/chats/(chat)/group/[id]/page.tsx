"use client";

import { useEffect, useState } from "react";
import { useChat } from "@/contexts/chat-context";
import { useAuth } from "@/contexts/auth-context";
import { useParams } from "next/navigation";
import ChatWidget from "@/components/widgets/chat-widget";
import Button from "@/components/elements/button";
import Link from "next/link";

export default function GroupChatPage() {
  const { id } = useParams();
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

  // Track WebSocket connection status
  const [isConnected, setIsConnected] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  useEffect(() => {
    // Set connected status from WebSocket context
    const wsStatus = sessionStorage.getItem("ws_connected");
    setIsConnected(wsStatus === "true");

    // Listen for WebSocket connection status changes
    const handleConnectionChange = (event: StorageEvent) => {
      if (event.key === "ws_connected") {
        setIsConnected(event.newValue === "true");
      }
    };

    window.addEventListener("storage", handleConnectionChange);
    return () => window.removeEventListener("storage", handleConnectionChange);
  }, []);

  useEffect(() => {
    if (id) {
      const groupId = parseInt(id as string);
      if (!isNaN(groupId)) {
        openChat(groupId);
      }
    }
  }, [id]);

  if (!user) {
    return <div className="p-4">Please log in to view this chat.</div>;
  }

  // Custom header content for group chats
  const groupHeaderContent = currentChat ? (
    <div>
      <div className="flex items-center">
        <h3 className="font-medium lowercase">{currentChat.name}</h3>
        {currentChat.isVerified && <span className="ml-1 text-success">✓</span>}
        <Button
          onClick={() => setShowMembers(!showMembers)}
          variant="light"
          size="sm"
          className="ml-2 text-xs h-6 px-1"
        >
          {showMembers
            ? "hide members"
            : currentChat.users?.length === 1
              ? "1 member"
              : `${currentChat.users?.length || 0} members`}
        </Button>
      </div>

      {showMembers && (
        <div className="mt-2 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-md">
          <h4 className="text-xs font-medium mb-1 lowercase">members:</h4>
          <ul className="text-xs space-y-1 lowercase">
            {currentChat.users?.map((user) => (
              <li key={user.id} className="flex items-center">
                {user.username}
                {user.is_admin && (
                  <span className="ml-1 text-success text-xs">(admin)</span>
                )}
                {user.is_verified && (
                  <span className="ml-1 text-success">✓</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-muted-foreground lowercase">
        {currentChat.desc}
      </p>
    </div>
  ) : null;

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
      headerContent={groupHeaderContent}
    />
  );
}
