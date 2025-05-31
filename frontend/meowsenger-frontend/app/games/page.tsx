"use client";

import { useLanguage } from "@/contexts/language-context";
import { title } from "@/components/primitives";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";

export default function GamesPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const games = [
    {
      id: "tictactoe",
      name: "tic tac toe",
      description: "classic game of X's and O's",
      path: "/games/tictactoe",
      isNew: true,
    },
    // Add more games here as they are developed
  ];

  const handleGameClick = (path: string) => {
    router.push(path);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
      <h1 className={title({ size: "lg", className: "mb-6 lowercase" })}>
        {t("games")}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
        {games.map((game) => (
          <div
            key={game.id}
            className="border border-foreground/20 rounded-lg p-4 flex flex-col items-center hover:bg-foreground/5 transition-colors relative"
          >
            {game.isNew && (
              <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full lowercase">
                new
              </span>
            )}
            <h2 className="text-xl font-semibold mb-2 lowercase">
              {game.name}
            </h2>
            <p className="text-sm text-foreground/70 mb-4 text-center lowercase">
              {game.description}
            </p>
            <Button
              onClick={() => handleGameClick(game.path)}
              className="w-full lowercase"
            >
              {t("play")}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
