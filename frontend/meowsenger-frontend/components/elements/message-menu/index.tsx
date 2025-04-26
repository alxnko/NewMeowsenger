"use client";

import React from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Button } from "@heroui/button";
import { useToast } from "@/contexts/toast-context";
import {
  FiMoreVertical,
  FiCopy,
  FiCornerUpRight,
  FiEdit,
  FiTrash,
  FiMessageSquare,
} from "react-icons/fi";

interface MessageMenuProps {
  isOwn?: boolean;
  isAdmin?: boolean;
  messageContent: string;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onForward?: () => void;
}

export const MessageMenu = ({
  isOwn = false,
  isAdmin = false,
  messageContent,
  onReply,
  onEdit,
  onDelete,
  onForward,
}: MessageMenuProps) => {
  const { showToast } = useToast();

  const handleCopy = () => {
    navigator.clipboard
      .writeText(messageContent)
      .then(() => {
        showToast("Message copied to clipboard", "success");
      })
      .catch(() => {
        showToast("Failed to copy message", "error");
      });
  };

  // Determine if the user can edit or delete the message
  const canModify = isOwn || isAdmin;

  return (
    <Dropdown placement={isOwn ? "bottom-end" : "bottom-start"}>
      {/* Dropdown trigger button */}
      <DropdownTrigger>
        <Button
          variant="flat"
          isIconOnly
          size="sm"
          className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-full"
          aria-label="Message options"
        >
          <FiMoreVertical size={16} />
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Message actions">
        <DropdownItem key="copy" startContent={<FiCopy />} onPress={handleCopy}>
          Copy
        </DropdownItem>
        <DropdownItem
          key="reply"
          startContent={<FiMessageSquare />}
          onPress={onReply}
        >
          Reply
        </DropdownItem>
        <DropdownItem
          key="forward"
          startContent={<FiCornerUpRight />}
          onPress={onForward}
        >
          Forward
        </DropdownItem>
        {canModify ? (
          <>
            <DropdownItem
              key="edit"
              startContent={<FiEdit />}
              onPress={onEdit}
              isDisabled={!isOwn} // Only owner can edit
            >
              Edit
            </DropdownItem>
            <DropdownItem
              key="delete"
              startContent={<FiTrash />}
              className="text-danger"
              color="danger"
              onPress={onDelete}
            >
              Delete
            </DropdownItem>
          </>
        ) : null}
      </DropdownMenu>
    </Dropdown>
  );
};

export default MessageMenu;
