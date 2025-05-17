import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { useLanguage } from "@/contexts/language-context";
import LanguageSelector from "@/components/widgets/language-selector";
import { useTheme } from "next-themes";
import { FaSun, FaMoon } from "react-icons/fa";
import { useAuth } from "@/contexts/auth-context";

const LOCAL_STORAGE_KEY = "meowsenger_cookie_consent";

export const CookieConsent: React.FC = () => {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { isLoggedIn } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

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
      onClose={() => {}} // Empty function to prevent closing by escape/clicking outside
      isDismissable={false} // Cannot be dismissed
      backdrop="blur"
      className="lowercase"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h3 className="text-xl font-medium lowercase">
            {t("cookie_consent")}
          </h3>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            {t("cookie_consent_description")}
          </p>

          <div className="border-t border-b border-neutral-200 dark:border-neutral-800 py-4 my-2">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium mb-2">
                  {t("select_your_language")}
                </p>
                <LanguageSelector />
                <p className="text-xs text-neutral-500 mt-1">
                  {t("auto_detected_language")}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">{t("select_theme")}</p>
                <div className="flex items-center gap-2">
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
                  <p className="text-xs text-neutral-500 ml-2">
                    {t("auto_detected_theme")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-neutral-500 italic">
            {t("preferences_not_saved")}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            color="success"
            onPress={handleAccept}
            className="w-full lowercase"
          >
            {t("accept_and_continue")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CookieConsent;
