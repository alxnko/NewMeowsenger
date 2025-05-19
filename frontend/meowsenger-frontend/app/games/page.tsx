"use client";

import { useLanguage } from "@/contexts/language-context";
import { title } from "@/components/primitives";

export default function GamesPage() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h1 className={title()}>{t("not_available_now")}</h1>
    </div>
  );
}
