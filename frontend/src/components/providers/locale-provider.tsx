"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, dictionaries, isLocaleCode, type LocaleCode, type MessageTree } from "@/lang";

const STORAGE_KEY = "nya.lang";

type TranslationParams = Record<string, string | number>;

type LocaleContextValue = {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: string, params?: TranslationParams) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isLocaleCode(stored)) {
        setLocaleState(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: LocaleCode) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, params?: TranslationParams) => {
      const value =
        lookup(dictionaries[locale] as MessageTree, key) ??
        lookup(dictionaries[DEFAULT_LOCALE] as MessageTree, key) ??
        key;
      return params ? formatMessage(value, params) : value;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useI18n must be used within LocaleProvider");
  return ctx;
}

function lookup(tree: MessageTree, key: string): string | null {
  let node: string | MessageTree = tree;
  for (const part of key.split(".")) {
    if (typeof node === "string" || !(part in node)) return null;
    node = node[part];
  }
  return typeof node === "string" ? node : null;
}

function formatMessage(template: string, params: TranslationParams): string {
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  );
}
