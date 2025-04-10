import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

// Available languages
export type Language = "en" | "ru" | "kg"; // We'll prepare for more languages even though we're starting with English

// Language context type
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string; // Translation function
}

// Create the context with default values
const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key: string) => key,
});

// Hook for using the language context
export const useLanguage = () => useContext(LanguageContext);

// Define translations
type TranslationsType = {
  [lang in Language]: {
    [key: string]: string;
  };
};

const translations: TranslationsType = {
  en: {
    // Navigation
    chats: "chats",
    profile: "profile",
    settings: "settings",
    logout: "logout",

    // Chat widget translations
    back: "back",
    admin: "admin",
    tester: "tester",
    no_messages: "no messages yet. start the conversation!",
    this_message_was_deleted: "this message was deleted",
    edited: "edited",
    type_a_message: "type a message...",
    send: "send",
    loading_conversation: "loading conversation...",
    conversation_not_found: "conversation not found or you don't have access.",
    back_to_chats: "back to chats",

    // Language selector
    language: "language",
    english: "english",
    spanish: "spanish",
    french: "french",

    // Auth pages
    login: "login",
    signup: "sign up",
    username: "username",
    password: "password",
    confirm_password: "confirm password",
    already_have_account: "already have an account?",
    dont_have_account: "don't have an account?",
    login_here: "login here",
    signup_here: "sign up here",

    // Profile page
    edit_profile: "edit profile",
    save: "save",
    cancel: "cancel",
    username_placeholder: "enter username",
    description_placeholder: "enter a short bio",
  },
  ru: {},
  kg: {},
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
}) => {
  // Initialize with browser language or default to English
  const [language, setLanguage] = useState<Language>("en");

  // Effect to load language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem("meowsenger-language");
    if (
      savedLanguage &&
      (savedLanguage === "en" ||
        savedLanguage === "es" ||
        savedLanguage === "fr")
    ) {
      setLanguage(savedLanguage as Language);
    }
  }, []);

  // Save language preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("meowsenger-language", language);
  }, [language]);

  // Translation function
  const t = (key: string): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
