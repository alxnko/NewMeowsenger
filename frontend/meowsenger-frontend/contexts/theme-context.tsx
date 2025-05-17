import React, { createContext, useContext, useEffect, ReactNode } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "./auth-context";
import { authApi } from "@/utils/api-client";

interface ThemeContextType {
  syncTheme: (theme: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  syncTheme: () => {},
});

export const useCustomTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children: ReactNode;
}

export const CustomThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
}) => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { isLoggedIn, token } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasLoadedPreferences, setHasLoadedPreferences] = React.useState(false);

  // Load theme preference from backend on mount for logged in users
  useEffect(() => {
    if (isLoggedIn && token) {
      authApi
        .getUserPreferences(token)
        .then((prefs) => {
          if (prefs.theme && ["light", "dark"].includes(prefs.theme)) {
            setTheme(prefs.theme);
          }
          setHasLoadedPreferences(true);
        })
        .catch((err) => {
          console.error("Failed to load theme preference from server:", err);
          setHasLoadedPreferences(true);
        });
    } else {
      // If not logged in, respect device theme but don't save
      setHasLoadedPreferences(true);
    }
  }, [isLoggedIn, token, setTheme]);

  // Function to sync theme with backend
  const syncTheme = (newTheme: string) => {
    if (isLoggedIn && token && !isSaving) {
      setIsSaving(true);
      authApi
        .updateUserPreferences(token, { theme: newTheme })
        .catch((err) => {
          console.error("Failed to save theme preference to server:", err);
        })
        .finally(() => {
          setIsSaving(false);
        });
    }
  };

  // Sync theme with backend when it changes, but only for logged-in users
  // and only after we've loaded their preferences
  useEffect(() => {
    if (theme && isLoggedIn && hasLoadedPreferences) {
      syncTheme(theme);
    }
  }, [theme, isLoggedIn, hasLoadedPreferences]);

  return (
    <ThemeContext.Provider value={{ syncTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
