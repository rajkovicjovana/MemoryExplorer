import { useMemo, useState, type ReactNode } from 'react';
import { LanguageContext, type LanguageContextValue, type TranslationValues } from './languageState';
import { translations, type Language } from './translations';

const languageStorageKey = 'memory-explorer-language';

function isLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'me';
}

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'en';
  }

  return isLanguage(window.localStorage.getItem(languageStorageKey))
    ? (window.localStorage.getItem(languageStorageKey) as Language)
    : 'en';
}

function resolveTranslation(language: Language, key: string): string {
  const parts = key.split('.');
  const lookup = (source: unknown) => parts.reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Record<string, unknown>)[part];
    }

    return undefined;
  }, source);

  const translated = lookup(translations[language]);

  if (typeof translated === 'string') {
    return translated;
  }

  const fallback = lookup(translations.en);

  return typeof fallback === 'string' ? fallback : key;
}

function interpolate(template: string, values?: TranslationValues): string {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, name) => (
    values[name] === undefined ? match : String(values[name])
  ));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  const value = useMemo<LanguageContextValue>(() => {
    const setLanguage = (nextLanguage: Language) => {
      setLanguageState(nextLanguage);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(languageStorageKey, nextLanguage);
      }
    };

    return {
      language,
      setLanguage,
      t: (key, values) => interpolate(resolveTranslation(language, key), values),
      toggleLanguage: () => setLanguage(language === 'en' ? 'me' : 'en'),
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
