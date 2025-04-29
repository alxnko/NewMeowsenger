"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useChat } from "@/contexts/chat-context";
import { useAuth } from "@/contexts/auth-context";
import { useParams } from "next/navigation";
import ChatWidget from "@/components/widgets/chat-widget";
import Button from "@/components/elements/button";
import { GrTest } from "react-icons/gr";
import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/modal";
import { FiShield } from "react-icons/fi";
import { User } from "@heroui/user";

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
  const [showMembersModal, setShowMembersModal] = useState(false);

  // Handle connection status changes
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

  useEffect(() => {
    if (id) {
      const groupId = parseInt(id as string);
      if (!isNaN(groupId)) {
        openChat(groupId);
      }
    }
  }, [id]);

  // If user is not logged in, show login message
  if (!user) {
    return <div className="p-4">Please log in to view this chat.</div>;
  }

  // Memoize the header content to prevent unnecessary re-renders
  const groupHeaderContent = useMemo(() => {
    if (!currentChat) return null;

    return (
      <div>
        <div className="flex items-center">
          <h3 className="font-medium lowercase truncate max-w-[calc(100vw-250px)]">
            {currentChat.name}
          </h3>
          {currentChat.isVerified && (
            <span className="ml-1 text-success">✓</span>
          )}
          <Button
            onClick={() => setShowMembersModal(true)}
            variant="light"
            size="sm"
            className="ml-2 text-xs h-6 px-1"
          >
            {currentChat.users?.length === 1
              ? "1 member"
              : `${currentChat.users?.length || 0} members`}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground lowercase">
          {currentChat.desc}
        </p>

        <Modal
          isOpen={showMembersModal}
          onOpenChange={setShowMembersModal}
          scrollBehavior="inside"
          size="sm"
        >
          <ModalContent>
            <ModalHeader className="lowercase">
              group members ({currentChat.users?.length || 0})
            </ModalHeader>
            <ModalBody className="max-h-[60vh] overflow-y-auto py-2">
              <div className="space-y-3">
                {currentChat.users?.map((member) => {
                  const isOwner = currentChat.admins?.[0] === member.username;
                  const isAdmin = member.is_admin;

                  return (
                    <User
                      key={member.id}
                      avatarProps={{
                        className: "bg-green-100 text-green-800",
                        radius: "full",
                        showFallback: true,
                        name: member.username.charAt(0).toLowerCase(),
                      }}
                      description={
                        <div className="flex items-center gap-1 lowercase text-neutral-500 dark:text-neutral-400">
                          {member.is_verified && (
                            <span className="text-success">✓</span>
                          )}
                          {member.is_tester && (
                            <span>
                              <GrTest className="mr-1" />
                            </span>
                          )}
                          {isOwner ? (
                            <span className="flex items-center text-amber-500">
                              <FiShield className="mr-1" />
                              owner
                            </span>
                          ) : isAdmin ? (
                            <span className="flex items-center text-yellow-500">
                              <FiShield className="mr-1" />
                              admin
                            </span>
                          ) : null}
                        </div>
                      }
                      name={
                        <div className="lowercase font-medium">
                          {member.username}
                        </div>
                      }
                    />
                  );
                })}
              </div>
            </ModalBody>
          </ModalContent>
        </Modal>
      </div>
    );
  }, [currentChat, showMembersModal]);

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
