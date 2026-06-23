import { createContext } from 'react';
import type { Language } from './translations';

export type TranslationValues = Record<string, string | number>;

export type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, values?: TranslationValues) => string;
  toggleLanguage: () => void;
};

export const LanguageContext = createContext<LanguageContextValue | null>(null);
