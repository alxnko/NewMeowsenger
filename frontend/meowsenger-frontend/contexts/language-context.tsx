import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import en from "./lang-en";
import ru from "./lang-ru";
import kg from "./lang-kg";

// Available languages
export type Language = "en" | "ru" | "kg"; // We'll prepare for more languages even though we're starting with English

// Language context type
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string; // Translation function
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
  en,
  ru,
  kg,
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

  // Translation function (with optional interpolation)
  const t = (key: string, vars?: Record<string, string | number>): string => {
    let str = translations[language][key] || translations.en[key] || key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`{${k}}`, "g"), String(v));
      });
    }
    return str;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
