"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useChat } from "@/contexts/chat-context";
import { useAuth } from "@/contexts/auth-context";
import { useParams } from "next/navigation";
import ChatWidget from "@/components/widgets/chat-widget";
import Button from "@/components/elements/button";
import { Input } from "@/components/elements/input";
import { GrTest } from "react-icons/gr";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import {
  FiShield,
  FiSettings,
  FiUserPlus,
  FiUserMinus,
  FiUser,
  FiEdit,
} from "react-icons/fi";
import { User } from "@heroui/user";
import { Chip } from "@heroui/chip";
import { useLanguage } from "@/contexts/language-context";

export default function GroupChatPage() {
  const { id } = useParams();
  const { t } = useLanguage();
  const { user } = useAuth();
  const {
    openChat,
    currentChat,
    currentMessages,
    loading,
    error,
    sendMessage,
    markMessageAsRead,
    saveSettings,
    addMember,
    removeMember,
  } = useChat();

  const [isConnected, setIsConnected] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userActionType, setUserActionType] = useState<
    "add" | "remove" | "promote" | "demote" | null
  >(null);
  const [showUserActionModal, setShowUserActionModal] = useState(false);

  const handleConnectionChange = useCallback((event: StorageEvent) => {
    if (event.key === "ws_connected") {
      setIsConnected(event.newValue === "true");
    }
  }, []);

  useEffect(() => {
    const wsStatus = sessionStorage.getItem("ws_connected");
    setIsConnected(wsStatus === "true");

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

  useEffect(() => {
    if (currentChat) {
      setGroupName(currentChat.name);
      setGroupDescription(currentChat.desc || "");
    }
  }, [currentChat]);

  const isAdmin = useMemo(() => {
    if (!currentChat || !user) return false;
    return currentChat.admins?.includes(user.username);
  }, [currentChat, user]);

  const handleSaveSettings = async () => {
    if (!groupName.trim()) return;

    setSettingsLoading(true);
    try {
      await saveSettings(
        groupName,
        groupDescription,
        `${user?.username} updated group settings`
      );
      setShowSettingsModal(false);
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const openUserActionModal = (
    actionType: "add" | "remove" | "promote" | "demote",
    username?: string
  ) => {
    setUserActionType(actionType);
    setSelectedUser(username || null);
    if (actionType === "add") {
      setNewUsername("");
    }
    setShowUserActionModal(true);
  };

  const handleUserAction = async () => {
    if (!currentChat || !user) return;

    setSettingsLoading(true);
    try {
      if (userActionType === "add" && newUsername) {
        await addMember(
          newUsername,
          `${user.username} added ${newUsername} to the group`
        );
      } else if (userActionType === "remove" && selectedUser) {
        await removeMember(
          selectedUser,
          `${user.username} removed ${selectedUser} from the group`
        );
      } else if (
        (userActionType === "promote" || userActionType === "demote") &&
        selectedUser
      ) {
        const isPromote = userActionType === "promote";
        const action = isPromote ? "promoted" : "demoted";

        const actionMessage = `${user.username} ${action} ${selectedUser} [ADMIN_ACTION:${isPromote ? "PROMOTE" : "DEMOTE"}]`;

        await saveSettings(
          currentChat.name,
          currentChat.desc || "",
          actionMessage
        );
      }

      setShowUserActionModal(false);

      if (id) {
        const groupId = parseInt(id as string);
        if (!isNaN(groupId)) {
          await openChat(groupId);
        }
      }
    } catch (error) {
      console.error("Error performing user action:", error);
    } finally {
      setSettingsLoading(false);
    }
  };

  if (!user) {
    return <div className="p-4">Please log in to view this chat.</div>;
  }

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

          {isAdmin && (
            <Button
              onClick={() => setShowSettingsModal(true)}
              variant="light"
              size="sm"
              isIconOnly
              className="ml-1 text-xs h-6"
              title="Group Settings"
            >
              <FiSettings />
            </Button>
          )}
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
            <ModalBody className="max-h-[60vh] overflow-y-auto">
              <div className="space-y-3">
                {currentChat.users?.map((member) => {
                  const isOwner = currentChat.admins?.[0] === member.username;
                  const isAdmin = member.is_admin;
                  const isCurrentUser = member.username === user.username;

                  return (
                    <div key={member.id} className="flex items-center">
                      <User
                        className="flex-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
                            <div className="flex items-center gap-1">
                              {isOwner && (
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  color="warning"
                                  startContent={
                                    <FiShield className="text-amber-500" />
                                  }
                                  className="lowercase text-amber-500 bg-amber-100 dark:bg-amber-900/20"
                                >
                                  owner
                                </Chip>
                              )}
                              {!isOwner && isAdmin && (
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  color="default"
                                  startContent={
                                    <FiShield className="text-yellow-500" />
                                  }
                                  className="lowercase text-yellow-500 bg-yellow-100 dark:bg-yellow-900/20"
                                >
                                  admin
                                </Chip>
                              )}
                            </div>
                          </div>
                        }
                        name={
                          <div className="lowercase font-medium flex items-center">
                            {member.username}
                            {isCurrentUser && (
                              <Chip
                                size="sm"
                                variant="flat"
                                color="success"
                                className="ml-2 lowercase"
                              >
                                you
                              </Chip>
                            )}
                          </div>
                        }
                      />

                      {isAdmin && !isCurrentUser && !isOwner && (
                        <div className="flex space-x-1 ml-1">
                          <Button
                            size="sm"
                            variant="light"
                            color="danger"
                            title="Remove from group"
                            isIconOnly
                            onClick={() =>
                              openUserActionModal("remove", member.username)
                            }
                          >
                            <FiUserMinus size={16} />
                          </Button>
                        </div>
                      )}

                      {isAdmin && !isCurrentUser && !isOwner && (
                        <Button
                          size="sm"
                          variant="light"
                          color={isAdmin ? "warning" : "success"}
                          title={isAdmin ? "Remove admin status" : "Make admin"}
                          isIconOnly
                          onClick={() =>
                            openUserActionModal(
                              isAdmin ? "demote" : "promote",
                              member.username
                            )
                          }
                        >
                          <FiShield size={16} />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ModalBody>

            {isAdmin && (
              <ModalFooter>
                <Button
                  onClick={() => openUserActionModal("add")}
                  startContent={<FiUserPlus />}
                >
                  add user
                </Button>
              </ModalFooter>
            )}
          </ModalContent>
        </Modal>

        <Modal
          isOpen={showSettingsModal}
          onOpenChange={setShowSettingsModal}
          size="md"
        >
          <ModalContent>
            <ModalHeader className="lowercase">group settings</ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <div>
                  <Input
                    label="group name"
                    value={groupName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setGroupName(e.target.value)
                    }
                    placeholder="Enter group name"
                    startContent={<FiEdit />}
                  />
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 lowercase">
                    group description
                  </div>
                  <textarea
                    value={groupDescription}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setGroupDescription(e.target.value)
                    }
                    placeholder="Enter group description"
                    className="w-full p-2 text-sm rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 lowercase resize-y min-h-[80px]"
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="flat"
                color="danger"
                onPress={() => setShowSettingsModal(false)}
              >
                cancel
              </Button>
              <Button
                color="success"
                onPress={handleSaveSettings}
                isLoading={settingsLoading}
                isDisabled={!groupName.trim()}
              >
                save changes
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal
          isOpen={showUserActionModal}
          onOpenChange={setShowUserActionModal}
          size="sm"
        >
          <ModalContent>
            <ModalHeader className="lowercase">
              {userActionType === "add"
                ? "Add User"
                : userActionType === "remove"
                  ? "Remove User"
                  : userActionType === "promote"
                    ? "Make Admin"
                    : "Remove Admin"}
            </ModalHeader>
            <ModalBody>
              {userActionType === "add" ? (
                <Input
                  label="username"
                  value={newUsername}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewUsername(e.target.value)
                  }
                  placeholder="Enter username to add"
                  startContent={<FiUser />}
                />
              ) : (
                <p className="text-center py-2">
                  Are you sure you want to{" "}
                  {userActionType === "remove"
                    ? "remove"
                    : userActionType === "promote"
                      ? "make admin"
                      : "remove admin status from"}{" "}
                  <span className="font-bold">{selectedUser}</span>?
                </p>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                variant="flat"
                color="danger"
                onPress={() => setShowUserActionModal(false)}
              >
                cancel
              </Button>
              <Button
                color={
                  userActionType === "remove" || userActionType === "demote"
                    ? "warning"
                    : "success"
                }
                onPress={handleUserAction}
                isLoading={settingsLoading}
                isDisabled={userActionType === "add" && !newUsername.trim()}
              >
                confirm
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    );
  }, [
    currentChat,
    showMembersModal,
    showSettingsModal,
    showUserActionModal,
    groupName,
    groupDescription,
    newUsername,
    selectedUser,
    userActionType,
    settingsLoading,
    isAdmin,
    user,
  ]);

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
