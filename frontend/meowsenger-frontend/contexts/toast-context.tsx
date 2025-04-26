import { createContext, useContext, ReactNode, useCallback } from "react";
import { ToastProvider as HeroToastProvider, addToast } from "@heroui/toast";

type ToastType = "info" | "success" | "error";

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  // Show a new toast notification with HeroUI
  const showToast = useCallback((message: string, type: ToastType = "info") => {
    // Map our toast types to acceptable variants that HeroUI expects
    const toastConfig: any = {
      title: type.charAt(0).toUpperCase() + type.slice(1),
      description: message,
      duration: 10000, // 10 seconds
    };

    // Set color instead of variant based on type
    if (type === "success") {
      toastConfig.color = "success";
    } else if (type === "error") {
      toastConfig.color = "danger";
    }

    addToast(toastConfig);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <HeroToastProvider
        placement="top-right"
        toastProps={{ variant: "bordered", shouldShowTimeoutProgress: true }}
      />
      {children}
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);

  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
};
