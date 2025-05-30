"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useChat } from "@/contexts/chat-context";
import { useAuth } from "@/contexts/auth-context";
import { useParams } from "next/navigation";
import ChatWidget from "@/components/widgets/chat-widget";
import Button from "@/components/elements/button";
import { Input } from "@/components/elements/input";
import { GrTest } from "react-icons/gr";
import {
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Modal,
} from "@/components/elements/modal";
import {
  FiShield,
  FiSettings,
  FiUserPlus,
  FiUserMinus,
  FiUser,
  FiEdit,
  FiChevronDown,
  FiMoreVertical,
} from "react-icons/fi";
import { User } from "@heroui/user";
import { Chip } from "@heroui/chip";
import { useLanguage } from "@/contexts/language-context";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";

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
    addAdmin,
    removeAdmin,
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

  // Reference to clicked member dropdown to position it properly
  const memberDropdownRef = useRef<HTMLDivElement>(null);

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
        // Fix: pass the correct parameters - chatId, userId, username
        await addMember(
          currentChat.id,
          0, // Using 0 as a placeholder userId which the backend will resolve from username
          newUsername
        );
      } else if (userActionType === "remove" && selectedUser) {
        await removeMember(
          selectedUser,
          `${user.username} removed ${selectedUser} from the group`
        );
      } else if (userActionType === "promote" && selectedUser) {
        await addAdmin(
          selectedUser,
          `${user.username} made ${selectedUser} an admin`
        );
      } else if (userActionType === "demote" && selectedUser) {
        await removeAdmin(
          selectedUser,
          `${user.username} removed admin rights from ${selectedUser}`
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

  const isAdmin = useMemo(() => {
    if (!currentChat || !user) return false;
    return currentChat.admins?.includes(user.username);
  }, [currentChat, user]);

  const groupHeaderContent = useMemo(() => {
    if (!currentChat) return null;
    const membersCount = currentChat.users?.length || 0;
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
            {membersCount === 1
              ? t("one_member")
              : `${membersCount} ${t("members")}`}
          </Button>
          {isAdmin && (
            <Button
              onClick={() => setShowSettingsModal(true)}
              variant="light"
              size="sm"
              isIconOnly
              className="ml-1 text-xs h-6"
              title={t("group_settings")}
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
              {`${membersCount} ${t("members")}`}
            </ModalHeader>
            <ModalBody className="max-h-[60vh] overflow-y-auto">
              <div className="space-y-3">
                {currentChat.users?.map((member) => {
                  const isOwner = currentChat.admins?.[0] === member.username;
                  const isMemberAdmin =
                    member.is_admin ||
                    currentChat.admins?.includes(member.username);
                  const isCurrentUser =
                    user && member.username === user.username; // Added user check
                  // Current user can only manage other members if they're an admin
                  const canManageMember = isAdmin && !isCurrentUser && !isOwner;

                  return (
                    <div key={member.id} className="flex items-center relative">
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
                                  {t("owner")}
                                </Chip>
                              )}
                              {!isOwner && isMemberAdmin && (
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  color="default"
                                  startContent={
                                    <FiShield className="text-yellow-500" />
                                  }
                                  className="lowercase text-yellow-500 bg-yellow-100 dark:bg-yellow-900/20"
                                >
                                  {t("admin")}
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
                                {t("you")}
                              </Chip>
                            )}
                          </div>
                        }
                      />

                      {/* Dropdown menu for member management */}
                      {canManageMember && (
                        <div className="ml-1" ref={memberDropdownRef}>
                          <Dropdown>
                            <DropdownTrigger>
                              <Button
                                size="sm"
                                variant="light"
                                isIconOnly
                                className="text-neutral-500"
                              >
                                <FiMoreVertical size={16} />
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label={t("member_actions")}>
                              <DropdownItem
                                key="remove"
                                className="text-danger lowercase"
                                startContent={
                                  <FiUserMinus
                                    className="text-danger"
                                    size={16}
                                  />
                                }
                                onClick={() =>
                                  openUserActionModal("remove", member.username)
                                }
                              >
                                {t("remove_from_group")}
                              </DropdownItem>
                              {isMemberAdmin ? (
                                <DropdownItem
                                  key="demote"
                                  className="text-warning lowercase"
                                  startContent={
                                    <FiShield
                                      className="text-warning"
                                      size={16}
                                    />
                                  }
                                  onClick={() =>
                                    openUserActionModal(
                                      "demote",
                                      member.username
                                    )
                                  }
                                >
                                  {t("remove_admin_rights")}
                                </DropdownItem>
                              ) : (
                                <DropdownItem
                                  key="promote"
                                  className="text-success lowercase"
                                  startContent={
                                    <FiShield
                                      className="text-success"
                                      size={16}
                                    />
                                  }
                                  onClick={() =>
                                    openUserActionModal(
                                      "promote",
                                      member.username
                                    )
                                  }
                                >
                                  {t("make_admin")}
                                </DropdownItem>
                              )}
                            </DropdownMenu>
                          </Dropdown>
                        </div>
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
                  {t("add_user")}
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
            <ModalHeader className="lowercase">
              {t("group_settings")}
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <div>
                  <Input
                    label={t("group_name")}
                    value={groupName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setGroupName(e.target.value)
                    }
                    placeholder={t("enter_group_name")}
                    startContent={<FiEdit />}
                  />
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 lowercase">
                    {t("group_description")}
                  </div>
                  <textarea
                    value={groupDescription}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setGroupDescription(e.target.value)
                    }
                    placeholder={t("enter_group_description")}
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
                {t("cancel")}
              </Button>
              <Button
                color="success"
                onPress={handleSaveSettings}
                isLoading={settingsLoading}
                disabled={!groupName.trim()}
              >
                {t("save_changes")}
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
                ? t("add_user")
                : userActionType === "remove"
                ? t("remove_user")
                : userActionType === "promote"
                ? t("make_admin")
                : t("remove_admin")}
            </ModalHeader>
            <ModalBody>
              {userActionType === "add" ? (
                <Input
                  label={t("username")}
                  value={newUsername}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewUsername(e.target.value)
                  }
                  placeholder={t("enter_username_to_add")}
                  startContent={<FiUser />}
                />
              ) : (
                <p className="text-center py-2">
                  {t("are_you_sure")}{" "}
                  {userActionType === "remove"
                    ? t("remove")
                    : userActionType === "promote"
                    ? t("make_admin")
                    : t("remove_admin_status_from")}{" "}
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
                {t("cancel")}
              </Button>
              <Button
                color={
                  userActionType === "remove" || userActionType === "demote"
                    ? "warning"
                    : "success"
                }
                onPress={handleUserAction}
                isLoading={settingsLoading}
                disabled={userActionType === "add" && !newUsername.trim()}
              >
                {t("confirm")}
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
    t,
  ]);

  // Moved the early return after all hook calls
  if (!user) {
    return <div className="p-4">{t("please_log_in")}</div>;
  }

  return (
    <ChatWidget
      chat={currentChat}
      messages={currentMessages || []}
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
