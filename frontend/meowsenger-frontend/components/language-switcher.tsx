import React from 'react';
import { useTranslation, Locale } from '../i18n';

export const LanguageSwitcher = () => {
  const { locale, setLocale } = useTranslation();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setLocale(event.target.value as Locale);
  };

  return (
    <select 
      value={locale}
      onChange={handleChange}
      className="text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-transparent py-1 px-2"
    >
      <option value="en">English</option>
      <option value="ru">Русский</option>
      <option value="ky">Кыргызча</option>
    </select>
  );
};

export default LanguageSwitcher;