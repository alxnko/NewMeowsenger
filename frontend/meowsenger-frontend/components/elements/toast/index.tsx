import React, { useEffect } from "react";
import { tv } from "tailwind-variants";
import {
  FaCheckCircle,
  FaExclamationCircle,
  FaInfoCircle,
  FaTimes,
} from "react-icons/fa";

export interface ToastProps {
  message: string;
  type?: "info" | "success" | "error";
  duration?: number;
  onClose: () => void;
}

const toastStyles = tv({
  base: "fixed bottom-4 right-4 z-50 p-3 rounded-md shadow-md flex items-center gap-2 max-w-xs animate-fade-in",
  variants: {
    type: {
      info: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-l-4 border-blue-500",
      success:
        "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-l-4 border-green-500",
      error:
        "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-l-4 border-red-500",
    },
  },
  defaultVariants: {
    type: "info",
  },
});

export const Toast: React.FC<ToastProps> = ({
  message,
  type = "info",
  duration = 3000,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return <FaCheckCircle className="text-green-500" />;
      case "error":
        return <FaExclamationCircle className="text-red-500" />;
      default:
        return <FaInfoCircle className="text-blue-500" />;
    }
  };

  return (
    <div className={toastStyles({ type })}>
      <span className="flex-shrink-0">{getIcon()}</span>
      <p className="text-sm flex-1">{message}</p>
      <button
        onClick={onClose}
        className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 rounded-full p-1 transition-colors"
        aria-label="Close toast"
      >
        <FaTimes size={14} />
      </button>
    </div>
  );
};

export default Toast;
