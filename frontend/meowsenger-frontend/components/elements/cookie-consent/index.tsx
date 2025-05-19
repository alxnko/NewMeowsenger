import React, { useState, useEffect } from "react";
import {
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/elements/modal";
import { Modal } from "@/components/elements/modal";
import { Button } from "@heroui/button";
import { useLanguage } from "@/contexts/language-context";
import LanguageSelector from "@/components/widgets/language-selector";
import { useTheme } from "next-themes";
import { FaSun, FaMoon } from "react-icons/fa";
import { FiAlertTriangle } from "react-icons/fi";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/contexts/toast-context";

const LOCAL_STORAGE_KEY = "meowsenger_cookie_consent";

export const CookieConsent: React.FC = () => {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { isLoggedIn } = useAuth();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [endpointsAvailable, setEndpointsAvailable] = useState(true);

  useEffect(() => {
    // Check if auth endpoints are available
    const checkEndpoints = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/`
        );
        if (!response.ok) {
          setEndpointsAvailable(false);
          showToast(
            "Authentication server unavailable. Some features may not work correctly.",
            "error"
          );
        }
      } catch (error) {
        console.error("Failed to check API availability:", error);
        setEndpointsAvailable(false);
        showToast(
          "Authentication server unavailable. Some features may not work correctly.",
          "error"
        );
      }
    };

    // Only check endpoints if not logged in
    if (!isLoggedIn) {
      checkEndpoints();
    }
  }, [isLoggedIn, showToast]);

  useEffect(() => {
    // Only show for non-logged in users
    if (!isLoggedIn) {
      // Check if user has already given consent
      const hasConsent = localStorage.getItem(LOCAL_STORAGE_KEY);

      // Only show modal if consent hasn't been given yet
      if (!hasConsent) {
        // Small delay to ensure the app is fully loaded
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 500);

        return () => clearTimeout(timer);
      }
    }
  }, [isLoggedIn]);

  const handleAccept = () => {
    // Save consent to local storage
    localStorage.setItem(LOCAL_STORAGE_KEY, "true");
    setIsOpen(false);
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <Modal
      isOpen={isOpen}
      hideCloseButton
      onOpenChange={() => {}} // Empty function to prevent closing by escape/clicking outside
      isDismissable={false} // Cannot be dismissed
      className="lowercase z-[100]"
      title={t("cookie_consent")}
    >
      {!endpointsAvailable && (
        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg mb-2 flex items-center text-sm">
          <FiAlertTriangle className="text-red-500 mr-2" />
          <p className="text-red-600 dark:text-red-400">
            authentication server unavailable. secure storage may not work
            correctly.
          </p>
        </div>
      )}

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {t("cookie_consent_description")}
      </p>

      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
          {t("cookies_we_use")}
        </h4>
        <ul className="text-xs text-neutral-600 dark:text-neutral-300 ml-2 list-disc list-inside space-y-1">
          <li>{t("auth_cookies")}</li>
          <li>{t("preference_cookies")}</li>
          <li>{t("functional_cookies")}</li>
        </ul>
      </div>

      <div>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium mb-1">
              {t("select_your_language")}
            </p>
            <LanguageSelector />
            <p className="text-xs text-neutral-500">
              {t("auto_detected_language")}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">{t("select_theme")}</p>
            <div className="flex items-center gap-1">
              <Button
                isIconOnly
                variant="flat"
                onPress={toggleTheme}
                className="lowercase"
                color={theme === "light" ? "primary" : "default"}
              >
                <FaSun className="text-amber-500" />
              </Button>
              <Button
                isIconOnly
                variant="flat"
                onPress={toggleTheme}
                className="lowercase"
                color={theme === "dark" ? "primary" : "default"}
              >
                <FaMoon className="text-indigo-400" />
              </Button>
              <p className="text-xs text-neutral-500 ml-1">
                {t("auto_detected_theme")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ModalFooter>
        <Button
          color="success"
          onPress={handleAccept}
          className="w-full lowercase"
        >
          {t("accept_and_continue")}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CookieConsent;
