import React, { useState } from "react";
import {
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/elements/modal";
import { Modal } from "@/components/elements/modal";
import { Input } from "@/components/elements/input";
import { Button } from "@/components/elements/button";
import { useLanguage } from "@/contexts/language-context";

export interface CreateChatModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateChat: (username: string) => Promise<boolean>;
  onCreateGroupChat?: (name: string, usernames: string[]) => Promise<boolean>;
}

export const CreateChatModal = ({
  isOpen,
  onOpenChange,
  onCreateChat,
  onCreateGroupChat,
}: CreateChatModalProps) => {
  const [username, setUsername] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [currentUserInput, setCurrentUserInput] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const { t } = useLanguage();

  const addMember = () => {
    const trimmedUser = currentUserInput.trim().toLowerCase();
    if (!trimmedUser) {
      return;
    }

    // Check if user already exists in the list
    if (members.includes(trimmedUser)) {
      setError(`${trimmedUser} is already added to the group`);
      return;
    }

    setMembers([...members, trimmedUser]);
    setCurrentUserInput("");
    setError("");
  };

  const removeMember = (index: number) => {
    const newMembers = [...members];
    newMembers.splice(index, 1);
    setMembers(newMembers);
  };

  const handleSubmit = () => {
    if (isGroup && onCreateGroupChat) {
      if (members.length === 0) {
        setError("Please add at least one member to the group");
        return;
      }

      // Convert all member usernames to lowercase
      const lowercaseMembers = members.map((member) => member.toLowerCase());
      onCreateGroupChat(groupName, lowercaseMembers);
    } else {
      // Convert username to lowercase
      onCreateChat(username.toLowerCase());
    }
    resetForm();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addMember();
    }
  };

  const resetForm = () => {
    setUsername("");
    setIsGroup(false);
    setGroupName("");
    setCurrentUserInput("");
    setMembers([]);
    setError("");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={handleClose}
      title={t("create_new_chat")}
    >
      <div className="flex flex-col gap-4">
        {onCreateGroupChat && (
          <div className="flex items-center gap-2">
            <span className="text-sm lowercase">{t("create_group_chat")}</span>
            <div className="ml-auto">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGroup}
                  onChange={(e) => setIsGroup(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-transparent dark:peer-focus:ring-transparent rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-green-600"></div>
              </label>
            </div>
          </div>
        )}

        {isGroup ? (
          <>
            <Input
              label={t("group_name")}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={t("enter_group_name")}
            />

            <div className="flex flex-col gap-2">
              <label className="text-sm text-neutral-500 dark:text-neutral-400 lowercase">
                {t("group_members")}
              </label>

              <div className="flex flex-wrap gap-2">
                {members.map((member, index) => (
                  <div
                    key={index}
                    className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md flex items-center gap-2"
                  >
                    <span className="text-sm">{member}</span>
                    <button
                      onClick={() => removeMember(index)}
                      className="text-neutral-500 hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={currentUserInput}
                  onChange={(e) => setCurrentUserInput(e.target.value)}
                  placeholder={t("type_username_and_press_enter")}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                />
                <Button
                  variant="flat"
                  onPress={addMember}
                  disabled={!currentUserInput.trim()}
                  className="h-auto"
                >
                  {t("add")}
                </Button>
              </div>

              {error && <p className="text-sm text-red-500 mt-1">{t(error)}</p>}
            </div>
          </>
        ) : (
          <Input
            label={t("username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("enter_username")}
          />
        )}
      </div>

      <ModalFooter>
        <Button variant="flat" color="danger" onPress={handleClose}>
          {t("cancel")}
        </Button>
        <Button
          onPress={handleSubmit}
          disabled={isGroup ? !groupName || members.length === 0 : !username}
        >
          {t("create")}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CreateChatModal;
