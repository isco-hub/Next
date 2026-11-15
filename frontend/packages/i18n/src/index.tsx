import IntlMessageFormat from "intl-messageformat";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { englishMessages } from "./catalogues";
import {
  isPseudoEnabled,
  pseudoLocalize,
  setPseudoEnabled as persistPseudo,
} from "./pseudo";
import { DEFAULT_LOCALE, FORMAT_LOCALE, LANGUAGE_TAG, type Locale } from "./status";

export * from "./status";
export * from "./pseudo";
export { englishMessages, englishKeys, flattenMessages } from "./catalogues";
export type { Messages } from "./catalogues";

export type MessageValues = Record<string, string | number | Date | boolean>;

export interface I18nContextValue {
  locale: Locale;
  t: (key: string, values?: MessageValues) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (
    value: Date | string | number,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  pseudo: boolean;
  setPseudo: (enabled: boolean) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  children: ReactNode;
  markFallback?: boolean;
}

export const I18nProvider = ({
  children,
  markFallback = import.meta.env.DEV,
}: I18nProviderProps) => {
  const locale = DEFAULT_LOCALE;
  const [pseudo, setPseudoState] = useState<boolean>(() => isPseudoEnabled());
  const formatterCache = useRef(new Map<string, IntlMessageFormat>());

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = LANGUAGE_TAG[locale];
  }, [locale]);

  const setPseudo = useCallback((enabled: boolean) => {
    persistPseudo(enabled);
    setPseudoState(enabled);
  }, []);

  const t = useMemo(() => {
    return (key: string, values?: MessageValues): string => {
      const template = englishMessages[key];
      if (template === undefined) {
        return markFallback ? `⟦${key}⟧` : key;
      }
      const cacheKey = `${locale}:${key}:${template}`;
      let formatter = formatterCache.current.get(cacheKey);
      if (!formatter) {
        try {
          formatter = new IntlMessageFormat(template, FORMAT_LOCALE[locale]);
          formatterCache.current.set(cacheKey, formatter);
        } catch {
          return template;
        }
      }
      let output: string;
      try {
        output = String(formatter.format(values ?? {}));
      } catch {
        output = template;
      }
      if (pseudo) output = pseudoLocalize(output);
      return output;
    };
  }, [locale, markFallback, pseudo]);

  const formatDate = useCallback(
    (value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(FORMAT_LOCALE[locale], {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...options,
      }).format(new Date(value)),
    [locale],
  );

  const formatDateTime = useCallback(
    (value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(FORMAT_LOCALE[locale], {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        ...options,
      }).format(new Date(value)),
    [locale],
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(FORMAT_LOCALE[locale], options).format(value),
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t,
      formatDate,
      formatDateTime,
      formatNumber,
      pseudo,
      setPseudo,
    }),
    [locale, t, formatDate, formatDateTime, formatNumber, pseudo, setPseudo],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
};


