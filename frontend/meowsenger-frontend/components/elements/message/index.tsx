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
  },
  defaultVariants: {
    isOwn: false,
  },
});

export interface MessageProps {
  content: string;
  timestamp: Date;
  sender: string;
  isOwn?: boolean;
  className?: string;
}

export const Message = ({
  content,
  timestamp,
  sender,
  isOwn = false,
  className,
}: MessageProps) => {
  const formattedTime = timestamp
    ? formatDistance(new Date(timestamp), new Date(), { addSuffix: true })
    : "";

  return (
    <div
      className={`flex flex-col mb-4 ${isOwn ? "items-end" : "items-start"}`}
    >
      <div className={messageStyles({ isOwn, className })}>
        {!isOwn && (
          <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
            {sender}
          </div>
        )}
        <p className="text-sm text-neutral-900 dark:text-neutral-100">
          {content}
        </p>
        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 text-right">
          {formattedTime}
        </div>
      </div>
    </div>
  );
};

export default Message;
