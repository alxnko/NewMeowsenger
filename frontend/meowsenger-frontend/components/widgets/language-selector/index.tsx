"use client";

import { useLanguage, Language } from "@/contexts/language-context";
import { Select, SelectItem } from "@heroui/select";
import { SharedSelection } from "@heroui/system";

interface SelectionObject {
  currentKey?: string | number;
}

export default function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();

  // Language options
  const languages: { code: Language; label: string }[] = [
    { code: "en", label: "english" },
    { code: "kg", label: "кыргызча" },
    { code: "ru", label: "русский" },
  ];

  const handleLanguageChange = (selection: SharedSelection) => {
    // Handle both Set and object cases
    let selectedLang: string | undefined;

    if (selection instanceof Set) {
      selectedLang = Array.from(selection)[0]?.toString();
    } else if (
      selection &&
      typeof selection === "object" &&
      "currentKey" in selection
    ) {
      selectedLang = String((selection as SelectionObject).currentKey || "");
    }

    // Only update if we have a valid language
    if (selectedLang && ["en", "ru", "kg"].includes(selectedLang)) {
      console.log("Changing language to:", selectedLang); // Debug log
      setLanguage(selectedLang as Language);
    }
  };

  return (
    <Select
      aria-label={t("language")}
      selectedKeys={new Set([language])}
      onSelectionChange={handleLanguageChange}
      className="min-w-40"
      size="sm"
      variant="flat"
      disallowEmptySelection
      selectionMode="single"
    >
      {languages.map((lang) => (
        <SelectItem key={lang.code} textValue={lang.label}>
          {lang.label}
        </SelectItem>
      ))}
    </Select>
  );
}
