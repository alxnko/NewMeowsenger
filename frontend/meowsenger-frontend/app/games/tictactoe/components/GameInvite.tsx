"use client";

import React, { useState } from "react";
import { Button } from "@/components/elements/button";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/language-context";
import { useToast } from "@/contexts/toast-context";
import { useChat } from "@/contexts/chat-context";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Checkbox } from "@heroui/checkbox";
import { Input } from "@heroui/input";
import { FiSearch, FiSend } from "react-icons/fi";

interface GameInviteProps {
  gameId: string;
  recipientId?: number;
}

const GameInvite: React.FC<GameInviteProps> = ({ gameId, recipientId }) => {
  const { t } = useLanguage();
  const router = useRouter();
  const { showToast } = useToast();
  const { chats, forwardMessage } = useChat();

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChats, setSelectedChats] = useState<number[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Filter chats based on search query
  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopyLink = () => {
    const gameLink = `${window.location.origin}/games/tictactoe?id=${gameId}`;
    navigator.clipboard
      .writeText(gameLink)
      .then(() => {
        showToast(t("link_copied"));
      })
      .catch((err) => {
        console.error("Failed to copy link:", err);
        showToast(t("copy_failed"));
      });
  };

  const handleSendMessage = () => {
    // This will redirect back to the chat with the recipient
    if (recipientId) {
      router.push(`/chats/${recipientId}`);
    }
  };

  const handleOpenShareModal = () => {
    setIsShareModalOpen(true);
    setSelectedChats([]);
    setSearchQuery("");

    // If there's a recipient, pre-select their chat
    if (recipientId) {
      setSelectedChats([recipientId]);
    }
  };

  const toggleChatSelection = (chatId: number) => {
    setSelectedChats((prev) =>
      prev.includes(chatId)
        ? prev.filter((id) => id !== chatId)
        : [...prev, chatId]
    );
  };

  const handleShareGame = async () => {
    if (selectedChats.length === 0) return;

    setIsSending(true);
    try {
      // Get current user information from localStorage or sessionStorage
      let username = "player";
      try {
        const userString =
          localStorage.getItem("user") || sessionStorage.getItem("user");
        if (userString) {
          const user = JSON.parse(userString);
          username = user.username || "player";
        }
      } catch (e) {
        console.error("Error reading user data:", e);
      }

      // Create a JSON payload that will be parsed as a rich message card
      const gameInvitePayload = JSON.stringify({
        type: "GAME_INVITE",
        game: "tictactoe",
        gameId: gameId,
        inviterUsername: username,
        // Using a special message format that our message renderer will recognize
        messageContent: `__GAME_INVITE__:${gameId}:tictactoe:${username}`,
      });

      // Send special message to all selected chats
      await forwardMessage(gameInvitePayload, selectedChats);
      showToast(t("invitation_sent"));
      setIsShareModalOpen(false);
    } catch (error) {
      console.error("Failed to share game:", error);
      showToast(t("failed_to_share_game"));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center p-4 gap-3 w-full max-w-xs">
        <Button
          onClick={handleCopyLink}
          variant="light"
          className="w-full lowercase"
        >
          {t("copy_game_link")}
        </Button>

        <Button
          onClick={handleOpenShareModal}
          color="primary"
          className="lowercase"
        >
          {t("share_with_friends")}
        </Button>

        {recipientId && (
          <Button
            onClick={handleSendMessage}
            variant="flat"
            className="w-full lowercase"
          >
            {t("return_to_chat")}
          </Button>
        )}
      </div>

      {/* Share Modal */}
      <Modal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="lowercase">{t("share_game")}</ModalHeader>
          <ModalBody>
            <div className="mb-4 bg-neutral-100 dark:bg-neutral-800 p-3 rounded-lg">
              <p className="font-medium mb-1 lowercase text-sm">
                {t("tic_tac_toe")}
              </p>
              <p className="text-sm text-neutral-700 dark:text-neutral-400 lowercase">
                {t("share_game_description")}
              </p>
            </div>

            <div className="mb-4">
              <div className="relative">
                <Input
                  placeholder={t("search_chats")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  startContent={<FiSearch className="text-neutral-400" />}
                  className="w-full lowercase"
                  isClearable
                  onClear={() => setSearchQuery("")}
                  color="success"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-60">
              {filteredChats.length > 0 ? (
                filteredChats.map((chat) => (
                  <div
                    key={chat.id}
                    role="button"
                    tabIndex={0}
                    className="flex items-center p-2 border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors rounded-md cursor-pointer"
                    onClick={() => toggleChatSelection(chat.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        toggleChatSelection(chat.id);
                      }
                    }}
                  >
                    <Checkbox
                      isSelected={selectedChats.includes(chat.id)}
                      onChange={() => toggleChatSelection(chat.id)}
                      className="mr-3"
                      color="success"
                    />
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-200 flex items-center justify-center text-green-800 mr-2">
                      {chat.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate lowercase">
                        {chat.name}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate lowercase">
                        {chat.isGroup ? t("group_chat") : t("private_chat")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-neutral-500 dark:text-neutral-400 lowercase">
                  {t("no_chats_found")}
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex justify-between w-full">
              <div className="text-sm text-neutral-500 dark:text-neutral-400 lowercase">
                {selectedChats.length > 0
                  ? t("selected_chats", { count: selectedChats.length })
                  : t("select_chats_to_forward")}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="flat"
                  onClick={() => setIsShareModalOpen(false)}
                  isDisabled={isSending}
                  className="lowercase"
                >
                  {t("cancel")}
                </Button>
                <Button
                  color="success"
                  onClick={handleShareGame}
                  isDisabled={selectedChats.length === 0 || isSending}
                  isLoading={isSending}
                  startContent={<FiSend size={16} />}
                  className="lowercase"
                >
                  {t("share")}
                </Button>
              </div>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default GameInvite;
