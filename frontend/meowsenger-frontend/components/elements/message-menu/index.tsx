"use client";

import React, { useState, useCallback } from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Button } from "@heroui/button";
import { useToast } from "@/contexts/toast-context";
import { useLanguage } from "@/contexts/language-context";
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
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(messageContent)
      .then(() => {
        showToast(t("message_copied"), "success");
      })
      .catch(() => {
        showToast(t("failed_to_copy"), "error");
      });
  }, [messageContent, showToast, t]);

  const handleToggleDropdown = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Determine if the user can edit or delete the message
  const canModify = isOwn || isAdmin;

  return (
    <div onClick={(e) => e.stopPropagation()} className="relative">
      <Dropdown
        placement={isOwn ? "bottom-end" : "bottom-start"}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        classNames={{
          content: "z-[100]",
        }}
        shouldBlockScroll={false}
        showArrow={true}
      >
        <DropdownTrigger>
          <Button
            variant="flat"
            isIconOnly
            size="sm"
            className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-full p-3 opacity-100 visible"
            aria-label={t("message_options")}
            onClick={handleToggleDropdown}
          >
            <FiMoreVertical size={16} />
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label={t("message_actions")}
          onAction={(key) => {
            setIsOpen(false);
            if (key === "copy") handleCopy();
            if (key === "reply" && onReply) onReply();
            if (key === "forward" && onForward) onForward();
            if (key === "edit" && onEdit) onEdit();
            if (key === "delete" && onDelete) onDelete();
          }}
          classNames={{
            base: "min-w-[180px]",
          }}
        >
          <DropdownItem key="copy" startContent={<FiCopy />}>
            {t("copy")}
          </DropdownItem>
          <DropdownItem key="reply" startContent={<FiMessageSquare />}>
            {t("reply")}
          </DropdownItem>
          <DropdownItem key="forward" startContent={<FiCornerUpRight />}>
            {t("forward")}
          </DropdownItem>
          {canModify ? (
            <>
              <DropdownItem
                key="edit"
                startContent={<FiEdit />}
                isDisabled={!isOwn} // Only owner can edit
              >
                {t("edit")}
              </DropdownItem>
              <DropdownItem
                key="delete"
                startContent={<FiTrash />}
                className="text-danger"
                color="danger"
              >
                {t("delete")}
              </DropdownItem>
            </>
          ) : null}
        </DropdownMenu>
      </Dropdown>
    </div>
  );
};

export default MessageMenu;
