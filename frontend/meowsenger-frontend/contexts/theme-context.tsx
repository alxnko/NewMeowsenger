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
  const { theme, setTheme } = useTheme();
  const { isLoggedIn, token } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);

  // Load theme preference from backend on mount
  useEffect(() => {
    if (isLoggedIn && token) {
      authApi
        .getUserPreferences(token)
        .then((prefs) => {
          if (prefs.theme && ["light", "dark"].includes(prefs.theme)) {
            setTheme(prefs.theme);
          }
        })
        .catch((err) => {
          console.error("Failed to load theme preference from server:", err);
        });
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

  // Sync theme with backend when it changes
  useEffect(() => {
    if (theme && isLoggedIn) {
      syncTheme(theme);
    }
  }, [theme, isLoggedIn]);

  return (
    <ThemeContext.Provider value={{ syncTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
