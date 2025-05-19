"use client";

import React from "react";
import { Button } from "@/components/elements/button";
import { useEffect } from "react";
import { title, subtitle } from "@/components/primitives";
import { useLanguage } from "@/contexts/language-context";

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

  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 text-center">
      <div className="inline-block max-w-lg mb-6">
        <h1 className={title({ color: "pink" })}>{t("oops")}</h1>
        <p className={subtitle({ class: "mt-4" })}>
          {t("something_went_wrong")}
        </p>
      </div>

      <div className="flex flex-col gap-4 mt-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
          {t("error_apology")}
        </p>
        <Button onClick={reset} color="success" className="mx-auto">
          {t("try_again")}
        </Button>
      </div>
    </div>
  );
}
