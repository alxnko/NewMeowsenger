import { Button } from "@heroui/button";
import { Drawer, DrawerBody, DrawerContent } from "@heroui/drawer";
import { FaSun, FaMoon, FaSignOutAlt } from "react-icons/fa";
import React from "react";
import { useTheme } from "next-themes";
import clsx from "clsx";
import { useAuth } from "@/contexts/auth-context";

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
      className={clsx(
        "p-2 pb-20 left-1/2 transform -translate-x-1/2 items-center justify-center",
        "max-w-[90%] sm:max-w-96"
      )}
      classNames={{ wrapper: "items-center justify-center" }}
    >
      <DrawerContent>
        <DrawerBody className="flex flex-row gap-2 justify-center">
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
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
