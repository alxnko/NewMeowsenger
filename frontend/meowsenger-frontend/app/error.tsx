"use client";

import React from "react";
import { Button } from "@/components/elements/button";
import { useEffect } from "react";
import { title, subtitle } from "@/components/primitives";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div className="inline-block max-w-lg mb-6">
        <h1 className={title({ color: "pink" })}>oops!</h1>
        <p className={subtitle({ class: "mt-4" })}>something went wrong</p>
      </div>

      <div className="flex flex-col gap-4 mt-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
          we apologize for the inconvenience. please try refreshing the page or
          try again later.
        </p>
        <Button onClick={reset} color="success" className="mx-auto">
          try again
        </Button>
      </div>
    </div>
  );
}
