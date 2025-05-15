"use client";
import { Button } from "@heroui/button";
import React from "react";
import { Image } from "@heroui/image";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import NavMenu from "./menu";
import { useDisclosure } from "@heroui/modal";
import { useAuth } from "@/contexts/auth-context";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/contexts/language-context";

export default function NavBar() {
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure();
  const { isLoggedIn } = useAuth();
  const pathname = usePathname();
  const { t } = useLanguage();

  // Hide the navbar when the URL contains /chats/group or /chats/user
  const shouldHideNavBar =
    pathname.includes("/chats/group") || pathname.includes("/chats/user");

  if (shouldHideNavBar) {
    return null;
  }

  const LogoButton = () => {
    return (
      <Button
        isIconOnly
        className="rounded-full h-12 w-12 p-1 !bg-neutral-400 dark:!bg-neutral-600"
        variant="faded"
        onPress={onOpenChange}
      >
        <Image src="/catuser.png" alt="cat" />
      </Button>
    );
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[100]">
        <div className="flex bg-neutral-100 dark:bg-neutral-900 text-default-950 dark:text-default-50 rounded-full">
          {!isLoggedIn ? (
            <>
              <Button
                as={Link}
                href={ROUTES.login}
                className="m-1 w-24 rounded-full"
                variant="light"
              >
                {t("login")}
              </Button>
              <LogoButton />
              <Button
                as={Link}
                href={ROUTES.signup}
                className="m-1 w-24 rounded-full"
                variant="light"
              >
                {t("signup")}
              </Button>
            </>
          ) : (
            <>
              <Button
                as={Link}
                href={ROUTES.chats}
                className="m-1 w-24 rounded-full"
                variant="light"
              >
                {t("chats")}
              </Button>
              <LogoButton />
              <Button
                as={Link}
                href={ROUTES.settings}
                className="m-1 w-24 rounded-full"
                variant="light"
              >
                {t("settings")}
              </Button>
            </>
          )}
        </div>
      </div>
      <NavMenu isOpen={isOpen} onClose={onClose} />
    </>
  );
}
