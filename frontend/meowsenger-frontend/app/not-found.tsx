"use client";

import { ROUTES } from "@/config/site";
import { Button } from "@heroui/button";
import Link from "next/link";
import { useEffect } from "react";

export default function NotFound() {
  useEffect(() => {
    console.log("404 - Page Not Found");
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-6xl font-bold text-success">404</h1>
      <p className="text-xl text-center text-gray-600">
        the page you are looking for does not exist
        <span className="block mt-4">you can go to the</span>
      </p>
      <Button
        as={Link}
        href={ROUTES.home}
        variant="flat"
        color="success"
        className="mt-1 text-lg"
      >
        home page
      </Button>
    </div>
  );
}
