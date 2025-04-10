"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useChat } from "@/contexts/chat-context";
import { ChatList } from "@/components/widgets/chat-list";
import { Button } from "@/components/elements/button";
import CreateChatModal from "@/components/widgets/create-chat-modal";
import { Toast } from "@/components/elements/toast";
import { ProtectedRoute } from "@/components/elements/protected-route";

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

  // Format chats for the ChatList component
  const formattedChats = filteredChats.map((chat) => ({
    id: chat.id.toString(),
    name: chat.name,
    lastMessage: chat.lastMessage?.text,
    timestamp: new Date(chat.lastUpdate),
    isGroup: chat.isGroup,
  }));

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleCreateChat = () => {
    setShowCreateChat(true);
  };

  const handleDirectChatCreation = async (username: string) => {
    try {
      // Open a direct chat with the username
      await openChat(username);
      setShowCreateChat(false);
      // Navigate to the chat page
      router.push(`/chats/user/${username}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create chat";
      setToast({
        show: true,
        message,
        type: "error",
      });
    }
  };

  const handleGroupChatCreation = async (name: string, usernames: string[]) => {
    try {
      // Create a group chat
      const response = await createGroup(name);

      if (response && response.id) {
        setShowCreateChat(false);
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
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create group";
      setToast({
        show: true,
        message,
        type: "error",
      });
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
          <h1 className="text-2xl font-medium">chats</h1>
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

        {error && (
          <div className="p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

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
