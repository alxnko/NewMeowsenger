import { createContext, useContext, ReactNode } from "react";
import { ToastProvider as HeroToastProvider, addToast } from "@heroui/toast";
import { useLanguage, Language } from "@/contexts/language-context";
import en from "./lang-en";
import ru from "./lang-ru";
import kg from "./lang-kg";

type ToastType = "info" | "success" | "error";

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Define proper translation object type
type TranslationObject = Record<string, string>;

// Type-safe translation mapping
const translations: Record<Language, TranslationObject> = {
  en,
  ru,
  kg,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();

  // Direct translation mapping with type safety
  const getToastTitle = (type: ToastType): string => {
    const key = `toast_${type}`;

    // Use the safe translation mapping
    if (translations[language] && key in translations[language]) {
      return translations[language][key];
    }

    // Fallback to English
    if (key in translations.en) {
      return translations.en[key];
    }

    // Ultimate fallback
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Show a new toast notification with HeroUI
  const showToast = (message: string, type: ToastType = "info") => {
    // Get translated title using direct mapping
    const title = getToastTitle(type);

    // Map our toast types to acceptable variants that HeroUI expects
    const toastConfig: any = {
      title,
      description: message,
      duration: 3000, // 3 seconds
    };

    // Set color instead of variant based on type
    if (type === "success") {
      toastConfig.color = "success";
    } else if (type === "error") {
      toastConfig.color = "danger";
    }

    addToast(toastConfig);
  };

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
