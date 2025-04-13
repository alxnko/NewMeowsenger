import React from "react";
import { tv } from "tailwind-variants";
import { formatDistance } from "date-fns";

const messageStyles = tv({
  base: "rounded-lg p-3 max-w-[80%] lowercase",
  variants: {
    isOwn: {
      true: "bg-green-100 dark:bg-green-900/30 ml-auto",
      false: "bg-neutral-100 dark:bg-neutral-800 mr-auto",
    },
    isPending: {
      true: "opacity-60",
    },
  },
  defaultVariants: {
    isOwn: false,
    isPending: false,
  },
});

export interface MessageProps {
  content: string;
  timestamp: Date;
  sender: string;
  isOwn?: boolean;
  isPending?: boolean;
  isRead?: boolean;
  onReply?: () => void;
  className?: string;
}

export const Message = ({
  content,
  timestamp,
  sender,
  isOwn = false,
  isPending = false,
  isRead = false,
  onReply,
  className,
}: MessageProps) => {
  const formattedTime = timestamp
    ? formatDistance(new Date(timestamp), new Date(), { addSuffix: true })
    : "";

  return (
    <div
      className={`flex flex-col mb-4 ${isOwn ? "items-end" : "items-start"}`}
    >
      <div
        className={messageStyles({ isOwn, isPending, className })}
        onClick={onReply}
      >
        {!isOwn && (
          <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
            {sender}
          </div>
        )}
        <p className="text-sm text-neutral-900 dark:text-neutral-100">
          {content}
        </p>
        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 text-right flex justify-end items-center space-x-1">
          {isPending && (
            <span
              className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse mr-1"
              title="Sending..."
            ></span>
          )}
          {isOwn && isRead && (
            <span className="text-green-500 dark:text-green-400" title="Read">
              ✓✓
            </span>
          )}
          <span>{formattedTime}</span>
        </div>
      </div>
    </div>
  );
};

export default Message;
