"use client";
import { Button } from "@heroui/button";
import React from "react";
import { Image } from "@heroui/image";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import NavMenu from "./menu";
import { useDisclosure } from "@heroui/modal";

export default function NavBar() {
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure();

  return (
    <>
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[100]">
        <div className="flex bg-neutral-300 dark:bg-neutral-700 text-default-950 dark:text-default-50 rounded-full">
          <Button
            as={Link}
            href={ROUTES.login}
            className="m-1 w-24 rounded-full"
            variant="light"
          >
            login
          </Button>
          <Button
            isIconOnly
            className="rounded-full h-12 w-12 p-1"
            variant="faded"
            onPress={onOpenChange}
          >
            <Image src="/catuser.png" alt="cat" />
          </Button>
          <Button
            as={Link}
            href={ROUTES.signup}
            className="m-1 w-24 rounded-full"
            variant="light"
          >
            signup
          </Button>
        </div>
      </div>
      <NavMenu isOpen={isOpen} onClose={onClose} />
    </>
  );
}
