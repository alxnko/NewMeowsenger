"use client";

import React from "react";
import { cn } from "@/utils/cn";

interface TicTacToeBoardProps {
  board: (string | null)[];
  onCellClick: (index: number) => void;
  winnerCells: number[];
}

export const TicTacToeBoard: React.FC<TicTacToeBoardProps> = ({
  board,
  onCellClick,
  winnerCells = [],
}) => {
  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-[320px] aspect-square">
      {board.map((cell, index) => (
        <div
          key={index}
          onClick={() => onCellClick(index)}
          className={cn(
            "flex items-center justify-center text-3xl md:text-5xl font-bold rounded-md cursor-pointer transition-all duration-200",
            "border-2 border-foreground/20 aspect-square",
            "hover:bg-foreground/5 active:bg-foreground/10",
            winnerCells.includes(index) ? "bg-success/20" : ""
          )}
          aria-label={`Cell ${index + 1}, ${cell || "empty"}`}
        >
          {cell === "X" && <XMark />}
          {cell === "O" && <OMark />}
        </div>
      ))}
    </div>
  );
};

const XMark = () => (
  <span className="text-green-500 dark:text-green-400 text-4xl md:text-5xl">
    ✕
  </span>
);

const OMark = () => (
  <span className="text-blue-500 dark:text-blue-400 text-4xl md:text-5xl">
    ○
  </span>
);
