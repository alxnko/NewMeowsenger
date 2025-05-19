"use client";
import { Button } from "@heroui/button";
import { Drawer, DrawerBody, DrawerContent } from "@heroui/drawer";
import { FaSun, FaMoon, FaSignOutAlt } from "react-icons/fa";
import React from "react";
import { useTheme } from "next-themes";
import clsx from "clsx";
import { useAuth } from "@/contexts/auth-context";
import LanguageSelector from "../language-selector";
import { WebSocketStatus } from "@/components/elements/websocket-status";

interface NavMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NavMenu({ isOpen, onClose }: NavMenuProps) {
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <Drawer
      isOpen={isOpen}
      size="xs"
      backdrop="blur"
      placement="bottom"
      onOpenChange={onClose}
      hideCloseButton
      isDismissable={false}
      shouldBlockScroll={false}
      className={clsx(
        "p-2 pb-20 left-1/2 transform -translate-x-1/2 items-center justify-center",
        "max-w-[90%] sm:max-w-96 z-30"
      )}
      classNames={{ wrapper: "items-center justify-center" }}
    >
      <DrawerContent>
        <DrawerBody className="flex flex-col gap-3 items-center">
          {/* Menu items */}
          <div className="flex flex-row gap-2 justify-center">
            <Button isIconOnly variant="faded" onPress={toggleTheme}>
              {theme === "light" ? <FaMoon /> : <FaSun />}
            </Button>
            <Button
              isIconOnly
              variant="faded"
              color="danger"
              onPress={handleLogout}
            >
              <FaSignOutAlt />
            </Button>
            <div onClick={(e) => e.stopPropagation()}>
              <LanguageSelector />
            </div>
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
