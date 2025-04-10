import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Input } from "@/components/elements/input";
import { Button } from "@/components/elements/button";

export interface CreateChatModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateChat: (username: string) => void;
  onCreateGroupChat?: (name: string, usernames: string[]) => void;
}

export const CreateChatModal = ({
  isOpen,
  onOpenChange,
  onCreateChat,
  onCreateGroupChat,
}: CreateChatModalProps) => {
  const [username, setUsername] = React.useState("");
  const [isGroup, setIsGroup] = React.useState(false);
  const [groupName, setGroupName] = React.useState("");
  const [groupUsers, setGroupUsers] = React.useState("");

  const handleSubmit = () => {
    if (isGroup && onCreateGroupChat) {
      const users = groupUsers.split(",").map((user) => user.trim());
      onCreateGroupChat(groupName, users);
    } else {
      onCreateChat(username);
    }
    resetForm();
  };

  const resetForm = () => {
    setUsername("");
    setIsGroup(false);
    setGroupName("");
    setGroupUsers("");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={handleClose}>
      <ModalContent>
        <ModalHeader className="lowercase">create new chat</ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            {onCreateGroupChat && (
              <div className="flex items-center gap-2">
                <span className="text-sm lowercase">create group chat</span>
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
                  label="group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="enter group name"
                />
                <Input
                  label="group members"
                  value={groupUsers}
                  onChange={(e) => setGroupUsers(e.target.value)}
                  placeholder="enter usernames separated by commas"
                />
              </>
            ) : (
              <Input
                label="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="enter username"
              />
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" color="danger" onPress={handleClose}>
            cancel
          </Button>
          <Button
            onPress={handleSubmit}
            disabled={isGroup ? !groupName || !groupUsers : !username}
          >
            create
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CreateChatModal;
