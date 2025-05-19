import React, { useState, useEffect, useCallback } from "react";
import {
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/elements/modal";
import { Modal } from "@/components/elements/modal";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Checkbox } from "@heroui/checkbox";
import { useChat } from "@/contexts/chat-context";
import { useLanguage } from "@/contexts/language-context";
import { FiSearch, FiSend, FiX } from "react-icons/fi";
import { ChatBlock } from "@/contexts/chat-context";

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: {
    text: string;
    id?: number;
  };
  onForward: (chatIds: number[]) => Promise<void>;
}

export const ForwardModal = ({
  isOpen,
  onClose,
  message,
  onForward,
}: ForwardModalProps) => {
  const { chats } = useChat();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChats, setSelectedChats] = useState<number[]>([]);
  const [isForwarding, setIsForwarding] = useState(false);

  // Reset selections when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedChats([]);
      setSearchQuery("");
    }
  }, [isOpen]);

  // Filter chats based on search query
  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle chat selection
  const toggleChatSelection = useCallback((chatId: number) => {
    setSelectedChats((prev) =>
      prev.includes(chatId)
        ? prev.filter((id) => id !== chatId)
        : [...prev, chatId]
    );
  }, []);

  // Handle forward button click
  const handleForward = async () => {
    if (selectedChats.length === 0) return;

    setIsForwarding(true);
    try {
      await onForward(selectedChats);
      onClose();
    } catch (error) {
      console.error("Error forwarding message:", error);
    } finally {
      setIsForwarding(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose} title={t("forward_message")}>
      <div className="mb-4 bg-neutral-100 dark:bg-neutral-800 p-3 rounded-lg text-sm max-h-20 overflow-auto">
        <p className="line-clamp-3 text-neutral-700 dark:text-neutral-300">
          {message.text}
        </p>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Input
            placeholder={t("search_chats")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startContent={<FiSearch className="text-neutral-400" />}
            className="w-full"
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
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {chat.name}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {chat.isGroup ? t("group_chat") : t("private_chat")}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-neutral-500 dark:text-neutral-400">
            {t("no_chats_found")}
          </div>
        )}
      </div>

      <ModalFooter>
        <div className="flex justify-between w-full">
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            {selectedChats.length > 0
              ? t("selected_chats", { count: selectedChats.length })
              : t("select_chats_to_forward")}
          </div>
          <div className="flex gap-2">
            <Button variant="flat" onPress={onClose} isDisabled={isForwarding}>
              {t("cancel")}
            </Button>
            <Button
              color="success"
              onPress={handleForward}
              isDisabled={selectedChats.length === 0 || isForwarding}
              isLoading={isForwarding}
              startContent={<FiSend size={16} />}
            >
              {t("forward")}
            </Button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
};

export default ForwardModal;
