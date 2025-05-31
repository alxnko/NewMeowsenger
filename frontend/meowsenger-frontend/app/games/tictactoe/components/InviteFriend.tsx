"use client";

import React from "react";
import { Button } from "@heroui/react";
import { useLanguage } from "@/contexts/language-context";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/contexts/toast-context";

interface InviteFriendProps {
  recipientId: number;
  recipientUsername: string;
  onClose?: () => void;
}

const InviteFriend: React.FC<InviteFriendProps> = ({
  recipientId,
  recipientUsername,
  onClose,
}) => {
  const { t } = useLanguage();
  const router = useRouter();
  const { showToast } = useToast();

  const handleInvite = () => {
    try {
      // Generate a new game ID
      const gameId = uuidv4();

      // Create invite URL with the recipient's ID
      const inviteUrl = `/games/tictactoe?id=${gameId}&invite=${recipientId}`;

      // Navigate to the game page
      router.push(inviteUrl);

      // Close the modal or popup if a close function is provided
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error("Failed to create game invite:", error);
      showToast(t("failed_to_initialize_game"));
    }
  };

  return (
    <div className="flex flex-col items-center p-4 gap-4 w-full max-w-xs">
      <h3 className="text-lg font-medium lowercase text-center">
        {t("invite_to_play", {
          game: t("tic_tac_toe"),
          username: recipientUsername,
        })}
      </h3>

      <Button
        onClick={handleInvite}
        color="primary"
        className="w-full lowercase"
      >
        {t("send_invitation")}
      </Button>

      {onClose && (
        <Button onClick={onClose} variant="flat" className="w-full lowercase">
          {t("cancel")}
        </Button>
      )}
    </div>
  );
};

export default InviteFriend;
