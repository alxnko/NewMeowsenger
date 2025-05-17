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
import { useAuth } from "./auth-context";
import { authApi } from "@/utils/api-client";

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
  // Initialize with default English
  const [language, setLanguage] = useState<Language>("en");
  const { isLoggedIn, token } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);

  // Detect browser language on initial load
  useEffect(() => {
    const detectBrowserLanguage = (): Language => {
      // Get browser language (e.g., 'en-US', 'ru', 'ky')
      const browserLang = navigator.language.split("-")[0].toLowerCase();

      // Map to our supported languages
      if (browserLang === "ru") return "ru";
      if (browserLang === "ky") return "kg"; // Kyrgyz language code is 'ky' in browser
      return "en"; // Default to English
    };

    // If not logged in or no preferences loaded yet, use browser language
    if (!hasLoadedPreferences) {
      setLanguage(detectBrowserLanguage());
    }
  }, [hasLoadedPreferences]);

  // Effect to load language from backend for authenticated users
  useEffect(() => {
    if (isLoggedIn && token) {
      // First try to get from backend for authenticated users
      authApi
        .getUserPreferences(token)
        .then((prefs) => {
          if (prefs.language && ["en", "ru", "kg"].includes(prefs.language)) {
            setLanguage(prefs.language as Language);
          }
          setHasLoadedPreferences(true);
        })
        .catch((err) => {
          console.error("Failed to load language preference from server:", err);
          // Fall back to localStorage if API call fails
          loadFromLocalStorage();
          setHasLoadedPreferences(true);
        });
    } else {
      // Load from localStorage for non-authenticated users
      loadFromLocalStorage();
      setHasLoadedPreferences(true);
    }
  }, [isLoggedIn, token]);

  // Helper function to load language from localStorage
  const loadFromLocalStorage = () => {
    const savedLanguage = localStorage.getItem("meowsenger-language");
    if (
      savedLanguage &&
      (savedLanguage === "en" ||
        savedLanguage === "ru" ||
        savedLanguage === "kg")
    ) {
      setLanguage(savedLanguage as Language);
    }
  };

  // Save language preference when it changes for authorized users
  useEffect(() => {
    // Only save to localStorage and backend if the user has explicitly set a preference
    // or if they are logged in and we've loaded their preferences
    if (hasLoadedPreferences && isLoggedIn) {
      // Always save to localStorage for all users
      localStorage.setItem("meowsenger-language", language);

      // Only save to backend for authenticated users
      if (token && !isSaving) {
        setIsSaving(true);
        authApi
          .updateUserPreferences(token, { language })
          .catch((err) => {
            console.error("Failed to save language preference to server:", err);
          })
          .finally(() => {
            setIsSaving(false);
          });
      }
    }
  }, [language, isLoggedIn, token, hasLoadedPreferences]);

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
