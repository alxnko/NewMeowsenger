import { Button } from "@heroui/button";
import { Drawer, DrawerBody, DrawerContent } from "@heroui/drawer";
import { FaSun, FaMoon } from "react-icons/fa";
import React from "react";
import { useTheme } from "next-themes";
import clsx from "clsx";

interface NavMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NavMenu({ isOpen, onClose }: NavMenuProps) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
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
        <DrawerBody>
          <Button isIconOnly variant="faded" onPress={toggleTheme}>
            {theme === "light" ? <FaMoon /> : <FaSun />}
          </Button>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
