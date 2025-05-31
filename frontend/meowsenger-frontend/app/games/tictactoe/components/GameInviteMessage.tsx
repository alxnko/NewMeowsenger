"use client";

import React from "react";
import { Button } from "@heroui/react";
import { useLanguage } from "@/contexts/language-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/toast-context";

interface GameInviteMessageProps {
  gameId: string;
  inviterUsername: string;
  isExpired?: boolean;
}

const GameInviteMessage: React.FC<GameInviteMessageProps> = ({
  gameId,
  inviterUsername,
  isExpired = false,
}) => {
  const { t } = useLanguage();
  const router = useRouter();
  const { showToast } = useToast();

  // Ensure username is displayed in lowercase to match Meowsenger's style
  const formattedUsername = inviterUsername
    ? inviterUsername.toLowerCase()
    : "player";

  const handleJoinGame = () => {
    if (isExpired) {
      showToast(t("invitation_expired"));
      return;
    }

    router.push(`/games/tictactoe?id=${gameId}`);
  };

  return (
    <div className="p-3 border rounded-lg border-foreground/20 bg-foreground/5 w-full">
      <p className="text-sm mb-2 lowercase text-foreground/80">
        {isExpired
          ? t("game_invitation_expired_message", {
              username: formattedUsername,
              game: t("tic_tac_toe"),
            })
          : t("game_invitation_message", {
              username: formattedUsername,
              game: t("tic_tac_toe"),
            })}
      </p>

      <Button
        onClick={handleJoinGame}
        color="primary"
        size="sm"
        className="w-full lowercase"
        disabled={isExpired}
      >
        {isExpired ? t("invitation_expired") : t("join_game")}
      </Button>
    </div>
  );
};

export default GameInviteMessage;
