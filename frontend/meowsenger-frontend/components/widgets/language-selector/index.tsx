"use client";

import { useLanguage, Language } from "@/contexts/language-context";
import { Select, SelectItem } from "@heroui/select";
import { SharedSelection } from "@heroui/system";

export default function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();

  // Language options
  const languages: { code: Language; label: string }[] = [
    { code: "en", label: "english" },
    { code: "kg", label: "кыргызча" },
    { code: "ru", label: "русский" },
  ];

  const handleLanguageChange = (value: SharedSelection) => {
    // HeroUI Select typically returns a Set with a single key for single-selection
    if (typeof value === "string") {
      setLanguage(value.currentKey as Language);
    } else if (value instanceof Set && value.size > 0) {
      // Get the first (and only) item from the Set
      const selectedLang = Array.from(value)[0];
      if (
        selectedLang === "en" ||
        selectedLang === "ru" ||
        selectedLang === "kg"
      ) {
        setLanguage(selectedLang);
      }
    }
  };

  return (
    <Select
      aria-label={t("language")}
      selectedKeys={[language]}
      onSelectionChange={handleLanguageChange}
      className="min-w-40"
      size="sm"
      variant="flat"
      disallowEmptySelection
    >
      {languages.map((lang) => (
        <SelectItem key={lang.code}>{lang.label}</SelectItem>
      ))}
    </Select>
  );
}
