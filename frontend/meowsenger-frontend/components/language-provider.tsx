import React, { useState, useEffect, ReactNode } from 'react';
import { LocaleContext, MessagesContext, Locale, defaultLocale, loadMessages, Messages } from '../i18n';

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<Messages>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to load the language from localStorage
    const savedLocale = localStorage.getItem('meowsenger-locale');
    if (savedLocale && ['en', 'ru', 'ky'].includes(savedLocale)) {
      setLocale(savedLocale as Locale);
    }
  }, []);

  useEffect(() => {
    const loadLocaleMessages = async () => {
      setLoading(true);
      const msgs = await loadMessages(locale);
      setMessages(msgs);
      // Save the selected language to localStorage
      localStorage.setItem('meowsenger-locale', locale);
      setLoading(false);
    };

    loadLocaleMessages();
  }, [locale]);

  const handleSetLocale = (newLocale: Locale) => {
    setLocale(newLocale);
  };

  if (loading && Object.keys(messages).length === 0) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale: handleSetLocale }}>
      <MessagesContext.Provider value={messages}>
        {children}
      </MessagesContext.Provider>
    </LocaleContext.Provider>
  );
};

export default LanguageProvider;