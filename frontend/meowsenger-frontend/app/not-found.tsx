"use client";

import { ROUTES } from "@/config/site";
import { title, subtitle } from "@/components/primitives";
import { Button } from "@/components/elements/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div className="inline-block max-w-lg mb-6">
        <h1 className={title()}>404</h1>
        <br />
        <h2 className={title({ color: "green" })}>page not found</h2>
        <p className={subtitle({ class: "mt-4" })}>
          the page you are looking for doesn't exist or has been moved
        </p>
      </div>

      <Button as={Link} href={ROUTES.home} color="success" className="mt-4">
        go to home page
      </Button>
    </div>
  );
}
