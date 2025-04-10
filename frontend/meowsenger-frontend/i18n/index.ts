import { createContext, useContext } from 'react';
import { IntlMessageFormat } from 'intl-messageformat';

// Supported languages
export type Locale = 'en' | 'ru' | 'ky';

export const defaultLocale: Locale = 'en';

// Messages type
export type Messages = Record<string, string>;

// Create a translations cache
const cache: Record<string, Record<string, IntlMessageFormat>> = {};

// Context for providing the current locale
export const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({
  locale: defaultLocale,
  setLocale: () => {},
});

export const useLocale = () => useContext(LocaleContext);

// Load messages for a specific locale
export const loadMessages = async (locale: Locale): Promise<Messages> => {
  try {
    return (await import(`./locales/${locale}.json`)).default;
  } catch (error) {
    console.error(`Could not load messages for locale: ${locale}`, error);
    return {};
  }
};

// Format a message with the given locale and values
export const formatMessage = (
  locale: Locale,
  messages: Messages,
  id: string,
  values?: Record<string, string | number | boolean | Date | null | undefined>
): string => {
  if (!messages[id]) {
    console.warn(`Message with id "${id}" not found in locale "${locale}"`);
    return id;
  }

  // Check if the message is already cached
  if (!cache[locale]) {
    cache[locale] = {};
  }

  if (!cache[locale][id]) {
    cache[locale][id] = new IntlMessageFormat(messages[id], locale);
  }

  return cache[locale][id].format(values) as string;
};

// Hook for using translations
export const useTranslation = () => {
  const { locale, setLocale } = useLocale();
  
  return {
    locale,
    setLocale,
    t: (id: string, values?: Record<string, string | number | boolean | Date | null | undefined>) => {
      // Retrieve messages from context
      const messages = useContext(MessagesContext);
      return formatMessage(locale, messages, id, values);
    }
  };
};

// Context for providing messages
export const MessagesContext = createContext<Messages>({});