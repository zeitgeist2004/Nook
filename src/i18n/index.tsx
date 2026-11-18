import React, { createContext, useContext, useEffect, useMemo } from 'react';
import type { AppLanguage } from '../types';
import type { TranslationDictionary } from './types';
import { pt } from './locales/pt';
import { en } from './locales/en';
import { es } from './locales/es';

export type { TranslationDictionary } from './types';

export const dictionaries: Record<AppLanguage, TranslationDictionary> = {
  pt,
  en,
  es,
};

export const DEFAULT_LANGUAGE: AppLanguage = 'en';

export const SUPPORTED_LANGUAGES: Array<{
  id: AppLanguage;
  name: string;
  nativeName: string;
}> = [
  { id: 'en', name: 'English', nativeName: 'English' },
  { id: 'pt', name: 'Português (Brasil)', nativeName: 'Português' },
  { id: 'es', name: 'Español', nativeName: 'Español' },
];

export function normalizeLanguage(raw?: string | null): AppLanguage {
  if (!raw) return DEFAULT_LANGUAGE;
  const lower = raw.trim().toLowerCase();
  if (lower.startsWith('pt')) return 'pt';
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('en')) return 'en';
  return DEFAULT_LANGUAGE;
}

let activeLanguage: AppLanguage = DEFAULT_LANGUAGE;

export function hasExplicitStoredLanguage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const direct = window.localStorage.getItem('nook_language');
    if (direct) return true;
    const savedSettings =
      window.localStorage.getItem('nook_settings') ||
      window.localStorage.getItem('lumina_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      if (parsed && typeof parsed.language === 'string' && parsed.language.trim()) {
        return true;
      }
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

export function getStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') return activeLanguage;
  try {
    const direct = window.localStorage.getItem('nook_language');
    if (direct) return normalizeLanguage(direct);

    const savedSettings =
      window.localStorage.getItem('nook_settings') ||
      window.localStorage.getItem('lumina_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      if (parsed && typeof parsed.language === 'string') {
        return normalizeLanguage(parsed.language);
      }
    }
  } catch {
    // ignore storage access issues
  }
  return activeLanguage;
}

export function getCurrentLanguage(): AppLanguage {
  return activeLanguage || getStoredLanguage();
}

export function getTranslations(lang?: AppLanguage): TranslationDictionary {
  const resolved = lang ? normalizeLanguage(lang) : getCurrentLanguage();
  return dictionaries[resolved] || dictionaries.en;
}

export function formatMessage(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match
  );
}

interface LanguageContextValue {
  language: AppLanguage;
  t: TranslationDictionary;
  format: (template: string, vars: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  t: dictionaries.en,
  format: formatMessage,
});

interface LanguageProviderProps {
  language: AppLanguage;
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  language,
  children,
}) => {
  const normalized = normalizeLanguage(language);
  activeLanguage = normalized;

  const t = dictionaries[normalized] || dictionaries.en;

  useEffect(() => {
    activeLanguage = normalized;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = t.meta.htmlLang;
      document.title = t.meta.documentTitle;
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('nook_language', normalized);
      }
    } catch {
      // ignore storage quota errors
    }
  }, [normalized, t]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language: normalized,
      t,
      format: formatMessage,
    }),
    [normalized, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useTranslation(): LanguageContextValue {
  return useContext(LanguageContext);
}
