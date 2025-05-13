"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useChat } from "@/contexts/chat-context";
import { ChatList } from "@/components/widgets/chat-list";
import { Button } from "@/components/elements/button";
import CreateChatModal from "@/components/widgets/create-chat-modal";
import { Toast } from "@/components/elements/toast";
import { ProtectedRoute } from "@/components/elements/protected-route";
import WebSocketStatus from "@/components/elements/websocket-status";

export default function ChatsPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const {
    chats,
    loading: chatsLoading,
    fetchChats,
    error,
    openChat,
    createGroup,
  } = useChat();
  const [filteredChats, setFilteredChats] = useState(chats);
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "info",
  });
  // Update filtered chats when chats change or search query changes
  useEffect(() => {
    if (searchQuery) {
      const filtered = chats.filter((chat) =>
        chat.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredChats(filtered);
    } else {
      setFilteredChats(chats);
    }
  }, [chats, searchQuery]);
  // Automatically refresh chats when WebSocket messages are received
  const webSocketUpdateRef = useRef<{
    timer: NodeJS.Timeout | null;
    lastUpdateTime: number;
  }>({
    timer: null,
    lastUpdateTime: 0,
  });

  useEffect(() => {
    // Enhanced WebSocket event handler with smarter debouncing
    const handleWebSocketEvent = (e: Event) => {
      const now = Date.now();
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail || {};
      const eventType = detail.type || "unknown";

      // Clear any existing timer
      if (webSocketUpdateRef.current.timer) {
        clearTimeout(webSocketUpdateRef.current.timer);
      }

      // Rate limiting - prevent excessive refreshes
      const timeSinceLastUpdate =
        now - webSocketUpdateRef.current.lastUpdateTime;

      // Set different debounce times based on event type
      let debounceTime = 300; // default debounce

      // Different event types might need different priorities
      if (eventType === "chat_update" || eventType === "member_removed") {
        debounceTime = 200; // higher priority events
      } else if (eventType === "fetch_chats") {
        // Don't refresh if we just did a fetch within 1 second
        if (timeSinceLastUpdate < 1000) {
          console.log("Skipping redundant chat refresh:", eventType);
          return;
        }
      }

      console.log(
        `WebSocket event (${eventType}) will trigger chat refresh in ${debounceTime}ms`
      );

      // Schedule the refresh
      webSocketUpdateRef.current.timer = setTimeout(() => {
        console.log(`Refreshing chat list due to ${eventType} event`);
        fetchChats();
        webSocketUpdateRef.current.lastUpdateTime = Date.now();
      }, debounceTime);
    };

    // Add event listener for the custom event
    window.addEventListener("meowsenger:ws:chatupdate", handleWebSocketEvent);

    return () => {
      window.removeEventListener(
        "meowsenger:ws:chatupdate",
        handleWebSocketEvent
      );
      if (webSocketUpdateRef.current.timer) {
        clearTimeout(webSocketUpdateRef.current.timer);
      }
    };
  }, [fetchChats]);
  // Format chats for the ChatList component
  const formattedChats = filteredChats.map((chat) => ({
    id: chat.id.toString(),
    name: chat.name,
    lastMessage: chat.lastMessage?.text,
    timestamp: new Date(chat.lastUpdate),
    isGroup: chat.isGroup,
    isUnread: chat.isUnread,
  }));

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleCreateChat = () => {
    setShowCreateChat(true);
  };

  const handleDirectChatCreation = async (
    username: string
  ): Promise<boolean> => {
    try {
      // Open a direct chat with the username
      await openChat(username);
      // Navigate to the chat page
      router.push(`/chats/user/${username}`);
      return true;
    } catch (error) {
      // Return false to indicate failure, the error will be caught and displayed in the modal
      console.error("Failed to create chat:", error);
      return false;
    }
  };

  const handleGroupChatCreation = async (
    name: string,
    usernames: string[]
  ): Promise<boolean> => {
    try {
      // Create a group chat with the members
      const response = await createGroup(name, usernames);

      if (response && response.id) {
        // Refresh the chat list
        await fetchChats();
        // Navigate to the group chat page
        router.push(`/chats/group/${response.id}`);

        // Show success toast
        setToast({
          show: true,
          message: "Group created successfully",
          type: "success",
        });
        return true;
      }
      return false;
    } catch (error) {
      // Return false to indicate failure, the error will be caught and displayed in the modal
      console.error("Failed to create group:", error);
      return false;
    }
  };

  if (authLoading || (chatsLoading && chats.length === 0)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            loading chats...
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute authRequired={true}>
      <div className="flex flex-col h-screen">
        <div className="flex justify-between items-center p-4 border-b dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-medium">chats</h1>
            <WebSocketStatus size="sm" />
          </div>
          <Button onClick={handleCreateChat} variant="flat" size="sm">
            new chat
          </Button>
        </div>

        <div className="flex-1 overflow-hidden">
          <ChatList
            chats={formattedChats}
            onSearch={handleSearch}
            className="h-full"
          />
        </div>

        <CreateChatModal
          isOpen={showCreateChat}
          onOpenChange={setShowCreateChat}
          onCreateChat={handleDirectChatCreation}
          onCreateGroupChat={handleGroupChatCreation}
        />

        {toast.show && (
          <Toast
            message={toast.message}
            type={toast.type as "info" | "success" | "error"}
            onClose={() => setToast({ ...toast, show: false })}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
